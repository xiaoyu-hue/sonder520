# Sonder · 个人工作生活 App

> **English**: This is a privacy-first personal productivity web app (pure HTML/CSS/vanilla JS, no build tools, no backend). All data stays in your browser. Live sites and full English docs: [README.en.md](README.en.md)

个人工作/生活管理工具，纯 HTML/CSS/原生 JS，零构建、零依赖。

「水墨 × 液态玻璃」视觉风格，支持自定义壁纸上传与透明度调节。

六款小游戏、番茄专注、可选加密、离线可用、全局搜索，数据 100% 留在本地浏览器。

## 在线访问

- 主站 1：https://sonder520.netlify.app/
备注:主站1因为部署次数的限制 没有更新新版本 请移步主站2和备用站
- 主站 2：https://sonder520.pages.dev/

- 备用站：https://xiaoyu-hue.github.io/sonder520/

三个站点内容同步更新，任选一个打开即可。

> 数据存于各设备浏览器 localStorage，设备间相互独立；多设备数据迁移请用「数据与设置 → 导出备份 / 导入恢复」。

## 免责声明！！！

本项目遵循 MIT 许可证，允许自由使用、修改和分发，但须保留版权和许可声明，且不提供任何担保。详情请查阅仓库中的 LICENSE 文件。

## 开源

源码公开于 GitHub：https://github.com/xiaoyu-hue/sonder520

（公开仓库，无需登录即可浏览）

- 纯前端项目，任何访客在浏览器 DevTools 中也可见完整源码，属"天然开源"。

- 数据安全不受影响：数据仅存于访问者各自浏览器，不会经过任何服务器；可选启用加密存储（PBKDF2 + AES-GCM-256）。

## 功能

- 首页总览：问候语 + 每日金句、完成率环形进度条、今日摘要、快速备忘、各模块概览卡片

- 今日计划：四档优先级、🍅 专注 25 分钟倒计时（到时浏览器通知）、增删改/勾选/排序/分组

- 快速备忘：即点即存、历史、归档

- 自媒体：选题、月历视图拖拽排期、发布渠道（公众号/小红书/B 站/抖音）、阅读量/点赞与最近 5 篇折线图、导出 CSV

- 开发工作：项目、任务清单、进度自动统计、技术笔记（Markdown 渲染 + 代码一键复制）

- 咨询工作：客户档案、项目、跟进记录、收入记录

- 阅读计划：书单、状态、阅读计时（分钟）、「我的书摘」页（按书分组）、进度

- 看新闻计划：资讯收藏、待读/已读/收藏、跳转链接

- 设计计划：灵感收集 + 设计项目与阶段

- 娱乐游戏：井字棋 / 五子棋（AI 对决三档难度与双人对弈、悔棋、认输、自动战绩）+ 猜数字 / 扫雷 / 猜成语 / 脑筋急转弯（战绩并入对战记录）

- 数据与设置：主题（跟随系统可覆盖）、壁纸上传与透明度、动画帧率（60/90/120）、模块开关、统计、导出/导入备份、加密开关、本周报告一键复制、桌面通知、迁移至 IndexedDB

- 可靠性：PWA 离线可用、存储双写双存（localStorage + IndexedDB + 可选加密）、存储超 4.5MB 顶部警示条、全局搜索、全模块 XSS 净化

## 视觉与交互

- 水墨 × 液态玻璃：宣纸/墨黑双主题背景（默认跟随系统）、磨砂玻璃卡片（backdrop-filter + 高光内边）、朱砂红强调、国画颜料色系图表。

- 自定义壁纸：设置页上传背景图（≤2MB），可调透明度（0–100%，默认 40%，实时预览并持久化），可恢复默认。

- 微动态：页面淡入错峰、图表墨液蔓延生长、按钮按压反馈、空状态呼吸、Toast 滑入、弹窗底部抽屉（手机端）。

## 全平台适配

| 设备 | 布局 |
| --- | --- |
| 电脑（>960px） | 左侧液态玻璃侧栏 + 多列网格；>1240px 内容限宽居中 |
| 平板（721–960px） | 侧栏折叠为 70px 图标栏 |
| 手机竖屏（≤720px） | 底部液态玻璃导航栏（图标横排、可滑动） |
| 超小屏（≤360px） | 压缩留白，导航不挤爆 |
| 手机横屏 | 顶栏与导航自动变矮 |

- iOS/安卓：viewport-fit=cover、刘海屏/手势条安全区（env(safe-area-inset-bottom)）、100vh→100dvh 高度回退、触控目标 ≥44px、输入控件 16px 防聚焦缩放。

- 支持「添加到主屏幕」作为 App 图标打开，离线可用。

- 尊重系统 prefers-reduced-motion（减弱动效）。

## 如何运行（本地）

直接用浏览器打开（双击） index.html 即可。推荐 Chrome / Edge。

- 数据保存在浏览器本地存储（localStorage + IndexedDB），刷新、关闭标签、关闭并重启浏览器都不丢失。

- 重要数据请定期在「数据与设置 → 导出备份」下载 JSON 文件保存；需要高级隐私保护可在设置中启用加密存储。

## 如何更新已部署的站点

每次改完代码后，任选其一：

1. 网页拖拽（推荐）：登录 https://app.netlify.com → 打开站点 sonder520 → Deploys（部署记录）页 → 把本目录整个文件夹拖入 Drag and drop deploy area here → 等出现 Published 即可（网址不变）。

   ⚠️ 不要用 app.netlify.com/drop 重复上传——Drop 每次会新建一个新站点。

2. 命令行：npm i -g netlify-cli → netlify login → netlify link → netlify deploy --prod --dir=.

3. Git 自动部署：推到 GitHub 仓库后在 Netlify 里连接该仓库，之后 git push 自动上线。

也可以部署到其他静态托管（全部资源为相对路径，无需构建）：GitHub Pages、Cloudflare Pages、Vercel。

## 开发者

依赖与说明：

- 应用为纯 HTML/CSS/原生 JS，构建/运行零依赖，不需要 npm 安装即可使用。

- 运行全部测试：npm test（当前 213 项全部通过，覆盖存储/加密/UI/各模块/样式/动效/壁纸/移动端自动适配/性能/游戏引擎/交互质量回归/PWA/搜索/XSS 净化/IndexedDB/通知）。

- 类型检查（零构建）：npm run typecheck（JSDoc + tsc --noEmit）。

## 文档

- 产品需求：见 PRD.md（含版本历史、视觉设计、数据与操作、验收标准与技术架构说明）。
