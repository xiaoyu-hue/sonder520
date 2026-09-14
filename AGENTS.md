# Sonder 项目协作规则（永久记忆）

依据《Sonder-Frame AI 实施规范 v1.1》与《Sonder-Frame 架构原理与实现指南 v1.1》提炼。

## 项目本质

- Sonder 是**已稳定、已上线、测试完备**的本地优先个人生产力 Web App：原生 JS、零构建、零运行时依赖。**这不是空白项目，禁止当重写许可。**
- 现状基线：706 项测试通过、296 次提交、14 份 ADR（ADR-013 写路径收口 / ADR-014 Phase④ IndexedDB 真源反转已落地）、双站线上（CF Pages + GH Pages，缓存 v99）、IndexedDB 主快照 + localStorage 副本（双写双存，集合级逐 key；IDB=载入真源，LS=跨标签信号+副本）、可选 AES-GCM 加密（逐集合 bundle）、PWA、Web Worker、12 个 hash 路由模块。
- v6.0 方向：Sonder-Frame 内部框架（渐进式），**④ IndexedDB 优先写（LS 降级为 fallback）是核心遗留项**。

## 第一原则

- **禁止 Big Bang Rewrite**：只允许"旧系统 + 新框架 → 迁移一个模块 → 全量测试 → 下一个"。任一阶段测试失败即停止。
- 优先级：**数据安全 > 旧功能 > 测试 > 正确性 > 性能 > 代码漂亮**。用户数据丢失 = 项目失败。
- 不确定怎么改时，先读相关现有代码、找到对应测试、确认 storage key / 事件 / DOM 契约，再设计修改。

## 分层架构（Sonder-Frame）

依赖方向自上而下单向：Application → ModuleFactory → VisualEngine/EventBridge → TrustLayer → Storage。禁止反向依赖。

```
Application
    ↓
ModuleFactory（标准模块 CRUD / Schema / 状态 / 查询）
    ↓
VisualEngine + EventBridge（UI 渲染 / 跨模块事件）
    ↓
TrustLayer（Storage / Encryption / Backup / Migration / Recovery）
    ↓
IDB（Primary） + localStorage（Fallback/元数据） + Crypto
```

- **TrustLayer 职责**：异步 API（get/set/remove 全部 Promise）；返回值结构化 `{ok, backend, degraded, critical, reason}`，禁止压成裸 boolean；IndexedDB 失败自动 fallback、显示危机状态、引导导出备份。
- **模块不得直连 IndexedDB / localStorage / crypto.subtle**，一律经 TrustLayer（加密是 TrustLayer 装饰器）。
- **State 分离**：records（真源）/ filters / sort / view（派生），query 纯净不改 records 不触 render；禁止外泄可变引用（不得 `state.records.push`）。
- **add/update/delete 生命周期**：validate → normalize → 生成 id/时间戳 → 持久化成功 → 更新内存 → 重算 view → render → emit。持久化失败不得谎报成功、不得 emit 成功事件；delete 不伪装已删除。
- **EventBridge**：事件名集中为常量表并带 payload 契约（谁发/谁听/结构/缺字段怎么办）；on 返回 unsubscribe；只能用于跨模块弱耦合，模块内部用直接调用；destroy 必须完整清理（listener/timer/unsubscribe）。
- **VisualEngine**：用户输入默认不可信——textContent 优先，innerHTML 必须过 sanitize，customRender 承担额外 XSS 审查；复用现有设计 token（墨色/宣纸/液态玻璃/水墨），不创造第二套视觉语言。
- **ModuleConfig 必须验证**：validate → normalize → freeze；非法配置立即失败。字段类型第一版只许 text/textarea/date/boolean/number/select/array。
- **Specialized Module 例外**：游戏（五子棋/扫雷）、Dashboard、统计、拖拽日历、复杂编辑器允许独立实现，只共享 TrustLayer/EventBridge/VisualEngine。

## 数据与迁移协议

- 主存原则：**IndexedDB = 真源，localStorage = fallback**（v6.0 Phase 2 已落地：IDB 主快照 + LS 副本，双写写序 `_persistLocal → _idbWrite` 不得交换；跨标签写锁基线仍以 LS meta 为准）。
- 数据携带 `schemaVersion` + `updatedAt`，读取按"哪个版本更新且完整"判断，不靠哪个先返回。
- 迁移流程：读旧 → 识别版本 → 迁移 → 验证 → 写新 → 验证 → commit。**失败绝不得覆盖原始数据。**
- **严禁先删旧 key 再写新 key**；旧 key 兼容用 `legacyStorageKeys` + Migration Layer 转换，成功后处理旧键。
- 导入数据不可信：Parse → Validate schema/fields → Sanitize → Migration → Preview → Persist，禁止 `Object.assign(state, importedJson)`。
- 异步竞态防护：revision / requestId / operation token，返回时校验过期即丢弃，禁止"最后一次 Promise 覆盖最新状态"。

## 测试纪律

- **迁移基线 584 项测试是迁移安全网，不是旧包袱**——不得因"更干净"而大规模删除；旧测试验证行为则保留，仅验证废弃内部实现才可重写。
- 分层保持：Unit / Contract（createModule 必须成功且有 add/getById/query/update/delete/destroy）/ Integration（Factory+TrustLayer、Factory+VisualEngine、Module+EventBridge）/ E2E（用户可见行为：新建→刷新→还在）。
- 迁移前 `npm test` 必须过；迁移后必须再过；失败先判断（真 bug / 依赖旧内部实现 / 有意行为改变），**禁止"先改测试"逃避**；必须确认行为改变是否有意。
- 测试预算参考：全量约 124s（motion Toast 5.4s / games-worker 3.3s / today 3.2s 最慢），超时阈值 30s。

## 框架克制（防过度设计）

- 只在"至少 2-3 个模块重复需要"时才进框架；单模块需求放业务层。
- 复杂度预算：第一版禁止插件系统 / DI 容器 / 响应式引擎 / 虚拟 DOM / ORM / DSL / 权限系统 / RPC / 微前端。
- **停止条件**（满足任一即暂停加抽象，重新评估）：测试回归持续、数据迁移异常、storage 不一致、框架大量 if/else 特判、ModuleFactory 膨胀、Specialized 被强行通用化。
- 性能假设：<5000 条标准记录允许全量重绘；事件用容器级委托，不逐卡绑监听。
- 新框架 API 需同时满足：多模块重复 + 显著减重复 + 契约清晰 + 不过度增复杂。

## 提交与审查

- 禁止一次提交混入多层改动（TrustLayer + ModuleFactory + VisualEngine + EventBridge + 迁移 + CSS = 禁止）。按层拆提交，测试随后。
- 每 PR/commit 前对照检查：旧行为？storage key？schema？迁移？加密？XSS？innerHTML？新事件契约？async race？listener/timer 清理？PWA/移动端影响？回归测试？ADR 更新？
- 架构修改必须说明：为什么改、改哪层、为何该层负责、影响哪些模块/数据、测试怎么证明、失败怎么回滚。
- 全量回归后同步文档数字（README/PRD/CHANGELOG/device-acceptance 的测试基线、缓存版本、示例数字）。

## 决策协作规范（决策三问，最高优先）

作者是最终决策者，Agent 负责专业判断与执行。**涉及以下任一情况时，必须先向作者完整呈现"决策三问"，等作者明确拍板后才能执行**，不得默默执行或仅做告知：

- **不可逆操作**：删除/覆盖代码、删除分支、强制推送、改写历史、清空数据
- **花钱的操作**：购买服务、付费 API、升级订阅、云资源
- **对外发布**：发布 Release、打 tag、公开发文、部署线上
- **影响项目走向**：架构变更、技术选型、版本号策略、停用/移除既有功能、数据迁移

### 决策三问（缺一不可，全部用大白话回答）

1. **坏处/代价**：这个方案的缺点、成本、风险是什么？不得轻描淡写或隐藏。
2. **不做的后果**：如果不做或推迟做，会失去什么？损失多大？
3. **后悔条件**：什么情况下这个决定会被证明是错的？多久能反悔？反悔成本多大？

### 附加要求

- 有替代方案时给出至少一个，并说明为什么不用它。
- 涉及安全、用户数据、密钥时，默认主动提醒风险，敏感信息不得写死在代码里。
- 不确定的信息明确说"不确定"，禁止编造库名、API、版本号。
- 完整反问清单与拍板记录模板见 `docs/DECISION_REVIEW.md`。

## 文档与版本同步（发布必查）

- 版本发布 / 功能变更 / CI 变更后，必须对照 `docs/DOC_SYNC.md` 逐项检查再合 PR。
- 版本号唯一真源是 `package.json`，其他文档一律从它派生，禁止各写各的。
- 测试数、文件数、SW 缓存版本等数字以实际输出为准，README 声明必须与实测一致。
- 发布前必须跑旧版本号残留 grep，确认无遗漏后再发 tag / Release。
- 违反同步规范导致"文档与代码不一致"的提交，作者有权要求返工。

## 命令速查

- `npm test` 全量测试；`npm run typecheck`；`npm run lint`；`npm run test:e2e`（Playwright 冒烟）
- `npm run sync-sw`：SW 缓存指纹/清单同步，内容变更后必须跑，否则部署会漏指纹。
- 部署由 CF Pages + GH Pages 自动触发（push main）。