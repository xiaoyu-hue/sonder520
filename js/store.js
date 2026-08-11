/* SonderStore - 纯数据层，不依赖 DOM。
 * 兼容浏览器(<script> 暴露 window.SonderStore)与 Node(module.exports)。
 * 测试通过在 Node 中注入内存 storage 来验证全部数据逻辑。
 *
 * 文件结构（核心 + 领域扩展）：
 *   store.js          核心：构造/持久化/加密/导入导出/汇总 + 共享 helper（api 导出）
 *   store-tasks.js    快速备忘 + 今日计划
 *   store-media.js    自媒体 + 开发工作 + 技术笔记/代码片段
 *   store-content.js  咨询 + 阅读/书摘 + 新闻 + 设计 + 游戏记录
 *   store-settings.js 主题/壁纸/提醒/模块开关/难度/帧率
 * 领域文件通过 SonderStore.Store 与 _h（core helper 白名单）注入；新增领域方法
 * 请写入对应领域文件而非本文件，并同步在 globals.d.ts 中声明签名。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    var api = factory();
    require('./store-tasks.js')(api.Store, api._h);
    require('./store-media.js')(api.Store, api._h);
    require('./store-content.js')(api.Store, api._h);
    require('./store-settings.js')(api.Store, api._h);
    module.exports = api;
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

  function defaultState() {
    return {
      version: 1,
      settings: deepClone(DEFAULT_SETTINGS),
      memos: [],
      tasks: [],
      posts: [],
      devProjects: [],
      devNotes: [],
      devSnippets: [],
      clients: [],
      books: [],
      excerpts: [],
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
    /* 旧书补默认：阅读统计与会话日志、完成日期、创建时间 */
    out.books.forEach(function (b) {
      if (typeof b.title !== 'string') b.title = '未命名书籍';
      if (typeof b.author !== 'string') b.author = '';
      if (!Array.isArray(b.notes)) b.notes = [];
      b.readingMinutes = num0(b.readingMinutes);
      if (!Array.isArray(b.readingLog)) b.readingLog = [];
      if (typeof b.finishedAt !== 'string') b.finishedAt = null;
      if (typeof b.createdAt !== 'string') b.createdAt = nowISO();
    });
    /* 旧书摘补默认字段 */
    out.excerpts.forEach(function (x) {
      if (typeof x.text !== 'string') x.text = '';
      if (typeof x.bookTitle !== 'string') x.bookTitle = '';
      if (typeof x.page !== 'number') x.page = 0;
      if (typeof x.time !== 'string') x.time = nowISO();
    });
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
    return this._encKey ? false : (this._hasEncSnapshot() || !!this._idbEncLocked);
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
    }).catch(function (err) {
      /* IDB 写入失败不影响主流程，但上报便于发现环境问题 */
      try { console.error('[Sonder] IndexedDB 写入失败', err); } catch (e) { /* 忽略 */ }
    });
  };

  /** @this {{ _storage: any, state: any, _meta: any, _idbPromise: any, _persistLocal: any, _idbWrite: any, _lastJson: string, _rev: number, _encKey: any, _encSize: number, _encSave: Function, needsUnlock: Function }} */
  Store.prototype.save = function () {
    var json = JSON.stringify(this.state);
    if (json === this._lastJson) return; /* 内容未变：零序列化零 IO */
    /* 锁定态守卫：快照为密文但无会话密钥时禁止明文落盘——
     * 锁定后残留的定时器/异步回调若触发 save，明文会覆盖密文并静默解除加密 */
    if (this.needsUnlock()) return;
    this._lastJson = json;
    this._rev++;
    if (this._encKey) {
      this._encSave(json).catch(function (err) {
        /* 加密写盘失败：下次 save 会重试；上报便于发现（数据仍在上次持久化版本） */
        try { console.error('[Sonder] 加密持久化失败', err); } catch (e) { /* 忽略 */ }
      });
    }
    else { this._persistLocal(json); this._idbWrite(json); }
  };

  /* 加密落盘：AES-GCM 异步（微任务级，用户操作间隙完成）。
   * 串行队列保证加密按调用顺序落盘：encryptText 为异步，连续多次 save
   * 若不排队，后发起的加密可能先完成并覆盖落盘 → 旧状态覆盖新状态（丢最新变更）。 */
  /** @this {{ _storage: any, _encKey: any, _encSize: number, _persistLocal: any, _idbWrite: any, _encChain: Promise }} */
  Store.prototype._encSave = function (json) {
    var self = this;
    if (!this._encKey || !Crypto) return Promise.resolve();
    var prev = self._encChain || Promise.resolve();
    self._encChain = prev.then(function () {
      return Crypto.encryptText(json, self._encKey).then(function (bundle) {
        var payload = JSON.stringify({ e: 1, v: bundle.v, iv: bundle.iv, data: bundle.data });
        self._encSize = payload.length;
        self._persistLocal(payload);
        var salt = self._storage ? self._storage.getItem(STORAGE_SALT_KEY) : null;
        self._idbWrite(payload, salt ? { salt: salt } : {});
      });
    }).catch(function (err) {
      /* 加密失败：存储停留在上次成功版本，后续变更会继续重试；上报便于发现 */
      try { console.error('[Sonder] 加密持久化失败', err); } catch (e) { /* 忽略 */ }
    });
    return self._encChain;
  };

  /* 启动时调用：优先从 IndexedDB 恢复（若更新）。返回 Promise<是否采用 IDB 数据> */
  /** @this {{ _storage: any, state: any, _meta: any, _idbPromise: any, _persistLocal: any, _idbWrite: any, _lastJson: string, _rev: number, save: Function, _encKey: any, _decryptParse: Function, _idbEncLocked: boolean }} */
  Store.prototype.loadIdb = function () {
    var self = this;
    if (!idbAvailable()) return Promise.resolve(false);
    return openIdb().then(function (db) {
      return idbGet(db, IDB_KEY).then(function (entry) {
        if (!entry) {
          /* IDB 为空：用 localStorage 原始串（密文或明文格式原样）回填。
           * 禁用内存 state 序列化——锁定态下内存是空 defaultState，
           * 序列化会把明文空数据写进 IDB，破坏密文兜底副本 */
          var lsRaw = null;
          if (self._storage) {
            try { lsRaw = self._storage.getItem(STORAGE_KEY); } catch (e) { lsRaw = null; }
          }
          self._idbWrite(lsRaw || undefined);
          return false;
        }
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
  /** @this {{ _storage: any, state: any, _meta: any, _idbPromise: any, _persistLocal: any, _idbWrite: any, _encKey: any, _encSave: Function }} */
  Store.prototype.migrateToIdb = function () {
    var self = this;
    if (!idbAvailable()) return Promise.resolve(false);
    this._meta = nowISO();
    var json = JSON.stringify(this.state);
    if (this._encKey) {
      /* 加密态：IDB 兜底必须与 LS 同为密文（走 _encSave 双写），不得写入内存明文 */
      return this._encSave(json).then(function () { return true; }).catch(function () { return false; });
    }
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
          /* 显式转明文：直接双写绕过 save 的锁定态守卫（此时 LS 仍是密文） */
          var plain = JSON.stringify(self.state);
          self._lastJson = plain;
          self._persistLocal(plain);
          self._idbWrite(plain);
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
  /* 最近 N 篇已发布选题（按发布日倒序，无发布日按创建时间），供折线图 */
  function recentPublished(posts, n) {
    n = (typeof n === 'number' && n > 0) ? n : 5;
    var pub = posts.filter(function (p) { return p.status === 'published'; })
      .map(function (p) {
        return { id: p.id, title: p.title, views: num0(p.views), likes: num0(p.likes), publishDate: p.publishDate || '', createdAt: p.createdAt || '' };
      });
    pub.sort(function (a, b) {
      var ka = a.publishDate || String(a.createdAt || '').slice(0, 10);
      var kb = b.publishDate || String(b.createdAt || '').slice(0, 10);
      return ka > kb ? -1 : (ka < kb ? 1 : 0);
    });
    return pub.slice(0, n);
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
  function devProgress(p) {
    var total = p.tasks.length;
    var done = p.tasks.filter(function (t) { return t.done; }).length;
    return { total: total, done: done, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  function sortNotesByUpdate(items) {
    return items.slice().sort(function (a, b) {
      var ka = a.updatedAt || a.createdAt || '';
      var kb = b.updatedAt || b.createdAt || '';
      return ka > kb ? -1 : (ka < kb ? 1 : 0);
    });
  }

  function excerptsByBook(excerpts) {
    var byTime = function (a, b) { return a.time < b.time ? 1 : (a.time > b.time ? -1 : 0); };
    var groups = [];
    excerpts.slice().sort(byTime).forEach(function (x) {
      var g = null;
      for (var i = 0; i < groups.length; i++) if (groups[i].bookId === x.bookId) { g = groups[i]; break; }
      if (!g) {
        g = { bookId: x.bookId, bookTitle: x.bookTitle || '未知书籍', items: [] };
        groups.push(g);
      }
      g.items.push({ id: x.id, text: x.text, page: x.page, time: x.time });
    });
    return groups;
  }
  /* 首页「每日金句」位置：有摘抄时按日期种子随机挑一条（当天稳定、隔天换新）；无摘抄返回 null */
  function hashStr(s) {
    var h = 5381, i;
    for (i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
    return Math.abs(h);
  }
  function dailyExcerpt(excerpts, dateStr) {
    if (!Array.isArray(excerpts) || !excerpts.length) return null;
    var sorted = excerpts.slice().sort(function (a, b) { return a.time < b.time ? -1 : (a.time > b.time ? 1 : 0); });
    var d = String(dateStr || todayStr());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) d = todayStr();
    var x = sorted[hashStr(d + '|excerpt') % sorted.length];
    return { text: x.text, bookTitle: x.bookTitle || '未知书籍', page: num0(x.page) };
  }
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
  /* 导入：明文备份同步完成；加密备份需 password。统一返回 Promise<{ok, error?}>
   * 加密模式下导入必须保持密文落盘；锁定态拒绝导入（防止明文覆盖密文） */
  Store.prototype.importBackup = function (jsonStr, password) {
    var self = this;
    var parsed;
    try { parsed = JSON.parse(jsonStr); } catch (e) { return Promise.resolve({ ok: false, error: '文件不是有效的 JSON' }); }
    if (parsed && parsed.format === BACKUP_ENC_FORMAT) return this._importEncBackup(parsed, password);
    if (!isPlainObject(parsed) || typeof parsed.version !== 'number') {
      return Promise.resolve({ ok: false, error: '文件缺少必要字段(version)，无法识别为备份文件' });
    }
    if (this.needsUnlock()) return Promise.resolve({ ok: false, error: '当前处于锁定态，请先解锁后再导入' });
    this.state = normalize(parsed);
    if (this._encKey) {
      /* 加密解锁态：导入数据以当前密钥落盘，不得明文覆盖密文 */
      var encJson = JSON.stringify(this.state);
      this._lastJson = encJson;
      this._encSave(encJson);
    } else {
      this.save();
    }
    return Promise.resolve({ ok: true });
  };
  Store.prototype._importEncBackup = function (pkg, password) {
    var self = this;
    if (!cryptoReady()) return Promise.resolve({ ok: false, error: '当前环境不支持 Web Crypto' });
    if (typeof password !== 'string' || !password) return Promise.resolve({ ok: false, error: '导入加密备份需要密码' });
    var salt;
    try { salt = Crypto.b64ToBytes(pkg.salt); } catch (e) { return Promise.resolve({ ok: false, error: '备份盐格式无效' }); }
    if (salt.length !== 16) return Promise.resolve({ ok: false, error: '备份盐长度无效' });
    if (this.needsUnlock()) return Promise.resolve({ ok: false, error: '当前处于锁定态，请先解锁后再导入' });
    return Crypto.deriveKey(password, salt).then(function (key) {
      return Crypto.decryptBundle(pkg, key).then(function (json) {
        var parsed;
        try { parsed = JSON.parse(json); } catch (e) { return { ok: false, error: '解密结果不是有效数据' }; }
        if (!isPlainObject(parsed) || typeof parsed.version !== 'number') return { ok: false, error: '解密结果缺少必要字段' };
        self.state = normalize(parsed);
        if (self._encKey) {
          /* 加密解锁态：导入数据以当前密钥落盘，保持密文不变量 */
          var encJson = JSON.stringify(self.state);
          self._lastJson = encJson;
          self._encSave(encJson);
        } else {
          self.save();
        }
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

  /* ====== 本周周报（周一 ~ 周日） ====== */
  Store.prototype.buildWeeklyReport = function (now) {
    var st = this.state;
    var d = now ? new Date(now) : new Date();
    var dw = d.getDay();
    var offset = dw === 0 ? -6 : 1 - dw;
    var mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
    var keyOf = function (x) {
      return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
    };
    var startKey = keyOf(mon);
    var end = new Date(mon);
    end.setDate(end.getDate() + 7);
    var endKey = keyOf(end);
    var inWeek = function (k) { return k >= startKey && k < endKey; };
    var weekKey = function (v) { return String(v || '').slice(0, 10); };

    var tasksTotal = 0, tasksDone = 0;
    st.tasks.forEach(function (t) {
      if (inWeek(weekKey(t.date))) { tasksTotal++; if (t.done) tasksDone++; }
    });
    var readingMinutes = 0;
    (st.books || []).forEach(function (b) {
      var log = b.readingLog || [];
      if (Array.isArray(log)) {
        /* 会话日志形态：[{date, minutes}]，同日多条逐条累加 */
        log.forEach(function (s) {
          if (s && s.date && inWeek(weekKey(s.date))) readingMinutes += (Number(s.minutes) || 0);
        });
      } else {
        /* 兼容旧对象形态 {dateKey: minutes} */
        Object.keys(log).forEach(function (k) { if (inWeek(k)) readingMinutes += log[k]; });
      }
    });
    var memos = 0;
    (st.memos || []).forEach(function (m) {
      if (inWeek(weekKey(m.time))) memos++;
    });
    var topics = 0;
    (st.posts || []).forEach(function (p) {
      if (inWeek(weekKey(p.publishDate || p.date || p.createdAt))) topics++;
    });
    var rate = tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0;
    var endIncl = keyOf(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6));
    var text = [
      '本周周报（' + startKey + ' ~ ' + endIncl + '）',
      '',
      '• 本周计划任务 ' + tasksTotal + ' 条，完成 ' + tasksDone + ' 条（完成率 ' + rate + '%）',
      '• 阅读 ' + readingMinutes + ' 分钟',
      '• 随手记 ' + memos + ' 条',
      '• 新增自媒体选题 ' + topics + ' 个',
      '',
      '—— Sonder 自动生成'
    ].join('\n');
    return {
      start: startKey, end: endIncl, tasksTotal: tasksTotal, tasksDone: tasksDone,
      rate: rate, readingMinutes: readingMinutes, memos: memos, topics: topics, text: text
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
    recentPublished: recentPublished,
    toCSV: toCSV,
    booksByStatus: booksByStatus,
    excerptsByBook: excerptsByBook,
    dailyExcerpt: dailyExcerpt,
    readingStats: readingStats,
    devProgress: devProgress,
    sortNotesByUpdate: sortNotesByUpdate,
    normalize: normalize,
    moduleList: moduleKeysList,
    /* 领域文件（store-tasks/media/content/settings）可用的 core 私有 helper 白名单 */
    _h: {
      uid: uid, nowISO: nowISO, todayStr: todayStr, fmtDate: fmtDate,
      deepClone: deepClone, isPlainObject: isPlainObject, find: find, idxOf: idxOf,
      normalizePriority: normalizePriority, clampOpacity: clampOpacity, normalize: normalize,
      num0: num0, STORAGE_WALLPAPER_KEY: STORAGE_WALLPAPER_KEY
    }
  };
  return api;
});