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
    if (/^javascript:|^data:|^vbscript:|^file:/i.test(s)) return '';
    /* 返回值用于拼进 HTML 属性（href），必须转义引号与 &，防属性闭合注入（如 " onmouseover="） */
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** @param {string} html @returns {HTMLElement} */
  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return /** @type {HTMLElement} */ (t.content.firstChild);
  }

  /* action: { label, onClick } 可选操作按钮（如删除撤销） */
  function toast(msg, type, action) {
    var node = el('<div class="toast' + (type === 'err' ? ' err' : '') + '"><span>' + esc(msg) + '</span></div>');
    if (action) {
      var btn = el('<button type="button" class="toast-act">' + esc(action.label) + '</button>');
      btn.onclick = function () {
        if (node.parentNode) node.parentNode.removeChild(node);
        if (action.onClick) action.onClick();
      };
      node.appendChild(btn);
    }
    toastWrap().appendChild(node);
    setTimeout(function () { node.style.transition = 'opacity .3s, transform .3s'; node.style.opacity = '0'; node.style.transform = 'translateX(24px)'; }, 2200);
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 2600);
  }

  /** @returns {HTMLElement & { _sonderClose(): void }} */
  function overlay(innerHtml, onClose) {
    var root = overlayRoot();
    var ov = /** @type {HTMLElement & { _sonderClose(): void }} */ (el('<div class="overlay"></div>'));
    ov.appendChild(el(innerHtml));
    root.appendChild(ov);
    var opener = /** @type {HTMLElement | null} */ (document.activeElement); /* P4b：记录触发元素，关闭后归还焦点 */
    var onKey = function (e) {
      if (e.key === 'Escape') {
        closeOverlay(onClose);
      } else if (e.key === 'Tab') {
        trapFocus(e, ov); /* P4b：Tab 循环不逃逸到背景页面 */
      }
    };
    /* 统一关闭：移除节点 + 移除 document keydown 监听（防泄漏）+ 焦点归还触发元素，可选回调 */
    function closeOverlay(cb) {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      document.removeEventListener('keydown', onKey);
      if (opener && opener.focus) opener.focus();
      if (cb) cb();
    }
    ov.addEventListener('mousedown', function (e) {
      if (e.target === ov) closeOverlay(onClose);
    });
    document.addEventListener('keydown', onKey);
    ov._sonderClose = function () { closeOverlay(null); };
    /* P4b：焦点落入弹层内第一个可聚焦元素（无则落遮罩本身） */
    var firstFocusable = ov.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
      /** @type {HTMLElement} */ (firstFocusable).focus();
    } else {
      ov.setAttribute('tabindex', '-1');
      ov.focus();
    }
    return ov;
  }

  /* P4b：焦点陷阱——Tab 在弹层可聚焦元素间循环，不落入背景页面 */
  function trapFocus(e, ov) {
    var f = ov.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    var first = /** @type {HTMLElement} */ (f[0]);
    var last = /** @type {HTMLElement} */ (f[f.length - 1]);
    var cur = /** @type {HTMLElement | null} */ (document.activeElement);
    if (e.shiftKey) {
      if (cur === first || !ov.contains(cur)) { e.preventDefault(); last.focus(); }
    } else if (cur === last || !ov.contains(cur)) {
      e.preventDefault();
      first.focus();
    }
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
      /** @type {HTMLButtonElement} */ (ov.querySelector('[data-act="no"]')).onclick = function () { ov._sonderClose(); resolve(false); };
      /** @type {HTMLButtonElement} */ (ov.querySelector('[data-act="yes"]')).onclick = function () { ov._sonderClose(); resolve(true); };
    });
  }

  /* 轻量提示框：仅一个按钮，点击/Esc/点遮罩关闭 */
  function alertBox(message, confirmText) {
    var ov = overlay(
      '<div class="modal"><h3>提示</h3>' +
      '<div class="body"><p style="margin:0">' + esc(message) + '</p></div>' +
      '<div class="foot"><button class="btn primary" data-act="ok">' + esc(confirmText || '知道了') + '</button></div></div>'
    );
    /** @type {HTMLButtonElement} */ (ov.querySelector('[data-act="ok"]')).onclick = function () { ov._sonderClose(); };
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
        html += '<input type="' + (f.type || 'text') + '" data-k="' + f.key + '" value="' + esc(val) + '" placeholder="' + esc(f.placeholder || '') + '" step="' + (f.step !== undefined ? esc(f.step) : 'any') + '"' +
          (f.min !== undefined ? ' min="' + esc(f.min) + '"' : '') +
          (f.max !== undefined ? ' max="' + esc(f.max) + '"' : '') + '>';
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
        var node = /** @type {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|null} */ (ov.querySelector('[data-k="' + f.key + '"]'));
        var val = node ? node.value : '';
        if (f.type === 'number') {
          var num = Number(val);
          if (val.trim() === '') {
            v[f.key] = null;
          } else if (!isFinite(num)) {
            v[f.key] = num;
            badNodes.push({ node: node, label: f.label || f.key, msg: '请输入有效数字' });
          } else {
            v[f.key] = num;
          }
        } else {
          v[f.key] = val;
        }
        if (f.required && !String(val).trim()) badNodes.push({ node: node, label: f.label || f.key, msg: '请填写' + (f.label || f.key) });
      });
      return { v: v, badNodes: badNodes };
    }

    function showErr(node, msg) {
      if (!node) return;
      var hint = node.parentNode.querySelector('.hint');
      hint.textContent = msg;
      hint.style.display = 'block';
    }

    /** @type {HTMLButtonElement} */ (ov.querySelector('[data-act="cancel"]')).onclick = function () { ov._sonderClose(); };
    /** @type {HTMLButtonElement} */ (ov.querySelector('[data-act="ok"]')).onclick = function () {
      var r = collect();
      if (r.badNodes.length) {
        r.badNodes.forEach(function (b) { showErr(b.node, b.msg || '请填写' + b.label); });
        return;
      }
      var res = opts.onSubmit(r.v);
      if (res && typeof res.then === 'function') {
        /* 异步提交：成功后调用方自行关闭或返回 true；失败返回错误字符串 */
        res.then(function (ok) {
          if (ok === true) ov._sonderClose();
          else if (typeof ok === 'string' && ok.length) { showErr(ov.querySelector('[data-k]'), ok); }
        }, function (err) {
          showErr(ov.querySelector('[data-k]'), (err && err.message) || '操作失败，请重试');
        });
        return;
      }
      if (res === true) { ov._sonderClose(); }
      else if (typeof res === 'string' && res.length) {
        var first = /** @type {HTMLElement|null} */ (ov.querySelector('.hint'));
        if (first) { first.textContent = res; first.style.display = 'block'; }
      }
    };
    var firstInput = /** @type {HTMLElement|null} */ (ov.querySelector('input,select,textarea'));
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

  return { esc: esc, sanitize: sanitize, sanitizeUrl: sanitizeUrl, el: el, toast: toast, confirmBox: confirmBox, alertBox: alertBox, formModal: formModal, emptyState: emptyState };
});