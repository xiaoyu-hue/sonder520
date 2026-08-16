/* SonderStore - 纯数据层，不依赖 DOM。
 * 兼容浏览器(<script> 暴露 window.SonderStore)与 Node(module.exports)。
 * 测试通过在 Node 中注入内存 storage 来验证全部数据逻辑。
 *
* 文件结构（核心 + 领域扩展）：
 *   store.js          核心：构造、持久化、加密/导入导出 + 共享 helper（api 导出）
 *   store-stats.js    纯函数统计/聚合层（任务分组、自媒体/开发/阅读统计、CSV 等，无 Store 依赖）
 *   store-report.js   Store.prototype.summarize / buildWeeklyReport（计算委托 store-stats）
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
    var Stats = require('./store-stats.js');
    require('./store-report.js')(api.Store, Stats);
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

  /* 统计纯函数层（浏览器：window.SonderStats 须先于本文件加载；Node：require('./store-stats.js')） */
  var Stats = (typeof window !== 'undefined' && window.SonderStats) ||
    (typeof module === 'object' && typeof require === 'function' ? require('./store-stats.js') : null);
  var num0 = Stats.num0;

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
      gameRecords: [],
      /* 单人小游戏最佳纪录（原独立 localStorage key，P3e 并入统一 state：加密/备份/导出随之覆盖） */
      miniRecords: {}
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
    /* 旧客户补默认：projects/followups/income 数组缺失会导致 summarize 与页面渲染崩溃 */
    out.clients.forEach(function (c) {
      if (!Array.isArray(c.projects)) c.projects = [];
      if (!Array.isArray(c.followups)) c.followups = [];
      if (!Array.isArray(c.income)) c.income = [];
      if (typeof c.name !== 'string') c.name = '未命名客户';
    });
    /* 旧选题/旧新闻补默认：tags 数组缺失会导致 filterPosts/collectTags/CSV 导出崩溃 */
    out.posts.forEach(function (p) {
      if (!Array.isArray(p.tags)) p.tags = [];
      if (typeof p.title !== 'string') p.title = '';
    });
    out.news.forEach(function (n) {
      if (!Array.isArray(n.tags)) n.tags = [];
      if (typeof n.title !== 'string') n.title = '';
    });
    /* 旧项目/旧设计补默认 */
    out.devProjects.forEach(function (p) {
      if (!Array.isArray(p.tasks)) p.tasks = [];
      if (typeof p.name !== 'string') p.name = '未命名项目';
    });
    out.designs.forEach(function (x) {
      if (typeof x.title !== 'string') x.title = '';
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
  /** @constructor @this {{ _storage: any, state: any, _meta: any, _idbPromise: any, _persistLocal: any, _idbWrite: any, _lastJson: string, _rev: number, _encKey: any, _encSize: number, _hasEncSnapshot: Function, _idbEncLocked: boolean, _undo: any[], _pendingLocal: any, _localFlushHandle: any, _bus: any, _emitChange: Function, _persistFailed: boolean, _idbFailed: boolean, _lastPersistError: any, _lastSeenMeta: any }} */
  function Store(storage) {
    this._storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    /* SonderBus 数据变更广播总线（浏览器 window.SonderBus / 测试注入；缺省静默） */
    this._bus = (globalThis.SonderBus && globalThis.SonderBus.bus) ? globalThis.SonderBus.bus : null;
    var persisted = null;
    if (this._storage) {
      try { persisted = JSON.parse(this._storage.getItem(STORAGE_KEY)); }
      catch (e) { persisted = null; }
    }
    /* 最近一次确认的权威快照 meta（多标签写锁的版本基线）。
     * 构造时记录当前值；_doLocalFlush 成功落盘后更新为自己写入的 meta。 */
    this._lastSeenMeta = null;
    if (this._storage) {
      try { this._lastSeenMeta = this._storage.getItem(STORAGE_META_KEY) || null; }
      catch (e) { this._lastSeenMeta = null; }
    }
    this.state = normalize(this._hasEncSnapshot() ? null : persisted);
    this._meta = null;
    this._idbPromise = null;
    this._lastJson = null;
    this._rev = 0;
    this._encKey = null;
    this._encSize = 0;
    this._idbEncLocked = false;
    this._undo = []; /* P4c 删除撤销栈（内存态，不持久化）：{list,at,data} 或 {restore} */
    this._pendingLocal = undefined; /* 主快照待写（批量防抖：一次 idle 只落最新一份） */
    this._localFlushHandle = null;  /* 已调度的 requestIdleCallback 句柄（无 idle 时为 null） */
    this._persistFailed = false;    /* localStorage 主快照最近一次写入失败（配额满等） */
    this._idbFailed = false;        /* IndexedDB 兜底副本最近一次写入失败 */
    this._lastPersistError = null;  /* 最近一次持久化错误（诊断用） */
  }

  /* P4c：删除撤销——记录删除条目（容量 10，超出丢最旧），undoRemove 恢复 */
  Store.prototype._undoPush = function (u) {
    this._undo.push(u);
    if (this._undo.length > 10) this._undo.shift();
  };
  /* P4c：撤销最近一次删除；成功返回被恢复的数据，无可撤销返回 null */
  Store.prototype.undoRemove = function () {
    var u = this._undo.pop();
    if (!u) return null;
    if (u.restore) {
      u.restore(this.state);
    } else {
      var arr = this.state[u.list];
      if (!Array.isArray(arr)) return null;
      arr.splice(Math.min(u.at, arr.length), 0, u.data);
    }
    this.save();
    this._emitChange(u.list || 'all'); /* 撤销恢复：广播受影响数据 */
    return u.data || true;
  };

  /* SonderBus 数据变更广播：集合方法在 save() 后调用（list 为数据键名）。
   * 无 bus（测试/降级）时静默；页面模块据此自动重绘。 */
  Store.prototype._emitChange = function (list) {
    if (this._bus) this._bus.emit('/data/' + list);
  };

  /* 主快照是否为密文（未解锁时据此判定"需要解锁"）。
   * 只看加密标记 e===1：未知/未来版本（v !== ENC_FORMAT）同样认定加密 → 走锁定流，
   * 防止旧客户端把新密文当明文解析、normalize 清空数据后明文覆盖（不可逆丢失）。
   * 轻量探测：本站密文 payload 恒以 {"e":1 开头（store._encSave 固定格式），
   * 用正则判定避免每次 needsUnlock 全量 JSON.parse 主快照（save 热路径，未加密用户每写必走）。 */
  Store.prototype._hasEncSnapshot = function () {
    if (!this._storage) return false;
    try {
      var raw = this._storage.getItem(STORAGE_KEY);
      if (!raw) return false;
      return /^\s*\{\s*"e"\s*:\s*1[\s,}]/.test(raw);
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

  /* 主快照 setItem 批量防抖：放入 requestIdleCallback 执行，页面空闲时统一落盘。
   * 一次 idle 周期内多次 save 只写最新快照（_pendingLocal 覆盖），避免密集保存
   * 反复序列化写 localStorage 阻塞主线程。无 requestIdleCallback 的环境
   * （Node/测试/旧浏览器）同步落盘，保证存储一致性。
   * 加密盐/壁纸等一次性关键 setItem 保持同步（正确性优先，非热路径）。
   * 可传入 save 已序列化的 json 避免二次 stringify。 */
  /** @this {{ _storage: any, state: any, _meta: any, _pendingLocal: any, _localFlushHandle: any, _doLocalFlush: Function, _lockedLocalFlush: Function }} */
  Store.prototype._persistLocal = function (json) {
    if (!this._storage) return;
    this._meta = nowISO();
    this._pendingLocal = json || JSON.stringify(this.state);
    if (this._localFlushHandle !== null) return; /* 已调度 idle：仅更新待写内容（防抖合并） */
    var self = this;
    if (typeof globalThis.requestIdleCallback === 'function') {
      this._localFlushHandle = globalThis.requestIdleCallback(function () {
        self._localFlushHandle = null;
        self._lockedLocalFlush();
      }, { timeout: 900 });
    } else {
      this._doLocalFlush(); /* 无 idle API：同步落盘 */
    }
  };

  /* Web Locks 多标签写锁：navigator.locks 可用时（Chrome 69+/FF 96+/Safari 15.4+）
   * 防抖落盘点在本标签持锁回调内执行；拿锁失败/环境不支持 → 降级直接落盘（等价旧行为）。
   * 跨标签竞态防护见 _lockedLocalFlush 内写前 meta 检查（另一标签已写更新快照时让位不覆盖）。 */
  Store.prototype._lockedLocalFlush = function () {
    var self = this;
    var locks = (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function')
      ? navigator.locks : null;
    if (!locks) { this._doLocalFlush(); return; }
    var done = false;
    var fallback = function () { if (done) return; done = true; self._doLocalFlush(); };
    var p = null;
    try {
      p = locks.request('sonder-writer', function () {
        /* 锁内：写前检查权威快照是否已被其他标签更新（meta 版本比较）。
         * 本实例自上次确认后未见过的更新 meta → 本次待写基于旧内存 state，
         * 直接覆盖会丢新数据（LWW 丢数据场景）→ 让位：吸收新快照、不覆盖。
         * 相同/更旧 meta → 正常落盘。 */
        if (self._storage) {
          var curMeta = null;
          try { curMeta = self._storage.getItem(STORAGE_META_KEY); } catch (e) { curMeta = null; }
          /* 权威快照 meta 与本实例基线不一致（另一标签已写/外部变更）→ 让位不覆盖 */
          if (curMeta && curMeta !== self._lastSeenMeta) {
            done = true;
            self._absorbNewer();
            return;
          }
        }
        done = true;
        self._doLocalFlush();
      });
      if (p && typeof p.catch === 'function') p.catch(fallback);
    } catch (e) { fallback(); }
  };

  /* 让位：放弃本次旧快照覆盖，改为吸收 localStorage 中的最新权威快照（其他标签已写更新）。
   * 重载后重置内存基线并广播全量重绘；密文快照走 _decryptParse（有会话密钥时）。
   * 无论吸收结果如何（含解析失败保持现状），先广播让位事件——另一标签已接管，
   * 本标签未保存的输入已被放弃，UI 应即时提示用户。 */
  /** @this {{ _storage: any, state: any, _lastJson: string, _rev: number, _lastSeenMeta: any, _emitChange: Function, _decryptParse: Function, _pendingLocal: any, _bus: any }} */
  Store.prototype._absorbNewer = function () {
    if (this._bus) this._bus.emit('/store/yielded');
    this._pendingLocal = undefined;
    var self = this;
    var raw = null;
    if (this._storage) {
      try { raw = this._storage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    }
    if (raw === null || raw === undefined) return;
    this._decryptParse(raw).then(function (parsed) {
      if (!parsed) return; /* 密文未解锁/解析失败：不覆盖也不吸收，保持现状 */
      self.state = normalize(parsed);
      self._lastJson = JSON.stringify(self.state);
      self._rev++;
      if (self._storage) {
        try { self._lastSeenMeta = self._storage.getItem(STORAGE_META_KEY) || null; } catch (e) { /* 忽略 */ }
      }
      self._emitChange('all'); /* 采纳新快照：全量重绘 */
    });
  };

  /* 实际写 localStorage（权威快照；写满时记失败标记，IDB 副本兜底）。只写 _pendingLocal 最新一份 */
  /** @this {{ _storage: any, _meta: any, _pendingLocal: any, _persistFailed: boolean, _lastPersistError: any, _lastSeenMeta: any }} */
  Store.prototype._doLocalFlush = function () {
    if (this._pendingLocal === undefined) return;
    var json = this._pendingLocal;
    this._pendingLocal = undefined;
    try {
      this._storage.setItem(STORAGE_KEY, json);
      this._storage.setItem(STORAGE_META_KEY, this._meta);
      this._persistFailed = false;
      this._lastPersistError = null;
      this._lastSeenMeta = this._meta; /* 多标签写锁基线：本实例已落盘的权威版本 */
    } catch (e) {
      /* 存储满（QuotaExceededError / NS_ERROR_DOM_QUOTA_REACHED）等错误：置失败标记。
       * 数据仍在内存与 IDB 副本侧；若 IDB 也不可用则 hasPersistIssue() 指挥 UI 提示导出 */
      this._persistFailed = true;
      this._lastPersistError = e;
    }
  };

  /* 立即执行待写快照并作废已调度的 idle 写入。加密启用/停用/回读验证等
   * 正确性关键路径调用（这些路径依赖落盘与后续读取在同一时机）。 */
  /** @this {{ _storage: any, _localFlushHandle: any, _pendingLocal: any, _doLocalFlush: Function }} */
  Store.prototype.flushPersist = function () {
    if (this._localFlushHandle !== null) {
      if (typeof globalThis.cancelIdleCallback === 'function') globalThis.cancelIdleCallback(this._localFlushHandle);
      this._localFlushHandle = null;
    }
    if (this._pendingLocal !== undefined) this._doLocalFlush();
  };

  /* 异步写 IndexedDB。串行队列避免事务竞争；失败静默（localStorage 仍兜底）。
   * 只接受调用方显式传入的原始串（明文或密文格式原样落盘），extra 合并进 entry（如加密盐）。
   * undefined/null/空串一律跳过——绝不回退到内存 state 序列化：锁定态下内存是明文空
   * defaultState，回退写盘会把明文空数据写进 IDB，破坏密文兜底副本（loadIdb 空 IDB 回填路径）。 */
  /** @this {{ _storage: any, state: any, _meta: any, _idbPromise: any, _persistLocal: any, _idbWrite: any, _lastJson: string, _rev: number, _idbFailed: boolean }} */
  Store.prototype._idbWrite = function (json, extra) {
    if (!idbAvailable()) return;
    if (json === undefined || json === null || json === '') return;
    var useJson = json;
    var meta = this._meta || nowISO();
    var prev = this._idbPromise || Promise.resolve();
    var self = this;
    this._idbPromise = prev.then(function () {
      return openIdb().then(function (db) {
        var entry = extra ? Object.assign({}, extra) : {};
        entry.savedAt = meta;
        entry.data = useJson;
        return idbPut(db, IDB_KEY, entry);
      });
    }).then(function () {
      self._idbFailed = false; /* 兜底副本写入成功：解除 IDB 侧失败标记 */
    }).catch(function (err) {
      /* IDB 写入失败不影响主流程（localStorage 仍兜底），但记失败标记并上报便于发现环境问题 */
      self._idbFailed = true;
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
  /** @this {{ _storage: any, _encKey: any, _encSize: number, _persistLocal: any, _idbWrite: any, _encChain: Promise, flushPersist: Function }} */
  Store.prototype._encSave = function (json) {
    var self = this;
    if (!this._encKey || !Crypto) return Promise.resolve();
    var prev = self._encChain || Promise.resolve();
    self._encChain = prev.then(function () {
      return Crypto.encryptText(json, self._encKey).then(function (bundle) {
        var payload = JSON.stringify({ e: 1, v: bundle.v, iv: bundle.iv, data: bundle.data });
        self._encSize = payload.length;
        self._persistLocal(payload);
        self.flushPersist(); /* 加密落盘即时可见：enableEncryption 回读验证依赖 LS 已写入 */
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
  /** @this {{ _storage: any, state: any, _meta: any, _idbPromise: any, _persistLocal: any, _idbWrite: any, _lastJson: string, _rev: number, save: Function, _encKey: any, _decryptParse: Function, _idbEncLocked: boolean, flushPersist: Function, _emitChange: Function }} */
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
          self.flushPersist(); /* IDB 恢复回写 localStorage：采用后立即可见 */
          self._idbWrite(idbData);
          self._emitChange('all'); /* 恢复采用：全量数据替换，各页重绘 */
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
    if (parsed && parsed.e === 1) {
      /* 未知/未来加密版本（v !== ENC_FORMAT）：不可按明文解析（normalize 会清空数据字段），
       * 一律返回 null —— loadIdb 据此标记 _idbEncLocked 走解锁 UI，数据原样保留、绝不落盘 */
      if (parsed.v !== ENC_FORMAT) return Promise.resolve(null);
      if (!self._encKey || !Crypto) return Promise.resolve(null);
      return Crypto.decryptBundle(parsed, self._encKey).then(function (json) {
        try { return JSON.parse(json); } catch (e) { return null; }
      }).catch(function () { return null; });
    }
    return Promise.resolve(parsed);
  };

  /* 手动迁移：立即把当前全部数据写入 IndexedDB（只复制不删旧数据） */
  /** @this {{ _storage: any, state: any, _meta: any, _idbPromise: any, _persistLocal: any, _idbWrite: any, _encKey: any, _encSave: Function, needsUnlock: Function }} */
  Store.prototype.migrateToIdb = function () {
    var self = this;
    if (!idbAvailable()) return Promise.resolve(false);
    /* 锁定态守卫：内存是明文空 defaultState，序列化直写会以明文空数据覆盖 IDB 密文兜底 */
    if (this.needsUnlock()) return Promise.resolve(false);
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
  /* 持久化健康：localStorage 主快照写入失败，且 IndexedDB 兜底副本也不可用或已失败时，
   * 数据只存在于内存（刷新即丢）→ 返回 true。UI 据此显示"立即导出备份"危机警示条
   * （区别于接近上限的温和提醒；危机不写 quotaNoticeDismissed，无法一键永久关闭）。
   * 任一侧后续写入成功即自动复位。 */
  Store.prototype.hasPersistIssue = function () {
    return !!this._persistFailed && (!idbAvailable() || !!this._idbFailed);
  };
  /* 最近一次持久化错误对象（诊断用；无失败时为 null） */
  Store.prototype.persistIssueDetail = function () {
    return this._lastPersistError;
  };
  Store.prototype.dismissQuotaNotice = function () {
    this.state.settings.quotaNoticeDismissed = true;
    this.save();
    this._emitChange('settings');
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
  Store.prototype.encryptionMode = function () {
    return this._encKey ? 'unlocked' : (this.needsUnlock() ? 'locked' : 'off');
  };
  Store.prototype.lock = function () {
    this._encKey = null;
    this._emitChange('all'); /* 锁定：全页重绘进入解锁界面 */
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
          self._emitChange('all'); /* 加密状态切换：全页重绘 */
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
      self.flushPersist(); /* 兜底明文必须立即可见，避免异常后停留半密文状态 */
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
          return self._encSave(self._lastJson).then(function () {
            self._emitChange('all'); /* 解锁完成：全页重绘 */
            return true;
          });
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
          self.flushPersist(); /* 密文→明文切换必须即时完成 */
          self._idbWrite(plain);
          self._emitChange('all'); /* 加解密切换：全页重绘反映加密状态 */
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
      return Crypto.encryptText(JSON.stringify(dec), self._encKey).then(function (bundle) {
        return JSON.stringify({ format: BACKUP_ENC_FORMAT, salt: Crypto.bytesToB64(salt), iv: bundle.iv, data: bundle.data }, null, 2);
      });
    });
  };
  /* 导入：明文备份同步完成；加密备份需 password。统一返回 Promise<{ok, error?}>
   * 加密模式下导入必须保持密文落盘；锁定态拒绝导入（防止明文覆盖密文） */
  Store.prototype.importBackup = function (jsonStr, password) {
    var parsed;
    try { parsed = JSON.parse(jsonStr); } catch (e) { return Promise.resolve({ ok: false, error: '文件不是有效的 JSON' }); }
    if (parsed && parsed.format === BACKUP_ENC_FORMAT) return this._importEncBackup(parsed, password);
    if (!isPlainObject(parsed) || typeof parsed.version !== 'number') {
      return Promise.resolve({ ok: false, error: '文件缺少必要字段(version)，无法识别为备份文件' });
    }
    if (this.needsUnlock()) return Promise.resolve({ ok: false, error: '当前处于锁定态，请先解锁后再导入' });
    this.state = normalize(parsed);
    if (this._encKey) {
      /* 加密解锁态：导入数据以当前密钥落盘，不得明文覆盖密文。
       * 必须返回落盘链：resolve 前保证持久化完成，防止调用方立即刷新丢数据。 */
      var self = this;
      var encJson = JSON.stringify(this.state);
      this._lastJson = encJson;
      return this._encSave(encJson).then(function () {
        self._emitChange('all'); /* 导入覆盖全量数据：各页重绘 */
        return { ok: true };
      });
    }
    this.save();
    this._emitChange('all'); /* 导入覆盖全量数据：各页重绘 */
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
          /* 加密解锁态：导入数据以当前密钥落盘，保持密文不变量。
           * 必须返回落盘链：导入是一次性操作，resolve 前保证持久化完成，
           * 否则调用方立即刷新页面会丢失刚导入的数据（无法像普通 save 那样下次重试）。 */
          var encJson = JSON.stringify(self.state);
          self._lastJson = encJson;
          return self._encSave(encJson).then(function () {
            self._emitChange('all');
            return { ok: true };
          });
        } else {
          self.save();
          self._emitChange('all'); /* 导入覆盖全量数据：各页重绘 */
          return Promise.resolve({ ok: true });
        }
      }).catch(function () {
        return { ok: false, error: '密码错误或备份已损坏，导入中止（原数据未动）' };
      });
    });
  };

  /* 独立工具导出（供模块与测试使用）。纯函数统计/汇总（groupTasks/readingStats/summarize 等）
   * 已迁至 store-stats.js / store-report.js，此处代理导出以保持既有调用面不变。 */
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
    groupTasks: Stats.groupTasks,
    todayProgress: Stats.todayProgress,
    normalizePriority: normalizePriority,
    filterPosts: Stats.filterPosts,
    collectTags: Stats.collectTags,
    publishedStats: Stats.publishedStats,
    recentPublished: Stats.recentPublished,
    toCSV: Stats.toCSV,
    booksByStatus: Stats.booksByStatus,
    excerptsByBook: Stats.excerptsByBook,
    dailyExcerpt: Stats.dailyExcerpt,
    readingStats: Stats.readingStats,
    devProgress: Stats.devProgress,
    sortNotesByUpdate: Stats.sortNotesByUpdate,
    normalize: normalize,
    moduleList: Stats.moduleKeysList,
    /* 领域文件（store-tasks/media/content/settings/report）可用的 core 私有 helper 白名单 */
    _h: {
      uid: uid, nowISO: nowISO, todayStr: todayStr, fmtDate: fmtDate,
      deepClone: deepClone, isPlainObject: isPlainObject, find: find, idxOf: idxOf,
      normalizePriority: normalizePriority, clampOpacity: clampOpacity, normalize: normalize,
      num0: Stats.num0, hashStr: Stats.hashStr, STORAGE_WALLPAPER_KEY: STORAGE_WALLPAPER_KEY
    }
  };
  return api;
});