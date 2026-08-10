'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');
const S = require('../js/store.js');
const MD = require('../js/markdown.js');
const wait = ms => new Promise(r => setTimeout(r, ms));

function newStore() {
  return S.createStore({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
}

/* ================= Markdown 渲染（纯逻辑） ================= */

test('Markdown：代码块 / 粗体 / # 标题渲染', () => {
  const html = MD.render('# 标题一\n\n## 二级标题\n\n**要点加粗**\n\n```\nconst a = 1;\n```');
  assert.ok(html.includes('<h1 class="md-h">标题一</h1>'), '# 应渲染为 h1');
  assert.ok(html.includes('<h2 class="md-h">二级标题</h2>'), '第二级标题也应支持');
  assert.ok(html.includes('<strong>要点加粗</strong>'), '** 应渲染为 strong');
  assert.ok(html.includes('<pre class="md-code"><code>const a = 1;</code></pre>'), '``` 应渲染为代码块');
});

test('Markdown：XSS 安全（先转义再渲染），代码块内不解析粗体', () => {
  const html = MD.render('<script>alert(1)</script> **a<b**\n\n```\n**not bold** <img>\n```');
  assert.ok(!html.includes('<script>'), '脚本不得原样出现');
  assert.ok(html.includes('&lt;script&gt;'), '标签应被转义');
  assert.ok(html.includes('&lt;img&gt;'), '代码块内标签应转义');
  assert.ok(html.includes('**not bold**'), '代码块内粗体语法不渲染');
  assert.ok(!html.includes('<strong>not bold</strong>'));
  const html2 = MD.render('```\n未闭合代码块');
  assert.ok(html2.includes('<pre class="md-code">'), '未闭合代码块容错渲染');
});

test('Markdown：普通行输出为段落，空行跳过', () => {
  const html = MD.render('第一行\n\n第二行');
  assert.ok(html.includes('<p>第一行</p>'));
  assert.ok(html.includes('<p>第二行</p>'));
});

/* ================= 数据层：笔记 / 片段 ================= */

test('开发笔记：CRUD 且更新自动刷新 updatedAt', () => {
  const s = newStore();
  const n = s.addDevNote({ title: '笔记A', content: '内容' });
  assert.ok(n.createdAt && n.updatedAt);
  assert.equal(s.state.devNotes[0].title, '笔记A');
  const u1 = s.state.devNotes[0].updatedAt;
  s.updateDevNote(n.id, { content: '新内容' });
  const u2 = s.state.devNotes[0].updatedAt;
  assert.ok(u2 >= u1, '更新时间刷新');
  assert.equal(s.state.devNotes[0].content, '新内容');
  s.removeDevNote(n.id);
  assert.equal(s.state.devNotes.length, 0);
});

test('代码片段：CRUD 与排序函数按更新时间倒序', () => {
  const s = newStore();
  const a = s.addDevSnippet({ title: '吊起命令', code: 'npm run dev' });
  const b = s.addDevSnippet({ title: '提交命令', code: 'git commit' });
  const c = s.addDevSnippet({ title: '部署命令', code: 'netlify deploy' });
  return wait(5).then(() => {
    s.updateDevSnippet(b.id, { code: 'git commit -m 新' });
    assert.equal(s.state.devSnippets.find(x => x.id === b.id).code, 'git commit -m 新');
    const sorted = S.sortNotesByUpdate(s.state.devSnippets).map(x => x.id);
    assert.equal(sorted[0], b.id, '刚更新的片段排最前');
    assert.equal(sorted.length, 3);
    return wait(5);
  }).then(() => {
    s.updateDevSnippet(c.id, { title: '部署命令2' });
    assert.equal(S.sortNotesByUpdate(s.state.devSnippets)[0].id, c.id);
    s.removeDevSnippet(a.id);
    assert.equal(s.state.devSnippets.length, 2);
  });
});

/* ================= UI：开发工作页 ================= */

test('开发页：三个标签切换（项目/技术笔记/代码片段）', () => {
  const h = boot();
  h.goto('dev');
  assert.ok(h.window.document.querySelector('[data-tab="projects"]'), '应有项目标签');
  h.window.document.querySelector('[data-tab="notes"]').click();
  assert.ok(h.window.document.querySelector('#devNoteAdd'), '技术笔记区应有新建笔记按钮');
  h.window.document.querySelector('[data-tab="snippets"]').click();
  assert.ok(h.window.document.querySelector('#devSnipAdd'), '代码片段区应有新建按钮');
  h.window.document.querySelector('[data-tab="projects"]').click();
  assert.ok(h.window.document.querySelector('#devAdd'), '可回到项目区');
});

test('开发页：技术笔记保存后按 Markdown 渲染展示，编辑后置顶', () => {
  const h = boot();
  h.goto('dev');
  h.window.document.querySelector('[data-tab="notes"]').click();
  h.window.document.querySelector('#devNoteAdd').click();
  h.window.document.querySelector('input[data-k="title"]').value = '接口速查';
  h.window.document.querySelector('textarea[data-k="content"]').value = '# 速查\n\n```\ncurl -X GET /api\n```\n\n**注意缓存**';
  h.window.document.querySelector('.overlay [data-act="ok"]').click();
  const n = h.store.state.devNotes[0];
  assert.ok(n.title === '接口速查' && n.content.includes('curl'), '笔记入库');
  assert.ok(h.window.document.querySelector('.md-body h1'), '页面渲染 # 标题');
  assert.ok(h.window.document.querySelector('.md-body pre.md-code'), '页面渲染代码块');
  assert.ok(h.window.document.querySelector('.md-body strong'), '页面渲染粗体');
  h.window.document.querySelector('[data-nedit]').click();
  h.window.document.querySelector('textarea[data-k="content"]').value = '# 改后\n```\nx=1\n```';
  h.window.document.querySelector('.overlay [data-act="ok"]').click();
  assert.equal(h.store.state.devNotes[0].content, '# 改后\n```\nx=1\n```', '编辑刷新内容');
  const second = h.store.addDevNote({ title: '更新的笔记', content: 'p' });
  h.goto('dev');
  h.window.document.querySelector('[data-tab="notes"]').click();
  h.store.updateDevNote(second.id, { title: '更新的笔记2' });
  h.goto('dev');
  h.window.document.querySelector('[data-tab="notes"]').click();
  const firstCard = h.window.document.querySelector('.md-body');
  assert.ok(firstCard && firstCard.closest('.card').textContent.includes('更新的笔记2'), '刚更新的笔记排最前');
});

test('开发页：代码片段显示代码与一键复制，点击复制并提示', () => {
  const h = boot();
  let copied = '';
  h.window.navigator.clipboard = { writeText: t => Promise.resolve(copied = t) };
  h.store.addDevSnippet({ title: '构建命令', code: 'npm run build' });
  h.goto('dev');
  h.window.document.querySelector('[data-tab="snippets"]').click();
  assert.ok(h.window.document.querySelector('pre.md-code code'), '片段以代码块展示');
  assert.ok(h.window.document.querySelector('[data-copy]'), '应有复制按钮');
  h.window.document.querySelector('[data-copy]').click();
  return wait(30).then(() => {
    assert.equal(copied, 'npm run build', 'Clipboard API 收到代码');
    assert.ok(h.window.document.body.textContent.includes('已复制'), '应提示已复制');
  });
});

test('开发页：新建片段弹窗保存后上屏', () => {
  const h = boot();
  h.goto('dev');
  h.window.document.querySelector('[data-tab="snippets"]').click();
  h.window.document.querySelector('#devSnipAdd').click();
  h.window.document.querySelector('input[data-k="title"]').value = '部署脚本';
  h.window.document.querySelector('textarea[data-k="code"]').value = 'netlify deploy --prod';
  h.window.document.querySelector('.overlay [data-act="ok"]').click();
  assert.equal(h.store.state.devSnippets[0].code, 'netlify deploy --prod');
  assert.ok(h.window.document.body.textContent.includes('netlify deploy --prod'), '页面显示片段内容');
});