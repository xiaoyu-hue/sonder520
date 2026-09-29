# sonder520 项目记忆（GLOBAL.md）

## 核心规则（永久记住）

### 🚨 版本一致性铁律

**打 tag 的版本必须和文档体系版本、代码版本三者完全一致**

每次发版前必须执行检查清单：

```bash
cd /var/minis/workspace/sonder520

# 1. 确认代码版本号
cat package.json | grep '"version"'

# 2. 确认文档版本号
head -20 CHANGELOG.md | grep '## \['

# 3. 确认 Git Tag 指向正确的 commit（功能提交，非纯文档提交）
git log --oneline -5
git show <tag> --no-patch

# 4. 验证 GitHub Release
curl -s -H "Authorization: token ${GITHUBTOKEN}" \
  "https://api.github.com/repos/xiaoyu-hue/sonder520/releases" | \
  grep -E '"tag_name"|"name"'
```

### 错误案例（2026-09-29 教训）

| 问题 | 后果 | 修复 |
|------|------|------|
| v3.0.0 打在错误的 commit（纯文档提交）上 | 版本历史混乱 | 删除重建，v3.0.1 指向正确 commit |
| GitHub Release 与 Git Tag 不匹配 | 发布记录错误 | 必须同时更新两者 |

### 正确的发版流程

```bash
cd /var/minis/workspace/sonder520

# 1. 跑测试和构建检查
npm test
npm run build

# 2. 确认文档已同步（见 docs/DOC_SYNC.md）

# 3. 打 tag（格式：vMAJOR.MINOR.PATCH，指向功能 commit）
git tag -a vX.Y.Z <commit-hash> -m "vX.Y.Z: 一句话摘要

## feat
- 新增 ...

## fix
- 修复 ...

## test
- 新增 N 项测试（共 X 项全绿）

## docs
- CHANGELOG/README 同步

## breaking
- 无（完全向后兼容）"

# 4. 推送（用环境变量 GITHUBTOKEN）
git remote set-url origin "https://${GITHUBTOKEN}@github.com/xiaoyu-hue/sonder520.git"
git push origin main --tags

# 5. 创建 GitHub Release（API，非 git tag）
curl -s -X POST -H "Authorization: token ${GITHUBTOKEN}" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/xiaoyu-hue/sonder520/releases" \
  -d '{
    "tag_name": "vX.Y.Z",
    "name": "vX.Y.Z — 一句话标题",
    "body": "完整 release notes（Markdown）",
    "draft": false,
    "prerelease": false
  }'
```

### 版本格式规范

| 元素 | 格式 | 示例 |
|------|------|------|
| Git Tag | `vMAJOR.MINOR.PATCH` | `v6.3.4` |
| package.json version | `vMAJOR.MINOR.PATCH` | `"version": "6.3.4"` |
| CHANGELOG 标题 | `## [vX.Y.Z]` | `## [v6.3.4]` |
| GitHub Release tag_name | 必须与 Git Tag 完全一致 | `v6.3.4` |

### 历史版本参考

```
v6.3.0 - 性能优化与代码质量
v6.3.1 - 文档同步修复
v6.3.2 - ESLint 清理
v6.3.3 - 作者文档瘦身
v6.3.4 - SECURITY.md 添加
```

---

## 用户偏好

- 零编程基础，不懂代码，但我是最终决策者
- 要求结论先用大白话讲，专业细节放后面展开
- 术语第一次出现必须括号解释
- 给方案要讲清取舍
- 遇到技术缺陷或逻辑漏洞必须先指出并给出替代方案
- 发现重复踩同一个坑时要直接提醒
- 涉及删除、覆盖、花钱、发布等不可逆操作必须先征得同意

## 项目结构

```
/var/minis/workspace/sonder520/
├── index.html              # 主应用入口
├── package.json            # 依赖配置（version: 6.3.4）
├── sw.js                   # Service Worker（PWA）
├── manifest.json           # PWA 配置
├── js/                     # 源代码目录
│   ├── app.js
│   ├── modules/
│   └── utils/
├── css/                    # 样式文件
├── tests/                  # 测试文件（75+ 个）
├── docs/                   # 文档目录
│   ├── CHANGELOG.md        # 变更日志
│   ├── README.md           # 使用说明
│   └── DOC_SYNC.md         # 文档同步规范
├── scripts/                # 构建脚本
├── assets/                 # 静态资源
└── GLOBAL.md               # 全局记忆（本文件）
```

## 技术栈

- **前端**: Vanilla JavaScript + PWA
- **测试**: Node.js + JSDOM + 自定义测试框架
- **构建**: npm scripts
- **部署**: GitHub Pages + Cloudflare Pages + Netlify 多镜像
- **版本管理**: Git + GitHub Releases API
- **包管理**: npm

## 发版工具链

- Git tag 创建：`git tag -a vX.Y.Z <commit>`
- GitHub Release：通过 REST API 创建
- 环境变量：`GITHUBTOKEN`（已配置）
- Git Author：`xiaoyu-hue <xiaoyu-hue@users.noreply.github.com>`

## 重要提醒

1. **打 tag 前必须确认 commit 指向正确**（功能提交，非纯文档提交）
2. **Git Tag ≠ GitHub Release**：两者独立，必须分别创建
3. **每个版本只打一个 tag**：不要在多个 commit 上打同一个 tag
4. **清理混乱的旧 tag**：删除前确认指向正确的 commit

## 特殊说明

- 本项目已有多份完整文档（CHANGELOG, CODE_OF_CONDUCT, CONTRIBUTING, SECURITY）
- 测试文件丰富（75+ 个测试文件）
- 支持多平台部署（GitHub Pages + CF Pages + Netlify）
- PWA 完整支持（Service Worker + Manifest）
