# Changelog

本项目所有重要变更均记录于此。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循语义化版本（SemVer）。完整版本演进另见 [PRD.md](PRD.md) 的版本历史表。

## [v6.0] - 2026-08-21

### 已实施

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
- **标准模块工厂（Phase 3，Sonder-Frame ② ModuleFactory 层 v0.1）**：新增 `js/framework/ModuleFactory.js`（UMD 自包含，store 实例由 `createModule(store, config)` 注入）——config 三件套（validate → normalize → freeze），第一版字段类型只开放 text/textarea/date/boolean/number/select/array；记录生命周期「净化 → required 校验（临时副本）→ 落盘 → 广播」，校验失败不污染内存；`id/createdAt/updatedAt` 工厂生成，id 为保留键；query 纯净（不改 state、不触 render、外发浅拷贝）；删除进 `_undoPush` 撤销栈；destroy 仅使模块失效不碰数据。**数据安全关键**：`_registerCollection` 将集合纳入 normalize 白名单（store.js 新增 `EXTRA_COLLECTIONS` 注册表 + defaultState 保底），重载/导入/解密/清空全路径保留工厂数据（E2E「新建→刷新→还在」成立）；storageKey 粒度持久化留待 Phase 7。提交 ADR-009。新增契约测试 `tests/module-factory.test.js` 23 项。
- 测试基线 538 → 561（新增 ModuleFactory 23 项，全量绿）。
- 离线缓存升版 v34 → v35（js/framework/ModuleFactory.js 指纹变化触发 sync-sw 自动升版，ASSETS 40 项）。
- **跨模块事件总线契约（EventBridge v0.1，Sonder-Frame ⑤ EventBridge 层）**：`js/event-bus.js`（SonderBus）原地收编升级——新增冻结常量表 `EVENT`（`DATA_ALL` / `STORE_YIELDED` / `data(key)` 路径生成器）作为事件名唯一真源；payload 契约文档化（`/data/<集合>` 广播 detail 恒 undefined，订阅者只依赖 path；`/data/all` 全量变更；`/store/yielded` 多标签让位）；`SonderBus.on` 返回 unsubscribe 固化为契约（重复取消幂等，销毁时必须调用）。store.js `_emitChange`/`_absorbNewer` 改经常量表生成（Node 独立加载回落等价字面量，广播路径输出恒等——既有写锁/广播测试原样通过）；存量页面模块字面量订阅维持兼容，收编随各模块迁移逐模块进行。globals.d.ts 补 `SonderBusApi`/`SonderBusInstance`/`SonderBusEventMap` 类型。提交 ADR-010。新增契约测试 `tests/event-bridge.test.js` 8 项。
- 测试基线 561 → 569（新增 EventBridge 契约 8 项，全量绿）。
- 离线缓存升版 v35 → v36（event-bus.js/store.js 指纹变化触发 sync-sw 自动升版，ASSETS 40 项不变）。
- **试点迁移协议 + memo 入厂（Phase 7 起点，Sonder-Frame 渐进式改造首个真实消费）**：确立迁移协议（文件不改名不换位、DOM/Page/store API 契约零变更、数据写同一 state 集合、customRender 复用既有渲染、VisualEngine 暂不进框架、订阅改经 EVENT 表、工厂缺口走配置级纯增量扩展、旧行为测试原样全绿为成功判据）。**ModuleFactory v0.1.1**：新增 `config.prepend`（新增最在前，默认 append）与 `config.timeField`（集合时间戳字段名：新增写入、编辑不刷、不生成默认 createdAt/updatedAt；validate 拒绝非法值）——不配置时与 v0.1 行为完全一致。**memo.js 迁移**：迁入 `createModule`（id=memos + prepend + timeField:time，text/archived 字段声明），模块懒初始化，工厂 renderer 与页面绘制共用函数，删除撤销仍走 `store.undoRemove()`（P5a 守卫保留），home/app 的 `store.addMemo` 调用不变；globals.d.ts `SonderModuleConfig` 补 prepend/timeField 类型。提交 ADR-011。工厂扩展 4 项契约测试。
- 测试基线 569 → 573（新增工厂扩展契约 4 项，全量绿）。
- 离线缓存升版 v36 → v37（memo.js / ModuleFactory.js 指纹变化触发 sync-sw 自动升版，ASSETS 40 项不变）。
- **试点二入厂（today 今日计划，Phase 7 渐进迁移续）**：**ModuleFactory v0.1.2**——新增 `config.orderField`（启用保留键 order：add 自动分配、编辑不刷；validate 仅允许 `'order'` 且与 `prepend: true` 互斥）与 `move(id, dir)` API（'up'/'down' 交换相邻并重写全集合 order，越界/未知 id 返回 false 无副作用，未配置 orderField 时调用抛错）——语义对齐 `store.reorderTask`，不配置时与 v0.1.1 行为完全一致。**today.js 迁移**：迁入 `createModule`（id=tasks + orderField:order，title/note/date/priority/done/doneAt 字段声明），CRUD 与排序改经工厂（add/update/remove/move），订阅改经 EVENT 表并保存 unsubscribe，工厂操作完成统一重绘（路由守卫保留）；done/doneAt 联动为页面层业务规则（勾选写时间戳、取消置空，已完成组按 doneAt 排序）；store.addTask 等保留给其他调用方（home 勾选仍走 store.updateTask，共享同一 state.tasks）；🍅 专注计时器保留原实现；删除撤销仍走 `store.undoRemove()`（P5a 守卫保留）。globals.d.ts `SonderModuleConfig`/`SonderStandardModule` 补 orderField/move 类型。工厂扩展 5 项契约测试；innerhtml.test.js XSS 白名单行号随迁（87 → 129，赋值点语义不变）。
- 测试基线 573 → 578（新增工厂扩展契约 5 项，全量绿）。
- 离线缓存升版 v37 → v38（today.js / ModuleFactory.js 指纹变化触发 sync-sw 自动升版，ASSETS 40 项不变）。
- **试点评估检查点（memo + today 迁移后只读复盘）**：工厂健康无特判（扩展全配置化、契约测试锁定）；能力使用率核对（query/getById/destroy 为契约待消费，保留）；渲染重复度不显著 → **VisualEngine 未达进框架阈值，暂不进**（两模块仅风格相似，共享原语已在 UI 层沉淀）；无新通用缺口（删除+撤销流程第 3 次出现再抽）。**待办**：按钮绑定模式收敛（memo 闭包 vs today 委托）——dev 迁移强制委托写法，三模块对比后统一。决策：走路径 B，试点三候选 dev（嵌套结构验证工厂边界）。评估结论完整记录于 ADR-011。
- **试点三入厂（dev 开发工作页，Phase 7 渐进迁移续）**：**零工厂扩展**（v0.1.2 能力全覆盖，实证「无新通用缺口」）。**dev.js 迁移**：同一页面三实例模块——`devProjects`（prepend 对齐 unshift 最新在前 + name 必填 + note + tasks 声明 array 仅默认保底）、`devNotes`/`devSnippets`（title/内容必填，不配 timeField 靠默认时间字段编辑置顶）。**嵌套集合边界（本试点核心结论）**：嵌套任务增删改不进工厂，保留 addDevTask/updateDevTask/removeDevTask 领域 API（变更经 store emitChange → EVENT 订阅兜底重绘），确立规则：工厂只管顶层记录集合。**绑定委托化落地（复盘待办首次执行）**：卡内按钮由闭包逐个绑改为容器级委托（data-* 回查 state 最新对象，门闩防常驻容器监听累积）——委托 2:1 胜出，memo 闭包统一为委托列为下一轮回溯。删除撤销不对称（项目/笔记可撤销、任务/片段无）历史行为保留；工厂 required 校验替代空名回落（表单层已拦截，路径等价）；innerhtml.test.js XSS 白名单行号随迁（109/111 → 258/260，语义不变）。
- **绑定收敛回溯（ADR-011 待办关闭）**：memo 卡内按钮由闭包逐个绑统一为**容器级委托**（`data-act` 回查 `store.state.memos` 最新对象 + `delegatedBound` 门闩防常驻容器监听累积）——与 today/dev 三模块写法收敛完成，对齐复盘承诺。DOM 契约零变更（`data-id`/`data-act` 不变），`#memoAdd` 新建按钮保持节点级绑定（与 dev `#devAdd` 一致，委托范围限定卡内行按钮）；顺带消除 stale-closure 竞态（双标签场景归档不再以绘制时刻旧值覆盖新状态）；删除确认 + 撤销 toast + P5a 守卫原样保留。
- 测试基线 578 → 578（memo 旧测试原样全绿为成功判据；typecheck/lint 零问题，E2E 5/5）。
- 离线缓存升版 v39 → v40（memo.js 指纹变化触发 sync-sw 自动升版，ASSETS 40 项不变）。
- **离线状态指示器（CHANGELOG 计划关闭）**：页脚 `#netOnline` / `#netOffline` 早已就位但全库无 JS 控制（半成品）——app.js 补上 `applyNetState()`（按 `navigator.onLine` 切 hidden）+ `online`/`offline` 事件监听 + 启动初始化，断网/恢复即时切换，只动 hidden 属性、无新 DOM/CSS/事件名；harness 支持 `opts.online` 初始状态注入。新增契约测试 `tests/offline-indicator.test.js` 5 项（初始在线 / offline 切换 / online 恢复 / 初始离线 / 不影响其他页脚元素）。
- 测试基线 578 → 583（新增离线指示器 5 项，全量绿；typecheck/lint 零问题，E2E 5/5）。
- 离线缓存升版 v40 → v41（app.js 指纹变化触发 sync-sw 自动升版，ASSETS 40 项不变）。
- **文档数字一致性收尾**：一次性对齐各文档的测试基线（README/README.en 578 → 583、PRD 验收与架构节 521/514 → 583、device-acceptance 521 → 583 并更新日期 08-17）、缓存版本（PRD 当前描述 v19/v29 → v41）、PRD 头部版本标注与版本演进表新增 v6.0 行、README ADR 索引补全至 ADR-011。历史版本摘要中的数字（v5.x 当时基线、各试点迁移期基线）作为历史记录保留。
- **试点四入厂（news 看新闻计划，Phase 7 渐进迁移续）**：**零工厂扩展**（v0.1.2 能力全覆盖，延续「无新通用缺口」实证）。**news.js 迁移**：单实例模块 `news`（prepend 对齐 addNews 的 unshift 最新在前 + timeField:time 对齐既有 time 字段，title 必填 + url/source/note + tags 声明 array 仅默认保底 + status select）；**筛选状态不进工厂**（status/tag 下拉筛选为视图层派生状态留页面，与 today done/doneAt、dev tabState 同边界）；卡内按钮（mark/fav/unfav/edit/del）闭包逐个绑统一为容器委托（data-* 回查 state 最新对象 + delegatedBound 门闩），四模块写法收敛；删除撤销走工厂 _undoPush；订阅改经 EVENT 表保存 unsubscribe；DOM/Pages/store API 契约零变更（search/home 只读 state.news 不受影响），文件不改名不换位；innerhtml 无新增赋值点白名单不动。
- 测试基线 583 → 583（news 旧测试原样全绿为成功判据；typecheck/lint 零问题，E2E 5/5）。
- 离线缓存升版 v41 → v42（news.js 指纹变化触发 sync-sw 自动升版，ASSETS 40 项不变）。
- **试点五入厂（selfmedia 自媒体，Phase 7 渐进迁移续，最大模块压测）**：**零工厂扩展**（v0.1.2 能力全覆盖，延续「无新通用缺口」实证）。**selfmedia.js 迁移**：单实例模块 `posts`（prepend 对齐 addPost 的 unshift 最新在前；不配 timeField——工厂默认生成 createdAt/updatedAt 恰对齐 postFactory 的 createdAt 语义；title 必填 + platform select `['', '公众号','小红书','B站','抖音']` 空串首项保住「未设置平台」显示语义 + account/tags/status/publishDate/note + views/likes/comments/favorites/progress number）。**页面级能力不进工厂（本试点核心结论）**：月历视图（桌面拖拽 DnD + 移动端长按/touchcancel 清理）、统计区（publishedStats + SVG 折线图）、CSV 导出（带筛选）、筛选/视图状态、数字反馈输入框（data-fb）与进度条（data-prog）全部留页面层——工厂仅管理记录 CRUD。卡内按钮（edit/del）统一容器委托（data-* 回查 state 最新对象 + delegatedBound 门闩），数字反馈与进度条为控件维持节点级绑定；数字字段负数/超百夹紧由 onSubmit 与反馈输入预处理（num0 对齐 store.updatePost 语义）；publishDate 空→null 预处理保留；拖拽落账走工厂 update；删除撤销走工厂 _undoPush；/data/posts 订阅保留（领域 API 双写路径兜底）；innerhtml.test.js XSS 白名单行号随迁（250 → 307，语义不变）。

- 测试基线 583 → 583（selfmedia 旧测试原样全绿为成功判据，含拖拽/统计/图表/筛选全套；typecheck/lint 零问题，E2E 5/5 断言 v42）。
- 离线缓存升版 v42 → v43（selfmedia.js 指纹变化触发 sync-sw 自动升版，ASSET_SIG f3e431c123e3 → 726dcd387e91，ASSETS 40 项不变）。

- **试点六入厂（consulting 咨询工作，Phase 7 渐进迁移续，嵌套边界压测）**：**零工厂扩展**（v0.1.2 能力全覆盖，延续「无新通用缺口」实证）。**consulting.js 迁移**：单实例模块 `clients`（prepend 对齐 addClient 的 unshift 最新在前；不配 timeField——工厂默认生成 createdAt/updatedAt 对齐 addClient 的 createdAt 语义；name 必填 + contact/note + projects/followups/income 三个 array 字段仅声明默认保底）。**嵌套集合边界收口（本试点核心结论）**：客户记录进出工厂（add/update/remove），三个嵌套子集合（项目/跟进/收入）继续走领域 API（addClientProject/updateClientProject/removeClientProject、addClientFollowup/updateClientFollowup/removeClientFollowup、addClientIncome/updateClientIncome/removeClientIncome）——子项 remove 的 restore 闭包撤销工厂不提供，嵌套边界留领域层，与 dev 试点「任务不进工厂」同边界且语义一致（整记录删除可整体撤销，子项删除靠闭包局部撤销）；嵌套删除撤销经 store.undoRemove()（闭包内恢复）。卡内按钮（data-cx/data-cedit/data-cdel/data-spadd/data-fuadd/data-inadd/data-pe/data-pd/data-fe/data-fd/data-ie/data-idel）统一容器委托（data-* 回查 state 最新对象 + delegatedBound 门闩），跟进勾选走 change 委托（data-fcheck）；收入合计 round 与负数拦截（amount >= 0）为页面层规则留 onSubmit；删除确认二次弹窗（confirmBox + data-act="yes"）保留；/data/clients 订阅保留（领域 API 双写路径兜底）；innerhtml.test.js XSS 白名单行号随迁（79/113/153 → 105/118/131，语义不变）。
- 测试基线 583 → 583（consulting 旧测试原样全绿为成功判据，含六项 UX 契约；typecheck/lint 零问题，E2E 5/5 断言 v43，真实 Chromium 冒烟 15/15：新建/展开/子项落库/负数拦截/勾选/改名/删除+撤销/刷新持久化/零页面错误）。
- 离线缓存升版 v43 → v44（consulting.js 指纹变化触发 sync-sw 自动升版，ASSET_SIG 726dcd387e91 → 02795342269f，ASSETS 40 项不变）。

- **试点七入厂（reading 阅读计划，Phase 7 渐进迁移收官，实时状态模块压测）**：**零工厂扩展**（v0.1.2 能力全覆盖，延续「无新通用缺口」实证）。**reading.js 迁移**：单实例模块 `books`（prepend 对齐 addBook 的 unshift 最新在前；不配 timeField——工厂默认生成 createdAt/updatedAt 对齐 addBook 的 createdAt 语义；title 必填 + author/status/progress + finishedAt + readingMinutes + readingLog/notes 两 array 仅声明默认保底，工厂 add 自动补齐默认值对齐 addBook 契约）。**finishedAt 三分支留页面层**（已读完→自动记日期（已有保留/缺省补今天）；改回→清除；其余 patch 不动——对齐 store.updateBook 联动语义，onSubmit 承担）。**计时器页面层例外（本试点核心结论）**：计时按钮保留节点级绑定（不进容器委托）——按钮与 clock 节点联动、click 语义是切换计时状态而非记录 CRUD；且修复了迁移暴露的挂起 bug（detached-click 契约：store 异步 persist 迟到广播重建卡片 → 旧节点 detached 后 jsdom click 不冒泡到容器 → 委托收不到停止事件 → clockTick 链永生挂进程；节点级绑定 detached 仍触发）。**修复数据-* 命名冲突**：笔记行原 data-id（笔记 id）与书卡 data-id（书 id）同属性名，委托 `b.closest('[data-id]')` 从笔记删除按钮向上误命中笔记行 → book 回查失败 → 删除静默失效；笔记行改 data-noteid 独立命名空间，补回归测试 1 条。编辑/笔记/删除/摘抄/笔记删除其余按钮统一容器委托（data-* 回查 state 最新对象 + delegatedBound 门闩）；统计/筛选/路由守卫/P5a/__readingDbg 全部保留；书摘页 renderExcerpts 独立容器；/data/books 订阅保留（领域 API 双写路径兜底）；unsubs 收敛订阅。
- 测试基线 583 → 584（+1 笔记行 data-noteid 委托删除回归；reading 旧测试原样全绿为成功判据；typecheck/lint 零问题，E2E 5/5 断言 v44，真实 Chromium 冒烟 9/9：打开零错误/新建已读完自动记日期/计时落账/切页恢复时钟/编辑进度/笔记增删撤销/书摘增删撤销/删书撤销/刷新持久化/零页面错误）。
- 离线缓存升版 v44 → v45（reading.js 指纹变化触发 sync-sw 自动升版，ASSET_SIG 02795342269f → 20eec82f7346，ASSETS 40 项不变）。
- **移动端适配层叠覆盖修复（真机验收发现，2026-08 引入至今未生效）**：手机适配块位于文件前部，同特异性选择器按"后定义者胜"被后方全部基础规则覆盖——弹窗底部抽屉（.modal 82dvh / .overlay flex-end / popUpIn）被基础居中 + popIn 覆盖（违反 device-acceptance D 区契约）、.field/.hbar 输入 16px 被 14px/13px 覆盖（iOS 聚焦缩放风险）、.st-row/.rd-grid 单列被 160px/220px 双列覆盖、.modal body/foot 边距（≤360px）被 20px 覆盖。修复：720px / 360px / 横屏三个手机适配块整体移至文件末尾（基础规则之后），块头注释说明缘由。Playwright 验收脚本（Android Chrome + 桌面 Edge）11/11 过。
- 测试盲区修复：mobile.test.js 文本存在断言（includes('align-items: flex-end')）改**层叠顺序断言**（抽屉规则须在基础规则之后）——584 全绿仍漏检的根源；minesweeper-mobile.test.js 正则限定 .ms-board-wrap .ms-board 避免误命中基础规则。全量 584 绿 + typecheck/lint 零问题。
- 离线缓存升版 v45 → v46（css/style.css 指纹变化触发 sync-sw 自动升版，ASSET_SIG 20eec82f7346 → 61af91a9962e，ASSETS 40 项不变）。
- **试点八入厂（design 设计计划，Phase 7 标准模块收官，试点序列最后一页）**：**零工厂扩展**（v0.1.2 能力全覆盖，八试点轨迹延续）。**design.js 迁移**：单实例模块 `designs`（prepend 对齐 addDesign 的 unshift 最新在前 + timeField:'time' 对齐既有 time 字段——新增写 time、编辑不刷、不生成默认时间字段，与 news 试点同形态；title 必填 + category/link/note + type select `['idea','project']` + stage select `['构想','进行','定稿']`）。**业务字段声明为 select 仅作 sanitize 通道（本试点核心结论）**：type 是双节分栏依赖的业务字段但必须声明——工厂 add 只写声明字段，未声明字段不进入记录（type 会丢）；select 白名单外回落 options[0]='idea'，逐字段等价 addDesign「非 project 归一 idea」；stage 白名单外回落'构想'等价 addDesign 默认；页面表单不含 type（onSubmit 赋值 v.type）且 update hasOwnProperty 门保留旧值。「未命名」兜底保留在领域 API（store-content.js 直接调用方仍可达）。**绑定委托化收口**：卡内 edit/del 闭包统一为容器委托（data-* 回查 state 最新对象 + delegatedBound 门闩），data-dadd 两个 hbar 新建按钮维持节点级绑定（memo/dev/reading/consulting 先例）；删除确认二次弹窗 + toast 撤销（_undoPush + undoRemove）；双节分栏与计数/阶段 pill/空态/链接渲染（sanitizeUrl + noopener）留页面层；unsubs 收敛订阅，/data/designs 订阅保留（领域 API 双写路径兜底）；innerhtml 白名单零条目零随迁。
- 测试基线 584 → 584（数量不变——工厂零扩展无新契约测试；design-ux 6 项旧测试原样全绿为成功判据；typecheck/lint 零问题，E2E 5/5 断言 v46，真实 Chromium 冒烟 9/9：打开零错误/收集灵感入库/新建项目入库/编辑推进定稿/链接渲染/删除确认生效/撤销恢复/刷新持久化/零页面错误）。
- 离线缓存升版 v46 → v47（design.js 指纹变化触发 sync-sw 自动升版，ASSET_SIG 61af91a9962e → 4f44c601ae33，ASSETS 40 项不变）。
- **集合级持久化（ADR-009 决策 7 落地，Sonder-Frame TrustLayer 存储主线路收尾）**：整份快照读写改为**逐集合独立 key**——LS `sonder_col_<id>_v1` / IDB entry key `<id>`（entry 结构 `{savedAt, data}` 不变），写路径仅序列化落盘变更集合（`_colJson` 按集合去重，等价整份 `_lastJson` 比较），读路径逐集合按 `lsMeta vs savedAt` 取新合并（同毫秒相等取 LS），缺集合 LS→IDB / IDB→LS 双向回填。legacy 整份快照作迁移来源一次性拆分（`_migrateLegacyIfNeeded`），**旧 key 保留不删**（回滚安全），轻量探测（`_hasLegacySnapshot`）沿用 STORAGE_KEY 链。**写序不变量保持**：明文双写 `_persistLocal（逐集合+meta）→ _idbWriteCols（同 meta）` 顺序不可交换；跨标签写锁/让位协议仍以 LS `sonder_meta_v1` 为基线。**加密升级为逐集合独立 bundle**（`{e:1,v,iv,data}`，`_lockedEncWrite` 锁内让位协议 + `_encChain` 串行队列语义保留），集合级吸收 `_absorbNewer` 以当前内存为基座，仅覆盖另一标签已写的集合（不清空本标签未竞态集合）。`loadIdb` 锁定态返回升级（密文集合不合并、置 `_idbEncLocked`）。工厂与领域方法落盘全部改经 `store._commit(集合id)`（ModuleFactory CRUD/orderField move、store-settings/theme、store-tasks、store-media、store-content）。新增契约测试 `tests/store-granular.test.js`；既有存储/加密/写锁/升级测试按集合级 key 契约升级（legacy 探测用例保留 STORAGE_KEY 注入），normalize 缺字段补默认的两个持久化加载用例注入限定 STORAGE_KEY 单键（修复集合枚举将整份误当集合 payload 的读取污染）。
- 测试基线 584 → 592（新增集合级契约 8 项，全量绿；typecheck/lint 零问题）。
- 离线缓存升版 v47 → v48（store.js 指纹变化触发 sync-sw 自动升版，ASSET_SIG 4f44c601ae33 → 15050c9e7b83，ASSETS 40 项不变）。
- **桌面玩偶核心模块 Phase 1（v6.0 desktop-pet Task 1，TDD 先行）**：新增 `js/desktop-pet.js`（UMD 自包含）——三角色配置表（小莫/墨灵/纸鹤：尺寸/配色/性格/台词/动画帧）、`Pet` 类（idle/walk/sleep 状态机 + 生命周期 destroy）、CSS 变量体系（`css/desktop-pet.css`，复用墨色/宣纸设计 token）；`DEFAULT_DESKTOP` 常量导出；index.html 引入两文件。新增契约测试 `tests/desktop-pet.test.js` 6 项。
- 测试基线 592 → 598（desktop-pet 契约 6 项，全量绿；typecheck/lint 零问题）。
- 离线缓存升版 v48 → v49（desktop-pet 新增 js/css 两文件入 ASSETS，40 → 42 项，ASSET_SIG 15050c9e7b83 → d8d03bb35c65）。
- **桌面玩偶 PetFamily 管理器（v6.0 desktop-pet Task 2，Phase 1 收尾）**：显示模式三态（off/single/family）、串门调度（随机间隔 + 页面模式守卫 + 离场窗口 `_exitTimer`/`_exitRole` 跟踪）、布局防重叠、共享 rAF 心跳；`_teardownVisitor()` 完整清理（访问定时器/离场定时器/串门实例）；`setEnabled(false)` 全量 teardown。新增测试 5 项（含「关闭后仅剩常驻」边界回归）。
- 测试基线 598 → 603（PetFamily 契约 5 项，全量绿；typecheck/lint 零问题）。
- 离线缓存升版 v49 → v50（desktop-pet.js 指纹变化触发 sync-sw 自动升版，ASSET_SIG d8d03bb35c65 → c0f731ee9bea，ASSETS 42 项不变）。
- **桌面玩偶金币/商店/喂养/成就系统（v6.0 desktop-pet Task 3，Phase 2+3 底座）**：`store.js` DEFAULT_SETTINGS 补 desktopPet 完整默认值 + 本地 `mergeDesktopPetDefaults` 深合并 + `mergeSettings` 透传；`store-settings.js` 新增 `setDesktopPet` 持久化网关（per-key 白名单 + 浅合并）；`desktop-pet.js` 替换占位函数为真实实现（getCoins/getAffection/getInventory/getAchievements/getState），新增 addCoins/spendCoins/buySnack/feedPet/checkAchievements/resetAllData + 内部辅助（`_isAllDoneToday`/`_getMaxAffection`/`_onTaskChange`/`_updateStreak`），构造器 bus 订阅 `/data/tasks`（存量扫描防重发 + 变更监听），destroy 清理 `_unsubTasks`，autoInit 函数（`window.__desktopPetFamily` 自动创建）。
- 测试基线 603 → 607（desktop-pet 金币/购买/喂食/成就/深合并 5 项，全量绿；typecheck/lint 零问题）。
- 离线缓存升版 v50 → v51（sw.js 缓存版本递增，ASSETS 42 项不变）。
- **桌面玩偶互动对话系统（v6.0 desktop-pet Task 4，Phase 3 收尾）**：InteractionManager 完整实现——`canTrigger()`（≥2 在场 + 冷却 3-6min + 无播放/拖拽）、`trigger()`（随机选组合→按权重选对话→逐轮气泡播放 + 表情联动）、`end()`（复位表情 + 广播 interactionEnd）、destroy 清理；PetFamily 新增 `triggerInteraction()`/`endInteraction()` 公开方法。
- 测试基线 607 → 615（desktop-pet 互动触发/冷却/播放/打断 7 项 + Task 3 已有 1 项修正，全量 615 绿；typecheck/lint 零问题）。
- **桌面玩偶独立板块页面 + 全局接线（v6.0 desktop-pet Task 5，TDD 先行）**：新增 `js/desktop-pet-page.js`（UMD 自包含，注册 `Pages['desktop-pet']`，五分区布局：标题栏+金币、三角色卡含喂食按钮、显示设置（模式切换/大小/总开关/重置）、商店预览九种零食库存、成就列表含解锁/锁定状态，subScribe change 自动重绘）；`js/app.js` NAV/ICONS/TOGGLEABLE 增 `'desktop-pet'`；`js/store-stats.js` moduleKeysList 增一项；`js/store.js` DEFAULT_SETTINGS.modules 增 `desktop-pet`；`index.html` 引入 `desktop-pet-page.js`；`tests/contract.test.js` PAGES 契约增 `'desktop-pet'`。
- 测试基线 615 → 620（desktop-pet 页面注册+契约 5 项，全量 620 绿；typecheck/lint 零问题）。
- 离线缓存升版 v51 → v52（desktop-pet-page.js 新增触发 sync-sw 自动升版，ASSET_SIG 865459fe6ea0 → ed5d5e0c40a4，ASSETS 43 项）。
- **桌面玩偶全契约测试收口（v6.0 desktop-pet Task 6，规格 11.2 全清单）**：`tests/desktop-pet.test.js` 补全 `spendCoins` 余额不足/非法参数拒绝（负数/零/NaN/Infinity）+ 角色差异化（三实例 breathe/blink/bodyScale/defaultEmotion 参数不同），规格 11.2 十项清单全绿。
- 测试基线 620 → 622（desktop-pet 收口 2 项，全量 622 绿；typecheck/lint 零问题）。
- **桌面玩偶全面审计修复（v6.0 desktop-pet Task 7）**：P0 共 13 项——SVG 渐变 ID `_uid` 后缀去重防 trio 模式碰撞、change 事件去重（移除 addCoins/spendCoins/buySnack/feedPet/resetAllData/_onTaskChange 中冗余 emit，`_commit()` 已内部 emit）、`_persistPosition` NaN 防护（parseFloat 结果 isFinite 校验）、`_scheduleBlink()`/`_scheduleIdleQuote()` 启动点修正至 `_build()` 末尾、`canTrigger` 冷却改为确定性（`lastAt + base(3min) + jitter(0-3min)`，之前每次调用重新随机导致永不触发）、`Pet.destroy()` 完整清理（unsubs 订阅取消 + 拖拽事件解绑 + _aniTimers 清理）、`desktop-pet-page.js` 全面重写（事件委托绑定喂食/模式/大小/总开关/重置/购买按钮，enterPageMode/exitPageMode 生命周期，destroy 页面离开恢复悬浮玩偶，订阅清理防泄漏）、`desktop-pet.css` 补全页面样式（~170 行：header/设置/商店/成就/响应式断点）、`globals.d.ts` 补 SonderPage.destroy? + SonderCtx._dpBound? 声明。
- 离线缓存升版 v52 → v53（多文件变更触发 sync-sw 自动升版，ASSETS 43 项不变）。

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