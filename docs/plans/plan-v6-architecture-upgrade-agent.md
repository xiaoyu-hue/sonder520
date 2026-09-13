Sonder520 v6.x 架构升级

AI Agent 执行设计方案

0. 任务性质

你正在维护一个已经成熟运行的本地优先个人工作/生活管理 Web 应用 Sonder520。

当前项目已经拥有：

- ModuleFactory
- EventBus / EventBridge
- IndexedDB 主存储
- localStorage 副本 / fallback / 跨标签信号
- 可选加密
- PWA
- Service Worker
- 多个业务模块
- 大量自动化测试
- E2E 测试
- Sonder-Frame 架构设计

本次任务不是重写项目。

本次任务是：

«在不破坏现有功能、数据、测试和用户行为的前提下，逐步将 Sonder520 从“Store 中心化架构”演进为清晰的 Application / Domain / Repository / Infrastructure 架构。»

---

1. 核心原则

必须遵守以下原则。

原则 1：禁止大爆炸式重构

禁止一次性：

- 重写 store.js
- 重写整个 persistence
- 重写所有业务模块
- 重写 ModuleFactory
- 重写 EventBus
- 重写 encryption
- 重写 UI
- 重写全部测试

必须渐进式迁移。

---

原则 2：保持行为不变

架构重构期间：

- 功能行为不能无故改变
- 数据结构不能无故改变
- IndexedDB 语义不能改变
- localStorage fallback 语义不能改变
- 加密行为不能改变
- Undo 行为不能改变
- Import/Export 行为不能改变
- Event 行为不能无故改变
- UI 行为不能无故改变

原则：

«Preserve behavior, change boundaries.»

---

原则 3：现有测试是安全网

禁止因为架构调整而简单删除测试。

禁止为了让测试通过而修改测试去适应错误实现。

如果测试失败：

1. 判断是实现回归还是测试需要迁移。
2. 优先修复实现。
3. 如果确实是架构边界变化导致测试需要调整，必须说明原因。
4. 原有行为仍然必须被覆盖。

---

原则 4：不要为了架构而架构

不要创建没有实际职责的：

Manager
Service
Controller
Factory
Adapter
Domain
Helper

如果一个文件只是在转发函数，没有实际价值，不要为了形式创建它。

---

2. 产品与技术事实

必须先确认当前真实代码。

不要根据 README 猜实现。

当前 README 表明 Sonder520 使用：

Application
```
 ↓
```
ModuleFactory
```
 ↓
```
VisualEngine + EventBridge
```
 ↓
```
TrustLayer
```
 ↓
```
IndexedDB + localStorage + Crypto

但 Agent 必须以实际代码为准。

README 只是架构意图。

代码才是当前事实。

---

3. 第一阶段：只分析，不修改代码

这是整个任务的第一阶段。

禁止修改任何源码。

必须先完成：

Current Architecture Audit

至少分析：

js/store.js
js/framework/ModuleFactory.js
js/event-bus.js
js/encryption.js
js/store-*.js
js/error-guard.js
js/app.js
js/ui.js
js/today.js
js/memo.js
js/reading.js
js/settings.js
js/games*.js
tests/
e2e/
PRD.md
AGENTS.md

并根据实际依赖继续追踪相关文件。

---

4. 第一阶段必须输出的内容

输出：

4.1 当前架构图

例如：

UI
```
 ↓
```
?
```
 ↓
```
store
```
 ↓
```
?
```
 ↓
```
IndexedDB

必须根据真实代码填写。

---

4.2 Store 职责地图

列出 store.js 当前所有主要职责。

格式：

职责
 ├── 状态管理
 ├── Collection Registry
 ├── IndexedDB
 ├── localStorage
 ├── Encryption
 ├── Migration
 ├── Undo
 ├── Import/Export
 ├── Events
```
 └── ...
```

每一项必须指出：

- 代码位置
- 被谁调用
- 调用了谁
- 是否适合迁移
- 风险等级

---

5. Repository 候选分析

识别哪些数据集合最适合首先引入 Repository。

重点分析：

tasks
memos
books
reading
settings

以及其他实际存在的 collection。

不要默认全部创建 Repository。

请根据：

- 使用频率
- 业务复杂度
- Store 耦合程度
- 测试覆盖
- 数据访问模式

进行排序。

输出：

优先级
Repository
原因
风险
迁移难度

---

6. Application 层候选分析

识别真正有业务意义的 Use Case。

例如：

CreateTask
CompleteTask
UpdateTask
DeleteTask
MoveTask
ArchiveMemo
AddBook
FinishReading

不要机械地把每个函数都变成 Application Service。

只有用户行为或明确业务操作才需要。

---

7. Domain 候选分析

寻找真实业务规则。

例如：

Task completion
Task priority
Task ordering
Reading progress
Book state
Memo archive

只有存在明确业务规则才创建 Domain。

禁止创建空壳 Domain。

---

8. ModuleFactory 保护规则

ModuleFactory 是项目中已经比较成熟的标准化模块基础设施。

必须：

- 保持其现有能力
- 保持 CRUD 行为
- 保持字段验证
- 保持排序
- 保持事件
- 保持 undo
- 保持已有契约测试

除非发现明确 bug，否则本次架构升级不要重写 ModuleFactory。

---

9. Persistence 保护规则

必须明确：

IndexedDB = primary source of truth
localStorage = backup / fallback / cross-tab signaling

具体语义必须以当前真实实现为准。

禁止因为引入 Repository：

- 改变 IDB 主次关系
- 删除 localStorage fallback
- 改变已有 migration
- 改变数据 schema
- 改变 encryption 行为

---

10. 第一刀：Repository Facade

第一阶段分析完成并获得批准后：

优先创建一个低风险 Repository。

推荐：

TaskRepository

但如果代码审计认为其他 collection 更适合，可以选择更合适的一个。

第一版 Repository 可以内部继续调用旧 Store。

例如：

Application
```
     ↓
```
TaskRepository
```
     ↓
```
Store
```
     ↓
```
IndexedDB

这一步的目标不是马上消灭 Store。

目标是：

«先建立稳定的数据访问边界。»

---

11. Repository 第一版要求

Repository 只负责数据访问。

例如：

get(id)
getAll()
create(data)
update(id, data)
remove(id)

不要把 UI 逻辑放进去。

不要把页面状态放进去。

不要把 Toast 放进去。

不要把 DOM 操作放进去。

不要把业务页面逻辑放进去。

---

12. 第二刀：Application Use Case

Repository 稳定后，再建立 Application 层。

例如：

application/tasks/complete-task.js

逻辑：

UI
```
 ↓
```
CompleteTask
```
 ↓
```
TaskRepository
```
 ↓
```
Store

CompleteTask 负责：

- 参数验证
- 找到任务
- 调用业务规则
- 保存
- 发布必要事件

不负责：

- DOM
- IndexedDB API
- localStorage API
- CSS
- 页面渲染

---

13. 第三刀：逐步迁移页面

例如：

today.js

原来：

today.js
```
 ↓
```
store.update(...)

逐步改为：

today.js
```
 ↓
```
CompleteTask.execute(...)

一次只迁移一个行为。

不要一次重写整个页面。

---

14. 第四刀：拆 Store

当 Repository 已经覆盖足够多的业务后，再拆 Store。

目标类似：

store/
    store-core.js
    collection-registry.js
    migration.js
    undo.js
    import-export.js

拆分依据必须是：

«职责边界。»

不是：

«每 100 行拆一个文件。»

---

15. Store 最终定位

最终 Store 不应该继续承担整个应用的大部分业务。

目标：

Application
```
 ↓
```
Repository
```
 ↓
```
Persistence

Store 可以作为：

- 状态协调
- Collection registry
- 兼容层
- 过渡层

存在。

最终根据实际迁移情况逐渐降低其中心地位。

---

16. Domain 层迁移规则

不要过早引入复杂 Domain。

只提取明确规则。

例如：

Task

可以提供：

complete()
reopen()
changePriority()

但是：

TaskDomainManagerFactoryService

这类没有明确价值的抽象禁止创建。

---

17. EventBus 规则

EventBus 是跨模块通信基础设施。

不得因为 Repository/Application 引入而随意增加大量事件。

每个新事件必须明确：

事件名称
触发者
payload
消费者
生命周期

禁止：

万能事件
万能 payload

---

18. 测试策略

每完成一个迁移步骤：

必须执行项目现有测试命令。

至少根据 package.json 实际存在的脚本运行：

npm test
npm run typecheck
npm run lint
npm run test:e2e

如果某个命令不存在，不要自行假设。

以 package.json 为准。

---

19. 必须增加的架构测试

随着迁移进行，应逐渐增加：

Repository Tests

验证：

get
getAll
create
update
delete

Application Tests

验证：

CompleteTask
CreateTask
DeleteTask

Boundary Tests

验证：

UI 不直接依赖 Persistence
Application 不直接调用 IndexedDB
Domain 不依赖 DOM
Repository 不依赖 UI

---

20. 不允许修改测试来掩盖架构问题

例如：

错误做法：

测试失败
```
 ↓
```
修改测试预期
```
 ↓
```
测试通过

正确：

测试失败
```
 ↓
```
分析原因
```
 ↓
```
确认是否行为改变
```
 ↓
```
修复实现
```
 ↓
```
重新测试

---

21. 迁移完成标准

不能只看：

代码能运行

必须满足：

功能

现有功能正常。

数据

现有数据可以正常读取。

存储

IndexedDB 语义保持。

兼容

旧数据正常。

加密

现有加密功能正常。

测试

原有测试保持通过或经过合理迁移。

架构

新增业务不需要继续把大量代码塞进 store.js。

---

22. 最终目标架构

最终可以演进到：

                     UI
```
                      │
                      ▼
```
               Application
```
                      │
                      ▼
```
                   Domain
```
                      │
                      ▼
```
                Repository
```
                      │
                      ▼
```
               Persistence
```
                 ↙        ↘
```
            IndexedDB   localStorage
```
                      │
```
                   Crypto

同时：

ModuleFactory
```
        │
        ▼
```
      Module
```
        │
        ▼
```
       UI

以及：

EventBus / EventBridge
```
        │
```
        ├── Application
        ├── Module
        ├── Store
```
        └── UI
```

---

23. Sonder-Frame 的最终定位

不要删除 Sonder-Frame。

将其逐步落实为：

Sonder-Frame
```
│
```
├── Application
```
│
```
├── Domain
```
│
```
├── ModuleFactory
```
│
```
├── EventBridge
```
│
```
├── Repository
```
│
```
├── TrustLayer
```
│
└── Persistence
```

其中：

Application

解决：

«用户想做什么？»

Domain

解决：

«业务规则是什么？»

ModuleFactory

解决：

«模块如何标准化？»

EventBridge

解决：

«模块如何通信？»

Repository

解决：

«数据如何被业务访问？»

TrustLayer

解决：

«数据如何可信、安全地保存？»

Persistence

解决：

«数据最终如何进入浏览器存储？»

---

24. 强制禁止事项

整个任务过程中禁止：

1. 一次性重写 store.js。
2. 一次性重写所有业务模块。
3. 删除已有测试。
4. 为了通过测试修改正确行为。
5. 无理由修改数据库 schema。
6. 无理由修改数据结构。
7. 无理由修改加密协议。
8. 重写 ModuleFactory。
9. 重写整个 EventBus。
10. 创建大量空壳 Service/Manager/Factory。
11. 引入大型第三方框架。
12. 把 Sonder520 改造成企业级复杂 DDD。
13. 在没有分析现有代码前自行决定最终目录。
14. 根据 README 猜测代码行为。
15. 因为“新架构更漂亮”而删除旧的可靠实现。

---

25. 每个阶段结束必须汇报

每完成一个阶段，必须输出：

【阶段】
Phase X

【目标】
本阶段解决什么问题

【修改文件】
列出全部修改文件

【新增文件】
列出全部新增文件

【删除文件】
如无则明确写“无”

【架构变化】
修改前：
```
A → B → C
```

修改后：
```
A → Repository → B → C
```

【兼容性】
是否保持原行为

【测试】
test：
typecheck：
lint：
e2e：

【风险】
当前剩余风险

【下一步】
下一阶段建议

---

26. 最重要的执行规则

第一次执行时：

只分析，不写代码。

第一阶段必须先产生：

«"Sonder520 Current Architecture Audit"»

然后停止。

不要自动进入重构。

等架构审计结果确认以后，再开始 Phase 1。

---

27. 最终成功标准

本项目不是为了：

文件数量增加

也不是为了：

目录看起来高级

真正成功的标准是：

新功能可以这样开发：

用户需求
```
 ↓
```
Application Use Case
```
 ↓
```
Domain Rule
```
 ↓
```
Repository
```
 ↓
```
Persistence

而不是：

用户需求
```
 ↓
```
找到一个不知道该放哪里的文件
```
 ↓
```
继续修改 store.js
```
 ↓
```
顺便修改几个全局状态
```
 ↓
```
不知道影响了什么

最终目标：

«让 Sonder520 在继续增长时，不再依赖一个越来越庞大的 store.js，而是拥有清晰、可理解、可测试、可持续演进的架构边界。»
