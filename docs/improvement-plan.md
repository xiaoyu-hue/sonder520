# Sonder 项目改进计划方案

> 基于 v6.0 代码评审发现的 5 个改进方向，逐项制定详细方案。
> 本文档供审阅确认，确认后按优先级分阶段实施。

---

## 一、改进总览

| 序号 | 改进项 | 优先级 | 风险等级 | 预估工作量 | 前置条件 |
|------|--------|--------|----------|-----------|----------|
| ① | desktop-pet.js 数据/逻辑拆分 | P2 | 低 | 2-3h | 无 |
| ② | style.css 模块化拆分 | P2 | 低 | 1-2h | 无 |
| ③ | ESLint 加固 + globals.d.ts 自动化 | P3 | 中 | 3-4h | 无 |
| ④ | VisualEngine 落地评估与实施 | P3 | 中 | 4-6h | ①②完成后再评估 |
| ⑤ | TrustLayer 独立化 | P1（最高） | 高 | 8-12h | 需拆分为3个子阶段 |

---

## 二、逐项详细方案

---

### 改进项 ①：desktop-pet.js 数据/逻辑拆分

#### 现状分析

`desktop-pet.js` 共 **2,850 行**，按规格 9.5 七区分区：

| 分区 | 行号范围 | 行数 | 内容 |
|------|----------|------|------|
| 第一区：配置表 | 20-391 | ~371 行 | 270 条语录（QUOTES）、3 角色配置（CHARACTERS）、9 种零食（SNACKS）、10 个成就（ACHIEVEMENTS）、互动对话库（DIALOGUES） |
| 第二区：工具函数 | 392-485 | ~93 行 | isTouchDevice、randomFrom、clamp 等 |
| 第三区：Pet 类 | 486-1801 | ~1,315 行 | 单个玩偶的完整逻辑（状态机、动画、交互、渲染） |
| 第四区：子管理器 | 1802-2374 | ~572 行 | AnimationEngine、InteractionEngine、PetRenderer、SoundManager、AchievementManager |
| 第五区：PetFamily | 2375-2800 | ~425 行 | 组合管理器、金币系统、喂养、商店、自动触发 |
| 第七区：工厂与初始化 | 2801-2850 | ~49 行 | PetFamily.autoInit()、DOMContentLoaded 绑定 |

#### 拆分方案

**原则**：逻辑与数据分离，文件按职责拆分，UMD 兼容不变，测试行为零变更。

**新文件结构**：

```
js/
├── desktop-pet-data.js      ← 新增：配置数据（~400行）
│   ├── QUOTES（270条语录）
│   ├── CHARACTERS（3角色配置）
│   ├── SNACKS（9种零食）
│   ├── ACHIEVEMENTS（10个成就）
│   └── DIALOGUES（互动对话库）
│
├── desktop-pet.js           ← 精简后：核心逻辑（~2,450行）
│   ├── 第二区：工具函数
│   ├── 第三区：Pet 类
│   ├── 第四区：子管理器
│   ├── 第五区：PetFamily
│   └── 第七区：工厂与初始化
│
└── desktop-pet-page.js      ← 不变
```

**实施步骤**：

1. 新建 `js/desktop-pet-data.js`（UMD 格式，暴露 `window.DesktopPetData`）
2. 从 `desktop-pet.js` 第一区（20-391 行）提取 QUOTES/CHARACTERS/SNACKS/ACHIEVEMENTS/DIALOGUES
3. 在 `desktop-pet.js` 中将引用改为 `DesktopPetData.QUOTES` 等
4. `index.html` 脚本顺序：在 `desktop-pet.js` 之前插入 `desktop-pet-data.js`
5. `sw.js` ASSETS 清单添加 `./js/desktop-pet-data.js`
6. 运行 `npm run sync-sw` 更新缓存指纹
7. `npm test` 全量回归（预期 desktop-pet 相关 28+ 项测试全绿）
8. `npm run typecheck` + `npm run lint` 零错误

**收益**：
- `desktop-pet.js` 从 2,850 行降至 ~2,450 行（减 14%）
- 配置数据独立，便于内容编辑（如添加新角色语录）而无需触碰逻辑代码
- 数据文件可被测试单独引用，做内容校验测试（如"每个角色每个场景至少5条语录"）

**风险**：低。纯提取，无逻辑变更，测试行为不变。

---

### 改进项 ②：style.css 模块化拆分

#### 现状分析

`style.css` 共 **996 行**，已用注释清晰分段：

| 区块 | 行号范围 | 行数 | 内容 |
|------|----------|------|------|
| 基础变量 + 布局 | 1-250 | ~243 行 | CSS 变量、壁纸、侧栏、主区、网格 |
| 组件库 | 251-477 | ~227 行 | 触控、玻璃卡片、页脚、按钮、空状态、弹窗、Toast、图表 |
| 动画 | 478-592 | ~115 行 | @keyframes、过渡、涟漪、墨染、reduced-motion |
| 滚动条 | 593-615 | ~23 行 | 水墨细滚动条 |
| 游戏样式 | 616-690 | ~75 行 | 井字棋、五子棋 |
| v3 模块样式 | 691-902 | ~212 行 | 今日计划、阅读、自媒体、开发、扫雷、猜成语 |
| 响应式 | 903-996 | ~94 行 | 断点适配（960/720/360/横屏） |

#### 拆分方案

**原则**：按功能域拆分，保持 CSS 变量（`:root`）在基础文件中唯一定义，文件通过 `<link>` 按序加载（无构建工具）。

**新文件结构**：

```
css/
├── style.css              ← 基础层：变量 + 布局 + 组件（~470行）
│   ├── CSS 变量（浅色/深色主题 token）
│   ├── 壁纸背景层
│   ├── 侧栏导航
│   ├── 主区 + 顶栏 + 配额条
│   ├── 网格系统
│   ├── 触控细节
│   ├── 玻璃卡片
│   ├── 页脚 + 离线指示器
│   ├── 按钮 + 空状态
│   ├── 弹窗 + Toast
│   ├── 进度条 + 表单滑块
│   └── 水墨细滚动条
│
├── animations.css         ← 动画层（~115行）
│   ├── @keyframes（fadeSlideUp/barsGrow/inkTransit/toastIn 等）
│   ├── prefers-reduced-motion 降级
│   ├── ink-ripple 墨点涟漪
│   ├── ink-transit 墨染过渡
│   └── sheen-glow 光泽扫过
│
├── modules.css            ← 业务模块样式（~212行）
│   ├── 首页每日金句
│   ├── 今日计划（优先级圆点、完成率环形、🍅专注）
│   ├── 阅读（计时时钟、书摘、首页出处）
│   ├── 自媒体（月历排期、数据反馈、折线图）
│   ├── 开发（Markdown笔记、代码片段）
│   └── 统计图表（水墨配色）
│
├── games.css              ← 游戏样式（~75行）
│   ├── 井字棋 + 五子棋（棋盘、落子动画、胜利高亮）
│   ├── 扫雷（格子、旗帜、数字色标）
│   ├── 猜数字 + 猜成语 + 脑筋急转弯
│   └── 战绩面板
│
├── responsive.css         ← 响应式（~94行）
│   ├── >1240px 限宽居中
│   ├── ≤960px 平板图标栏
│   ├── ≤720px 手机底部导航 + 触控适配
│   ├── ≤360px 超小屏压缩
│   └── 横屏压缩
│
└── desktop-pet.css        ← 不变
```

**`index.html` 脚本顺序变更**：

```html
<link rel="stylesheet" href="css/style.css">        <!-- 基础 + 组件 -->
<link rel="stylesheet" href="css/animations.css">    <!-- 动画 -->
<link rel="stylesheet" href="css/modules.css">       <!-- 业务模块 -->
<link rel="stylesheet" href="css/games.css">          <!-- 游戏 -->
<link rel="stylesheet" href="css/responsive.css">     <!-- 响应式 -->
<link rel="stylesheet" href="css/desktop-pet.css">    <!-- 玩偶 -->
```

**实施步骤**：

1. 按上述划分从 `style.css` 提取到对应新文件
2. 更新 `index.html` 的 `<link>` 标签
3. 更新 `sw.js` ASSETS 清单
4. 运行 `npm run sync-sw`
5. `npm test` 全量回归（特别关注 `responsive.test.js`、`style.test.js`、`css-vars.test.js`）
6. `npm run typecheck` + `npm run lint` 零错误
7. 手动验证三端渲染一致（Playwright 或手动）

**收益**：
- 每个文件控制在 75-470 行，便于定位和维护
- 游戏/动画等特定域样式可独立修改，不影响全局
- 为后续 CSS @layer 或 CSS Modules 迁移预留结构

**风险**：低。纯文件拆分，选择器和变量不变更，加载顺序确保级联一致。

---

### 改进项 ③：ESLint 加固 + globals.d.ts 同步机制

#### 现状分析

- **ESLint 配置**：仅用 `eslint:recommended`，规则极轻
- **globals.d.ts**：678 行手动维护的类型声明，与 `Store.prototype.*` 的 64 个公开方法一一对应
- **漂移风险**：新方法加入 store-*.js 后，需手动同步 globals.d.ts，目前全靠人工纪律

#### 方案 A：ESLint 规则加固

**新增 eslint 配置**（`.eslintrc.json` 扩展）：

```json
{
  "extends": ["eslint:recommended"],
  "plugins": ["jsdoc"],
  "rules": {
    "no-console": "off",
    "no-unused-vars": ["warn", { "args": "none", "varsIgnorePattern": "^_" }],
    
    // 新增：防止常见错误
    "no-implicit-globals": "error",
    "no-shadow": "warn",
    "eqeqeq": ["warn", "smart"],
    "no-throw-literal": "error",
    "no-self-compare": "error",
    "no-template-curly-in-string": "warn",
    
    // JSDoc 质量（轻量，不强制格式，只检查存在性）
    "jsdoc/require-jsdoc": ["warn", {
      "require": { "FunctionDeclaration": false, "ClassDeclaration": false },
      "publicOnly": true
    }],
    "jsdoc/check-param-names": "warn",
    "jsdoc/check-types": "warn",
    
    // 文件级
    "no-var": "off",           // 项目使用 var（ES5 风格）
    "prefer-const": "off",     // 同上
    "strict": "off"            // 已有 IIFE 内 'use strict'
  }
}
```

**需要安装**：

```bash
npm install --save-dev eslint-plugin-jsdoc
```

#### 方案 B：globals.d.ts 同步守护

在 `tests/` 中新增 `type-sync.test.js`，自动校验 globals.d.ts 与实现的一致性：

```javascript
// tests/type-sync.test.js - 自动生成 vs 手动声明对比
// 读取 store.js + store-*.js 中的 Store.prototype.* 方法名
// 读取 globals.d.ts 中 SonderStoreImpl 的声明方法名
// 断言两者集合一致（新增方法未声明 → 测试失败）
```

**实施步骤**：

1. 安装 `eslint-plugin-jsdoc`
2. 更新 `.eslintrc.json` 添加上述规则
3. `npm run lint` 修复现有 lint 问题（预计少量 warn，无 error）
4. 新增 `tests/type-sync.test.js` 自动同步校验
5. `npm test` 全量回归
6. 更新 `AGENTS.md` 中的 lint 命令说明

**收益**：
- JSDoc 注释质量提升，类型漂移可被自动检测
- 新增 Store 方法时，测试会提醒同步 globals.d.ts
- 常见 JS 错误模式被静态拦截

**风险**：中。eslint-plugin-jsdoc 可能引入对现有 JSDoc 注释的 warn，需评估噪声比。

---

### 改进项 ④：VisualEngine 落地评估

#### 现状分析

8 个已迁移的标准模块（memo/today/dev/news/reading/selfmedia/consulting/design）均使用相同渲染模式：

```javascript
function render(container, ctx) {
  container.innerHTML = '';                          // 1. 清空
  container.appendChild(UI.el('...'));              // 2. 构建标题栏
  if (list.length === 0) {
    container.appendChild(UI.emptyState(...));       // 3. 空状态
    return;
  }
  list.forEach(function (item) {
    box.appendChild(UI.el('...'));                   // 4. 逐条渲染卡片
  });
  container.appendChild(box);
}
```

**重复度评估**：

| 共享原语 | 当前实现 | 出现频次 | 是否值得抽取 |
|----------|----------|---------|-------------|
| `container.innerHTML = ''` | 1 行 | 8 次 | ❌ 过于简单 |
| `UI.el(html)` 构建卡片 | 各模块 HTML 不同 | 8 次 | ❌ HTML 结构差异大 |
| `UI.emptyState(msg, label, fn)` | 已是公共 API | 8 次 | ✅ 已抽好 |
| `UI.formModal(opts)` | 已是公共 API | 8 次 | ✅ 已抽好 |
| `UI.esc(s)` / `sanitize(s)` | 已是公共 API | 全局 | ✅ 已抽好 |
| 容器级事件委托（`data-act`） | memo/today/dev 三模块 | 3 次 | ⚠️ 刚达阈值 |

#### 结论：暂不建立独立 VisualEngine

**理由**：
1. 8 个模块的 **HTML 结构差异显著**（自媒体有月历视图、开发有嵌套任务、阅读有分组统计），无法用统一的 render 模板
2. 真正的共享原语（`emptyState`、`formModal`、`esc`、`sanitize`）**已在 UI 层沉淀完毕**
3. 事件委托模式（`data-act` 回查）在 3 个模块中统一，但第4个模块（如 news）的按钮绑定模式不同——强行统一会增加复杂度
4. ADR-011 试点评估已得出相同结论："VisualEngine 未达进框架阈值，暂不进"

**推荐的轻量替代方案**：

不建 VisualEngine，而是在 `js/ui.js` 中补充 2-3 个高频复用的渲染辅助函数：

```javascript
// 新增到 ui.js（约20行）
function renderListPage(container, opts) {
  // opts: { title, count, countLabel, addLabel, onAdd, emptyMsg, emptyLabel, onEmpty, renderCard, items }
  container.innerHTML = '';
  // 构建标题栏（含数量 + 新建按钮）
  // 空状态分支
  // 列表遍历渲染
}
```

这样既减少了重复代码（每个模块的 render 可减 10-15 行），又不过度抽象。

**实施步骤**（如果决定做）：

1. 分析 8 个模块 render 函数的共同骨架
2. 在 `ui.js` 中新增 `renderListPage()` 辅助函数
3. 逐模块迁移（每迁移一个，跑一次 `npm test`）
4. 全量回归

**收益**：每模块 render 减少 ~15 行重复代码，总计减少 ~120 行
**风险**：中。需逐模块验证渲染输出不变。

---

### 改进项 ⑤：TrustLayer 独立化（核心改进）

#### 现状分析

`store.js` 共 **1,782 行**，其中 TrustLayer 职责的方法占 **~1,128 行（63%）**：

| 职责域 | 方法 | 行数 | 说明 |
|--------|------|------|------|
| 持久化核心 | `_storeWrite`, `_commit`, `save`, `flushPersist` | ~160 行 | 写入协调、集合提交、批量防抖 |
| localStorage 副本 | `_persistLocal`, `_persistLocalColsSync` | ~170 行 | LS 集合级写入、批量空闲落盘 |
| IndexedDB 主快照 | `_idbWriteCols`, `loadIdb`, `_absorbNewer` | ~274 行 | IDB 事务、读取、跨标签吸收 |
| 加密层 | `_encSave`, `enableEncryption`, `unlock`, `disableEncryption`, `lock` | ~430 行 | 加解密切换、锁定态守卫、密钥派生 |
| 存储诊断 | `storageUsage`, `isNearQuota`, `hasPersistIssue`, `getStorageStatus`, `persistResult`, `diagnostics` | ~100 行 | 配额检测、状态报告 |
| 迁移与备份 | `migrateToIdb`, `exportBackup`, `importBackup`, `clearAll` | ~100 行 | 格式迁移、导入导出、清空 |

剩余 **~654 行（37%）** 是真正的 Store 业务逻辑（构造器、normalize、defaultState、合并策略）和被 store-*.js 领域文件混入的方法。

#### 拆分方案（三阶段）

##### Phase 1：提取 store-trustlayer.js（低风险，最大收益）

新建 `js/store-trustlayer.js`，将 TrustLayer 职责的方法迁出：

```
js/
├── store.js                 ← 精简后：~650行（构造 + normalize + defaultState + 合并 + 领域桥接）
├── store-trustlayer.js      ← 新增：~1,130行（持久化 + 加密 + 诊断 + 迁移备份）
├── store-tasks.js           ← 不变
├── store-media.js           ← 不变
├── store-content.js         ← 不变
├── store-settings.js        ← 不变
├── store-report.js          ← 不变
└── store-stats.js           ← 不变
```

**`store-trustlayer.js` 暴露的 API**：

```javascript
// UMD 格式，依赖 SonderStore（与 store-tasks.js 等领域文件同模式）
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    var api = require('./store.js');
    factory(api.Store, api._h);
    module.exports = api;
  } else {
    factory(root.SonderStore.Store, root.SonderStore._h);
  }
})(typeof self !== 'undefined' ? self : this, function (Store, _h) {
  'use strict';
  
  // ===== 持久化核心 =====
  Store.prototype._storeWrite = function (map, opts) { /* ... */ };
  Store.prototype._commit = function (col) { /* ... */ };
  Store.prototype.save = function () { /* ... */ };
  Store.prototype.flushPersist = function () { /* ... */ };
  
  // ===== localStorage 副本层 =====
  Store.prototype._persistLocal = function (map) { /* ... */ };
  Store.prototype._persistLocalColsSync = function (map) { /* ... */ };
  
  // ===== IndexedDB 主快照层 =====
  Store.prototype._idbWriteCols = function (map, extra) { /* ... */ };
  Store.prototype.loadIdb = function () { /* ... */ };
  Store.prototype._absorbNewer = function () { /* ... */ };
  
  // ===== 加密层 =====
  Store.prototype._encSave = function (map) { /* ... */ };
  Store.prototype.enableEncryption = function (password) { /* ... */ };
  Store.prototype.unlock = function (password) { /* ... */ };
  Store.prototype.disableEncryption = function (password) { /* ... */ };
  Store.prototype.lock = function () { /* ... */ };
  
  // ===== 存储诊断 =====
  Store.prototype.storageUsage = function () { /* ... */ };
  Store.prototype.isNearQuota = function () { /* ... */ };
  Store.prototype.hasPersistIssue = function () { /* ... */ };
  Store.prototype.persistIssueDetail = function () { /* ... */ };
  Store.prototype.getStorageStatus = function () { /* ... */ };
  Store.prototype.persistResult = function () { /* ... */ };
  Store.prototype.diagnostics = function () { /* ... */ };
  
  // ===== 迁移与备份 =====
  Store.prototype.migrateToIdb = function () { /* ... */ };
  Store.prototype.exportBackup = function () { /* ... */ };
  Store.prototype.importBackup = function (jsonStr, password) { /* ... */ };
  Store.prototype.clearAll = function () { /* ... */ };
});
```

**`index.html` 脚本顺序变更**：

```html
<script src="js/store.js" defer></script>
<script src="js/store-trustlayer.js" defer></script>   <!-- 新增 -->
<script src="js/framework/ModuleFactory.js" defer></script>
<script src="js/store-report.js" defer></script>
<!-- ... 其余不变 -->
```

**实施步骤**：

1. 新建 `js/store-trustlayer.js`（UMD 格式）
2. 从 `store.js` 逐步迁移方法（每迁移 3-5 个方法跑一次 `npm test`）
3. 确保所有内部引用（如 `_storeWrite` 调用 `_commit`）通过 `Store.prototype` 链可达
4. 更新 `index.html` 脚本顺序
5. 更新 `sw.js` ASSETS 清单
6. `npm run sync-sw`
7. `npm test` 全量回归（696 项全绿）
8. `npm run typecheck` + `npm run lint` 零错误

##### Phase 2：store-trustlayer.js 内部模块化（中风险）

在 Phase 1 稳定后，将 `store-trustlayer.js` 按子职责进一步拆分：

```
js/
├── store.js                 ← 业务状态层（~650行）
├── store-trustlayer.js      ← TrustLayer 入口 + 编排（~200行）
├── store-persist.js         ← 持久化核心：_storeWrite/_commit/save/flushPersist（~160行）
├── store-idb.js             ← IndexedDB 操作：_idbWriteCols/loadIdb/_absorbNewer（~274行）
├── store-encryption.js      ← 加密逻辑：_encSave/enable/disable/unlock/lock（~430行）
├── store-backup.js          ← 迁移与备份：migrateToIdb/exportBackup/importBackup/clearAll（~100行）
├── store-diagnostics.js     ← 诊断：storageUsage/isNearQuota/getStorageStatus 等（~100行）
└── store-*.js               ← 领域文件（不变）
```

**此阶段的前提条件**：
- Phase 1 已稳定运行 1+ 周
- 所有测试全绿
- 未发现新的边缘 case

##### Phase 3：TrustLayer 接口正式化（高风险，长期）

在 Phase 2 基础上，定义 TrustLayer 的正式接口（不再通过 `Store.prototype` 混入，而是独立对象）：

```javascript
// store-trustlayer.js 暴露独立接口
window.SonderTrustLayer = {
  persist: function(store, map, opts) { /* ... */ },
  loadIdb: function(store) { /* ... */ },
  encrypt: function(store, password) { /* ... */ },
  decrypt: function(store, password) { /* ... */ },
  diagnostics: function(store) { /* ... */ },
  // ...
};
```

**此阶段是长期目标，不在本次改进范围内，仅预留方向。**

---

## 三、实施优先级与排期建议

```
Week 1:
  ├── Phase 5a: TrustLayer 独立化 Phase 1（提取 store-trustlayer.js）
  └── Phase 1:  desktop-pet.js 数据拆分

Week 2:
  ├── Phase 2:  style.css 模块化拆分
  └── Phase 3:  ESLint 加固 + type-sync.test.js

Week 3 (评估):
  └── Phase 4:  VisualEngine 评估（基于 Week 1-2 完成后的代码结构重新评估）
```

**每个 Phase 的验收标准**：
- `npm test` 696 项全绿（或因新增测试而增长）
- `npm run typecheck` 零错误
- `npm run lint` 零错误（lint 规则变更后可能有新增 warn）
- `npm run test:e2e` 三端冒烟通过
- 手动验证：数据保存/加载、加密解锁、多标签同步、PWA 离线

---

## 四、风险控制

| 风险 | 控制措施 |
|------|----------|
| 文件拆分后脚本加载顺序错误 | index.html 为唯一真源，测试 harness 自动解析脚本顺序 |
| CSS 拆分后级联失效 | 拆分前后用 Playwright 截图对比关键页面 |
| TrustLayer 提取后方法引用断裂 | 每迁移 3-5 个方法跑一次测试，不一次性全移 |
| globals.d.ts 与实现漂移 | type-sync.test.js 自动校验 |
| eslint 新规则引入过多 warn | 先用 `warn` 级别，稳定后可升级为 `error` |

---

## 五、确认事项

请确认以下决策点：

1. **desktop-pet-data.js 是否拆分？** （推荐：是）
2. **style.css 拆分为5个文件是否合理？** （推荐：是，或合并 animations + modules 为1个文件得4个文件）
3. **ESLint 是否引入 eslint-plugin-jsdoc？** （推荐：是，但规则先用 warn）
4. **VisualEngine 本次是否实施？** （推荐：否，仅做轻量 renderListPage 辅助函数）
5. **TrustLayer Phase 1 是否作为最高优先级？** （推荐：是，这是架构改进的核心）
