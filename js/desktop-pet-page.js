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
  function renderHeader(container, family) {
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
  function renderPetCards(container, family) {
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
  function renderSettings(container, family) {
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
      sizeVal.setAttribute('data-role', 'size-val');
      sizeRow.appendChild(sizeVal);
      var slider = el('input', 'dp-page-size-slider');
      slider.setAttribute('type', 'range');
      slider.setAttribute('min', '48');
      slider.setAttribute('max', '160');
      slider.setAttribute('step', '4');
      slider.setAttribute('value', String(family.getSize()));
      slider.setAttribute('data-action', 'setSize');
      sizeRow.appendChild(slider);
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
  function renderShopPreview(container, family) {
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
      card.setAttribute('data-snack', id);
      card.appendChild(el('div', 'dp-page-snack-icon', snack.icon));
      card.appendChild(el('div', 'dp-page-snack-name', snack.name));
      card.appendChild(el('div', 'dp-page-snack-price', '💰 ' + snack.price));
      if (family) {
        var inv = family.getInventory();
        var qty = inv[id] || 0;
        card.appendChild(el('div', 'dp-page-snack-qty', '库存: ' + qty));
        var buyBtn = el('button', 'dp-page-buy-btn', '购买');
        buyBtn.setAttribute('data-action', 'buy');
        buyBtn.setAttribute('data-snack-id', id);
        card.appendChild(buyBtn);
      }
      grid.appendChild(card);
    });
    section.appendChild(grid);
    container.appendChild(section);
  }

  /* ---- 渲染：成就列表 ---- */
  function renderAchievements(container, family) {
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

    renderHeader(container, family);
    renderPetCards(container, family);
    renderSettings(container, family);
    renderShopPreview(container, family);
    renderAchievements(container, family);
  }

  /* ---- 事件委托：喂食/模式切换/大小/开关/重置/购买 ---- */
  function handleAction(action, target, family) {
    if (!family) return;
    var tgt = /** @type {HTMLElement} */ (target);
    if (action === 'feed') {
      var petId = tgt.getAttribute('data-pet-id');
      if (!petId) return;
      /* 从库存中取第一个可用零食喂食 */
      var inv = family.getInventory();
      var snackKey = null;
      var C = window.DesktopPetCore;
      if (C && C.SNACKS) {
        var keys = Object.keys(C.SNACKS);
        for (var i = 0; i < keys.length; i++) {
          if (inv[keys[i]] && inv[keys[i]] > 0) { snackKey = keys[i]; break; }
        }
      }
      if (snackKey) {
        family.feedPet(petId, snackKey);
      }
    } else if (action === 'setMode') {
      var mode = tgt.getAttribute('data-value');
      if (mode) family.setMode(mode);
    } else if (action === 'setSize') {
      var size = parseInt(/** @type {HTMLInputElement} */ (tgt).value, 10);
      if (size >= 48 && size <= 160) family.setSize(size);
      var sizeVal = document.querySelector('[data-role="size-val"]');
      if (sizeVal) sizeVal.textContent = String(family.getSize());
    } else if (action === 'toggle') {
      family.setEnabled(!family.getEnabled());
    } else if (action === 'reset') {
      if (confirm('确定要重置所有小莫灵数据吗？此操作不可恢复。')) {
        family.resetAllData();
      }
    } else if (action === 'buy') {
      var snackId = tgt.getAttribute('data-snack-id');
      if (snackId) family.buySnack(snackId);
    }
  }

  /* ---- 注册页面 ---- */
  Pages['desktop-pet'] = {
    title: '小莫灵家族',
    render: function (container, ctx) {
      var family = getFamily();
      ctx._container = container;

      /* 先清理上次订阅 */
      if (ctx._dpUnsub) { try { ctx._dpUnsub(); } catch (e) { /* 忽略 */ } ctx._dpUnsub = null; }

      if (family) {
        try { family.enterPageMode(); } catch (e) { /* 忽略 */ }
      }

      render(ctx);

      /* 事件委托：容器级一次绑定 */
      if (!ctx._dpBound) {
        ctx._dpBound = true;
        container.addEventListener('click', function (e) {
          var tgt = /** @type {HTMLElement} */ (e.target);
          var action = tgt.getAttribute('data-action');
          if (!action) return;
          var fam = getFamily();
          handleAction(action, tgt, fam);
        });
        /* range input 实时响应 */
        container.addEventListener('input', function (e) {
          var tgt = /** @type {HTMLElement} */ (e.target);
          if (tgt.getAttribute('data-action') === 'setSize') {
            var fam = getFamily();
            if (fam) handleAction('setSize', tgt, fam);
          }
        });
      }

      /* 订阅变更事件自动重绘 */
      if (family && family.on) {
        var unsub = family.on('change', function () {
          if (ctx._container) render(ctx);
        });
        ctx._dpUnsub = unsub;
      }
    },
    /* 页面离开时恢复悬浮玩偶 */
    destroy: function (ctx) {
      if (ctx._dpUnsub) { try { ctx._dpUnsub(); } catch (e) { /* 忽略 */ } ctx._dpUnsub = null; }
      var family = getFamily();
      if (family) {
        try { family.exitPageMode(); } catch (e) { /* 忽略 */ }
      }
    }
  };

  return { Pages: Pages };
});
