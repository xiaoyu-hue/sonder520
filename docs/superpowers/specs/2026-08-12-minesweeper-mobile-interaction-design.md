# 扫雷移动端交互设计

日期：2026-08-12
状态：已批准

## 背景与问题

扫雷（`js/games.js` 的 `mineView`）桌面端交互为：左键单击翻开、右键（`contextmenu`）插旗。
移动端没有右键，当前只有一个「⚑ 标记模式」开关（开启后点击只插旗，需来回切换，体验笨重）。

## 目标

触屏设备使用「单击翻开 + 长按插旗」这一主流扫雷 App 交互，无需模式切换；
桌面端交互保持不变。

## 交互模型（触屏专用）

- 单击（抬手早于 350ms）→ 翻开格子
- 长按 350ms → 插旗 / 拔旗，触发时震动反馈 `navigator.vibrate(15)`（Android 支持，iOS 静默降级）
- 桌面鼠标保持现状：左键翻开、右键插旗；长按逻辑不作用于鼠标（仅 `pointerType` 为 touch/pen 时启用）

## 手势判定（防冲突）

- `pointerdown` 启动 350ms 定时器，格子进入 `.long-pressing` 高亮态（预知即将插旗）
- 定时器触发 → 插旗 + 震动 + 抑制后续 click（防插旗后又翻开）
- `pointerup` 早于定时器 → 单击，翻开
- `pointermove` 位移 > 10px → 取消长按（棋盘为横向滚动容器，滚动不得误插旗）
- 触屏长按触发的原生 `contextmenu` 一律 `preventDefault`（防浏览器菜单、防二次插旗）
- 键盘可访问性保留：Enter/Space 仍走 click 翻开

## 视觉与防误触（CSS）

- `.ms-cell` 增加 `touch-action: manipulation`（禁双击缩放）、`user-select: none`、`-webkit-touch-callout: none`（禁 iOS 长按气泡）
- 新增长按进行中 `.long-pressing` 高亮态

## UI 简化

移除「⚑ 标记模式」开关（`#msFlagMode`）及 `msFlagMode` 变量逻辑——长按已覆盖其用途，
桌面有右键，各处均冗余。相关测试同步更新。

## 代码位置

- `js/games.js`：`mineView` 格子事件绑定重构（pointer 事件 + 长按定时器），新增常量 `MS_LONG_PRESS_MS = 350`
- `css/style.css`：`.ms-cell` 防误触属性 + `.long-pressing` 高亮
- `tests/minesweeper-mobile.test.js`：新增长按插旗、拖动取消、长按不误翻开测试
- `tests/games-minesweeper.test.js`：移除标记模式开关相关断言

## 测试

- 长按（pointerdown 后 ~400ms）→ 插旗
- 位移 > 10px 后抬手 → 不插旗、不翻开（滚动场景）
- 长按触发后不误翻开（抑制 click）
- 单击 → 翻开（回归）
- 桌面右键（contextmenu）→ 插旗（回归）
