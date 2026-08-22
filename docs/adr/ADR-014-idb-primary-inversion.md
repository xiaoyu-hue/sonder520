# ADR-014: Phase ④ IndexedDB 真源反转（IDB Primary 落地）

- 状态：已采纳
- 日期：2026-08-22
- 关联：ADR-002（存储分层）、ADR-007（多标签写锁）、ADR-013（写路径统一收口）

## 背景

规范定位 IndexedDB = Primary Data Store、localStorage = Fallback / Critical State / Metadata。但实现长期停留在"双写 + 冲突平局取 LS"：`_loadColsMerge` 仅在 IDB savedAt 严格大于 LS meta 时才采用 IDB。这是 AGENTS.md 所列 v6.0 核心遗留项"④ IndexedDB 优先写（LS 降级为 fallback）"。ADR-013 的 `_storeWrite` 收口使本变更只需触碰单一函数内部。

## 决策

1. **稳态载入冲突消解反转**（`_loadColsMerge`）：两侧有效时，IDB 在 savedAt **同刻或更新**（`>=`）即胜出；LS 仅在严格更新或 IDB 缺失/损坏时接管。
2. **物理写序反转**（`_storeWrite.runPhases`）：合并待写 + 盖 `_meta` → **IDB 主快照先落** → LS 副本随后 flush。两相位共用同一 savedAt；无 idle API 的旧环境同步直写分支属兼容行为，不在写序承诺内。
3. **角色边界保持**：跨标签信号通道（storage 事件）与写锁让位基线仍以 LS meta 为准——LS 是唯一能产生跨标签事件的介质，将其保留为"信号 + 副本"层符合规范的 Metadata 定位；IDB 成为载入真源。
4. **引导期豁免**：`_migrateLegacyIfNeeded` 返回是否刚执行拆分；刚拆分的那一次合并平局仍取 LS（split 回声两侧内容恒等，且首次安装不应误报"采用 IDB"触发全量重绘）。`_splitLegacy` 自身维持保守旧规则（构造期异步时序窗）。豁免仅作用于当次 loadIdb 调用。

## 后果

- 正面：真源定位与规范一致；断电/配额场景下主快照权威性明确；为未来"LS 只存 metadata"的进一步收缩留门。
- 取舍：平局语义从 LS 改为 IDB——同批双写两侧内容恒等，用户无感知；`loadIdb()` 返回值在纯回填场景仍为 false（引导豁免保证），既有 UX 重绘契约不变。
- 测试：新增 `tests/idb-primary.test.js` ×3（rawLS 注入构造纯冲突：平局取 IDB / LS 严格新接管 / 物理写序断言）；既有 `idb.test.js` "LS 较新不回退""IDB 空时不采用"语义在豁免设计下原样通过。
- 回滚：单文件 revert store.js 即可；数据格式零变化（无迁移、无 key 变更）。
