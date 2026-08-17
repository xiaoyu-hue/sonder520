# ADR-007：多标签写锁（Web Locks 让位协议）

- 状态：已采纳
- 背景：应用为 IndexedDB 主快照 + localStorage 副本（ADR-002，v6.0 Phase 2 反转主/副本；跨标签写锁基线仍以 LS 的 `sonder_meta_v1` 为准，LS 同步可见性最适合做锁协议载体）的单机本地应用。浏览器同源多标签页打开时，各标签各自持内存态并按自己的防抖节奏落盘，官方 `storage` 事件有竞态窗口：轻量级「读旧 → 写新」覆盖另一标签的更新数据（last-write-wins 丢数据）。研究结论（2026-08）：不引入 SQLite WASM / OPFS / CRDT / SharedArrayBuffer / RxDB-PouchDB（复杂度与单机收益不成比例，Firefox 不支持 SAB 场景），采用 Web Locks API 最小化防护。
- 决策：
  1. 锁名 `'sonder-writer'` 全局唯一。仅防抖落盘点（`_persistLocal` 调度的 idle 回调）经锁排队；`flushPersist()` 显式冲刷与无 requestIdleCallback 环境的同步路径不经锁（同步执行无并发窗口暴露，保持旧行为）。
  2. 锁内写前检查：读当前 localStorage 的 `sonder_meta_v1`（`STORAGE_META_KEY`），与本实例基线 `_lastSeenMeta` 比对——**不一致即让位**：放弃本次待写（可能基于旧内存态），改吸收权威新快照（`_absorbNewer`：`_decryptParse` 解快照 → `normalize` → `_rev++` → `_lastSeenMeta` 刷新 → 广播 `/data/all` 触发全页重绘），不覆盖他人更新。
  3. 无锁环境降级：`navigator.locks` 缺失（Node/测试/旧浏览器）或 `locks.request` 抛错/返回 reject 时，回退直接落盘（等价旧行为，可用性优先）。
  4. 基线同步：每次成功落盘后 `_lastSeenMeta = _meta`，连续同标签写不误判让位。
- **加密态纳入同一协议**（2026-08-17 更新）：`_encSave` 的落盘经 `_lockedEncWrite`（Promise 化的锁内封装）走同一 `'sonder-writer'` 锁与同款写前 meta 检查——另一标签已写更新密文 → 让位 `_absorbNewer()`（解密吸收，不落盘本次密文）。Promise 化保证 `enableEncryption` 的回读验证（`readSnapshot('local')`）在锁回调完成后才执行；无锁环境降级直接落盘。圆了上文「加密态不受多标签保护」的旧边界，代价是加密落盘多一次同步读 meta（微秒级，可忽略）。
- 现状边界（接受，不升级）：让位吸收（`_absorbNewer`）只重置内存基线并广播全量重绘，不立即重建 IDB 主快照（下次防抖落盘双写自然刷新）；加密态下 `_decryptParse` 无会话密钥时既不覆盖也不吸收，保持现状等用户输入密钥。
- 代价：仅防抖落盘点受保护，storage 事件监听校验等已内置；锁在此前无锁的同步路径上为零开销。

## 测试契约（ADR-003 原则）

`tests/store-write-lock.test.js`（Node 直跑，注入 fake requestIdleCallback + fake navigator.locks）：

- 有锁时经 `'sonder-writer'` 持锁落盘，meta 一并写入；
- 同样两次连续写正常落盘，不误判让位；
- 外部已写更新（meta 不一致）→ 不覆盖新快照、吸收新快照、`_rev` 递增、广播 `/data/all`；
- 锁异常（reject）→ 降级直接落盘、数据不丢；
- 无 `navigator.locks` 环境 → 直接落盘（等价旧行为）；
- 加密态：meta 一致 → 正常加密落盘不误报；meta 不一致（另一标签已写密文）→ 让位不覆盖、解密吸收、广播 `/store/yielded` + `/data/all`；无锁 → 降级直接加密落盘（真加密引擎驱动，同一盐 + 密码手工构造"另一标签密文"闭环）。