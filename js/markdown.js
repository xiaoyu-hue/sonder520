/* markdown.js - 简易 Markdown 渲染（无依赖，浏览器/Node 通用）
 * 支持：``` 代码块、**粗体**、# 1-6 级标题；其余按文本行转义输出（防 XSS）。
 * 渲染顺序：先整体转义输入，再生成结构标签，杜绝注入。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SonderMarkdown = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* 行内处理：转义后用 **粗体** 生成 <strong>（此时输入已安全转义） */
  function inline(s) {
    return esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  function render(src) {
    var lines = String(src === null || src === undefined ? '' : src).split('\n');
    var html = [];
    var inCode = false;
    var codeBuf = [];
    var i, line, trimmed;

    function flushCode() {
      html.push('<pre class="md-code"><code>' + esc(codeBuf.join('\n')) + '</code></pre>');
      codeBuf = [];
    }

    for (i = 0; i < lines.length; i++) {
      line = lines[i];
      trimmed = line.trim();
      if (/^```/.test(trimmed)) {
        if (inCode) { flushCode(); inCode = false; }
        else { inCode = true; }
        continue;
      }
      if (inCode) { codeBuf.push(line); continue; }
      if (/^#{1,6}\s+/.test(trimmed)) {
        var level = Math.min(6, trimmed.match(/^#+/)[0].length);
        html.push('<h' + level + ' class="md-h">' + inline(trimmed.replace(/^#+\s*/, '')) + '</h' + level + '>');
      } else if (trimmed === '') {
        html.push('');
      } else {
        html.push('<p>' + inline(line) + '</p>');
      }
    }
    if (inCode) flushCode();
    return html.join('\n');
  }

  return { render: render, esc: esc };
});