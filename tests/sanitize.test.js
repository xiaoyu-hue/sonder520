'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

function seedXss() {
  return {
    version: 1,
    settings: { modules: {} },
    tasks: [{
      id: 't1', title: '<img src=x onerror=alert(1)><script>alert(2)</script>', note: '加点"双引号"与\'单引号\'',
      date: '2026-08-10', priority: '高', done: false
    }],
    memos: [{ id: 'm1', text: '<b onclick="alert(3)">备忘</b> & 特殊字符', time: '', archived: false }],
    posts: [{ id: 'p1', title: '选题 <script>alert(4)</script>', tags: [], status: 'draft' }],
    devProjects: [{ id: 'd1', name: '项目 &<测试>', note: '', tasks: [], createdAt: '' }],
    clients: [{ id: 'c1', name: '客户"xss"', contact: '', note: '', projects: [], followups: [], income: [] }],
    books: [{ id: 'b1', title: '书名<script>x</script>', author: '', status: 'reading', progress: 0, notes: [] }],
    news: [{
      id: 'n1', title: '新闻标题<script>x</script>', url: 'javascript:alert(9)', source: '来源<i>', tags: [],
      status: 'unread', time: ''
    }],
    designs: [{ id: 'x1', type: 'idea', title: '灵感"双重引号"', link: 'data:text/html,<script>alert(10)</script>', category: '', note: '', stage: '', time: '' }],
    gameRecords: []
  };
}

test('sanitize：纯函数转义全部 HTML 特殊字符', () => {
  const { boot: b } = require('./harness.js');
  const h = b();
  const U = h.window.UI;
  assert.equal(U.sanitize('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(U.sanitize('a"b\'c&d'), 'a&quot;b&#39;c&amp;d');
  assert.equal(U.sanitize(null), '', 'null 应转空串');
  assert.equal(U.esc('x'), U.sanitize('x'), 'sanitize 与 esc 语义一致');
});

test('sanitizeUrl：拦截危险协议，放行安全地址', () => {
  const h = boot();
  const U = h.window.UI;
  assert.equal(U.sanitizeUrl('javascript:alert(1)'), '', '应拦截 javascript:');
  assert.equal(U.sanitizeUrl('data:text/html,x'), '', '应拦截 data:');
  assert.equal(U.sanitizeUrl('vbscript:msgbox(1)'), '', '应拦截 vbscript:');
  assert.equal(U.sanitizeUrl('file:///C:/secret.txt'), '', '应拦截 file:');
  assert.equal(U.sanitizeUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1', 'http(s) 放行');
  assert.equal(U.sanitizeUrl('/css/style.css'), '/css/style.css', '相对路径放行');
  assert.equal(U.sanitizeUrl('mailto:a@b.com'), 'mailto:a@b.com', 'mailto 放行');
});

test('XSS：任务/备忘/书籍等列表渲染后无原始标签且文本保留', () => {
  const h = boot({ seed: seedXss() });
  const content = () => h.window.document.getElementById('content');
  const html = () => content().innerHTML;
  const noEventAttrs = () => !/<[a-z][a-z0-9]*[^>]*?\son(click|error|load)="/i.test(html());
  h.goto('today');
  assert.ok(!html().includes('<script'), '#content 不得出现原始 script 标签');
  assert.ok(html().includes('&lt;script&gt;alert(2)&lt;/script&gt;'), '应显示为转义文本实体');
  assert.ok(!content().querySelector('script, img, [onclick], [onerror]'), '#content 内不得生成可执行元素');
  assert.ok(noEventAttrs(), '不得存在事件属性注入');
  assert.ok(content().textContent.includes('alert(2)'), '转义文本应原样可见');
  h.goto('memo');
  assert.ok(noEventAttrs(), '备忘不得携带事件属性');
  assert.ok(html().includes('&lt;b onclick="alert(3)"&gt;'), '文本应按双向转义呈现');
  h.goto('reading');
  assert.ok(!content().querySelector('script'), '阅读列表不得有 script 元素');
  assert.ok(html().includes('&lt;script&gt;x&lt;/script&gt;'), '书名应作为实体文本显示');
});

test('XSS：新闻/设计的危险链接被拦截', () => {
  const h = boot({ seed: seedXss() });
  h.goto('news');
  const newsLinks = h.window.document.querySelectorAll('.list-item a[href]');
  assert.equal(newsLinks.length, 0, 'javascript: 链接应被完全移除而非保留空 href');
  const newsText = h.window.document.getElementById('content').textContent;
  assert.ok(newsText.includes('新闻标题'), '新闻标题仍可见');
  h.goto('design');
  const links = Array.from(h.window.document.querySelectorAll('.list-item a[href]') || []);
  links.forEach(a => {
    assert.ok(!String(a.getAttribute('href')).match(/^(javascript|data|vbscript):/i), '设计链接不得是危险协议');
  });
  assert.equal(links.length, 0, 'data: 链接应被完全移除');
  const txt = h.window.document.getElementById('content').textContent;
  assert.ok(txt.includes('灵感'), '标题内容应正常显示');
});

test('XSS：属性注入（双引号闭合）不生效', () => {
  const h = boot({ seed: seedXss() });
  h.goto('consulting');
  const c = h.window.document.getElementById('content');
  const html = c.innerHTML;
  assert.ok(!/[^\s>]\s+on(click|error|load)="/i.test(html), '不得出现事件属性注入');
  const title = c.querySelector('#content .title');
  assert.ok(title && title.textContent.includes('客户'), '客户名可见');
  assert.ok(title.getAttribute('style') && !title.getAttribute('style').includes('xss'), 'title 元素属性未被污染');
  const titles = c.querySelectorAll('#content .title');
  const attrs = titles.length ? Array.from(titles[0].attributes).map(a => a.name).join(',') : '';
  assert.ok(!attrs.includes('onerror') && !attrs.includes('style2'), 'title 元素不得长出注入属性');
});

test('XSS：URL 属性闭合注入（" onmouseover=）不生效', () => {
  const seed = seedXss();
  seed.news[0].url = 'https://x.com/" onmouseover="alert(1)';
  seed.designs[0].link = 'https://d.com/" onclick="alert(2)';
  const h = boot({ seed });
  h.goto('news');
  const c = h.window.document.getElementById('content');
  const a = c.querySelector('.list-item a[href]');
  assert.ok(a, '安全协议链接应渲染');
  assert.equal(a.getAttribute('onmouseover'), null, '注入不得生成 onmouseover 属性');
  assert.equal(a.getAttribute('href'), 'https://x.com/" onmouseover="alert(1)', '注入内容应完整保留在 href 值内而非成为属性');
  h.goto('design');
  const d = h.window.document.querySelector('.list-item a[href]');
  assert.ok(d, '设计链接应渲染');
  assert.equal(d.getAttribute('onclick'), null, '注入不得生成 onclick 属性');
  assert.equal(d.getAttribute('href'), 'https://d.com/" onclick="alert(2)', '链接值应原样保留');
});

test('sanitizeUrl：属性闭合 payload 被转义', () => {
  const h = boot();
  const U = h.window.UI;
  assert.equal(U.sanitizeUrl('https://x.com/" onmouseover="alert(1)'), 'https://x.com/&quot; onmouseover=&quot;alert(1)', '双引号应转义为实体');
  assert.equal(U.sanitizeUrl('https://x.com/?a=1&b=2'), 'https://x.com/?a=1&amp;b=2', '& 应转义为实体');
});

test('sanitizeUrl：控制字符绕过与白名单语义（Commit 3 加固）', () => {
  const h = boot();
  const U = h.window.UI;
  /* 浏览器解析 href 会剥离 \t\r\n —— 黑名单式旧实现可被 java\tscript: 绕过 */
  assert.equal(U.sanitizeUrl('java\tscript:alert(1)'), '', 'tab 分隔的 javascript: 必须拦截');
  assert.equal(U.sanitizeUrl('java\r\nscript:x'), '', 'CRLF 分隔同理');
  assert.equal(U.sanitizeUrl('\u0000javascript:x'), '', 'NUL 前缀拦截');
  assert.equal(U.sanitizeUrl('DATA:text/html,<script>'), '', '大小写变体拒绝');
  assert.equal(U.sanitizeUrl('vbscript:x'.replace('v','V')), '', 'Vbscript 变体拒绝');
  /* 协议相对与未知协议 */
  assert.equal(U.sanitizeUrl('//evil.com/x'), '', '// 开头的协议相对外链不放行');
  assert.equal(U.sanitizeUrl('ftp://f.com/file'), '', '非白名单协议拒绝');
  assert.equal(U.sanitizeUrl('tel:+8613800000000'), '', 'tel: 不在白名单（当前应用无用例）');
  /* 相对路径形态放行 */
  assert.equal(U.sanitizeUrl('./page.html'), './page.html', './ 相对路径放行');
  assert.equal(U.sanitizeUrl('../up/x'), '../up/x', '../ 放行');
  assert.equal(U.sanitizeUrl('#anchor'), '#anchor', '锚点放行');
  assert.equal(U.sanitizeUrl('plain/path?q=1'), 'plain/path?q=1', '无 scheme 视作站内相对路径');
});