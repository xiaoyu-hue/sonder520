# ADR-002：本地优先架构与存储分层

- 状态：已采纳
- 背景：产品定位"数据 100% 留在本地浏览器"的隐私优先个人工作台；浏览器存储有 5MB 配额硬上限与可靠性差异。
- 决策：
  1. 主快照为 IndexedDB（容量与可靠性优先，异步 API 经 TrustLayer 门面统一返回结构化状态），localStorage 为**降级副本**（同步兜底；跨标签写锁/让位协议基线），全部 store 模块经统一 Store 门面读写。
  2. **双写双存**（IDB 主快照 + LS 副本，写序 `_persistLocal → _idbWrite` 不得交换）：IDB 不可用/写失败时自动降级 LS 副本并如实上报（`getStorageStatus()` 结构化状态，`reason: indexeddb_write_failed / indexeddb_unavailable`），恢复后自动回主；读取按「哪个版本更新且完整」取新（v6.0 Phase 2 反转主/副本，原「LS 主写 + IDB 镜像」作废）。
  3. 可选加密：PBKDF2 派生密钥 + AES-GCM-256 逐记录加密（encryption.js 独立模块，锁定态防明文落盘）。
  4. 备份体系：导出/导入 JSON（可加密，格式 `sonder-enc-backup-v1`），导入成功必须落盘完成才 resolve（防"导入后立即刷新丢失"）。
  5. 配额治理：超 4.5MB 顶部警示条引导导出备份；双写后端同时失效时红色危机警示条（quota-fail 契约测试钉死）。
- 理由：IDB 的容量/可靠性为主 + localStorage 同步副本兜底是对单机场景的最优权衡（v6.0 Phase 2 落地）；加密是"可选"而非默认，降低误锁风险。
- 代价：双写路径增加实现复杂度（IDB 竞态、跨后端一致性由测试覆盖：idb/upgrade/quota-fail/enc-race 等）；设备间数据独立，多设备靠备份文件手工迁移（产品接受）。