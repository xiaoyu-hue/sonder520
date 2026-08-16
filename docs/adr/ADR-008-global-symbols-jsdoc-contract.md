# ADR-008：全局符号契约（JSDoc `@this` 模板为成员真源）

- 状态：已采纳
- 背景：无框架多文件浏览器应用（ADR-001）中，跨文件共享符号（`SonderStore` / `SonderBus` / `SonderStats` 等）通过 `js/globals.d.ts` 显式声明。store.js 体积大（~39KB），此前实例私有成员（`_persistLocal`、`_doLocalFlush` 等）散见于方法 JSDoc，无统一清单，导致「成员增删 → 文档漂移 → 靠人肉 grep 核对」。
- 决策：
  1. **store.js 实例方法以 `@this {{ ... }}` 模板为成员真源**：新增/删除任一私有成员时必须同步 `@this` 模板（tsconfig `checkJs` 全开 + `noEmit` 类型检查会兜底发现：模板缺失成员 → 方法内用法报未声明错误）。
  2. **tsconfig.json 为脚本全局类型检查的唯一出口**：`checkJs: true`（覆盖 `js/**/*.js` 与 `js/**/*.d.ts`，exclude `js/game-worker.js`）；`npm run typecheck`（`tsc --noEmit`）是全量验证门槛的一部分。
  3. 公开符号（`SonderStore` 等）仍由 `globals.d.ts` 的 `declare var` 提供，各页面按需引用；`globals.d.ts` 只声明公开 API，不重复私有成员。
  4. eslint（ADR-003 配套）与 typecheck 双跑齐绿才能算完成改动。
- 代价：修改 store.js 成员时需同时改 `@this` 模板（一处文档点）；通过检查器强制避免漂移。
- 实证（2026-08-16）：历史代码已全量覆盖 `@this` 模板，`npm run typecheck` 当前零错误——无需存量补丁，仅需维持纪律。