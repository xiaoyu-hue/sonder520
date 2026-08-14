# 扫雷移动端交互（单击翻开 + 长按插旗）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 触屏设备扫雷改为「单击翻开 + 长按 350ms 插旗/拔旗」，移除标记模式开关，桌面交互不变。

**Architecture:** 在 `js/games.js` 的 `mineView` 中把格子的 `click`/`contextmenu` 绑定重构为统一指针事件绑定（`bindMineCell`）：`pointerdown` 启动长按定时器（仅 touch/pen），位移超阈值或 `pointercancel` 取消，定时器触发插旗。**关键点：插旗后 `render(ctx)` 会重建整个棋盘 DOM，因此长按后的误触抑制不能用格子局部标记**，而是模块级「位置 + 时间窗」抑制：记录最后一次插旗的坐标 `msLpPos` 与时刻 `msLpAt`，在 700ms 内该坐标的首次 click/contextmenu 被吞掉。桌面鼠标仍走 `click` 翻开、`contextmenu` 插旗。CSS 增加防误触属性与 `.long-pressing` 高亮态。

**Tech Stack:** 原生 ES5（项目风格：`var` + `function`，无 class）、jsdom + node:test、ESLint、TypeScript（仅类型检查）。

**Spec:** `docs/superpowers/specs/2026-08-12-minesweeper-mobile-interaction-design.md`

## Global Constraints

- 长按时长固定 `MS_LONG_PRESS_MS = 350`（毫秒）
- 位移取消阈值固定 10px（`|clientX - sx| > 10 || |clientY - sy| > 10`）
- 长按只对 `pointerType` 为 touch/pen 启用；mouse 完全走原 click/contextmenu 路径
- 误触抑制：模块级 `msLpPos`（坐标 `r,c`）+ `msLpAt`（时间戳），700ms 窗口内同坐标的首次 click/contextmenu 被吞掉并清除记录
- `#msFlagMode` 标记模式开关及其 `msFlagMode` 变量、`msFlagChange()` 全部移除
- 保持 ES5 风格（`var`、`function` 声明），不引入新依赖
- 测试命令：全量 `npm test`；单项 `node --test tests/<file>.test.js`；`npm run lint`；`npm run typecheck`
- 提交信息沿用仓库风格（`feat:`/`fix:`/`style:`/`refactor:`/`docs:` + 中文说明）
- `.ms-cell.open` 已有 `pointer-events: none`，翻开格不可点，保持不变
- **测试中插旗后 DOM 会被重建（`render(ctx)`），断言前必须重新 `querySelector` 获取新格子元素**

---

### Task 1: 长按插旗手势（games.js + 新测试）

**Files:**
- Modify: `js/games.js`（`mineView` 格子绑定处 244-250 行；常量区 70-71 行附近）
- Test: `tests/minesweeper-mobile.test.js`

**Interfaces:**
- Consumes: 现有 `mineCellClick(ctx, cell)`、`mineCellFlag(ctx, cell)`（签名不变，`ctx` = render 上下文对象，`cell` = 格子 DOM 元素；两者内部都会在成功后调用 `render(ctx)` 重建 DOM）
- Produces: `bindMineCell(ctx, cell)` —— 后续任务依赖它完成格子事件绑定；常量 `MS_LONG_PRESS_MS = 350`；模块级抑制变量 `msLpPos` / `msLpAt`（Task 3 依赖其存在）

- [ ] **Step 1: 写失败测试（长按插旗、不误翻开、鼠标不受影响）**

在 `tests/minesweeper-mobile.test.js` 末尾追加：

```js
function touchEvent(win, type, opts) {
  const e = new win.MouseEvent(type, Object.assign({
    bubbles: true, cancelable: true, clientX: 10, clientY: 10
  }, opts));
  Object.defineProperty(e, 'pointerType', { value: 'touch' });
  return e;
}

test('扫雷移动端：长按 350ms 插旗且不误翻开', async () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="minesweeper"]').click();
  h.window.__gamesDbg.setMineField(9, 9, [[0, 0], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4]]);
  const doc = h.window.document;
  const cell = doc.querySelector('.ms-cell[data-r="0"][data-c="0"]');
  cell.dispatchEvent(touchEvent(h.window, 'pointerdown'));
  assert.ok(cell.classList.contains('long-pressing'), '长按进行中有高亮态');
  await new Promise(r => setTimeout(r, 450));
  const fresh = doc.querySelector('.ms-cell[data-r="0"][data-c="0"]');
  fresh.dispatchEvent(touchEvent(h.window, 'pointerup'));
  fresh.dispatchEvent(touchEvent(h.window, 'click'));
  assert.equal(fresh.textContent, '⚑', '长按插旗');
  assert.ok(!fresh.classList.contains('open'), '插旗不误翻开');
  assert.ok(doc.body.textContent.includes('剩余 9 雷'), '剩余雷数减少');
});

test('扫雷移动端：长按后抬手产生的 click 被抑制，不误翻开', async () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="minesweeper"]').click();
  h.window.__gamesDbg.setMineField(9, 9, [[2, 2], [5, 5], [7, 7]]);
  const doc = h.window.document;
  const cell = doc.querySelector('.ms-cell[data-r="1"][data-c="1"]');
  cell.dispatchEvent(touchEvent(h.window, 'pointerdown'));
  await new Promise(r => setTimeout(r, 450));
  const fresh = doc.querySelector('.ms-cell[data-r="1"][data-c="1"]');
  fresh.dispatchEvent(touchEvent(h.window, 'pointerup'));
  fresh.dispatchEvent(touchEvent(h.window, 'click'));
  assert.equal(fresh.textContent, '⚑', '长按插旗');
  assert.equal(h.window.__gamesDbg().mini.revealed, 0, '未翻开任何格');
});

test('扫雷移动端：鼠标 pointerType 不启用长按', async () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="minesweeper"]').click();
  const doc = h.window.document;
  const cell = doc.querySelector('.ms-cell[data-r="8"][data-c="8"]');
  const ev = new h.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 });
  Object.defineProperty(ev, 'pointerType', { value: 'mouse' });
  cell.dispatchEvent(ev);
  await new Promise(r => setTimeout(r, 450));
  cell.click();
  assert.ok(cell.classList.contains('open'), '鼠标点击直接翻开，不受长按影响');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/minesweeper-mobile.test.js`
Expected: 3 个新测试 FAIL（无长按插旗行为、或长按后误翻开），原有 3 个测试 PASS。

- [ ] **Step 3: 实现 bindMineCell 与常量**

在 `js/games.js` 常量区（第 70 行 `var MS_DEFAULT_DIFF = 'easy';` 之后）追加：

```js
var MS_LONG_PRESS_MS = 350;
```

把 `mineView` 中 244-250 行的格子事件绑定循环替换为：

```js
    board.querySelectorAll('.ms-cell').forEach(function (cell) {
      bindMineCell(ctx, cell);
    });
```

在 `mineCellFlag` 函数（约 390 行）之后新增（含模块级抑制变量与绑定函数；`msLpPos`/`msLpAt` 声明在 IIFE 顶层，与 `bindMineCell` 同级作用域）：

```js
  /* 移动端交互：单击翻开（由 click 触发）、长按 350ms 插旗（仅触屏/手写笔）。
   * pointerdown 启动定时器并显示 .long-pressing 高亮；位移 >10px 或 pointercancel（滚动）取消。
   * 插旗后 render(ctx) 会重建棋盘 DOM，故误触抑制不能用格子局部标记，改为模块级
   * 「位置 + 时间窗」：msLpPos=插旗坐标、msLpAt=时刻，700ms 内该坐标的首次 click/contextmenu 被吞掉。 */
  var msLpPos = null, msLpAt = 0;

  function lpSuppressed(cell) {
    if (msLpPos === null) return false;
    if (Date.now() - msLpAt > 700) { msLpPos = null; return false; }
    var pos = cell.dataset.r + ',' + cell.dataset.c;
    if (msLpPos !== pos) return false;
    msLpPos = null;
    return true;
  }

  function bindMineCell(ctx, cell) {
    var lpTimer = null, sx = 0, sy = 0;
    function cancelLp() {
      if (lpTimer === null) return;
      window.clearTimeout(lpTimer);
      lpTimer = null;
      cell.classList.remove('long-pressing');
    }
    cell.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      sx = e.clientX; sy = e.clientY;
      cell.classList.add('long-pressing');
      lpTimer = window.setTimeout(function () {
        lpTimer = null;
        cell.classList.remove('long-pressing');
        msLpPos = cell.dataset.r + ',' + cell.dataset.c;
        msLpAt = Date.now();
        mineCellFlag(ctx, cell);
        if (typeof window.navigator.vibrate === 'function') window.navigator.vibrate(15);
      }, MS_LONG_PRESS_MS);
    });
    cell.addEventListener('pointermove', function (e) {
      if (lpTimer !== null && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) cancelLp();
    });
    cell.addEventListener('pointercancel', cancelLp);
    cell.addEventListener('pointerup', cancelLp);
    cell.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      if (lpSuppressed(cell)) return;
      mineCellFlag(ctx, cell);
    });
    cell.addEventListener('click', function () {
      if (lpSuppressed(cell)) return;
      mineCellClick(ctx, cell);
    });
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/minesweeper-mobile.test.js`
Expected: 6 个测试全部 PASS（3 个原有 + 3 个新增）。

- [ ] **Step 5: 提交**

```bash
git add js/games.js tests/minesweeper-mobile.test.js
git commit -m "feat: 扫雷移动端长按插旗交互（单击翻开+长按 350ms 插旗）"
```

---

### Task 2: CSS 防误触与长按高亮

**Files:**
- Modify: `css/style.css:885-894`（`.ms-cell` 与 `.ms-cell:active` 区域）
- Test: `tests/minesweeper-mobile.test.js`（第 1 个测试追加断言）

**Interfaces:**
- Consumes: Task 1 的 `.long-pressing` class 名（已由 `bindMineCell` 使用）
- Produces: 无新接口，仅样式

- [ ] **Step 1: 写失败断言**

`tests/minesweeper-mobile.test.js` 第 1 个测试（`扫雷移动端：棋盘容器可横向滚动…`）内追加：

```js
  assert.ok(/touch-action:\s*manipulation/.test(CSS), '格子禁用双击缩放');
  assert.ok(/\.ms-cell\.long-pressing\s*\{/.test(CSS), '长按高亮态样式');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/minesweeper-mobile.test.js`
Expected: 第 1 个测试 FAIL（两个新断言不通过）。

- [ ] **Step 3: 实现 CSS**

`css/style.css` 的 `.ms-cell` 规则块内追加三条属性：

```css
  touch-action: manipulation;
  user-select: none;
  -webkit-touch-callout: none;
```

在 `.ms-cell:active { transform: scale(0.92); }` 之后新增：

```css
.ms-cell.long-pressing { background: var(--accent-soft); transform: scale(0.92); }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/minesweeper-mobile.test.js`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add css/style.css tests/minesweeper-mobile.test.js
git commit -m "style: 扫雷格子防误触与长按高亮（touch-action/禁选中/长按态）"
```

---

### Task 3: 移除标记模式开关并回归

**Files:**
- Modify: `js/games.js`（71 行 `msFlagMode` 变量、81 行、231-232 行开关 HTML、242 行 `msFlagChange` 调用、338-345 行函数、367-370 行 `mineCellClick` 分支、395 行）
- Test: `tests/games-minesweeper.test.js`（176 行、193-198 行、216-223 行）

**Interfaces:**
- Consumes: Task 1 的 `bindMineCell`、`lpSuppressed` 模块级抑制（`msLpPos`/`msLpAt`）
- Produces: `mineCellClick(ctx, cell)` 语义简化为仅翻开（无分支）；桌面插旗唯一路径为 `contextmenu`

- [ ] **Step 1: 写失败测试（更新断言）**

`tests/games-minesweeper.test.js`：

1. 第 176 行 `assert.ok(doc.querySelector('#msFlagMode'), '有标记模式开关');` 改为：

```js
  assert.equal(doc.querySelector('#msFlagMode'), null, '标记模式开关已移除');
```

2. 第 193-198 行（`#msFlagMode` 两次点击切换）替换为：

```js
  cellAt(0, 0).dispatchEvent(new h.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  assert.equal(cellAt(0, 0).textContent, '⚑', '右键/长按插旗');
  assert.ok(doc.body.textContent.includes('剩余 9 雷'), '剩余雷数减少');
  cellAt(0, 4).click();
```

3. 第 216-223 行（`doc.querySelector('#msFlagMode').click();` 及后续插旗点击）替换为：

```js
  function flagAt(r, c) {
    cellAt(r, c).dispatchEvent(new h.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  }
  flagAt(1, 1);
  assert.equal(h.window.__gamesDbg().mini.over, false, '插错旗不结束');
  flagAt(1, 1);
  flagAt(2, 2);
  flagAt(5, 5);
  assert.equal(h.window.__gamesDbg().mini.over, false, '旗数未满不判胜');
  flagAt(7, 7);
```

（其余断言不变：`click` 翻开路径在 181 行测试中已覆盖回归。注意：`contextmenu` 派发后同样会重建 DOM，但 `cellAt` 每次调用都会重新查询，无需担心元素失效。）

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/games-minesweeper.test.js`
Expected: FAIL —— 实现未改时 `#msFlagMode` 仍存在、`click` 点击仍是翻开而非插旗。

- [ ] **Step 3: 实现移除**

`js/games.js` 中依次移除：

1. 第 71 行 `var msFlagMode = false;`
2. 第 81 行 `msFlagMode = false;`（startMini 内）
3. 第 231-232 行整个开关标签（`'<label class="toggle small" style="margin-left:auto">…</label>'` 所在行；`row` 内保留 statusTxt 与 statsTxt 两个 span）
4. 第 242 行 `msFlagChange(card, ctx);`
5. 第 338-345 行整个 `msFlagChange` 函数
6. 第 367-370 行 `mineCellClick` 内的 flag-mode 分支，函数体恢复为：

```js
  function mineCellClick(ctx, cell) {
    var g = state.mini.g;
    if (g.over) return;
    var r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    if (!isFinite(r) || !isFinite(c)) return;
    var res = G.mineReveal(g, r, c);
    if (!res.ok) { ctx.UI.toast(res.error, 'err'); return; }
    if (res.over) {
      finishMinesweeper(ctx, !!res.won);
      return;
    }
    render(ctx);
  }
```

7. 第 395 行 `msFlagMode = false;`（msRestart 内）

（`msLpPos` / `msLpAt` 是 Task 1 新增的抑制变量，与 `msFlagMode` 无关，保留。）

- [ ] **Step 4: 运行相关测试确认通过**

Run: `node --test tests/games-minesweeper.test.js tests/minesweeper-mobile.test.js tests/minesweeper-firstclick.test.js tests/minesweeper-visual.test.js`
Expected: 全部 PASS。

- [ ] **Step 5: 全量回归 + lint + typecheck**

Run:
```bash
npm test
npm run lint
npm run typecheck
```
Expected: 全部通过（lint/typecheck 0 error）。

- [ ] **Step 6: 提交**

```bash
git add js/games.js tests/games-minesweeper.test.js
git commit -m "refactor: 移除扫雷标记模式开关（长按插旗已覆盖）"
```
