/* UI - 通用组件：元素构建、Toast、弹窗、确认框、表单弹窗、空状态 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var overlayRoot = function () { return document.getElementById('overlayRoot'); };
  var toastWrap = function () {
    var w = document.getElementById('toastWrap');
    if (!w) { w = document.createElement('div'); w.id = 'toastWrap'; document.body.appendChild(w); }
    return w;
  };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* 通用净化函数：所有用户输入展示前统一走这里，杜绝 XSS。
   * sanitize(text)：转义 < > & " '；sanitizeUrl(url)：仅放行安全协议，拦截 javascript:/data: 等。 */
  function sanitize(s) {
    return esc(s);
  }

  function sanitizeUrl(u) {
    var s = String(u === null || u === undefined ? '' : u).trim();
    if (!s) return s;
    if (/^javascript:|^data:|^vbscript:/i.test(s)) return '';
    return s;
  }

  /** @param {string} html @returns {HTMLElement} */
  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return /** @type {HTMLElement} */ (t.content.firstChild);
  }

  function toast(msg, type) {
    var node = el('<div class="toast' + (type === 'err' ? ' err' : '') + '">' + esc(msg) + '</div>');
    toastWrap().appendChild(node);
    setTimeout(function () { node.style.transition = 'opacity .3s, transform .3s'; node.style.opacity = '0'; node.style.transform = 'translateX(24px)'; }, 2200);
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 2600);
  }

  function closeTopOverlay() {
    var root = overlayRoot();
    if (root.lastChild) root.removeChild(root.lastChild);
  }

  function overlay(innerHtml, onClose) {
    var root = overlayRoot();
    var ov = el('<div class="overlay"></div>');
    ov.appendChild(el(innerHtml));
    root.appendChild(ov);
    ov.addEventListener('mousedown', function (e) {
      if (e.target === ov) { closeTopOverlay(); if (onClose) onClose(); }
    });
    var onKey = function (e) {
      if (e.key === 'Escape') {
        closeTopOverlay();
        document.removeEventListener('keydown', onKey);
        if (onClose) onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return ov;
  }

  /* 确认框：返回 Promise<boolean> */
  function confirmBox(message, okText) {
    return new Promise(function (resolve) {
      var ov = overlay(
        '<div class="modal"><h3>确认操作</h3>' +
        '<div class="body"><p style="margin:0">' + esc(message) + '</p></div>' +
        '<div class="foot">' +
        '<button class="btn" data-act="no">取消</button>' +
        '<button class="btn danger" data-act="yes">' + esc(okText || '删除') + '</button>' +
        '</div></div>',
        function () { resolve(false); }
      );
      ov.querySelector('[data-act="no"]').onclick = function () { ov.remove(); resolve(false); };
      ov.querySelector('[data-act="yes"]').onclick = function () { ov.remove(); resolve(true); };
    });
  }

  /* 表单弹窗
   * fields: [{key,label,type,options,value,required,placeholder,step}]
   * onSubmit(values) -> true 关闭；返回字符串则作为错误提示显示
   */
  function formModal(opts) {
    var fields = opts.fields || [];
    var body = fields.map(function (f) {
      var html = '<div class="field"><label>' + esc(f.label || f.key) + '</label>';
      var val = f.value === undefined || f.value === null ? '' : f.value;
      if (f.type === 'select') {
        html += '<select data-k="' + f.key + '">';
        (f.options || []).forEach(function (o) {
          var ov = (typeof o === 'object') ? o.value : o;
          var ol = (typeof o === 'object') ? o.label : o;
          html += '<option value="' + esc(ov) + '"' + (String(ov) === String(val) ? ' selected' : '') + '>' + esc(ol) + '</option>';
        });
        html += '</select>';
      } else if (f.type === 'textarea') {
        html += '<textarea data-k="' + f.key + '" placeholder="' + esc(f.placeholder || '') + '">' + esc(val) + '</textarea>';
      } else {
        html += '<input type="' + (f.type || 'text') + '" data-k="' + f.key + '" value="' + esc(val) + '" placeholder="' + esc(f.placeholder || '') + '" step="' + (f.step !== undefined ? esc(f.step) : 'any') + '">';
      }
      html += '<div class="hint" style="display:none"></div></div>';
      return html;
    }).join('');

    var ov = overlay(
      '<div class="modal"><h3>' + esc(opts.title) + '</h3>' +
      '<div class="body">' + body + '</div>' +
      '<div class="foot">' +
      '<button class="btn" data-act="cancel">取消</button>' +
      '<button class="btn primary" data-act="ok">' + esc(opts.confirmText || '保存') + '</button>' +
      '</div></div>'
    );

    function collect() {
      var v = {};
      var badNodes = [];
      fields.forEach(function (f) {
        var node = ov.querySelector('[data-k="' + f.key + '"]');
        var val = node ? node.value : '';
        v[f.key] = (f.type === 'number') ? Number(val) : val;
        if (f.required && !String(val).trim()) badNodes.push({ node: node, label: f.label || f.key });
      });
      return { v: v, badNodes: badNodes };
    }

    function showErr(node, msg) {
      if (!node) return;
      var hint = node.parentNode.querySelector('.hint');
      hint.textContent = msg;
      hint.style.display = 'block';
    }

    ov.querySelector('[data-act="cancel"]').onclick = function () { ov.remove(); };
    ov.querySelector('[data-act="ok"]').onclick = function () {
      var r = collect();
      if (r.badNodes.length) {
        r.badNodes.forEach(function (b) { showErr(b.node, '请填写' + b.label); });
        return;
      }
      var res = opts.onSubmit(r.v);
      if (res === true) { ov.remove(); }
      else if (typeof res === 'string' && res.length) {
        var first = ov.querySelector('.hint');
        if (first) { first.textContent = res; first.style.display = 'block'; }
      }
    };
    var firstInput = ov.querySelector('input,select,textarea');
    if (firstInput) { firstInput.focus(); }
    ov.querySelector('.modal').addEventListener('keydown', /** @param {KeyboardEvent} e */ function (e) {
      if (e.key === 'Enter' && /** @type {HTMLElement} */ (e.target).tagName !== 'TEXTAREA') {
        e.preventDefault();
        /** @type {HTMLElement} */ (ov.querySelector('[data-act="ok"]')).click();
      }
    });
    return ov;
  }

  function emptyState(text, actionLabel, actionFn) {
    var d = el('<div class="empty"><div class="big">🗂</div><div>' + esc(text) + '</div></div>');
    if (actionLabel) {
      var b = el('<button class="btn primary">' + esc(actionLabel) + '</button>');
      b.onclick = actionFn;
      d.appendChild(b);
    }
    return d;
  }

  return { esc: esc, sanitize: sanitize, sanitizeUrl: sanitizeUrl, el: el, toast: toast, confirmBox: confirmBox, formModal: formModal, emptyState: emptyState };
});