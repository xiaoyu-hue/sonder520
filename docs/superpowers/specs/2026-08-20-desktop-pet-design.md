# 小莫灵家族桌面玩偶 — 集成设计文档

- 日期：2026-08-20
- 状态：**设计已确认**（brainstorming 完成，待 writing-plans 产出实现计划）
- 规格基准：`docs/desktop-pet-spec.md`（v2.1 规格全文入仓副本，权威基准随代码走）
- v6.0 定位：**Sonder-Frame 架构 + 桌面玩偶 = v6.0 两个必达更新项**；本模块落地后 v6.0 正式完成

## 一、本次确认的关键决策

| # | 决策点 | 结论 |
|---|--------|------|
| 1 | 实现范围 | 按规格三阶段全做（Phase 1 三角色+显示+串门 → Phase 2 金币+商店+喂养+亲密度 → Phase 3 成就+互动对话） |
| 2 | 代码形态 | **独立 Specialized 模块**（`desktop-pet.js` + `desktop-pet-page.js` + `desktop-pet.css`），只共享 SonderBus/SonderStore，同 games 先例，不进 ModuleFactory |
| 3 | 任务金币映射 | p1=15 / p2=10 / p3·p4=5（对齐 today.js 的 `PRI` 四档 p1-p4） |
| 4 | 文档归属 | v2.1 规格全文入仓为 `docs/desktop-pet-spec.md`，另行文为 superpowers 设计文档 |
| 5 | 测试策略 | 新增 `tests/desktop-pet.test.js` 覆盖规格 11.2 全契约，全量 592+ 回归 + typecheck/lint 零问题，文档同步 |

## 二、与现有代码的契约核对（实现要点）

### 1. `mergeSettings` 是白名单浅合并，desktopPet 需独立深合并分支
规格 8.2 要求「desktopPet 缺失字段深合并补默认，嵌套对象递归」。但现有 `store.js` 的 `mergeSettings(dflt, raw)` 只处理 theme/wallpaperOpacity/gameDifficulty/frameRate/quotaNoticeDismissed/taskReminder/modules 白名单字段，**其余字段全部回落默认并丢弃**。若 desktopPet 直接塞进该函数，老用户嵌套字段（affection/positions/achievements.stats 等）会被整段丢弃。
→ **实现要点 #1**：新增 `mergeDesktopPetDefaults(raw.desktopPet)` 独立递归深合并（规格 8.2 的 `deepMerge` 语义），在 settings 加载合并时对 `desktopPet` 字段单独调用；`DEFAULT_SETTINGS` 增完整默认对象（含 `schemaVersion:1`）。

### 2. `/data/tasks` 事件无载荷，金币判定用结果态
已核实 `_emitChange(list)` → `bus.emit('data/tasks')`，**detail 为 undefined**，订阅者拿不到变更前后 diff。规格 5.2 的「对比变更前后 done」在 Sonder 总线模型下不可行。
→ **实现要点 #2**：PetFamily 订阅 `/data/tasks`，遍历 `store.state.tasks`，以结果态判定发币：
`t.done === true && t.doneAt !== null && rewardedTaskIds.indexOf(t.id) === -1`→ 发金币 + 记 id。
`doneAt` 在 `store-tasks.js` 的 `patch.done` 分支同步写入，结果态自洽；id 幂等防重复发。

### 3. 持久化/加密继承
settings 是集合级持久化的 collection（`store._commit('settings')` 收口），desktopPet 数据自动获得 LS 双写 + IDB + 加密 bundle + 备份导出，零额外成本。加密开启时 desktopPet 随 settings 集合一起加密。

### 4. 模块开关接线
`moduleKeysList` 在 `store-stats.js` 是**硬编码数组**（9 项，无 desktop-pet），需手动加 `{ key:'desktop-pet', label:'小莫灵家族' }`；`settings.js` 的设置页模块开关遍历 `S.moduleList`（来自 `Stats.moduleKeysList`），加一行即自动带出，settings.js 无需改动。

### 5. 文件注册清单
- **新增**：`js/desktop-pet.js`（核心，UMD/ES5/严格模式，规格 9.5 七区注释分区）、`js/desktop-pet-page.js`（页面模块，注册 `Pages['desktop-pet']`，核心缺失时轮询 ≤3s 降级）、`css/desktop-pet.css`（三角色 CSS 变量 + 页面/弹窗/动画样式）
- **修改**：`js/app.js`（NAV 在 game 后 settings 前插 `'desktop-pet'`；ICONS 增 `'desktop-pet':'🐾'`；TOGGLEABLE 增 `'desktop-pet':1`）、`js/store.js`（DEFAULT_SETTINGS.modules 增 `desktopPet:true` + desktopPet 默认对象 + 深合并分支）、`js/store-settings.js`（setDesktopPet* 系列方法，全部 `this._commit('settings')`）、`js/store-stats.js`（moduleKeysList 加一项）、`index.html`（引入 css + 两 js，defer 顺序：desktop-pet.js 依赖 store/event-bus，desktop-pet-page.js 依赖 desktop-pet.js）
- **重新生成**：`sw.js`（`npm run sync-sw`，缓存 v48→v49，新增 3 文件入 ASSETS）

## 三、数据模型与事件契约

- 数据存 `store.state.settings.desktopPet`（规格 3.5 完整结构），`schemaVersion:1`
- 双开关独立：`modules.desktopPet`（导航显示）/ `desktopPet.enabled`（系统启停）
- 页面与核心通信：`window.__desktopPetFamily` 全局暴露 PetFamily；`getState()` 快照 + `on('change', cb)` 订阅
- 防刷三层：rewardedTaskIds（≤500 滚动）+ 会话上限 100 金币 + 只加不减；导入备份 `isImporting` 抑制发币
- 金币飘字起点 = 任务项 DOM `getBoundingClientRect()`，终点 = 玩偶区域

## 四、风险缓解

- 核心文件 1500-2500 行：规格 9.5 七区注释分区，超 2000 行拆 core/ui 两档（先单文件）
- 性能：三玩偶共享单 rAF，隐藏不渲染；移动端默认 single/64px/半透明；visibilitychange 暂停
- 数据安全：不触碰 legacy key，仅新增资源，回滚 = 移除新增文件与注册行
- XSS：全部 textContent，动态 SVG 用 createElementNS，不用 innerHTML（遵循 VisualEngine 规则）

## 五、提交分层（每提交后跑 npm test）

```
commit 1  docs: 桌面玩偶 v2.1 规格入仓 docs/desktop-pet-spec.md（纯文档，立权威基准）
commit 2  feat(desktop-pet): 核心模块 js/desktop-pet.js + css/desktop-pet.css（Phase 1 三角色+显示+串门）
commit 3  feat(desktop-pet): 金币/商店/喂养/亲密度（Phase 2 养成闭环，含 store-settings 新方法 + mergeSettings 深合并分支）
commit 4  feat(desktop-pet): 成就/streak + 互动对话（Phase 3）
commit 5  feat(desktop-pet): desktop-pet-page.js 页面模块 + app.js/store.js/store-stats.js/index.html 接线
commit 6  test(desktop-pet): tests/desktop-pet.test.js 全契约测试
commit 7  docs: 文档同步（CHANGELOG/README/PRD/device-acceptance/AGENTS/ADR-012）+ sw.js sync-sw v48→v49 + 基线滚动
```

## 六、验收锚点（规格附录 H 三阶段）

- Phase 1：常驻玩偶右下角出现、三角色外观/性格差异、single/duo/trio 正确、串门滑入滑出、拖拽位置持久化、共享单 rAF、切后台暂停
- Phase 2：完成任务金币增加（p1=15/p2=10/p3·p4=5）、飘字、防刷、商店 9 零食、喂食 + 亲密度、首页角色卡喂食、备份包含数据且导入不发币
- Phase 3：10 成就正确解锁、streak 连续天数、互动对话 20 组、270 语录、无障碍 + 移动端 + 降级