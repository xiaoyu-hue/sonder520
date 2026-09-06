# sonder520 文档目录

本文件夹收纳 sonder520 的全部项目文档。根目录仅保留 GitHub 约定文件（README、LICENSE、CHANGELOG、CODE_OF_CONDUCT、AGENTS.md），其余文档统一放在这里。

## 核心文档

| 文档 | 说明 |
| --- | --- |
| [PRD.md](./PRD.md) | 产品需求文档（含版本历史、视觉设计、数据规范、验收标准） |
| [AUTHOR.md](./AUTHOR.md) | 关于作者（中文） |
| [AUTHOR.en.md](./AUTHOR.en.md) | 关于作者（英文） |

## 架构决策记录（adr/）

14 份 ADR + 索引，记录项目重大技术决策的来龙去脉，入口见 [adr/README.md](./adr/README.md)。

## 迁移与改进计划（plans/）

| 文档 | 说明 |
| --- | --- |
| [plan-memo-migration.md](./plans/plan-memo-migration.md) | 试点迁移：快速备忘（memo）迁入标准模块工厂 |
| [plan-framework-review.md](./plans/plan-framework-review.md) | 试点复盘：memo + today 迁移后评估 |
| [plan-dev-migration.md](./plans/plan-dev-migration.md) | dev 迁移（试点三） |
| [plan-news-migration.md](./plans/plan-news-migration.md) | news 迁移（试点 4） |
| [plan-selfmedia-migration.md](./plans/plan-selfmedia-migration.md) | selfmedia 迁移（试点 5，最大模块压测） |
| [plan-consulting-migration.md](./plans/plan-consulting-migration.md) | consulting 迁移（试点 6，嵌套边界压测） |
| [plan-reading-migration.md](./plans/plan-reading-migration.md) | reading 迁移（试点 7，计时/书摘边界压测） |
| [plan-design-migration.md](./plans/plan-design-migration.md) | design 迁移（试点 8，Phase 7 收官） |
| [plan-storage-key-granularity.md](./plans/plan-storage-key-granularity.md) | storageKey 粒度持久化方案（ADR-009 决策 7 落地） |
| [plan-offline-indicator.md](./plans/plan-offline-indicator.md) | 离线状态指示器方案 |
| [improvement-plan.md](./plans/improvement-plan.md) | Sonder 项目改进计划 |

## 规格与验收（specs/）

| 文档 | 说明 |
| --- | --- |
| [desktop-pet-spec.md](./specs/desktop-pet-spec.md) | 小莫灵家族（桌面玩偶养成系统）实现规格 v2.1 |
| [device-acceptance.md](./specs/device-acceptance.md) | 真机验收清单 |

## 历史会话档案（superpowers/）

AI Agent 协作过程中的历史计划与设计文档存档，保持原样不改动。

---

**维护约定：** 新增文档请按类别放入对应子文件夹（决策 → adr/，方案 → plans/，规格 → specs/），并在本索引补一行。
