# ADR-007：多标签写锁（Web Locks 让位协议）

- 状态：已采纳
- 背景：应用为单一 localStorage 权威快照 + IDB 镜像（ADR-002）的单机本地应用。浏览器同源多标签页打开时，各标签各自持内存态并按自己的防抖节奏落盘，官方 `storage` 事件有竞态窗口：轻量级「读旧 → 写新」覆盖另一标签的更新数据（last-write-wins 丢数据）。研究结论（2026-08）：不引入 SQLite WASM / OPFS / CRDT / SharedArrayBuffer / RxDB-PouchDB（复杂度与单机收益不成比例，Firefox 不支持 SAB 场景），采用 Web Locks API 最小化防护。
- 决策：
  1. 锁名 `'sonder-writer'` 全局唯一。仅防抖落盘点（`_persistLocal` 调度的 idle 回调）经锁排队；`flushPersist()` 显式冲刷与无 requestIdleCallback 环境的同步路径不经锁（同步执行无并发窗口暴露，保持旧行为）。
  2. 锁内写前检查：读当前 localStorage 的 `sonder_meta_v1`（`STORAGE_META_KEY`），与本实例基线 `_lastSeenMeta` 比对——**不一致即让位**：放弃本次待写（可能基于旧内存态），改吸收权威新快照（`_absorbNewer`：`_decryptParse` 解快照 → `normalize` → `_rev++` → `_lastSeenMeta` 刷新 → 广播 `/data/all` 触发全页重绘），不覆盖他人更新。
  3. 无锁环境降级：`navigator.locks` 缺失（Node/测试/旧浏览器）或 `locks.request` 抛错/返回 reject 时，回退直接落盘（等价旧行为，可用性优先）。
  4. 基线同步：每次成功落盘后 `_lastSeenMeta = _meta`，连续同标签写不误判让位。
- 现状边界（接受，不升级）：IDB 镜像不随让位吸收重建（明文快照以 localStorage 为权威，IDB 只做冗余）；加密态下 `_decryptParse` 无会话密钥时既不覆盖也不吸收，保持现状等用户输入密钥。
- **加密态不经锁**（重要边界）：`_encSave` 加密落盘后立即调 `flushPersist()` 直写——加密回读验证依赖落盘与读取紧密衔接，不能走 idle 防抖 + 锁排队。因此多标签写锁**只保护明文态**；加密用户多标签同时编辑时仍为 last-write-wins 覆盖窗口（与启用该功能前一致）。这是正确性优先于一致性的取舍，非遗漏。
- 代价：仅防抖落盘点受保护，storage 事件监听校验等已内置；锁在此前无锁的同步路径上为零开销。

## 测试契约（ADR-003 原则）

`tests/store-write-lock.test.js`（Node 直跑，注入 fake requestIdleCallback + fake navigator.locks）：

- 有锁时经 `'sonder-writer'` 持锁落盘，meta 一并写入；
- 同样两次连续写正常落盘，不误判让位；
- 外部已写更新（meta 不一致）→ 不覆盖新快照、吸收新快照、`_rev` 递增、广播 `/data/all`；
- 锁异常（reject）→ 降级直接落盘、数据不丢；
- 无 `navigator.locks` 环境 → 直接落盘（等价旧行为）。