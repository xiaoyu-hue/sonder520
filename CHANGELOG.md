# Changelog

本项目所有重要变更均记录于此。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循语义化版本（SemVer）。完整版本演进另见 [PRD.md](PRD.md) 的版本历史表。

## [v6.0] - 规划中（未发布）

### 已实施（工程基线，尚未发版）

- **games.js 域拆分（1056 → ~220 行）**：按职责拆为 `games-shared.js`（共享状态/AI 调度，须最先加载）+ `games-mini.js`（四款休闲小游戏）+ `games-battle.js`（对弈/AI/战绩）+ 编排层 games.js；index.html 脚本顺序契约同步扩展（games-logic → games-view → games-shared → games-mini → games-battle → games.js），行为零变更（110 项游戏测试全绿，全量 516 项）。契约测试 state.test.js 白名单与 `SonderGames*` 全局声明（globals.d.ts）随拆分层级同步。
- **ESM 试验田（ADR-001 演进条款落地评估）**：新增 `js/quotes-core.mjs`（纯 ESM 零依赖）+ 双实现一致性测试——生产保持 UMD/零构建不动摇（qa.test.js `require` quotes.js 依赖 UMD；harness 注入方式已升级，见下），试验田以一致性守卫证明「同源双实现」策略可行。
- **ADR 治理落地**：docs/adr/README.md 建立三态状态体系（提议/已采纳/已废弃）+ 全部 ADR 状态索引；harness 脚本注入由 `window.eval` 改为真实 `<script>` 元素（执行语义与浏览器一致，为原生 ESM/module 迁移留门）；旧命名测试文件改语义名（issue1/2/3 → selfmedia-stats/reading-stats/reading-progress，m3/m4/m5 → today-home-ux/modules-smoke/settings-ux）。
- 离线缓存升版 v28 → v29（ASSETS 自动收录 3 个新 js 文件，ASSET_SIG 指纹刷新）。
- **多标签写锁（Web Locks 让位协议，ADR-007）**：store.js 防抖落盘点经 `'sonder-writer'` 锁排队；锁内对比 `sonder_meta_v1` 基线，另一标签已写更新快照时**让位吸收**（不覆盖新数据、`_rev` 递增、广播全量重绘）；无锁/锁异常环境自动降级直接落盘（等价旧行为）。新增契约测试 `tests/store-write-lock.test.js` 5 项（fake requestIdleCallback + fake navigator.locks，场景：正常持锁/连续写不误判/让位吸收/锁 reject 降级/无锁降级）。
- **全局符号契约（ADR-008）**：确认 tsconfig `checkJs: true` 全局生效（js/**），store.js 实例成员以 `@this` 模板为唯一真源（新增 `_lastSeenMeta`/`_lockedLocalFlush`/`_absorbNewer` 已同步进模板），`npm run typecheck` 当前零错误；提交 ADR-007/008 与状态索引。
- 测试基线 516 → 521（新增写锁 5 项，全量绿）。
- 离线缓存升版 v29 → v30（store.js 内容指纹变化触发 sync-sw 自动升版，ASSETS 38 项不变）。
- **让位提示（写锁 UX 闭环）**：`_absorbNewer` 让位时经总线广播 `/store/yielded`，app.js 订阅弹 toast「另一标签已更新数据，本页已同步到最新版本（未保存的修改已被放弃）」——让位不再无声丢输入；写锁契约测试扩 2 条断言（让位报 `/store/yielded`、基线一致不误报）。
- **game-worker.js 纳入 typecheck**：tsconfig 移除 exclude（原因 `importScripts` 未声明），globals.d.ts 补 Web Worker 全局声明；worker 现在与其他 34 个 js 模块同等受 tsc 类型检查（`npm run typecheck` 零错误保持）。
- 离线缓存升版 v30 → v31（store.js/app.js 内容指纹变化触发 sync-sw 自动升版，ASSETS 39 项）。
- **加密态纳入多标签写锁（ADR-007 边界更新）**：`_encSave` 落盘改经 `_lockedEncWrite`（Promise 化锁内封装）——`'sonder-writer'` 锁内做同款写前 meta 检查，另一标签已写更新密文时让位吸收（`_absorbNewer` 解密吸收、本次密文不落盘）；无锁环境降级直接落盘（等价旧行为）。`enableEncryption` 回读验证时序不变（锁回调完成后才执行）；写锁契约测试扩 3 项加密态用例（真加密引擎：meta 一致正常落盘 / 另一标签已写密文 → 让位 + `/store/yielded`，+ /data/all / 无锁降级）。
- 测试基线 521 → 524（全量绿）。
- 离线缓存升版 v31 → v32（store.js 内容指纹变化触发 sync-sw 自动升版，ASSETS 39 项不变）。
- **TrustLayer 结构化存储状态（Phase 1）**：store.js 新增 `getStorageStatus()`（同步 `{ok, backend, degraded, critical, reason}`）/ `persistResult()`（Promise 版，落盘后如实返回结果）/ `diagnostics()`（聚合诊断）三个公共 API；落盘失败点统一记录 reason 归类（quota / security / indexeddb_write_failed / encryption_failed / storage_error）；`_persistFailed`/`_idbFailed` 真源与 `hasPersistIssue()`/`persistIssueDetail()` 旧 API 行为零变更（quota-fail 既有测试原样通过）；globals.d.ts 同步声明并新增 `SonderStorageStatus`/`SonderStorageDiagnostics` 类型（契约测试自动校验两边一致）。新增契约测试 `tests/store-trustlayer-status.test.js` 11 项。
- 测试基线 524 → 535（全量绿）。
- 离线缓存升版 v32 → v33（store.js 内容指纹变化触发 sync-sw 自动升版，ASSETS 39 项不变）。
- **IndexedDB 优先写（Phase 2，Sonder-Frame ④ 核心遗留项落地）**：主/副本语义反转——IndexedDB 成为主快照、localStorage 降级为副本。双写写序不变量 `_persistLocal → _idbWrite` 保持（不交换行序，`_meta` 刷新与 IDB `savedAt` 一致性依赖该序）；跨标签写锁/让位协议仍以 LS 的 `sonder_meta_v1` 为基线（LS 同步可见性最适合做锁协议载体），读取按「哪个版本更新且完整」取新。`getStorageStatus()` 三分支重写：主成功 → `ok/indexedDB`（副本失败标 `degraded`）；主失败但 LS 正常 → `ok/localStorage` 降级（`reason: indexeddb_write_failed / indexeddb_unavailable`）；双失败 → `critical`。`_persistFailed`/`_idbFailed` 字段与 `hasPersistIssue()` 公式保持不变（对称公式，UI 行为零变化，quota-fail 既有测试原样通过）。契约测试 `tests/store-trustlayer-status.test.js` 11 → 14 项（副本停更但 IDB 正常 → 仍全健康 / 主失败 LS 降级 / 副本恢复回主 / 无 IDB 环境 reason 断言）。
- 测试基线 535 → 538（全量绿）。
- 离线缓存升版 v33 → v34（store.js 内容指纹变化触发 sync-sw 自动升版，ASSETS 39 项不变）。

### 计划（来自 38 项审计清单，按优先级）

#### 文档与工程治理
- 新增 CHANGELOG.md（本文件）——版本迭代集中记录。
- 补 PRD 测试基线描述（487 → 512，与 README/npm test 实际一致）。

#### SEO 与分享
- 计划：Open Graph / Twitter Card 标签（index.html 已就位，本轮加入）。
- 计划：document.title 随模块动态更新（浏览器标签页，本轮加入）。
- 计划：全尺寸 PWA 图标套件评估（当前 SVG any-size 满足多数场景）。

#### 数据与安全（评估中）
- 导入完整性校验：**评估后不采纳格式变更**——加密备份已有 AES-GCM 认证标签内建篡改校验（测试锁定）；
  明文备份加 SHA-256 需破坏导出格式与全部往返测试，威胁模型收益不匹配。
- 密码遗失恢复：加密为可选零知识设计，导出加密备份即恢复机制（需密码）；
  「恢复密钥文件」与零知识原则冲突，不采纳。
- 跨设备同步（WebDAV 等）：维持手动导出/导入现状，不引入账号体系。

#### 架构（需单独决策）
- ES Modules / Vite / TypeScript 渐进迁移（推荐）：与 ADR-001 零构建决策的取舍需单独立项，
  不进入 v6.0 默认范围。当前零构建 + defer 顺序契约 + UMD 双环境（浏览器/Node 测试）仍满足需求；
  已落地 ESM 试验田（quotes-core.mjs + 双实现一致性测试）持续评估，见上文「已实施」。

#### UX（backlog）
- 首次使用引导弹窗（3 步）、撤销栈（删除类操作）、键盘快捷键帮助面板、离线状态指示器。
- 空状态 / 加载反馈按模块穿插优化（各模块已有部分实现）。

## [v5.2] - 2026-08-16

### 工程防线补强 + 可靠性（9 项）
- 表单注入转义：`data-k` 属性 + `getAttribute` 匹配，杜绝字符串 key 注入属性选中（cf98470）。
- 测试工具：`waitFor` 条件轮询（消除固定延时竞态，替换 4 处固定 wait）；`__SONDER_TEST__` 门闩隔离测试钩子；
  `--test-timeout=30000` + CI 10min 硬性兜底；CI checkout/setup-node v4→v5（消除 Node 20 弃用警告）。
- 弱覆盖域页面交互补测 29 项（home/memo/consulting/news/design）。
- 死代码清理（cloneGame/PRIORITY_LIST/… ）与重复逻辑收敛（num0/esc/hashStr/copyText）。
- PWA 导航 Network First：刷新即拿新版，离线仍回退缓存（a02ddf2，SW v19）。

### 全面审计修复（低中危，本轮集中闭环）
- **中危**：AI 越页返回不卡死（aiWaitCtx 先消费后守卫）；空盘悔棋/认输复位在途 AI 状态；
  总线重绘补滚数（motion.js 订阅 `/data/*` + 60ms 节流，揭穿 jsdom hashchange 假绿灯）（bb6ae0b）。
- **低危**：加密降级守卫（saltBytes/ivBytes 走 requireCrypto 友好报错）、worker 入参 stone 白名单、
  store 热路径免全量解析、死钩子清理、焦点计时防漂移（9085c28，SW v27）。
- motion 动态交互层：墨点涟漪、页面墨染过渡、统计数字滚数、统计卡发光（f772cdd）。
- 搜索同查询结果缓存（d29080c）+ 内容指纹自动升版（018ad30，ASSET_SIG）。

### 测试基线
`npm test` **512 项全部通过**；tsc/lint 0（多轮全绿）。

### file:// 直开误报解除（1d2985e，SW v28）
- error-guard 对 file:// 环境下的资源类错误（浏览器 CORS 拦截 manifest 等属环境噪音）仅记录
  （`__sonderErrors` + 控制台）不再弹 toast；脚本异常与 Promise 拒绝仍照常提示（新增 2 项回归，512 → **514 项**）。

## [v5.1] - 性能与可靠性四补丁

- PBKDF2 派生密钥缓存（解锁提速，会话内批量防抖写入，780cf5d）。
- SonderBus 事件总线（跨模块解耦自动刷新，cff17a9）。
- 五子棋 AI 异步化：Web Worker + 同步兜底 + 过期应手丢弃 + 3000ms watchdog（19c56ab、850d2ed）。
- 持久化危机兜底：双写失效红色警示条强制引导导出（84f610d）。
- 测试基线：423 → **451 项**（文档同步 dafa71f，SW v18）。

## [v4.0] - 质量加固体系（23 项，节选）

- 契约防御：globals.d.ts 语义类型、innerHTML 白名单审计、状态双轨契约、行为契约（920747e、cce8ba0、c1058aa、9546121）。
- XSS 属性注入修复（79a5509）；周报阅读时长恒 0 修复（9c1c3d2）；加密保存竞态串行队列（40fba48）；
  加密/明文边界四破口（8aa6a13）；旧数据缺字段链式崩溃（8727c00）；AI 越页劫持（a599dc2）；
  切页时钟冻结（5bfe0c6）；重复逻辑与死代码清理。
- eslint 防线（27df3a8）、错误上报体系（1578389）、overlay 焦点管理与监听器泄漏（751a44b、ebd2edc）。
- 扫雷长按插旗（e91908b）、首击无反应修复（d926296）、移动端棋盘适配（1d1bfb1）、对比度 WCAG AA（1521da2）。
- 测试基线：213 → **407 项**。

## [v3.0] - 功能大版本

- 可选加密（AES-GCM-256 + PBKDF2 600k）、四款新迷你游戏、阅读计时与书摘、
  自媒体月历排期与数据图表、专注番茄钟、本周报告、壁纸上传、桌面通知、主题跟随系统、超宽屏适配。
- 全局错误安全网 error-guard（ec58a18，SW v13）；契约显式化 tsc --noEmit（a0f3232）。
- 测试基线：213 项。

## [v2.1] - 八项升级

游戏/性能/PWA/安全/存储：棋盘震动修复、AI 难度分级、帧率档位、离线可用、零构建类型检查、
全局搜索、XSS 加固、IndexedDB 双写（184 项）。

## [v2.0] - 游戏交互质量回归

五子棋移动端棋盘适配、三项修复、自动化测试 145 项、上线验收全绿。

## [v1.3-1.0] - 初始版本

每日金句、娱乐游戏（井字棋/五子棋）、手机适配、水墨×液态玻璃视觉语言、今日计划/备忘/自媒体/开发/咨询/阅读/新闻/设计/设置。