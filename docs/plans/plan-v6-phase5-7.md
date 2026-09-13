# Sonder520 v6.x 架构升级 · Phase 5-7 执行方案

> 状态：已批准（2026-09-13，用户拍板按最优方案执行）
> 基线：main @ 55643ee（本地与远端一致）
> 依据：plan-v6-architecture-upgrade.md（主方案）+ plan-v6-architecture-upgrade-agent.md（执行方案）+ plan-v6-architecture-upgrade-audit.md（审计）

---

## 一句话目标

把剩余三条线走完：**① 给已走工厂的 memos/news/designs 补正式 Repository 身份；② 按职责把 store.js 拆薄；③ 提取唯一真实 Domain 规则（任务完成语义）**。全程"保留行为，改变边界"。

---

## Phase 5：memos / news / designs 提炼

### 现状
- 三页已走路径 A（ModuleFactory 封装）：`ensureMod(ctx)` → `SonderModuleFactory.createModule(ctx.store, CONFIG)` → add/update/remove。
- 缺：正式 Repository 文件 + 类型声明 + 防回退门禁测试（其他 6 集合已有）。

### 动作（方案 1：对称薄包装）
1. 新建 `js/repositories/{memo,news,design}-repository.js`（每个 ~30 行，IIFE + UMD 模式，与既有 6 个一致）：
   - `createXRepository(store)` 内部委托工厂模块对象（`SonderModuleFactory.createModule`），返回统一接口 `get/getAll/create/update/remove`。
   - 只做数据访问，不掺 UI。
2. 三页 `ensureMod` 改走 Repository：`repoOf(store)` helper 返回 `SonderXRepository.createXRepository(store)`（与 reading/settings/consulting/dev 模式一致）。
3. `js/globals.d.ts` 补 3 个接口（SonderRepositoryFactory 扩展 + Window 声明）。
4. 防回退门禁：断言三页不再直连 `store.addMemo/updateNews/…`（正则断言）。

### 测试
- 新增 `tests/{memo,news,design}-repository.test.js`（边界 + 委托行为）。
- 跑既有 memo/news/design UX 测试 + 工厂测试，确认行为零变化。

### 停止条件
- 相关测试全绿；门禁断言通过；typecheck/lint 绿。

---

## Phase 6：拆 store.js

### 依据
- 审计 §3 职责地图：store.js（1,837 行）中核心状态容器 + normalize 保留，其余按职责搬家。
- 红线（保护清单）：`_storeWrite` 门禁、IDB 主/LS 副语义、加密协议、事件契约、数据格式**一律不改**。
- 拆法沿用既有先例（store-tasks.js 模式：IIFE + `Store.prototype` 扩展 + index.html 顺序加载）。

### 动作
| 新文件 | 搬走的职责 | 规模 |
|---|---|---|
| `js/store-persistence.js` | openIdb/idbReady/idbPut/idbDel/idbGet/_persistLocal/_idbWriteCols/flushPersist/_doLocalFlush 等 | ~150 行 |
| `js/store-undo.js` | _undoPush/undoRemove | ~15 行 |
| `js/store-migration.js` | _migrateLegacyIfNeeded/_splitLegacy/_absorbNewer/_markGranular 等 | ~100 行 |
| `js/store-import-export.js` | exportBackup/importBackup/_importEncBackup/readSnapshot/clearAll | ~150 行 |

- store.js 保留：常量/工具 + 状态容器 + normalize + Store 构造 + 公开 API 组装 + 写路径收口。
- index.html script 顺序：store.js 之后按依赖顺序加载新文件（persistence → migration → undo → import-export）。
- Node 测试 harness：检查加载方式，同步补充。

### 测试
- 全量相关：写路径门禁（ADR-013）、加密、迁移、导入导出、undo 契约测试**原样全绿**。
- 每拆一个文件单独跑相关测试 + 提交一次。

### 停止条件
- store.js 行数显著下降且全量回归绿；红线测试无一改动仍绿。

---

## Phase 7：Domain（克制提取）

### 依据
- 审计 §7：全项目唯一值得提的真实规则 = 任务完成语义（完成/重开/不可重复完成），现状散在 today.js。
- 禁止空壳 Domain。

### 动作
1. 新建 `js/domain/task-domain.js`（纯函数，无 DOM/存储）：
   - `complete(task, now)`：未完成 → `{completed:true, completedAt:now}`；已完成 → 返回不变（不可重复完成）。
   - `reopen(task)`：已完成 → `{completed:false, completedAt:null}`；未完成 → 返回不变。
2. today.js 完成/重开按钮逻辑改走 `TaskDomain → TaskRepository`。
3. 新增 `tests/task-domain.test.js`（纯函数）；today 相关测试回归。

### 停止条件
- domain 测试绿 + today UX/undo/事件测试绿。

---

## 执行纪律（用户偏好）
- 每完成一小步：**单独测这一步 → 提交 git**（不跑全量）。
- 全部完成后：全量回归（npm test + typecheck + lint）。
- 推送需用户提供新 token（旧 token 已全部失效）。

## 风险
- Phase 6 拆文件风险最高（依赖深），用"搬家不改逻辑 + 每步单独回归"对冲；发现行为差异立即 git revert 该步。
- innerhtml.test.js 白名单：三页与 store 相关文件若在页面顶部插 helper，需同步行号（本次预期不触发，留意）。
