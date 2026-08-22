# Sonder 三端适配与质量大优化 · 设计文档

**日期**：2026-08-22
**版本**：v1.0
**状态**：待实施

---

## 1. 背景

### 1.1 当前基线

695 tests 全绿 / v71 缓存 / ADR-014 Phase④ 已落地。三端定义（用户确认）：**手机（361–720px）/ 平板（721–960px）/ 桌面（>960px）**，按视口宽度划分。

### 1.2 现状审计事实（file:line 为证）

**断点混乱**：
- 断点值集合 `{360, 639, 640, 720, 721–960, 900×480, 1000}` 全部为字面量魔法数，无 token/注释契约
- 网格降列用 `1000/640`（style.css:242/243/458/468），导航壳层用 `720`（style.css:912），desktop-pet 用 `639`（desktop-pet.css:612）——内容与壳层断点不成序列

**七模块零移动打磨**：home/memo/dev/consulting/news/design/settings 无任何模块级移动样式或触屏交互（仅依赖全局 grid 降列）

**移动端自动化为零**：
- playwright.config.js 仅 chromium 单 project、1280×800 桌面视口
- tests/mobile.test.js 与 responsive.test.js 均为 CSS 文本静态字符串断言，非真实渲染验证

**触控债**：
- `.btn` 实际高度约 32px（style.css:413-418）、`.small-btn` 更小——未达 44px 触控规范；手机带内仅底栏 nav（style.css:931）达标
- ≤360px 时 `.hbar` 输入降回 15px（style.css:975），违反 16px 防缩放规范
- safe-area 仅覆盖底部 4 处，顶部（刘海屏 PWA standalone）未处理
- 真机记录「长按插旗 iPhone 偶发误触」（device-acceptance.md:84）

### 1.3 目标

1. 断点体系统一为五带序列并建立防回潮契约
2. 七模块补齐手机/平板布局可用性
3. 触控目标、输入防缩放、顶部安全区达规范
4. 建立「桌面/手机/平板」三端 Playwright 验证矩阵
5. 自动化验收 + 用户真机抽检闭环

---

## 2. 范围

**包含**：断点统一 / 七模块移动适配 / 触控与安全区质量 / 三端自动化矩阵 / 文档同步 / 真机抽检轮。

**排除（YAGNI）**：
- ⑤ 事件委托性能收敛（五子棋 225 格逐格绑定、扫雷每格 6 监听）——游戏属 Specialized 模块回归风险最高，本次不动，留待独立批次
- 虚拟滚动/lazy render（<5000 条记录场景不需要）
- sessionStorage 密码驻留改造（已有风险注记，另行评估）
- 任何 store.js/storage key/schema/加密/迁移改动

---

## 3. 设计

### 3.1 断点体系（P1）

目标五带序列，写入 style.css 头部注释契约：

| 带 | 范围 | 语义 |
|---|---|---|
| 超小屏 | ≤360px | 紧凑布局 |
| 手机 | 361–720px | 底栏导航 / 底部抽屉 / 44px 触控 / 16px 输入 |
| 平板 | 721–960px | 侧栏折叠 70px 图标栏 + 网格降两列 |
| 桌面 | 961–1240px | 完整多列 |
| 宽屏 | >1240px | 限宽居中 |

收敛映射：

| 位置 | 现值 | 新值 |
|---|---|---|
| style.css:242（网格降两列） | `max-width: 1000px` | `max-width: 960px` |
| style.css:243（网格单列） | `max-width: 640px` | `max-width: 720px` |
| style.css:458（st-row 单列） | `max-width: 640px` | `max-width: 720px` |
| style.css:468（rd-grid 单列） | `max-width: 640px` | `max-width: 720px` |
| desktop-pet.css:612 | `max-width: 639px` | `max-width: 720px` |

保留：超小屏 360（style.css:968）、横屏 900×480（style.css:979）、reduced-motion/hover 查询不变。主移动块必须保持文件末尾位置（style.css:901-911 注释要求，有测试守护）。

**已知视觉影响（诚实声明）**：641–720px 带网格由两列变单列；961–1000px 带提前进入完整多列——与壳层断点对齐的必然结果，属有意行为变更。

**防回潮契约**：tests/responsive.test.js 升级为断点集合契约——解析 css/*.css 全部 @media 值，断言 ⊆ 允许集合 `{360, 720, 960, 1240, 900×480 组合}`，新增魔法数即红。

### 3.2 触控与安全区质量（P3）

- **44px 触控目标**：手机带内 `.btn`/`.small-btn`/卡片操作按钮以 padding/min-height 扩展至 ≥44px 高度；不改桌面视觉；横屏维持现有 38px 降档（style.css:983）
- **16px 违规修复**：删除 style.css:975 的 15px 回退，超小屏输入保持 16px，空间靠收窄输入框宽度解决
- **顶部 safe-area**：顶栏（.hbar）增加 `padding-top: env(safe-area-inset-top)` 兼容写法，修复 PWA standalone 刘海遮挡
- **长按插旗偶发误触**：不凭空承诺修法——P5 真机轮先复现取证（怀疑 iOS pointercancel 合成路径）；有证据才改 games-mini.js 长按逻辑，修复后真机回归确认。此项允许「本轮记录、下轮修复」的诚实结局

### 3.3 七模块移动适配（P4）

统一模式清单，禁止自由发挥：

1. 操作行（按钮组）窄屏 wrap + 主次按钮等宽排列
2. 多列信息块 → 单列堆叠，标签值成对展示
3. 表单字段窄屏单列；弹窗内容窄屏不出屏（全局已是底部抽屉，验证各模块表单字段即可）
4. 卡片内边距/字号降档只用既有设计 token（墨色/宣纸/液态玻璃），不创造第二套视觉语言

执行顺序按访问频率：home → memo → dev → consulting → news → design → settings。**每模块独立提交**：改 → 移动视口冒烟 + npm test 全绿 → 下一个。today/selfmedia/games/desktop-pet 已有适配不重做，仅在断点收敛受影响处回归确认。

### 3.4 三端自动化验证矩阵（P2）

playwright.config.js 由单 project 扩为三个：

| project | 引擎 | 视口 | 标志 |
|---|---|---|---|
| desktop-chromium | chromium | 1280×800 | 现状不动 |
| mobile-ios | webkit | 375×667 | isMobile + hasTouch（最接近 iOS Safari 的免费选项） |
| tablet-ipad | webkit | 768×1024 | hasTouch |

- 现有 5 条冒烟（e2e/smoke.spec.js）在三 project 下跑通，差异记录为基线（此阶段不强求移动端全绿，失败项转为 P3/P4 工作项或已知限制记录）
- 新增 e2e/responsive.spec.js：三端视口断言——无横向溢出滚动（棋盘等容器内滚动除外）、底栏/侧栏可见可点、弹窗不出屏
- 无新 devDependency（@playwright/test 已有；需一次性 `npx playwright install webkit` 安装浏览器二进制）

### 3.5 收尾（P5）

1. 文档数字同步：README/PRD/CHANGELOG/device-acceptance.md（测试基线、缓存版本、断点说明）
2. device-acceptance.md 清单更新：补平板带抽检项、44px 抽检项、顶部 safe-area 项
3. `npm run sync-sw` 同步 SW 指纹升版
4. **真机抽检轮**：用户本人按更新后清单在 iPhone/Android 各过一遍；发现问题回流为修复项，含长按插旗取证

---

## 4. 数据安全边界

零数据层改动：不碰 store.js、storage key、schemaVersion、迁移、加密、跨标签协议。改动面 = css/style.css + css/desktop-pet.css + 7 个页面 js 的渲染模板 + playwright.config.js + e2e/ + tests/。SW 缓存版本随内容变更由 sync-sw 处理，部署走既有 CF Pages/GH Pages 流程。

## 5. 阶段门禁

P1→P2→P3→P4→P5 顺序执行（P2 先于 P3/P4，让后续每步改动都被三端视口验证）。每阶段完成条件：`npm test` 全绿 + `npm run typecheck` 0 错 + `npm run lint` 0 问题 + 该阶段专项验证通过。任一阶段测试失败即停止排查，禁止带病前进。提交按 AGENTS.md 分层纪律：一次提交只做一件事（断点收敛 / 单模块适配 / 单项触控修复）。

## 6. 测试策略

| 层 | 手段 |
|---|---|
| 断点契约 | responsive.test.js 升级：@media 值集合白名单断言（防魔法数回潮） |
| 移动规则存在性 | mobile.test.js 保留静态审计价值：44px/16px/safe-area 关键规则存在性断言 |
| 渲染行为 | e2e/responsive.spec.js 三端视口真实渲染断言 |
| 回归网 | 既有 695 项全量 + 每阶段新增回归 |
| 真机 | device-acceptance.md 更新版抽检 |

## 7. 验收标准（DoD）

1. `npm test` 全绿（基线 695 → 新增后全绿，数字同步进文档）
2. typecheck/lint 0
3. `npm run test:e2e` 三 project 全绿（基线差异项全部闭环或有记录在案的结论）
4. 断点契约生效：全仓 @media 值 ⊆ 白名单集合
5. 七模块在 375/768/1280 视口冒烟通过
6. 用户真机轮完成，问题回流处理完毕（或明确记入下轮）

## 8. 风险与回滚

| 风险 | 缓解 |
|---|---|
| 断点收敛改变中间带宽观感 | 已声明为有意变更；真机轮复核；单提交可回滚 |
| webkit 引擎本地环境差异 | 冒烟基线先跑通再动 UI；CI 不强依赖 webkit（可标 allow-fail 观察） |
| 七模块适配引入 XSS 面 | 模板改动沿用 textContent/既有 esc 管线，innerhtml 白名单测试自动把关 |
| 长按误触无法稳定复现 | 诚实记录，不强修；防护性加固仅在有证据时进行 |

每阶段独立提交，任一阶段出问题 `git revert` 对应提交即可，不影响数据层。
