# 贡献指南

感谢你对 Sonder520 的关注！本文档说明如何为这个项目做出贡献。

Sonder520 是一个由 AI 辅助开发的本地优先个人生产力 Web App，作者为零编程基础的个人开发者。项目采用原生 JavaScript、零构建、零运行时依赖，核心价值观是**数据安全、克制、诚实**——所有贡献都应遵循这一原则。

---

## 行为准则

参与本项目即表示你同意遵守 [贡献者行为准则](./CODE_OF_CONDUCT.md)。请确保所有互动都尊重、包容、专业。

---

## 如何贡献

### 1. 报告 Bug

如果你发现了 bug，请通过 [GitHub Issues](https://github.com/xiaoyu-hue/sonder520/issues) 报告，并包含以下信息：

- **标题**：简洁描述问题
- **复现步骤**：一步步说明如何触发问题
- **预期行为**：你认为应该发生什么
- **实际行为**：实际发生了什么
- **环境信息**：浏览器版本、操作系统、Sonder520 版本
- **数据备份**：如涉及数据问题，请先导出备份再复现
- **截图/录屏**：如适用，请附上

### 2. 提出功能建议

欢迎通过 [GitHub Issues](https://github.com/xiaoyu-hue/sonder520/issues) 提出功能建议。请说明：

- 这个功能解决什么问题？
- 你期望的行为是什么？
- 有没有替代方案？
- 是否符合项目"个人工具"定位？（不做团队协作、云端同步等功能）

### 3. 提交 Pull Request

#### 前置检查

在提交 PR 之前，请确保：

- [ ] 你已经阅读了 [AGENTS.md](./AGENTS.md)（项目协作规则，也适用于人类贡献者）
- [ ] 你的代码通过了所有测试：`npm test`
- [ ] 你的代码通过了 lint：`npm run lint`
- [ ] 你已经为新增功能编写了测试
- [ ] 你已经更新了相关文档（README、PRD、ADR 等）
- [ ] 如涉及存储格式变更，你已经编写了迁移逻辑并测试了回滚
- [ ] 如涉及 SW 缓存变更，你已经运行了 `npm run sync-sw` 更新缓存指纹

#### PR 流程

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature-name`
3. 提交更改：`git commit -m 'feat: 添加xxx功能'`
4. 推送到分支：`git push origin feature/your-feature-name`
5. 创建 Pull Request

#### PR 描述模板

```
## 变更内容
简要说明这个 PR 做了什么。

## 变更原因
为什么需要这个变更？解决了什么问题？

## 测试说明
- [ ] 新增测试覆盖了变更内容
- [ ] 所有现有测试通过
- [ ] 手动测试了相关功能
- [ ] E2E 测试通过（如涉及 UI 变更）

## 数据安全影响
这个变更是否触及存储/加密/迁移相关代码？如果是，请说明：
- 存储格式是否变化？是否有迁移逻辑？
- 旧数据是否兼容？
- 回滚是否安全？
- 哪个测试证明数据没有丢失或损坏？

## 关联 Issue
Closes #123
```

---

## 开发环境设置

### 环境要求

- Node.js 18+
- npm 9+
- 现代浏览器（Chrome / Edge / Firefox 最新版）

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/xiaoyu-hue/sonder520.git
cd sonder520

# 安装依赖（仅开发依赖，零运行时依赖）
npm install

# 直接在浏览器打开 index.html（零构建，无需 dev server）
# 或使用任意静态服务器：
npx serve .

# 运行单元/契约/集成测试
npm test

# 运行 E2E 测试（Playwright）
npm run test:e2e

# 代码检查
npm run lint

# 同步 Service Worker 缓存指纹
npm run sync-sw

# 检查 SW 指纹是否一致（CI 门禁）
npm run sync-sw -- --check
```

### 项目结构

```
├── index.html              # 入口 HTML
├── style.css               # 主样式（水墨液态玻璃风格）
├── sw.js                   # Service Worker（PWA 离线支持）
├── src/                    # 源代码（按模块组织）
│   ├── app.js              # Application 层（路由、引导）
│   ├── framework/          # Sonder-Frame 内部框架
│   │   ├── moduleFactory.js   # 标准模块工厂
│   │   ├── visualEngine.js    # UI 渲染引擎
│   │   ├── eventBridge.js     # 跨模块事件总线
│   │   └── trustLayer.js      # 安全存储层
│   ├── modules/            # 12 个业务模块
│   └── utils/              # 工具函数
├── tests/                  # 测试（单元/契约/集成）
├── e2e/                    # E2E 测试（Playwright）
├── docs/                   # 项目文档（PRD、ADR、AUTHOR）
└── scripts/                # 构建脚本（sync-sw 等）
```

### Sonder-Frame 分层架构

依赖方向自上而下单向，禁止反向依赖：

```
Application（应用层）
    ↓
ModuleFactory（标准模块 CRUD / Schema / 状态 / 查询）
    ↓
VisualEngine + EventBridge（UI 渲染 / 跨模块事件）
    ↓
TrustLayer（Storage / Encryption / Backup / Migration / Recovery）
    ↓
IDB（Primary） + localStorage（Fallback/元数据） + Crypto
```

---

## 代码规范

### 提交信息规范

提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型（type）：**
- `feat`：新功能
- `fix`：修复 bug
- `docs`：文档变更
- `style`：代码格式（不影响功能）
- `refactor`：重构（既不修复 bug 也不添加功能）
- `perf`：性能优化
- `test`：添加或修正测试
- `chore`：构建过程或辅助工具的变动
- `adr`：架构决策记录

**示例：**
```
feat(today): 添加番茄钟暂停功能

fix(storage): 修复 IndexedDB 写入竞态导致的数据丢失

docs: 更新 README 隐私段落
```

### 分层提交原则

- **一次提交只改一层**，禁止 TrustLayer + ModuleFactory + VisualEngine + EventBridge + 迁移 + CSS 混在同一提交
- 按层拆提交，测试随后
- 提交信息必须说清：改了什么、为什么、怎么验证的

### 代码风格

- 原生 JavaScript，不引入框架或运行时依赖
- JSDoc 注释规范（eslint-plugin-jsdoc 检查）
- 函数名、变量名使用英文，语义清晰
- 避免过度设计：Specialized 不要被强行通用化
- 停止条件（满足任一即暂停加抽象，重新评估）：
  - 测试回归持续
  - 数据迁移异常
  - storage 不一致
  - 框架大量 if/else 特判
  - ModuleFactory 膨胀

### CSS 规范

- 断点白名单：仅允许 `≤360 / 720 / 900 / 960` 五带序列，禁止魔法数
- 触控目标 ≥44px
- 文本对比度 ≥4.5:1（WCAG AA）
- 16px 输入防 iOS 缩放

---

## 测试要求

### 测试纪律

- **现有测试是迁移安全网，不是旧包袱**——不得因"更干净"而大规模删除
- 旧测试验证行为则保留，仅验证废弃内部实现才可重写
- 禁止"先改测试"逃避失败；失败先判断（真 bug / 依赖旧内部实现 / 有意行为改变）
- 新增功能必须同时新增测试

### 测试分层

| 层级 | 范围 | 命令 |
|------|------|------|
| 单元测试 | 纯函数、工具类 | `npm test` |
| 契约测试 | ModuleFactory CRUD 标准接口 | `npm test` |
| 集成测试 | Factory+TrustLayer、Factory+VisualEngine、Module+EventBridge | `npm test` |
| E2E 测试 | 用户可见行为（新建→刷新→还在） | `npm run test:e2e` |

### 运行测试

```bash
# 全量单元/契约/集成测试
npm test

# 运行单个测试文件
node --test tests/your-test.test.js

# E2E 测试（需要安装 Playwright 浏览器）
npx playwright install
npm run test:e2e
```

---

## 数据安全相关贡献

Sonder520 是本地优先个人工具，**用户数据安全是最高优先级**。涉及存储/加密/迁移的贡献有额外要求：

### 数据安全红线

- **用户数据丢失 = 项目失败**
- 禁止绕过 `_storeWrite` 唯一落盘点直接写 IndexedDB
- 存储格式变更必须有迁移逻辑，且必须测试旧数据兼容
- 加密变更必须保证旧加密数据可解密，或提供明确的迁移路径
- 禁止在未加锁状态下写入加密数据，禁止在加锁状态下启用加密

### 存储写序

`_storeWrite` 锁内固定序列：
1. meta 让位检查
2. LS 相位（先写副本）
3. IDB 相位（写真源）

返回 `true`=落盘 / `false`=让位。禁止交换写序。

### 数据安全相关提交

涉及 TrustLayer / 存储 / 加密 / 迁移的提交必须在提交信息中说明：

1. 存储格式是否变化？是否有迁移逻辑？
2. 旧数据是否兼容？
3. 回滚是否安全？
4. 哪个测试证明数据没有丢失或损坏？

### SW 缓存指纹门禁

任何涉及静态资源变更的提交必须：

1. 运行 `npm run sync-sw` 更新缓存指纹
2. 运行 `npm run sync-sw -- --check` 验证一致性
3. CI 会自动检查指纹不一致，不一致则合并被阻止

---

## 文档贡献

文档和代码同样重要。欢迎贡献：

- 修正文档中的错误或过时信息
- 改进文档的清晰度和完整性
- 添加使用示例和教程
- 翻译文档（中英文对照）
- 新增 ADR（架构决策记录）

文档变更同样需要提交 PR，并通过审查。

---

## 常见问题

### Q: 我可以添加新的运行时依赖吗？

A: **不可以**。项目坚持零运行时依赖原则。所有功能必须用浏览器原生 API 实现。如需引入开发依赖（测试、lint 工具等），请先在 Issue 中讨论。

### Q: 我可以重写某个模块吗？

A: **禁止 Big Bang Rewrite**。只允许"旧系统 + 新框架 → 迁移一个模块 → 全量测试 → 下一个"。任一阶段测试失败即停止。大规模重构请先在 Issue 中讨论方案。

### Q: 我的 PR 多久会被审查？

A: 这是个人项目，维护者时间有限。通常会在一周内回复，但不保证时间。请耐心等待。

### Q:  Sonder520 会做云端同步或团队协作吗？

A: 不会。项目定位是"个人工具、本地优先"，不做云端同步、团队协作、账号体系等功能。这是产品定位的刻意选择，不是技术限制。

---

## 致谢

感谢所有为 Sonder520 做出贡献的人。你的每一个 Issue、每一个 PR、每一次测试都在让这个项目变得更好。

特别感谢：
- 所有开源项目的贡献者（Sonder520 零运行时依赖，但开发工具链站在开源社区的肩膀上）
- 所有测试并反馈 Bug 的用户
- AI 辅助开发工具（项目由 AI 辅助开发，但所有方向决策由人类作者把控）

---

*Sonder520 — 每个人都是自己的主角，Sonder520 是主角的工具。*
