/* store-persistence.js - SonderStore 领域扩展：持久化/IDB·LS 读写核心
 * 浏览器：在 store.js 之后加载（接收 root.SonderStore.Store 与 _h）
 * Node：由 store.js 的 UMD 分支 require 并注入 (Store, _h)
 * 共享 helper 一律通过 _h 传入，不引用任何闭包外变量。
 * 说明：v6.x Phase 6 拆 store.js——持久化职责独立成文件（纯搬家，行为零变化）。
 * 加密落盘（_encSave/_encSaltExtra）与解密解析（_decryptParse）仍留 store.js（红线不动）。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else factory(root.SonderStore.Store, root.SonderStore._h);
})(typeof self !== 'undefined' ? self : this, function (Store, h) {
  'use strict';

  /* 副本快照（LS）setItem 批量防抖：放入 requestIdleCallback 执行，页面空闲时统一落盘。
   * 一次 idle 周期内多次保存只落最新内容（_pendingLocalCols 按集合合并覆盖），避免密集保存
   * 反复序列化写 localStorage 阻塞主线程。无 requestIdleCallback 的环境
   * （Node/测试/旧浏览器）同步落盘，保证存储一致性。
   * 加密盐/壁纸等一次性关键 setItem 保持同步（正确性优先，非热路径）。
   * map = {集合id: 序列化串}（明文或密文原样落盘）；key 需先于 _meta 刷新调用。 */
  Store.prototype._persistLocal = function (map) {
    if (!this._storage || !map) return;
    this._meta = h.nowISO();
    /* 按集合合并待写内容：后写覆盖先写（防抖合并，一次 idle 只落最新） */
    var target = this._pendingLocalCols;
    if (target === null || target === undefined) target = this._pendingLocalCols = {};
    for (var k in map) target[k] = map[k];
    if (this._localFlushHandle !== null) return; /* 已调度 idle：仅更新待写内容（防抖合并） */
    var self = this;
    if (typeof globalThis.requestIdleCallback === 'function') {
      this._localFlushHandle = globalThis.requestIdleCallback(function () {
        self._localFlushHandle = null;
        self._storeWrite(null, { ls: 'immediate', idb: 'skip' });
      }, { timeout: 900 });
    } else {
      this._doLocalFlush(); /* 无 idle API：同步落盘 */
    }
  };

  /* 让位：放弃本次旧快照覆盖，改为吸收 localStorage 中的最新 LS 快照（其他标签已写更新）。
   * 与被动收敛（_bindStorageWatch）共用 _absorbLocalSnapshot 核心；
   * 差异仅在：让位需先广播 /store/yielded（UI 弹"未保存修改已被放弃"提示）。 */
  Store.prototype._absorbNewer = function () {
    if (this._bus) this._bus.emit(h.dataEvent('yielded'));
    this._pendingLocalCols = null;
    this._absorbLocalSnapshot();
  };

  /* 吸收核心：逐集合读 LS 快照覆盖内存（解密失败集合保持现状），刷新基线并全量重绘。
   * legacy 态（无集合级 key）回落整份读取（等价旧行为）。 */
  Store.prototype._absorbLocalSnapshot = function () {
    var self = this;
    var map = null;
    if (this._storage) {
      map = this._readLocalColsRaw();
      if (Object.keys(map).length === 0) {
        /* legacy 态：整份读取（旧行为） */
        var raw0 = null;
        try { raw0 = this._storage.getItem(h.STORAGE_KEY); } catch (e) { raw0 = null; }
        if (raw0 === null || raw0 === undefined) return;
        this._decryptParse(raw0).then(function (parsed) {
          if (!parsed) return; /* 密文未解锁/解析失败：不覆盖也不吸收，保持现状 */
          self.state = h.normalize(parsed);
          self._colJson = {};
          self._rev++;
          if (self._storage) {
            try { self._lastSeenMeta = self._storage.getItem(h.STORAGE_META_KEY) || null; } catch (e) { /* 忽略 */ }
          }
          self._emitChange('all'); /* 采纳新快照：全量重绘 */
        });
        return;
      }
    }
    if (!map) return;
    var jobs = [];
    h.COLLECTIONS.forEach(function (id) {
      if (!map[id]) return;
      jobs.push(self._decryptParse(map[id]).then(function (parsed) {
        return { id: id, parsed: parsed };
      }));
    });
    Promise.all(jobs).then(function (results) {
      /* 集合级吸收：以当前内存为基座（保留本标签未被另一标签更新的集合），
       * 仅用另一标签已写（且本标签成功解密）的集合覆盖对应键；与整份吸收语义等价且不清空其他集合 */
      var base = h.deepClone(self.state);
      var any = false;
      results.forEach(function (r) {
        if (!r || !r.parsed) return; /* 解密失败集合：保持内存现状（不覆盖不清空） */
        h.mergeColInto(base, r.id, r.parsed);
        if (base[r.id] !== undefined) any = true;
      });
      if (!any) return;
      self.state = h.normalize(base);
      self._colJson = {};
      self._rev++;
      if (self._storage) {
        try { self._lastSeenMeta = self._storage.getItem(h.STORAGE_META_KEY) || null; } catch (e) { /* 忽略 */ }
      }
      self._emitChange('all'); /* 采纳新快照：全量重绘 */
    });
  };

  /* 跨标签被动收敛（P2）：另一标签写盘触发本标签 storage 事件。
   * 仅当本标签无待写内容时静默吸收（无未保存输入可丢），空闲后台标签不再无限期显示
   * 陈旧数据、放大让位丢失面；有待写内容则不吸收，交由下次 flush 的让位协议裁决。 */
  Store.prototype._bindStorageWatch = function () {
    var self = this;
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    this._boundStorageWatch = function (e) {
      try {
        if (!e || e.key !== h.STORAGE_META_KEY || e.newValue === null) return;
        if (self._pendingLocalCols) return; /* 本标签有未落盘编辑：让位协议裁决，不静默吸收 */
        if (self.needsUnlock()) return;     /* 锁定态：走解锁 UI 流程 */
        var cur = self._storage ? self._storage.getItem(h.STORAGE_META_KEY) : null;
        if (cur && cur !== self._lastSeenMeta) self._absorbLocalSnapshot();
      } catch (err) { /* 收敛失败保持现状：下次写入路径仍会让位兜底 */ }
    };
    window.addEventListener('storage', this._boundStorageWatch);
  };

  /* 实际写 localStorage（降级后备副本；写满只停副本停更，IndexedDB 主快照不受影响）。
   * 只写 _pendingLocalCols 最新内容（逐集合 key，与 _colJson 比较去重——同一值不重复写） */
  Store.prototype._doLocalFlush = function () {
    if (this._pendingLocalCols === null || this._pendingLocalCols === undefined) return;
    var map = this._pendingLocalCols;
    this._pendingLocalCols = null;
    try {
      for (var id in map) {
        var json = map[id];
        if (json === this._colJson[id]) continue; /* 已按该值落盘过：去重（等价整份 _lastJson 比较） */
        this._storage.setItem(h.colLsKey(id), json);
      }
      this._storage.setItem(h.STORAGE_META_KEY, this._meta);
      /* 全部 setItem 成功后再刷新内存缓存：中途配额失败不得把未落盘集合标成已写 */
      for (var id2 in map) this._colJson[id2] = map[id2];
      this._persistFailed = false;
      this._lastPersistError = null;
      this._statusReason = null;
      this._lastSeenMeta = this._meta; /* 多标签写锁基线：本实例已落盘到 LS 的版本（跨标签协议仍以 LS meta 为基线） */
    } catch (e) {
      /* 存储满（QuotaExceededError / NS_ERROR_DOM_QUOTA_REACHED）等错误：置副本失败标记。
       * 数据仍在内存与 IndexedDB 主快照侧；仅当主快照也不可用时 hasPersistIssue() 指挥 UI 提示导出 */
      this._persistFailed = true;
      this._lastPersistError = e;
      this._statusReason = h.classifyFailReason(e);
    }
  };

  /* 立即执行待写内容并作废已调度的 idle 写入。加密启用/停用/回读验证等
   * 正确性关键路径调用（这些路径依赖落盘与后续读取在同一时机）。 */
  Store.prototype.flushPersist = function () {
    if (this._localFlushHandle !== null) {
      if (typeof globalThis.cancelIdleCallback === 'function') globalThis.cancelIdleCallback(this._localFlushHandle);
      this._localFlushHandle = null;
    }
    if (this._pendingLocalCols !== null && this._pendingLocalCols !== undefined) this._doLocalFlush();
  };

  /* 异步写 IndexedDB（主快照，真源，逐集合 key）。串行队列避免事务竞争；失败静默（localStorage 副本仍兜底）。
   * 只接受调用方显式传入的原始串 map（明文或密文格式原样落盘，{集合id: 串}），extra 合并进 entry（如加密盐）。
   * undefined/null/空 map 一律跳过——绝不回退到内存 state 序列化：锁定态下内存是明文空
   * defaultState，回退写盘会把明文空数据写进 IDB，破坏密文主快照（loadIdb 空 IDB 回填路径）。 */
  /* --- IDB 主快照层 --- */
  Store.prototype._idbWriteCols = function (map, extra) {
    if (!h.idbAvailable() || !map) return;
    var meta = this._meta || h.nowISO();
    var prev = this._idbPromise || Promise.resolve();
    var self = this;
    this._idbPromise = prev.then(function () {
      return h.openIdb().then(function (db) {
        var jobs = [];
        for (var id in map) {
          jobs.push(h.idbPut(db, id, Object.assign({}, extra || {}, { savedAt: meta, data: map[id] })));
        }
        return Promise.all(jobs);
      });
    }).then(function () {
      self._idbFailed = false; /* 主快照写入成功：解除 IDB 侧失败标记 */
    }).catch(function (err) {
      /* IDB 主快照写入失败：localStorage 副本仍兜底（数据安全），记失败标记并上报便于发现环境问题 */
      self._idbFailed = true;
      if (!self._statusReason) self._statusReason = 'indexeddb_write_failed';
      try { (window.__sonderErrors && window.__sonderErrors.report) ? window.__sonderErrors.report(err, 'warning') : console.error('[Sonder] IndexedDB 写入失败', err); } catch (e) { /* 忽略 */ }
    });
  };

  /* 序列化某集合为 payload 串并与 _colJson 比较：变 → 返回串；未变/非法 → null（零序列化承诺的去重单元） */
  Store.prototype._colPayloadJson = function (id) {
    var payload;
    try { payload = h.colPayload(this.state, id); } catch (e) { return null; }
    if (payload === undefined || payload === null) return null;
    var json = JSON.stringify(payload);
    if (json === this._colJson[id]) return null;
    return json;
  };
  /* 全量序列化：逐集合与缓存比较，返回变更 map（全部未变 → null） */
  Store.prototype._collectAll = function () {
    var map = null;
    for (var i = 0; i < h.COLLECTIONS.length; i++) {
      var json = this._colPayloadJson(h.COLLECTIONS[i]);
      if (json !== null) {
        if (!map) map = {};
        map[h.COLLECTIONS[i]] = json;
      }
    }
    return map;
  };
  /* 全量序列化（不去重）：强制返回全部注册集合 map（加解密切换/迁移/导入等需全量场景） */
  Store.prototype._collectAllRaw = function () {
    var map = {};
    for (var i = 0; i < h.COLLECTIONS.length; i++) {
      try {
        var payload = h.colPayload(this.state, h.COLLECTIONS[i]);
        if (payload === undefined || payload === null) continue;
        map[h.COLLECTIONS[i]] = JSON.stringify(payload);
      } catch (e) { /* 单集合序列化失败：跳过该集合（其余继续） */ }
    }
    return map;
  };

  /* --- 写入协调 --- */
  Store.prototype.save = function () {
    var map = this._collectAll();
    if (!map) return; /* 全集合与最近落盘一致：零序列化零 IO */
    /* 锁定态守卫：快照为密文但无会话密钥时禁止明文落盘——
     * 锁定后残留的定时器/异步回调若触发 save，明文会覆盖密文并静默解除加密 */
    if (this.needsUnlock()) return;
    this._rev++;
    if (this._encKey) {
      this._encSave(map).catch(function (err) {
        /* 加密写盘失败：下次 save 会重试；上报便于发现（数据仍在上次持久化版本） */
        try { (window.__sonderErrors && window.__sonderErrors.report) ? window.__sonderErrors.report(err, 'warning') : console.error('[Sonder] 加密持久化失败', err); } catch (e) { /* 忽略 */ }
      });
      return;
    }
    /* 双写（ADR-014 真源反转）：_persistLocal 先合并待写并盖 _meta（版本基线），
     * 随后 _storeWrite 以同一 savedAt 落 IDB 主快照；LS 副本由 idle 防抖消费
     * （物理顺序：IDB 先、LS 后——真源先行，副本兜底，任一侧失败另一侧兜底）。 */
    this._persistLocal(map);
    this._storeWrite(map, { ls: 'skip', idb: 'write' });
  };

  /* 集合级变更收口（ADR-009 决策 7 的写路径唯一入口之一）：
   * 只序列化+落盘指定集合；非法集合 id 回落全量 save（防呆兜底——绝不丢数据）。
   * 与 save() 等价语义：内容未变 → 零 IO；锁定态拒绝明文落盘。 */
  Store.prototype._commit = function (col) {
    if (typeof col !== 'string' || h.COLLECTIONS.indexOf(col) < 0) {
      this.save(); /* 未收口集合：全量兜底（性能退化，绝不丢数据） */
      return;
    }
    var json = this._colPayloadJson(col);
    if (json === null) return; /* 该集合与最近落盘一致：零序列化零 IO */
    if (this.needsUnlock()) return;
    this._rev++;
    var map = {};
    map[col] = json;
    if (this._encKey) {
      this._encSave(map).catch(function (err) {
        try { (window.__sonderErrors && window.__sonderErrors.report) ? window.__sonderErrors.report(err, 'warning') : console.error('[Sonder] 加密持久化失败', err); } catch (e) { /* 忽略 */ }
      });
      return;
    }
    this._persistLocal(map);
    this._storeWrite(map, { ls: 'skip', idb: 'write' });
  };

  /* ====== 唯一落盘收口点（ADR-013）======
   * 锁内固定序列：① meta 让位检查 → ② LS 相位 → ③ IDB 相位。
   * 全部写路径（save/_commit 防抖flush、_encSave 密文、模式切换、迁移、导入）
   * 一律经此函数；协议参与由结构保证，不再靠调用方自觉。
   *
   * @param map {{集合id: 串}} 明文或密文原样（LS 与 IDB 同内容同序）
   * @param opts {{ls?: 'immediate'|'skip', idb?: 'write'|'skip', extra?: Object}}
   *   ls='immediate'：把 map 并入待写后立即 _doLocalFlush（去重/配额分类/基线刷新全复用）
   *   idb='write'：锁内写 IDB 主快照（extra 如盐随 entry 落盘）
   * @returns {Promise<boolean>} true=已落盘 false=已让位吸收
   * 无锁环境：顺序直执行各相位并 resolve(true)（保持既有同步语义兼容）。 */
  /* ==================== TrustLayer: 写锁收口（ADR-013）==================== */
  Store.prototype._storeWrite = function (map, opts) {
    var self = this;
    opts = opts || {};
    var doLS = opts.ls === 'immediate';
    var doIDB = opts.idb === 'write';
    function runPhases() {
      /* Phase ④（ADR-014）物理写序反转：主快照 IDB 先行，LS 副本随后。
       * 两相位共用同一 _meta（同批同戳），真源先落、副本兜底。 */
      var hasContent = map && Object.keys(map).length > 0;
      if (doLS && hasContent) {
        /* 并入待写 + 设定 _meta 基线并作废已调度 idle（立即相位，仅合并不落盘） */
        self._persistLocal(map);
        if (self._localFlushHandle !== null && typeof globalThis.cancelIdleCallback === 'function') {
          globalThis.cancelIdleCallback(self._localFlushHandle);
        }
        self._localFlushHandle = null;
      }
      if (doIDB) self._idbWriteCols(map || {}, opts.extra);
      /* 空调用（纯 flush 场景）：只消费既有待写，不重盖时间戳 */
      if (doLS) self._doLocalFlush();
    }

    var locks = (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function')
      ? navigator.locks : null;
    if (!locks) { runPhases(); return Promise.resolve(true); }
    return new Promise(function (resolve) {
      var done = false;
      var fallback = function () { if (done) return; done = true; runPhases(); resolve(true); };
      var p = null;
      try {
        p = locks.request('sonder-writer', function () {
          if (self._storage) {
            var curMeta = null;
            try { curMeta = self._storage.getItem(h.STORAGE_META_KEY); } catch (e) { curMeta = null; }
            /* 他标签已写更新快照：让位吸收，两相位全跳过 */
            if (curMeta && curMeta !== self._lastSeenMeta) {
              done = true;
              self._absorbNewer();
              resolve(false);
              return;
            }
          }
          done = true;
          runPhases();
          resolve(true);
        });
        if (p && typeof p.catch === 'function') p.catch(fallback);
      } catch (e) { fallback(); }
    });
  };

  /* 加密态拆分迁移的 LS 侧落盘（_encSave 已写 IDB；此处补 LS 密文） */
  Store.prototype._persistLocalColsSync = function (map) {
    if (!this._storage) return Promise.resolve();
    this._meta = h.nowISO();
    try {
      for (var id in map) this._storage.setItem(h.colLsKey(id), map[id]);
      this._storage.setItem(h.STORAGE_META_KEY, this._meta);
      this._lastSeenMeta = this._meta;
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  };

  /* 明文 JSON 有效性探测（损坏自愈用）：解析失败或非对象 = 无效原文。
   * 密文 bundle（e:1）不在此判定——未解锁/解密失败由解密路径处理，不视为明文损坏。 */
  function plainJsonOk(raw) {
    if (typeof raw !== 'string') return false;
    try {
      var p = JSON.parse(raw);
      return p !== null && typeof p === 'object';
    } catch (e) { return false; }
  }
  h.plainJsonOk = plainJsonOk; /* 供同文件方法引用（_loadColsMerge 内调用） */

  /* 逐集合合并（LS vs IDB 取新）。返回 null（两端全空）或
   * {state, fromIdb, lsRaw, idbRaw}（lsRaw/idbRaw 为回填用原文映射）。
   * 解密失败/密文未解锁的集合：不合并（保底空）、不落盘、不覆盖（数据留在原处）。
   * 密文集合探测到锁定 → _idbEncLocked = true。 */
  Store.prototype._loadColsMerge = function (db, tiePreferLS) {
    var self = this;
    var lsMeta = null;
    if (this._storage) {
      try { lsMeta = this._storage.getItem(h.STORAGE_META_KEY); } catch (e) { lsMeta = null; }
    }
    var jobs = h.COLLECTIONS.map(function (id) {
      var lsRaw = null;
      if (self._storage) {
        try { lsRaw = self._storage.getItem(h.colLsKey(id)); } catch (e) { lsRaw = null; }
      }
      return h.idbGet(db, id).then(function (entry) {
        var idbRaw = (entry && typeof entry === 'object' && !Array.isArray(entry)) ? entry.data : entry;
        var idbSavedAt = (entry && typeof entry === 'object' && !Array.isArray(entry)) ? entry.savedAt : '';
        var useRaw = null;
        var fromIdb = false;
        /* 损坏探测（P2 自愈）：明文 JSON 解析失败 = 该侧原文无效。
         * 密文 bundle 交由解密路径判定（未解锁≠损坏，绝不在此侧淘汰）。 */
        var lsBad = lsRaw !== null && lsRaw !== undefined && !plainJsonOk(lsRaw);
        var idbBad = idbRaw !== null && idbRaw !== undefined && !plainJsonOk(idbRaw);
        /* Phase ④ 真源反转：IDB = Primary。两侧有效时 IDB 在"同刻或更新"即胜出
         * （>= 而非旧的 >），LS 仅在严格更新或 IDB 缺失/损坏时接管。
         * 同批双写两侧内容一致，平局取 IDB 无数据差异；LS 仍承担跨标签信号通道
         * （storage 事件/写锁基线）与降级副本角色（ADR-014）。 */

        var idbPreferred = !!idbSavedAt && (!lsMeta || (tiePreferLS ? idbSavedAt > lsMeta : idbSavedAt >= lsMeta));
        if (lsBad && !idbBad && idbRaw !== null && idbRaw !== undefined) {
          useRaw = idbRaw;
          fromIdb = true;
        } else if (!lsBad && idbBad) {
          useRaw = lsRaw;
        } else if (!idbPreferred && lsRaw !== null && lsRaw !== undefined) {
          useRaw = lsRaw;
        } else if ((idbPreferred || lsRaw === null || lsRaw === undefined) && idbRaw !== null && idbRaw !== undefined) {
          useRaw = idbRaw;
          fromIdb = true;
        }
        return { id: id, useRaw: useRaw, fromIdb: fromIdb, lsRaw: lsRaw, idbRaw: idbRaw, lsBad: lsBad, idbBad: idbBad };
      });
    });
    return Promise.all(jobs).then(function (results) {
      var base = h.defaultState();
      var lsRaw = {}, idbRaw = {};
      var corruptLs = {}, corruptIdb = {};
      var any = false, anyFromIdb = false, anyLocked = false, hasExtra = false;
      var decJobs = [];
      results.forEach(function (r) {
        if (r.lsRaw !== null && r.lsRaw !== undefined) { lsRaw[r.id] = r.lsRaw; if (r.lsBad) corruptLs[r.id] = true; }
        if (r.idbRaw !== null && r.idbRaw !== undefined) { idbRaw[r.id] = r.idbRaw; if (r.idbBad) corruptIdb[r.id] = true; }
        if (h.EXTRA_COLLECTIONS.indexOf(r.id) >= 0 && (r.lsRaw !== null || r.idbRaw !== null)) hasExtra = true;
        if (r.useRaw === null || r.useRaw === undefined) return;
        any = true;
        if (r.fromIdb) anyFromIdb = true;
        decJobs.push(self._decryptParse(r.useRaw).then(function (parsed) {
          return { id: r.id, parsed: parsed, raw: r.useRaw };
        }));
      });
      if (!any) return null;
      return Promise.all(decJobs).then(function (dec) {
        dec.forEach(function (d) {
          if (!d.parsed) {
            if (h.isEncRaw(d.raw)) anyLocked = true; /* 密文未解锁：锁定态标记（数据原样保留） */
            return;
          }
          h.mergeColInto(base, d.id, d.parsed);
        });
        if (anyLocked) self._idbEncLocked = true;
        /* locked 供 loadIdb 判定：存在未解锁密文集合 → 不得报告"已采用 IDB 数据"
         * （采用语义是"数据已入内存可用"；未解锁需走锁屏流，needsUnlock 兜底） */
        return { state: base, fromIdb: anyFromIdb, lsRaw: lsRaw, idbRaw: idbRaw, hasExtra: hasExtra, locked: anyLocked, corruptLs: corruptLs, corruptIdb: corruptIdb };
      });
    });
  };

  /* 缺口回填：LS 缺/损坏的集合 ← IDB 原文；IDB 缺/损坏的集合 ← LS 原文
   * （明文/密文原样复制，不转换不解密）。损坏侧覆盖修复 = 集合"显示为空且永不自愈"的根治。 */
  Store.prototype._backfillCols = function (db, merged) {
    var self = this;
    var cl = merged.corruptLs || {};
    var ci = merged.corruptIdb || {};
    if (this._storage) {
      for (var id in merged.idbRaw) {
        if (ci[id]) continue; /* IDB 侧自身损坏：不可作为修复源 */
        if (!merged.lsRaw[id] || cl[id]) {
          try { this._storage.setItem(h.colLsKey(id), merged.idbRaw[id]); } catch (e) { /* LS 回填失败：IDB 仍在 */ }
        }
      }
    }
    var idbJobs = [];
    for (var id2 in merged.lsRaw) {
      if (cl[id2]) continue; /* LS 侧自身损坏：不可作为修复源 */
      if (!merged.idbRaw[id2] || ci[id2]) {
        idbJobs.push(h.idbPut(db, id2, { savedAt: self._meta || h.nowISO(), data: merged.lsRaw[id2] }));
      }
    }
    Promise.all(idbJobs).catch(function () { /* 回填失败：数据仍在另一侧，下次启动重试 */ });
  };
});
