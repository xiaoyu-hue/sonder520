# storageKey 粒度持久化方案：按集合独立落盘（ADR-009 决策 7 落地，TrustLayer 最大一次手术）

- 日期：2026-08-19
- 状态：**进行中**（方案文档已提交；实施与验证未开始——任一阶段失败即停）
- 前置：试点八 design（Phase 7 标准模块收官）通过后由用户选定。本方案落地 ADR-009 决策 7「storageKey 粒度持久化（每集合独立 key）属 Phase 7 迁移任务」，是 **v6.0 ④ 存储主线的收尾**：IndexedDB 主快照 + LS 副本从「整份快照」改为「按集合独立 key + 全局 meta 基线」。

## 一句话

把 `sonder_data_v1`（LS 整份）+ IDB 单 key `state`（整份 entry）拆为 **14 个集合级 key**（LS `sonder_col_<id>_v1` / IDB key `<id>`）；写路径只序列化+落盘变更集合；读路径逐集合按 savedAt 取新合并；legacy 整份作**迁移来源一次性拆分且旧 key 保留不删**（回滚安全）；加密随集合粒度（每集合独立 bundle）；导出/导入/备份格式**保持整份不变**（兼容既有备份文件）。**写序不变量 `_persistLocal → _idbWrite` 与全局 meta 基线（跨标签写锁协议载体）保持不变**。

## 侦查结论（已确认的事实）

- 存储常量（store.js:37-53）：`STORAGE_KEY='sonder_data_v1'`（整份）、`STORAGE_META_KEY='sonder_meta_v1'`（全局版本基线，写锁协议载体）、`STORAGE_SALT_KEY='sonder_encsalt_v1'`（全局盐独立明文）、`STORAGE_WALLPAPER_KEY`（独立不进快照）。
- IDB：`sonder-db` / store `state` / **单 key `'state'`**，entry `{savedAt, data, salt?}`（idbPut(idb, key, json) 是通用 key-value 函数，**IDB 天然支持多 key**——本方案不新建 objectStore、不改 DB 版本，只把 key 从 `'state'` 换成 `<集合>`）。
- 数据模型（defaultState, store.js:147-168）：14 个顶层集合——settings（含 version 语义）+ 12 记录集合（memos/tasks/posts/devProjects/devNotes/devSnippets/clients/books/excerpts/news/designs/gameRecords）+ miniRecords（对象型）。
- 写路径（save, store.js:539-558）：全量 `JSON.stringify(state)` → `_lastJson` 对比去重 → 明文 `_persistLocal(json)`（LS 先）+ `_idbWrite(json)`（IDB 串行队列）或加密 `_encSave(json)`（_encSave 内部同样双写）。**写序不变量**：`_persistLocal` 先刷新 `_meta`，`_idbWrite` 用同一 `_meta` 作 entry.savedAt（store.js:553-557 注释明示不可交换）。
- LS 落盘（_doLocalFlush, store.js:478-496）：`setItem(STORAGE_KEY, json)` + `setItem(STORAGE_META_KEY, _meta)`；失败置 `_persistFailed`。
- 多标签写锁（_lockedLocalFlush, store.js:418-447）：锁内写前比 `STORAGE_META_KEY` 与 `_lastSeenMeta`，不一致 → `_absorbNewer()` 让位（吸收 LS 最新快照、广播 `/store/yielded`、`_emitChange('all')`）；一致 → 正常落盘。
- 读路径（loadIdb, store.js:627-673）：IDB 空 → LS 原文回填 IDB；否则比 `STORAGE_META_KEY > entry.savedAt` 判 LS 更新（追平 IDB）；否则 `_decryptParse(entry.data)` → normalize → state 替换 + 回写 LS + `_emitChange('all')`。加密未解锁（`e===1` 且无密钥）→ `_idbEncLocked=true` 走解锁 UI，密文原样保留。
- 解密（_decryptParse, store.js:676-690）：整份 bundle 解密；未知加密版本一律返回 null（normalize 会清空数据，绝不落盘）。
- 手动迁移（migrateToIdb, store.js:694-708）：整份写 IDB；锁定态守卫；加密态走 _encSave。
- 导出（exportBackup, store.js:974-989）：明文 `JSON.stringify(state, null, 2)`；加密 `readSnapshot('any')` → 整份 bundle。**格式 = 整份 state**。
- 导入（importBackup, store.js:992-1049）：parse → normalize → state 整份替换 → save()（明文）/ _encSave（加密态）；返回 Promise<{ok, error?}>。
- 领域 API 变更入口（store-tasks/media/content/settings + games.js 散点，约 40 处）：全部「直接改 `this.state.<集合>` → `this.save()` → `_emitChange('<集合>')`」模式。
- **工厂 config.storageKey 是死配置**（ModuleFactory.js:53-54 仅校验非空字符串，持久化从不消费）：八个模块 config 全部写 `'sonder_data_v1'`（memo 是历史残留 `'sonder_memos_v1'`，从未被持久化层读过，无兼容负担）。
- 测试对整份 key 的依赖：harness.js:98 用 `sonder_data_v1` seed；encryption-ui.test.js:31/38/79/103/149/154 字面量读 `sonder_data_v1`；upgrade.test.js:6；enc-race.test.js:7；store.test.js:275；theme-auto.test.js:76/99；wallpaper-upload.test.js:110；notification.test.js:123（seed 经 boot）。

## 迁移形态（核心设计）

### 1. 集合注册表（CollectionRegistry）

| 集合 id | LS key | IDB key | 说明 |
|---|---|---|---|
| settings | `sonder_col_settings_v1` | `settings` | 含 version（版本号随 settings 走，读时合并进 state.version） |
| memos / tasks / posts / devProjects / devNotes / devSnippets / clients / books / excerpts / news / designs / gameRecords | `sonder_col_<id>_v1` | `<id>` | 12 个记录集合 |
| miniRecords | `sonder_col_miniRecords_v1` | `miniRecords` | 对象型集合 |

- **工厂 config.storageKey 复活**：八模块 config 的 `storageKey` 改为各自 `sonder_col_<id>_v1`（config 校验已有，零扩展）；领域集合（excerpts/gameRecords/miniRecords/settings）由 store 内部声明注册表。注册表 = 单一真源，读/写/迁移/加密全部经它迭代。
- IDB 不新建 objectStore 不改版本号：现有 `state` store 直接存 14 个 key（entry 结构 `{savedAt, data}` 不变）。
- **idbPut 的 put 语义天然幂等**：迁移拆分可安全重跑（覆盖半成品，不重复）。

### 2. 写路径：变更收口 + 集合级序列化

- **变更收口（数据安全关键防线）**：新增 `store._commit(collection)`——标记脏 + 触发保存。工厂 CRUD（ModuleFactory 内部）与 ~40 处领域 API 散点改走 `_commit`（`_emitChange` 保持原位）。**调用方签名零改动**（它们依旧调 addXxx/updateXxx/removeXxx）。
- **兜底纪律（防呆不丢数据）**：`_commit` 未覆盖的散点（漏网）→ `save()` 无脏集合时回落**全量写**（所有集合标脏）。漏收口 = 性能退化，**绝不丢数据**。
- save() 改造：序列化单元 = 脏集合集合（逐集合 `JSON.stringify`，与集合级缓存 `_colJson` 对比去重——替代整份 `_lastJson`）；`_pendingLocal` 整份 → `_pendingLocalCols`（集合→json 映射）。
- 落盘：LS 逐集合 key 写 + 全局 `STORAGE_META_KEY` 刷新（_meta 语义不变）；IDB 逐集合 key 写（串行队列延用，一个集合一个 put）。
- **写序不变量保持**：`_persistLocal`（集合级）→ `_idbWrite`（集合级），`_meta` 先于 entry.savedAt。
- `storageUsage()`：`_colJson` 长度求和（替代 `_lastJson.length`/`_encSize` 单值；加密态 = 各集合 bundle 长度求和）。

### 3. 读路径：逐集合合并 + legacy 迁移

- **loadIdb 改造**：`idbGetKeys(db)`（现有 `state` store 的 `getAllKeys`/`openCursor` 遍历）列出全部集合 key → 逐集合与 LS 对应 key 比较（`STORAGE_META_KEY > entry.savedAt` → 取 LS；IDB 缺该集合 → 取 LS；各集合独立判定）→ 解密（加密态）→ 合并进 defaultState → `_emitChange('all')`。局部缺失：单集合在 LS/IDB 均不存在 → 保底空数组/空对象（normalize 语义不变）。
- **legacy 迁移（一次性，幂等，回滚安全）**：检测 LS `sonder_data_v1` 存在 **或** IDB `state` key 存在 → 读整份（现 `_decryptParse` 逻辑复用）→ normalize → 逐集合写集合级（LS + IDB）→ **旧 key/entry 保留不删**（回滚安全：单笔 revert 后旧代码仍能读到整份旧数据；新旧同存一版本的窗口期）→ 迁移完成标记（LS `sonder_granular_v1='1'`）。重开判定：legacy 存在即重新拆分（put 幂等，覆盖半成品）。
- `_absorbNewer`（多标签让位）：逐集合读 LS 集合级 key（legacy 态走整份）→ 解密合并 → state 替换 → `_emitChange('all')`；`/store/yielded` 广播不变。
- `migrateToIdb`：逐集合写（锁定态守卫、加密态 _encSave 语义不变）。

### 4. 加密：集合级 bundle（每集合独立密文）

- 加密态写：`_encSave` 序列化单元 = 脏集合 → 每集合一个 AES-GCM bundle（`{e:1, v, iv, data}`），LS/IDB 同 payload 双写（队列、让位、盐协议全部延用）。
- 解锁/锁定：`_decryptParse` 逐集合跑（同一密钥不同 iv）；全局锁定语义不变（任一集合密文未解锁 → `_idbEncLocked`）；加密 UI 流程（设置页启停/密码/回读验证）**零变更**。
- 加密导出：`readSnapshot('any')` 合并全集合 → 整份 bundle（格式不变）。

### 5. 备份/导出/导入：格式整份不变

- `exportBackup()`：明文 = 逐集合合并后再 `JSON.stringify(state, null, 2)`（输出与现状逐字节结构一致）；加密 = 合并后整份 bundle（`BACKUP_ENC_FORMAT` 不变）。
- `importBackup()` / `_importEncBackup()`：parse → normalize → state 整份替换 → 全集合标脏落盘（save() 全量分支）→ `_emitChange('all')`。**既有备份文件双向兼容**（旧备份导入新架构 ✓；新备份导出回退旧版本读 ✓——因为导出格式未变）。
- 双写后端任一失败的降级/危机判定（hasPersistIssue/getStorageStatus/diagnostics）公式不变。

## 边界决策

- **版本号 version 并入 settings 集合**（不单独立 key）：version 是元数据，跟随最高频变动的设置一起走，避免 15 个 key 的边际无收益。
- **全局 meta 仍是单一份**（不逐集合 meta）：跨标签写锁协议（ADR-007）语义零变更——`_meta` 是全局版本基线，集合级 savedAt 判定是读路径内部细节。
- **旧整份 key 保留一整个版本周期**：迁移成功后不删（本方案不回滚性由「旧 key 保留」担保）；清理列为后续独立版本任务（ADR 记录）。
- **不做**：逐集合收藏/导出挑选、公共/私有集合分级、IDB 集合级 schemaVersion 独立——YAGNI，无 2-3 个模块重复需求。

## 行为原样保留清单（成功判据）

- 所有领域 API / 页面 / 搜索 / 统计 / 周报 / 游戏 / 设置读写 `state.<集合>` 的行为零变化（数据安全 > 性能，容量判定/isNearQuota 警示条正常）。
- 双写双存、IDB 优先主快照、LS 副本兜底、`_lastJson` 级去重的**等价语义**（实现在集合级缓存上）。
- 写锁让位、`/store/yielded`、`_lastSeenMeta` 基线协议不变。
- 加密启停/锁定/解锁/回读验证流程不变；加密导出导入格式不变。
- 备份导出导入往返兼容（明文+加密）。
- E2E「新建→刷新→还在」；harness seed 机制兼容（seed 写整份 → 启动迁移拆分 → 数据可用）。

## 已识别的差异点（如实记录）

- **性能收益**：单集合变更只序列化该集合（当前全量序列化全 14 集）；数据量大（数千条记录集中在某集合）时写盘体积显著下降。列表页高频路径（memo/tasks/designs 等）一次操作只写 1 个集合 + settings。
- **隔离收益**：单集合 LS/IDB 写失败不波及其他集合（现状一处配额失败 = 整份失败标记）；导入合并时单集合坏值被 normalize 兜底，不阻塞其余 13 集。
- **成本**：启动读路径从 1 次 IDB get → 遍历 14 个 key（+LS 14 次读合并）；迁移窗口期额外一次整份拆写。
- **测试脚**：凡字面量读 `sonder_data_v1` 的测试（encryption-ui/upgrade/enc-race/theme-auto/wallpaper/notification/harness seed）——
  - harness seed（写整份）**零改动自动兼容**（legacy 迁移路径）；
  - 断言"存储里是密文/明文"的测试改读集合级 key（断言对象从整份变 14 个 key，断言不变性，位置变）；
  - 断言"meta 协议/让位/写锁"的测试（store-write-lock 等）**协议不变应兼容**，逐项验证。

## 验证计划

- 全量 `npm test`：584 + 新增（不删旧判据；新增迁移/隔离/加密集合级/导入兼容契约测试若干）。
- `npm run typecheck` + `npm run lint` 零错误。
- `npm run test:e2e`：既有 5 项（002 阶段断言缓存 v47——sw.js 未动；004 文档批 sync-sw v47 → v48 后再断言 v48）。
- 新契约测试（拟）：
  1. legacy 拆分迁移（seed 整份 → 启动 → 14 个集合级 key 就位 + 旧 key 保留 + 数据逐集合正确）；
  2. 迁移幂等（半成品重跑覆盖）；
  3. 单集合损坏隔离（某集合 key 坏 JSON → 其余 13 集照常 → 坏集合保底空）；
  4. 集合级写后刷新持久化（改单集合 → 只该集合 key 变化）；
  5. 加密集合级（启用 → 各集合 key 为密文 → 解锁逐集合解密合并正确）；
  6. 旧备份导入（整份格式 → 集合级落盘 → 导出往返一致）；
  7. 写锁让位在集合级路径下复现（meta 不一致 → 吸收逐集合合并 → /store/yielded）。
- 真实 Chromium 冒烟（临时脚本，跑完即删）：legacy 数据 → 打开迁移 → 各模块新建/编辑/删除/撤销 → 加密启停 → **刷新持久化** → 导出备份文件结构核对。

## 提交计划（按层拆分，4 笔，任一阶段失败即停）

1. **001 方案文档**：`docs/plan-storage-key-granularity.md`（本文件，先行落库）。
2. **002 TrustLayer 核心**：`store.js` 注册表 + 集合级写/读/迁移/加密/备份改造 + `_commit` 收口 + 领域 API/工厂触发点适配 → 全量测试 → typecheck/lint → 新增契约测试。
3. **003 模块 config storageKey 激活**：八模块 `js/*.js` config `storageKey` 改 `sonder_col_<id>_v1` → 全量回归（行为零变化，纯声明）。
4. **004 文档同步**：`npm run sync-sw`（v47 → v48）→ ADR-009 决策 7 更新（已落地 + 本方案记录）+ ADR-011 追加 → CHANGELOG → AGENTS 基线（测试数/提交数/缓存 v48）→ PRD 缓存描述 v47 → v48 → 方案文档标注已完成。

## 回滚预案

- 任一批测试失败即停；单笔 `git revert` 即可——**旧整份 key 在迁移后保留**，回退到任意旧提交，旧代码照读 `sonder_data_v1`/IDB `state` key，数据零丢失（此为"旧 key 不删"的硬理由：AGENTS「失败绝不得覆盖原始数据」「严禁先删旧 key 再写新 key」）。
- 中途失败（迁移半成品）：legacy 仍存在 → 下次启动重新拆分（幂等覆盖）。
- 加密中途失败：bundle 逐集合独立，已写集合密文与未写集合旧密文并存——解锁路径按集合判定，半途状态可继续（解密失败集合保底空，不阻塞整页）；最坏情况回退旧版本，整份密文仍在 legacy key 中。