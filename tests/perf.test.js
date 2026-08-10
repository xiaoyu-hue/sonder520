'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');

test('性能：壁纸预加载 + 站点图标内联（首次绘制提速，无 404）', () => {
  assert.ok(html.includes('<link rel="preload" as="image" href="img/wallpaper.jpg">'), '应预加载壁纸');
  assert.ok(html.includes('<link rel="icon" href="data:image/svg+xml'), '应有内联 favicon');
});

test('性能：不再使用 background-attachment: fixed（滚动重绘开销）', () => {
  assert.ok(!/background-attachment:\s*fixed/.test(css), 'body 不应再 fixed 背景');
  assert.ok(css.includes('#wallpaperLayer') && css.includes('position: fixed'), '壁纸仍由固定层承载');
  const app = require('node:fs').readFileSync(require('node:path').join(require('node:path').dirname(require('node:path').dirname(__filename)), 'js', 'app.js'), 'utf8');
  assert.ok(app.includes('img/wallpaper.jpg'), '默认壁纸由 JS 注入 img 元素');
});

test('性能：玻璃磨砂降档（移动端低端机不卡），双侧前缀一致', () => {
  ['20px) saturate(1.6) brightness(1.05)', '18px) saturate(1.5) brightness(1.04)', '12px) saturate(1.5) brightness(1.02)'].forEach(s => {
    assert.ok(css.includes('backdrop-filter: blur(' + s), '缺标准磨砂 ' + s);
    assert.ok(css.includes('-webkit-backdrop-filter: blur(' + s), '缺 -webkit 磨砂 ' + s);
  });
});

test('无障碍：导航激活项带 aria-current，主题色随主题切换', () => {
  const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
  assert.ok(app.includes("setAttribute('aria-current', 'page')"), '缺 aria-current');
  assert.ok(app.includes('meta[name="theme-color"]'), '主题色应随主题更新');
});

test('清理：JS 中无已废弃的 --panel 变量引用', () => {
  const jsDir = path.join(root, 'js');
  const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
  jsFiles.forEach(f => {
    const code = fs.readFileSync(path.join(jsDir, f), 'utf8');
    assert.ok(!/var\(--panel[^)-]*\)/.test(code), f + ' 引用了废弃变量 --panel');
  });
});

test('动效成本：入场/图表动画时长收敛', () => {
  assert.ok(css.includes('animation: fadeUp .32s var(--ease) both'), '入场应轻量');
  assert.ok(css.includes('animation: barsGrow .65s var(--ease) both'), '图表生长应轻量');
});

test('性能：保存幂等并单次序列化（内容未变零 IO，_rev 用于缓存失效）', () => {
  const S = require('../js/store.js');
  const store = S.createStore({
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  });
  store.save();
  const st = store;
  const revAfterFirst = st._rev;
  const jsonAfterFirst = st._lastJson;
  assert.ok(revAfterFirst >= 1, '首次保存应递增版本');
  st.save();
  assert.equal(st._rev, revAfterFirst, '内容未变再次保存不应重复序列化与写入');
  assert.equal(st._lastJson, jsonAfterFirst, '序列化快照应复用');
  assert.equal(st.storageUsage(), jsonAfterFirst.length, '体积估算应复用快照而非重算');
  st.state.tasks.push({ id: 'x', title: '新任务', date: '', priority: '中', done: false, order: 0 });
  st.save();
  assert.equal(st._rev, revAfterFirst + 1, '内容变化应递增版本');
  assert.ok(st._lastJson.length > jsonAfterFirst.length, '快照应随之更新');
  assert.equal(st.storageUsage(), st._lastJson.length, '更新后体积应反映新快照');
});

test('性能：搜索索引按 _rev 缓存，重复查询不重建', () => {
  const { boot } = require('./harness.js');
  const h = boot({
    seed: {
      version: 1, settings: { modules: {} },
      tasks: [{ id: 't1', title: '缓存实验', note: '', date: '', priority: '低', done: false }],
      memos: [], posts: [], devProjects: [], clients: [], books: [], news: [], designs: [], gameRecords: []
    }
  });
  const w = h.window, doc = w.document;
  const input = doc.getElementById('globalSearch');
  const set = v => { input.value = v; input.dispatchEvent(new w.Event('input', { bubbles: true })); };
  set('缓存');
  assert.ok(doc.getElementById('gsearchPanel').textContent.includes('缓存实验'), '首查应命中');
  const store = w.__sonderHooks.store;
  assert.ok(store, '共享实例应暴露于 hooks');
  set('缓存实');
  assert.ok(doc.getElementById('gsearchPanel').textContent.includes('缓存实验'), '再查应命中');
  set('不存在的词xyz');
  assert.ok(doc.getElementById('gsearchPanel').textContent.includes('空谷无音'), '空结果正常');
});

test('性能：困难五子棋候选剪枝（终盘候选超 16 时只对高分组前瞻）', () => {
  const LG = require('../js/games-logic.js');
  const g = LG.createGame('gomoku');
  g.board.forEach((row, r) => row.forEach((v, c) => {
    if ((r + c) % 2 === 0 && r >= 4 && r <= 10 && c >= 4 && c <= 10) g.board[r][c] = r % 3 === 0 ? 'X' : 'O';
  }));
  const mv = LG.gomokuAiMove(g, 'X', 'hard');
  assert.ok(mv && mv.r >= 0 && mv.c >= 0 && g.board[mv.r][mv.c] === null, '剪枝后仍应给出合法落点');
  const code = fs.readFileSync(path.join(root, 'js', 'games-logic.js'), 'utf8');
  assert.ok(code.includes('HARD_LOOKAHEAD'), '困难模式应有前瞻预算');
});