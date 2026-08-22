# ADR-013: TrustLayer 写路径统一收口（_storeWrite）

- 状态：已采纳
- 日期：2026-08-22
- 关联：ADR-002（存储分层）、ADR-007（多标签写锁）、ADR-009（集合级持久化）

## 背景

让位协议（他标签已写更新快照时不覆盖）最初只在加密路径实现；审计发现明文 IDB 写绕过协议导致多标签并发丢数据（已修，`_lockedIdbWrite`）。但修复后全项目仍有 **6 种落盘形态 / 4 处绕过点**：`_encSave` 锁外写 IDB（竞态窗）、enableEncryption 异常兜底直写、disableEncryption 直写、migrateToIdb 自开事务。协议参与靠调用方自觉，每加一条写路径都要人工对齐全部规则——该设计在第二次犯同类错误前必须结构性纠正。

## 决策

新增唯一落盘收口点 `Store.prototype._storeWrite(map, opts)`：

```
锁内固定序列（'sonder-writer'）：
  ① meta 让位检查 —— 他标签已写更新 → 吸收(_absorbNewer) + resolve(false)
  ② LS 相位（opts.ls='immediate'）—— map 并入待写 + 盖 _meta + 作废 idle + _doLocalFlush
     （空调用 = 纯 flush：只消费待写、不重盖时间戳，保住 LS meta == IDB savedAt 配对语义）
  ③ IDB 相位（opts.idb='write'）—— _idbWriteCols 在锁内执行（消除旧密文路径锁外竞态窗）
无锁环境：顺序直执行各相位（保持既有同步语义兼容），resolve(true)
返回 Promise<boolean>：true=已落盘 false=已让位吸收
```

全部写路径迁入：save/_commit（防抖+IDB 相位）、idle flush（LS 相位）、_encSave 链尾（双相位+盐）、disableEncryption/enableEncryption 兜底/migrateToIdb 明文分支（原三处绕过点补齐协议）。三个旧 wrapper 删除。`flushPersist` 语义保留（作废 idle + 立即 LS）。

## 结构防绕出门禁

`tests/store-write-unified.test.js` 静态清点测试：扫描 store.js 源码断言 `_idbWriteCols(` 仅允许出现在 `_storeWrite` 函数体内——未来任何绕过收口点的直调将直接挂 CI。

## 后果

- 正面：新写路径自动继承全部并发协议；净删约 120 行重复锁样板；migrateToIdb/disableEncryption 获得此前缺失的让位保护。
- 取舍：migrateToIdb 在他标签更新时返回 false（迁移不覆盖新数据——语义收紧并记录）；disableEncryption 让位后写入的是"吸收合并态"的明文（数据零丢失，测试以语义断言看护）。
- 为 Phase ④（IndexedDB 优先写）铺平：④ 只需改 `_storeWrite` 内部相位顺序与 savedAt 策略，不再触碰任何调用方。
