# 小莫灵家族（桌面玩偶）全面修复与优化设计文档

**日期**：2026-08-21
**版本**：v1.0
**状态**：待实施

---

## 1. 背景与目标

### 1.1 当前状态

桌面玩偶模块（v6.0 desktop-pet）已完成 Task 1-10，包含：
- Phase 1：三角色/显示模式/串门/布局/拖拽
- Phase 2：金币/商店/喂养/亲密度
- Phase 3：成就/互动对话
- 独立板块页面

**基线**：657 tests / 221 commits / v55

### 1.2 发现的问题

通过全面审计发现以下关键问题：

#### 功能缺失（HIGH）
1. `_tick()` 空实现 — 呼吸/眨眼/视线追踪动画全部失效
2. 无右键菜单 — 悬浮玩偶无法交互
3. 无点击反应 — 点击玩偶无任何反馈
4. 互动对话无自动触发 — 只能通过任务完成触发
5. 无会话金币上限（规格要求 100）
6. 无深夜行为（23:00-06:00 sleepy 表情）
7. 无 streak 页面加载检查

#### 视觉不一致（HIGH）
1. 独立板块使用自定义 CSS 变量，未复用项目 token
2. 深色主题完全失效
3. 卡片/按钮无液态玻璃效果
4. 圆角/阴影/间距与项目标准不同
5. 手机端未适配安全区域和触控尺寸

#### 代码质量（MEDIUM）
1. 6 个空占位函数从未实现
2. 眨眼 CSS 类名不匹配（`dp-blinking` vs `dp-eyes-closed`）
3. `enter()` 动画与 CSS 角色缩放冲突
4. `Pet.destroy()` 窗口监听器泄漏风险

### 1.3 目标

通过 6 个阶段的渐进修复：
1. 让玩偶"活"起来（动画系统）
2. 让用户能互动（交互系统）
3. 补全自动行为（自动触发）
4. 统一视觉风格（页面视觉）
5. 优化移动端（移动端适配）
6. 确保质量（测试补全）

---

## 2. 架构决策

### 2.1 方案选择：渐进修复（方案 A）

**选择理由**：
1. 风险可控 — 每个阶段独立可测试
2. 符合 AGENTS.md — 禁止 Big Bang Rewrite
3. 功能优先 — 先让核心功能工作
4. 时间效率 — 6 个阶段可并行开发

### 2.2 提交策略

- **Commit 1**：阶段 1-3（功能）→ SW v55
- **Commit 2**：阶段 4-5（视觉）→ SW v56
- **Commit 3**：阶段 6（测试）→ v6.0 收官

### 2.3 兼容性保证

- 不破坏现有 API（PetFamily 公开方法不变）
- 不改变数据结构（settings.desktopPet 格式不变）
- 不删除现有测试（只新增）

---

## 3. 详细设计

### 3.1 阶段 1：动画系统

#### 3.1.1 `_tick(dt, t)` 实现

**位置**：`js/desktop-pet.js` Pet.prototype._tick

**功能**：
```javascript
Pet.prototype._tick = function (dt, t) {
  // 1. 呼吸动画
  this.breathe += dt;
  var breathePhase = Math.sin(this.breathe * Math.PI * 2 / 3.2); // 3.2s 周期
  this.breatheScale = 1 + breathePhase * 0.03; // ±3% 缩放
  
  // 2. 眨眼动画
  if (this._nextBlinkAt && t > this._nextBlinkAt) {
    this._doBlink();
  }
  
  // 3. 视线追踪平滑
  var targetLookX = this._targetLookX || 0;
  var targetLookY = this._targetLookY || 0;
  this.lookX += (targetLookX - this.lookX) * Math.min(1, dt * 8);
  this.lookY += (targetLookY - this.lookY) * Math.min(1, dt * 8);
  
  // 4. 装饰动画
  this._tickDecorations(dt, t);
  
  // 5. 应用到 DOM
  this._applyVisuals();
};
```

**验收标准**：
- 呼吸缩放应用到 `bodyG`，频率 3.2s，幅度 ±3%
- 眨眼每 3-5 秒随机触发一次
- 视线追踪平滑过渡，无跳跃
- 装饰动画（zzz/star/sweat）正确播放

#### 3.1.2 眨眼 CSS 修复

**位置**：`js/desktop-pet.js:1186`

**修改**：
```javascript
// 旧代码
this.el.classList.add('dp-blinking');

// 新代码
this.el.classList.add('dp-eyes-closed');
```

**配套 CSS**：
```css
.dp-pet.dp-eyes-closed .dp-eye {
  transform: scaleY(0.08);
  transition: transform 0.08s ease;
}
```

#### 3.1.3 测试

新增测试项：
- `_tick` 被调用后 `breathe` 值变化
- 眨眼类名正确切换
- 装饰动画状态正确

---

### 3.2 阶段 2：交互系统

#### 3.2.1 右键菜单组件

**位置**：`js/desktop-pet.js` 新增 `_showContextMenu(x, y)`

**功能**：
- 弹出菜单包含：喂食、商店、召唤小伙伴、隐藏
- 点击外部区域关闭
- 菜单项禁用状态（库存为空时喂食灰显）

**样式**：
```css
.dp-context-menu {
  position: fixed;
  z-index: 10001;
  background: var(--glass-sober);
  backdrop-filter: blur(20px) saturate(1.4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  min-width: 140px;
  padding: 6px 0;
}

.dp-context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  transition: background 0.15s;
}

.dp-context-menu-item:hover {
  background: var(--accent-soft);
}

.dp-context-menu-item.disabled {
  opacity: 0.4;
  pointer-events: none;
}
```

#### 3.2.2 点击反应

**位置**：`js/desktop-pet.js` `_bindEvents` 增加 click 处理

**功能**：
- 点击玩偶 → 随机表情 + 显示语录
- 冷却 2 秒，防止快速连续点击

#### 3.2.3 双击喂食

**位置**：`js/desktop-pet.js` `_bindEvents` 增加 dblclick 处理

**功能**：
- 双击 → 从库存取第一个可用零食喂食
- 无库存时显示提示气泡

#### 3.2.4 长按商店（移动端）

**位置**：`js/desktop-pet.js` `_bindEvents` 增加 touchstart/touchend 处理

**功能**：
- 长按 500ms → 打开商店弹窗
- 与右键菜单互斥（桌面端右键，移动端长按）

#### 3.2.5 触控模式检测

**位置**：`js/desktop-pet.js` 构造函数

**功能**：
```javascript
this.isTouchDevice = window.matchMedia('(hover: none)').matches;
```

根据设备类型切换交互模式。

---

### 3.3 阶段 3：自动触发 + 数据完整性

#### 3.3.1 互动对话自动触发

**位置**：`js/desktop-pet.js` PetFamily 构造函数

**功能**：
```javascript
this._interactionTimer = setInterval(function () {
  if (self.display.getMode() === 'single') return;
  if (self.interaction.canTrigger()) {
    self.interaction.trigger();
  }
}, 3 * 60 * 1000); // 每 3 分钟检查
```

#### 3.3.2 距离检测

**位置**：`js/desktop-pet.js` InteractionManager.canTrigger

**功能**：
```javascript
canTrigger: function () {
  // ... 现有检查 ...
  
  // 新增：距离检测
  var pets = Object.values(this.family.display.instances);
  if (pets.length < 2) return false;
  var p1 = pets[0].el.getBoundingClientRect();
  var p2 = pets[1].el.getBoundingClientRect();
  var dist = Math.hypot(p1.left - p2.left, p1.top - p2.top);
  if (dist > 200) return false;
  
  return true;
}
```

#### 3.3.3 会话金币上限

**位置**：`js/desktop-pet.js` PetFamily 构造函数

**功能**：
```javascript
this._sessionCoins = 0;
this._sessionCoinCap = 100;
```

在 `addCoins` 中检查：
```javascript
if (this._sessionCoins + amount > this._sessionCoinCap) {
  amount = Math.max(0, this._sessionCoinCap - this._sessionCoins);
}
```

#### 3.3.4 页面加载 streak 检查

**位置**：`js/desktop-pet.js` PetFamily 构造函数

**功能**：
```javascript
this._updateStreak();
```

检查 `lastActiveDay`，跨天重置 streak。

#### 3.3.5 深夜行为

**位置**：`js/desktop-pet.js` PetFamily 构造函数

**功能**：
```javascript
// 调用已有的 _checkLateNight 方法
var resident = this.display.get(this.getResident());
if (resident) resident._checkLateNight();
```

---

### 3.4 阶段 4：页面视觉统一

#### 3.4.1 CSS 变量映射

**位置**：`css/desktop-pet.css`

**修改**：
```css
.dp-page {
  /* 旧代码 */
  --dp-page-bg: #faf6f0;
  --dp-page-card: #fff;
  --dp-page-border: #e8e0d6;
  --dp-page-text: #2a2520;
  --dp-page-muted: #6f675c;
  --dp-page-accent: #c23b2e;
  --dp-page-ok: #2e7d63;
  --dp-page-warn: #d4850a;
  
  /* 新代码 - 映射到项目 token */
  --dp-page-bg: var(--bg);
  --dp-page-card: var(--glass-2);
  --dp-page-border: var(--border);
  --dp-page-text: var(--text);
  --dp-page-muted: var(--muted);
  --dp-page-accent: var(--accent);
  --dp-page-ok: var(--ok);
  --dp-page-warn: var(--warn);
}
```

#### 3.4.2 卡片液态玻璃

**位置**：`css/desktop-pet.css`

**修改**：
```css
.dp-page-card {
  background: var(--glass-2);
  backdrop-filter: blur(18px) saturate(1.5) brightness(1.04);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  position: relative;
}

/* 顶部高光线 */
.dp-page-card::before {
  content: "";
  position: absolute;
  top: 0; left: 12px; right: 12px; height: 1px;
  background: linear-gradient(90deg, transparent, var(--border-hi), transparent);
}
```

#### 3.4.3 按钮统一

**位置**：`css/desktop-pet.css`

**修改**：
```css
.dp-page-feed-btn,
.dp-page-buy-btn {
  /* 使用项目 .btn 样式 */
  border: 1px solid var(--border);
  background: var(--glass-2);
  color: var(--text);
  padding: 7px 15px;
  border-radius: 10px;
  backdrop-filter: blur(8px);
  transition: background 0.15s, border-color 0.15s, transform 0.12s;
}

.dp-page-feed-btn:hover,
.dp-page-buy-btn:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
}
```

#### 3.4.4 进度条动画

**位置**：`css/desktop-pet.css`

**修改**：
```css
.dp-page-bar {
  height: 8px;
  background: var(--glass-sober);
  border: 1px solid var(--border);
  border-radius: 20px;
  overflow: hidden;
}

.dp-page-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--warn));
  border-radius: 20px;
  animation: barsGrow 0.65s var(--ease) both;
}

@keyframes barsGrow {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
```

#### 3.4.5 深色主题覆盖

**位置**：`css/desktop-pet.css`

**新增**：
```css
[data-theme="dark"] .dp-page {
  --dp-page-bg: var(--bg);
  --dp-page-card: var(--glass-2);
  --dp-page-border: var(--border);
  --dp-page-text: var(--text);
  --dp-page-muted: var(--muted);
  --dp-page-accent: var(--accent);
  --dp-page-ok: var(--ok);
  --dp-page-warn: var(--warn);
}
```

---

### 3.5 阶段 5：移动端适配

#### 3.5.1 安全区域适配

**位置**：`css/desktop-pet.css`

**修改**：
```css
@media (max-width: 720px) {
  .dp-page {
    padding: 12px;
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
  }
}
```

#### 3.5.2 触控尺寸

**位置**：`css/desktop-pet.css`

**修改**：
```css
.dp-page-feed-btn,
.dp-page-buy-btn,
.dp-page-mode-btn {
  min-height: 44px;
  min-width: 44px;
}
```

#### 3.5.3 字号防缩放

**位置**：`css/desktop-pet.css`

**修改**：
```css
@media (max-width: 720px) {
  .dp-page input,
  .dp-page select,
  .dp-page textarea {
    font-size: 16px; /* 防止 iOS 自动缩放 */
  }
}
```

#### 3.5.4 玩偶大小自适应

**位置**：`js/desktop-pet.js` PetFamily 构造函数

**功能**：
```javascript
var isMobile = window.innerWidth < 720;
var defaultSize = isMobile ? 64 : 84;
this.settings.desktopPet.size = this.settings.desktopPet.size || defaultSize;
```

---

### 3.6 阶段 6：测试补全 + 收尾

#### 3.6.1 新增测试项

| 类别 | 测试内容 |
|------|----------|
| 动画系统 | `_tick` 呼吸缩放、眨眼类名切换、装饰动画状态 |
| 交互系统 | 右键菜单创建/销毁、点击反应、双击喂食、长按商店 |
| 自动触发 | 定时器创建/清理、距离检测、金币上限、streak 重置 |
| 视觉回归 | CSS 类名存在性、变量映射正确性 |

#### 3.6.2 全量回归

```bash
npm test          # 641+ 测试全绿
npm run typecheck # 零问题
npm run lint      # 零问题
```

#### 3.6.3 文档更新

- CHANGELOG.md：记录所有修复
- AGENTS.md：更新基线数字
- sw.js：更新缓存版本

---

## 4. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| `_tick` 实现导致性能下降 | 低 | 限制 dt 上限 0.05s，使用 requestAnimationFrame |
| 右键菜单与浏览器默认菜单冲突 | 低 | `e.preventDefault()` 阻止默认行为 |
| 移动端长按与系统手势冲突 | 中 | 使用 `touch-action: manipulation` 避免 |
| CSS 变量映射导致深色主题异常 | 低 | 逐个测试每个变量，使用 fallback 值 |
| 新测试与旧测试冲突 | 低 | 使用独立的 describe 块，避免全局状态 |

---

## 5. 验收标准

### 5.1 功能验收

- [ ] 呼吸动画流畅，频率 3.2s，幅度 ±3%
- [ ] 眨眼每 3-5 秒随机触发，视觉可见
- [ ] 视线追踪平滑，无跳跃
- [ ] 右键菜单正常弹出，包含 4 个选项
- [ ] 点击玩偶显示随机表情和语录
- [ ] 双击喂食正常工作
- [ ] 长按商店正常工作（移动端）
- [ ] 互动对话每 3-6 分钟自动触发
- [ ] 距离 > 200px 时不触发互动
- [ ] 会话金币上限 100 生效
- [ ] 深夜（23:00-06:00）idle 状态自动切换 sleepy 表情

### 5.2 视觉验收

- [ ] 深色主题正常显示
- [ ] 卡片使用液态玻璃效果
- [ ] 按钮样式与项目一致
- [ ] 进度条有动画效果
- [ ] 圆角/阴影/间距符合项目标准

### 5.3 移动端验收

- [ ] 安全区域正确适配
- [ ] 按钮最小尺寸 44px × 44px
- [ ] 输入框不触发自动缩放
- [ ] 手势无冲突

### 5.4 质量验收

- [ ] 全量测试 641+ 绿
- [ ] typecheck 零问题
- [ ] lint 零问题
- [ ] CHANGELOG 已更新

---

## 6. 时间估算

| 阶段 | 工时 | 依赖 |
|------|------|------|
| 1. 动画系统 | 4-6h | 无 |
| 2. 交互系统 | 6-8h | 阶段 1 |
| 3. 自动触发 | 4-6h | 阶段 1 |
| 4. 页面视觉 | 4-6h | 无 |
| 5. 移动端 | 3-4h | 阶段 4 |
| 6. 测试收尾 | 3-4h | 阶段 1-5 |
| **总计** | **24-34h** | |

阶段 1-3 和阶段 4-5 可并行开发。

---

## 7. 附录

### 7.1 相关文件

- `js/desktop-pet.js` — 核心模块（~2400 行）
- `js/desktop-pet-page.js` — 独立页面（~310 行）
- `css/desktop-pet.css` — 样式（~540 行）
- `tests/desktop-pet.test.js` — 测试（~1100 行）
- `docs/desktop-pet-spec.md` — 规格文档 v2.1

### 7.2 设计 Token 参考

项目核心 CSS 变量：
- `--bg` / `--text` / `--muted` — 基础色
- `--glass-2` / `--glass-sober` — 液态玻璃
- `--border` / `--border-hi` — 边框
- `--accent` / `--ok` / `--warn` — 状态色
- `--radius` / `--shadow` / `--ease` — 布局

### 7.3 规格参考

- `docs/desktop-pet-spec.md` — 完整规格 v2.1
- `AGENTS.md` — 项目协作规则
- `CHANGELOG.md` — 变更日志
