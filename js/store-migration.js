/* store-migration.js - SonderStore 领域扩展：legacy 拆分迁移 + IDB 读取
 * 浏览器：在 store.js 之后加载（接收 root.SonderStore.Store 与 _h）
 * Node：由 store.js 的 UMD 分支 require 并注入 (Store, _h)
 * 共享 helper 一律通过 _h 传入，不引用任何闭包外变量。
 * 说明：v6.x Phase 6 拆 store.js——迁移职责独立成文件（纯搬家，行为零变化）。
 * 依赖的持久化方法（_loadColsMerge/_backfillCols）在 store-persistence.js（实例调用）；
 * 加密落盘（_encSave/_decryptParse）留 store.js（红线不动）。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else factory(root.SonderStore.Store, root.SonderStore._h);
})(typeof self !== 'undefined' ? self : this, function (Store, h) {
  'use strict';

  /* 启动时调用：优先从 IndexedDB 恢复（逐集合按 savedAt 取新，LS meta 为版本基线）。
   * 集合级读路径：对每个注册集合比较 LS 原文与 IDB entry（LS 存在且 (IDB 缺 或 LS meta 更新) → 取 LS；
   * 否则取 IDB）→ 逐集合解密合并 → state 替换 → 缺口回填（LS 缺从 IDB 补、IDB 缺从 LS 补，原文不转换）。
   * legacy 整份（LS STORAGE_KEY / IDB 'state'）存在且未集合化 → 先一次性拆分迁移（旧 key 保留不删）。
   * 返回 Promise<是否采用持久化数据需重绘>：IDB 数据被采用（任一集合来自 IDB 且 state 变更）→ true；
   * 仅 LS 数据（构造期已同步合并）→ false（等价旧行为：不重绘）。 */
  Store.prototype.loadIdb = function () {
    var self = this;
    if (!h.idbAvailable()) return Promise.resolve(false);
    return h.openIdb().then(function (db) {
      var mergedRes = self._migrateLegacyIfNeeded(db).then(function (justSplit) {
        /* ADR-014 引导期豁免：刚完成 legacy 拆分的这一次合并，平局仍取 LS——
         * split 回声两侧内容恒等，且首次安装不应误报"采用 IDB"触发全量重绘。
         * 稳态（非本次拆分）冲突一律 IDB 优先。 */
        return self._loadColsMerge(db, justSplit === true).then(function (merged) {
          if (!merged) return false; /* 全新库：两端均无集合级数据 */
          self.state = h.normalize(merged.state);
          self._colJson = {};
          self._rev++;
          self._backfillCols(db, merged);
          /* 恢复采用：IDB 数据被采用，或存在构造期后注册集合（工厂模块）的数据
           * 逐集合合并首次并入 → 需全量重绘；纯 CORE 集合的 LS 数据构造期已同步吸收并渲染 → 不重绘（等价旧行为）
           * 密文未解锁（merged.locked）：不采用（needsUnlock 走锁屏流），绝不按明文合并 */
          if (merged.fromIdb || merged.hasExtra) self._emitChange('all');
          return merged.fromIdb && !merged.locked;
        });
      });
      /* C-7：无论数据合并结果如何，都恢复自定义壁纸（IDB 优先；LS 遗留自动迁移）。
       * 等待完成再 resolve，保证首帧渲染前 getCustomWallpaper 已就绪、无壁纸闪烁。 */
      return mergedRes.then(function (adopted) {
        return self._restoreCustomWallpaper(db).then(function () { return adopted; });
      });
    }).catch(function () { return false; });
  };

  /* legacy 整份是否待迁移（LS STORAGE_KEY 或 IDB 'state' 存在，且未置集合化标记） */
  /* 一次性拆分迁移（幂等，put 语义覆盖半成品；旧 key/entry 保留不删——回滚安全）。
   * 明文整份：逐集合写 LS + IDB；加密已解锁：逐集合加密写（集合级密文）；未解锁：不迁移（保留整份，
   * 解锁路径 unlock 后全量密文落盘自然完成集合化）。迁移完成置 GRANULAR_FLAG。 */
  Store.prototype._migrateLegacyIfNeeded = function (db) {
    var self = this;
    var flag = false;
    if (this._storage) {
      try { flag = !!this._storage.getItem(h.GRANULAR_FLAG); } catch (e) { flag = false; }
    }
    if (flag) return Promise.resolve(false);
    var lsRaw = null;
    if (this._storage) {
      try { lsRaw = this._storage.getItem(h.STORAGE_KEY); } catch (e) { lsRaw = null; }
    }
    return h.idbGet(db, h.IDB_KEY).then(function (entry) {
      if (!lsRaw && !entry) return false; /* 无 legacy 来源 */
      return self._splitLegacy(lsRaw, entry).then(function () { return true; });
    });
  };
  /* 拆分整份 legacy（lsRaw / idbEntry 至多其一非空；两者都有时取更新者——LS meta 更新取 LS，否则 IDB）。
   * 返回 Promise；迁移失败（密文未解锁等）静默跳过——数据仍在 legacy key，解锁后由 unlock 完成集合化。 */
  Store.prototype._splitLegacy = function (lsRaw, idbEntry) {
    var self = this;
    var useRaw = lsRaw;
    if (idbEntry) {
      var idbData = (idbEntry && typeof idbEntry === 'object' && !Array.isArray(idbEntry)) ? idbEntry.data : idbEntry;
      if (!lsRaw) {
        useRaw = idbData;
      } else {
        var idbSavedAt = (idbEntry && typeof idbEntry === 'object' && !Array.isArray(idbEntry)) ? idbEntry.savedAt : '';
        var lsMeta = null;
        try { lsMeta = this._storage ? this._storage.getItem(h.STORAGE_META_KEY) : null; } catch (e) { lsMeta = null; }
        /* 取更新者：仅当 IDB savedAt 严格大于 LS meta 才用 IDB（相等/缺 meta → LS）。
         * ADR-014 注：此处为构造期一次性 legacy 引导，刻意维持保守平局规则——
         * 引导期两侧同源且存在异步时序窗；真源反转（平局取 IDB）只适用于
         * 稳态集合级合并 _loadColsMerge。 */
        if (!(idbSavedAt && lsMeta && idbSavedAt > lsMeta)) useRaw = lsRaw;
      }
    }
    if (!useRaw) return Promise.resolve();
    return this._decryptParse(useRaw).then(function (parsed) {
      if (!parsed) {
        /* 密文未解锁/解析失败：不迁移（数据在 legacy key 原样保留） */
        return;
      }
      var state = h.normalize(parsed);
      var map = null;
      for (var i = 0; i < h.COLLECTIONS.length; i++) {
        var id = h.COLLECTIONS[i];
        var payload;
        try { payload = h.colPayload(state, id); } catch (e) { continue; }
        if (payload === undefined || payload === null) continue;
        var json = JSON.stringify(payload);
        if (!map) map = {};
        map[id] = json;
      }
      if (!map) { self._markGranular(); return; }
      if (self._encKey) {
        /* 加密已解锁：_encSave 已按集合密文双写（含即时 flush），切勿再用明文 map 覆盖 LS */
        return self._encSave(map).then(function () {
          self._markGranular();
        });
      }
      /* 明文：先 LS 后 IDB（写序不变量），即时完成（不经防抖，迁移窗口一次性） */
      self._meta = h.nowISO();
      try {
        for (var id2 in map) self._storage.setItem(h.colLsKey(id2), map[id2]);
        if (self._storage) self._storage.setItem(h.STORAGE_META_KEY, self._meta);
        self._lastSeenMeta = self._meta;
      } catch (e) { /* LS 迁移写失败：IDB 仍写（主快照兜底） */ }
      return h.openIdb().then(function (db) {
        var jobs = [];
        for (var id3 in map) jobs.push(h.idbPut(db, id3, { savedAt: self._meta, data: map[id3] }));
        return Promise.all(jobs);
      }).then(function () {
        self._markGranular();
      }).catch(function () { /* IDB 迁移写失败：LS 副本兜底 */ });
    });
  };
  /* 迁移完成标记（LS；旧 key 保留不删） */
  Store.prototype._markGranular = function () {
    if (!this._storage) return;
    try { this._storage.setItem(h.GRANULAR_FLAG, '1'); } catch (e) { /* 忽略 */ }
  };

  /* 手动迁移：立即把当前全部数据写入 IndexedDB（只复制不删旧数据，等价旧行为抛去"全量"语义） */
  Store.prototype.migrateToIdb = function () {
    if (!h.idbAvailable()) return Promise.resolve(false);
    /* 锁定态守卫：内存是明文空 defaultState，序列化直写会以明文空数据覆盖 IDB 密文主快照 */
    if (this.needsUnlock()) return Promise.resolve(false);
    /* 全量强制（不去重）：迁移必须保证 IDB 主快照齐备 */
    var map = null;
    for (var i = 0; i < h.COLLECTIONS.length; i++) {
      var json = this._colPayloadJson(h.COLLECTIONS[i]);
      if (json === null) {
        try { json = JSON.stringify(h.colPayload(this.state, h.COLLECTIONS[i])); } catch (e) { json = null; }
        if (json === null || json === undefined) continue;
      }
      if (!map) map = {};
      map[h.COLLECTIONS[i]] = json;
    }
    if (!map) return Promise.resolve(false);
    this._meta = h.nowISO();
    if (this._encKey) {
      /* 加密态：IDB 主快照必须与 LS 副本同为密文（走 _encSave 双写），不得写入内存明文 */
      return this._encSave(map).then(function () { return true; }).catch(function () { return false; });
    }
    /* ADR-013：明文迁移经收口点（旧实现自开 idbPut 事务绕过串行队列与让位协议）。
     * 让位语义：他标签已写更新快照时返回 false——迁移不得以陈旧全量覆盖新数据。 */
    return this._storeWrite(map, { ls: 'immediate', idb: 'write' }).then(function (w) { return !!w; }).catch(function () { return false; });
  };
});
