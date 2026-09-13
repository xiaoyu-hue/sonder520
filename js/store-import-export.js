/* store-import-export.js - SonderStore 领域扩展：备份导出/导入/清空
 * 浏览器：在 store.js 之后加载（接收 root.SonderStore.Store 与 _h）
 * Node：由 store.js 的 UMD 分支 require 并注入 (Store, _h)
 * 共享 helper 一律通过 _h 传入，不引用任何闭包外变量。
 * 说明：v6.x Phase 6 拆 store.js——导入导出职责独立成文件（纯搬家，行为零变化）。
 * 加密快照辅助（_verifySnapshotIntegrity/_decryptSnapshotKey/_collectSnapshotRaw）与
 * 加密落盘（_encSave）留 store.js（红线不动），经 this 调用。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else factory(root.SonderStore.Store, root.SonderStore._h);
})(typeof self !== 'undefined' ? self : this, function (Store, h) {
  'use strict';

  /* 读取当前持久化快照（加密则需已解锁）：source = 'local' | 'idb' | 'any'。
   * 集合级逐集合解密合并（defaultState 基底）；无集合级 → legacy 整份回落。
   * 返回解析后的 state 对象或 null（读取/解密失败一律 null，绝不抛出覆盖调用方）。 */
  Store.prototype.readSnapshot = function (source) {
    var self = this;
    function readLocal() {
      var lsMap = self._readLocalColsRaw();
      if (Object.keys(lsMap).length === 0) {
        /* legacy 整份回落 */
        if (!self._storage) return Promise.resolve(null);
        var legacy = null;
        try { legacy = self._storage.getItem(h.STORAGE_KEY); } catch (e) { legacy = null; }
        if (!legacy) return Promise.resolve(null);
        return self._decryptParse(legacy);
      }
      var base = h.defaultState();
      var mergedAny = false;
      var hasEnc = false;
      var jobs = [];
      for (var id in lsMap) {
        if (h.isEncRaw(lsMap[id])) hasEnc = true;
        jobs.push(self._decryptParse(lsMap[id]).then(function (col, dec) {
          if (!dec || typeof dec !== 'object') return;
          h.mergeColInto(base, col, dec);
          mergedAny = true;
        }.bind(null, id)));
      }
      return Promise.all(jobs).then(function () {
        /* 全密文解密失败 → null（区别于"无数据"，防止误判解锁/停用成功） */
        if (!mergedAny && hasEnc) return null;
        return base;
      });
    }
    function readIdb() {
      if (!h.idbAvailable()) return Promise.resolve(null);
      return h.openIdb().then(function (db) {
        var jobs = h.COLLECTIONS.map(function (id) {
          return h.idbGet(db, id).then(function (entry) {
            if (!entry) return null;
            return { id: id, raw: (entry && typeof entry === 'object' && !Array.isArray(entry)) ? entry.data : entry };
          });
        });
        return Promise.all(jobs).then(function (results) {
          var have = false;
          results.forEach(function (r) { if (r) have = true; });
          if (!have) {
            /* legacy 整份回落 */
            return h.idbGet(db, h.IDB_KEY).then(function (entry) {
              if (!entry) return null;
              var data = (entry && typeof entry === 'object' && !Array.isArray(entry)) ? entry.data : entry;
              return self._decryptParse(data);
            });
          }
          var base = h.defaultState();
          var mergedAny = false;
          var hasEnc = false;
          var decJobs = [];
          results.forEach(function (r) {
            if (!r) return;
            if (h.isEncRaw(r.raw)) hasEnc = true;
            decJobs.push(self._decryptParse(r.raw).then(function (dec) {
              if (!dec || typeof dec !== 'object') return;
              h.mergeColInto(base, r.id, dec);
              mergedAny = true;
            }));
          });
          return Promise.all(decJobs).then(function () {
            /* 全密文解密失败 → null（区别于"无数据"，防止误判解锁/停用成功） */
            if (!mergedAny && hasEnc) return null;
            return base;
          });
        });
      }).catch(function () { return null; });
    }
    if (source === 'local') return readLocal();
    if (source === 'idb') return readIdb();
    return readLocal().then(function (dec) {
      if (dec) return dec;
      return readIdb();
    });
  };

  /* ====== 通用 ====== */
  Store.prototype.clearAll = function () {
    this.state = h.defaultState();
    this.save();
    this._emitChange('all'); /* 清空全量数据：各页重绘 */
  };

  /* ====== 导出 / 导入 ======
   * 明文模式：导出完整明文 JSON（同步字符串）。
   * 加密模式：导出密文备份包 { format, salt, iv, data }（不包含密码；导入需密码），异步 Promise。 */
  Store.prototype.exportBackup = function () {
    var self = this;
    if (!this.needsUnlock() && !this._encKey) return JSON.stringify(this.state, null, 2);
    if (this.needsUnlock() && !this._encKey) return Promise.reject(new Error('需要解锁后才能导出加密备份'));
    var salt = this._encSalt();
    if (!salt) return Promise.reject(new Error('盐缺失，无法导出加密备份'));
    return this.readSnapshot('any').then(function (dec) {
      if (dec) return Promise.resolve(dec);
      return Promise.reject(new Error('当前快照无法读取，导出中止'));
    }).then(function (dec) {
      if (!self._encKey) return Promise.reject(new Error('需要解锁后才能导出'));
      return h.Crypto.encryptText(JSON.stringify(dec), self._encKey).then(function (bundle) {
        return JSON.stringify({ format: h.BACKUP_ENC_FORMAT, salt: h.Crypto.bytesToB64(salt), iv: bundle.iv, data: bundle.data }, null, 2);
      });
    });
  };
  /* 导入：明文备份同步完成；加密备份需 password。统一返回 Promise<{ok, error?}>
   * 加密模式下导入必须保持密文落盘；锁定态拒绝导入（防止明文覆盖密文） */
  Store.prototype.importBackup = function (jsonStr, password) {
    var parsed;
    try { parsed = JSON.parse(jsonStr); } catch (e) { return Promise.resolve({ ok: false, error: '文件不是有效的 JSON' }); }
    if (parsed && parsed.format === h.BACKUP_ENC_FORMAT) return this._importEncBackup(parsed, password);
    if (!h.isPlainObject(parsed) || typeof parsed.version !== 'number') {
      return Promise.resolve({ ok: false, error: '文件缺少必要字段(version)，无法识别为备份文件' });
    }
    if (this.needsUnlock()) return Promise.resolve({ ok: false, error: '当前处于锁定态，请先解锁后再导入' });
    this.state = h.normalize(parsed);
    if (this._encKey) {
      /* 加密解锁态：导入数据以当前密钥落盘，不得明文覆盖密文。
       * 必须返回落盘链：resolve 前保证持久化完成，防止调用方立即刷新丢数据。 */
      var self = this;
      return this._encSave(this._collectAllRaw()).then(function () {
        self._emitChange('all'); /* 导入覆盖全量数据：各页重绘 */
        return { ok: true };
      });
    }
    /* 明文路径同样必须等待落盘完成（对齐加密路径契约）：
     * save 的 LS 写挂在 idle 防抖上、IDB 走让位锁——直接 resolve 后调用方
     * 立即刷新/页面关闭会两侧皆失。flushPersist 立即落 LS，再等 IDB 链。 */
    this.save();
    this.flushPersist();
    var selfPlain = this;
    /* F-4：_storeWrite 的 IDB 挂链发生在写锁回调内，直接读 _idbPromise 会等到旧链；
     * 改用 _storeWrite 的锁 Promise 判定"本次写已入队"，再等链末端真正落盘。 */
    var lastIdb = this._idbPromise || Promise.resolve();
    return this._storeWrite(null, { ls: 'skip', idb: 'write' }).then(function () {
      return (selfPlain._idbPromise === lastIdb ? Promise.resolve() : selfPlain._idbPromise);
    }).then(function () {
      selfPlain._emitChange('all'); /* 导入覆盖全量数据：各页重绘 */
      return { ok: true };
    });
  };
  Store.prototype._importEncBackup = function (pkg, password) {
    var self = this;
    if (!h.cryptoReady()) return Promise.resolve({ ok: false, error: '当前环境不支持 Web Crypto' });
    if (typeof password !== 'string' || !password) return Promise.resolve({ ok: false, error: '导入加密备份需要密码' });
    var salt;
    try { salt = h.Crypto.b64ToBytes(pkg.salt); } catch (e) { return Promise.resolve({ ok: false, error: '备份盐格式无效' }); }
    if (salt.length !== 16) return Promise.resolve({ ok: false, error: '备份盐长度无效' });
    if (this.needsUnlock()) return Promise.resolve({ ok: false, error: '当前处于锁定态，请先解锁后再导入' });
    return h.Crypto.deriveKey(password, salt).then(function (key) {
      return h.Crypto.decryptBundle(pkg, key).then(function (json) {
        var parsed;
        try { parsed = JSON.parse(json); } catch (e) { return { ok: false, error: '解密结果不是有效数据' }; }
        if (!h.isPlainObject(parsed) || typeof parsed.version !== 'number') return { ok: false, error: '解密结果缺少必要字段' };
        self.state = h.normalize(parsed);
        if (self._encKey) {
          /* 加密解锁态：导入数据以当前密钥落盘，保持密文不变量。
           * 必须返回落盘链：导入是一次性操作，resolve 前保证持久化完成，
           * 否则调用方立即刷新页面会丢失刚导入的数据（无法像普通 save 那样下次重试）。 */
          return self._encSave(self._collectAllRaw()).then(function () {
            self._emitChange('all');
            return { ok: true };
          });
        } else {
          /* 明文回落路径：同 importBackup 主路径，等待落盘后再 resolve */
          self.save();
          self.flushPersist();
          /* F-4：等待本次导入写链真正入队并完成（见 importBackup 明文路径注释） */
          var lastIdb = self._idbPromise || Promise.resolve();
          return self._storeWrite(null, { ls: 'skip', idb: 'write' }).then(function () {
            return (self._idbPromise === lastIdb ? Promise.resolve() : self._idbPromise);
          }).then(function () {
            self._emitChange('all'); /* 导入覆盖全量数据：各页重绘 */
            return { ok: true };
          });
        }
      }).catch(function () {
        return { ok: false, error: '密码错误或备份已损坏，导入中止（原数据未动）' };
      });
    });
  };
});
