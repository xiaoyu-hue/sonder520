/* SonderStore - 纯数据层，不依赖 DOM。
 * 兼容浏览器(<script> 暴露 window.SonderStore)与 Node(module.exports)。
 * 测试通过在 Node 中注入内存 storage 来验证全部数据逻辑。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SonderStore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'sonder_data_v1';
  var STORAGE_META_KEY = 'sonder_meta_v1';
  /* 加密盐（16 字节 base64）独立明文存放：未解锁时也须能读它以派生密钥。
   * 盐无需保密（仅防彩虹表），数据本体仍是密文。 */
  var STORAGE_SALT_KEY = 'sonder_encsalt_v1';
/* 自定义壁纸（base64 data URL，独立存放：不进主快照/IDB，避免撑爆配额） */
var STORAGE_WALLPAPER_KEY = 'sonder_wallpaper_v1';
  var ENC_FORMAT = 'sonder-enc-v1';
  var BACKUP_ENC_FORMAT = 'sonder-enc-backup-v1';

  /* ---------- IndexedDB 层 ----------
   * localStorage 上限约 5MB，数据增长后可能写满。Sonder 采用双写双存：
   * 每次保存同时写 localStorage 与 IndexedDB（容量大），任一被清空时
   * 另一份兜底恢复。冲突以 savedAt 时间戳取新。 */
  var IDB_NAME = 'sonder-db';
  var IDB_STORE = 'state';
  var IDB_KEY = 'state';
  var QUOTA_SOFT_LIMIT = Math.round(4.5 * 1024 * 1024);

  /* 加密核心（浏览器 window.SonderCrypto / Node require('./encryption.js')） */
  var Crypto = null;
  try {
    Crypto = (typeof window !== 'undefined' && window.SonderCrypto) ||
      (typeof module === 'object' && typeof require === 'function' ? require('./encryption.js') : null);
  } catch (e) { Crypto = null; }
  function cryptoReady() { return !!Crypto; }

  function idbAvailable() {
    return typeof indexedDB !== 'undefined' && typeof IDBKeyRange !== 'undefined';
  }
  function openIdb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function (e) {
        var db = /** @type {any} */ (e).target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('idb-open')); };
    });
  }
  /* IDB 只存字符串（JSON），跨环境最稳；put 走完整事务以正确报错 */
  function idbPut(db, key, json) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(json, key);
      tx.oncomplete = function () { resolve(null); };
      tx.onerror = function () { reject(tx.error || new Error('idb-put')); };
    });
  }
  function idbGet(db, key) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(IDB_STORE, 'readonly');
      var req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { reject(req.error || new Error('idb-get')); };
    });
  }

  /* ---------- 工具 ---------- */
  function uid() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }
  function nowISO() {
    return new Date().toISOString();
  }
  function todayStr() {
    var d = new Date();
    return fmtDate(d);
  }
  function fmtDate(d) {
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }
  function deepClone(v) {
    return JSON.parse(JSON.stringify(v));
  }
  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  /* ---------- 默认数据结构 ---------- */
  var DEFAULT_SETTINGS = {
    /* 主题：auto=跟随系统（默认）| light | dark */
    theme: 'auto',
    wallpaperOpacity: 40,
    gameDifficulty: 'normal',
    frameRate: 120,
    modules: {
      today: true, memo: true, selfmedia: true, dev: true,
      consulting: true, reading: true, news: true, design: true,
      game: true
    },
    quotaNoticeDismissed: false,
    taskReminder: false
  };

  function moduleKeys() {
    return Object.keys(DEFAULT_SETTINGS.modules);
  }

  function defaultState() {
    return {
      version: 1,
      settings: deepClone(DEFAULT_SETTINGS),
      memos: [],
      tasks: [],
      posts: [],
      devProjects: [],
      clients: [],
      books: [],
      news: [],
      designs: [],
      gameRecords: []
    };
  }

  /* 优先级四档：p1 紧急重要 / p2 重要不紧急 / p3 紧急不重要 / p4 不紧急不重要。
   * 旧版 高/中/低 在此自动迁移：高→p1、中→p2、低→p4；未知值回落 p2。 */
  var PRIORITY_MAP = { '高': 'p1', '中': 'p2', '低': 'p4' };
  function normalizePriority(v) {
    var p = String(v === null || v === undefined ? '' : v);
    if (PRIORITY_MAP[p]) p = PRIORITY_MAP[p];
    if (p === 'p1' || p === 'p2' || p === 'p3' || p === 'p4') return p;
    return 'p2';
  }
  var PRIORITY_LIST = ['p1', 'p2', 'p3', 'p4'];

  /* 把已持久化的数据与默认结构合并，保证缺字段时也有默认值 */
  function normalize(raw) {
    var base = defaultState();
    if (!isPlainObject(raw)) return base;
    var out = deepClone(base);
    out.version = typeof raw.version === 'number' ? raw.version : base.version;
    for (var key in base) {
      if (key === 'settings') {
        out.settings = mergeSettings(base.settings, raw.settings);
      } else if (Array.isArray(raw[key])) {
        out[key] = raw[key].slice();
      } else if (isPlainObject(raw[key])) {
        out[key] = deepClone(raw[key]);
      }
    }
    /* 旧数据优先级迁移（高/中/低 → p1/p2/p4） */
    out.tasks.forEach(function (t) { t.priority = normalizePriority(t.priority); });
    return out;
  }

  function mergeSettings(dflt, raw) {
    var s = deepClone(dflt);
    if (isPlainObject(raw)) {
      if (raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'auto') s.theme = raw.theme;
      if (typeof raw.wallpaperOpacity === 'number') s.wallpaperOpacity = clampOpacity(raw.wallpaperOpacity);
      if (raw.gameDifficulty === 'easy' || raw.gameDifficulty === 'normal' || raw.gameDifficulty === 'hard') s.gameDifficulty = raw.gameDifficulty;
      if (raw.frameRate === 60 || raw.frameRate === 90) s.frameRate = raw.frameRate;
      else if (raw.frameRate === 120) s.frameRate = 120;
      if (typeof raw.quotaNoticeDismissed === 'boolean') s.quotaNoticeDismissed = raw.quotaNoticeDismissed;
      if (typeof raw.taskReminder === 'boolean') s.taskReminder = raw.taskReminder;
      if (isPlainObject(raw.modules)) {
        for (var k in s.modules) {
          if (typeof raw.modules[k] === 'boolean') s.modules[k] = raw.modules[k];
        }
      }
    }
    return s;
  }

  function clampOpacity(v) {
    var n = Number(v);
    if (isNaN(n)) return 40;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  /* ---------- Store ---------- */
  /** @constructor @this {{ _storage: any, state: any, _meta: any, _idbPromise: any, _persistLocal: any, _idbWrite: any, _lastJson: string, _rev: number, _encKey: any, _encSize: number, _hasEncSnapshot: Function, _idbEncLocked: boolean }} */
  function Store(storage) {
    this._storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    var persisted = null;
    if (this._storage) {
      try { persisted = JSON.parse(this._storage.getItem(STORAGE_KEY)); }
      catch (e) { persisted = null; }
    }
    this.state = normalize(this._hasEncSnapshot() ? null : persisted);
    this._meta = null;
    this._idbPromise = null;
    this._lastJson = null;
    this._rev = 0;
    this._encKey = null;
    this._encSize = 0;
    this._idbEncLocked = false;
  }

  /* 主快照是否为密文（未解锁时据此判定"需要解锁"） */
  Store.prototype._hasEncSnapshot = function () {
    if (!this._storage) return false;
    try {
      var raw = this._storage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      return !!(parsed && parsed.e === 1 && parsed.v === ENC_FORMAT);
    } catch (e) { return false; }
  };
  Store.prototype._encSalt = function () {
    if (!this._storage || !Crypto) return null;
    try {
      var b64 = this._storage.getItem(STORAGE_SALT_KEY);
      if (!b64) return null;
      var bytes = Crypto.b64ToBytes(b64);
      return bytes && bytes.length === 16 ? bytes : null;
    } catch (e) { return null; }
  };
  /* 盐获取（localStorage 缺失时从 IndexedDB 冗余读取，配合双写恢复） */
  Store.prototype._encSaltAsync = function () {
    var self = this;
    var local = this._encSalt();
    if (local) return Promise.resolve(local);
    if (!idbAvailable()) return Promise.resolve(null);
    return openIdb().then(function (db) {
      return idbGet(db, IDB_KEY).then(function (entry) {
        if (!entry || typeof entry !== 'object') return null;
        if (entry.salt && Crypto) {
          try {
            var bytes = Crypto.b64ToBytes(entry.salt);
            if (bytes.length === 16) return bytes;
          } catch (e) { /* 继续 */ }
        }
        return null;
      });
    }).catch(function () { return null; });
  };
  /* 未解锁判定：localStorage 主快照为密文，或 IDB 侧存在待解锁密文（loadIdb 探测标记） */
  Store.prototype.needsUnlock = function () {
    return !!this._encKey ? false : (this._hasEncSnapshot() || !!this._idbEncLocked);
  };

  function clone(o) { return deepClone(o); }

  /* 同步写 localStorage（权威快照，永不阻塞正常流程；写满时忽略错误，IDB 兜底）。
   * 可传入 save 已序列化的 json 避免二次 stringify。 */
  /** @this {{ _storage: any, state: any, _meta: any, _idbPromise: any, _persistLocal: any, _idbWrite: any, _lastJson: string, _rev: number }} */
  Store.prototype._persistLocal = function (json) {
    if (!this._storage) return;
    this._meta = nowISO();
    try {
      this._storage.setItem(STORAGE_KEY, json || JSON.stringify(this.state));
      this._storage.setItem(STORAGE_META_KEY, this._meta);
    } catch (e) { /* 存储满等错误在此忽略，IDB 副本兜底 */ }
  };

  /* 异步写 IndexedDB。串行队列避免事务竞争；失败静默（localStorage 仍兜底）。
   * 可传入 save 已序列化的 json 避免二次 stringify；extra 合并进 entry（如加密盐）。 */
  /** @this {{ _storage: any, state: any, _meta: any, _idbPromise: any, _persistLocal: any, _idbWrite: any, _lastJson: string, _rev: number }} */
  Store.prototype._idbWrite = function (json, extra) {
    if (!idbAvailable()) return;
    var useJson = json || JSON.stringify(this.state);
    var meta = this._meta || nowISO();
    var prev = this._idbPromise || Promise.resolve();
    this._idbPromise = prev.then(function () {
      return openIdb().then(function (db) {
        var entry = extra ? Object.assign({}, extra) : {};
        entry.savedAt = meta;
        entry.data = useJson;
        return idbPut(db, IDB_KEY, entry);
      });
    }).catch(function () {});
  };

  /** @this {{ _storage: any, state: any, _meta: any, _idbPromise: any, _persistLocal: any, _idbWrite: any, _lastJson: string, _rev: number, _encKey: any, _encSize: number, _encSave: Function }} */
  Store.prototype.save = function () {
    var json = JSON.stringify(this.state);
    if (json === this._lastJson) return; /* 内容未变：零序列化零 IO */
    this._lastJson = json;
    this._rev++;
    if (this._encKey) { this._encSave(json).catch(function () {}); }
    else { this._persistLocal(json); this._idbWrite(json); }
  };

  /* 加密落盘：AES-GCM 异步（微任务级，用户操作间隙完成）；失败仅吞日志，
   * 存储里上一份快照仍完好，下次 save 重试 */
  Store.prototype._encSave = function (json) {
    var self = this;
    if (!this._encKey || !Crypto) return Promise.resolve();
    return Crypto.encryptText(json, this._encKey).then(function (bundle) {
      var payload = JSON.stringify({ e: 1, v: bundle.v, iv: bundle.iv, data: bundle.data });
      self._encSize = payload.length;
      self._persistLocal(payload);
      var salt = self._storage ? self._storage.getItem(STORAGE_SALT_KEY) : null;
      self._idbWrite(payload, salt ? { salt: salt } : {});
    }).catch(function (err) {
      /* eslint-disable no-console */
      if (typeof console !== 'undefined' && console.error) console.error('encrypt save failed', err);
    });
  };

  /* 启动时调用：优先从 IndexedDB 恢复（若更新）。返回 Promise<是否采用 IDB 数据> */
  /** @this {{ _storage: any, state: any, _meta: any, _idbPromise: any, _persistLocal: any, _idbWrite: any, _lastJson: string, _rev: number, save: Function, _encKey: any, _decryptParse: Function, _idbEncLocked: boolean }} */
  Store.prototype.loadIdb = function () {
    var self = this;
    if (!idbAvailable()) return Promise.resolve(false);
    return openIdb().then(function (db) {
      return idbGet(db, IDB_KEY).then(function (entry) {
        if (!entry) { self._idbWrite(); return false; }
        var idbSavedAt = (entry && typeof entry === 'object' && !Array.isArray(entry)) ? entry.savedAt : '';
        var idbData = (entry && typeof entry === 'object' && !Array.isArray(entry)) ? entry.data : entry;
        var localMeta = null, localRaw = null;
        if (self._storage) {
          try { localMeta = self._storage.getItem(STORAGE_META_KEY); localRaw = self._storage.getItem(STORAGE_KEY); } catch (e) { localMeta = null; }
        }
        /* localStorage 更新 → 用本地原文（明文或密文）追平 IDB，不采用 IDB */
        if (localMeta && localMeta > idbSavedAt && localRaw) {
          self._idbWrite(localRaw);
          return false;
        }
        return self._decryptParse(idbData).then(function (parsed) {
          if (!parsed) {
            var isEnc = false;
            try { isEnc = !!(JSON.parse(idbData) && JSON.parse(idbData).e === 1); } catch (e) { isEnc = false; }
            if (isEnc) self._idbEncLocked = true; /* IDB 侧有待解锁密文：提示 UI 走解锁流程 */
            return false;
          }
          self._idbEncLocked = false;
          self.state = normalize(parsed);
          self._lastJson = JSON.stringify(self.state);
          self._rev++;
          self._persistLocal(idbData);
          self._idbWrite(idbData);
          return true;
        });
      });
    }).catch(function () { return false; });
  };

  /* 把存储字符串解析为 state 对象；密文格式（e===1）需已解锁并解密，失败一律返回 null 不动数据 */
  Store.prototype._decryptParse = function (data) {
    var self = this;
    var parsed = null;
    try { parsed = JSON.parse(data); } catch (e) { return Promise.resolve(null); }
    if (parsed && parsed.e === 1 && parsed.v === ENC_FORMAT) {
      if (!self._encKey || !Crypto) return Promise.resolve(null);
      return Crypto.decryptBundle(parsed, self._encKey).then(function (json) {
        try { return JSON.parse(json); } catch (e) { return null; }
      }).catch(function () { return null; });
    }
    return Promise.resolve(parsed);
  };

  /* 手动迁移：立即把当前全部数据写入 IndexedDB（只复制不删旧数据） */
  /** @this {{ _storage: any, state: any, _meta: any, _idbPromise: any, _persistLocal: any, _idbWrite: any }} */
  Store.prototype.migrateToIdb = function () {
    var self = this;
    if (!idbAvailable()) return Promise.resolve(false);
    this._meta = nowISO();
    var json = JSON.stringify(this.state);
    return openIdb().then(function (db) {
      return idbPut(db, IDB_KEY, { savedAt: self._meta, data: json }).then(function () { return true; });
    }).catch(function () { return false; });
  };

  /* 当前数据体积（字节）。接近 5MB 上限时前端显示警示条。复用上次序列化结果，页面切换时不重复计算
   * 加密模式下按最近一次密文长度计。 */
  /** @this {{ _storage: any, state: any, _meta: any, _idbPromise: any, _persistLocal: any, _idbWrite: any, _lastJson: string, _rev: number, _encKey: any, _encSize: number }} */
  Store.prototype.storageUsage = function () {
    if (this._encKey) return this._encSize || (this._lastJson ? this._lastJson.length : 0);
    try { return (this._lastJson || JSON.stringify(this.state)).length; } catch (e) { return 0; }
  };
  Store.prototype.isNearQuota = function () {
    return this.storageUsage() > QUOTA_SOFT_LIMIT;
  };
  Store.prototype.dismissQuotaNotice = function () {
    this.state.settings.quotaNoticeDismissed = true;
    this.save();
  };
  Store.prototype.setQuotaNoticeDismissed = function (v) {
    this.state.settings.quotaNoticeDismissed = !!v;
    this.save();
  };

  function find(arr, id) {
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }
  function idxOf(arr, id) {
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return i;
    return -1;
  }

  /* ====== 可选加密（默认关闭；开启后本地快照为密文，需解锁使用） ====== */
  Store.prototype.encryptionEnabled = function () {
    return this._encKey ? true : this.needsUnlock();
  };
  Store.prototype.encryptionMode = function () {
    return this._encKey ? 'unlocked' : (this.needsUnlock() ? 'locked' : 'off');
  };
  Store.prototype.lock = function () {
    this._encKey = null;
  };
  /* 启用加密：自检锁 → 派生密钥 → 全量密文落盘 → 回读验证。
   * 任何一步失败即中止，旧明文快照与内存数据原样保留。 */
  Store.prototype.enableEncryption = function (password) {
    var self = this;
    if (!cryptoReady()) return Promise.reject(new Error('当前环境不支持 Web Crypto'));
    if (typeof password !== 'string' || password.length < 4) return Promise.reject(new Error('密码至少 4 位'));
    if (this._encKey) return Promise.reject(new Error('已处于加密模式'));
    var salt = Crypto.saltBytes();
    return Crypto.selfTest(password, salt).then(function (ok) {
      if (!ok) throw new Error('加密引擎自检异常，已中断启用');
      return Crypto.deriveKey(password, salt);
    }).then(function (key) {
      self._encKey = key;
      if (self._storage) {
        try { self._storage.setItem(STORAGE_SALT_KEY, Crypto.bytesToB64(salt)); } catch (e) { throw new Error('盐存储失败，已中止'); }
      }
      var json = JSON.stringify(self.state);
      self._lastJson = json;
      self._rev++;
      return self._encSave(json).then(function () {
        /* 回读验证：密文必须能解回并保留关键数据 */
        return self.readSnapshot('local').then(function (dec) {
          if (!dec || !dec.settings || !isPlainObject(dec.settings)) throw new Error('加密回读验证失败');
          if (dec.tasks.length !== self.state.tasks.length) throw new Error('加密回读数据不一致，已中止');
          return true;
        });
      });
    }).catch(function (err) {
      self._encKey = null;
      if (self._storage) {
        try { self._storage.removeItem(STORAGE_SALT_KEY); } catch (e) { /* 忽略 */ }
      }
      /* 兜底：把内存明文快照写回双存（若密文已部分落盘则覆盖为明文） */
      var fallback = JSON.stringify(self.state);
      self._persistLocal(fallback);
      self._idbWrite(fallback);
      throw err;
    });
  };
  /* 解锁：用密码派生密钥并解密主快照（localStorage 优先，缺则 IndexedDB）；
   * 成功进入可用状态并复位锁定标记，失败状态原样 */
  Store.prototype.unlock = function (password) {
    var self = this;
    if (!cryptoReady()) return Promise.resolve(false);
    if (typeof password !== 'string' || !password) return Promise.resolve(false);
    return this._encSaltAsync().then(function (salt) {
      if (!salt) return false;
      return Crypto.deriveKey(password, salt).then(function (key) {
        self._encKey = key;
        return self.readSnapshot('any').then(function (dec) {
          if (!dec) { self._encKey = null; return false; }
          self.state = normalize(dec);
          self._lastJson = JSON.stringify(self.state);
          self._rev++;
          self._idbEncLocked = false;
          /* 回填双存：解锁即保证 localStorage 与 IDB 都是最新密文快照 */
          return self._encSave(self._lastJson).then(function () { return true; });
        }).catch(function () { self._encKey = null; return false; });
      }).catch(function () { self._encKey = null; return false; });
    });
  };
  /* 停用加密：必须用输入的密码派生密钥解出快照（不能用当前会话密钥），
   * 密码错误则拒绝且密文快照原样保留 */
  Store.prototype.disableEncryption = function (password) {
    var self = this;
    if (!cryptoReady()) return Promise.reject(new Error('当前环境不支持 Web Crypto'));
    if (!this.needsUnlock() && !this._encKey) return Promise.reject(new Error('未启用加密'));
    return this._encSaltAsync().then(function (salt) {
      if (!salt) throw new Error('盐缺失，无法验证密码');
      return Crypto.deriveKey(password, salt).then(function (key) {
        return self._decryptSnapshotKey(key).then(function (dec) {
          if (!dec) throw new Error('密码不正确或快照损坏，已中止');
          self.state = normalize(dec);
          self._encKey = null;
          self._idbEncLocked = false;
          if (self._storage) {
            try { self._storage.removeItem(STORAGE_SALT_KEY); } catch (e) { /* 忽略 */ }
          }
          self._lastJson = null; /* 破除幂等保护，强制明文双写 */
          self.save(); /* 明文双写（_encKey 已空） */
          return true;
        });
      });
    });
  };
  /* 用给定密钥解密主快照（local 优先，缺则 IDB），失败一律 null */
  Store.prototype._decryptSnapshotKey = function (key) {
    var self = this;
    if (!Crypto) return Promise.resolve(null);
    var localRaw = null;
    if (self._storage) {
      try { localRaw = self._storage.getItem(STORAGE_KEY); } catch (e) { localRaw = null; }
    }
    function fromRaw(raw) {
      var parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) { return Promise.resolve(null); }
      if (!parsed || parsed.e !== 1 || parsed.v !== ENC_FORMAT) return Promise.resolve(null);
      return Crypto.decryptBundle(parsed, key).then(function (json) {
        try { return JSON.parse(json); } catch (e) { return null; }
      }).catch(function () { return null; });
    }
    if (localRaw) return fromRaw(localRaw);
    if (!idbAvailable()) return Promise.resolve(null);
    return openIdb().then(function (db) {
      return idbGet(db, IDB_KEY).then(function (entry) {
        if (!entry) return null;
        var data = (entry && typeof entry === 'object' && !Array.isArray(entry)) ? entry.data : entry;
        return fromRaw(data);
      });
    }).catch(function () { return null; });
  };
  /* 读取当前主快照（加密则需已解锁）：source = 'local' | 'idb' | 'any'。
   * 返回解析后的 state 对象或 null（读取/解密失败一律 null，绝不抛出覆盖调用方）。 */
  Store.prototype.readSnapshot = function (source) {
    var self = this;
    function readLocal() {
      if (!self._storage) return Promise.resolve(null);
      var raw = null;
      try { raw = self._storage.getItem(STORAGE_KEY); } catch (e) { return Promise.resolve(null); }
      if (!raw) return Promise.resolve(null);
      return self._decryptParse(raw);
    }
    function readIdb() {
      if (!idbAvailable()) return Promise.resolve(null);
      return openIdb().then(function (db) {
        return idbGet(db, IDB_KEY).then(function (entry) {
          if (!entry) return null;
          var data = (entry && typeof entry === 'object' && !Array.isArray(entry)) ? entry.data : entry;
          return self._decryptParse(data);
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
    this.state = defaultState();
    this.save();
  };

  /* ====== 快速备忘 ====== */
  Store.prototype.addMemo = function (text) {
    var m = { id: uid(), text: String(text || '').trim(), time: nowISO(), archived: false };
    this.state.memos.unshift(m);
    this.save();
    return m;
  };
  Store.prototype.updateMemo = function (id, patch) {
    var m = find(this.state.memos, id);
    if (!m) return null;
    if (typeof patch.text === 'string') m.text = patch.text.trim();
    if (patch.archived === true) m.archived = true;
    if (patch.archived === false) m.archived = false;
    this.save();
    return m;
  };
  Store.prototype.removeMemo = function (id) {
    this.state.memos = this.state.memos.filter(function (m) { return m.id !== id; });
    this.save();
  };

  /* ====== 今日计划 ====== */
  Store.prototype.addTask = function (data) {
    var t = {
      id: uid(),
      title: String(data.title || '').trim() || '未命名任务',
      note: String(data.note || ''),
      date: data.date || todayStr(),
      priority: normalizePriority(data.priority || 'p2'),
      done: !!data.done,
      doneAt: data.doneAt || null,
      order: this.state.tasks.length
    };
    this.state.tasks.push(t);
    this.save();
    return t;
  };
  Store.prototype.updateTask = function (id, patch) {
    var t = find(this.state.tasks, id);
    if (!t) return null;
    if (typeof patch.title === 'string') t.title = patch.title.trim() || t.title;
    if (typeof patch.note === 'string') t.note = patch.note;
    if (typeof patch.date === 'string') t.date = patch.date;
    if (typeof patch.priority === 'string') t.priority = normalizePriority(patch.priority);
    if (typeof patch.done === 'boolean') {
      t.done = patch.done;
      t.doneAt = patch.done ? nowISO() : null;
    }
    this.save();
    return t;
  };
  Store.prototype.removeTask = function (id) {
    this.state.tasks = this.state.tasks.filter(function (t) { return t.id !== id; });
    this.save();
  };
  Store.prototype.reorderTask = function (id, dir) {
    var idx = idxOf(this.state.tasks, id);
    var swap = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swap < 0 || swap >= this.state.tasks.length) return false;
    var arr = this.state.tasks;
    var tmp = arr[idx]; arr[idx] = arr[swap]; arr[swap] = tmp;
    for (var i = 0; i < arr.length; i++) arr[i].order = i;
    this.save();
    return true;
  };

  /* 纯函数：对任务先按今天日期分组。today 形如 'YYYY-MM-DD' */
  function groupTasks(tasks, today) {
    today = today || todayStr();
    var nowList = [], overdue = [], upcoming = [], done = [];
    tasks.forEach(function (t) {
      if (t.done) { done.push(clone(t)); return; }
      var d = t.date || today;
      if (d < today) overdue.push(clone(t));
      else if (d === today) nowList.push(clone(t));
      else upcoming.push(clone(t));
    });
    nowList.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    overdue.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    upcoming.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    done.sort(function (a, b) { return (a.doneAt || '') > (b.doneAt || '') ? -1 : 1; });
    return { now: nowList, overdue: overdue, upcoming: upcoming, done: done };
  }

  /* 今日完成率：统计日期为 today 的任务完成占比（供今日计划环形进度条） */
  function todayProgress(tasks, today) {
    today = today || todayStr();
    var list = tasks.filter(function (t) { return String(t.date || today) === today; });
    var done = list.filter(function (t) { return t.done; }).length;
    return { done: done, total: list.length, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
  }

  /* ====== 自媒体 ====== */
  var STAT_FIELDS = ['views', 'likes', 'comments', 'favorites'];
  function num0(v) { var n = Number(v); return isNaN(n) ? 0 : Math.max(0, n); }
  function postFactory(d) {
    var p = {
      id: uid(), title: String(d.title || '').trim() || '未命名内容',
      platform: String(d.platform || '').trim(), account: String(d.account || '').trim(),
      note: String(d.note || ''), tags: (Array.isArray(d.tags) ? d.tags.slice() : []),
      status: d.status || 'draft', publishDate: d.publishDate || null,
      createdAt: nowISO()
    };
    STAT_FIELDS.forEach(function (f) { p[f] = num0(d[f]); });
    p.progress = num0(d.progress);
    if (p.progress > 100) p.progress = 100;
    return p;
  }
  Store.prototype.addPost = function (d) { var p = postFactory(d); this.state.posts.unshift(p); this.save(); return p; };
  Store.prototype.updatePost = function (id, patch) {
    var p = find(this.state.posts, id); if (!p) return null;
    ['title', 'platform', 'account', 'note', 'status', 'publishDate'].forEach(function (k) {
      if (typeof patch[k] === 'string') p[k] = patch[k];
    });
    STAT_FIELDS.forEach(function (f) {
      if (patch[f] !== undefined && patch[f] !== null && patch[f] !== '') p[f] = num0(patch[f]);
    });
    if (patch.progress !== undefined && patch.progress !== null && patch.progress !== '') {
      var pr = num0(patch.progress);
      p.progress = pr > 100 ? 100 : pr;
    }
    if (Array.isArray(patch.tags)) p.tags = patch.tags.slice();
    this.save(); return p;
  };
  Store.prototype.removePost = function (id) {
    this.state.posts = this.state.posts.filter(function (p) { return p.id !== id; });
    this.save();
  };
  function filterPosts(posts, opts) {
    opts = opts || {};
    var tag = opts.tag, status = opts.status;
    return posts.filter(function (p) {
      if (tag && p.tags.indexOf(tag) < 0) return false;
      if (status && p.status !== status) return false;
      return true;
    }).map(clone);
  }
  function collectTags(posts) {
    var set = {};
    posts.forEach(function (p) { p.tags.forEach(function (t) { set[t] = true; }); });
    return Object.keys(set).sort();
  }
  /* 已发布内容的统计数据汇总（供图表）。只统计 status === 'published'。 */
  function publishedStats(posts) {
    var published = posts.filter(function (p) { return p.status === 'published'; }).map(function (p) {
      return {
        id: p.id, title: p.title,
        views: num0(p.views), likes: num0(p.likes),
        comments: num0(p.comments), favorites: num0(p.favorites)
      };
    });
    var sums = { views: 0, likes: 0, comments: 0, favorites: 0 };
    var max = { views: 0, likes: 0, comments: 0, favorites: 0 };
    published.forEach(function (p) {
      STAT_FIELDS.forEach(function (f) { sums[f] += p[f]; if (p[f] > max[f]) max[f] = p[f]; });
    });
    var sorted = published.slice().sort(function (a, b) { return b.views - a.views; });
    return { count: published.length, sums: sums, max: max, posts: sorted };
  }
  /* 导出 CSV - 含字段转义 */
  function toCSV(posts) {
    var header = ['标题', '平台', '账号', '标签', '状态', '发布日期', '备注'];
    var rows = [header];
    posts.forEach(function (p) {
      rows.push([
        p.title, p.platform, p.account, p.tags.join(' | '),
        p.status, p.publishDate || '', p.note || ''
      ]);
    });
    function esc(v) {
      v = String(v === null || v === undefined ? '' : v);
      if (/[",\r\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }
    return rows.map(function (row) {
      return row.map(esc).join(',');
    }).join('\n');
  }

  /* ====== 开发工作 ====== */
  Store.prototype.addDevProject = function (d) {
    var p = {
      id: uid(), name: String(d.name || '').trim() || '未命名项目',
      note: String(d.note || ''), tasks: [], createdAt: nowISO()
    };
    this.state.devProjects.unshift(p); this.save(); return p;
  };
  Store.prototype.updateDevProject = function (id, patch) {
    var p = find(this.state.devProjects, id); if (!p) return null;
    if (typeof patch.name === 'string') p.name = patch.name.trim() || p.name;
    if (typeof patch.note === 'string') p.note = patch.note;
    this.save(); return p;
  };
  Store.prototype.removeDevProject = function (id) {
    this.state.devProjects = this.state.devProjects.filter(function (p) { return p.id !== id; });
    this.save();
  };
  function devTask(d) { return { id: uid(), title: String(d.title || ''), note: String(d.note || ''), done: !!d.done }; }
  Store.prototype.addDevTask = function (projId, d) {
    var p = find(this.state.devProjects, projId); if (!p) return null;
    var t = devTask(d); p.tasks.push(t); this.save(); return t;
  };
  Store.prototype.updateDevTask = function (projId, taskId, patch) {
    var p = find(this.state.devProjects, projId); if (!p) return null;
    var t = find(p.tasks, taskId); if (!t) return null;
    if (typeof patch.title === 'string') t.title = patch.title;
    if (typeof patch.note === 'string') t.note = patch.note;
    if (typeof patch.done === 'boolean') t.done = patch.done;
    this.save(); return t;
  };
  Store.prototype.removeDevTask = function (projId, taskId) {
    var p = find(this.state.devProjects, projId); if (!p) return;
    p.tasks = p.tasks.filter(function (t) { return t.id !== taskId; });
    this.save();
  };
  function devProgress(p) {
    var total = p.tasks.length;
    var done = p.tasks.filter(function (t) { return t.done; }).length;
    return { total: total, done: done, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  /* ====== 咨询工作 ====== */
  Store.prototype.addClient = function (d) {
    var c = { id: uid(), name: String(d.name || '').trim() || '未命名客户', contact: String(d.contact || ''), note: String(d.note || ''), projects: [], followups: [], income: [], createdAt: nowISO() };
    this.state.clients.unshift(c); this.save(); return c;
  };
  Store.prototype.updateClient = function (id, patch) {
    var c = find(this.state.clients, id); if (!c) return null;
    if (typeof patch.name === 'string') c.name = patch.name.trim() || c.name;
    if (typeof patch.contact === 'string') c.contact = patch.contact;
    if (typeof patch.note === 'string') c.note = patch.note;
    this.save(); return c;
  };
  Store.prototype.removeClient = function (id) {
    this.state.clients = this.state.clients.filter(function (c) { return c.id !== id; });
    this.save();
  };
  Store.prototype.addClientProject = function (clientId, d) {
    var c = find(this.state.clients, clientId); if (!c) return null;
    var pr = { id: uid(), name: String(d.name || '').trim() || '未命名项目', stage: d.stage || '进行中', note: String(d.note || '') };
    c.projects.push(pr); this.save(); return pr;
  };
  Store.prototype.updateClientProject = function (clientId, projId, patch) {
    var c = find(this.state.clients, clientId); if (!c) return null;
    var pr = find(c.projects, projId); if (!pr) return null;
    if (typeof patch.name === 'string') pr.name = patch.name.trim() || pr.name;
    if (typeof patch.stage === 'string') pr.stage = patch.stage;
    if (typeof patch.note === 'string') pr.note = patch.note;
    this.save(); return pr;
  };
  Store.prototype.removeClientProject = function (clientId, projId) {
    var c = find(this.state.clients, clientId); if (!c) return;
    c.projects = c.projects.filter(function (p) { return p.id !== projId; });
    this.save();
  };
  Store.prototype.addClientFollowup = function (clientId, d) {
    var c = find(this.state.clients, clientId); if (!c) return null;
    var f = { id: uid(), date: d.date || todayStr(), note: String(d.note || ''), done: !!d.done };
    c.followups.push(f); this.save(); return f;
  };
  Store.prototype.updateClientFollowup = function (clientId, fuId, patch) {
    var c = find(this.state.clients, clientId); if (!c) return null;
    var f = find(c.followups, fuId); if (!f) return null;
    if (typeof patch.date === 'string') f.date = patch.date;
    if (typeof patch.note === 'string') f.note = patch.note;
    if (typeof patch.done === 'boolean') f.done = patch.done;
    this.save(); return f;
  };
  Store.prototype.removeClientFollowup = function (clientId, fuId) {
    var c = find(this.state.clients, clientId); if (!c) return;
    c.followups = c.followups.filter(function (f) { return f.id !== fuId; });
    this.save();
  };
  Store.prototype.addClientIncome = function (clientId, d) {
    var c = find(this.state.clients, clientId); if (!c) return null;
    var amt = Number(d.amount);
    if (isNaN(amt)) amt = 0;
    var inc = { id: uid(), date: d.date || todayStr(), amount: amt, note: String(d.note || '') };
    c.income.push(inc); this.save(); return inc;
  };
  Store.prototype.updateClientIncome = function (clientId, incId, patch) {
    var c = find(this.state.clients, clientId); if (!c) return null;
    var inc = find(c.income, incId); if (!inc) return null;
    if (typeof patch.date === 'string') inc.date = patch.date;
    if (patch.amount !== undefined) { var a = Number(patch.amount); if (!isNaN(a)) inc.amount = a; }
    if (typeof patch.note === 'string') inc.note = patch.note;
    this.save(); return inc;
  };
  Store.prototype.removeClientIncome = function (clientId, incId) {
    var c = find(this.state.clients, clientId); if (!c) return;
    c.income = c.income.filter(function (i) { return i.id !== incId; });
    this.save();
  };

  /* ====== 阅读计划 ====== */
  Store.prototype.addBook = function (d) {
    var pr = Number(d.progress);
    if (isNaN(pr)) pr = 0;
    pr = Math.max(0, Math.min(100, pr));
    var b = { id: uid(), title: String(d.title || '').trim() || '未命名书籍', author: String(d.author || ''), status: d.status || '想读', progress: pr, notes: [] };
    this.state.books.unshift(b); this.save(); return b;
  };
  Store.prototype.updateBook = function (id, patch) {
    var b = find(this.state.books, id); if (!b) return null;
    if (typeof patch.title === 'string') b.title = patch.title.trim() || b.title;
    if (typeof patch.author === 'string') b.author = patch.author;
    if (typeof patch.status === 'string') b.status = patch.status;
    if (patch.progress !== undefined) {
      var pr = Number(patch.progress);
      if (!isNaN(pr)) b.progress = Math.max(0, Math.min(100, pr));
    }
    this.save(); return b;
  };
  Store.prototype.removeBook = function (id) {
    this.state.books = this.state.books.filter(function (b) { return b.id !== id; });
    this.save();
  };
  Store.prototype.addBookNote = function (bookId, text) {
    var b = find(this.state.books, bookId); if (!b) return null;
    var n = { id: uid(), time: nowISO(), text: String(text || '').trim() };
    b.notes.push(n); this.save(); return n;
  };
  Store.prototype.removeBookNote = function (bookId, noteId) {
    var b = find(this.state.books, bookId); if (!b) return;
    b.notes = b.notes.filter(function (n) { return n.id !== noteId; });
    this.save();
  };
  function booksByStatus(books) {
    var out = { '想读': [], '在读': [], '已读完': [] };
    books.forEach(function (b) {
      var key = b.status in out ? b.status : '想读';
      out[key].push(clone(b)); // 正在看
    });
    return out;
  }

  /* 阅读统计：书籍总数 + 按状态分布 + 阅读进度区间分布 */
  var PROG_BUCKETS = [
    { label: '未开始', min: 0, max: 0, color: '#a8a297' },
    { label: '前期 1-33%', min: 1, max: 33, color: '#b0723f' },
    { label: '中期 34-66%', min: 34, max: 66, color: '#3b4a6b' },
    { label: '后期 67-99%', min: 67, max: 99, color: '#7a5e9e' },
    { label: '已完成 100%', min: 100, max: 100, color: '#2e7d63' }
  ];
  function readingStats(books) {
    var want = 0, reading = 0, finished = 0, readingSum = 0, progressSum = 0;
    var buckets = PROG_BUCKETS.map(function () { return 0; });
    books.forEach(function (b) {
      var pr = Number(b.progress);
      if (isNaN(pr)) pr = 0;
      progressSum += pr;
      if (b.status === '已读完') finished++;
      else if (b.status === '在读') { reading += 1; readingSum += pr; }
      else want++;
      var bi = 0;
      for (var i = PROG_BUCKETS.length - 1; i >= 0; i--) {
        if (pr >= PROG_BUCKETS[i].min) { bi = i; break; }
      }
      buckets[bi]++;
    });
    var statusArr = [
      { label: '想读', count: want, color: '#a8a297' },
      { label: '在读', count: reading, color: '#3b4a6b' },
      { label: '已读完', count: finished, color: '#2e7d63' }
    ].filter(function (s) { return s.count > 0; });
    return {
      total: books.length,
      want: want, reading: reading, finished: finished,
      avgReading: reading ? Math.round(readingSum / reading) : 0,
      avgAll: books.length ? Math.round(progressSum / books.length) : 0,
      byStatus: statusArr,
      buckets: PROG_BUCKETS.map(function (b, i) { return { label: b.label, color: b.color, count: buckets[i] }; })
    };
  }

  /* ====== 看新闻计划 ====== */
  Store.prototype.addNews = function (d) {
    var n = { id: uid(), title: String(d.title || '').trim() || '未命名资讯', url: String(d.url || ''), source: String(d.source || ''), tags: (Array.isArray(d.tags) ? d.tags.slice() : []), status: d.status || 'unread', note: String(d.note || ''), time: nowISO() };
    this.state.news.unshift(n); this.save(); return n;
  };
  Store.prototype.updateNews = function (id, patch) {
    var n = find(this.state.news, id); if (!n) return null;
    if (typeof patch.title === 'string') n.title = patch.title.trim() || n.title;
    if (typeof patch.url === 'string') n.url = patch.url;
    if (typeof patch.source === 'string') n.source = patch.source;
    if (Array.isArray(patch.tags)) n.tags = patch.tags.slice();
    if (typeof patch.status === 'string') n.status = patch.status;
    if (typeof patch.note === 'string') n.note = patch.note;
    this.save(); return n;
  };
  Store.prototype.removeNews = function (id) {
    this.state.news = this.state.news.filter(function (n) { return n.id !== id; });
    this.save();
  };

  /* ====== 设计计划 ====== */
  Store.prototype.addDesign = function (d) {
    var x = { id: uid(), type: d.type === 'project' ? 'project' : 'idea', title: String(d.title || '').trim() || '未命名', link: String(d.link || ''), category: String(d.category || ''), note: String(d.note || ''), stage: d.stage || '构想', time: nowISO() };
    this.state.designs.unshift(x); this.save(); return x;
  };
  Store.prototype.updateDesign = function (id, patch) {
    var x = find(this.state.designs, id); if (!x) return null;
    if (typeof patch.title === 'string') x.title = patch.title.trim() || x.title;
    if (typeof patch.type === 'string') x.type = patch.type === 'project' ? 'project' : 'idea';
    if (typeof patch.category === 'string') x.category = patch.category;
    if (typeof patch.link === 'string') x.link = patch.link;
    if (typeof patch.note === 'string') x.note = patch.note;
    if (typeof patch.stage === 'string') x.stage = patch.stage;
    this.save(); return x;
  };
  Store.prototype.removeDesign = function (id) {
    this.state.designs = this.state.designs.filter(function (x) { return x.id !== id; });
    this.save();
  };

  /* ====== 娱乐游戏 ====== */
  Store.prototype.addGameRecord = function (d) {
    var r = {
      id: uid(),
      kind: d.kind === 'gomoku' ? 'gomoku' : 'tictactoe',
      mode: d.mode === 'pvp' ? 'pvp' : 'ai',
      player: d.player === 'O' ? 'O' : 'X',
      winner: d.winner === 'draw' ? 'draw' : (d.winner === 'O' ? 'O' : 'X'),
      byResign: !!d.byResign,
      /* 仅 AI 对决记录难度档位；双人对弈与旧记录为 null */
      difficulty: d.mode === 'pvp' ? null : (d.difficulty === 'easy' || d.difficulty === 'hard' ? d.difficulty : 'normal'),
      date: todayStr(),
      time: nowISO()
    };
    this.state.gameRecords.unshift(r);
    this.save();
    return r;
  };
  Store.prototype.clearGameRecords = function () {
    this.state.gameRecords = [];
    this.save();
  };

  /* ====== 设置 ====== */
  Store.prototype.setTheme = function (t) {
    this.state.settings.theme = (t === 'auto' || t === 'dark') ? t : 'light';
    this.save();
  };
  Store.prototype.setWallpaperOpacity = function (v) {
    this.state.settings.wallpaperOpacity = clampOpacity(v);
    this.save();
    return this.state.settings.wallpaperOpacity;
  };
  /* 自定义壁纸：data URL 存取，不走主快照（返回是否成功，配额写满返回 false） */
  Store.prototype.getCustomWallpaper = function () {
    try { return this._storage ? this._storage.getItem(STORAGE_WALLPAPER_KEY) : null; } catch (e) { return null; }
  };
  Store.prototype.setCustomWallpaper = function (dataUrl) {
    if (typeof dataUrl !== 'string' || dataUrl.indexOf('data:image/') !== 0) return false;
    try {
      this._storage.setItem(STORAGE_WALLPAPER_KEY, dataUrl);
      return true;
    } catch (e) { return false; }
  };
  Store.prototype.clearCustomWallpaper = function () {
    try { if (this._storage) this._storage.removeItem(STORAGE_WALLPAPER_KEY); } catch (e) { /* 忽略 */ }
  };
  Store.prototype.setTaskReminder = function (on) {
    this.state.settings.taskReminder = !!on;
    this.save();
    return this.state.settings.taskReminder;
  };
  Store.prototype.setModuleEnabled = function (key, on) {
    if (!(key in this.state.settings.modules)) return;
    this.state.settings.modules[key] = !!on;
    this.save();
  };
  Store.prototype.setGameDifficulty = function (d) {
    var v = d === 'easy' || d === 'hard' ? d : 'normal';
    this.state.settings.gameDifficulty = v;
    this.save();
    return v;
  };
  Store.prototype.setFrameRate = function (f) {
    var v = f === 60 || f === 90 ? f : 120;
    this.state.settings.frameRate = v;
    this.save();
    return v;
  };
  var moduleKeysList = [{ key: 'today', label: '今日计划' }, { key: 'memo', label: '快速备忘' }, { key: 'selfmedia', label: '自媒体' }, { key: 'dev', label: '开发工作' }, { key: 'consulting', label: '咨询工作' }, { key: 'reading', label: '阅读计划' }, { key: 'news', label: '看新闻计划' }, { key: 'design', label: '设计计划' }, { key: 'game', label: '娱乐游戏' }];

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
      return Crypto.encryptText(JSON.stringify(dec), self._encKey).then(function (bundle) {
        return JSON.stringify({ format: BACKUP_ENC_FORMAT, salt: Crypto.bytesToB64(salt), iv: bundle.iv, data: bundle.data }, null, 2);
      });
    });
  };
  /* 导入：明文备份同步完成；加密备份需 password。统一返回 Promise<{ok, error?}> */
  Store.prototype.importBackup = function (jsonStr, password) {
    var parsed;
    try { parsed = JSON.parse(jsonStr); } catch (e) { return Promise.resolve({ ok: false, error: '文件不是有效的 JSON' }); }
    if (parsed && parsed.format === BACKUP_ENC_FORMAT) return this._importEncBackup(parsed, password);
    if (!isPlainObject(parsed) || typeof parsed.version !== 'number') {
      return Promise.resolve({ ok: false, error: '文件缺少必要字段(version)，无法识别为备份文件' });
    }
    this.state = normalize(parsed);
    this.save();
    return Promise.resolve({ ok: true });
  };
  Store.prototype._importEncBackup = function (pkg, password) {
    var self = this;
    if (!cryptoReady()) return Promise.resolve({ ok: false, error: '当前环境不支持 Web Crypto' });
    if (typeof password !== 'string' || !password) return Promise.resolve({ ok: false, error: '导入加密备份需要密码' });
    var salt;
    try { salt = Crypto.b64ToBytes(pkg.salt); } catch (e) { return Promise.resolve({ ok: false, error: '备份盐格式无效' }); }
    if (salt.length !== 16) return Promise.resolve({ ok: false, error: '备份盐长度无效' });
    return Crypto.deriveKey(password, salt).then(function (key) {
      return Crypto.decryptBundle(pkg, key).then(function (json) {
        var parsed;
        try { parsed = JSON.parse(json); } catch (e) { return { ok: false, error: '解密结果不是有效数据' }; }
        if (!isPlainObject(parsed) || typeof parsed.version !== 'number') return { ok: false, error: '解密结果缺少必要字段' };
        self.state = normalize(parsed);
        self.save();
        return { ok: true };
      }).catch(function () {
        return { ok: false, error: '密码错误或备份已损坏，导入中止（原数据未动）' };
      });
    });
  };

  /* ====== 统计汇总（首页 + 数据页） ====== */
  Store.prototype.summarize = function () {
    var st = this.state;
    var tasksAll = st.tasks;
    var grouped = groupTasks(tasksAll, todayStr());
    var posts = st.posts;
    var pendingFollowups = 0;
    st.clients.forEach(function (c) { c.followups.forEach(function (f) { if (!f.done) pendingFollowups++; }); });
    return {
      date: todayStr(),
      tasks: {
        total: tasksAll.length,
        doneToday: grouped.done.length,
        remaining: grouped.now.length + grouped.overdue.length + grouped.upcoming.length,
        current: grouped.now.length,
        overdue: grouped.overdue.length
      },
      selfmedia: { total: posts.length, pending: filterPosts(posts, { status: 'queue' }).length + filterPosts(posts, { status: 'draft' }).length },
      dev: { total: st.devProjects.length, active: st.devProjects.filter(function (p) { return devProgress(p).percent < 100; }).length },
      consulting: { total: st.clients.length, followups: pendingFollowups },
      reading: { total: st.books.length, reading: st.books.filter(function (b) { return b.status === '在读'; }).length },
      news: { total: st.news.length, unread: st.news.filter(function (n) { return n.status !== 'read'; }).length },
      design: { total: st.designs.length, active: st.designs.filter(function (x) { return x.type === 'project' && x.stage !== '定稿'; }).length },
      game: {
        total: st.gameRecords.length,
        wins: st.gameRecords.filter(function (r) { return r.winner !== 'draw' && r.winner === r.player; }).length,
        draws: st.gameRecords.filter(function (r) { return r.winner === 'draw'; }).length
      }
    };
  };

  /* 独立工具导出（供模块与测试使用） */
  var api = {
    Store: Store,
    createStore: function (storage) { return new Store(storage); },
    STORAGE_KEY: STORAGE_KEY,
    STORAGE_META_KEY: STORAGE_META_KEY,
    QUOTA_SOFT_LIMIT: QUOTA_SOFT_LIMIT,
    defaultState: defaultState,
    fmtDate: fmtDate,
    todayStr: todayStr,
    uid: uid,
    nowISO: nowISO,
    groupTasks: groupTasks,
    todayProgress: todayProgress,
    normalizePriority: normalizePriority,
    PRIORITY_LIST: PRIORITY_LIST,
    filterPosts: filterPosts,
    collectTags: collectTags,
    publishedStats: publishedStats,
    toCSV: toCSV,
    booksByStatus: booksByStatus,
    readingStats: readingStats,
    devProgress: devProgress,
    normalize: normalize,
    moduleList: moduleKeysList
  };
  return api;
});