/* SonderStore - 纯数据层，不依赖 DOM。
 * 兼容浏览器(<script> 暴露 window.SonderStore)与 Node(module.exports)。
 * 测试通过在 Node 中注入内存 storage 来验证全部数据逻辑。
 *
* 文件结构（核心 + 领域扩展）：
 *   store.js                核心：构造、加密/解密 + 共享 helper（api 导出）与 _h 白名单
 *   store-stats.js          纯函数统计/聚合层（任务分组、自媒体/开发/阅读统计、CSV 等，无 Store 依赖）
 *   store-report.js         Store.prototype.summarize / buildWeeklyReport（计算委托 store-stats）
 *   store-undo.js           删除撤销（_undoPush/undoRemove）
 *   store-persistence.js    持久化核心（LS/IDB 读写、save/_commit、写锁收口 ADR-013）
 *   store-migration.js      legacy 拆分迁移 + IDB 读取（loadIdb/migrateToIdb）
 *   store-import-export.js  备份导出/导入/清空（readSnapshot/exportBackup/importBackup/clearAll）
 *   store-tasks.js          快速备忘 + 今日计划
 *   store-media.js          自媒体 + 开发工作 + 技术笔记/代码片段
 *   store-content.js        咨询 + 阅读/书摘 + 新闻 + 设计 + 游戏记录
 *   store-settings.js       主题/壁纸/提醒/模块开关/难度/帧率
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
    require('./store-undo.js')(api.Store, api._h);
    require('./store-persistence.js')(api.Store, api._h);
    require('./store-migration.js')(api.Store, api._h);
    require('./store-import-export.js')(api.Store, api._h);
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
/* 自定义壁纸（base64 data URL，独立存放：不进持久化快照 LS 副本/IDB 主快照，避免撑爆配额） */
var STORAGE_WALLPAPER_KEY = 'sonder_wallpaper_v1';
  var ENC_FORMAT = 'sonder-enc-v1';
  var BACKUP_ENC_FORMAT = 'sonder-enc-backup-v1';

  /* ---------- 集合级持久化（ADR-009 决策 7）----------
   * 每集合独立 key：LS `sonder_col_<id>_v1` / IDB key `<id>`（现有 state store，entry {savedAt,data} 不变）。
   * 写路径只序列化+落盘变更集合；读路径逐集合按 savedAt 取新合并；
   * legacy 整份（STORAGE_KEY / IDB 'state'）作迁移来源一次性拆分，旧 key 保留不删（回滚安全）。 */
  var GRANULAR_FLAG = 'sonder_granular_v1';
  var COLL_PREFIX = 'sonder_col_';
  var COLL_SUFFIX = '_v1';
  function colLsKey(id) { return COLL_PREFIX + id + COLL_SUFFIX; }
  /* 核心集合（defaultState 固定 14 项）；工厂模块集合经 _registerCollection 动态并入 */
  var CORE_COLLECTIONS = ['settings', 'memos', 'tasks', 'posts', 'devProjects', 'devNotes',
    'devSnippets', 'clients', 'books', 'excerpts', 'news', 'designs', 'gameRecords', 'miniRecords'];
  var COLLECTIONS = CORE_COLLECTIONS.slice();
  /* settings 集合的序列化形态：{version, settings}（版本号随 settings 走，不单独立 key） */
  function colPayload(state, col) {
    if (col === 'settings') {
      return { version: typeof state.version === 'number' ? state.version : 1, settings: state.settings || {} };
    }
    return state[col];
  }
  /* 把集合 payload 合并进 base（读路径装配；settings 特殊：version + settings 均并入） */
  function mergeColInto(base, col, payload) {
    if (col === 'settings') {
      if (!isPlainObject(payload)) return;
      if (isPlainObject(payload.settings)) base.settings = payload.settings;
      if (typeof payload.version === 'number') base.version = payload.version;
      return;
    }
    if (Array.isArray(payload)) base[col] = payload.slice();
    else if (isPlainObject(payload)) base[col] = deepClone(payload);
  }
  /* 明文密文探测（轻量正则：本站密文 payload 恒以 {"e":1 开头，避免全量 JSON.parse） */
  function isEncRaw(raw) {
    return !!raw && /^\s*\{\s*"e"\s*:\s*1[\s,}]/.test(raw);
  }

  /* ---------- IndexedDB 层 ----------
   * 主快照 = IndexedDB（真源，容量大）；localStorage = 副本（降级后备镜像，
   * 兼跨标签写锁协议基线）。每次保存双写双存，任一被清空时另一份恢复。
   * 冲突以 savedAt 时间戳取新。 */
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
  /* C-7：单例连接缓存（壁纸等轻量独立 entry 读写复用，失败后重置以便重试） */
  var dbReadyPromise = null;
  function idbReady() {
    if (!idbAvailable()) return Promise.reject(new Error('idb-unavailable'));
    if (!dbReadyPromise) {
      dbReadyPromise = openIdb().then(function (db) {
        /* F-8：浏览器可能回收 IDB 连接（内存压力 onclose / 版本变更 onversionchange）。
         * 连接失效后重置单例，下次读写自动重新打开——否则后续写入会全部静默失败
         * 直到用户手动刷新页面。 */
        db.onclose = function () { dbReadyPromise = null; };
        db.onversionchange = function () { dbReadyPromise = null; };
        return db;
      }).catch(function (e) { dbReadyPromise = null; throw e; });
    }
    return dbReadyPromise;
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
  function idbDel(db, key) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = function () { resolve(null); };
      tx.onerror = function () { reject(tx.error || new Error('idb-del')); };
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
  /* 持久化失败原因归类（结构化状态 status.reason 用；未知错误一律归 storage_error） */
  function classifyFailReason(e) {
    var name = e && e.name ? String(e.name) : '';
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return 'quota';
    if (name === 'SecurityError') return 'security';
    return 'storage_error';
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
      game: true, 'desktop-pet': true
    },
    quotaNoticeDismissed: false,
    taskReminder: false,
    desktopPet: {
      enabled: true,
      mode: 'duo',
      resident: 'xiaomo',
      size: 84,
      layout: 'bottom-right',
      positions: {
        xiaomo: { x: null, y: null },
        xiaoyu: { x: null, y: null },
        lanling: { x: null, y: null }
      },
      coins: 0,
      affection: { xiaomo: 0, xiaoyu: 0, lanling: 0 },
      inventory: {},
      totalFed: { xiaomo: 0, xiaoyu: 0, lanling: 0 },
      rewardedTaskIds: [],
      achievements: {
        unlocked: [],
        stats: { totalTasksDone: 0, lastActiveDay: null, streakDays: 0, totalFeeds: 0 }
      },
      schemaVersion: 1
    }
  };

  /* 工厂注册的标准模块集合（ModuleFactory.createModule → _registerCollection）。
   * 纳入 defaultState 与 normalize 白名单：重载/导入/解密/清空后保留且保底空数组，
   * 防止工厂模块数据被静默丢弃（数据安全优先）。 */
  var EXTRA_COLLECTIONS = [];

  function defaultState() {
    var base = {
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
    EXTRA_COLLECTIONS.forEach(function (k) { base[k] = []; });
    return base;
  }

  /* EventBridge 事件路径：浏览器经 SonderBus.EVENT 常量表取事件名（新代码唯一真源），
   * Node 独立加载（无全局总线）时回落等价字面量——两条路径输出恒等，
   * 订阅端无论走常量表还是字面量都收到同一路径。
   * kind: 'data'（/data/<集合> 广播）| 'yielded'（多标签让位）。 */
  function dataEvent(kind, key) {
    var E = globalThis.SonderBus && globalThis.SonderBus.EVENT;
    if (kind === 'data') {
      return (E && E.data) ? E.data(key) : '/data/' + key;
    }
    return (E && E.STORE_YIELDED) ? E.STORE_YIELDED : '/store/yielded';
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
      /* 进度数值夹紧（P1 安全修复）：导入路径原样保留任意类型 progress，
       * 消费点 `style="width:…%"` 裸插值可被属性逃逸（写入侧已夹紧，此处补齐读取侧） */
      b.progress = Math.max(0, Math.min(100, num0(b.progress)));
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
    /* 导入信任边界收口（P1 安全修复）：id 白名单校验 + 非法重生、书籍进度数值夹紧。
     * 背景：normalize 原样拷贝持久化/导入数据的任意字符串 id，而全应用 data-* 属性位
     * 裸插值建立在"id 恒为 uid() 生成（无引号/尖括号/空白）"的不变量上；恶意备份文件
     * 可借属性逃逸注入 DOM。此处统一重生非法 id，数字 id 不受影响。 */
    sanitizeStateIds(out);
    return out;
  }

  /* id 白名单：字母/数字/连字符/下划线，1-80 位（uid() 输出与历史合法 id 全兼容；
   * 引号/尖括号/空白/= & 等属性逃逸字符一律命中不了白名单）。 */
  var SAFE_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
  function sanitizeId(id) {
    return (typeof id === 'string' && SAFE_ID_RE.test(id)) ? id : uid();
  }
  /* 深度遍历 state，逐记录收口 id 字段（含 devProjects.tasks / clients.projects 等嵌套集合） */
  function sanitizeStateIds(node) {
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) sanitizeStateIds(node[i]);
      return;
    }
    if (!isPlainObject(node)) return;
    if ('id' in node) node.id = sanitizeId(node.id);
    for (var k in node) sanitizeStateIds(node[k]);
  }

  /* ---------- 桌面玩偶深合并迁移（自包含，store.js 加载先于 desktop-pet.js） ---------- */
  var DP_ROLE_IDS = ['xiaomo', 'xiaoyu', 'lanling'];
  var DP_MODES = ['single', 'duo', 'trio'];

  function mergeDesktopPetDefaults(raw) {
    var dflt = DEFAULT_SETTINGS.desktopPet;
    var out = deepClone(dflt);
    if (!raw || typeof raw !== 'object') return out;
    if (typeof raw.enabled === 'boolean') out.enabled = raw.enabled;
    if (DP_MODES.indexOf(raw.mode) !== -1) out.mode = raw.mode;
    if (DP_ROLE_IDS.indexOf(raw.resident) !== -1) out.resident = raw.resident;
    if (typeof raw.size === 'number') out.size = Math.max(48, Math.min(160, Math.round(raw.size)));
    if (raw.layout === 'bottom-right' || raw.layout === 'bottom-left' || raw.layout === 'auto') out.layout = raw.layout;
    if (raw.positions && typeof raw.positions === 'object') {
      DP_ROLE_IDS.forEach(function (id) {
        var p = raw.positions[id];
        out.positions[id] = (p && typeof p === 'object')
          ? { x: typeof p.x === 'number' ? p.x : null, y: typeof p.y === 'number' ? p.y : null }
          : { x: null, y: null };
      });
    }
    if (typeof raw.coins === 'number') out.coins = Math.max(0, Math.round(raw.coins));
    if (raw.affection && typeof raw.affection === 'object') {
      DP_ROLE_IDS.forEach(function (id) {
        if (typeof raw.affection[id] === 'number') out.affection[id] = Math.max(0, Math.round(raw.affection[id]));
      });
    }
    if (raw.inventory && typeof raw.inventory === 'object') out.inventory = deepClone(raw.inventory);
    if (raw.totalFed && typeof raw.totalFed === 'object') {
      DP_ROLE_IDS.forEach(function (id) {
        if (typeof raw.totalFed[id] === 'number') out.totalFed[id] = Math.max(0, Math.round(raw.totalFed[id]));
      });
    }
    if (Array.isArray(raw.rewardedTaskIds)) out.rewardedTaskIds = raw.rewardedTaskIds.slice(0, 500);
    if (raw.achievements && typeof raw.achievements === 'object') {
      if (Array.isArray(raw.achievements.unlocked)) out.achievements.unlocked = raw.achievements.unlocked.slice();
      var st = raw.achievements.stats || {};
      out.achievements.stats = {
        totalTasksDone: typeof st.totalTasksDone === 'number' ? Math.max(0, st.totalTasksDone) : 0,
        lastActiveDay: typeof st.lastActiveDay === 'string' ? st.lastActiveDay : null,
        streakDays: typeof st.streakDays === 'number' ? Math.max(0, st.streakDays) : 0,
        totalFeeds: typeof st.totalFeeds === 'number' ? Math.max(0, st.totalFeeds) : 0
      };
    }
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
      s.desktopPet = mergeDesktopPetDefaults(raw.desktopPet);
    }
    return s;
  }

  function clampOpacity(v) {
    var n = Number(v);
    if (isNaN(n)) return 40;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  /* ---------- Store ---------- */
  /** @constructor @this {{ _storage: any, state: any, _meta: any, _idbPromise: any, _persistLocal: any, _storeWrite: Function, _idbWriteCols: any, _colJson: any, _rev: number, _encKey: any, _hasEncSnapshot: Function, _hasLegacySnapshot: Function, _readLocalColsRaw: Function, _idbEncLocked: boolean, _undo: any[], _pendingLocalCols: any, _localFlushHandle: any, _bus: any, _emitChange: Function, _persistFailed: boolean, _idbFailed: boolean, _lastPersistError: any, _statusReason: string, _lastSeenMeta: any, _bindStorageWatch: Function, _wallpaperCache: (string | null) }} */
  function Store(storage) {
    this._storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    /* SonderBus 数据变更广播总线（浏览器 window.SonderBus / 测试注入；缺省静默） */
    this._bus = (globalThis.SonderBus && globalThis.SonderBus.bus) ? globalThis.SonderBus.bus : null;
    this._lastSeenMeta = null;
    if (this._storage) {
      try { this._lastSeenMeta = this._storage.getItem(STORAGE_META_KEY) || null; }
      catch (e) { this._lastSeenMeta = null; }
    }
    /* 构造期同步读 LS 集合级 key（逐集合明文合并；密文集合跳过——等异步 loadIdb/unlock）。
     * 无集合级数据 → 回落 legacy 整份（STORAGE_KEY），保持旧行为。 */
    var localCols = this._readLocalColsRaw();
    if (Object.keys(localCols).length > 0) {
      var base = defaultState();
      for (var id in localCols) {
        var parsed = null;
        try { parsed = JSON.parse(localCols[id]); } catch (e) { parsed = null; }
        /* 集合 key 内存的就是 payload（settings 为 {version,settings}，其余为数组/对象），
         * 不得再经 colPayload 当整份 state 解——否则 memos 等会变成 parsed.memos === undefined。 */
        if (!parsed || parsed.e === 1) continue;
        mergeColInto(base, id, parsed);
      }
      this.state = normalize(base);
    } else {
      var persisted = null;
      if (this._storage) {
        try { persisted = JSON.parse(this._storage.getItem(STORAGE_KEY)); }
        catch (e) { persisted = null; }
      }
      this.state = normalize(this._hasLegacySnapshot() ? null : persisted);
    }
    this._meta = null;
    this._idbPromise = null;
    this._colJson = {};      /* 集合 id → 最近一次落盘串（明文/密文），写路径去重 + storageUsage 体积 */
    this._wallpaperCache = null; /* C-7：自定义壁纸 dataURL 内存缓存（getCustomWallpaper 同步返回，IDB/LS 双写） */
    this._rev = 0;
    this._encKey = null;
    this._idbEncLocked = false;
    this._undo = []; /* P4c 删除撤销栈（内存态，不持久化）：{list,at,data} 或 {restore} */
    this._pendingLocalCols = null; /* 待写集合 map（批量防抖：一次 idle 落最新；null=无待写） */
    this._localFlushHandle = null;  /* 已调度的 requestIdleCallback 句柄（无 idle 时为 null） */
    this._persistFailed = false;    /* localStorage 副本最近一次写入失败（配额满等；主快照 IndexedDB 不受影响） */
    this._idbFailed = false;        /* IndexedDB 主快照最近一次写入失败 */
    this._lastPersistError = null;  /* 最近一次持久化错误（诊断用） */
    this._statusReason = null;      /* 最近一次持久化失败的原因分类（quota 等，结构化状态派生用） */
    this._bindStorageWatch(); /* 跨标签被动收敛（P2）：空闲标签吸收外部更新 */
  }

  /* 逐注册集合读 LS 原始串（缺失 key 不进入 map）；密文/明文原样返回 */
  Store.prototype._readLocalColsRaw = function () {
    var map = {};
    if (!this._storage) return map;
    for (var i = 0; i < COLLECTIONS.length; i++) {
      try {
        var raw = this._storage.getItem(colLsKey(COLLECTIONS[i]));
        if (raw !== null && raw !== undefined) map[COLLECTIONS[i]] = raw;
      } catch (e) { /* 忽略 */ }
    }
    return map;
  };
  /* 是否存在尚未集合化的 legacy 密文整份（LS STORAGE_KEY 为密文） */
  Store.prototype._hasLegacySnapshot = function () {
    if (!this._storage) return false;
    try { return isEncRaw(this._storage.getItem(STORAGE_KEY)); }
    catch (e) { return false; }
  };

  /* P4c：删除撤销——已迁 store-undo.js（_undoPush/undoRemove），此处仅保留注册方法 */
  /* 工厂扩展：注册标准模块集合 key（幂等；ModuleFactory.createModule 调用）。
   * 使该集合进入 normalize 白名单——重载/导入/解密后数据不被丢弃，并保底为空数组；
   * 同时并入 COLLECTIONS——集合级读写路径（LS 每集合 key / IDB entry / 启动合并）必须覆盖工厂集合。
   * 注意：Store 构造期注册前已用 CORE 集合读 LS；工厂集合数据由 loadIdb 逐集合合并补全。 */
  Store.prototype._registerCollection = function (key) {
    if (typeof key !== 'string' || !key) return;
    if (EXTRA_COLLECTIONS.indexOf(key) < 0) EXTRA_COLLECTIONS.push(key);
    if (COLLECTIONS.indexOf(key) < 0) COLLECTIONS.push(key);
  };

  /* SonderBus 数据变更广播：集合方法在 save() 后调用（list 为数据键名）。
   * 无 bus（测试/降级）时静默；页面模块据此自动重绘。
   * 事件路径经 EventBridge 常量表生成（Node 独立加载回落字面量，路径等价）。 */
  Store.prototype._emitChange = function (list) {
    if (this._bus) this._bus.emit(dataEvent('data', list));
  };

  /* 是否存在密文快照（LS 任一集合 key 为密文，或遗留整份为密文）。
   * 未解锁时据此判定"需要解锁"：只看密文标记 e===1——未知/未来版本同样认定加密 → 走锁定流，
   * 防止旧客户端把新密文当明文解析、normalize 清空数据后明文覆盖（不可逆丢失）。
   * 轻量探测：本站密文 payload 恒以 {"e":1 开头（store._encSave 固定格式），正则判定避免全量 JSON.parse。
   * 只对已知集合 key 逐个探测，不依赖 localStorage 遍历 API（内存存储/测试环境兼容）。 */
  /* ==================== TrustLayer: 加密探测 ==================== */
  Store.prototype._hasEncSnapshot = function () {
    if (!this._storage) return false;
    try {
      if (isEncRaw(this._storage.getItem(STORAGE_KEY))) return true;
    } catch (e) { /* 继续 */ }
    for (var i = 0; i < COLLECTIONS.length; i++) {
      try {
        if (isEncRaw(this._storage.getItem(colLsKey(COLLECTIONS[i])))) return true;
      } catch (e) { /* 继续 */ }
    }
    return false;
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
  /* 盐获取（localStorage 缺失时从 IndexedDB 冗余读取，配合双写恢复）。
   * 集合级：盐存于各集合 entry.extra；回退读 CORE 首集合（settings），再回退 legacy 整份 entry。 */
  Store.prototype._encSaltAsync = function () {
    var local = this._encSalt();
    if (local) return Promise.resolve(local);
    if (!idbAvailable()) return Promise.resolve(null);
    return openIdb().then(function (db) {
      function saltFrom(entry) {
        if (!entry || typeof entry !== 'object' || !entry.salt || !Crypto) return null;
        try {
          var bytes = Crypto.b64ToBytes(entry.salt);
          return bytes.length === 16 ? bytes : null;
        } catch (e) { return null; }
      }
      return idbGet(db, COLLECTIONS[0]).then(function (entry) {
        var s = saltFrom(entry);
        if (s) return s;
        return idbGet(db, IDB_KEY).then(function (legacy) {
          return saltFrom(legacy);
        });
      });
    }).catch(function () { return null; });
  };
  /* 未解锁判定：localStorage 副本为密文，或 IDB 侧存在待解锁密文（loadIdb 探测标记） */
  Store.prototype.needsUnlock = function () {
    return this._encKey ? false : (this._hasEncSnapshot() || !!this._idbEncLocked);
  };

  /* 副本快照（LS）setItem 批量防抖：放入 requestIdleCallback 执行，页面空闲时统一落盘。
   * 一次 idle 周期内多次保存只落最新内容（_pendingLocalCols 按集合合并覆盖），避免密集保存
   * 反复序列化写 localStorage 阻塞主线程。无 requestIdleCallback 的环境
   * （Node/测试/旧浏览器）同步落盘，保证存储一致性。
   * 加密盐/壁纸等一次性关键 setItem 保持同步（正确性优先，非热路径）。
   * map = {集合id: 序列化串}（明文或密文原样落盘）；key 需先于 _meta 刷新调用。 */
  /** @this {{ _storage: any, state: any, _meta: any, _pendingLocalCols: any, _localFlushHandle: any, _doLocalFlush: Function, _storeWrite: Function }} */
  /* ==================== TrustLayer: 持久化核心 ==================== */
  /* --- LS 副本层 --- */


  /* 让位：放弃本次旧快照覆盖，改为吸收 localStorage 中的最新 LS 快照（其他标签已写更新）。
   * 与被动收敛（_bindStorageWatch）共用 _absorbLocalSnapshot 核心；
   * 差异仅在：让位需先广播 /store/yielded（UI 弹"未保存修改已被放弃"提示）。 */

  /* 吸收核心：逐集合读 LS 快照覆盖内存（解密失败集合保持现状），刷新基线并全量重绘。
   * legacy 态（无集合级 key）回落整份读取（等价旧行为）。 */

  /* 跨标签被动收敛（P2）：另一标签写盘触发本标签 storage 事件。
   * 仅当本标签无待写内容时静默吸收（无未保存输入可丢），空闲后台标签不再无限期显示

  /* 实际写 localStorage（降级后备副本；写满只停副本停更，IndexedDB 主快照不受影响）。
   * 只写 _pendingLocalCols 最新内容（逐集合 key，与 _colJson 比较去重——同一值不重复写） */

  /* 立即执行待写内容并作废已调度的 idle 写入。加密启用/停用/回读验证等
   * 正确性关键路径调用（这些路径依赖落盘与后续读取在同一时机）。 */

  /* 异步写 IndexedDB（主快照，真源，逐集合 key）。串行队列避免事务竞争；失败静默（localStorage 副本仍兜底）。
   * 只接受调用方显式传入的原始串 map（明文或密文格式原样落盘，{集合id: 串}），extra 合并进 entry（如加密盐）。
   * undefined/null/空 map 一律跳过——绝不回退到内存 state 序列化：锁定态下内存是明文空
   * defaultState，回退写盘会把明文空数据写进 IDB，破坏密文主快照（loadIdb 空 IDB 回填路径）。 */
  /** @this {{ _storage: any, state: any, _meta: any, _idbPromise: any, _persistLocal: any, _idbWriteCols: any, _colJson: any, _rev: number, _idbFailed: boolean, _statusReason: string }} */

  /* 全量序列化：逐集合与缓存比较，返回变更 map（全部未变 → null） */
  /* 全量序列化（不去重）：强制返回全部注册集合 map（加解密切换/迁移/导入等需全量场景） */



  /* 加密落盘：AES-GCM 异步（微任务级，用户操作间隙完成），逐集合独立 bundle（每集合新 iv）。
   * 串行队列保证加密按调用顺序落盘：encryptText 为异步，连续多次并发保存
   * 若不排队，后发起的加密可能先完成并覆盖落盘 → 旧状态覆盖新状态（丢最新变更）。
   * 落盘前经 _storeWrite 走写锁让位协议（同明文 _storeWrite，ADR-007）。
   * map = {集合id: 明文串}；返回 Promise（失败由调用方捕获，存储停留在上次成功版本）。 */
  /** @this {{ _encKey: any, _encChain: Promise<any>, _storeWrite: Function, _encSaltExtra: Function, _statusReason: string, _storage: any }} */
  /* ==================== TrustLayer: 加密落盘 ==================== */
  Store.prototype._encSave = function (map) {
    var self = this;
    if (!this._encKey || !Crypto) return Promise.resolve();
    if (!map) return Promise.resolve();
    var ids = Object.keys(map);
    if (ids.length === 0) return Promise.resolve();
    var prev = self._encChain || Promise.resolve();
    self._encChain = prev.then(function () {
      var jobs = ids.map(function (id) {
        return Crypto.encryptText(map[id], self._encKey).then(function (bundle) {
          return { col: id, payload: JSON.stringify({ e: 1, v: bundle.v, iv: bundle.iv, data: bundle.data }) };
        });
      });
      return Promise.all(jobs).then(function (results) {
        var encMap = {};
        results.forEach(function (r) { encMap[r.col] = r.payload; });
        /* ADR-013：LS+IDB 双相位由收口点在锁内一次完成（旧实现 IDB 在锁外） */
        return self._storeWrite(encMap, { ls: 'immediate', idb: 'write', extra: self._encSaltExtra() }).then(function (written) {
          if (!written) return; /* 让位：本次密文不落盘，新快照吸收后由后续 save 跟进 */
        });
      });
    }).catch(function (err) {
      /* 加密失败：存储停留在上次成功版本，后续变更会继续重试；上报便于发现 */
      if (!self._statusReason) self._statusReason = 'encryption_failed';
      try { console.error('[Sonder] 加密持久化失败', err); } catch (e) { /* 忽略 */ }
    });
    return self._encChain;
  };


  /* 密文 entry 附带盐（IDB extra）；盐缺失返回空对象 */
  /** @this {{ _storage: any }} */
  Store.prototype._encSaltExtra = function () {
    if (!this._storage) return {};
    try {
      var salt = this._storage.getItem(STORAGE_SALT_KEY);
      return salt ? { salt: salt } : {};
    } catch (e) { return {}; }
  };




  /* 把存储字符串解析为 state 对象；密文格式（e===1）需已解锁并解密，失败一律返回 null 不动数据 */
  /* ==================== TrustLayer: 解密解析 ==================== */
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


  /* 当前数据体积（字节）。接近 5MB 上限时前端显示警示条。
   * 以最近一次各集合落盘串长度求和为准（密文模式 _colJson 存密文→天然反映加密体积）；
   * 尚无落盘记录时回退实时序列化兜底。 */
  /* ==================== TrustLayer: 存储诊断 ==================== */
  Store.prototype.storageUsage = function () {
    var total = 0;
    for (var id in this._colJson) {
      if (this._colJson[id]) total += this._colJson[id].length;
    }
    if (total > 0) return total;
    try { return JSON.stringify(this.state).length; } catch (e) { return 0; }
  };
  Store.prototype.isNearQuota = function () {
    return this.storageUsage() > QUOTA_SOFT_LIMIT;
  };
  /* 数据安全判定（IndexedDB 主快照 + localStorage 副本双保险）：
   * localStorage 副本写入失败，且 IndexedDB 主快照不可用或已失败时，
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
  /* 结构化存储状态（TrustLayer 契约：返回全新对象，不外泄内部引用）。
   * 主快照 = IndexedDB（真源，容量大）；localStorage = 副本（降级后备镜像）。
   * ok=true 表示数据有可靠落点（IDB 主快照成功，或主快照不可用但 LS 副本在）；
   * degraded=true 表示存在存储层异常但不构成危机（主快照失败靠副本兜底，或副本停更）；
   * critical=true 表示数据仅存于内存（主失败且副本不可用）——与 hasPersistIssue() 严格一致，
   * UI 应显示"立即导出备份"危机警示。
   * reason 归类：quota / security / indexeddb_write_failed / indexeddb_unavailable /
   * encryption_failed / storage_error。 */
  Store.prototype.getStorageStatus = function () {
    var status;
    var primaryDown = !idbAvailable() || !!this._idbFailed;
    if (!primaryDown) {
      status = {
        ok: true,
        backend: 'indexedDB',
        degraded: !!this._persistFailed,
        critical: false,
        reason: this._persistFailed ? (this._statusReason || 'storage_write_failed') : null
      };
    } else if (!this._persistFailed) {
      status = {
        ok: true,
        backend: 'localStorage',
        degraded: true,
        critical: false,
        reason: this._statusReason || (idbAvailable() ? 'indexeddb_write_failed' : 'indexeddb_unavailable')
      };
    } else {
      status = { ok: false, backend: null, degraded: true, critical: true, reason: this._statusReason || 'storage_unavailable' };
    }
    return status;
  };
  /* 同步待写快照落盘后，返回结构化存储状态（Promise 版：等待 localStorage 同步写 + IDB 串行队列收尾）。
   * 用于保存流程的关键路径校验（持久化结果不得谎报成功）。 */
  Store.prototype.persistResult = function () {
    var self = this;
    this.flushPersist();
    var chains = [this._idbPromise || Promise.resolve()];
    return Promise.all(chains).then(function () { return self.getStorageStatus(); });
  };
  /* 存储诊断信息聚合（排查用；返回全新对象） */
  Store.prototype.diagnostics = function () {
    var err = this._lastPersistError;
    return {
      storageReady: !!this._storage,
      idbAvailable: idbAvailable(),
      idbFailed: this._idbFailed,
      persistFailed: this._persistFailed,
      statusReason: this._statusReason,
      usageBytes: this.storageUsage(),
      nearQuota: this.isNearQuota(),
      status: this.getStorageStatus(),
      lastError: err ? { name: err && err.name, message: err && err.message } : null
    };
  };
  Store.prototype.dismissQuotaNotice = function () {
    this.state.settings.quotaNoticeDismissed = true;
    this._commit('settings');
    this._emitChange('settings');
  };
  Store.prototype.setQuotaNoticeDismissed = function (v) {
    this.state.settings.quotaNoticeDismissed = !!v;
    this._commit('settings');
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
  /* ==================== TrustLayer: 加解密切换 ==================== */
  Store.prototype.encryptionMode = function () {
    return this._encKey ? 'unlocked' : (this.needsUnlock() ? 'locked' : 'off');
  };
  Store.prototype.lock = function () {
    this._encKey = null;
    this._emitChange('all'); /* 锁定：全页重绘进入解锁界面 */
  };
  /* 启用加密：自检锁 → 派生密钥 → 全量密文落盘 → 回读验证。
   * 任何一步失败即中止，旧明文快照与内存数据原样保留。
   * 锁定态守卫（P1 修复）：锁定时内存是空 defaultState，若放行会用新盐加密空数据
   * 覆盖全部真密文且旧验证"两侧同为空恒通过"——唯一漏网的无守卫写路径。 */
  Store.prototype.enableEncryption = function (password) {
    var self = this;
    if (!cryptoReady()) return Promise.reject(new Error('当前环境不支持 Web Crypto'));
    if (typeof password !== 'string' || password.length < 6) return Promise.reject(new Error('密码至少 6 位'));
    if (this._encKey) return Promise.reject(new Error('已处于加密模式'));
    if (this.needsUnlock()) return Promise.reject(new Error('锁定状态下禁止启用加密：请先解锁'));
    var salt = Crypto.saltBytes();
    return Crypto.selfTest(password, salt).then(function (ok) {
      if (!ok) throw new Error('加密引擎自检异常，已中断启用');
      return Crypto.deriveKey(password, salt);
    }).then(function (key) {
      self._encKey = key;
      if (self._storage) {
        try { self._storage.setItem(STORAGE_SALT_KEY, Crypto.bytesToB64(salt)); } catch (e) { throw Object.assign(new Error('盐存储失败，已中止'), { cause: e }); }
      }
      self._rev++;
      return self._encSave(self._collectAllRaw()).then(function () {
        /* 回读验证：密文必须能解回并保留关键数据。
         * 逐集合长度校验（P1 加固）：任一数组集合回读数量与内存不符即中止——
         * 防"空/残缺快照被静默采纳"（旧验证仅比 tasks 长度，锁定态两侧同为 0 恒通过）。 */
        return self.readSnapshot('local').then(function (dec) {
          if (!dec || !dec.settings || !isPlainObject(dec.settings)) throw new Error('加密回读验证失败');
          for (var ci = 0; ci < COLLECTIONS.length; ci++) {
            var cid = COLLECTIONS[ci];
            if (cid === 'settings') continue; /* 对象集合：上方 isPlainObject 已验 */
            var memArr = self.state[cid];
            var decArr = dec[cid];
            if (!Array.isArray(memArr)) continue;
            if (!Array.isArray(decArr) || decArr.length !== memArr.length) {
              throw new Error('加密回读数据不一致（' + cid + '），已中止');
            }
          }
          self._emitChange('all'); /* 加密状态切换：全页重绘 */
          return true;
        });
      });
    }).catch(function (err) {
      self._encKey = null;
      if (self._storage) {
        try { self._storage.removeItem(STORAGE_SALT_KEY); } catch (e) { /* 忽略 */ }
      }
      /* 兜底：把内存明文快照写回双存（若密文已部分落盘则覆盖为明文）。
       * ADR-013：经收口点——他标签已写更新时让位而非覆盖 */
      self._storeWrite(self._collectAllRaw(), { ls: 'immediate', idb: 'write' });
      throw err;
    });
  };
  /* 解锁：用密码派生密钥并解密持久化快照（localStorage 优先，缺则 IndexedDB）；
   * 解锁前先做快照完整性预检（_verifySnapshotIntegrity）——任一密文 bundle 损坏即整体拒绝
   * （返回 false + _statusReason 标记），绝不采纳残缺快照回写覆盖存储（防不可逆丢失）。
   * 成功进入可用状态并复位锁定标记，失败状态原样 */
  Store.prototype.unlock = function (password) {
    var self = this;
    if (!cryptoReady()) return Promise.resolve(false);
    if (typeof password !== 'string' || !password) return Promise.resolve(false);
    return this._encSaltAsync().then(function (salt) {
      if (!salt) return false;
      return Crypto.deriveKey(password, salt).then(function (key) {
        /* 完整性预检：损坏 bundle → 拒绝解锁，原密文原样保留（可换环境再试/引导导出其余数据） */
        return self._verifySnapshotIntegrity(key).then(function (intact) {
          if (!intact) {
            self._statusReason = 'snapshot_corrupted';
            try { console.error('[Sonder] 快照完整性预检失败：存在解密失败的加密集合，已拒绝解锁以保护原始数据'); } catch (e) { /* 忽略 */ }
            return false;
          }
          self._encKey = key;
          return self.readSnapshot('any').then(function (dec) {
            if (!dec) { self._encKey = null; return false; }
            self.state = normalize(dec);
            self._rev++;
            self._idbEncLocked = false;
            /* 回填双存：解锁即保证 localStorage 与 IDB 都是最新密文快照（全量集合级密文，含 legacy 迁移） */
            return self._encSave(self._collectAllRaw()).then(function () {
              self._emitChange('all'); /* 解锁完成：全页重绘 */
              return true;
            });
          }).catch(function () { self._encKey = null; return false; });
        });
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
          /* 显式转明文（ADR-013 经收口点）：他标签已写更新密文时让位
           * （written=false 仅不覆盖，切换照常完成——基线已由吸收同步）。 */
          var plain = self._collectAllRaw();
          return self._storeWrite(plain, { ls: 'immediate', idb: 'write' }).then(function () {
            self._emitChange('all'); /* 加解密切换：全页重绘反映加密状态 */
            return true;
          });
        });
      });
    });
  };
  /* 快照完整性预检（unlock 专用）：用派生密钥逐集合解密所有密文 raw，
   * 任一加密 bundle 解密失败 → false（bundle 损坏）。全部通过或无密文 → true。
   * 背景：readSnapshot 对部分失败返回"残缺 base（损坏集合=空数组）"，若 unlock 直接采纳
   * 并 _encSave(collectAllRaw) 回写，会用空数据覆盖全部存储的该集合——不可逆丢失。
   * 故 unlock 前必须整体验证；代价是解锁时多一轮解密（用户手动低频路径，可接受）。 */
  /** @this {{ _collectSnapshotRaw: Function }} */
  /* ==================== TrustLayer: 快照读取 ==================== */
  Store.prototype._verifySnapshotIntegrity = function (key) {
    if (!Crypto) return Promise.resolve(true);
    return this._collectSnapshotRaw().then(function (raws) {
      var jobs = [];
      var hasEnc = false;
      for (var id in raws) {
        var parsed = null;
        try { parsed = JSON.parse(raws[id]); } catch (e) { parsed = null; }
        /* 只验密文 bundle（{e:1}）；明文/legacy 明文无需验证 */
        if (!(parsed && typeof parsed === 'object' && parsed.e === 1)) continue;
        hasEnc = true;
        if (parsed.v !== ENC_FORMAT) return Promise.resolve(false); /* 格式不识别 = 视同损坏 */
        jobs.push(Crypto.decryptBundle(parsed, key));
      }
      if (!hasEnc) return Promise.resolve(true);
      return Promise.all(jobs).then(function (results) {
        for (var i = 0; i < results.length; i++) {
          if (!results[i]) return false; /* 任一 bundle 解密失败 → 整体拒绝 */
        }
        return true;
      }).catch(function () { return false; });
    });
  };
  /* 用给定密钥解密持久化快照（集合级：LS 优先，IDB 补缺；无集合级 → legacy 整份回落），失败一律 null。
   * 逐集合独立 bundle（支持给定 key ≠ 会话密钥，如 disableEncryption 密码验证）。 */
  Store.prototype._decryptSnapshotKey = function (key) {
    if (!Crypto) return Promise.resolve(null);
    return this._collectSnapshotRaw().then(function (raws) {
      var base = defaultState();
      var any = false;
      var mergedAny = false;
      var hasEnc = false;
      var jobs = [];
      for (var id in raws) {
        any = true;
        if (isEncRaw(raws[id])) hasEnc = true;
        jobs.push((function (raw) {
          var parsed = null;
          try { parsed = JSON.parse(raw); } catch (e) { return Promise.resolve(null); }
          if (parsed && parsed.e === 1) {
            if (parsed.v !== ENC_FORMAT) return Promise.resolve(null);
            return Crypto.decryptBundle(parsed, key).then(function (json) {
              try { return JSON.parse(json); } catch (e) { return null; }
            }).catch(function () { return null; });
          }
          return Promise.resolve(parsed);
        })(raws[id]).then(function (colId, dec) {
          if (!dec || typeof dec !== 'object') return;
          if (colId === '__legacy') {
            base = normalize(dec); /* 整份 legacy：直接替换 base */
            mergedAny = true;
            return;
          }
          mergeColInto(base, colId, dec);
          mergedAny = true;
        }.bind(null, id)));
      }
      if (!any) return null;
      return Promise.all(jobs).then(function () {
        /* 全密文解密失败（密码错误/损坏）→ null（区别于"无数据"，防止误判解锁/停用成功） */
        if (!mergedAny && hasEnc) return null;
        return base;
      });
    });
  };
  /* 收集持久化原始串（集合级：LS 集合 key 优先，缺失用 IDB 集合 entry；两侧皆无 → legacy 整份回落。
   * 返回 {集合id: 原始串}；无任何来源返回 {}。 */
  Store.prototype._collectSnapshotRaw = function () {
    var self = this;
    var lsMap = this._readLocalColsRaw();
    if (idbAvailable()) {
      return openIdb().then(function (db) {
        var jobs = COLLECTIONS.map(function (id) {
          return idbGet(db, id).then(function (entry) {
            var raw = (entry && typeof entry === 'object' && !Array.isArray(entry)) ? entry.data : entry;
            return { id: id, raw: raw };
          });
        });
        return Promise.all(jobs).then(function (results) {
          var merged = {};
          var lsHas = Object.keys(lsMap).length > 0;
          if (lsHas) {
            for (var id2 in lsMap) merged[id2] = lsMap[id2];
            results.forEach(function (r) {
              if (merged[r.id] === undefined && r.raw !== null && r.raw !== undefined) merged[r.id] = r.raw;
            });
          } else {
            results.forEach(function (r) {
              if (r.raw !== null && r.raw !== undefined) merged[r.id] = r.raw;
            });
          }
          if (Object.keys(merged).length > 0) return merged;
          /* legacy 整份回落（LS 优先） */
          var legacy = {};
          if (self._storage) {
            try {
              var lsRaw = self._storage.getItem(STORAGE_KEY);
              if (lsRaw) legacy['__legacy'] = lsRaw;
            } catch (e) { /* 忽略 */ }
          }
          if (Object.keys(legacy).length > 0) return legacy;
          return idbGet(db, IDB_KEY).then(function (entry) {
            if (!entry) return {};
            var data = (entry && typeof entry === 'object' && !Array.isArray(entry)) ? entry.data : entry;
            if (data === null || data === undefined) return {};
            var out = {};
            out['__legacy'] = data;
            return out;
          });
        });
      }).catch(function () { return {}; });
    }
    if (Object.keys(lsMap).length > 0) return Promise.resolve(lsMap);
    var legacyMap = {};
    if (this._storage) {
      try {
        var lsRaw2 = this._storage.getItem(STORAGE_KEY);
        if (lsRaw2) legacyMap['__legacy'] = lsRaw2;
      } catch (e) { /* 忽略 */ }
    }
    return Promise.resolve(legacyMap);
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
    /* 领域文件（store-tasks/media/content/settings/report/undo/persistence/migration/import-export）
     * 可用的 core 私有 helper 白名单 */
    _h: {
      uid: uid, nowISO: nowISO, todayStr: todayStr, fmtDate: fmtDate,
      deepClone: deepClone, isPlainObject: isPlainObject, find: find, idxOf: idxOf,
      normalizePriority: normalizePriority, clampOpacity: clampOpacity, normalize: normalize,
      num0: Stats.num0, hashStr: Stats.hashStr, STORAGE_WALLPAPER_KEY: STORAGE_WALLPAPER_KEY,
      /* C-7：IDB 独立 entry 读写（自定义壁纸等非 state 数据） */
      idbReady: idbReady, idbPut: idbPut, idbGet: idbGet, idbDel: idbDel,
      /* Phase 6 拆 store.js：持久化/迁移/导入导出文件的闭包依赖挂载 */
      colLsKey: colLsKey, colPayload: colPayload, mergeColInto: mergeColInto,
      isEncRaw: isEncRaw, cryptoReady: cryptoReady, idbAvailable: idbAvailable,
      openIdb: openIdb, dataEvent: dataEvent, classifyFailReason: classifyFailReason,
      defaultState: defaultState,
      /* 加密导出/导入依赖（import-export 拆分文件使用；加密方法本体留 store.js） */
      Crypto: Crypto, BACKUP_ENC_FORMAT: BACKUP_ENC_FORMAT,
      COLLECTIONS: COLLECTIONS, EXTRA_COLLECTIONS: EXTRA_COLLECTIONS,
      STORAGE_KEY: STORAGE_KEY, STORAGE_META_KEY: STORAGE_META_KEY,
      STORAGE_SALT_KEY: STORAGE_SALT_KEY, GRANULAR_FLAG: GRANULAR_FLAG,
      COLL_PREFIX: COLL_PREFIX, COLL_SUFFIX: COLL_SUFFIX,
      IDB_NAME: IDB_NAME, IDB_STORE: IDB_STORE, IDB_KEY: IDB_KEY,
      QUOTA_SOFT_LIMIT: QUOTA_SOFT_LIMIT
    }
  };
  return api;
});