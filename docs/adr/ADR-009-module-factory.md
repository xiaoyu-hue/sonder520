# ADR-009：标准模块工厂（ModuleFactory v0.1）

- 状态：已采纳
- 背景：Sonder-Frame 渐进式改造（v6.0 主线）推进到 ModuleFactory 层——规范要求框架提供「标准模块 CRUD / Schema / 状态 / 查询」的公共形态，供未来模块迁移复用（Phase 7）。v0.1 仅框架层落地，不迁移任何现有模块；迁移自 Phase 7 起逐模块进行，任一阶段测试失败即停。
- 决策：
  1. **独立文件 `js/framework/ModuleFactory.js`，UMD 形态**（Node `require` 直出 api / 浏览器挂 `window.SonderModuleFactory`），自包含、运行期零依赖；store 实例由 `createModule(store, config)` 注入——与 store-stats.js 同构，插进 index.html store.js 之后加载。
  2. **ModuleConfig 三件套：validate → normalize → freeze**。字段类型第一版只开放 `text/textarea/date/boolean/number/select/array`；`id/displayName/storageKey/schemaVersion/fields/label/select options` 逐一校验，非法配置立即失败；规范化后 config 深冻结（运行时不可变）。
  3. **记录生命周期**：字段先按声明净化（用户输入默认不可信：trim / 数字夹取 / 布尔白名单 / 数组拷贝 / select 限定 options），required 校验于**临时副本**上执行——校验失败不污染内存记录也不落盘；`id/createdAt/updatedAt` 由工厂生成（业务字段不得占用保留键）。
  4. **落盘语义与领域方法一致**：`store.save()` + `store._emitChange(collectionKey)`；删除记录入 `_undoPush` 撤销栈，`undoRemove` 原位置恢复。写序不变量与加密/备份/导出路径零变更。
  5. **query 纯净**：不改 state、不触发渲染；返回记录浅拷贝，不外泄可变引用。
  6. **集合注册（数据安全关键）**：`createModule` 时经 `store._registerCollection(id)` 将集合 key 纳入 store.js 的 `EXTRA_COLLECTIONS` 注册表与 `defaultState` 保底，使 normalize 白名单在**重载 / 导入 / 解密 / 清空**全部路径保留工厂数据——保证 E2E「新建→刷新→还在」成立。store.js 改动为纯增量（注册表默认空，存量行为零变更）。
  7. **storageKey 粒度持久化（每集合独立 key）属 Phase 7 迁移任务**：v0.1 集合统一存于主快照 `state.<id>`，备份/加密随之覆盖。
- 代价：store.js 新增一个注册表（默认空）；未来迁移模块时必须走 `createModule`（或专项迁移器），不得绕开注册直写集合 key（否则数据会被 normalize 静默丢弃）。
- 实证（2026-08-17）：23 项新测试（UMD 契约 / 校验矩阵 / 冻结 / add/update/remove 净化与回滚语义 / query 纯净 / render 挂点 / destroy / 备份往返保留），全量 561 项绿；`npm run typecheck` 与 `npm run lint` 零错误零警告。