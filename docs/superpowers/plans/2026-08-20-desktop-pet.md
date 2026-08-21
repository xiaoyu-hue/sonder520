# 小莫灵家族桌面玩偶（v6.0 收官模块）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 v2.1 规格三阶段为 Sonder 落地独立 Specialized 桌面玩偶模块（三角色 + 任务金币 + 商店喂养 + 成就互动），完成后 v6.0 正式收官。

**Architecture:** 独立 Specialized 模块（同 games 先例，不进 ModuleFactory）。核心 `desktop-pet.js`（UMD/ES5/严格模式）暴露 `window.__desktopPetFamily`，页面 `desktop-pet-page.js` 注册 `Pages['desktop-pet']` 并依赖核心全局；数据存 `store.state.settings.desktopPet`，经 `store._commit('settings')` 走集合级持久化（LS 双写 + IDB + 加密 bundle + 备份）。

**Tech Stack:** 原生 JS（ES5，var/function/原型链）、JSDOM 测试（node --test）+ own eslint/tsc 零依赖。

## Global Constraints

- 语言风格：ES5（`var`/`function`/原型链），`'use strict'`，语句末尾分号，2 空格缩进，UMD 包装暴露全局。
- 命名：构造函数大驼峰（PetFamily/ShopPanel）、方法小驼峰、私有方法 `_` 前缀、常量全大写、CSS 类 `dp-` 前缀、事件名 `/data/*` 斜杠路径。
- 安全：所有用户可见文字用 `textContent`，禁止 innerHTML（自定义 JS 渲染一律 createElement/createElementNS）；不用 eval/new Function；不引入任何第三方库/CDN。
- 数据：全部写 `store.state.settings.desktopPet`，任何修改后必须 `store._commit('settings')`；不回滚 legacy key；导入备份时 `isImporting` 抑制发币。
- 持久化副本：desktopPet 深合并必须用独立 `mergeDesktopPetDefaults`（现有 `mergeSettings` 是白名单浅合并，会丢弃未知嵌套字段）。
- 性能：三玩偶共享单个 rAF 循环，隐藏/页面隐藏时不运行动画；不在 rAF 内创建对象/查询 DOM；定时器 destroy 时全清。
- 优先级金币映射：p1=15 / p2=10 / p3·p4=5。
- 现有基线：592 项测试全绿、200 提交、11 ADR、sw v48。新增后必须回归全绿 + typecheck/lint 零问题 + `npm run sync-sw`（缓存版本 +1）。
- 提交纪律：按层拆分，每提交后跑全量测试。

## Verified Facts（已从源码钉死的真实契约，2026-08-20 核对）

- **任务 API**（store-tasks.js）：`store.addTask(data)`（内部补 id/doneAt/createAt，`doneAt: data.doneAt || null`）、`store.updateTask(id, patch)`（**patch 含 `done` 时联动写 `doneAt`：done=true→`h.nowISO()`，done=false→null**）、`store.deleteTask(id)`。完成后 `_commit('tasks')` + `_emitChange('tasks')`。**注意：金币判定不能只看 `done`（取消会把 doneAt 置 null），必须判断 `t.done === true && t.doneAt !== null && rewardedTaskIds 不含 t.id`；同一任务"完成→取消→再完成"会重新写 doneAt，靠 rewardedTaskIds 幂等防重复发币。**
- **事件契约**（event-bus.js）：路径生成器 `EVENT.data(key)` → `/data/<key>`（`EVENT` 表冻结，禁写魔法字符串）；`detail` **恒为 undefined**（页面模块按 path 精确订阅，payload 不携带 → 金币/成就检测靠读 `store.state` 结果态）。store.js:210 `_emitChange` 经 `E.data(key)` 走同一路径（无总线时回退 `/data/' + key`）。
- **响应式重绘模式**：各页面模块统一 `bus.on('/data/<集合>', fn)` + `/data/settings` + `/data/all` 三组合，`on` 返回 unsubscribe 存起来，destroy 时清理（如 design.js:171、games.js:144）。金币/成就监听应仿照此——订阅 `/data/tasks`（`EVENT.data('tasks')`）、`/data/settings`。
- **settings 持久化**：`store._commit('settings')` 触发集合级 key 持久化（settings 的 payload 结构为 `{version, settings}`）+ `_emitChange('settings')` → 总线 `/data/settings`。店铺/喂食/成就/显示设置全部经此落盘。
- **mergeSettings**（store.js:288-305）：**白名单浅合并**，只收 `theme/wallpaperOpacity/gameDifficulty/frameRate/quotaNoticeDismissed/taskReminder` + `modules` 布尔合并（仅遍历 `s.modules` 存在的 key）。desktopPet 嵌套字段会被丢弃 → 必须在 store.js 加载合并处对 `raw.desktopPet` 调独立的 `mergeDesktopPetDefaults`。
- **默认 settings**（store.js:168 `modules` 内，约 169 行追加新模块开关）。**新增模块 key 必须先入 `DEFAULT_SETTINGS.modules`，否则 `setModuleEnabled(key, on)`（store-settings.js:44-46）因 `!(key in modules)` 静默 return。**
- **导航壳**（app.js）：`NAV` 是数组（:10），`ICONS` 是对象（:11-14，`settings: '⚙️'`），`TOGGLEABLE` 是对象（:9）。buildNav（:71-94）：仅对 `TOGGLEABLE[key]` 的 key 且 `!store.state.settings.modules[modKey]` 时隐藏；`modKey = key === 'excerpts' ? 'reading' : key`，**home/settings 恒显示**。页面缺失单模块 try-catch 跳过不拖垮壳（:89-92）。故新增 nav 项：`NAV` 在 `'settings'` 前插 `'desktop-pet'`、`ICONS` 增 `'desktop-pet': '🐾'`、`TOGGLEABLE` 增 `'desktop-pet': 1`、`DEFAULT_SETTINGS.modules` 增 `desktopPet: true`。
- **moduleKeysList**（store-stats.js:209）：`var moduleKeysList = [{ key:.., label:.. }, ...]` 9 项，作为 `Stats.moduleKeysList` 导出（:231，settings 页模块开关列表真源）。新增 `{ key: 'desktop-pet', label: '小莫灵家族' }`（追加到 'game' 之后）。
- **测试 harness**（tests/harness.js）：`boot()` 解析 index.html 的 `<script src="js/...">` 顺序并逐一注入执行 → **新增 js 文件只要接进 index.html 就自动进入 SCRIPT_ORDER 并出现在每次 boot 的 window 中**；返回 `{ dom, window, store, hooks, $, $$, goto }`，其中 `store = hooks.store`（window.__sonderHooks），另暴露全局 `window.SonderStore`（工厂）/ `window.SonderBus`（含 `.bus` 实例 + `.EVENT` 表）。`opts.seed` 可注入初始 localStorage（seed 在 store.js 注入前设置）。扩展文件名必须接进 index.html，否则测试测不到。

---

### Task 0: 规格入仓（文档基准）

**Files:**
- Create: `docs/desktop-pet-spec.md`

**Interfaces:**
- Produces: `docs/desktop-pet-spec.md` —— v2.1 规格全文，为后续所有任务提供权威行为定义。

- [ ] **Step 1: 复制规格**

将 `D:\个人作品集\桌面玩偶养成系统v2.0正式确认版.md` 复制为 `docs/desktop-pet-spec.md`：
```powershell
Copy-Item "D:\个人作品集\桌面玩偶养成系统v2.0正式确认版.md" "docs\desktop-pet-spec.md"
Get-Content "docs\desktop-pet-spec.md" -Encoding UTF8 | Measure-Object -Line   # 应约 1451 行
```

- [ ] **Step 2: 校验完整性**

确认文件含关键章节锚点：`## 三、显示与配置系统`、`## 九、技术架构`、`附录 H`、`## 十二、风险与注意事项`。

- [ ] **Step 3: 提交**

```powershell
git add docs/desktop-pet-spec.md
git commit -F - <<'MSG'
docs: 桌面玩偶 v2.1 规格入仓 docs/desktop-pet-spec.md（权威基准随代码走，v6.0 收官模块规格全文）
MSG
```
（若 PowerShell 中文提交截断，改写作弊技巧：`git commit -F "C:\Users\aden\AppData\Local\Temp\opencode\commitmsg.txt"`。）

---

### Task 1: 核心模块骨架 + Phase 1 三角色（Pet 类 + CSS 变量体系）

**Files:**
- Create: `js/desktop-pet.js`
- Create: `css/desktop-pet.css`

**Interfaces:**
- Produces: `window.DesktopPetCore`（UMD 导出，含 `CHARACTERS/SNACKS/ACHIEVEMENTS/DIALOGUES/QUOTES` 配置表与 `Pet` 类）、`window.__desktopPetFamily`（`PetFamily` 实例，由 Task 3 的 autoInit 提供——本 Task 仅提供 `Pet` 类与配置表模块级 API，`createFamily()` 在 Task 2 实现）。
- Produces: `css/desktop-pet.css` 提供 `.dp-pet`、`.pet-xiaomo/.pet-xiaoyu/.pet-lanling`（覆盖 `--dp-body/--dp-body-light/--dp-body-dark/--dp-eye/--dp-mouth/--dp-bubble-bg`）、动画关键帧（呼吸/眨眼/弹跳/滑入滑出）、`prefers-reduced-motion` 降级。

- [x] **Step 1: 写失败测试（配置表完整性）**（tests/desktop-pet.test.js 6 项）

创建 `tests/desktop-pet.test.js`，先只测配置表与 Pet 构造（Phase 1 子集）：
```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

test('desktop-pet: CHARACTERS 配置完整性（3 角色）', () => {
  const { window } = boot();
  const C = window.DesktopPetCore;
  assert.ok(C && C.CHARACTERS, 'core 未定义');
  const ids = Object.keys(C.CHARACTERS).sort();
  assert.deepStrictEqual(ids, ['lanling', 'xiaomo', 'xiaoyu']);
  assert.strictEqual(C.CHARACTERS.xiaomo.colors.body, '#e8a84c');
  assert.strictEqual(C.CHARACTERS.xiaoyu.colors.body, '#4a6fa5');
  assert.strictEqual(C.CHARACTERS.lanling.colors.body, '#7ab89a');
  assert.strictEqual(C.CHARACTERS.xiaomo.defaultEmotion, 'happy');
  assert.strictEqual(C.CHARACTERS.xiaoyu.defaultEmotion, 'idle');
  assert.strictEqual(C.CHARACTERS.lanling.defaultEmotion, 'sleepy');
});
```
> 注：当前 index.html 尚未接线 desktop-pet.js，boot() 后 `window.DesktopPetCore` 为 undefined，此测试会 FAIL——这是预期的 TDD 红。

- [x] **Step 2: 运行验证失败**

Run: `npm test -- tests/desktop-pet.test.js`（或 `node --test tests/desktop-pet.test.js`）
Expected: FAIL——`core 未定义`（desktop-pet.js 未加载）。✓ 已再确认

- [x] **Step 3: 实现配置表 + Pet 类 + CSS**（js/desktop-pet.js + css/desktop-pet.css；ACHIEVEMENTS 以 reward 字段承载奖励、condition 为函数）

`js/desktop-pet.js` 首区（配置表）按规格 2.5 / 6.1 / 附录 D/E 填入：
- `CHARACTERS`（3 角色：id/name/desc/colors/bodyScale/breathe/blink/defaultEmotion/antics/quotes/decor）
- `SNACKS`（9 种：id/name/price/affection/icon/desc，价格 5-60，亲密度=round(price×0.4)）
- `ACHIEVEMENTS`（10 个：id/name/condition/coin），按规格表：first_task/task_10/task_50/task_100/all_done_today/streak_3/streak_7/first_feed/feed_10/affection_100
- `DIALOGUES`（4 组合 × 5 组 = 20 组，附录 E 全文）
- `QUOTES`（3 角色 × ~18 场景 × 5 条 = 270 条，附录 D 全文——规模大，可先放足量、验收时补全）

`Pet` 类按附录 C：
- 构造 `(options)`：container/size/character/enabled；`_build()` 用 createElementNS 构建规格 C.2 SVG；`_bindEvents()`（mousedown/mousemove/mouseup/click/touch/resize）；`setEmotion/getEmotion/say/setSize/show/hide/destroy`。
- 私有：`_drawEye(g, shape, scaleY, side)`（6 形状+2 特殊）、`_drawMouth(config)`（9 类型）、`_scheduleBlink`、`_scheduleIdleQuote`。
- `_tick(dt, t)` 由 PetFamily 调用（本 Task 提供空壳，Task 2 接循环）。

`css/desktop-pet.css`：`--dp-*` 变量、`.pet-xiaomo` 等三角色覆盖、动画关键帧、移动端（<640px single/64px/opacity .8）、`@media (prefers-reduced-motion: reduce)` 全部停用动画。

- [x] **Step 4: index.html 接线（阶段 A）+ 运行验证**

`index.html`：
- CSS 已经加在 `<link rel="stylesheet" href="css/style.css">` 之后（实测在 style.css 后。注：原文"第 26 行"行号随文件漂移，按锚点定位不按行号）。
- JS 实际接在 `<script src="js/games.js" defer></script>` 与 `<script src="js/settings.js" defer></script>` 之间（在 app.js 之前；desktop-pet.js 只依赖 store/event-bus，顺序安全）。注：原文"第 101 行 app.js 之后"行号漂移，`defer` 保持即可（scripts.test.js 断言）。

Run: `npm test -- tests/desktop-pet.test.js`
Expected: PASS。✓ 已再确认 6/6 PASS

- [x] **Step 5: 全量回归**

Run: `npm test`
Expected: 592（原有）+ 新增全部绿。若 harness.js boot 后新增文件无意外冲突，应直接全绿。✓ `npm test` 598/598 全绿；`node scripts/sync-sw.js` v48→v49 后 scripts.test.js 绿

- [x] **Step 6: typecheck + lint**

Run: `npm run typecheck` 和 `npm run lint`
Expected: 零问题（若 tsc 对 `window.DesktopPetCore` 报未声明，在 `js/globals.d.ts` 补充声明）。✓ tsc 零错（Pet 用 inline @constructor/@this 标注）；eslint 0 errors/0 warnings

- [x] **Step 7: 提交**

```powershell
git add js/desktop-pet.js css/desktop-pet.css index.html tests/desktop-pet.test.js sw.js   # sw.js 含 sync-sw 资产同步
git commit -F commitmsg.txt   # 消息："feat(desktop-pet): 核心模块 Phase 1——三角色配置表 + Pet 类 + CSS 变量体系（TDD 先行）"
```
✓ 已提交 `24a177d`（5 files changed, 1607 insertions）。注：`js/globals.d.ts` 无需改动（tsc 零错）。

---

### Task 2: PetFamily 管理器 + 显示模式 + 串门 + 布局 + 共享 rAF

**Files:**
- Modify: `js/desktop-pet.js`

**Interfaces:**
- Consumes: Task 1 的 `CHARACTERS`/`Pet`。
- Produces: `PetFamily` 类（构造依赖 `store` + `bus`）：实例管理 `instances`、显示模式 `single/duo/trio`、串门调度、布局管理器、共享 `AnimationLoop`（`_tick(dt,t)` 遍历活跃实例）。
- Produces 方法：`createFamily(store, bus, config)`、`family.setMode/resident/size/enabled`、`family.enterPageMode/exitPageMode/destroy`、`family.on/off/emit`。
- 数据操作占位（Task 3 实现）：`getState()/getCoins()/getAffection()/getInventory()/getAchievements()` 本 Task 先返回 settings.desktopPet 原子快照。

- [x] **Step 1: 写失败测试（显示模式与串门生命周期）**（tests/desktop-pet.test.js 新增 4 项：显示模式/串门生命周期/召唤冷却/占场拒绝）

`tests/desktop-pet.test.js` 追加：
```js
test('desktop-pet: PetFamily 显示模式切换（实例数量正确）', () => {
  const { window } = boot();
  const F = window.__desktopPetFamily;
  assert.ok(F, 'family 未暴露');
  const family = F;
  // 默认 duo：常驻 1 + 最多 1 串门
  assert.strictEqual(family.getMode(), 'duo');
  family.setMode('single');
  assert.strictEqual(family.getMode(), 'single');
  family.setMode('trio');
  assert.strictEqual(family.getMode(), 'trio');
  assert.strictEqual(family.getActivePetIds().length, 3);
});
```

- [x] **Step 2: 运行验证失败**

Run: `node --test tests/desktop-pet.test.js`
Expected: FAIL——`family 未暴露`（Task 3 之前 autoInit 尚未接线；此处先实现 PetFamily 类但不挂 autoInit，测试手工通过 `createFamily` 建实例断言，故本步骤的失败点改为挂到 autoInit 之前的 getMode 断言）。✓ createFamily undefined FAIL 已确认

> 本 Task 的验证策略：直接在测试里 `const fam = window.DesktopPetCore.createFamily(store, window.SonderBus, store.state.settings);`（用 boot() 返回的**实例** `store`，而非工厂 `window.SonderStore`——后者是 factory，调用 createStore() 会新建独立实例）驱动，不断言全局 autoInit（Task 3 才挂）。

- [x] **Step 3: 实现 PetFamily + 子管理器骨架 + 串门 + 布局**（AnimationLoop/DisplayManager/InteractionManager 占位/PetFamily；离场 2s 窗口用 _exitTimer+_exitRole 跟踪防僵尸实例，_teardownVisitor 供 setEnabled(false) 立即清场）

`js/desktop-pet.js` 新增：
- `AnimationLoop`：单 rAF 循环，`start/stop`，`visibilitychange` 暂停（记录已过时间，恢复续算）；`_tick` 内 dt 上限 0.05s。
- `DisplayManager`：按 mode 管理实例（single 1 / duo 常驻+串门 / trio 3）；串门定时（8-15min 随机，冷却 10min），出场 600ms 滑入 + wave 2.5s + 停留 2-4min + goodbye 1.5s + 滑出 500ms；布局默认右下角，2 个横向并排间距 10px，3 个间距 8px，<480px 纵向堆叠；拖拽独立持久化到 `desktopPet.positions[角色ID]`（null=默认）；resize 越界自动拉回。
- `InteractionManager` 占位（Task 4）。
- `PetFamily`：组合子管理器，对外公开 `setMode/setResident/setSize/setEnabled/enterPageMode/exitPageMode/getState/getActivePetIds/on/off/emit/destroy`；`store._commit('settings')` 在每次状态落盘后调用。
- `autoInit` **本 Task 不挂**，改为导出 `createFamily(store, bus, settings)` 供测试直连。

- [x] **Step 4: 运行验证通过**

Run: `node --test tests/desktop-pet.test.js`
Expected: PASS（显示模式、串门状态机、布局用到的最小断言）。✓ 11/11 PASS（含边界测试：离场窗口拒绝召唤、关闭开关立即清串门）

- [ ] **Step 5: 全量回归 + typecheck + lint**

Run: `npm test`；`npm run typecheck`；`npm run lint`
Expected: 全绿 + 零问题。✓ 603/603 全绿；tsc 零错（新构造函数补 @constructor/@this，嵌套函数改 var self）；eslint 0 errors/0 warnings

- [ ] **Step 6: 提交**

```powershell
git commit -F commitmsg.txt   # "feat(desktop-pet): PetFamily 管理器 + 显示模式/串门/布局/共享 rAF（Phase 1 收尾）"
```

---

### Task 3: 金币系统 + 成就系统（Phase 2/3 数据底座）

**Files:**
- Modify: `js/desktop-pet.js`
- Modify: `js/store-settings.js`
- Modify: `js/store.js`

**Interfaces:**
- Consumes: Task 2 的 `PetFamily`。
- Produces（PetFamily 公开金币 API）：
  - `family.addCoins(amount, reason)` / `family.spendCoins(amount)→boolean` / `family.getCoins()`
  - `family.buySnack(snackId)→boolean` / `family.feedPet(petId, snackId)→boolean`
  - `family.unlockAchievement(id)` / `family.checkAchievements()` / `family.resetAllData()`
  - `family.on('change', cb)` — 数据变更广播（金币/亲密度/库存/成就变化均触发）
- Produces（store-settings 持久化网关）：`store.setDesktopPetEnabled/Mode/Resident/Size`、`store.setDesktopPetCoins(amount)`、`store.setDesktopPetFeed(petId, snackId, affectionGain)`、`store.addDesktopPetAchievement(id)`——全部 `this._commit('settings')`。
- Produces（store.js）：`mergeDesktopPetDefaults(raw)` 深合并函数 + `DEFAULT_SETTINGS.desktopPet` 完整默认对象。

- [ ] **Step 1: 写失败测试（金币/购买/喂食/成就/迁移）**

`tests/desktop-pet.test.js` 追加：
```js
test('desktop-pet: 任务完成金币（p1=15 p2=10 p3/p4=5）+ 防刷幂等', () => {
  const { window, store } = boot();
  const fam = window.DesktopPetCore.createFamily(store, window.SonderBus, store.state.settings);
  const before = fam.getCoins();
  const t1 = store.addTask({ title:'甲', priority:'p1', done:false });
  store.updateTask(t1.id, { done:true });      // → 应发 15
  assert.strictEqual(fam.getCoins() - before, 15);
  store.updateTask(t1.id, { done:false });     // 取消，不扣
  store.updateTask(t1.id, { done:true });      // 再完成，不重复发（rewardedTaskIds 幂等）
  assert.strictEqual(fam.getCoins() - before, 15);
});
```
> 已核实：`addTask(data)`/`updateTask(id, patch)` 为真实名（store-tasks.js:40/56）；`updateTask` 在 patch 含 `done` 时联动写 `doneAt`（done=true→nowISO）。金币判定依赖 `updateTask` 内部已写 doneAt，订阅 `/data/tasks`（`EVENT.data('tasks')`）读结果态。**注意加入 `/data/settings` 订阅：金币仅存于 settings.desktopPet.collection，无独立 tasks 集合——实际由 CoinManager 订阅后遍历 `store.state.tasks` 判定。若测试内完成任务是同步的（updateTask 同步 _commit），fam 需在构造时先扫描存量已 done 任务并标记 rewarded，防止历史完成被重复发币。**

```js
test('desktop-pet: 购买零食扣金币 + 库存加 1（余额不足拒绝）', () => {
  const { window, store } = boot();
  const fam = window.DesktopPetCore.createFamily(store, window.SonderBus, store.state.settings);
  fam.addCoins(50);
  assert.strictEqual(fam.buySnack('snack_09'), false);       // 60 金币 > 50 余额 → 拒绝
  assert.strictEqual(fam.buySnack('snack_01'), true);        // 5 金币
  assert.strictEqual(fam.getCoins(), 45);
  assert.strictEqual(fam.getInventory()['snack_01'], 1);
});
```
```js
test('desktop-pet: 喂食扣库存 + 加亲密度（亲密度 = round(价格×0.4)）', () => {
  const { window, store } = boot();
  const fam = window.DesktopPetCore.createFamily(store, window.SonderBus, store.state.settings);
  fam.addCoins(10); fam.buySnack('snack_01');        // 库存 1（5 金币，亲密度 round(5×0.4)=2）
  const before = fam.getAffection('xiaomo');
  assert.strictEqual(fam.feedPet('xiaomo','snack_01'), true);
  assert.strictEqual(fam.getAffection('xiaomo') - before, 2);
  assert.strictEqual(fam.getInventory()['snack_01'] || 0, 0);
});
```
```js
test('desktop-pet: 成就检测（达成解锁 + 发金币不重复）', () => {
  const { window, store } = boot();
  const fam = window.DesktopPetCore.createFamily(store, window.SonderBus, store.state.settings);
  const ach = fam.getAchievements();
  assert.ok(Array.isArray(ach.unlocked));
  // first_task：完成 1 个 p1 任务后检测 → unlocked 含 first_task 且 coins+10
  const t = store.addTask({ title:'甲', priority:'p1', done:false });
  store.updateTask(t.id, { done:true });
  fam.checkAchievements();
  assert.ok(fam.getAchievements().unlocked.includes('first_task'));
});
```
```js
test('desktop-pet: 数据深合并迁移（缺失嵌套字段补默认）', () => {
  const raw = { enabled:false, size:120 };   // 无 coins/affection/achievements
  const merged = window.DesktopPetCore.mergeDesktopPetDefaults(raw);
  assert.strictEqual(merged.enabled, false);          // 保留
  assert.strictEqual(merged.size, 120);               // 保留
  assert.strictEqual(merged.coins, 0);                // 默认补全
  assert.strictEqual(merged.mode, 'duo');             // 默认
  assert.deepStrictEqual(merged.affection, { xiaomo:0, xiaoyu:0, lanling:0 });
  assert.strictEqual(merged.schemaVersion, 1);
});
```

- [ ] **Step 2: 运行验证失败**

Run: `node --test tests/desktop-pet.test.js`
Expected: FAIL（方法未实现/未定义）。

- [ ] **Step 3: 深合并 + 持久化网关 + 金币/成就**

`js/store.js`：
- `DEFAULT_SETTINGS` 追加完整 `desktopPet` 默认对象（规格 3.5）。
- 新增 `mergeDesktopPetDefaults(raw)`：递归 `deepMerge(target, defaults)`（规格 8.2 语义：目标缺失补默认，嵌套对象递归），导出到 `_h` 或 core。
- settings 加载合并处：`mergeSettings` 返回前对 `raw.desktopPet` 调 `mergeDesktopPetDefaults` 覆盖白名单合并的丢弃行为。

`js/store-settings.js`：**新增一个泛型网关** `Store.prototype.setDesktopPetSection = function (section, patch)`——校验 `section` 在规范化白名单（`config/mode/positions/inventory/affection/coins/achievements/statistics/rewardedTaskIds/streak`）内且 patch 为对象，浅合并进 `this.state.settings.desktopPet[section]`，然后 `_commit('settings')`。同步更新 `js/globals.d.ts` 的 `SonderStoreImpl` 接口。这是对既有 `setTheme/setWallpaperOpacity`（各自小方法）惯例的刻意偏离：桌面玩偶状态子段多且嵌套，逐字段方法会膨胀 store-settings；**泛型收口保证所有写路径只经一个持久化网关，Family 内部不直接裸改 state（避免漏 `_commit`）**。等价保持 updateTask 的「改后 commit」纪律。

`js/desktop-pet.js`：
- `CoinManager`：`addCoins`（非负整数）、`spendCoins`（余额足够才扣，返回 bool）、会话上限 100、`rewardedTaskIds`（≤500 滚动）、`isImporting` 标志。所有写状态经 `store.setDesktopPetSection('coins', { amount, rewardedTaskIds })` 一次性收口。
- 订阅 `EVENT.data('tasks')`=`/data/tasks`（总线无载荷）：遍历 `store.state.tasks`，判定 `t.done && t.doneAt !== null && !rewardedTaskIds.includes(t.id)` → 发币（p1=15/p2=10/p3·p4=5）+ 记 id + 触发现状表情/飘字；`isImporting` 时跳过。构造时先扫描存量标记 rewarded 防重复发币。
- `ShopManager`：`buySnack(snackId)`（检查余额→spendCoins→库存+1→setDesktopPetSection('inventory')）。
- `FeedManager`：`feedPet(petId, snackId)`（库存≥1→扣库存→亲密度+round(price×0.4)→统计→persist→检测成就）。
- `AchievementManager`：`checkAchievements`（10 成就条件 + streak 连续天数跨天处理，spec 5.3 逻辑）+ 解锁发金币。
- `getState()` 返回 deepClone 快照（防外泄可变引用）。
- `autoInit`：`window.__desktopPetFamily = DesktopPetCore.createFamily(store, window.SonderBus, store.state.settings)`（**store 是实例，来自 `window.__sonderHooks.store`，不是工厂 `window.SonderStore`**），全程 try-catch 不阻断；监听 `/data/settings` 同步 config 变更。

- [ ] **Step 4: 运行验证通过**

Run: `node --test tests/desktop-pet.test.js`
Expected: PASS（前述测试全部绿）。

- [ ] **Step 5: 全量回归 + typecheck + lint**

Run: `npm test`；`npm run typecheck`；`npm run lint`
Expected: 全绿 + 零问题。
> 注意：`mergeSettings` 改动影响 `store.test/theme-auto/settings-ux` 等既有 settings 测试——深合并只碰 desktopPet 新字段，不应改变既有行为；若某旧测试断言 settings 精确结构，需核实其只测白名单字段。

- [ ] **Step 6: 提交**

```powershell
git commit -F commitmsg.txt   # "feat(desktop-pet): 金币/商店/喂养/亲密度/成就 + settings 深合并迁移（Phase 2 养成闭环 + Phase 3 成就底座）"
```

---

### Task 4: 成就 UI + 多玩偶互动对话（Phase 3 收尾）

**Files:**
- Modify: `js/desktop-pet.js`
- Modify: `css/desktop-pet.css`

**Interfaces:**
- Consumes: Task 3 的 `AchievementManager`/`CoinManager`。
- Produces：`ShopPanel`（商店弹窗：3 列网格、余额置灰、Esc 关闭、aria-modal）、`FeedPanel`（喂食选择小弹窗）、`AchievementBanner`（顶部横幅 + excited 表情 + 金币动画）、`CoinFly`（飘字 800-1200ms，最多 3 并发排队）、`InteractionManager`（互动触发条件/对话播放/冷却 3-6min/点击打断）。

- [ ] **Step 1: 写失败测试**

`tests/desktop-pet.test.js` 追加：
```js
test('desktop-pet: 多玩偶互动触发与冷却', () => {
  const { window } = boot();
  const fam = window.DesktopPetCore.createFamily(window.SonderStore, window.SonderBus, window.SonderStore.state.settings);
  fam.setMode('trio');
  // 模拟触发间隔冷却不满足 → 不应立即互动
  assert.strictEqual(fam.triggerInteraction(), false);
  fam._interactionManager.lastAt = 0;      // 制造可触发态（内部细节仅测试用）
  // 真实断言以实现为准：triggerInteraction 返回 bool 或触发对话开始
});
```
> 互动触发是计时器异步驱动，JSDOM 下不宜用真实等待——本 Task 测试聚焦：触发条件判定逻辑（冷却/在场数量/无拖拽/无播放中）用同步方法暴露，异步播放用 `on('interaction', cb)` 事件断言。
```js
test('desktop-pet: 对话播放期间点击参与角色即结束', () => {
  // 通过 fam.on('interaction', ...) 订阅 + 调用内部 beginInteraction 同步路径
});
```

- [ ] **Step 2: 运行验证失败**

Run: `node --test tests/desktop-pet.test.js`
Expected: FAIL。

- [ ] **Step 3: 实现 UI 组件 + 互动管理器**

- `InteractionManager`：在场 ≥2、间距 <200px 或同角、距上次互动 3-6min、无拖拽、无播放中 → 随机类型（chat 40/play 25/tease 20/comfort 10/sync 5）+ 选 DIALOGUES 组合；逐轮气泡（sayLine，每轮 1.5-2.5s，气泡 3s），参与角色表情联动；播放中点击 → 立即结束 + 响应点击；结束后冷却；`on('interaction')` 广播。
- `ShopPanel/FeedPanel/AchievementBanner/CoinFly`：规格 6.2/7.1/5.3 的 DOM/样式；textContent；Esc 关闭；移动端底部抽屉；aria 标记。
- 成就横幅：解锁时 `role="alert"`、在场玩偶 excited、金币动画。

- [ ] **Step 4: 运行验证通过**

Run: `node --test tests/desktop-pet.test.js`
Expected: PASS。

- [ ] **Step 5: 全量回归 + typecheck + lint**

Run: `npm test`；`npm run typecheck`；`npm run lint`；`npm run test:e2e`（可选冒烟）
Expected: 全绿 + 零问题 + E2E 若跑则通过。

- [ ] **Step 6: 提交**

```powershell
git commit -F commitmsg.txt   # "feat(desktop-pet): 成就横幅 + 商店/喂食弹窗 + 多玩偶互动对话（Phase 3 收尾）"
```

---

### Task 5: 独立板块页面 desktop-pet-page.js + 全局接线

**Files:**
- Create: `js/desktop-pet-page.js`
- Modify: `js/app.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: Task 3 的 `window.__desktopPetFamily`（含 `getState/on/setMode/setResident/setSize/setEnabled/buySnack/feedPet/enterPageMode/exitPageMode`）。
- Produces: `Pages['desktop-pet'] = { title:'小莫灵家族', render(container, ctx) }`；页面 5 分区（标题栏+金币、三角色卡、显示设置、商店预览、成就列表）；核心缺失降级（轮询 200ms ≤3s）；开关 `modules.desktopPet` 控制导航显隐。

- [ ] **Step 1: 写失败测试（页面注册与降级）**

`tests/desktop-pet.test.js` 追加：
```js
test('desktop-pet: 独立板块页面注册 + 五分区渲染', () => {
  const { window } = boot();
  const Page = window.Pages['desktop-pet'];
  assert.ok(Page, '页面未注册');
  assert.strictEqual(Page.title, '小莫灵家族');
  const container = window.document.createElement('div');
  Page.render(container, { navigate: () => {} });
  assert.ok(container.querySelector('.dp-page-card-xiaomo'));
  assert.ok(container.querySelector('.dp-page-shop'));
  assert.ok(container.querySelector('.dp-page-achievements'));
});
test('desktop-pet: 核心模块缺失时页面优雅降级不报错', () => {
  // 删除 window.__desktopPetFamily 后 render，断言静态卡片存在且无抛错
});
```
```js
test('desktop-pet: 模块开关控制导航显隐 + 双开关独立', () => {
  const { window, store } = boot();
  // modules.desktopPet=false → 导航项隐藏但 family 仍运行
  store.setModuleEnabled('desktop-pet', false);
  // desktopPet.enabled=false → family.isEnabled()===false 但导航项仍在（还原后再验）
  store.setModuleEnabled('desktop-pet', true);
});
```

- [ ] **Step 2: 运行验证失败**

Run: `node --test tests/desktop-pet.test.js`
Expected: FAIL（页面未注册）。

- [ ] **Step 3: 实现页面模块 + 接线**

`js/desktop-pet-page.js`：
- UMD，依赖 `window.DesktopPetCore`（静态降级时不依赖）。注册 `Pages['desktop-pet']`。
- render 布局：标题栏（'🐾' + '小莫灵家族' + 余额）、三角色展示卡（大 SVG + 亲密度进度条 + [喂食]）、显示设置（模式/常驻/大小滑块/总开关/重置数据带二次确认）、商店预览（9 零食库存摘要 + 打开完整 ShopPanel）、成就分区（10 项解锁状态 + 达成条件）。
- 订阅 `family.on('change')` 局部重渲染；`enterPageMode/exitPageMode` 管理悬浮实例。
- 核心缺失：200ms 轮询检查 `window.__desktopPetFamily`，≤3s；失败则静态卡 + 按钮置灰 + 提示，不调用任何 family 方法。

`js/app.js`（行用于核对，勿硬编码行号）：
- `NAV`（数组，:10，当前 `['home','today','memo','selfmedia','dev','consulting','reading','excerpts','news','design','game','settings']`）：在 `'game'` 后、`'settings'` 前插 `'desktop-pet'`。
- `ICONS`（对象，:11-14）：增 `'desktop-pet': '🐾'`。
- `TOGGLEABLE`（对象，:9）：增 `'desktop-pet': 1`。
> buildNav（:79）的 modKey 映射 `key === 'excerpts' ? 'reading' : key` 对 desktop-pet 无特例，开关注册 key 即 `settings.modules.desktopPet`，无需改 logic。

`js/store-stats.js`：`moduleKeysList`（:209，9 项数组，'game' 后追加）加 `{ key:'desktop-pet', label:'小莫灵家族' }`。同步 globals.d.ts 无硬编码长度需要。

`index.html`：`<script src="js/desktop-pet-page.js" defer></script>` 添加到 desktop-pet.js 之后（App scripts 区末尾，app.js 之后）。
> 搜索索引 search.js 的 `NAV_MODULE`（:8）为白名单映射，desktop-pet 默认不入搜索，如需可后续加（本计划不要求，保持最小）。

- [ ] **Step 4: 运行验证通过**

Run: `node --test tests/desktop-pet.test.js`
Expected: PASS；`npm test` 全量绿（modules-smoke/shell/navigation 相关测试应自动带出新导航项，若有断言 NAV 长度的旧测试需核对其是否枚举硬编码——预期无，NAV 已通用遍历）。

- [ ] **Step 5: 全量回归 + typecheck + lint + E2E**

Run: `npm test`；`npm run typecheck`；`npm run lint`；`npm run test:e2e`
Expected: 全绿 + 零问题 + E2E 冒烟通过。

- [ ] **Step 6: 提交**

```powershell
git commit -F commitmsg.txt   # "feat(desktop-pet): 独立板块页面 + 全局接线（nav/icons/moduleList）"
```

---

### Task 6: 全契约测试补全 + 回归守门

**Files:**
- Modify: `tests/desktop-pet.test.js`

**Interfaces:**
- Consumes: 全部 PetFamily 公开 API。
- Produces: 规格 11.2 全清单测试（十项断言全绿）。

- [ ] **Step 1: 补全测试覆盖规格 11.2**

在已有测试基础上追加补齐剩余断言（各 Task 已含部分，此处收口）：
- `SNACKS` 配置完整性：9 种，id 与价格/亲密度表一致，`affection === Math.round(price * 0.4)`。
- `ACHIEVEMENTS` 配置完整性：10 个，id/条件/奖励与规格表一致。
- `Pet` 构造/销毁：`new C.Pet({...})` 后 `destroy()` 无残留监听（用 spy 断言 removeEventListener 调用）。
- 角色差异化：三实例 `breathe/blink` 参数不同，bodyScale 不同。
- 显示模式：single/duo/trio 实例数（duo 需 mock 计时，用同步 `simulateVisit()` 测试方法）。

- [ ] **Step 2: 运行验证**

Run: `node --test tests/desktop-pet.test.js`；`npm test`；`npm run typecheck`；`npm run lint`
Expected: 全绿 + 零问题。

- [ ] **Step 3: 提交**

```powershell
git commit -F commitmsg.txt   # "test(desktop-pet): 规格 11.2 全契约测试收口"
```

---

### Task 7: sw 缓存同步 + 文档归档 + 基线滚动（v6.0 收官）

**Files:**
- Modify: `sw.js`（`npm run sync-sw` 重生成）
- Modify: `js/globals.d.ts`（若需补充 window 声明）
- Create: `docs/ADR-012-desktop-pet.md`（或追加 adr/README 索引）
- Modify: `README.md` / `README.en.md` / `PRD.md` / `CHANGELOG.md` / `docs/device-acceptance.md` / `AGENTS.md`

**Interfaces:**
- Consumes: 全部已落地代码。

- [ ] **Step 1: 运行 sync-sw**

Run: `npm run sync-sw`
Expected: `sw.js` 的 ASSETS 列表包含 `./js/desktop-pet.js`、`./js/desktop-pet-page.js`、`./css/desktop-pet.css`；CACHE_NAME 缓存版本 v48→v49；ASSET_SIG 变化。

- [ ] **Step 2: 写 ADR-012**

`docs/ADR-012-desktop-pet.md`：记录决策——独立 Specialized 模块（不进 ModuleFactory 的理由）、数据存 settings.desktopPet（复用集合级持久化 + 加密）、金币信号用结果态（总线无载荷）、深合并独立函数（mergeSettings 白名单限制）、金币 p1-p4 映射。`docs/adr/README.md` 索引补条目。

- [ ] **Step 3: 文档同步**

- `README.md`/`README.en.md`：功能列表加「小莫灵家族桌面玩偶（养成系统）」。
- `PRD.md`：v6.0 版本演进行补桌面玩偶；功能清单同步。
- `CHANGELOG.md`：新增桌面玩偶完整条目（三阶段）。
- `docs/device-acceptance.md`：桌面玩偶验收项 + 测试基线数字。
- `AGENTS.md`：基线滚动——592+新增测试数、提交数（200+N）、缓存版本 v49、模块清单加 desktop-pet。

- [ ] **Step 4: 全量最终回归**

Run: `npm test`；`npm run typecheck`；`npm run lint`
Expected: 全绿 + 零问题。记录最终测试数与提交数，回填文档数字。

- [ ] **Step 5: 提交**

```powershell
# 按项目惯例拆两层：
# a) docs: ADR-012 + 规格索引
# b) 本次文档同步 + sw.js
git commit -F commitmsg.txt   # "docs: desktop-pet ADR-012 + 文档基线同步（592→N 测试、缓存 v48→v49），v6.0 收官"
```

---

## Self-Review（执行前自查）

**规格覆盖：**
- Phase 1（三角色/显示/串门/布局/拖拽/位置持久化/移动端）→ Task 1-2 ✅
- Phase 2（任务金币/飘字/防刷/商店 9 零食/喂食/亲密度/重置数据）→ Task 3 ✅
- Phase 3（成就 10 项/streak/互动 20 组对话/270 语录/无障碍/降级）→ Task 3-4 ✅
- 独立板块页面（五分区/双开关/页面通信/降级轮询）→ Task 5 ✅
- 数据持久化（settings.desktopPet/深合并/备份导入抑制发币/加密继承）→ Task 3 ✅
- 测试/文档/sync-sw/ADR/AGENTS 基线 → Task 0/6/7 ✅

**已核实的 API 契约（2026-08-20，详情见上方 Verified Facts）：**
- `store.addTask(data)` / `store.updateTask(id, patch)` / `store.deleteTask(id)`（store-tasks.js:40/56/74）；`patch.done` 联动写 `doneAt`。
- `store.setModuleEnabled(key, on)`（store-settings.js:44）——key 必须已入 DEFAULT_SETTINGS.modules。
- `window.SonderStore` 是工厂（`.createStore()`），**实例**要取 `boot().store` 或 `window.__sonderHooks.store`；`window.SonderBus` 全局含 `.bus` + `.EVENT`。
- 事件路径走 `EVENT.data('tasks')` / `EVENT.data('settings')`（勿写魔法字符串）；detail 恒 undefined。
- boot() 从 index.html 读 `<script src="js/...">` 顺序 → 新文件接进 index.html 即进入测试。
- scripts.test.js:108 强制外部脚本统一 defer；sync-sw.js 会把新 asset 吸入 sw.js 清单。
- mergeSettings（store.js:288）是白名单浅合并 → desktopPet 必须独立深合并分支；需检查现有 settings 相关测试（store.test / theme / settings-ux）不因新增 DEFAULT_SETTINGS.desktopPet 和 modules.desktopPet 字段而破坏（多为遍历/白名单断言，预期安全，但写入后必须全量回归验证）。

**类型一致性：**
- `PetFamily.getState()` 统一返回 deepClone 快照；`on('change')` 事件名统一；`createFamily(store, bus, settings)` 签名跨 Task 一致；`mergeDesktopPetDefaults` 在 core 导出命名一致；`setDesktopPetSection(section, patch)` 白名单 section 一致。