/* ============================================================
 * desktop-pet.js - 小莫灵家族桌面玩偶核心模块
 * 浏览器(window.DesktopPetCore)与 Node(module.exports)通用。
 * 规格基准：docs/desktop-pet-spec.md（v2.1）
 * 依赖：desktop-pet-data.js（配置数据，须先于本文件加载）。
 *
 * 本文件按规格 9.5 七区分区，配置数据已提取至 desktop-pet-data.js。
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DesktopPetCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ============================================================
     配置数据：从 desktop-pet-data.js 加载（浏览器 window.DesktopPetData / Node require）
     ============================================================ */
  var DPData = (typeof window !== 'undefined' && window.DesktopPetData)
    || (typeof module === 'object' && typeof require === 'function' ? require('./desktop-pet-data.js') : null);
  if (!DPData) throw new Error('DesktopPetCore: desktop-pet-data.js 未加载');

  var QUOTES = DPData.QUOTES;
  var CHARACTERS = DPData.CHARACTERS;
  var SNACKS = DPData.SNACKS;
  var ACHIEVEMENTS = DPData.ACHIEVEMENTS;
  var DIALOGUES = DPData.DIALOGUES;

  /* ============================================================

     第二区：工具函数（UTILS）
     - rand/pick/clamp/cloneJson 等通用函数
     - mergeDesktopPetDefaults：settings.desktopPet 深合并默认值
     ============================================================ */

  /* 桌面玩偶设置块默认值（规格 3.5 全字段）。Task 3 并入 store 默认值原样复用。 */
  var DEFAULT_DESKTOP = {
    enabled: true,
    mode: 'duo',                    /* single | duo | trio */
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
  };

  var ROLE_IDS = ['xiaomo', 'xiaoyu', 'lanling'];
  var MODES = ['single', 'duo', 'trio'];

  function rand(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function cloneJson(o) {
    if (o === undefined || o === null) return null;
    try { return JSON.parse(JSON.stringify(o)); } catch (e) { return null; }
  }

  /* 深合并原始 desktopPet 块 → 完整默认配置（未知字段丢弃、数值边界约束）。
   * 命名跨 Task 固定（规格 9.5 / 计划接口清单）：Task 3 在 store 侧复用同一实现。 */
  function mergeDesktopPetDefaults(raw) {
    var out = cloneJson(DEFAULT_DESKTOP);
    if (!raw || typeof raw !== 'object') return out;
    if (typeof raw.enabled === 'boolean') out.enabled = raw.enabled;
    if (MODES.indexOf(raw.mode) !== -1) out.mode = raw.mode;
    if (ROLE_IDS.indexOf(raw.resident) !== -1) out.resident = raw.resident;
    if (typeof raw.size === 'number') out.size = clamp(Math.round(raw.size), 48, 160);
    if (raw.layout === 'bottom-right' || raw.layout === 'bottom-left' || raw.layout === 'auto') out.layout = raw.layout;
    if (raw.positions && typeof raw.positions === 'object') {
      ROLE_IDS.forEach(function (id) {
        var p = raw.positions[id];
        out.positions[id] = (p && typeof p === 'object')
          ? { x: typeof p.x === 'number' ? p.x : null, y: typeof p.y === 'number' ? p.y : null }
          : { x: null, y: null };
      });
    }
    if (typeof raw.coins === 'number') out.coins = Math.max(0, Math.round(raw.coins));
    if (raw.affection && typeof raw.affection === 'object') {
      ROLE_IDS.forEach(function (id) {
        if (typeof raw.affection[id] === 'number') out.affection[id] = Math.max(0, Math.round(raw.affection[id]));
      });
    }
    if (raw.inventory && typeof raw.inventory === 'object') out.inventory = cloneJson(raw.inventory);
    if (raw.totalFed && typeof raw.totalFed === 'object') {
      ROLE_IDS.forEach(function (id) {
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

  /* ============================================================
     第三区：Pet 类（单个玩偶，规格 附录 C.6）
     - 构造：options{container,size,character,color,position,enabled,autoIntegrate}
     - 渲染：SVG 墨滴身体 + 眼睛/嘴巴 + 表情装饰（C.2-C.4）
     - 交互状态：拖动/悬停/气泡/待机语录（交互由 Task 2 接入）
     - 动画：_tick(dt,t) 由 PetFamily 共享 rAF 驱动（Task 2 接入）
     ============================================================ */

  var SVG_NS = 'http://www.w3.org/2000/svg';

  /** 动效降级门控：减少动效模式下跳过特效注入 */
  function _motionOk() {
    try { return typeof window !== 'undefined' && window.MOTION && !window.MOTION.motionDisabled(); } catch (_e) { return false; }
  }

  /* 表情配置表（15 种）：规格 C.1 表（eyes/mouth/decor） */
  var EMO_CONFIGS = {
    idle: { eyes: { shape: 'dot', lookX: 0, lookY: 0, scaleY: 1 }, mouth: { type: 'smile', w: 10, h: 4 }, decor: [] },
    happy: { eyes: { shape: 'arc', lookX: 0, lookY: -1, scaleY: 0.6 }, mouth: { type: 'smile', w: 14, h: 7 }, decor: ['blush'], bounce: true },
    thinking: { eyes: { shape: 'dot', lookX: 2, lookY: -2, scaleY: 1 }, mouth: { type: 'flat', w: 8, h: 0 }, decor: ['think'], wobble: true },
    sleepy: { eyes: { shape: 'arc', lookX: 0, lookY: 2, scaleY: 0.25 }, mouth: { type: 'flat', w: 6, h: 0 }, decor: ['zzz'] },
    excited: { eyes: { shape: 'star', lookX: 0, lookY: -1, scaleY: 0.8 }, mouth: { type: 'open', w: 10, h: 8 }, decor: ['blush', 'star'], bounce: true, sparkle: true },
    wave: { eyes: { shape: 'dot', lookX: 0, lookY: 0, scaleY: 1 }, mouth: { type: 'smile', w: 12, h: 5 }, decor: ['wave-fin'] },
    focus: { eyes: { shape: 'dot', lookX: 0, lookY: 0, scaleY: 1 }, mouth: { type: 'flat', w: 5, h: 0 }, decor: [] },
    sad: { eyes: { shape: 'dot', lookX: 0, lookY: 3, scaleY: 0.8 }, mouth: { type: 'frown', w: 10, h: 4 }, decor: [] },
    surprised: { eyes: { shape: 'wide', lookX: 0, lookY: 0, scaleY: 1 }, mouth: { type: 'o-small', w: 0, h: 0 }, decor: ['exclaim'], recoil: true },
    proud: { eyes: { shape: 'arc-up', lookX: 0, lookY: -1, scaleY: 0.5 }, mouth: { type: 'big-smile', w: 16, h: 8 }, decor: ['blush', 'sparkle'], bounce: true, chest: true },
    relax: { eyes: { shape: 'arc', lookX: 0, lookY: 1, scaleY: 0.4 }, mouth: { type: 'smile', w: 10, h: 3 }, decor: ['relax-waves'], stretch: true },
    confused: { eyes: { shape: 'asymmetric', lookX: 0, lookY: 0, scaleY: 1 }, mouth: { type: 'wavy', w: 12, h: 0 }, decor: ['question'], tilt: 2 },
    encourage: { eyes: { shape: 'dot', lookX: 0, lookY: 0, scaleY: 1 }, mouth: { type: 'smile', w: 12, h: 4 }, decor: ['arrow-up'], bounce: true, lean: true },
    busy: { eyes: { shape: 'darting', lookX: 0, lookY: 0, scaleY: 1 }, mouth: { type: 'o-tiny', w: 0, h: 0 }, decor: ['sweat'], wobble: true },
    goodbye: { eyes: { shape: 'arc-up', lookX: 0, lookY: 0, scaleY: 0.3 }, mouth: { type: 'smile', w: 8, h: 2 }, decor: ['wave-fin'], sink: true }
  };

  /** @constructor
   * @this {{ container: any, size: number, character: any, color: Object, position: any, enabled: boolean,
   *   autoIntegrate: boolean, emotion: string, targetEmotion: string, emotionStart: number, emotionDuration: number,
   *   breathe: number, breatheScale: number, blink: any, lookX: number, lookY: number, bounceY: number, wobble: number,
   *   blushOpacity: number, _targetLookX: number, _targetLookY: number,
   *   dragging: boolean, dragOffset: {x: number, y: number}, hovering: boolean,
   *   _clickCooldown: boolean, _clickCooldownTimer: any, _longPressTimer: any, _contextMenu: any,
   *   _menuBindTimer: any, _fxTimers: any[], _destroyed: boolean, isTouchDevice: boolean,
   *   bubbleTimer: any, idleTimer: any, bus: any, store: any, unsubs: any[], el: any, bodyG: any, eyeL: any,
   *   eyeR: any, mouth: any, bubble: any, _blinkTimer: any, _idleQuoteTimer: any, _sayTimer: any,
   *   _boundEnter: any, _boundLeave: any, _drawEyes: Function, _drawMouth: Function,
   *   _build: Function, _tryIntegrate: Function, _bindEvents: Function }} */
  function Pet(options) {
    options = options || {};
    this.container = options.container; /* 挂载点（必填） */
    this.size = typeof options.size === 'number' && options.size > 0 ? options.size : 84;
    this.character = typeof options.character === 'string'
      ? CHARACTERS[options.character] || CHARACTERS.xiaomo
      : (options.character || CHARACTERS.xiaomo);
    this.color = options.color || {};
    this.position = options.position || null;
    this.enabled = options.enabled !== false;
    this.autoIntegrate = options.autoIntegrate !== false;

    this.emotion = this.targetEmotion = this.character.defaultEmotion || 'idle';
    this.emotionStart = 0;
    this.emotionDuration = 0;

    /* 动画状态（由 PetFamily 共享 rAF 驱动） */
    this.breathe = 0;
    this.breatheScale = 1;
    this.blink = false;
    this.lookX = 0;
    this.lookY = 0;
    this._targetLookX = 0;
    this._targetLookY = 0;
    this.bounceY = 0;
    this.wobble = 0;
    this.blushOpacity = 0;

    /* 交互状态 */
    this.dragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.hovering = false;
    this.bubbleTimer = null;
    this.idleTimer = null;
    this._clickCooldown = false;
    this._clickCooldownTimer = null; /* 冷却复位定时器（destroy 需清理） */
    this._longPressTimer = null;
    this._contextMenu = null;
    this._menuBindTimer = null;      /* 菜单外点关闭绑定延迟句柄（destroy 需清理） */
    this._fxTimers = [];             /* 特效/眨眼恢复等短命定时器（destroy 统一清理） */
    this._destroyed = false;         /* 自续期链守卫：clearTimeout 与已入队回调竞态时断链 */
    this.isTouchDevice = !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: none)').matches);

    /* 集成引用（Task 2 接入） */
    this.bus = options.bus || null;
    this.store = options.store || null;
    this.unsubs = [];

    this.el = null;
    this.bodyG = null;
    this.eyeL = null;
    this.eyeR = null;
    this.mouth = null;
    this.bubble = null;

    this._build();
    if (this.autoIntegrate) this._tryIntegrate();
    this._bindEvents();
  }

  /* 构建 DOM/SVG（C.2 结构） */
  Pet.prototype._build = function () {
    var el = document.createElement('div');
    el.className = 'dp-pet pet-' + this.character.id;
    el.style.width = this.size + 'px';
    el.style.height = this.size + 'px';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', this.character.name + '（' + this.character.desc + '）');
    if (!this.enabled) el.style.display = 'none';

    var svg = /** @type {SVGSVGElement} */ (document.createElementNS(SVG_NS, 'svg'));
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.overflow = 'visible';

    /* defs：渐变 + 滤镜（随机 ID 防 trio 多实例碰撞） */
    var _uid = Math.floor(Math.random() * 100000);
    var defs = document.createElementNS(SVG_NS, 'defs');
    var bodyGrad = document.createElementNS(SVG_NS, 'radialGradient');
    bodyGrad.setAttribute('id', 'dpBodyGrad' + _uid);
    bodyGrad.setAttribute('cx', '38%');
    bodyGrad.setAttribute('cy', '32%');
    bodyGrad.setAttribute('r', '70%');
    var stop1 = document.createElementNS(SVG_NS, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', 'var(--dp-body-light,#fff)');
    var stop2 = document.createElementNS(SVG_NS, 'stop');
    stop2.setAttribute('offset', '55%');
    stop2.setAttribute('stop-color', 'var(--dp-body,#c23b2e)');
    var stop3 = document.createElementNS(SVG_NS, 'stop');
    stop3.setAttribute('offset', '100%');
    stop3.setAttribute('stop-color', 'var(--dp-body-dark,#8f2d1f)');
    bodyGrad.appendChild(stop1);
    bodyGrad.appendChild(stop2);
    bodyGrad.appendChild(stop3);
    defs.appendChild(bodyGrad);

    var glowGrad = document.createElementNS(SVG_NS, 'radialGradient');
    glowGrad.setAttribute('id', 'dpGlow' + _uid);
    glowGrad.setAttribute('cx', '50%');
    glowGrad.setAttribute('cy', '50%');
    glowGrad.setAttribute('r', '50%');
    var gs1 = document.createElementNS(SVG_NS, 'stop');
    gs1.setAttribute('offset', '0%');
    gs1.setAttribute('stop-color', 'var(--dp-body,#c23b2e)');
    gs1.setAttribute('stop-opacity', '0.35');
    var gs2 = document.createElementNS(SVG_NS, 'stop');
    gs2.setAttribute('offset', '100%');
    gs2.setAttribute('stop-color', 'var(--dp-body,#c23b2e)');
    gs2.setAttribute('stop-opacity', '0');
    glowGrad.appendChild(gs1);
    glowGrad.appendChild(gs2);
    defs.appendChild(glowGrad);

    var svgId = 'dpInk' + _uid;
    var inkFilter = document.createElementNS(SVG_NS, 'filter');
    inkFilter.setAttribute('id', svgId);
    inkFilter.setAttribute('x', '-30%');
    inkFilter.setAttribute('y', '-30%');
    inkFilter.setAttribute('width', '160%');
    inkFilter.setAttribute('height', '160%');
    var blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
    blur.setAttribute('in', 'SourceAlpha');
    blur.setAttribute('stdDeviation', '1.2');
    blur.setAttribute('result', 'blur');
    inkFilter.appendChild(blur);
    var offset = document.createElementNS(SVG_NS, 'feOffset');
    offset.setAttribute('in', 'blur');
    offset.setAttribute('dx', '0');
    offset.setAttribute('dy', '2');
    offset.setAttribute('result', 'offset');
    inkFilter.appendChild(offset);
    var ct = document.createElementNS(SVG_NS, 'feComponentTransfer');
    ct.setAttribute('in', 'offset');
    ct.setAttribute('result', 'shadow');
    var fFuncA = document.createElementNS(SVG_NS, 'feFuncA');
    fFuncA.setAttribute('type', 'linear');
    fFuncA.setAttribute('slope', '0.25');
    ct.appendChild(fFuncA);
    inkFilter.appendChild(ct);
    var feMerge = document.createElementNS(SVG_NS, 'feMerge');
    var mn1 = document.createElementNS(SVG_NS, 'feMergeNode');
    mn1.setAttribute('in', 'shadow');
    var mn2 = document.createElementNS(SVG_NS, 'feMergeNode');
    mn2.setAttribute('in', 'SourceGraphic');
    feMerge.appendChild(mn1);
    feMerge.appendChild(mn2);
    inkFilter.appendChild(feMerge);
    defs.appendChild(inkFilter);
    svg.appendChild(defs);

    /* 光晕 */
    var glow = document.createElementNS(SVG_NS, 'ellipse');
    glow.setAttribute('class', 'dp-glow');
    glow.setAttribute('cx', '50');
    glow.setAttribute('cy', '52');
    glow.setAttribute('rx', '42');
    glow.setAttribute('ry', '40');
    glow.setAttribute('fill', 'url(#dpGlow' + _uid + ')');
    svg.appendChild(glow);

    /* 身体组 */
    var bodyG = document.createElementNS(SVG_NS, 'g');
    bodyG.setAttribute('class', 'dp-body-group');
    var body = document.createElementNS(SVG_NS, 'path');
    body.setAttribute('class', 'dp-body');
    body.setAttribute('d', 'M50 12 C68 12 82 28 82 48 C82 68 72 84 50 86 C28 84 18 68 18 48 C18 28 32 12 50 12 Z');
    body.setAttribute('fill', 'url(#dpBodyGrad' + _uid + ')');
    body.setAttribute('filter', 'url(#' + svgId + ')');
    bodyG.appendChild(body);

    var highlight = document.createElementNS(SVG_NS, 'ellipse');
    highlight.setAttribute('class', 'dp-highlight');
    highlight.setAttribute('cx', '38');
    highlight.setAttribute('cy', '30');
    highlight.setAttribute('rx', '10');
    highlight.setAttribute('ry', '7');
    highlight.setAttribute('fill', 'rgba(255,255,255,0.35)');
    bodyG.appendChild(highlight);

    var eyes = document.createElementNS(SVG_NS, 'g');
    eyes.setAttribute('class', 'dp-eyes');
    this.eyeL = document.createElementNS(SVG_NS, 'g');
    this.eyeL.setAttribute('class', 'dp-eye-l');
    this.eyeL.setAttribute('transform', 'translate(38,48)');
    this.eyeR = document.createElementNS(SVG_NS, 'g');
    this.eyeR.setAttribute('class', 'dp-eye-r');
    this.eyeR.setAttribute('transform', 'translate(62,48)');
    eyes.appendChild(this.eyeL);
    eyes.appendChild(this.eyeR);
    bodyG.appendChild(eyes);

    this.mouth = document.createElementNS(SVG_NS, 'path');
    this.mouth.setAttribute('class', 'dp-mouth');
    this.mouth.setAttribute('fill', 'none');
    this.mouth.setAttribute('stroke', 'var(--dp-mouth,rgba(43,38,32,0.7))');
    this.mouth.setAttribute('stroke-width', '2');
    this.mouth.setAttribute('stroke-linecap', 'round');
    bodyG.appendChild(this.mouth);

    /* 腮红 */
    var blushL = document.createElementNS(SVG_NS, 'ellipse');
    blushL.setAttribute('class', 'dp-blush-l');
    blushL.setAttribute('cx', '30');
    blushL.setAttribute('cy', '56');
    blushL.setAttribute('rx', '5');
    blushL.setAttribute('ry', '3');
    blushL.setAttribute('fill', 'rgba(255,120,100,0.4)');
    blushL.setAttribute('opacity', '0');
    bodyG.appendChild(blushL);
    var blushR = document.createElementNS(SVG_NS, 'ellipse');
    blushR.setAttribute('class', 'dp-blush-r');
    blushR.setAttribute('cx', '70');
    blushR.setAttribute('cy', '56');
    blushR.setAttribute('rx', '5');
    blushR.setAttribute('ry', '3');
    blushR.setAttribute('fill', 'rgba(255,120,100,0.4)');
    blushR.setAttribute('opacity', '0');
    bodyG.appendChild(blushR);

    /* zzz（困倦） */
    var zzz = document.createElementNS(SVG_NS, 'text');
    zzz.setAttribute('class', 'dp-zzz');
    zzz.setAttribute('x', '72');
    zzz.setAttribute('y', '28');
    zzz.setAttribute('font-size', '10');
    zzz.setAttribute('font-weight', '700');
    zzz.setAttribute('fill', 'var(--muted,#6f675c)');
    zzz.setAttribute('opacity', '0');
    zzz.textContent = 'z';
    bodyG.appendChild(zzz);

    /* 星星眼（兴奋） */
    var starL = document.createElementNS(SVG_NS, 'text');
    starL.setAttribute('class', 'dp-star-l');
    starL.setAttribute('x', '34');
    starL.setAttribute('y', '52');
    starL.setAttribute('font-size', '10');
    starL.setAttribute('fill', '#f5c542');
    starL.setAttribute('opacity', '0');
    starL.textContent = '★';
    bodyG.appendChild(starL);
    var starR = document.createElementNS(SVG_NS, 'text');
    starR.setAttribute('class', 'dp-star-r');
    starR.setAttribute('x', '58');
    starR.setAttribute('y', '52');
    starR.setAttribute('font-size', '10');
    starR.setAttribute('fill', '#f5c542');
    starR.setAttribute('opacity', '0');
    starR.textContent = '★';
    bodyG.appendChild(starR);

    /* 挥手鳍（wave/goodbye） */
    var waveFin = document.createElementNS(SVG_NS, 'path');
    waveFin.setAttribute('class', 'dp-wave-fin');
    waveFin.setAttribute('d', 'M82 50 Q92 44 90 36 Q86 40 80 46 Z');
    waveFin.setAttribute('fill', 'var(--dp-body-dark,#8f2d1f)');
    waveFin.setAttribute('opacity', '0');
    bodyG.appendChild(waveFin);

    /* 思考气泡（thinking） */
    var thinkG = document.createElementNS(SVG_NS, 'g');
    thinkG.setAttribute('class', 'dp-think');
    thinkG.setAttribute('opacity', '0');
    var t1 = document.createElementNS(SVG_NS, 'circle');
    t1.setAttribute('cx', '72'); t1.setAttribute('cy', '30'); t1.setAttribute('r', '2');
    t1.setAttribute('fill', 'var(--muted,#6f675c)');
    var t2 = document.createElementNS(SVG_NS, 'circle');
    t2.setAttribute('cx', '78'); t2.setAttribute('cy', '24'); t2.setAttribute('r', '1.5');
    t2.setAttribute('fill', 'var(--muted,#6f675c)');
    var t3 = document.createElementNS(SVG_NS, 'circle');
    t3.setAttribute('cx', '82'); t3.setAttribute('cy', '18'); t3.setAttribute('r', '1');
    t3.setAttribute('fill', 'var(--muted,#6f675c)');
    thinkG.appendChild(t1); thinkG.appendChild(t2); thinkG.appendChild(t3);
    bodyG.appendChild(thinkG);

    /* 感叹号（surprised） */
    var exclaimG = document.createElementNS(SVG_NS, 'g');
    exclaimG.setAttribute('class', 'dp-exclaim');
    exclaimG.setAttribute('opacity', '0');
    var exRect = document.createElementNS(SVG_NS, 'rect');
    exRect.setAttribute('x', '74'); exRect.setAttribute('y', '14');
    exRect.setAttribute('width', '3'); exRect.setAttribute('height', '8');
    exRect.setAttribute('rx', '1.5'); exRect.setAttribute('fill', 'var(--accent,#c23b2e)');
    var exDot = document.createElementNS(SVG_NS, 'circle');
    exDot.setAttribute('cx', '75.5'); exDot.setAttribute('cy', '26'); exDot.setAttribute('r', '1.8');
    exDot.setAttribute('fill', 'var(--accent,#c23b2e)');
    exclaimG.appendChild(exRect); exclaimG.appendChild(exDot);
    bodyG.appendChild(exclaimG);

    /* 问号（confused） */
    var question = document.createElementNS(SVG_NS, 'text');
    question.setAttribute('class', 'dp-question');
    question.setAttribute('x', '72'); question.setAttribute('y', '22');
    question.setAttribute('font-size', '12'); question.setAttribute('font-weight', '700');
    question.setAttribute('fill', 'var(--muted,#6f675c)');
    question.setAttribute('opacity', '0');
    question.textContent = '?';
    bodyG.appendChild(question);

    /* 闪光（proud） */
    var sparkleG = document.createElementNS(SVG_NS, 'g');
    sparkleG.setAttribute('class', 'dp-sparkle');
    sparkleG.setAttribute('opacity', '0');
    var spL = document.createElementNS(SVG_NS, 'path');
    spL.setAttribute('class', 'dp-sparkle-l');
    spL.setAttribute('d', 'M28 18 L30 22 L34 24 L30 26 L28 30 L26 26 L22 24 L26 22 Z');
    spL.setAttribute('fill', '#f5c542');
    var spR = document.createElementNS(SVG_NS, 'path');
    spR.setAttribute('class', 'dp-sparkle-r');
    spR.setAttribute('d', 'M72 16 L73.5 19 L77 20.5 L73.5 22 L72 25 L70.5 22 L67 20.5 L70.5 19 Z');
    spR.setAttribute('fill', '#f5c542');
    sparkleG.appendChild(spL); sparkleG.appendChild(spR);
    bodyG.appendChild(sparkleG);

    /* 放松波纹（relax） */
    var relaxG = document.createElementNS(SVG_NS, 'g');
    relaxG.setAttribute('class', 'dp-relax-waves');
    relaxG.setAttribute('opacity', '0');
    var wv1 = document.createElementNS(SVG_NS, 'path');
    wv1.setAttribute('class', 'dp-wave-1');
    wv1.setAttribute('d', 'M12 50 Q6 50 6 56 Q6 62 12 62');
    wv1.setAttribute('fill', 'none');
    wv1.setAttribute('stroke', 'var(--accent,#c23b2e)');
    wv1.setAttribute('stroke-width', '1.5');
    wv1.setAttribute('stroke-linecap', 'round');
    wv1.setAttribute('opacity', '0.5');
    var wv2 = document.createElementNS(SVG_NS, 'path');
    wv2.setAttribute('class', 'dp-wave-2');
    wv2.setAttribute('d', 'M88 50 Q94 50 94 56 Q94 62 88 62');
    wv2.setAttribute('fill', 'none');
    wv2.setAttribute('stroke', 'var(--accent,#c23b2e)');
    wv2.setAttribute('stroke-width', '1.5');
    wv2.setAttribute('stroke-linecap', 'round');
    wv2.setAttribute('opacity', '0.5');
    relaxG.appendChild(wv1); relaxG.appendChild(wv2);
    bodyG.appendChild(relaxG);

    /* 上升箭头（encourage） */
    var arrowG = document.createElementNS(SVG_NS, 'g');
    arrowG.setAttribute('class', 'dp-arrow-up');
    arrowG.setAttribute('opacity', '0');
    var arrowPath = document.createElementNS(SVG_NS, 'path');
    arrowPath.setAttribute('d', 'M78 24 L78 14 M74 17 L78 12 L82 17');
    arrowPath.setAttribute('fill', 'none');
    arrowPath.setAttribute('stroke', 'var(--ok,#2e7d63)');
    arrowPath.setAttribute('stroke-width', '2');
    arrowPath.setAttribute('stroke-linecap', 'round');
    arrowPath.setAttribute('stroke-linejoin', 'round');
    arrowG.appendChild(arrowPath);
    bodyG.appendChild(arrowG);

    /* 汗珠（busy） */
    var sweatG = document.createElementNS(SVG_NS, 'g');
    sweatG.setAttribute('class', 'dp-sweat');
    sweatG.setAttribute('opacity', '0');
    var swL = document.createElementNS(SVG_NS, 'path');
    swL.setAttribute('class', 'dp-sweat-l');
    swL.setAttribute('d', 'M32 36 Q30 40 32 42 Q34 40 32 36 Z');
    swL.setAttribute('fill', 'rgba(100,160,220,0.7)');
    var swR = document.createElementNS(SVG_NS, 'path');
    swR.setAttribute('class', 'dp-sweat-r');
    swR.setAttribute('d', 'M68 36 Q66 40 68 42 Q70 40 68 36 Z');
    swR.setAttribute('fill', 'rgba(100,160,220,0.7)');
    sweatG.appendChild(swL); sweatG.appendChild(swR);
    bodyG.appendChild(sweatG);

    svg.appendChild(bodyG);
    this.bodyG = bodyG;

    /* 气泡（C.10） */
    var bubble = document.createElement('div');
    bubble.className = 'dp-bubble';
    bubble.setAttribute('role', 'status');
    bubble.setAttribute('aria-live', 'polite');
    this.bubble = bubble;
    el.appendChild(svg);
    el.appendChild(bubble);

    this.el = el;
    if (this.container) this.container.appendChild(el);

    /* 首帧表情渲染 */
    this.setEmotion(this.emotion, 0);
    this._drawEyes(this.eyeL, this.eyeR, EMO_CONFIGS[this.emotion].eyes, 'idle');
    this._drawMouth(EMO_CONFIGS[this.emotion].mouth);

    /* 启动眨眼/闲置语句定时器 */
    this._scheduleBlink();
    this._scheduleIdleQuote();
  };

  /* 绑定事件：hover + 视线追踪 + 拖拽 + 点击交互 + 右键菜单 + 触控长按 */
  Pet.prototype._bindEvents = function () {
    if (!this.el) return;
    var self = this;
    this._boundEnter = function () { self.hovering = true; };
    this._boundLeave = function () { self.hovering = false; };
    this.el.addEventListener('mouseenter', this._boundEnter);
    this.el.addEventListener('mouseleave', this._boundLeave);

    /* 视线追踪：鼠标在玩偶上移动时更新目标位置 */
    this._boundMouseMove = function (e) {
      if (!self.el) return;
      var rect = self.el.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dx = e.clientX - cx;
      var dy = e.clientY - cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var maxLook = 2.5;
      self._targetLookX = dist > 0 ? (dx / dist) * maxLook : 0;
      self._targetLookY = dist > 0 ? (dy / dist) * maxLook : 0;
    };
    this.el.addEventListener('mousemove', this._boundMouseMove);

    /* 单击：随机表情 + 语录（2s 冷却） */
    this._boundClick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (self._clickCooldown) return;
      self._clickCooldown = true;
      if (self._clickCooldownTimer) clearTimeout(self._clickCooldownTimer);
      self._clickCooldownTimer = setTimeout(function () { self._clickCooldown = false; }, 2000);
      var emos = ['happy', 'excited', 'relax', 'proud', 'surprised'];
      var emo = emos[Math.floor(Math.random() * emos.length)];
      self.setEmotion(emo, 2500);
      if (self.character && self.character.quotes && self.character.quotes[emo]) {
        self.say(pick(self.character.quotes[emo]), 3000);
      }
    };
    this.el.addEventListener('click', this._boundClick);

    /* 双击：从库存喂食 */
    this._boundDblClick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      var family = self._family;
      if (!family) {
        self.say('还没有连接到仓库~', 2000);
        return;
      }
      var dp = family.settings && family.settings.desktopPet;
      var inv = (dp && dp.inventory) || {};
      var keys = Object.keys(inv);
      var snackKey = null;
      for (var i = 0; i < keys.length; i++) {
        if (inv[keys[i]] && inv[keys[i]] > 0) { snackKey = keys[i]; break; }
      }
      if (!snackKey) {
        self.setEmotion('sad', 2000);
        self.say('没有零食了，去商店看看吧~', 2500);
        return;
      }
      var petId = self.character && self.character.id ? self.character.id : 'xiaomo';
      family.feedPet(petId, snackKey);
      self.setEmotion('happy', 3000);
      self.say('好吃！谢谢投喂~', 3000);
    };
    this.el.addEventListener('dblclick', this._boundDblClick);

    /* 右键菜单（桌面端） */
    this._boundContextMenu = function (e) {
      if (self.isTouchDevice) return;
      e.preventDefault();
      e.stopPropagation();
      self._showContextMenu(e.clientX, e.clientY);
    };
    this.el.addEventListener('contextmenu', this._boundContextMenu);

    /* 长按商店（移动端 500ms） */
    this._boundTouchStart = function (e) {
      if (!self.isTouchDevice) return;
      self._longPressTimer = setTimeout(function () {
        self._longPressTimer = null;
        if (self.bus) self.bus.emit('desktop-pet:open-shop');
        self.setEmotion('excited', 2000);
        self.say('逛逛商店~', 2000);
      }, 500);
    };
    this._boundTouchEnd = function () {
      if (self._longPressTimer) {
        clearTimeout(self._longPressTimer);
        self._longPressTimer = null;
      }
    };
    this.el.addEventListener('touchstart', this._boundTouchStart, { passive: true });
    this.el.addEventListener('touchend', this._boundTouchEnd, { passive: true });
    this.el.addEventListener('touchcancel', this._boundTouchEnd, { passive: true });
  };

  /* 右键上下文菜单 */
  Pet.prototype._showContextMenu = function (x, y) {
    this._closeContextMenu();
    var self = this;
    var menu = document.createElement('div');
    menu.className = 'dp-context-menu';
    menu.setAttribute('role', 'menu');

    var hasInventory = false;
    if (this.store) {
      var dp = this.store.state.settings.desktopPet;
      var inv = dp.inventory || {};
      var keys = Object.keys(inv);
      for (var i = 0; i < keys.length; i++) {
        if (inv[keys[i]] && inv[keys[i]] > 0) { hasInventory = true; break; }
      }
    }

    var items = [
      { label: '摸摸头', action: function () { self.setEmotion('happy', 2500); self.say('嘿嘿~', 2000); } },
      { label: '喂食', action: function () { self._contextFeed(); }, disabled: !hasInventory },
      { label: '商店', action: function () { if (self.bus) self.bus.emit('desktop-pet:open-shop'); } },
      { label: '隐藏', action: function () { self.hide(); } }
    ];

    for (var j = 0; j < items.length; j++) {
      (function (item) {
        var btn = document.createElement('div');
        btn.className = 'dp-context-menu-item' + (item.disabled ? ' disabled' : '');
        btn.textContent = item.label;
        btn.setAttribute('role', 'menuitem');
        if (!item.disabled) {
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            self._closeContextMenu();
            item.action();
          });
        }
        menu.appendChild(btn);
      })(items[j]);
    }

    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    document.body.appendChild(menu);
    this._contextMenu = menu;

    /* 点击外部关闭（延迟绑定句柄需跟踪：destroy 后不得再向 document 挂监听） */
    var self2 = this;
    if (this._menuBindTimer) clearTimeout(this._menuBindTimer);
    this._menuBindTimer = setTimeout(function () {
      self2._menuBindTimer = null;
      if (self2._destroyed) return;
      self2._boundCloseMenu = function (e) {
        if (menu && !menu.contains(e.target)) {
          self2._closeContextMenu();
        }
      };
      document.addEventListener('click', self2._boundCloseMenu, { once: true });
      document.addEventListener('contextmenu', self2._boundCloseMenu, { once: true });
    }, 0);
  };

  Pet.prototype._closeContextMenu = function () {
    if (this._contextMenu && this._contextMenu.parentNode) {
      this._contextMenu.parentNode.removeChild(this._contextMenu);
    }
    this._contextMenu = null;
    if (this._boundCloseMenu) {
      document.removeEventListener('click', this._boundCloseMenu);
      document.removeEventListener('contextmenu', this._boundCloseMenu);
      this._boundCloseMenu = null;
    }
  };

  /* 右键菜单喂食操作 */
  Pet.prototype._contextFeed = function () {
    var family = this._family;
    if (!family) {
      this.say('还没有连接到仓库~', 2000);
      return;
    }
    var dp = family.settings && family.settings.desktopPet;
    var inv = (dp && dp.inventory) || {};
    var keys = Object.keys(inv);
    var snackKey = null;
    for (var i = 0; i < keys.length; i++) {
      if (inv[keys[i]] && inv[keys[i]] > 0) { snackKey = keys[i]; break; }
    }
    if (!snackKey) {
      this.say('没有零食了~', 2000);
      return;
    }
    var petId = this.character && this.character.id ? this.character.id : 'xiaomo';
    family.feedPet(petId, snackKey);
    this.setEmotion('happy', 3000);
    this.say('谢谢投喂~', 3000);
  };

  /* 启动自身动画（规格 C.6：rAF 由 PetFamily 统一驱动，此方法 Task 2 接循环） */
  Pet.prototype._start = function () {
    /* 预留：PetFamily 共享 rAF 启动后回调实例 */
  };

  /* 每帧更新：由 AnimationLoop 共享 rAF 驱动 */
  Pet.prototype._tick = function (dt, t) {
    if (!this.el) return;

    /* 呼吸相位 */
    this.breathe += dt;
    var breathePhase = Math.sin(this.breathe * Math.PI * 2 / 3.2);
    this.breatheScale = 1 + breathePhase * 0.03;

    /* 视线追踪平滑插值 */
    this.lookX += (this._targetLookX - this.lookX) * Math.min(1, dt * 8);
    this.lookY += (this._targetLookY - this.lookY) * Math.min(1, dt * 8);

    /* 情绪持续时间倒计时 */
    if (this.emotionDuration > 0) {
      this.emotionDuration -= dt * 1000;
      if (this.emotionDuration <= 0) {
        this.emotionDuration = 0;
        this.setEmotion(this.character.defaultEmotion || 'idle', 0);
      }
    }

    /* 装饰动画 tick */
    this._tickDecorations(dt, t);

    /* 应用视觉到 SVG */
    this._applyVisuals();
  };

  /** 将呼吸/视线/腮红状态应用到 SVG DOM */
  Pet.prototype._applyVisuals = function () {
    if (!this.el) return;

    /* 身体组：呼吸缩放 + 弹跳 Y 偏移 */
    if (this.bodyG) {
      var yOff = this.bounceY || 0;
      var s = this.breatheScale;
      this.bodyG.setAttribute('transform',
        'translate(0,' + yOff + ') scale(' + s + ',' + s + ')');
    }

    /* 眼睛：视线追踪偏移（在情绪 eyes lookX/Y 基础上叠加） */
    if (this.eyeL && this.eyeR) {
      var cfg = EMO_CONFIGS[this.emotion] || EMO_CONFIGS.idle;
      var lx = this.lookX + (cfg.eyes.lookX || 0);
      var ly = this.lookY + (cfg.eyes.lookY || 0);
      this.eyeL.setAttribute('transform', 'translate(' + (38 + lx) + ',' + (48 + ly) + ')');
      this.eyeR.setAttribute('transform', 'translate(' + (62 + lx) + ',' + (48 + ly) + ')');
    }

    /* 腮红透明度 */
    if (this.blushOpacity !== undefined) {
      var blushL = this.el.querySelector('.dp-blush-l');
      var blushR = this.el.querySelector('.dp-blush-r');
      if (blushL) blushL.setAttribute('opacity', String(this.blushOpacity));
      if (blushR) blushR.setAttribute('opacity', String(this.blushOpacity));
    }
  };

  /** 装饰动画逐帧更新（zzz 浮动、star 闪烁、sweat 滴落） */
  Pet.prototype._tickDecorations = function (dt, t) {
    if (!this.el) return;

    /* zzz 浮动（sleepy 情绪） */
    var zzz = this.el.querySelector('.dp-zzz');
    if (zzz) {
      if (this.emotion === 'sleepy') {
        zzz.setAttribute('opacity', '1');
        var phase = (t / 1000) % 2;
        zzz.setAttribute('transform', 'translate(0,' + (-phase * 6) + ')');
        zzz.style.opacity = String(1 - phase / 2);
      } else {
        zzz.setAttribute('opacity', '0');
      }
    }

    /* 星星眼闪烁（excited 情绪） */
    var starL = this.el.querySelector('.dp-star-l');
    var starR = this.el.querySelector('.dp-star-r');
    if (starL && starR) {
      if (this.emotion === 'excited') {
        var pulse = 0.7 + Math.sin(t / 180) * 0.3;
        starL.setAttribute('opacity', String(pulse));
        starR.setAttribute('opacity', String(pulse));
      } else {
        starL.setAttribute('opacity', '0');
        starR.setAttribute('opacity', '0');
      }
    }

    /* 思考气泡脉冲（thinking 情绪） */
    var think = this.el.querySelector('.dp-think');
    if (think) {
      if (this.emotion === 'thinking') {
        think.setAttribute('opacity', '1');
        var thinkPulse = 0.6 + Math.sin(t / 300) * 0.4;
        think.setAttribute('opacity', String(thinkPulse));
      } else {
        think.setAttribute('opacity', '0');
      }
    }

    /* 感叹号弹跳（surprised 情绪） */
    var exclaim = this.el.querySelector('.dp-exclaim');
    if (exclaim) {
      if (this.emotion === 'surprised') {
        var ey = Math.sin(t / 150) * 2;
        exclaim.setAttribute('transform', 'translate(0,' + ey + ')');
        exclaim.setAttribute('opacity', '1');
      } else {
        exclaim.setAttribute('opacity', '0');
      }
    }

    /* 问号旋转（confused 情绪） */
    var question = this.el.querySelector('.dp-question');
    if (question) {
      if (this.emotion === 'confused') {
        var qr = Math.sin(t / 400) * 8;
        question.setAttribute('transform', 'rotate(' + qr + ', 72, 22)');
        question.setAttribute('opacity', '1');
      } else {
        question.setAttribute('opacity', '0');
      }
    }

    /* 闪光缩放（proud 情绪） */
    var sparkle = this.el.querySelector('.dp-sparkle');
    if (sparkle) {
      if (this.emotion === 'proud') {
        var sp = 0.8 + Math.sin(t / 220) * 0.2;
        sparkle.setAttribute('transform', 'scale(' + sp + ')');
        sparkle.setAttribute('opacity', '1');
      } else {
        sparkle.setAttribute('opacity', '0');
      }
    }

    /* 挥手鳍摆动（wave/goodbye 情绪） */
    var waveFin = this.el.querySelector('.dp-wave-fin');
    if (waveFin) {
      if (this.emotion === 'wave' || this.emotion === 'goodbye') {
        waveFin.setAttribute('opacity', '1');
        var waveAngle = Math.sin(t / 200) * 15;
        waveFin.setAttribute('transform', 'rotate(' + waveAngle + ', 82, 50)');
      } else {
        waveFin.setAttribute('opacity', '0');
      }
    }

    /* 放松波纹（relax 情绪） */
    var relax = this.el.querySelector('.dp-relax-waves');
    if (relax) {
      relax.setAttribute('opacity', this.emotion === 'relax' ? '1' : '0');
    }

    /* 汗滴（busy 情绪） */
    var sweat = this.el.querySelector('.dp-sweat');
    if (sweat) {
      if (this.emotion === 'busy') {
        sweat.setAttribute('opacity', '1');
        var sy2 = (t / 500) % 1 * 6;
        sweat.setAttribute('transform', 'translate(0,' + sy2 + ')');
      } else {
        sweat.setAttribute('opacity', '0');
      }
    }
  };

  /* ---- 特效触发器（Task 8：交互视觉反馈） ---- */

  /** 喂食星星散射：在角色周围创建 5 颗随机星星 */
  Pet.prototype._triggerFeedEffect = function () {
    if (this._isDragging || !_motionOk()) return;
    var self = this;
    var el = this.el;
    if (!el) return;
    var symbols = ['✦', '✧', '★', '·', '∗'];
    for (var i = 0; i < 5; i++) {
      (function (idx) {
        var s = document.createElement('span');
        s.className = 'dp-fx-sparkle';
        s.textContent = symbols[idx % symbols.length];
        s.style.setProperty('--tx', (Math.random() * 24 - 12) + 'px');
        s.style.setProperty('--ty', -(Math.random() * 14 + 10) + 'px');
        s.style.setProperty('--rot', (Math.random() * 360) + 'deg');
        s.style.setProperty('--dur', (0.4 + Math.random() * 0.25) + 's');
        s.style.left = (20 + Math.random() * 60) + '%';
        s.style.top = (30 + Math.random() * 40) + '%';
        el.appendChild(s);
        var fxTimer = setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 700);
        if (self._fxTimers) self._fxTimers.push(fxTimer);
      })(i);
    }
  };

  /** 金币飘字 +N：在角色顶部显示获得数量 */
  Pet.prototype._triggerCoinEffect = function (amount) {
    if (this._isDragging || !_motionOk()) return;
    var el = this.el;
    if (!el || !amount || amount <= 0) return;
    var t = document.createElement('span');
    t.className = 'dp-fx-coin';
    t.textContent = '+' + amount;
    el.appendChild(t);
    var fxTimer2 = setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 850);
    if (this._fxTimers) this._fxTimers.push(fxTimer2);
  };

  /** 成就解锁光环：角色外框脉冲发光 */
  Pet.prototype._triggerAchievementEffect = function () {
    if (this._isDragging || !_motionOk()) return;
    var el = this.el;
    if (!el) return;
    var self3 = this;
    el.classList.add('dp-fx-glow');
    var fxTimer3 = setTimeout(function () { if (!self3._destroyed && el) el.classList.remove('dp-fx-glow'); }, 950);
    if (this._fxTimers) this._fxTimers.push(fxTimer3);
  };

  /** 互动爱心飘散：在角色周围创建 3 颗爱心 */
  Pet.prototype._triggerInteractEffect = function () {
    if (this._isDragging || !_motionOk()) return;
    var self4 = this;
    var el = this.el;
    if (!el) return;
    for (var i = 0; i < 3; i++) {
      (function (idx) {
        var h = document.createElement('span');
        h.className = 'dp-fx-heart';
        h.textContent = '♥';
        h.style.setProperty('--tx', (Math.random() * 16 - 8) + 'px');
        h.style.setProperty('--ty', -(Math.random() * 12 + 10) + 'px');
        h.style.left = (25 + Math.random() * 50) + '%';
        h.style.top = (20 + Math.random() * 30) + '%';
        h.style.fontSize = (10 + Math.random() * 5) + 'px';
        h.style.color = ['#ff6b8a', '#ff4757', '#e84393'][idx % 3];
        el.appendChild(h);
        var fxTimer4 = setTimeout(function () { if (h.parentNode) h.parentNode.removeChild(h); }, 700);
        if (self4._fxTimers) self4._fxTimers.push(fxTimer4);
      })(i);
    }
  };

  /** 获取随机角色实例（用于被动触发） */
  PetFamily.prototype._randomPet = function () {
    var instances = this.display && this.display.instances;
    if (!instances) return null;
    var keys = Object.keys(instances);
    if (keys.length === 0) return null;
    return instances[keys[Math.floor(Math.random() * keys.length)]];
  };

  /* 绘制眼睛（C.3：6 形状 + 2 特殊） */
  function drawEyeShape(g, shape, side, scaleY) {
    g = g || document.createElementNS(SVG_NS, 'g');
    if (!g) return;
    g.innerHTML = ''; /* 仅清空，不用 innerHTML 注入 */
    while (g.firstChild) g.removeChild(g.firstChild);

    var name = typeof shape === 'string' ? shape : (shape && shape.name) || 'dot';
    var sY = typeof scaleY === 'number' ? scaleY : 1;

    if (name === 'dot') {
      var c1 = document.createElementNS(SVG_NS, 'circle');
      c1.setAttribute('r', '3');
      c1.setAttribute('fill', 'var(--dp-eye,rgba(43,38,32,0.85))');
      g.appendChild(c1);
      var hi = document.createElementNS(SVG_NS, 'circle');
      hi.setAttribute('r', '0.8');
      hi.setAttribute('cx', '-1');
      hi.setAttribute('cy', '-1');
      hi.setAttribute('fill', 'rgba(255,255,255,0.8)');
      g.appendChild(hi);
    } else if (name === 'arc') {
      var a = document.createElementNS(SVG_NS, 'path');
      a.setAttribute('d', 'M-4 0 Q0 4 4 0');
      a.setAttribute('fill', 'none');
      a.setAttribute('stroke', 'var(--dp-eye,rgba(43,38,32,0.85))');
      a.setAttribute('stroke-width', '2');
      a.setAttribute('stroke-linecap', 'round');
      g.appendChild(a);
    } else if (name === 'arc-up') {
      var au = document.createElementNS(SVG_NS, 'path');
      au.setAttribute('d', 'M-5 -1 Q0 -5 5 -1');
      au.setAttribute('fill', 'none');
      au.setAttribute('stroke', 'var(--dp-eye,rgba(43,38,32,0.85))');
      au.setAttribute('stroke-width', '2');
      au.setAttribute('stroke-linecap', 'round');
      g.appendChild(au);
    } else if (name === 'star') {
      var st = document.createElementNS(SVG_NS, 'text');
      st.setAttribute('x', '-5');
      st.setAttribute('y', '3');
      st.setAttribute('font-size', '10');
      st.setAttribute('fill', '#f5c542');
      st.textContent = '★';
      g.appendChild(st);
    } else if (name === 'wide') {
      var wb = document.createElementNS(SVG_NS, 'circle');
      wb.setAttribute('r', '4');
      wb.setAttribute('fill', 'var(--dp-eye,rgba(43,38,32,0.85))');
      g.appendChild(wb);
      var wp = document.createElementNS(SVG_NS, 'circle');
      wp.setAttribute('r', '1.5');
      wp.setAttribute('fill', 'rgba(255,255,255,0.9)');
      g.appendChild(wp);
    } else if (name === 'closed') {
      var cl = document.createElementNS(SVG_NS, 'path');
      cl.setAttribute('d', 'M-4 1 Q0 -2 4 1');
      cl.setAttribute('fill', 'none');
      cl.setAttribute('stroke', 'var(--dp-eye,rgba(43,38,32,0.85))');
      cl.setAttribute('stroke-width', '2');
      cl.setAttribute('stroke-linecap', 'round');
      g.appendChild(cl);
    } else if (name === 'asymmetric') {
      /* 左 dot 上视，右 arc 眯眼（side 区分） */
      if (side === 'left') {
        var al = document.createElementNS(SVG_NS, 'circle');
        al.setAttribute('r', '3');
        al.setAttribute('fill', 'var(--dp-eye,rgba(43,38,32,0.85))');
        g.appendChild(al);
      } else {
        var ar = document.createElementNS(SVG_NS, 'path');
        ar.setAttribute('d', 'M-4 0 Q0 4 4 0');
        ar.setAttribute('fill', 'none');
        ar.setAttribute('stroke', 'var(--dp-eye,rgba(43,38,32,0.85))');
        ar.setAttribute('stroke-width', '2');
        ar.setAttribute('stroke-linecap', 'round');
        g.appendChild(ar);
      }
    } else if (name === 'darting') {
      var dc = document.createElementNS(SVG_NS, 'circle');
      dc.setAttribute('r', '3');
      dc.setAttribute('fill', 'var(--dp-eye,rgba(43,38,32,0.85))');
      g.appendChild(dc);
      var dh = document.createElementNS(SVG_NS, 'circle');
      dh.setAttribute('r', '0.8');
      dh.setAttribute('cx', '-1');
      dh.setAttribute('cy', '-1');
      dh.setAttribute('fill', 'rgba(255,255,255,0.8)');
      g.appendChild(dh);
    } else {
      var cd = document.createElementNS(SVG_NS, 'circle');
      cd.setAttribute('r', '3');
      cd.setAttribute('fill', 'var(--dp-eye,rgba(43,38,32,0.85))');
      g.appendChild(cd);
    }

    if (sY !== 1) {
      g.setAttribute('transform', 'translate(0,0) scale(1,' + sY + ')');
    }
  }

  /* 绘制当前表情的眼睛（左右） */
  Pet.prototype._drawEyes = function (eyeL, eyeR, eyesCfg, side) {
    drawEyeShape(eyeL, eyesCfg.shape, 'left', eyesCfg.scaleY);
    drawEyeShape(eyeR, eyesCfg.shape, 'right', eyesCfg.scaleY);
  };

  /* 绘制嘴巴（C.4：9 类型） */
  Pet.prototype._drawMouth = function (config) {
    DrawMouth(this.mouth, config);
  };

  function DrawMouth(path, config) {
    if (!path) return;
    var type = (config && config.type) || 'flat';
    var w = (config && config.w) || 10;
    var h = (config && config.h) || 4;
    var d = '';
    if (type === 'smile' || type === 'encourage') {
      d = 'M' + (50 - w / 2) + ' 62 Q50 ' + (62 + h) + ' ' + (50 + w / 2) + ' 62';
    } else if (type === 'big-smile') {
      d = 'M' + (50 - 8) + ' 61 Q50 ' + (62 + 12) + ' ' + (50 + 8) + ' 61';
    } else if (type === 'frown') {
      d = 'M' + (50 - w / 2) + ' ' + (62 + h) + ' Q50 ' + (62 - h) + ' ' + (50 + w / 2) + ' ' + (62 + h);
    } else if (type === 'flat') {
      d = 'M' + (50 - w / 2) + ' 62 L' + (50 + w / 2) + ' 62';
    } else if (type === 'open') {
      path.setAttribute('fill', 'var(--dp-mouth,rgba(43,38,32,0.7))');
      d = 'M' + (50 - 5) + ' 62 Q50 ' + (62 + 8) + ' ' + (50 + 5) + ' 62 Z';
    } else if (type === 'wavy') {
      d = 'M' + (50 - w / 2) + ' 62 Q' + (50 - w / 4) + ' 59 50 62 Q' + (50 + w / 4) + ' 65 ' + (50 + w / 2) + ' 62';
    } else if (type === 'o-small' || type === 'o-tiny' || type === 'yawn') {
      var rx = type === 'o-tiny' ? 2 : type === 'yawn' ? 5 : 3;
      var ry = type === 'o-tiny' ? 2.5 : type === 'yawn' ? 6 : 4;
      var ell = document.createElementNS(SVG_NS, 'ellipse');
      ell.setAttribute('cx', '50');
      ell.setAttribute('cy', '63');
      ell.setAttribute('rx', String(rx));
      ell.setAttribute('ry', String(ry));
      ell.setAttribute('fill', 'var(--dp-mouth,rgba(43,38,32,0.7))');
      path.parentNode.appendChild(ell);
      clearMouth(path);
      return;
    } else {
      d = 'M' + (50 - w / 2) + ' 62 L' + (50 + w / 2) + ' 62';
    }
    clearMouth(path);
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
  }

  function clearMouth(path) {
    if (!path) return;
    var sib = path.parentNode;
    if (!sib) return;
    var arr = [];
    var child = sib.firstChild;
    while (child) {
      if (child !== path && child.nodeName.toLowerCase() === 'ellipse') arr.push(child);
      child = child.nextSibling;
    }
    for (var i = 0; i < arr.length; i++) sib.removeChild(arr[i]);
  }

  /* 调度下次眨眼（随机间隔；_destroyed 守卫防竞态复活） */
  Pet.prototype._scheduleBlink = function () {
    if (this._destroyed) return;
    var self = this;
    var lo = this.character.blink[0];
    var hi = this.character.blink[1];
    if (this._blinkTimer) clearTimeout(this._blinkTimer);
    this._blinkTimer = setTimeout(function () {
      if (self._destroyed) return;
      self._doBlink();
      self._scheduleBlink();
    }, rand(lo, hi));
  };

  /* 执行一次眨眼（视觉由 CSS dp-eyes-closed 实现） */
  Pet.prototype._doBlink = function () {
    if (!this.el || this._destroyed) return;
    /* 保存当前眼睛形状，切换到闭眼 */
    var _savedShape = this._currentEyeShape || null;
    var cfg = EMO_CONFIGS[this.emotion] || EMO_CONFIGS.idle;
    drawEyeShape(this.eyeL, 'closed', 'left', 0.08);
    drawEyeShape(this.eyeR, 'closed', 'right', 0.08);
    this.el.classList.add('dp-eyes-closed');
    var self = this;
    var restoreTimer = setTimeout(function () {
      if (!self.el || self._destroyed) return;
      self.el.classList.remove('dp-eyes-closed');
      /* 恢复当前情绪的眼睛形状 */
      if (self.eyeL && self.eyeR) {
        self._drawEyes(self.eyeL, self.eyeR, cfg.eyes, 'idle');
      }
    }, 160);
    if (this._fxTimers) this._fxTimers.push(restoreTimer);
  };

  /* 调度待机语录（15-30 秒，40% 概率，D.4；_destroyed 守卫防竞态复活） */
  Pet.prototype._scheduleIdleQuote = function () {
    if (this._destroyed) return;
    var self = this;
    if (this._idleQuoteTimer) clearTimeout(this._idleQuoteTimer);
    this._idleQuoteTimer = setTimeout(function () {
      if (self._destroyed) return;
      if (self.emotion === 'idle' && Math.random() < 0.4) {
        self.say(pick(self.character.quotes.idle), 3000);
      }
      self._scheduleIdleQuote();
    }, rand(15000, 30000));
  };

  /* 深夜检测（23-6 点 idle→sleepy） */
  Pet.prototype._checkLateNight = function () {
    var h = new Date().getHours();
    if (h >= 23 || h < 6) {
      if (this.emotion === 'idle') this.setEmotion('sleepy');
    }
  };

  /* 尝试接入 SonderBus/SonderStore（Task 2 完整实现） */
  Pet.prototype._tryIntegrate = function () {
    /* 预留：PetFamily 统一集成，单 Pet 不直接订阅 */
  };

  /* 数据变更反应（Task 3 接入 /data/*） */
  Pet.prototype._onDataChange = function (path) {
    /* 预留 */
  };

  /* 设置变更反应（Task 2 响应大小/开关） */
  Pet.prototype._onSettingsChange = function () {
    /* 预留 */
  };

  /* 应用位置 */
  Pet.prototype._applyPosition = function (pos) {
    if (!this.el || !pos) return;
    this.el.style.left = pos.x + 'px';
    this.el.style.top = pos.y + 'px';
  };

  /* 保存位置（store 优先，localStorage fallback） */
  Pet.prototype._savePosition = function () {
    /* Task 2 接入 store 后实现 */
  };

  /* 加载位置 */
  Pet.prototype._loadPosition = function () {
    return null;
  };

  /* 设置表情（公开） */
  Pet.prototype.setEmotion = function (name, duration) {
    var cfg = EMO_CONFIGS[name];
    if (!cfg) return false;
    this.targetEmotion = name;
    this.emotion = name;
    this.emotionDuration = typeof duration === 'number' ? duration : 0;
    /* 表情装饰联动（opacity 由 CSS 类控制） */
    if (this.el) {
      var cls = this.el.className;
      cls = cls.replace(/\bdp-emotion-[a-z-]+\b/g, '').trim();
      this.el.className = cls + ' dp-emotion-' + name;
    }
    if (this.eyeL && this.eyeR && this.mouth) {
      this._drawEyes(this.eyeL, this.eyeR, cfg.eyes, 'idle');
      DrawMouth(this.mouth, cfg.mouth);
    }
    if (this.bubble && this.character && this.character.quotes) {
      /* 事件触发表情时 50% 概率显示对应场景语录（D.4） */
      if (Math.random() < 0.5 && this.character.quotes[name] && this.character.quotes[name].length) {
        this.say(pick(this.character.quotes[name]), 3000);
      }
    }
    return true;
  };

  /* 获取当前表情（公开） */
  Pet.prototype.getEmotion = function () {
    return this.emotion;
  };

  /* 显示气泡（公开） */
  Pet.prototype.say = function (text, duration) {
    if (!this.bubble) return;
    if (this._sayTimer) clearTimeout(this._sayTimer);
    this.bubble.textContent = text;
    this.bubble.classList.add('dp-show');
    var self = this;
    var dur = typeof duration === 'number' ? duration : 3000;
    this._sayTimer = setTimeout(function () {
      self.bubble.classList.remove('dp-show');
    }, dur);
  };

  /* 互动对话专用气泡（Task 4 接入） */
  Pet.prototype.sayLine = function (text, duration) {
    this.say(text, duration || 3000);
  };

  /* 调整大小（公开） */
  Pet.prototype.setSize = function (px) {
    var size = typeof px === 'number' && px > 0 ? px : 84;
    this.size = size;
    if (this.el) {
      this.el.style.width = size + 'px';
      this.el.style.height = size + 'px';
    }
  };

  /* 显示（公开） */
  Pet.prototype.show = function () {
    if (!this.el) return;
    this.el.style.display = '';
  };

  /* 隐藏（公开） */
  Pet.prototype.hide = function () {
    if (!this.el) return;
    this.el.style.display = 'none';
  };

  /* 喂食（Task 3 接入 FeedManager 完整实现） */
  Pet.prototype.feed = function (snackId) {
    /* 预留 */
  };

  /* 出场动画（Task 2：滑入 + wave，由 DisplayManager 串门调度调用） */
  Pet.prototype.enter = function (fromSide) {
    if (!this.el) return;
    this.show();
    this._aniTimers = this._aniTimers || [];
    var self = this;
    if (fromSide === 'right') {
      this.el.style.transition = 'transform 0.6s ease, opacity 0.6s ease';
      this.el.style.opacity = '0';
      this.el.style.transform = 'translateX(40px)';
      this._aniTimers.push(setTimeout(function () {
        self.el.style.opacity = '1';
        self.el.style.transform = 'translateX(0)';
      }, 20));
    } else {
      this.el.style.transition = 'opacity 0.6s ease';
      this.el.style.opacity = '1';
    }
    this.setEmotion('wave');
    this._aniTimers.push(setTimeout(function () {
      if (self.el) self.el.style.transition = '';
      if (self.character) self._setDefaultEmotion();
    }, 2500));
  };

  /* 离场动画（Task 2：goodbye 1.5s + 滑出 500ms） */
  Pet.prototype.exit = function (toSide) {
    if (!this.el) return;
    this._aniTimers = this._aniTimers || [];
    var self = this;
    this.setEmotion('goodbye');
    this._aniTimers.push(setTimeout(function () {
      if (!self.el) return;
      self.el.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
      self.el.style.opacity = '0';
      if (toSide === 'right') self.el.style.transform = 'translateX(40px)';
      self._aniTimers.push(setTimeout(function () { self.hide(); }, 520));
    }, 1500));
  };

  /* 回到角色默认表情（enter 结束后） */
  Pet.prototype._setDefaultEmotion = function () {
    if (this.character && this.character.defaultEmotion) {
      this.setEmotion(this.character.defaultEmotion, 0);
    }
  };

  /* 销毁（移除监听/定时器/DOM）。_destroyed 置位必须最先执行：
   * 自续期链（眨眼/语录）与延迟绑定回调据此放弃复活。 */
  Pet.prototype.destroy = function () {
    this._destroyed = true;
    if (this._blinkTimer) clearTimeout(this._blinkTimer);
    if (this._idleQuoteTimer) clearTimeout(this._idleQuoteTimer);
    if (this._sayTimer) clearTimeout(this._sayTimer);
    if (this._longPressTimer) clearTimeout(this._longPressTimer);
    if (this._clickCooldownTimer) { clearTimeout(this._clickCooldownTimer); this._clickCooldownTimer = null; }
    if (this._menuBindTimer) { clearTimeout(this._menuBindTimer); this._menuBindTimer = null; }
    /* 特效/眨眼恢复等短命定时器统一清理 */
    if (this._fxTimers) {
      this._fxTimers.forEach(clearTimeout);
      this._fxTimers = [];
    }
    if (this._aniTimers) {
      this._aniTimers.forEach(clearTimeout);
      this._aniTimers = [];
    }
    if (this._boundEnter && this.el) this.el.removeEventListener('mouseenter', this._boundEnter);
    if (this._boundLeave && this.el) this.el.removeEventListener('mouseleave', this._boundLeave);
    if (this._boundMouseMove && this.el) this.el.removeEventListener('mousemove', this._boundMouseMove);
    if (this._boundClick && this.el) this.el.removeEventListener('click', this._boundClick);
    if (this._boundDblClick && this.el) this.el.removeEventListener('dblclick', this._boundDblClick);
    if (this._boundContextMenu && this.el) this.el.removeEventListener('contextmenu', this._boundContextMenu);
    if (this._boundTouchStart && this.el) this.el.removeEventListener('touchstart', this._boundTouchStart);
    if (this._boundTouchEnd && this.el) this.el.removeEventListener('touchend', this._boundTouchEnd);
    if (this._boundTouchCancel && this.el) this.el.removeEventListener('touchcancel', this._boundTouchEnd);
    this._closeContextMenu();
    /* 清理拖拽事件 */
    if (this._boundDown && this.el) this.el.removeEventListener('pointerdown', this._boundDown);
    if (this._boundDown && this.el) this.el.removeEventListener('mousedown', this._boundDown);
    if (typeof window !== 'undefined') {
      if (this._boundMove) { window.removeEventListener('pointermove', this._boundMove); window.removeEventListener('mousemove', this._boundMove); }
      if (this._boundUp) { window.removeEventListener('pointerup', this._boundUp); window.removeEventListener('mouseup', this._boundUp); }
    }
    /* 清理订阅 */
    if (this.unsubs) {
      this.unsubs.forEach(function (fn) { try { fn(); } catch (e) { /* 忽略 */ } });
      this.unsubs = [];
    }
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
    this.el = null;
  };

  /* ============================================================
     第四区：子管理器（MANAGERS）
     - AnimationLoop：共享 rAF 循环（单循环驱动全部活跃实例 _tick）
     - DisplayManager：显示模式（single/duo/trio）+ 串门调度 + 布局 + 拖拽
     - InteractionManager：Task 4 接入，当前为占位
     ============================================================ */

  var requestFrame = (typeof requestAnimationFrame === 'function')
    ? requestAnimationFrame
    : function (cb) { return setTimeout(function () { cb(Date.now() + 1); }, 16); };
  var cancelFrame = (typeof cancelAnimationFrame === 'function')
    ? cancelAnimationFrame
    : clearTimeout;

  /* 共享 rAF 循环：start/stop，visibilitychange 暂停续算，dt 上限 0.05s */
  /** @constructor
   * @this {{ instances: any[], _raf: number, _running: boolean, _last: number,
   *   _boundTick: Function, _boundVis: any,
   *   add: Function, remove: Function, start: Function, stop: Function, _tick: Function }} */
  function AnimationLoop() {
    this.instances = [];
    this._raf = 0;
    this._running = false;
    this._last = 0;
    this._boundTick = this._tick.bind(this);
    this._boundVis = null;
  }

  AnimationLoop.prototype.add = function (inst) {
    if (this.instances.indexOf(inst) !== -1) return;
    this.instances.push(inst);
    this.start();
  };

  AnimationLoop.prototype.remove = function (inst) {
    var i = this.instances.indexOf(inst);
    if (i !== -1) this.instances.splice(i, 1);
  };

  AnimationLoop.prototype.start = function () {
    if (this._running) return;
    this._running = true;
    this._last = 0;
    this._raf = requestFrame(this._boundTick);
    if (!this._boundVis && typeof document !== 'undefined') {
      var self = this;
      this._boundVis = function () {
        if (document.hidden) {
          self._running = false;
          if (self._raf) cancelFrame(self._raf);
          self._raf = 0;
        } else {
          self._running = true;
          self._last = 0;
          self._raf = requestFrame(self._boundTick);
        }
      };
      document.addEventListener('visibilitychange', this._boundVis);
    }
  };

  AnimationLoop.prototype.stop = function () {
    this._running = false;
    if (this._raf) cancelFrame(this._raf);
    this._raf = 0;
    if (this._boundVis && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._boundVis);
      this._boundVis = null;
    }
  };

  AnimationLoop.prototype._tick = function (t) {
    if (!this._running) return;
    var now = typeof t === 'number' ? t : Date.now();
    var dt = this._last ? Math.min((now - this._last) / 1000, 0.05) : 0;
    this._last = now;
    var list = this.instances.slice();
    for (var i = 0; i < list.length; i++) {
      if (list[i] && typeof list[i]._tick === 'function') list[i]._tick(dt, now);
    }
    this._raf = requestFrame(this._boundTick);
  };

  /* 显示管理器：按模式管理实例数量、串门状态机、布局与拖拽 */
  /** @constructor
   * @this {{ family: any, instances: Object, visitorRole: any, _visitTimer: any, _leaveTimer: any,
   *   _exitTimer: any, _exitRole: any, _cooldowns: Object, _boundResize: any, _resizeT: any,
   *   _orderedIds: Function, syncInstances: Function, _createInstance: Function, _destroyInstance: Function,
   *   _unbindDrag: Function, get: Function, layout: Function, _bindResize: Function, _bindDrag: Function,
   *   _persistPosition: Function, _clearVisit: Function, _teardownVisitor: Function,
   *   _scheduleVisit: Function, _candidates: Function,
   *   summonVisitor: Function, _tryVisit: Function, _spawnVisitor: Function, _leaveVisitor: Function }} */
  function DisplayManager(family) {
    this.family = family;
    this.instances = {};      /* roleId -> Pet */
    this.visitorRole = null;  /* 当前串门角色 */
    this._visitTimer = null;
    this._leaveTimer = null;
    this._exitTimer = null;   /* 离场动画 2s 窗口（期间禁止新串门） */
    this._exitRole = null;    /* 离场中的角色（窗口期实例仍在场） */
    this._cooldowns = {};     /* roleId -> 冷却结束时间戳(ms) */
    this._boundResize = null;
    this._resizeT = null;
  }

  /* 常驻角色的排序：其余角色在前、常驻在后（默认右下角常驻为锚点） */
  DisplayManager.prototype._orderedIds = function () {
    var resident = this.family.getResident();
    var rest = ROLE_IDS.filter(function (id) { return id !== resident; });
    return rest.concat([resident]);
  };

  DisplayManager.prototype.syncInstances = function () {
    var mode = this.family.getMode();
    var resident = this.family.getResident();
    var wanted = mode === 'trio' ? ROLE_IDS.slice() : [resident];
    if (mode === 'duo' && this.visitorRole && wanted.indexOf(this.visitorRole) === -1) {
      wanted.push(this.visitorRole);
    }

    var self = this;
    Object.keys(this.instances).forEach(function (id) {
      if (wanted.indexOf(id) === -1) self._destroyInstance(id);
    });

    /* 只创建 wanted 集合：duo=常驻（不预建串门），single=常驻，trio=3 */
    var orderedIds = this._orderedIds().filter(function (id) {
      return wanted.indexOf(id) !== -1;
    });
    orderedIds.forEach(function (id) {
      if (!self.instances[id]) self._createInstance(id, mode === 'duo' && id !== resident);
    });

    this.layout();
    if (mode === 'duo') this._scheduleVisit(); else this._clearVisit();
  };

  DisplayManager.prototype._createInstance = function (roleId, isVisitor) {
    var pet = new Pet({
      container: this.family.ensureContainer(),
      size: this.family.getSize(),
      character: roleId,
      autoIntegrate: false
    });
    if (pet.el) {
      pet.el.style.position = 'absolute';
      pet.el.setAttribute('data-role', roleId);
      pet.el.classList.add('dp-role-' + roleId);
      if (isVisitor) pet.el.classList.add('dp-visitor');
      this._bindDrag(pet, roleId);
    }
    this.instances[roleId] = pet;
    pet._family = this.family;
    this.family.loop.add(pet);
    return pet;
  };

  DisplayManager.prototype._destroyInstance = function (roleId) {
    var pet = this.instances[roleId];
    if (pet) {
      this.family.loop.remove(pet);
      this._unbindDrag(pet);
      pet.destroy();
    }
    delete this.instances[roleId];
    if (this.visitorRole === roleId) this.visitorRole = null;
  };

  DisplayManager.prototype._unbindDrag = function (pet) {
    if (!pet.el) return;
    var usePointer = (typeof window !== 'undefined') && typeof window.PointerEvent === 'function';
    var DOWN = usePointer ? 'pointerdown' : 'mousedown';
    var MOVE = usePointer ? 'pointermove' : 'mousemove';
    var UP = usePointer ? 'pointerup' : 'mouseup';
    if (pet._boundDown) pet.el.removeEventListener(DOWN, pet._boundDown);
    if (typeof window !== 'undefined') {
      if (pet._boundMove) window.removeEventListener(MOVE, pet._boundMove);
      if (pet._boundUp) window.removeEventListener(UP, pet._boundUp);
    }
  };

  DisplayManager.prototype.get = function (roleId) {
    return this.instances[roleId] || null;
  };

  /* 布局（规格 3.4 默认右下角；2 个横向间距 10px，3 个间距 8px，<480px 纵向堆叠） */
  DisplayManager.prototype.layout = function () {
    var family = this.family;
    var mode = family.getMode();
    var size = family.getSize();
    var w = (typeof window !== 'undefined' && window.innerWidth) || 1024;
    var h = (typeof window !== 'undefined' && window.innerHeight) || 768;
    if (!w || !h) return;
    var gap = mode === 'trio' ? 8 : 10;
    var margin = 16;
    var vertical = w < 480;
    var self = this;
    var ids = this._orderedIds().filter(function (id) { return self.instances[id]; });
    var positions = this.family.getPositions();

    ids.forEach(function (id, index) {
      var el = self.instances[id].el;
      if (!el) return;
      var x = null;
      var y = null;
      if (positions[id] && typeof positions[id].x === 'number' && typeof positions[id].y === 'number') {
        x = positions[id].x;
        y = positions[id].y;
      } else if (vertical) {
        x = w - size - margin;
        y = h - size - margin - index * (size + gap);
      } else {
        x = w - size - margin - index * (size + gap);
        y = h - size - margin;
      }
      el.style.left = clamp(Math.round(x), 0, Math.max(0, w - size)) + 'px';
      el.style.top = clamp(Math.round(y), 0, Math.max(0, h - size)) + 'px';
    });
  };

  /* resize 越界自动拉回（节流 100ms） */
  DisplayManager.prototype._bindResize = function () {
    if (this._boundResize || typeof window === 'undefined') return;
    var self = this;
    this._boundResize = function () {
      if (self._resizeT) return;
      self._resizeT = setTimeout(function () {
        self._resizeT = null;
        self.layout();
      }, 100);
    };
    window.addEventListener('resize', this._boundResize);
  };

  /* 拖拽：位置独立持久化到 desktopPet.positions[roleId]（指针事件优先，回退鼠标事件） */
  DisplayManager.prototype._bindDrag = function (pet, roleId) {
    if (!pet.el) return;
    var self = this;
    var startX = 0;
    var startY = 0;
    var baseX = 0;
    var baseY = 0;
    var dragging = false;
    var usePointer = (typeof window !== 'undefined') && typeof window.PointerEvent === 'function';
    var DOWN = usePointer ? 'pointerdown' : 'mousedown';
    var MOVE = usePointer ? 'pointermove' : 'mousemove';
    var UP = usePointer ? 'pointerup' : 'mouseup';

    pet._boundDown = function (e) {
      if (e.button === 2 || self.visitorRole === roleId) return; /* 右键菜单/串门不可拖拽 */
      dragging = true;
      var pos = pet.el.getBoundingClientRect();
      startX = (typeof e.clientX === 'number') ? e.clientX : 0;
      startY = (typeof e.clientY === 'number') ? e.clientY : 0;
      baseX = pos.left;
      baseY = pos.top;
      pet.el.style.transition = 'none';
    };
    pet._boundMove = function (e) {
      if (!dragging) return;
      var nx = (typeof e.clientX === 'number') ? e.clientX - startX + baseX : baseX;
      var ny = (typeof e.clientY === 'number') ? e.clientY - startY + baseY : baseY;
      pet.el.style.left = Math.round(nx) + 'px';
      pet.el.style.top = Math.round(ny) + 'px';
    };
    pet._boundUp = function () {
      if (!dragging) return;
      dragging = false;
      pet.el.style.transition = '';
      self._persistPosition(roleId);
    };

    pet.el.addEventListener(DOWN, pet._boundDown);
    if (typeof window !== 'undefined') {
      window.addEventListener(MOVE, pet._boundMove);
      window.addEventListener(UP, pet._boundUp);
    }
  };

  DisplayManager.prototype._persistPosition = function (roleId) {
    var el = this.instances[roleId] && this.instances[roleId].el;
    if (!el) return;
    var x = parseFloat(el.style.left);
    var y = parseFloat(el.style.top);
    if (!isFinite(x) || !isFinite(y)) return;
    this.family.getPositions()[roleId] = { x: x, y: y };
    this.family._commit();
  };

  /* ---- 串门状态机（规格 3.3：8-15min 触发、停留 2-4min、冷却 10min） ---- */
  DisplayManager.prototype._clearVisit = function () {
    if (this._visitTimer) { clearTimeout(this._visitTimer); this._visitTimer = null; }
    if (this._leaveTimer) { clearTimeout(this._leaveTimer); this._leaveTimer = null; }
    if (this._exitTimer) { clearTimeout(this._exitTimer); this._exitTimer = null; }
  };

  /* 立即移除串门实例（关闭开关/销毁时用，不做离场动画；含离场窗口中的实例） */
  DisplayManager.prototype._teardownVisitor = function () {
    this._clearVisit();
    var roleId = this.visitorRole || this._exitRole;
    this.visitorRole = null;
    this._exitRole = null;
    if (roleId && this.instances[roleId]) this._destroyInstance(roleId);
  };

  DisplayManager.prototype._scheduleVisit = function () {
    var family = this.family;
    this._clearVisit();
    if (family._pageMode || family.getMode() !== 'duo' || !family.getEnabled()) return;
    var self = this;
    this._visitTimer = setTimeout(function () {
      self._visitTimer = null;
      if (self.family._pageMode) return; /* 页面模式暂停串门，退出时重调度 */
      if (family.getMode() !== 'duo' || !family.getEnabled()) return;
      self._tryVisit(true);
    }, rand(8 * 60 * 1000, 15 * 60 * 1000));
  };

  /* 候选串门角色：非常驻且不在冷却期 */
  DisplayManager.prototype._candidates = function () {
    var resident = this.family.getResident();
    var now = Date.now();
    var self = this;
    return ROLE_IDS.filter(function (id) {
      if (id === resident) return false;
      if (self.visitorRole === id) return false;
      var cd = self._cooldowns[id];
      return !(cd && now < cd);
    });
  };

  /* 手动召唤（右键「叫小伙伴来玩」）：无视间隔仍受占场/冷却约束 */
  DisplayManager.prototype.summonVisitor = function () {
    var family = this.family;
    if (family._pageMode || family.getMode() !== 'duo') return false;
    if (this.visitorRole || this._exitTimer) return false; /* 占场或离场窗口期拒绝 */
    var candidates = this._candidates();
    if (!candidates.length) return false;
    this._spawnVisitor(pick(candidates));
    return true;
  };

  DisplayManager.prototype._tryVisit = function (auto) {
    var family = this.family;
    if (family._pageMode || family.getMode() !== 'duo' || this.visitorRole || this._exitTimer) return false;
    var candidates = this._candidates();
    if (!candidates.length) {
      if (auto) this._scheduleVisit();
      return false;
    }
    this._spawnVisitor(pick(candidates));
    return true;
  };

  DisplayManager.prototype._spawnVisitor = function (roleId) {
    this.visitorRole = roleId;
    if (!this.instances[roleId]) this._createInstance(roleId, true);
    this.layout();
    var pet = this.instances[roleId];
    if (pet) pet.enter('right');
    var self = this;
    /* 停留 2-4min 后 goodbye 1.5s + 滑出 500ms + 冷却 10min */
    this._leaveTimer = setTimeout(function () {
      self._leaveTimer = null;
      self._leaveVisitor();
    }, rand(2 * 60 * 1000, 4 * 60 * 1000));
  };

  DisplayManager.prototype._leaveVisitor = function () {
    var roleId = this.visitorRole;
    if (!roleId) { this._scheduleVisit(); return; }
    var pet = this.instances[roleId];
    this.visitorRole = null;
    this._cooldowns[roleId] = Date.now() + 10 * 60 * 1000;
    if (pet) pet.exit('right');
    var self = this;
    /* goodbye 1.5s + 滑出 500ms 后销毁；窗口期 _exitTimer 阻止新串门 */
    this._exitRole = roleId;
    this._exitTimer = setTimeout(function () {
      self._exitTimer = null;
      self._exitRole = null;
      self._destroyInstance(roleId);
      self._scheduleVisit();
    }, 2000);
  };

  /* 互动管理器占位（Task 4：点击对话 / 投喂 / 摸头等） */
  /** @constructor
   * @this {{ family: any, active: boolean }} */
  /** @constructor
   * @this {{ family: any, active: boolean, lastAt: number, playing: boolean,
   *   dragging: boolean, _playTimer: any,
   *   canTrigger: Function, _pickCombo: Function, _pickDialogue: Function,
   *   _playSequence: Function, end: Function, destroy: Function }} */
  function InteractionManager(family) {
    this.family = family;
    this.active = true;
    this.lastAt = 0;        /* 上次互动结束时间戳 */
    this.playing = false;    /* 对话播放中 */
    this.dragging = false;   /* 拖拽中 */
    this._playTimer = null;  /* 逐轮播放定时器 */
  }

  /** 判断是否满足互动触发条件（≥2 在场、冷却过、无播放、无拖拽） */
  InteractionManager.prototype.canTrigger = function () {
    if (this.playing) return false;
    if (this.dragging) return false;
    var ids = this.family.getActivePetIds();
    if (ids.length < 2) return false;
    var now = Date.now();
    var base = 3 * 60 * 1000; /* 基础冷却 3min */
    var jitter = Math.random() * 3 * 60 * 1000; /* 0-3min 随机 */
    if (now - this.lastAt < base + jitter) return false;
    /* 距离检测（Task 3.2）：两只玩偶超过 200px 不触发互动 */
    var instances = this.family.display.instances;
    var keys = Object.keys(instances);
    if (keys.length >= 2) {
      var p1 = instances[keys[0]] && instances[keys[0]].el;
      var p2 = instances[keys[1]] && instances[keys[1]].el;
      if (p1 && p2 && typeof p1.getBoundingClientRect === 'function' && typeof p2.getBoundingClientRect === 'function') {
        var r1 = p1.getBoundingClientRect();
        var r2 = p2.getBoundingClientRect();
        var dist = Math.hypot(r1.left - r2.left, r1.top - r2.top);
        if (dist > 200) return false;
      }
    }
    return true;
  };

  /** 随机选取互动角色对（从在场角色中选 2 个） */
  InteractionManager.prototype._pickCombo = function () {
    var ids = this.family.getActivePetIds();
    if (ids.length < 2) return null;
    var shuffled = ids.slice().sort(function () { return Math.random() - 0.5; });
    var a = shuffled[0], b = shuffled[1];
    /* 规格：按固定组合键查找对话 */
    var key1 = a + '+' + b;
    var key2 = b + '+' + a;
    return { a: a, b: b, key: DIALOGUES[key1] ? key1 : (DIALOGUES[key2] ? key2 : null) };
  };

  /** 从对话组中随机选一组（按 type 权重：chat 40/play 25/tease 20/comfort 10/sync 5） */
  InteractionManager.prototype._pickDialogue = function (comboKey) {
    var groups = DIALOGUES[comboKey];
    if (!groups || !groups.length) return null;
    var weights = { chat: 40, play: 25, tease: 20, comfort: 10, sync: 5 };
    var total = 0;
    groups.forEach(function (g) { total += (weights[g.type] || 10); });
    var r = Math.random() * total;
    var acc = 0;
    for (var i = 0; i < groups.length; i++) {
      acc += (weights[groups[i].type] || 10);
      if (r <= acc) return groups[i];
    }
    return groups[0];
  };

  /** 逐轮播放对话气泡（每轮 1.5-2.5s 间隔，气泡 3s） */
  InteractionManager.prototype._playSequence = function (dialogue, participants) {
    var self = this;
    var family = this.family;
    var lines = dialogue.lines;
    var idx = 0;
    this.playing = true;
    family.emit('interactionStart', { dialogue: dialogue, participants: participants });

    function playNext() {
      if (idx >= lines.length || !self.playing) {
        self.end();
        return;
      }
      var line = lines[idx];
      var pet = family.display.get(line.speaker);
      if (pet) {
        var text = line.text;
        var dur = 3000;
        pet.sayLine(text, dur);
        /* 表情联动：对话期间角色设为 excited */
        if (line.speaker) pet.setEmotion('excited', dur);
      }
      idx++;
      var gap = 1500 + Math.random() * 1000; /* 1.5-2.5s */
      self._playTimer = setTimeout(playNext, gap);
    }

    playNext();
  };

  /** 触发互动（返回 true 成功触发，false 条件不满足） */
  InteractionManager.prototype.trigger = function () {
    if (!this.canTrigger()) return false;
    var combo = this._pickCombo();
    if (!combo || !combo.key) return false;
    var dialogue = this._pickDialogue(combo.key);
    if (!dialogue) return false;
    var participants = [combo.a, combo.b];
    this.family.emit('interaction', { type: dialogue.type, participants: participants });
    /* 特效：参与角色爱心飘散 */
    var self = this;
    participants.forEach(function (pid) {
      var p = self.family.display && self.family.display.get(pid);
      if (p) p._triggerInteractEffect();
    });
    this._playSequence(dialogue, participants);
    return true;
  };

  /** 按类型触发特定对话（任务完成/成就等事件驱动，跳过冷却检查） */
  InteractionManager.prototype.triggerByType = function (dialogueType) {
    if (this.playing) return false;
    var ids = this.family.getActivePetIds();
    if (ids.length < 2) return false;
    /* 收集所有可用组合中包含指定类型对话的 */
    var combos = [];
    var self = this;
    /* 双人组合 */
    ids.forEach(function (a) {
      ids.forEach(function (b) {
        if (a >= b) return;
        var key1 = a + '+' + b;
        var key2 = b + '+' + a;
        var key = DIALOGUES[key1] ? key1 : (DIALOGUES[key2] ? key2 : null);
        if (!key) return;
        var groups = DIALOGUES[key];
        var candidates = groups.filter(function (g) { return g.type === dialogueType; });
        if (candidates.length) {
          combos.push({ a: a, b: b, key: key, candidates: candidates });
        }
      });
    });
    /* 三人组合（trio 模式时也检查 trio 对话库） */
    if (ids.length >= 3 && DIALOGUES.trio) {
      var trioCandidates = DIALOGUES.trio.filter(function (g) { return g.type === dialogueType; });
      if (trioCandidates.length) {
        combos.push({ a: ids[0], b: ids[1], key: 'trio', candidates: trioCandidates });
      }
    }
    if (!combos.length) return false;
    /* 随机选一个组合 */
    var pick = combos[Math.floor(Math.random() * combos.length)];
    var dialogue = pick.candidates[Math.floor(Math.random() * pick.candidates.length)];
    var participants = pick.key === 'trio' ? ids.slice(0, 3) : [pick.a, pick.b];
    this.family.emit('interaction', { type: dialogue.type, participants: participants });
    participants.forEach(function (pid) {
      var p = self.family.display && self.family.display.get(pid);
      if (p) p._triggerInteractEffect();
    });
    this._playSequence(dialogue, participants);
    return true;
  };

  /** 结束当前对话播放 */
  InteractionManager.prototype.end = function () {
    if (!this.playing) return;
    this.playing = false;
    this.lastAt = Date.now();
    if (this._playTimer) { clearTimeout(this._playTimer); this._playTimer = null; }
    /* 复位参与角色表情 */
    var family = this.family;
    var ids = family.getActivePetIds();
    ids.forEach(function (id) {
      var pet = family.display.get(id);
      if (pet) pet._setDefaultEmotion();
    });
    family.emit('interactionEnd', {});
  };

  /** 销毁清理 */
  InteractionManager.prototype.destroy = function () {
    this.end();
    this.active = false;
  };

  /* ============================================================
     第五区：PetFamily（组合子管理器，对外公开接口）
     - 构造依赖：store（SonderStore 实例）+ bus（SonderBus）+ config（settings 对象）
     - 数据操作占位：getState/getCoins/getAffection/getInventory/getAchievements
       返回 settings.desktopPet 原子快照（Task 3 接入 Coin/Affection/Achievement 后替换）
     ============================================================ */

  /** @constructor
   * @this {{ store: any, bus: any, settings: any, _listeners: Object, _container: any, loop: any,
   *   display: any, interaction: any, _pageMode: boolean,
   *   _sessionCoins: number, _sessionCoinCap: number, _interactionTimer: any,
   *   _unsubTasks: any, _onTaskChangeBound: Function, _onTaskChange: Function,
   *   _sync: Function, ensureContainer: Function, _commit: Function,
   *   getMode: Function, setMode: Function, getResident: Function, setResident: Function,
   *   getSize: Function, setSize: Function, getEnabled: Function, setEnabled: Function,
   *   getPositions: Function, enterPageMode: Function, exitPageMode: Function,
   *   summonVisitor: Function, getActivePetIds: Function,
   *   getState: Function, getCoins: Function, getAffection: Function, getInventory: Function,
   *   getAchievements: Function, addCoins: Function, spendCoins: Function, buySnack: Function,
   *   feedPet: Function, checkAchievements: Function, resetAllData: Function,
   *   _updateStreak: Function,
   *   on: Function, off: Function, emit: Function, destroy: Function }} */
  function PetFamily(store, bus, config) {
    this.store = store || null;
    this.bus = bus || null;
    this.settings = config || (store && store.state ? store.state.settings : {});
    /* 自建 desktopPet 默认配置（Task 3 并入 store 默认值后此步幂等保留） */
    this.settings.desktopPet = mergeDesktopPetDefaults(this.settings.desktopPet);
    /* 移动端默认玩偶大小（Task 3.5.4） */
    if (typeof window !== 'undefined' && window.innerWidth < 720) {
      this.settings.desktopPet.size = this.settings.desktopPet.size || 64;
    }

    this._listeners = {};
    this._container = null;
    this.loop = new AnimationLoop();
    this.display = new DisplayManager(this);
    this.interaction = new InteractionManager(this);
    this._pageMode = false;

    /* 会话金币上限（Task 3.3） */
    this._sessionCoins = 0;
    this._sessionCoinCap = 100;

    /* 自动触发互动对话（Task 3.1：每 3 分钟检查；页面隐藏时跳过——
     * 后台标签 rAF 已停但 interval 仍会触发，防隐身赚金币/事件堆积） */
    var self = this;
    this._interactionTimer = null;
    if (typeof setInterval !== 'undefined') {
      this._interactionTimer = setInterval(function () {
        if (typeof document !== 'undefined' && document.hidden) return;
        if (self.display.getMode() === 'single') return;
        if (self.interaction && self.interaction.canTrigger()) {
          self.interaction.trigger();
        }
      }, 3 * 60 * 1000);
    }

    /* 页面加载 streak 检查（Task 3.4） */
    this._updateStreak();

    /* 深夜行为（Task 3.5） */
    var residentId = this.getResident();
    var resident = this.display.get(residentId);
    if (resident) resident._checkLateNight();

    this.display._bindResize();
    this._sync();

    /* 任务完成金币检测：扫描存量 + 订阅变更 */
    this._unsubTasks = null;
    if (this.bus && typeof this.bus.on === 'function') {
      this._onTaskChangeBound = function () { self._onTaskChange(); };
      this._unsubTasks = this.bus.on('/data/tasks', this._onTaskChangeBound);
      this._onTaskChange();
    }
  }

  /* ---- 生命周期 ---- */
  PetFamily.prototype._sync = function () {
    this.display.syncInstances();
  };

  PetFamily.prototype.ensureContainer = function () {
    if (this._container) return this._container;
    if (typeof document === 'undefined') return null;
    var c = document.createElement('div');
    c.className = 'dp-shelf';
    c.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:9999;';
    document.body.appendChild(c);
    this._container = c;
    return c;
  };

  /* 每次状态落盘后调用（settings 集合持久化） */
  PetFamily.prototype._commit = function () {
    if (this.store && typeof this.store._commit === 'function') {
      try { this.store._commit('settings'); } catch (e) { /* 持久化失败不谎报成功 */ }
    }
    this.emit('change', this.getState());
  };

  /* ---- 公开：显示模式 ---- */
  PetFamily.prototype.getMode = function () {
    return this.settings.desktopPet.mode;
  };

  PetFamily.prototype.setMode = function (mode) {
    if (MODES.indexOf(mode) === -1) return;
    this.settings.desktopPet.mode = mode;
    this._sync();
    this._commit();
  };

  PetFamily.prototype.getResident = function () {
    return this.settings.desktopPet.resident;
  };

  PetFamily.prototype.setResident = function (id) {
    if (ROLE_IDS.indexOf(id) === -1) return;
    this.settings.desktopPet.resident = id;
    this._sync();
    this._commit();
  };

  PetFamily.prototype.getSize = function () {
    return this.settings.desktopPet.size;
  };

  PetFamily.prototype.setSize = function (px) {
    var size = clamp(Math.round(px), 48, 160);
    this.settings.desktopPet.size = size;
    var self = this;
    Object.keys(this.display.instances).forEach(function (id) {
      var pet = self.display.get(id);
      if (pet) pet.setSize(size);
    });
    this.display.layout();
    this._commit();
  };

  PetFamily.prototype.getEnabled = function () {
    return this.settings.desktopPet.enabled;
  };

  PetFamily.prototype.setEnabled = function (enabled) {
    this.settings.desktopPet.enabled = !!enabled;
    if (this._container) {
      this._container.style.display = enabled ? '' : 'none';
    }
    if (!enabled) {
      this.display._teardownVisitor(); /* 清定时器 + 立即移除串门实例，避免残留 */
    } else if (this.settings.desktopPet.mode === 'duo') {
      this.display._scheduleVisit();
    }
    this._commit();
  };

  PetFamily.prototype.getPositions = function () {
    return this.settings.desktopPet.positions;
  };

  /* ---- 公开：页面模式（页面打开时隐藏悬浮玩偶，保持状态） ---- */
  PetFamily.prototype.enterPageMode = function () {
    this._pageMode = true;
    if (this._container) this._container.style.display = 'none';
    this.loop.stop();
  };

  PetFamily.prototype.exitPageMode = function () {
    this._pageMode = false;
    if (this._container) this._container.style.display = this.getEnabled() ? '' : 'none';
    this.loop.start();
    if (this.getEnabled() && this.getMode() === 'duo') this.display._scheduleVisit();
  };

  /* ---- 公开：串门 ---- */
  PetFamily.prototype.summonVisitor = function () {
    return this.display.summonVisitor();
  };

  /* ---- 公开：实例信息 ---- */
  PetFamily.prototype.getActivePetIds = function () {
    return Object.keys(this.display.instances);
  };

  /* ---- 公开：互动（Task 4） ---- */
  PetFamily.prototype.triggerInteraction = function () {
    return this.interaction.trigger();
  };

  PetFamily.prototype.endInteraction = function () {
    this.interaction.end();
  };

  /* ---- 数据操作（Task 3：真实计算，对外返回原子快照） ---- */
  PetFamily.prototype.getState = function () {
    return cloneJson(this.settings.desktopPet);
  };

  PetFamily.prototype.getCoins = function () {
    return this.settings.desktopPet.coins;
  };

  PetFamily.prototype.getAffection = function (petId) {
    if (petId) return this.settings.desktopPet.affection[petId] || 0;
    return cloneJson(this.settings.desktopPet.affection);
  };

  PetFamily.prototype.getInventory = function () {
    return cloneJson(this.settings.desktopPet.inventory);
  };

  PetFamily.prototype.getAchievements = function () {
    return cloneJson(this.settings.desktopPet.achievements);
  };

  /* ---- 金币系统 ---- */
  PetFamily.prototype.addCoins = function (amount, reason) {
    if (typeof amount !== 'number' || amount < 0 || !isFinite(amount)) return;
    /* 会话金币上限（Task 3.3） */
    if (this._sessionCoins + amount > this._sessionCoinCap) {
      amount = Math.max(0, this._sessionCoinCap - this._sessionCoins);
    }
    if (amount <= 0) return;
    this._sessionCoins += Math.round(amount);
    var dp = this.settings.desktopPet;
    dp.coins = Math.max(0, dp.coins + Math.round(amount));
    this._commit();
  };

  PetFamily.prototype.spendCoins = function (amount) {
    if (typeof amount !== 'number' || amount <= 0 || !isFinite(amount)) return false;
    var dp = this.settings.desktopPet;
    if (dp.coins < Math.round(amount)) return false;
    dp.coins = Math.max(0, dp.coins - Math.round(amount));
    this._commit();
    return true;
  };

  /* ---- 商店系统 ---- */
  PetFamily.prototype.buySnack = function (snackId) {
    var snack = SNACKS[snackId];
    if (!snack) return false;
    var dp = this.settings.desktopPet;
    if (dp.coins < snack.price) return false;
    dp.coins = Math.max(0, dp.coins - snack.price);
    dp.inventory[snackId] = (dp.inventory[snackId] || 0) + 1;
    this._commit();
    return true;
  };

  /* ---- 喂养系统 ---- */
  PetFamily.prototype.feedPet = function (petId, snackId) {
    if (ROLE_IDS.indexOf(petId) === -1) return false;
    var snack = SNACKS[snackId];
    if (!snack) return false;
    var dp = this.settings.desktopPet;
    if ((dp.inventory[snackId] || 0) <= 0) return false;
    dp.inventory[snackId] = Math.max(0, dp.inventory[snackId] - 1);
    if (dp.inventory[snackId] === 0) delete dp.inventory[snackId];
    dp.affection[petId] = (dp.affection[petId] || 0) + snack.affection;
    dp.totalFed[petId] = (dp.totalFed[petId] || 0) + 1;
    dp.achievements.stats.totalFeeds = (dp.achievements.stats.totalFeeds || 0) + 1;
    this._commit();
    /* 特效：喂食星星散射 */
    var pet = this.display && this.display.get(petId);
    if (pet) pet._triggerFeedEffect();
    this.checkAchievements();
    return true;
  };

  /* ---- 成就系统 ---- */
  PetFamily.prototype.checkAchievements = function () {
    var dp = this.settings.desktopPet;
    var ach = dp.achievements;
    var self = this;
    var achState = {
      tasks: this.store && this.store.state && this.store.state.tasks ? this.store.state.tasks : [],
      totalTasksDone: ach.stats.totalTasksDone || 0,
      allDoneToday: this._isAllDoneToday(),
      streak: ach.stats.streakDays || 0,
      maxAffection: this._getMaxAffection(),
      totalFeeds: ach.stats.totalFeeds || 0
    };
    Object.keys(ACHIEVEMENTS).forEach(function (id) {
      if (ach.unlocked.indexOf(id) !== -1) return;
      var def = ACHIEVEMENTS[id];
      try {
        if (def.condition(achState)) {
          ach.unlocked.push(id);
          self.addCoins(def.reward, 'achievement:' + id);
          /* 特效：成就解锁光环 */
          var achPet = self._randomPet();
          if (achPet) achPet._triggerAchievementEffect();
        }
      } catch (e) { /* 条件函数异常不阻断 */ }
    });
    this._commit();
  };

  PetFamily.prototype._isAllDoneToday = function () {
    if (!this.store || !this.store.state || !this.store.state.tasks) return false;
    var tasks = this.store.state.tasks;
    if (tasks.length === 0) return false;
    return tasks.every(function (t) { return t.done; });
  };

  PetFamily.prototype._getMaxAffection = function () {
    var aff = this.settings.desktopPet.affection;
    var max = 0;
    ROLE_IDS.forEach(function (id) {
      if ((aff[id] || 0) > max) max = aff[id];
    });
    return max;
  };

  /* ---- 任务完成金币检测（订阅总线，遍历判定） ---- */
  PetFamily.prototype._onTaskChange = function () {
    if (!this.store || !this.store.state || !this.store.state.tasks) return;
    var dp = this.settings.desktopPet;
    var tasks = this.store.state.tasks;
    var rewarded = dp.rewardedTaskIds;
    var changed = false;
    var newlyCompleted = 0;
    tasks.forEach(function (t) {
      if (t.done && t.doneAt && rewarded.indexOf(t.id) === -1) {
        var priority = t.priority || 'p3';
        var coins = priority === 'p1' ? 15 : priority === 'p2' ? 10 : 5;
        dp.coins = Math.max(0, dp.coins + coins);
        dp.achievements.stats.totalTasksDone = (dp.achievements.stats.totalTasksDone || 0) + 1;
        rewarded.push(t.id);
        if (rewarded.length > 500) rewarded.splice(0, rewarded.length - 500);
        changed = true;
        newlyCompleted++;
      }
    });
    if (changed) {
      this._updateStreak();
      this._commit();
      /* 特效：金币飘字 */
      var coinPet = this._randomPet();
      if (coinPet) coinPet._triggerCoinEffect(5);
      /* 任务完成鼓励对话：从 sync 类型对话库中选取 */
      if (newlyCompleted > 0 && this.interaction && !this.interaction.playing) {
        this.interaction.triggerByType('sync');
      }
    }
  };

  PetFamily.prototype._updateStreak = function () {
    var stats = this.settings.desktopPet.achievements.stats;
    var today = new Date().toISOString().slice(0, 10);
    if (stats.lastActiveDay === today) return;
    if (stats.lastActiveDay) {
      var prev = new Date(stats.lastActiveDay);
      var curr = new Date(today);
      var diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      stats.streakDays = diff === 1 ? (stats.streakDays || 0) + 1 : 1;
    } else {
      stats.streakDays = 1;
    }
    stats.lastActiveDay = today;
  };

  /* ---- 重置全部数据 ---- */
  PetFamily.prototype.resetAllData = function () {
    var dp = this.settings.desktopPet;
    dp.coins = 0;
    this._sessionCoins = 0;
    dp.affection = { xiaomo: 0, xiaoyu: 0, lanling: 0 };
    dp.inventory = {};
    dp.totalFed = { xiaomo: 0, xiaoyu: 0, lanling: 0 };
    dp.rewardedTaskIds = [];
    dp.achievements = {
      unlocked: [],
      stats: { totalTasksDone: 0, lastActiveDay: null, streakDays: 0, totalFeeds: 0 }
    };
    this._commit();
  };

  /* ---- 事件（on/off/emit，内部与跨模块弱耦合） ---- */
  PetFamily.prototype.on = function (name, fn) {
    if (!this._listeners[name]) this._listeners[name] = [];
    this._listeners[name].push(fn);
    var self = this;
    return function () { self.off(name, fn); };
  };

  PetFamily.prototype.off = function (name, fn) {
    var list = this._listeners[name];
    if (!list) return;
    var i = list.indexOf(fn);
    if (i !== -1) list.splice(i, 1);
  };

  PetFamily.prototype.emit = function (name, detail) {
    var list = this._listeners[name];
    if (!list) return;
    list.slice().forEach(function (fn) {
      try { fn(detail); } catch (e) { /* 监听器异常不阻断 */ }
    });
  };

  /* ---- 销毁（完整清理：实例/循环/容器/监听/定时器） ---- */
  PetFamily.prototype.destroy = function () {
    this.interaction.destroy();
    this.display._clearVisit();
    var self = this;
    Object.keys(this.display.instances).forEach(function (id) {
      self.display._destroyInstance(id);
    });
    this.loop.stop();
    if (typeof window !== 'undefined') {
      if (this.display._boundResize) window.removeEventListener('resize', this.display._boundResize);
    }
    if (this.display._resizeT) { clearTimeout(this.display._resizeT); this.display._resizeT = null; }
    if (this._interactionTimer) { clearInterval(this._interactionTimer); this._interactionTimer = null; }
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._container = null;
    this._listeners = {};
    if (this._unsubTasks) { try { this._unsubTasks(); } catch (e) { /* 忽略 */ } this._unsubTasks = null; }
  };

  /* ============================================================
     第七区：工厂与自动初始化（FACTORY / INIT）
     - createPet：便捷构造单个玩偶（供页面/悬浮使用）
     - createFamily：创建 PetFamily（Task 2 实现；autoInit 由 Task 3 接入）
     ============================================================ */

  /* 创建小莫灵家族（组合 store/settings 驱动，测试与页面共用入口） */
  function createFamily(store, bus, config) {
    return new PetFamily(store, bus, config);
  }

  function createPet(options) {
    return new Pet(options);
  }

  /* ---- 自动初始化（页面加载时自动创建全局 family 实例） ---- */
  function autoInit() {
    if (typeof window === 'undefined') return;
    try {
      var store = window.__sonderHooks && window.__sonderHooks.store;
      if (!store) return;
      /* 模块开关守卫：用户关闭桌面玩偶时不创建 family（否则定时器链照跑） */
      var modules = store.state.settings.modules || {};
      if (modules['desktop-pet'] === false) return;
      var bus = window.SonderBus && window.SonderBus.bus;
      var family = createFamily(store, bus, store.state.settings);
      window.__desktopPetFamily = family;
      family.on('change', function () { /* 配置变更自动落盘由 _commit 处理 */ });
    } catch (e) { /* autoInit 异常不阻断页面 */ }
  }

  /* ============================================================
     UMD 导出
     ============================================================ */

  var DesktopPetCore = {
    CHARACTERS: CHARACTERS,
    SNACKS: SNACKS,
    ACHIEVEMENTS: ACHIEVEMENTS,
    DIALOGUES: DIALOGUES,
    QUOTES: QUOTES,
    Pet: Pet,
    createPet: createPet,
    PetFamily: PetFamily,
    createFamily: createFamily,
    autoInit: autoInit,
    mergeDesktopPetDefaults: mergeDesktopPetDefaults,
    DEFAULT_DESKTOP: DEFAULT_DESKTOP
  };

  return DesktopPetCore;
});