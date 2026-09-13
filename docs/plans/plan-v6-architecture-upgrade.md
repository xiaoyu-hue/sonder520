Sonder520 v6.x 架构升级设计方案

## 一、先用一句话理解这次升级

不是给 Sonder520 增加更多功能，而是把现在已经很强、但有些挤在一起的代码，重新整理成一个真正清晰的应用架构。

你现在的 Sonder520 已经不是“简单网页”。

它已经有：

- 任务
- 备忘
- 阅读
- 自媒体
- 开发
- 咨询
- 设计
- 游戏
- 数据统计
- 设置
- IndexedDB
- localStorage
- 加密
- Service Worker
- PWA
- EventBus
- ModuleFactory
- 大量测试

官方仓库目前也已经把 Sonder-Frame 描述成：

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

所以现在真正的问题不是“功能少”。

而是：

«这么多东西已经存在，但它们之间的职责边界还不够清楚。»

这就是 v6.x 架构升级真正要解决的问题。

---

## 二、你现在最需要解决的核心问题

可以把现在的架构想成：

                  Sonder520
```
                      │
                      ▼
```
                   store.js
```
                ↙    ↓    ↘
```
          数据     存储     业务
```
           ↓        ↓        ↓
```
         Task     IDB      Undo
         Memo     LS       Events
         Book     Crypto   Migration
         Game    Backup    Import
         ...

最大的问题是：

"store.js" 太聪明了。

它现在承担了太多事情。

它既像：

- 数据 Store
- Repository
- IndexedDB 管理器
- localStorage 管理器
- 加密入口
- 数据迁移器
- Import/Export
- Undo
- Event 管理
- Recovery
- Collection Registry

所以以后你每增加一个能力，都很容易继续往 "store.js" 里面塞。

最终就会变成：

store.js
```
  ↓
```
什么都知道
```
  ↓
```
什么都能调用
```
  ↓
```
什么都不能轻易修改

这才是 Sonder520 当前最值得解决的架构问题。

---

## 三、我们要把它变成什么样？

目标不是复杂企业架构。

你完全不需要搞：

- 微服务
- CQRS
- Event Sourcing
- Domain-Driven Design 全家桶
- 复杂依赖注入
- 十几层抽象

Sonder520 是一个个人本地应用。

最适合你的其实是：

“轻量 Application + Domain + Repository + Infrastructure”

最终理解成：

```
┌─────────────────────────────┐
│             UI              │
│       页面 / 交互 / 渲染      │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│         Application         │
│      “我要完成什么事情”       │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│           Domain            │
│       “业务规则是什么”        │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│        Repository           │
│       “我要怎么拿数据”        │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│       Infrastructure        │
│ IDB / localStorage / Crypto │
└─────────────────────────────┘
```

你只需要记住四句话：

UI

“用户点了什么？”

Application

“这个操作要完成什么事情？”

Domain

“这个事情有什么规则？”

Repository

“数据从哪里拿、保存到哪里？”

Infrastructure

“真正怎么和浏览器打交道？”

---

## 四、举一个你马上能理解的例子

假设用户点击：

«完成任务»

现在可能是：

按钮
```
 ↓
```
today.js
```
 ↓
```
store
```
 ↓
```
修改任务
```
 ↓
```
保存 IDB
```
 ↓
```
触发事件
```
 ↓
```
UI 更新

以后变成：

按钮
```
 ↓
```
CompleteTask
```
 ↓
```
Task Domain
```
 ↓
```
TaskRepository
```
 ↓
```
IndexedDB
```
 ↓
```
EventBus
```
 ↓
```
UI

看起来多了几个东西。

实际上最大的区别是：

每一层只管自己的事情。

---

## 五、Application 层到底是什么？

你可以把 Application 理解成：

«“用户可以做什么事情？”»

例如：

CreateTask
CompleteTask
DeleteTask
UpdateTask
MoveTask
ArchiveMemo
AddBook
FinishReading
SaveDesign

它们不是数据。

它们是“动作”。

例如：

CompleteTask

负责：

1. 找到任务
2. 检查任务是否存在
3. 调用 Task Domain
4. 保存结果
5. 发布事件

但是它不应该知道：

IndexedDB 是怎么工作的

---

## 六、Domain 层是什么？

Domain 就是：

«真正的业务规则。»

例如任务：

任务未完成
```
      ↓
```
完成
```
      ↓
```
completedAt = 当前时间

或者：

任务已经完成
```
      ↓
```
再次完成
```
      ↓
```
不能重复执行

这些属于业务规则。

但是：

IndexedDB 怎么存
localStorage 怎么存

不属于 Domain。

---

## 七、Repository 是最关键的一层

Repository 可以理解成：

«“数据管理员”。»

例如：

TaskRepository
MemoRepository
BookRepository
SettingsRepository

Application 只需要说：

taskRepository.get(id)
taskRepository.save(task)
taskRepository.delete(id)

它不需要知道：

是不是 IndexedDB
是不是 localStorage
有没有加密
有没有缓存

这些以后都可以在 Repository 后面处理。

---

## 八、Infrastructure 是什么？

这里才放浏览器底层东西：

IndexedDB
localStorage
Crypto API
Service Worker
File API
Web Worker

例如：

infrastructure/
    persistence/
        indexeddb.js
        local-storage.js

    encryption/
        encryption.js

    events/
        event-bus.js

这样以后你想改变底层实现，不需要把整个业务系统一起改掉。

---

## 九、那么现在的 Store 怎么办？

非常重要：

不删。

也不应该一下子重写。

而是：

现在

Application
```
     ↓
```
   Store
```
     ↓
```
 IndexedDB

逐步变成：

Application
```
     ↓
```
Repository
```
     ↓
```
Store / Persistence
```
     ↓
```
IndexedDB

最后：

Application
```
     ↓
```
Repository
```
     ↓
```
Persistence
```
     ↓
```
IndexedDB

也就是说：

Store 逐渐从“整个系统的大脑”变成“基础设施的一部分”。

---

## 十、Sonder-Frame 应该怎么理解？

你以前设计的 Sonder-Frame 不需要废掉。

恰恰相反：

这次架构升级是把 Sonder-Frame 真正落地。

可以重新理解成：

                    Sonder-Frame
```
                         │
       ┌─────────────────┼─────────────────┐
       ↓                 ↓                 ↓
```
 Application          Module            Infrastructure
```
       │               Factory               │
       ↓                 │                  ↓
 Domain                  ↓             TrustLayer
       │              UI/Event             │
       ↓                 │                  ↓
 Repository              └──────────── IndexedDB
       │                                localStorage
       ↓                                Crypto
```
 Persistence

ModuleFactory 继续负责：

«“标准模块怎么创建。”»

EventBridge/EventBus 继续负责：

«“模块之间怎么沟通。”»

TrustLayer 继续负责：

«“数据如何安全地保存。”»

Repository 负责：

«“业务如何访问数据。”»

Application 负责：

«“用户操作最终做什么。”»

这样整个 Sonder-Frame 才真正形成闭环。

---

## 十一、最终目录不需要一次性创建完

最终目标可以接近：

js/

├── application/
```
│   ├── tasks/
│   ├── memo/
│   ├── reading/
│   ├── books/
│   └── settings/
│
```
├── domain/
```
│   ├── task/
│   ├── memo/
│   ├── reading/
│   └── book/
│
```
├── repositories/
```
│   ├── task-repository.js
│   ├── memo-repository.js
│   ├── book-repository.js
│   └── ...
│
```
├── infrastructure/
```
│   ├── persistence/
│   │   ├── indexeddb.js
│   │   └── local-storage.js
│   ├── encryption/
│   └── events/
│
```
├── store/
```
│   ├── store-core.js
│   ├── collection-registry.js
│   ├── migration.js
│   ├── undo.js
│   └── import-export.js
│
```
├── framework/
```
│   └── ModuleFactory.js
│
└── ...
```

但是：

这是最终形态，不是第一天就创建这么多文件。

---

## 十二、升级顺序非常重要

不要：

今天
```
↓
```
把整个 store.js 拆成 30 个文件
```
↓
```
全部重写
```
↓
```
测试全挂

正确方式：

第一阶段：看清楚

只分析。

store.js
```
↓
```
哪些代码属于什么职责？

建立：

职责地图
依赖地图
调用地图
数据流地图

---

## 十三、第二阶段：先建立 Repository

例如：

TaskRepository

但它内部先调用旧 Store：

TaskRepository
```
      ↓
```
    Store
```
      ↓
```
   IndexedDB

这样：

Application
```
      ↓
```
Repository
```
      ↓
```
Store

已经完成第一步解耦。

但旧功能完全不用动。

这是非常安全的。

---

## 十四、第三阶段：Application

再把：

today.js

里面的业务操作逐渐迁移：

today.js
```
 ↓
```
CompleteTask
```
 ↓
```
TaskRepository

UI 不再直接操作 Store。

---

## 十五、第四阶段：拆 Store

等 Repository 稳定以后，再把 Store 拆：

store.js

变成：

store-core.js
collection-registry.js
migration.js
undo.js
import-export.js

这样风险会低很多。

---

## 十六、第五阶段：Domain

最后才开始提取真正有价值的业务规则。

不是为了“架构好看”而创建 Domain。

只有当代码存在明确业务规则时才创建。

例如：

Task
Book
Reading
Memo

而不是：

EveryButtonDomain
EveryPageDomain
EveryFunctionDomain

---

## 十七、哪些东西不要乱动？

这是整个计划非常重要的一条。

目前已经成熟的部分：

ModuleFactory
Encryption
IndexedDB
EventBus
测试体系
PWA
游戏 Worker
UI

不要因为架构升级就全部重写。

尤其：

不要为了“新架构”而重写已经正确工作的代码。

架构升级的原则应该是：

«保留行为，改变边界。»

---

## 十八、这次升级成功以后，你的 Sonder520 会变成什么？

以前：

功能很多
+
Store 很强
+
测试很多
+
架构越来越复杂

以后：

UI
```
 ↓
```
Application
```
 ↓
```
Domain
```
 ↓
```
Repository
```
 ↓
```
Infrastructure
```
 ↓
```
Browser

然后：

ModuleFactory

负责模块标准化。

EventBus

负责事件通信。

TrustLayer

负责可信数据存储。

这时候：

Sonder520 才真正从“一个功能很多的前端项目”进化成“有自己架构体系的个人应用”。

---

## 十九、你现在实际上不用做很多事情

如果你问我：

«“那我现在第一步到底干什么？”»

答案非常简单：

先不要改代码。

先让 AI Agent 做：

Sonder520 当前架构体检

重点检查：

store.js
ModuleFactory
EventBus
store-*.js
application 现有代码
persistence
encryption
tests

然后得到：

① 谁依赖谁
② 谁负责什么
③ 哪些地方职责混乱
④ 哪些地方已经很好
⑤ Repository 应该从哪里切
⑥ Application 应该从哪里切
⑦ 哪些代码绝对不能动

拿到这张地图之后，再开始第一刀。

---

## 二十、最终目标

不是：

«“我要把 Sonder520 重构得很高级。”»

而是：

«让以后继续开发 Sonder520 时，每增加一个功能，都知道代码应该放在哪里。»

这才是这次升级最大的价值。
