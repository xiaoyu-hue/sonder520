/* ============================================================
 * desktop-pet-page.js - 小莫灵家族独立板块页面
 * 注册 Pages['desktop-pet']，五分区布局：标题栏+金币、三角色卡、
 * 显示设置、商店预览、成就列表。
 * 依赖 window.DesktopPetCore（核心缺失时降级为静态卡）。
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DesktopPetPage = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var Pages = window.Pages = window.Pages || {};
  var ROLE_IDS = ['xiaomo', 'xiaoyu', 'lanling'];
  var ROLE_NAMES = { xiaomo: '小莫', xiaoyu: '小余', lanling: '懒零' };
  var SNACK_IDS = [
    'snack_01', 'snack_02', 'snack_03', 'snack_04', 'snack_05',
    'snack_06', 'snack_07', 'snack_08', 'snack_09'
  ];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function getFamily() { return window.__desktopPetFamily || null; }

  /* ---- 渲染：标题栏 ---- */
  function renderHeader(doc, container, family) {
    var header = el('div', 'dp-page-header');
    var titleRow = el('div', 'dp-page-title');
    titleRow.appendChild(el('span', '', '🐾'));
    titleRow.appendChild(el('span', '', '小莫灵家族'));
    header.appendChild(titleRow);

    if (family) {
      var coins = el('span', 'dp-page-coins', '💰 ' + family.getCoins());
      coins.setAttribute('data-role', 'coins');
      header.appendChild(coins);
    } else {
      header.appendChild(el('span', 'dp-page-coins dp-disabled', '💰 —'));
    }
    container.appendChild(header);
  }

  /* ---- 渲染：三角色卡 ---- */
  function renderPetCards(doc, container, family) {
    var wrap = el('div', 'dp-page-pets');
    ROLE_IDS.forEach(function (id) {
      var card = el('div', 'dp-page-card dp-page-card-' + id);
      card.setAttribute('data-pet', id);

      var name = el('div', 'dp-page-pet-name', ROLE_NAMES[id]);
      card.appendChild(name);

      if (family) {
        var affection = family.getAffection(id) || 0;
        var bar = el('div', 'dp-page-bar');
        var fill = el('div', 'dp-page-bar-fill');
        fill.style.width = Math.min(100, affection) + '%';
        bar.appendChild(fill);
        card.appendChild(bar);
        card.appendChild(el('div', 'dp-page-aff-text', '❤️ ' + affection));

        var feedBtn = el('button', 'dp-page-feed-btn', '喂食');
        feedBtn.setAttribute('data-action', 'feed');
        feedBtn.setAttribute('data-pet-id', id);
        card.appendChild(feedBtn);
      } else {
        card.appendChild(el('div', 'dp-page-bar dp-disabled', ''));
        card.appendChild(el('div', 'dp-page-aff-text dp-disabled', '❤️ —'));
        var disabledBtn = el('button', 'dp-page-feed-btn dp-disabled', '喂食');
        disabledBtn.disabled = true;
        card.appendChild(disabledBtn);
      }
      wrap.appendChild(card);
    });
    container.appendChild(wrap);
  }

  /* ---- 渲染：显示设置 ---- */
  function renderSettings(doc, container, family) {
    var section = el('div', 'dp-page-settings');
    section.appendChild(el('div', 'dp-page-section-title', '显示设置'));

    if (family) {
      /* 模式切换 */
      var modeRow = el('div', 'dp-page-setting-row');
      modeRow.appendChild(el('label', '', '模式：'));
      var modes = ['single', 'duo', 'trio'];
      modes.forEach(function (m) {
        var btn = el('button', 'dp-page-mode-btn' + (family.getMode() === m ? ' active' : ''), m);
        btn.setAttribute('data-action', 'setMode');
        btn.setAttribute('data-value', m);
        modeRow.appendChild(btn);
      });
      section.appendChild(modeRow);

      /* 大小滑块 */
      var sizeRow = el('div', 'dp-page-setting-row');
      sizeRow.appendChild(el('label', '', '大小：'));
      var sizeVal = el('span', 'dp-page-size-val', String(family.getSize()));
      sizeRow.appendChild(sizeVal);
      section.appendChild(sizeRow);

      /* 总开关 */
      var toggleRow = el('div', 'dp-page-setting-row');
      var toggleBtn = el('button', 'dp-page-toggle-btn', family.getEnabled() ? '关闭玩偶' : '开启玩偶');
      toggleBtn.setAttribute('data-action', 'toggle');
      toggleRow.appendChild(toggleBtn);
      section.appendChild(toggleRow);

      /* 重置数据 */
      var resetRow = el('div', 'dp-page-setting-row');
      var resetBtn = el('button', 'dp-page-reset-btn dp-danger', '重置所有数据');
      resetBtn.setAttribute('data-action', 'reset');
      resetRow.appendChild(resetBtn);
      section.appendChild(resetRow);
    } else {
      section.appendChild(el('div', 'dp-page-disabled-hint', '玩偶模块加载中…'));
    }
    container.appendChild(section);
  }

  /* ---- 渲染：商店预览 ---- */
  function renderShopPreview(doc, container, family) {
    var section = el('div', 'dp-page-shop');
    section.appendChild(el('div', 'dp-page-section-title', '商店'));

    var C = window.DesktopPetCore;
    if (!C || !C.SNACKS) {
      section.appendChild(el('div', 'dp-page-disabled-hint', '商店数据不可用'));
      container.appendChild(section);
      return;
    }

    var grid = el('div', 'dp-page-shop-grid');
    SNACK_IDS.forEach(function (id) {
      var snack = C.SNACKS[id];
      if (!snack) return;
      var card = el('div', 'dp-page-snack-card');
      card.appendChild(el('div', 'dp-page-snack-icon', snack.icon));
      card.appendChild(el('div', 'dp-page-snack-name', snack.name));
      card.appendChild(el('div', 'dp-page-snack-price', '💰 ' + snack.price));
      if (family) {
        var inv = family.getInventory();
        var qty = inv[id] || 0;
        card.appendChild(el('div', 'dp-page-snack-qty', '库存: ' + qty));
      }
      grid.appendChild(card);
    });
    section.appendChild(grid);
    container.appendChild(section);
  }

  /* ---- 渲染：成就列表 ---- */
  function renderAchievements(doc, container, family) {
    var section = el('div', 'dp-page-achievements');
    section.appendChild(el('div', 'dp-page-section-title', '成就'));

    var C = window.DesktopPetCore;
    if (!C || !C.ACHIEVEMENTS) {
      section.appendChild(el('div', 'dp-page-disabled-hint', '成就数据不可用'));
      container.appendChild(section);
      return;
    }

    var achState = family ? family.getAchievements() : { unlocked: [] };
    var list = el('div', 'dp-page-ach-list');
    var ids = Object.keys(C.ACHIEVEMENTS).sort();
    ids.forEach(function (id) {
      var ach = C.ACHIEVEMENTS[id];
      var unlocked = achState.unlocked && achState.unlocked.indexOf(id) !== -1;
      var item = el('div', 'dp-page-ach-item' + (unlocked ? ' unlocked' : ''));
      var icon = el('span', 'dp-page-ach-icon', unlocked ? '🏅' : '🔒');
      var info = el('div', 'dp-page-ach-info');
      info.appendChild(el('div', 'dp-page-ach-name', ach.name));
      info.appendChild(el('div', 'dp-page-ach-reward', '奖励: 💰 ' + ach.reward));
      item.appendChild(icon);
      item.appendChild(info);
      list.appendChild(item);
    });
    section.appendChild(list);
    container.appendChild(section);
  }

  /* ---- 全量渲染 ---- */
  function render(ctx) {
    var container = ctx._container;
    if (!container) return;
    container.innerHTML = '';
    var family = getFamily();
    var doc = container.ownerDocument || document;

    renderHeader(doc, container, family);
    renderPetCards(doc, container, family);
    renderSettings(doc, container, family);
    renderShopPreview(doc, container, family);
    renderAchievements(doc, container, family);
  }

  /* ---- 注册页面 ---- */
  Pages['desktop-pet'] = {
    title: '小莫灵家族',
    render: function (container, ctx) {
      var family = getFamily();
      ctx._container = container;

      if (family) {
        try { family.enterPageMode(); } catch (e) { /* 忽略 */ }
      }

      render(ctx);

      /* 订阅变更事件自动重绘 */
      if (family && family.on) {
        var unsub = family.on('change', function () {
          if (ctx._container) render(ctx);
        });
        /* 存储 unsubscribe 供页面切换清理 */
        ctx._dpUnsub = unsub;
      }
    }
  };

  return { Pages: Pages };
});
