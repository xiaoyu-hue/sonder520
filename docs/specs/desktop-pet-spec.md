# 小莫灵家族（桌面玩偶养成系统）— 实现规格文档 v2.1
版本：v2.1（三伙伴 + 任务金币 + 零食喂养 + 完整规格）
目标项目：sonder520（MIT 许可证）
文档用途：交给 AI agent 按此规格从零实现，所有代码必须为原创，不得参考或复制任何第三方项目代码。
前置版本：v1.0（单玩偶 15 表情）已废弃，本版本完全替代。

## 版本历史
## 读者对象与阅读指南
阅读建议： - 首次阅读建议按章节顺序通读，建立整体认知 - 实现时按第十二章 12.5 节的三阶段计划推进，每阶段完成后对照附录 H 验收 - 附录 C 是 Pet 类的技术基础，实现前必须先理解 - 遇到设计选择疑问时，查阅附录 G（设计决策记录）了解决策背景
## 目录
一、项目背景与目标
二、角色设定
三、显示与配置系统
四、多玩偶互动系统
五、任务与金币体系
六、商店与零食系统
七、喂养与亲密度系统
八、数据持久化
九、技术架构
十、详细实现步骤
十一、测试与验证
十二、风险与注意事项
附录 A：语录库结构
附录 B：互动对话库结构
附录 C：单玩偶核心实现规格
附录 D：完整语录库
附录 E：完整互动对话库
附录 F：术语表
附录 G：关键设计决策记录
附录 H：分阶段验收标准

## 一、项目背景与目标
### 1.1 背景
v1.0 方案为单个桌面玩偶（小莫灵），功能限于表情变化和基础交互。经评估，单玩偶的可玩性和用户粘性有限，需要升级为更有温度、更有养成感的系统。
### 1.2 v2.0 核心升级
单玩偶 → 三伙伴：小莫、小余、懒零，三个性格鲜明的角色组成”小莫灵家族”
静态展示 → 动态互动：三个玩偶之间可以对话、打闹、协作
纯装饰 → 养成系统：任务得金币 → 商店买零食 → 喂养玩偶 → 提升亲密度
固定显示 → 灵活配置：用户可自定义显示 1-3 个玩偶，支持常驻/串门模式
### 1.3 目标
完全原创代码，MIT 许可证，无第三方依赖
三个角色视觉差异化、性格差异化、语录差异化
任务金币系统与现有”今日任务”模块无缝对接
商店、喂养、亲密度形成完整闭环
不破坏现有 584 项测试，数据可迁移可备份
第一版为轻量养成（仅亲密度数字 + 表情反应），预留后续升级空间

## 二、角色设定
### 2.1 小莫（活泼机灵幽默）
小莫代表语录： - “嘿嘿，被我发现了吧！” - “这事儿包在我身上！” - “哇哦，厉害厉害~” - “摸鱼中，勿cue” - “冲鸭！” - “今天也是元气满满的一天！” - “略略略~” - “我有一个大胆的想法”
### 2.2 小余（责任担当安静成熟稳重）
小余代表语录： - “慢慢来，不着急。” - “这件事我来处理。” - “辛苦了，休息一下吧。” - “一切都在掌控之中。” - “今天的任务完成得不错。” - “有我在，放心。” - “早睡早起，身体好。” - “遇到困难可以找我。”
### 2.3 懒零（贪吃贪睡无忧无虑）
懒零代表语录： - “好困啊……再睡五分钟……” - “有吃的吗？” - “呼……吃饱了就想睡。” - “今天也是躺平的一天~” - “零食……零食在哪里……” - “zzZ……” - “不要叫我，我在冬眠。” - “吃东西是人生第一大事。”
### 2.4 视觉差异化实现
三个玩偶共用同一套 SVG 结构和 JS 类，通过以下方式差异化：
CSS 变量覆盖：每个玩偶实例设置独立的 --dp-body、--dp-body-light、--dp-body-dark、--dp-eye、--dp-mouth
配置参数差异化：每个角色有独立的 characterConfig，包含呼吸幅度、眨眼间隔、身体缩放、默认表情、语录库
装饰元素差异化：
小莫：头顶偶尔出现”感叹号”或”小灯泡”（灵机一动）
小余：无特殊装饰，靠沉稳气质区分
懒零：头顶常驻或频繁出现”zzz”，嘴边偶尔有”口水”（睡觉）
气泡颜色差异化：小莫气泡偏暖、小余气泡偏冷、懒零气泡偏绿（通过 CSS 变量 --dp-bubble-bg 控制）
### 2.5 角色数据结构
var CHARACTERS = {
  xiaomo: {
    id: 'xiaomo',
    name: '小莫',
    desc: '活泼机灵幽默的小家伙',
    colors: { body: '#e8a84c', light: '#fff3d6', dark: '#b87a2a' },
    bodyScale: { x: 0.95, y: 0.95 },
    breathe: 0.025,
    blink: [1500, 3000],
    defaultEmotion: 'happy',
    antics: { bounce: true, wobble: true, spin: true },
    quotes: { /* 语录库，见附录 A */ },
    decor: ['exclaim', 'bulb']
  },
  xiaoyu: {
    id: 'xiaoyu',
    name: '小余',
    desc: '责任担当安静成熟稳重的小家伙',
    colors: { body: '#4a6fa5', light: '#d6e4f5', dark: '#2e4a7a' },
    bodyScale: { x: 1.0, y: 1.08 },
    breathe: 0.012,
    blink: [3500, 6000],
    defaultEmotion: 'idle',
    antics: { nod: true },
    quotes: { /* ... */ },
    decor: []
  },
  lanling: {
    id: 'lanling',
    name: '懒零',
    desc: '贪吃贪睡无忧无虑的小家伙',
    colors: { body: '#7ab89a', light: '#d6f0e4', dark: '#4a8a6a' },
    bodyScale: { x: 1.12, y: 1.05 },
    breathe: 0.008,
    blink: [800, 2000],
    defaultEmotion: 'sleepy',
    antics: { yawn: true, stretch: true },
    quotes: { /* ... */ },
    decor: ['zzz', 'drool']
  }
};

## 三、显示与配置系统
### 3.1 显示模式
用户可在设置中选择显示模式，共三档：
默认模式：duo（双玩偶，一个常驻 + 一个偶尔串门）
### 3.2 常驻玩偶配置
用户可从三个角色中选择一个作为”常驻玩偶”
默认常驻：小莫（最活泼，适合作为默认代表）
常驻玩偶始终显示（除非用户手动隐藏整个桌面玩偶系统）
设置项：desktopPet.resident = 'xiaomo' | 'xiaoyu' | 'lanling'
### 3.3 串门机制（duo 模式）
当显示模式为 duo 时，除常驻玩偶外，另外两个角色中会有一个”串门”。
#### 触发与生命周期
触发间隔：每 8-15 分钟随机触发一次串门（从页面加载或上一次串门结束开始计时）
串门角色选择：从非常驻的两个角色中随机选一个，同一角色离场后 10 分钟内不会再次被选中（冷却）
停留时长：2-4 分钟（随机）
同时存在数量：duo 模式下最多同时存在 2 个玩偶（常驻 + 1 个串门），不会出现两个串门玩偶同时在场
#### 出场动画
方向：从屏幕右侧滑入（与常驻玩偶同侧，形成”小伙伴来找你玩”的感觉）
动画参数：duration 600ms，easing cubic-bezier(0.22, 1, 0.36, 1)（与项目整体动效一致）
动画流程：
玩偶在屏幕右侧外（x = innerWidth）创建，初始 opacity 0
滑入到常驻玩偶旁边（x = 常驻位置 x - size - 10），opacity 渐变为 1
到位后播放 wave 打招呼表情（持续 2.5 秒）
恢复 idle，进入停留状态
#### 离场动画
方向：从屏幕右侧滑出（原路返回）
动画参数：duration 500ms，easing cubic-bezier(0.4, 0, 0.2, 1)
动画流程：
播放 goodbye 表情（持续 1.5 秒，挥手鳍缓慢摆动）
向右滑出屏幕，opacity 渐变为 0
移出屏幕后销毁实例，进入该角色的 10 分钟冷却
#### 串门期间的行为
串门玩偶与常驻玩偶共享 PetFamily 的动画循环和布局管理
串门期间有概率触发互动对话（见第四章，概率比 trio 模式略低，因为只有两个角色）
串门玩偶可以被点击（播放点击反应），但不能被拖拽（固定在常驻旁边的位置）
用户可以通过右键菜单”叫小伙伴来玩”手动召唤串门玩偶（无视触发间隔，但仍受角色冷却限制）
#### 串门状态机
IDLE（等待触发）→ 触发计时到 → 出场动画（600ms）→ 打招呼（2.5s）
→ 停留状态（2-4分钟，可触发互动）→ 离场预告（goodbye 1.5s）
→ 离场动画（500ms）→ 销毁实例 → 角色冷却（10min）→ IDLE
### 3.4 多玩偶布局策略
当显示多个玩偶时，避免重叠：
#### 拖拽行为规则
独立拖拽：每个玩偶的位置可独立拖拽，拖拽一个玩偶时，其他玩偶保持原位不动（不自动重排）
位置持久化：拖拽结束后，该角色的位置独立持久化（按角色 ID 存储，不按布局模式存储）
串门玩偶不可拖拽：duo 模式下的串门玩偶固定在常驻旁边，不响应拖拽
重叠处理：如果用户拖拽导致两个玩偶重叠，不做自动纠正（用户可以自己调整），但窗口 resize 时会触发自动重排避免超出视口
布局模式切换：从 single 切到 duo/trio 时，新出现的玩偶默认排在已有玩偶左侧（横向）或上方（纵向），使用默认位置而非用户自定义位置（除非该角色之前有拖拽记录）
窗口 resize：窗口大小变化时，检查所有玩偶是否超出视口，超出的自动移回视口内（保持相对位置关系），但不改变用户自定义的相对布局
#### 位置存储结构
desktopPet.positions = {
  xiaomo: { x: null, y: null },   // null = 使用默认布局位置
  xiaoyu: { x: 100, y: 500 },     // 有值 = 用户拖拽过的自定义位置
  lanling: { x: null, y: null }
}
位置为 null 时，由布局管理器根据当前模式自动计算位置
位置有值时，优先使用用户自定义位置（但仍受视口边界约束）
### 3.5 设置项汇总
desktopPet: {
  enabled: true,                // 总开关：控制悬浮玩偶显示/隐藏和整个系统启停
  mode: 'duo',                  // 显示模式：single / duo / trio
  resident: 'xiaomo',           // 常驻角色 ID：xiaomo / xiaoyu / lanling
  size: 84,                      // 基础尺寸（px），范围 48-160
  layout: 'bottom-right',       // 布局位置：bottom-right / bottom-left / auto
  positions: {                   // 各角色自定义位置（null = 使用默认布局）
    xiaomo: { x: null, y: null },
    xiaoyu: { x: null, y: null },
    lanling: { x: null, y: null }
  },
  coins: 0,                      // 金币余额
  affection: {                    // 各角色亲密度
    xiaomo: 0, xiaoyu: 0, lanling: 0
  },
  inventory: { },                // 零食库存（零食ID -> 数量）
  totalFed: {                     // 累计喂食次数（统计用）
    xiaomo: 0, xiaoyu: 0, lanling: 0
  },
  rewardedTaskIds: [ ],          // 已奖励金币的任务ID列表（防刷，最多500条，滚动丢弃）
  achievements: {
    unlocked: [ ],                // 已解锁成就ID列表
    stats: {
      totalTasksDone: 0,         // 累计完成任务数
      lastActiveDay: null,       // 上次活跃日期（本地自然日字符串，如 '2026-08-20'）
      streakDays: 0,             // 连续活跃天数
      totalFeeds: 0              // 累计喂食次数
    }
  }
}
#### 两个开关的关系（重要）
项目中存在两个与桌面玩偶相关的开关，职责不同，互相独立：
行为说明： - 关闭 modules.desktopPet：导航栏不显示”小莫灵家族”入口，但悬浮玩偶仍然正常显示和运行（用户仍可通过其他方式访问，比如直接输入 hash 路由 #/desktop-pet） - 关闭 desktopPet.enabled：悬浮玩偶隐藏，整个系统停止运行（动画循环暂停、串门停止、互动停止），但导航栏入口仍然显示（用户可以进入页面重新开启） - 两个开关都关闭：导航入口隐藏 + 悬浮玩偶隐藏 + 系统停止 - 设置入口：desktopPet.enabled 总开关在独立板块页面（小莫灵家族）的”显示设置”分区中；modules.desktopPet 模块开关在设置页的”模块开关”分区中（与其他业务模块并列）
### 3.6 独立板块页面设计
桌面玩偶作为导航栏中的独立板块（位于”游戏”下方、“设置”上方），页面路由为 #/desktop-pet，页面标题为”小莫灵家族”。所有桌面玩偶相关功能集中在此页面，设置页仅保留模块总开关。
#### 页面布局（从上到下）
┌─────────────────────────────────────────────────────────┐
│  🏠 小莫灵家族                          💰 128 金币      │  ← 页面标题 + 金币余额
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐               │
│   │  小莫   │  │  小余   │  │  懒零   │               │  ← 三角色展示卡
│   │  (SVG)  │  │  (SVG)  │  │  (SVG)  │               │
│   │ ❤️ 42   │  │ ❤️ 28   │  │ ❤️ 67   │               │
│   │ [喂食]  │  │ [喂食]  │  │ [喂食]  │               │
│   └─────────┘  └─────────┘  └─────────┘               │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  🎮 显示设置                                             │  ← 设置分区
│  ○ 单玩偶  ●双玩偶(串门)  ○三玩偶同屏                   │
│  常驻角色：●小莫 ○小余 ○懒零                             │
│  大小：[━━━━●━━━━] 84px                                  │
│  ☑ 启用桌面玩偶                                           │
├─────────────────────────────────────────────────────────┤
│  🏪 零食商店                    [打开完整商店]            │  ← 商店预览分区
│  🍪x3  🍬x1  🍎x0  🍰x0  ...（库存摘要）               │
├─────────────────────────────────────────────────────────┤
│  🏆 成就                             （已解锁 3/10）     │  ← 成就分区
│  ✅初出茅庐  ✅小有所成  🔒任务达人  🔒百炼成钢  ...     │
└─────────────────────────────────────────────────────────┘
#### 各分区功能说明
1. 页面标题栏 - 左侧：图标 🐾 + “小莫灵家族”标题 - 右侧：金币余额（💰 数字），点击可弹出”如何获得金币”说明
2. 三角色展示卡 - 三张卡片横向排列（移动端纵向堆叠），每张包含： - 角色 SVG 大图（比悬浮玩偶大，约 120px），播放待机动画 - 角色名称 + 一句话性格描述 - 亲密度（❤️ 数字 + 进度条） - [喂食] 按钮 → 弹出零食选择面板 - 点击卡片可切换该角色为常驻玩偶（在 duo/single 模式下） - 悬浮玩偶和页面内的 SVG 共享动画状态（页面打开时悬浮玩偶可隐藏或缩小）
3. 显示设置分区 - 显示模式单选：单玩偶 / 双玩偶（串门，默认）/ 三玩偶同屏 - 常驻角色单选：小莫 / 小余 / 懒零（single 和 duo 模式下生效） - 大小滑块：48-160px，实时预览 - 总开关：启用/禁用桌面玩偶 - 重置数据按钮（红色文字按钮，带二次确认弹窗）：点击后弹出确认”确定要重置所有桌面玩偶数据吗？金币、亲密度、库存、成就都将清零，此操作不可撤销。“，确认后调用 PetFamily.resetAllData()，将所有桌面玩偶数据恢复为默认值（金币=0、亲密度=0、库存清空、成就重置、配置恢复默认），但保留 enabled 和 modules.desktopPet 开关状态 - 所有设置变更即时生效，自动持久化
4. 商店预览分区 - 显示当前库存摘要（9 种零食的图标 + 数量） - [打开完整商店] 按钮 → 弹出完整商店面板（见第六章 6.2） - 金币不足时提示”完成今日任务赚金币”
5. 成就分区 - 显示 10 个成就的解锁状态（已解锁高亮，未解锁灰色） - 每个成就显示：图标 + 名称 + 奖励金币数 - 已解锁的成就显示达成日期（可选） - 点击已解锁成就可查看详情，点击未解锁成就显示达成条件
#### 页面交互细节
页面打开时，悬浮在角落的玩偶可暂时隐藏（避免重复），或缩小到角落
页面关闭（切换到其他路由）时，悬浮玩偶恢复显示
页面内的 SVG 动画由 PetFamily 统一驱动，不额外创建 rAF 循环
所有按钮操作有 toast 反馈（购买成功、喂食成功、设置已保存等）
#### 导航注册
NAV 数组中在 'game' 之后、'settings' 之前插入 'desktop-pet'
ICONS 增加 'desktop-pet': '🐾'（或 ‘🪀’ / ‘🎭’，选一个合适的）
TOGGLEABLE 增加 'desktop-pet': 1（可在设置页模块开关中隐藏/显示）
Pages['desktop-pet'] = { title: '小莫灵家族', render: function(container, ctx) {...} }
modules 默认设置增加 desktopPet: true
#### 页面模块与核心模块的通信机制（重要）
desktop-pet-page.js（页面模块）与 desktop-pet.js（核心模块）通过以下方式通信：
全局实例获取：核心模块通过 window.__desktopPetFamily 全局暴露 PetFamily 实例，页面模块通过此全局变量获取实例
数据获取：页面模块调用 PetFamily.getState() 获取数据快照（金币、亲密度、库存、成就、设置等的只读副本）
变更订阅：页面模块调用 PetFamily.on('change', callback) 订阅数据变更，任何数据变化都会触发 callback，页面在 callback 中重新渲染相关区域
操作调用：页面模块的用户操作（切换显示模式、调整大小、喂食、购买零食等）直接调用 PetFamily 的公开方法（setMode、setSize、feedPet、buySnack 等），PetFamily 内部处理逻辑并触发 ‘change’ 事件
页面生命周期：
页面打开（进入 #/desktop-pet 路由）时：调用 PetFamily.enterPageMode()，暂停悬浮玩偶显示，创建页面内的”展示模式”玩偶实例
页面离开（切换到其他路由）时：调用 PetFamily.exitPageMode()，销毁页面内展示模式实例，恢复悬浮玩偶显示
#### 核心模块未加载时的降级处理（重要）
如果页面模块加载时 window.__desktopPetFamily 不存在（核心模块加载失败、被禁用、或加载顺序问题），页面模块需要优雅降级： 1. 检测时机：页面 render 函数执行时，首先检查 window.__desktopPetFamily 是否存在 2. 不存在时的处理： - 页面显示提示信息：“桌面玩偶核心模块未加载，请刷新页面试试” - 页面仍可显示静态的角色介绍卡片（三角色名称、性格描述、颜色），但所有交互按钮（喂食、设置、商店）置灰不可用 - 不调用任何 PetFamily 方法，避免 JS 报错 3. 延迟加载检测：如果核心模块使用了 defer，可能存在页面先渲染、核心模块后初始化的情况。页面模块可以设置一个最长 3 秒的轮询检测（每 200ms 检查一次 window.__desktopPetFamily），检测到后正常初始化；超过 3 秒仍未检测到则显示降级提示 4. 模块开关关闭时：如果 settings.modules.desktopPet 为 false，导航项不显示，用户不会进入此页面；如果用户直接通过 hash 路由进入，页面显示”此模块已在设置中关闭”提示 5. 总开关关闭时：如果 desktopPet.enabled 为 false，页面正常显示，但页面顶部显示”桌面玩偶已暂停，点击开启”提示条，点击可调用 setEnabled(true) 开启
#### 页面内玩偶实例与悬浮玩偶实例的关系
两个独立实例：页面内的 SVG 玩偶和角落的悬浮玩偶是两个独立的 Pet 实例，不是同一个 DOM 元素的移动
共享状态数据：两个实例共享 PetFamily 的状态数据（当前表情、亲密度等），但各自独立渲染
页面实例为”展示模式”：大尺寸（约 120px）、无拖拽/右键菜单/气泡互动、共享 rAF 循环、点击不触发反应（由卡片[喂食]按钮处理）
悬浮实例为”交互模式”：正常尺寸、完整交互能力、页面打开时隐藏
#### 互动对话期间的用户点击行为（统一规则）
当多玩偶互动对话正在播放时，用户点击任意参与互动的玩偶： 1. 立即结束当前互动对话（清除对话定时器，隐藏所有气泡） 2. 然后正常响应用户点击（播放点击反应：随机表情 + 语录气泡） 3. 互动冷却正常计算（本次互动视为已完成，进入 3-6 分钟冷却） 4. 页面内用户点击[喂食]按钮时，也应先结束互动再执行喂食
#### 页面打开时悬浮玩偶的处理（明确）
页面打开时，悬浮玩偶隐藏（display: none），不是缩小
隐藏期间悬浮玩偶的动画循环暂停（由 PetFamily 统一控制）
页面离开时，悬浮玩偶恢复显示，动画循环恢复
如果用户在页面打开时通过设置关闭了 desktopPet.enabled，页面离开后悬浮玩偶也不会显示

## 四、多玩偶互动系统
### 4.1 互动类型
当屏幕上同时存在 2 个或以上玩偶时，会随机触发互动：
### 4.2 互动触发条件
屏幕上同时存在 ≥2 个玩偶
距离较近（间距 < 200px，或在同一角落布局）
距离上次互动超过 3-6 分钟（随机冷却）
用户没有正在拖拽任何玩偶
当前没有正在播放的气泡对话
### 4.3 角色互动偏好
不同角色组合有不同的互动倾向：
### 4.4 互动对话库（示例）
对话为 2-3 轮的短对话，每个角色说 1-2 句。以下为部分示例：
小莫 + 小余（chat）： - 小莫：“小余小余，你看我今天是不是特别帅？” - 小余：“……你开心就好。” - 小莫：“嘿嘿，我就当你夸我了！”
小莫 + 懒零（tease）： - 小莫：“懒零！别睡了起来玩！” - 懒零：“……不要，被窝里好舒服……” - 小莫：“再睡就要变成球啦！” - 懒零：“……球就球，球也很可爱。”
小余 + 懒零（comfort）： - 小余：“懒零，今天任务都完成了吗？” - 懒零：“还没……好困……” - 小余：“先睡一会儿吧，醒了我陪你做。” - 懒零：“小余最好了……zzZ”
三个一起（sync）： - 小莫：“一二三——” - 小余：“大家一起——” - 懒零：“……加油？” - （三个同时做 happy 弹跳）
完整对话库见附录 E，第一版提供 4 种组合 × 5 组 = 20 组对话作为基础。建议后续扩展到每种组合至少 8 组（总计约 32 组），以减少重复感。
### 4.5 互动实现机制
PetFamily 管理器维护所有活跃玩偶实例
定时器检测互动条件，随机选择互动类型和参与角色
互动开始时，锁定参与角色（不接受独立的表情切换）
按对话剧本逐轮显示气泡，每轮间隔 1.5-2.5 秒
互动结束后，角色恢复独立状态，进入冷却
互动过程中用户点击某个玩偶，可提前结束互动（该玩偶回应用户点击）

## 五、任务与金币体系
### 5.1 金币来源
### 5.2 今日任务金币规则
监听 /data/tasks 事件，当任务状态从 done=false 变为 done=true 时发放金币
基础奖励：每完成一个任务 = 10 金币
难度加成（如果任务有优先级/难度字段）：
低优先级：5 金币
普通：10 金币
高优先级：15 金币
如果任务没有优先级字段，统一 10 金币
玩偶同时做 happy 表情 + 气泡”又赚了一笔！”
#### 金币飘字动画实现方案
金币发放时显示飘字动画（“+10 金币”从任务项飘向玩偶区域），实现要点：
飘字元素创建：创建一个固定定位（position: fixed）的 <div>，z-index 高于内容区（建议 100），内容为 +N 金币，样式为金色文字带阴影
起始坐标：通过触发任务项 DOM 元素的 getBoundingClientRect() 获取其屏幕位置，取元素中心或右上角作为起始点
结束坐标：取悬浮玩偶区域的位置（右下角），或页面打开时取页面内玩偶卡片的位置
动画路径：使用 CSS transition 或 @keyframes 动画，从起始坐标移动到结束坐标，同时 opacity 从 1 渐变为 0，可加轻微的抛物线效果（用贝塞尔曲线或两段动画：先向上抛再下落）
动画时长：800-1200ms
动画结束：移除飘字 DOM 元素，同时玩偶区域播放一个”金币入账”的小反馈（玩偶轻微弹跳 + 金币数字短暂高亮）
多个飘字并发：如果短时间内完成多个任务，飘字元素各自独立动画，起始位置错开（避免完全重叠），最多同时显示 3 个飘字，超出的排队等待
// 伪代码示例
function showCoinFly(amount, fromEl) {
  var rect = fromEl.getBoundingClientRect();
  var fly = document.createElement('div');
  fly.className = 'dp-coin-fly';
  fly.textContent = '+' + amount + ' 金币';
  fly.style.left = rect.left + rect.width / 2 + 'px';
  fly.style.top = rect.top + 'px';
  document.body.appendChild(fly);
  // 触发重排后添加动画类
  requestAnimationFrame(function () {
    fly.classList.add('dp-coin-fly--animate');
    fly.style.left = petRect.left + 'px';
    fly.style.top = petRect.top + 'px';
  });
  setTimeout(function () { fly.remove(); }, 1200);
}
#### 防刷机制（详细）
已奖励任务ID记录：存在 desktopPet.rewardedTaskIds 数组中（持久化，跟随 settings 一起存储）
判断逻辑：任务完成时，先检查任务ID是否在 rewardedTaskIds 中，不在才发放金币并将ID加入数组
数组上限：最多保留最近 500 个任务ID，超出时滚动丢弃最旧的（避免数组无限增长）
会话上限：每次会话（页面打开到关闭）最多发放 100 金币（防止异常情况下金币暴涨），达到上限后本次会话不再发放，但任务完成记录仍正常更新
导入数据处理：导入备份时，rewardedTaskIds 整体替换（不合并），且导入过程中触发的 /data/tasks 事件不发放金币（通过一个 isImporting 标志位区分用户操作和数据导入）
取消任务处理：用户取消已完成的任务（done 从 true 变 false），不扣除已发放的金币（避免反复刷的复杂逻辑，简单处理：只加不减），但该任务ID保留在 rewardedTaskIds 中（再次勾选时不重复发放）
### 5.3 成就系统设计
成就检测时机： - 完成任务时：检测 task_、all_done_today、streak_ - 喂食时：检测 first_feed、feed_10、affection_100 - 页面加载时：检测 streak 连续性（如果昨天没活跃，重置 streakDays 为 0）
#### streak 连续天数判断逻辑（详细）
“连续 N 天有完成任务”的判断规则：
“天”的定义：使用用户本地时区的自然日，通过 new Date().toDateString() 或手动格式化 YYYY-MM-DD 获取当天日期字符串
lastActiveDay 更新时机：每次完成任务时，将 lastActiveDay 更新为当天日期字符串（如果已经是当天则不重复更新）
streakDays 更新逻辑：
完成任务时，先检查 lastActiveDay：
如果 lastActiveDay 为 null（首次）：streakDays = 1
如果 lastActiveDay 是昨天：streakDays += 1（连续）
如果 lastActiveDay 是今天：streakDays 不变（今天已经算过了）
如果 lastActiveDay 早于昨天（中间断了）：streakDays = 1（重新开始计数）
然后更新 lastActiveDay 为今天
页面加载时的连续性校验：
页面加载时，检查 lastActiveDay：
如果 lastActiveDay 早于昨天（且不是 null）：说明用户中间有几天没活跃，streakDays 重置为 0
如果 lastActiveDay 是昨天或今天或 null：不改变 streakDays
这个校验确保用户隔了几天再打开时，连续天数不会错误保留
跨天边界处理：
用户 23:55 完成任务（lastActiveDay = 今天），00:05 又完成一个任务：
第二次完成时，lastActiveDay 是昨天（今天的前一天），所以 streakDays += 1，算连续两天
这是正确的行为，因为确实跨了自然日
时区注意：使用用户本地时间（new Date()），不使用 UTC，避免时区差异导致日期判断错误
// 伪代码示例
// 工具函数：获取本地日期字符串 YYYY-MM-DD（必须用本地时间，不能用 toISOString，那是 UTC）
function getLocalDateStr(d) {
  d = d || new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}
function getYesterdayStr() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateStr(d);
}

function updateStreakOnTaskComplete() {
  var today = getLocalDateStr();
  var last = state.desktopPet.achievements.stats.lastActiveDay;
  if (last === today) {
    // 今天已经活跃过，streak 不变
  } else if (last === getYesterdayStr()) {
    state.desktopPet.achievements.stats.streakDays += 1; // 连续
  } else {
    state.desktopPet.achievements.stats.streakDays = 1; // 重新开始
  }
  state.desktopPet.achievements.stats.lastActiveDay = today;
}

function checkStreakOnPageLoad() {
  var last = state.desktopPet.achievements.stats.lastActiveDay;
  if (last && last < getYesterdayStr()) {
    // 中间断了，重置
    state.desktopPet.achievements.stats.streakDays = 0;
  }
}
成就解锁反馈： - 屏幕顶部弹出成就横幅（“🏆 成就解锁：初出茅庐 +20金币”） - 所有在场玩偶同时做 excited 表情 - 金币余额动画增加
### 5.4 金币操作 API
PetFamily.addCoins(amount, reason);   // 增加金币
PetFamily.spendCoins(amount);          // 花费金币，返回是否成功
PetFamily.getCoins();                   // 查询余额
金币为非负整数，最小单位 1
所有金币变动写入 desktopPet.coins

## 六、商店与零食系统
### 6.1 9 种零食清单
定价规则： - 价格范围 5-60 金币 - 亲密度 ≈ 价格 × 0.4（取整），越贵性价比略高 - 第一版无角色喜好系统，所有零食对所有角色加的亲密度相同 - 预留 preference 字段，后续版本可增加角色喜好
### 6.2 商店 UI
商店作为独立弹窗/面板，入口在： - 玩偶右键菜单 → “商店” - 独立板块页面（小莫灵家族）→ 商店预览分区 → “打开完整商店”按钮 - 悬浮玩偶气泡中偶尔出现”想吃零食🍪“提示，点击直达商店
商店面板布局：3 列网格，9 种零食正好 3 行。每个卡片显示图标、名称、价格、亲密度（小字）、购买按钮。余额不足的零食购买按钮置灰。底部显示当前库存摘要。
### 6.3 购买流程
用户点击”购买” → 2. 检查金币余额 → 3. 不足则按钮抖动提示 → 4. 足够则扣金币、库存+1 → 5. 播放飞入动画 → 6. 持久化数据
### 6.4 库存系统
存储在 desktopPet.inventory，格式 {零食ID: 数量}
无上限（第一版）
喂食时从库存扣除 1 个

## 七、喂养与亲密度系统
### 7.1 喂食交互流程
入口：右键点击玩偶 → “喂零食”；长按玩偶（移动端）→ 菜单
选择零食：弹出小面板，显示库存中的零食（图标 + 数量）
喂食动画：零食图标飞向玩偶嘴巴 → 玩偶做 excited/happy → 嘴巴短暂”open” → 显示气泡反应 → 亲密度飘字”+N ❤️”
完成：库存-1，亲密度持久化，检测成就
### 7.2 亲密度机制
每个角色独立计算，存储在 desktopPet.affection[角色ID]
非负整数，无上限（第一版）
喂食增加值 = 零食的亲密度值
第一版无亲密度衰减（不喂不会掉）
亲密度仅作数字展示和成就触发，第一版不解锁新内容（预留后续）
亲密度展示： - 喂食时飘字”+N ❤️” - 玩偶信息面板显示当前亲密度 - 独立板块页面（小莫灵家族）显示各角色亲密度进度条 - 达到里程碑（50/100/200/500）时有特殊庆祝反应
### 7.3 喂食反应语录（示例）
小莫：“哇！好吃好吃！” / “嘿嘿，谢谢投喂~” / “这个我喜欢！再来一个？” 小余：“……谢谢。” / “有心了。” / “味道不错。” / “你也记得按时吃饭。” 懒零：“吃的！！！” / “唔……好吃……还要……” / “吃饱了……好困……”
每个角色至少 8 条喂食反应语录。
### 7.4 饱食度（第一版不实现，预留）
第一版不实现饱食度，玩偶可无限吃。预留字段 desktopPet.fullness[角色ID]，后续版本可启用。

## 八、数据持久化
### 8.1 存储位置
所有桌面玩偶数据存储在 store.state.settings.desktopPet 对象下。
为什么存在 settings 下： - 桌面玩偶是设置/偏好类数据，不是业务记录 - 数据量小，不需要 IndexedDB - 跟随 settings 的持久化和备份导出机制
### 8.2 数据迁移
全新用户：所有字段按默认值初始化
旧版本用户（v1.0 单玩偶，如果有的话）升级时：
desktopPet.enabled 保持原值
desktopPet.size 保持原值
desktopPet.mode 默认 duo
desktopPet.resident 默认 xiaomo
金币、亲密度、库存、成就初始化为 0/空
部分字段缺失的处理（重要）：
如果 desktopPet 对象存在但部分字段缺失（比如旧版本只有 enabled/size，没有 coins/affection），使用深合并（递归 Object.assign）补全默认值，而不是整体覆盖
深合并逻辑：遍历默认 desktopPet 对象的每个字段，如果用户数据中该字段不存在则填入默认值；如果是嵌套对象（如 affection、achievements.stats），递归执行同样的合并
这样可以确保旧版本用户升级时不会丢失已有数据，同时新字段有合理默认值
数据版本号：在 desktopPet 对象中增加 schemaVersion: 1 字段，未来数据结构变更时可据此判断迁移逻辑
迁移在 store 初始化时执行（加载数据后、使用数据前）
// 伪代码：深合并默认值
function mergeDesktopPetDefaults(userData) {
  var defaults = getDefaultDesktopPet();
  function deepMerge(target, source) {
    for (var key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          target[key] = target[key] || {};
          deepMerge(target[key], source[key]);
        } else if (target[key] === undefined) {
          target[key] = source[key];
        }
      }
    }
  }
  deepMerge(userData, defaults);
  return userData;
}
### 8.3 备份/导出兼容
导出备份自动包含桌面玩偶数据
导入时整体替换（不合并）
导入数据后不触发金币发放

## 九、技术架构
### 9.1 模块划分
desktop-pet.js（核心模块，UMD）
├── CHARACTERS / SNACKS / ACHIEVEMENTS / DIALOGUES  # 配置表
├── Pet          # 单个玩偶类（v1.0 扩展，注入角色配置）
├── PetFamily    # 多玩偶管理器（新增，核心）
│   ├── instances / coins / 显示模式 / 串门 / 布局
│   ├── addCoins/spendCoins / buySnack / feedPet
│   ├── triggerInteraction / checkAchievements
│   └── updateDisplayMode
├── ShopPanel / FeedPanel / AchievementBanner  # UI 组件
├── create() / createFamily() / autoInit()
### 9.2 Pet 类扩展（相对 v1.0）
构造函数接收 character 参数，从 CHARACTERS 读取配置
每个实例有 id（xiaomo/xiaoyu/lanling）
新增 feed(snackId) 方法
新增 sayLine(text, duration) 供互动调用
新增 enter(fromSide) / exit(toSide) 出场离场动画
内置右键/长按菜单（喂零食、商店、信息、隐藏）
### 9.3 PetFamily 管理器职责与公开接口
PetFamily 是整个桌面玩偶系统的核心管理器，承担以下职责： - 维护活跃玩偶实例生命周期（创建/销毁/显示/隐藏） - 根据显示模式（single/duo/trio）管理实例数量和串门机制 - 管理多玩偶布局（避免重叠、窗口 resize 重排） - 统一管理金币、库存、亲密度数据 - 触发多玩偶互动（定时检测条件 + 播放对话） - 监听任务完成 → 发放金币 + 检测成就 - 监听设置变更 → 响应显示模式/常驻角色/大小 - 统一驱动 rAF 动画循环（所有玩偶共享一个循环） - 页面模式管理（enterPageMode / exitPageMode）
#### PetFamily 公开接口（页面模块和外部调用使用）
// 数据查询
PetFamily.getState()              // 返回数据快照（只读副本）
PetFamily.getCoins()              // 返回金币余额
PetFamily.getAffection(petId)     // 返回指定角色亲密度
PetFamily.getInventory()          // 返回库存快照
PetFamily.getAchievements()       // 返回成就状态
PetFamily.getMode()               // 返回当前显示模式（single/duo/trio）
PetFamily.getResident()           // 返回当前常驻角色ID
PetFamily.getSize()               // 返回当前玩偶尺寸（px）
PetFamily.isEnabled()             // 返回系统总开关状态（boolean）
PetFamily.getActivePetIds()       // 返回当前屏幕上活跃的玩偶ID数组

// 数据操作
PetFamily.addCoins(amount, reason)    // 增加金币
PetFamily.spendCoins(amount)          // 花费金币，返回 boolean
PetFamily.buySnack(snackId)           // 购买零食，返回 boolean
PetFamily.feedPet(petId, snackId)     // 喂食，返回 boolean

// 显示控制
PetFamily.setMode(mode)            // 设置显示模式
PetFamily.setResident(petId)       // 设置常驻角色
PetFamily.setSize(px)               // 设置大小
PetFamily.setEnabled(on)            // 启用/禁用系统
PetFamily.enterPageMode()           // 进入页面模式
PetFamily.exitPageMode()            // 退出页面模式

// 事件订阅
PetFamily.on(event, callback)       // 订阅事件
PetFamily.off(event, callback)      // 取消订阅

// 互动控制
PetFamily.triggerInteraction()      // 手动触发互动
PetFamily.cancelInteraction()       // 取消当前互动

// 生命周期
PetFamily.destroy()                 // 销毁管理器
PetFamily.resetAllData()            // 重置所有桌面玩偶数据（金币/亲密度/库存/成就清零，配置恢复默认，保留开关状态）
#### PetFamily 内部子管理器（组合模式，避免上帝类）
对外是统一的 PetFamily 接口，内部用组合模式划分子管理器：
子管理器之间通过 PetFamily 内部事件总线通信，不直接互相调用。
### 9.4 性能关键：共享 rAF 循环
三个玩偶共享一个 requestAnimationFrame 循环（由 PetFamily 统一驱动），不是每个实例独立循环。隐藏的玩偶完全不运行动画。这是控制 CPU 占用的关键。
### 9.5 文件结构
sonder520/
├── js/desktop-pet.js        # 新增：核心模块（Pet + PetFamily + 配置表 + 弹窗UI，预计 1500-2500 行）
├── js/desktop-pet-page.js   # 新增：独立页面模块（导航板块的页面渲染，桌面玩偶主页）
├── css/desktop-pet.css       # 新增：玩偶 + 页面 + 商店 + 喂食 + 成就横幅样式
├── index.html                 # 修改：引入 CSS + 两个 JS
├── js/app.js                  # 修改：NAV 增加 desktop-pet、ICONS 增加图标、TOGGLEABLE 增加开关
├── js/store.js                # 修改：默认 settings 增加 desktopPet 完整对象 + modules.desktopPet 开关
├── js/store-settings.js       # 修改：增加桌面玩偶设置方法
├── js/settings.js             # 修改：模块开关中增加"桌面玩偶"（仅总开关，详细设置移到独立板块）
└── docs/specs/desktop-pet-spec.md   # 本文档
模块职责划分： - desktop-pet.js：纯逻辑 + 浮层 UI（玩偶本身、商店弹窗、喂食弹窗、成就横幅），不依赖页面路由 - desktop-pet-page.js：独立板块的页面渲染（玩偶展示区、金币/亲密度概览、设置面板、成就列表），通过 Pages['desktop-pet'] 注册 - 两个文件都通过 UMD 暴露全局变量，desktop-pet-page.js 依赖 desktop-pet.js 的 PetFamily 实例
desktop-pet.js 单文件内部分区建议（预计 1500-2500 行，用注释分区，便于维护）：
/* ============================================================
   第一区：配置表（CONFIG）
   - CHARACTERS（3角色配置）
   - SNACKS（9种零食配置）
   - ACHIEVEMENTS（10个成就配置）
   - DIALOGUES（互动对话库）
   - QUOTES（语录库）
   ============================================================ */

/* ============================================================
   第二区：工具函数（UTILS）
   - clamp/rand/pick/now 等通用函数
   - 深合并默认值函数
   - 日期工具（今天/昨天/连续天数）
   ============================================================ */

/* ============================================================
   第三区：Pet 类（单个玩偶）
   - 构造函数 / _build / _bindEvents
   - _tick / _drawEye / _drawMouth
   - _scheduleBlink / _scheduleIdleQuote / _checkLateNight
   - setEmotion / say / sayLine / setSize / show / hide
   - feed / enter / exit / destroy
   ============================================================ */

/* ============================================================
   第四区：子管理器（MANAGERS）
   - DisplayManager（显示/串门/布局/页面模式）
   - CoinManager（金币/防刷/飘字）
   - ShopManager（商店/库存/购买）
   - FeedManager（喂食/亲密度/动画）
   - AchievementManager（成就/streak）
   - InteractionManager（互动/对话/冷却）
   - AnimationLoop（共享 rAF）
   ============================================================ */

/* ============================================================
   第五区：PetFamily 核心管理器
   - 组合所有子管理器
   - 公开接口（getState/addCoins/buySnack/feedPet/setMode 等）
   - 事件系统（on/off/emit）
   - 与 SonderStore/SonderBus 的集成
   - destroy
   ============================================================ */

/* ============================================================
   第六区：浮层 UI 组件（UI）
   - ShopPanel（商店弹窗）
   - FeedPanel（喂食选择弹窗）
   - AchievementBanner（成就横幅）
   - CoinFly（金币飘字）
   ============================================================ */

/* ============================================================
   第七区：工厂与自动初始化（FACTORY / INIT）
   - createPet / createFamily
   - autoInit（检测 Sonder 环境，创建 PetFamily，暴露全局）
   - UMD 导出
   ============================================================ */
如果文件超过 2000 行，可考虑拆分为 desktop-pet-core.js（第一至五区）和 desktop-pet-ui.js（第六区），但优先保持单文件以符合项目风格。
所有逻辑尽量集中，保持与项目”零构建、单文件模块”风格一致。
### 9.6 代码规范
#### 语言风格
ES5 语法：使用 var（不用 let/const）、function（不用箭头函数）、原型链继承（不用 class）、字符串拼接（不用模板字符串），与项目现有代码风格一致
UMD 包装：每个文件用 UMD 包装，通过全局变量暴露（window.DesktopPetCore、window.DesktopPetPage），与项目其他模块一致
严格模式：文件开头 'use strict';
分号：所有语句末尾加分号
缩进：2 空格
#### 命名规范
构造函数/类：大驼峰（PetFamily、ShopPanel、DisplayManager）
方法/函数：小驼峰（setEmotion、addCoins、buySnack）
私有方法：下划线前缀（_tick、_build、_drawEye）
常量：全大写下划线（CHARACTERS、SNACKS、DEFAULT_SIZE）
配置键：小驼峰（defaultEmotion、breatheAmp）
CSS 类名：dp- 前缀，短横线分隔（dp-bubble、dp-coin-fly、dp-pet-xiaomo）
事件名：斜杠路径（/data/tasks、/data/settings）
#### 注释规范
每个分区用块注释分隔（见 9.5 节的七区注释模板）
公开方法用 JSDoc 风格注释（@param、@returns）
复杂逻辑必须注释”为什么”，不只是”做什么”
魔数（magic number）必须提取为命名常量或加注释说明
#### 错误处理
所有 DOM 查询后检查 null（if (!el) return;）
所有 JSON.parse 包裹 try-catch
PetFamily 公开方法对参数做防御性校验（非法 petId、负数金币等）
核心模块初始化失败时不阻断页面其他功能（try-catch 包裹 autoInit）
不使用 alert()，错误用 toast 或 console.warn 提示
#### 性能规范
不在 rAF 循环中创建对象/数组（避免 GC 抖动）
不在 rAF 循环中查询 DOM（缓存 DOM 引用）
事件绑定在 DocumentFragment 或容器上，避免逐个绑定
定时器在 destroy 时全部清理
隐藏的玩偶不执行动画计算（不只是 CSS 隐藏）
#### 安全规范
所有用户可见文字用 textContent 赋值，禁止 innerHTML（防 XSS）
SVG 动态元素用 createElementNS 创建
不使用 eval 或 new Function
不引入任何第三方库或 CDN 资源

## 十、详细实现步骤
### 步骤 1：创建 js/desktop-pet.js（核心模块）
实现顺序建议： 1. 配置表（CHARACTERS / SNACKS / ACHIEVEMENTS / DIALOGUES） 2. Pet 类（基于附录 C 的 v1.0 规格扩展，注入角色配置，增加 feed/enter/exit/sayLine） 3. PetFamily 类（多实例管理 + 显示模式 + 串门 + 布局 + 共享 rAF） 4. 金币系统（addCoins/spendCoins + 任务监听 + 防刷机制） 5. 成就系统（checkAchievements + 成就横幅 UI） 6. 商店系统（ShopPanel 弹窗 UI + buySnack） 7. 喂养系统（FeedPanel 弹窗 UI + feedPet + 亲密度） 8. 互动系统（triggerInteraction + 对话播放） 9. autoInit（检测 Sonder 环境，创建 PetFamily，暴露 window.__desktopPetFamily）
### 步骤 2：创建 css/desktop-pet.css
在 v1.0 样式基础上增加： - 三角色颜色变量（.pet-xiaomo / .pet-xiaoyu / .pet-lanling） - 多玩偶布局样式（悬浮角落的排列） - 独立页面样式：三角色展示卡、设置分区、商店预览、成就列表（见 3.6 页面布局） - 商店弹窗（网格、卡片、购买按钮） - 喂食弹窗（小弹窗、零食选择） - 成就横幅（顶部滑入、金币飘字） - 金币飘字、喂食飞行、出场/离场动画
### 步骤 3：创建 js/desktop-pet-page.js（独立页面模块）
参考项目中 games.js 的页面编排模式，实现： 1. UMD 包装，暴露 window.DesktopPetPage 或直接注册到 Pages 2. Pages['desktop-pet'] = { title: '小莫灵家族', render: function(container, ctx) {...} } 3. render 函数按 3.6 节布局渲染五个分区： - 标题栏（标题 + 金币余额） - 三角色展示卡（SVG + 亲密度 + 喂食按钮） - 显示设置分区（模式/常驻/大小/开关） - 商店预览分区（库存摘要 + 打开商店按钮） - 成就分区（10 个成就的解锁状态） 4. 所有交互事件绑定（喂食、设置变更、打开商店等） 5. 页面打开时通知 PetFamily 暂停悬浮玩偶显示，页面离开时恢复
### 步骤 4：修改 index.html
在 css/style.css 后引入：
<link rel="stylesheet" href="css/desktop-pet.css">
在 js/app.js 之后、desktop-pet.js 之前引入页面模块（页面模块依赖核心模块的 PetFamily）：
<script src="js/desktop-pet.js" defer></script>
<script src="js/desktop-pet-page.js" defer></script>
### 步骤 5：修改 js/app.js（注册导航板块）
NAV 数组：在 'game' 之后、'settings' 之前插入 'desktop-pet'
var NAV = ['home', 'today', 'memo', 'selfmedia', 'dev', 'consulting',
           'reading', 'excerpts', 'news', 'design', 'game', 'desktop-pet', 'settings'];
ICONS 对象：增加 'desktop-pet': '🐾'
TOGGLEABLE 对象：增加 'desktop-pet': 1（可在设置页模块开关中隐藏/显示导航项）
导航构建逻辑无需修改（已通用处理 NAV 数组），但需确保 Pages['desktop-pet'] 已注册（由 desktop-pet-page.js 完成）
### 步骤 6：修改 js/store.js
在默认 settings.modules 中增加 desktopPet: true（模块开关，控制导航项显示）
在默认 settings 中增加完整的 desktopPet 对象（见第三章 3.5 节结构）
### 步骤 7：修改 js/store-settings.js
增加方法： - setDesktopPetEnabled(on) — 总开关（悬浮玩偶显示/隐藏） - setDesktopPetMode(mode) — 显示模式 single/duo/trio - setDesktopPetResident(id) — 常驻角色 - setDesktopPetSize(px) — 大小 - addDesktopPetCoins(amount, reason) — 加金币（由 PetFamily 调用） - spendDesktopPetCoins(amount) — 花金币（返回布尔） - feedDesktopPet(petId, snackId) — 喂食（扣库存+加亲密度+统计） - unlockDesktopPetAchievement(id) — 解锁成就
注意：金币/库存/亲密度的操作逻辑主要在 PetFamily 中，store 方法只负责持久化和事件广播。
### 步骤 8：修改 js/settings.js
在”模块开关”分区的模块列表中增加”桌面玩偶”（与其他业务模块一样的 checkbox）。 不需要在设置页增加桌面玩偶的详细设置分区（详细设置已移到独立板块），只保留模块总开关即可。
模块列表遍历 S.moduleList，需确认 moduleList 中是否包含 desktop-pet；如果是硬编码列表，需手动增加一项。
### 步骤 9：同步 Service Worker 缓存
运行 npm run sync-sw，将新增的 js/desktop-pet.js、js/desktop-pet-page.js、css/desktop-pet.css 加入缓存清单。
命令说明： - npm run sync-sw 是项目内置脚本（定义在 package.json 中，执行 node scripts/sync-sw.js） - 该脚本自动扫描项目中的静态资源文件（HTML/CSS/JS/图片等），更新 sw.js 中的缓存清单（CACHE_NAME 和 ASSETS 列表）和内容指纹（ASSET_SIG） - 什么时候需要跑：任何新增、删除、重命名静态文件后都必须运行，否则 PWA 离线模式下新文件不会被缓存，导致 404 - 怎么验证：运行后检查 sw.js 中的 ASSETS 列表是否包含新增的三个文件，ASSET_SIG 是否更新（哈希值变化） - 注意：该脚本只更新 sw.js，不会修改其他文件；运行后需要提交 sw.js 的变更
### 步骤 10：更新文档
README.md：功能列表增加”小莫灵家族桌面玩偶（养成系统）”
CHANGELOG.md：版本记录
PRD.md：功能清单同步

## 十一、测试与验证
### 11.1 现有测试回归
npm test 全量 584 项通过。
### 11.2 新增单元测试（建议）
tests/desktop-pet.test.js 覆盖： - CHARACTERS 配置完整性（3角色） - SNACKS 配置完整性（9种） - ACHIEVEMENTS 配置完整性（10个） - Pet 类构造/销毁 - PetFamily 显示模式切换（实例数量正确） - 金币操作（addCoins/spendCoins 余额不足） - 购买零食（扣金币+加库存） - 喂食（扣库存+加亲密度） - 成就检测（达成条件解锁+发金币） - 角色差异化（三实例参数不同）
### 11.3 手动验证清单

## 十二、风险与注意事项
### 12.1 性能风险
三玩偶同屏可能增加 CPU 占用。缓解：共享一个 rAF 循环（PetFamily 统一驱动），隐藏玩偶不运行动画，60fps 档位减少 CSS 动画。
### 12.2 数据安全
金币/亲密度存在 localStorage，用户可通过 DevTools 修改。缓解：本地单机工具，无服务端，数据篡改不影响他人，属可接受风险，不做防篡改校验。
### 12.3 对话库质量
第一版附录 E 提供 20 组互动对话（4 组合 × 5 组），质量直接影响体验。缓解：20 组已可上线，后续建议扩展到每种组合 8 组（约 32 组）以减少重复感。对话要符合角色性格，避免 OOC。
### 12.4 屏幕空间占用
三玩偶同屏在手机上可能遮挡内容。缓解：移动端（<640px）默认 single 模式，玩偶默认半透明（opacity 0.8），用户可拖拽位置。
### 12.5 实现复杂度（建议分阶段）
v2.0 比 v1.0 复杂很多。建议分三阶段实现，每阶段独立可上线： - Phase 1：三角色 + 显示模式 + 串门（核心多玩偶） - Phase 2：任务金币 + 商店 + 喂养 + 亲密度（养成闭环） - Phase 3：成就系统 + 多玩偶互动对话（锦上添花）
### 12.6 与现有模块耦合
金币系统依赖今日任务模块。缓解：通过事件总线 /data/tasks 监听，不直接依赖内部实现。任务完成判断通过对比变更前后 done 状态，做兼容处理。
### 12.7 无障碍（详细）
桌面玩偶系统需要满足基本的无障碍要求：
#### ARIA 标签
玩偶容器设置 role="img" + aria-label="小莫灵家族桌面玩偶，当前表情：xxx"（aria-label 随表情变化更新）
气泡对话设置 aria-live="polite" + aria-atomic="true"，让屏幕阅读器在新对话出现时朗读
装饰性元素（腮红、星星、zzz、汗珠等）设置 aria-hidden="true"
商店弹窗、喂食弹窗设置 role="dialog" + aria-modal="true" + aria-label
成就横幅设置 role="alert" + aria-live="assertive"
#### 键盘操作
所有交互按钮（喂食、购买、设置开关、显示模式切换）支持 Tab 键导航，焦点顺序合理
Enter 键触发按钮点击
Esc 键关闭所有弹窗（商店、喂食、设置抽屉）
商店弹窗打开时焦点自动移到第一个零食卡片，关闭时焦点回到触发按钮
玩偶本身不参与 Tab 导航（装饰性元素），但右键菜单的入口需要键盘可访问（通过菜单按钮或快捷键）
#### 屏幕阅读器体验
表情变化时更新 aria-label，但不要过于频繁（避免每帧更新，只在表情切换时更新）
金币变化时通过 aria-live 区域播报（“金币增加 10，当前余额 128”）
成就解锁时通过 role="alert" 播报
互动对话通过 aria-live="polite" 逐轮播报
#### 减少动画偏好
尊重 prefers-reduced-motion: reduce 媒体查询：
CSS 动画全部暂停（animation-duration: 0.01ms）
JS 动画降级（呼吸、弹跳、摇摆等持续动画停止，只保留表情切换的瞬时变化）
飘字动画、出场/离场动画改为直接显示/隐藏（无过渡）
串门机制仍可触发，但出场/离场无动画
提供设置项”减少动画”开关（与项目全局帧率设置联动，60fps 档位自动启用减少动画）
#### 颜色对比度
气泡文字与背景的对比度满足 WCAG AA（≥4.5:1）
商店价格、亲密度数字等关键信息确保在浅色/深色主题下都清晰可读
玩偶主体色与背景色有足够区分度（三个角色的颜色都经过对比度验证）
### 12.8 移动端适配（详细）
桌面玩偶系统在移动端（< 640px）需要特殊适配：
#### 移动端检测逻辑
检测方式：通过 window.innerWidth < 640 判断（不使用 userAgent，因为不可靠且难以维护）
检测时机：页面加载时检测一次，窗口 resize 时重新检测
默认值覆盖规则：
全新用户（无任何桌面玩偶配置）：移动端默认 single 模式、size=64px、opacity=0.8
已有配置的用户：保留用户手动设置的模式和尺寸，不强制覆盖（用户可能在手机上也想用 trio 模式）
用户手动切换模式后，该设置持久化，不再受移动端默认值影响
响应式变化：用户从手机横屏（宽度>640）转到竖屏（<640）时，玩偶布局自动调整（横向排列→纵向堆叠），但不改变用户设置的显示模式
#### 显示模式默认降级
移动端默认 single 模式（只显示常驻玩偶），避免三个玩偶占用过多屏幕空间
用户仍可手动切换到 duo/trio 模式，但页面会提示”小屏建议使用单玩偶模式”
duo 模式下串门玩偶出场时间间隔延长（12-20 分钟，减少干扰）
#### 三玩偶同屏布局
移动端 trio 模式下，玩偶改为纵向堆叠（右下角从上到下排列，间距 6px），而不是横向排列
每个玩偶尺寸自动缩小（移动端默认 size = 64px，而不是 84px）
玩偶默认 opacity 0.8（半透明），触摸时全不透明，减少对内容的遮挡
用户可通过设置调整大小和透明度
#### 页面布局适配
独立板块页面（小莫灵家族）在移动端：
三角色展示卡从横向排列改为纵向堆叠
设置分区的单选按钮组改为纵向排列
商店预览的库存摘要改为换行显示
成就列表从横向滚动改为网格布局（2列）
所有弹窗（商店、喂食）在移动端改为底部抽屉样式（从底部滑入，占满宽度，最大高度 80vh），而不是居中弹窗
#### 触摸操作
长按玩偶（500ms）触发右键菜单（与桌面端右键等效）
单指拖拽玩偶（与桌面端鼠标拖拽等效）
点击玩偶触发点击反应
触摸时禁用鼠标事件（避免双重触发），使用 touch-action: none 防止页面滚动干扰拖拽
触摸反馈：按下时玩偶轻微放大（scale 1.05），提供触觉反馈感
#### 性能考虑
移动端 CPU 性能较弱，trio 模式下自动降低动画质量：
装饰性 CSS 动画（光晕脉冲、高光闪烁、星星闪烁）全部停止
JS 动画的弹簧插值精度降低
串门间隔延长，互动触发概率降低
移动端默认 60fps 档位（如果项目有自动检测机制）
### 12.9 首次使用引导
新用户第一次使用桌面玩偶时，需要简单的引导说明： 1. 首次启动检测：通过 desktopPet.firstRun 标志位判断（默认 true，首次引导完成后置为 false） 2. 引导内容： - 玩偶出现时播放一个 wave 打招呼表情 + 气泡”你好呀！我是小莫~ 点击我看看会发生什么吧！” - 3 秒后气泡变为”右键点击我可以打开菜单，喂零食、调设置哦~” - 再 3 秒后气泡消失，引导完成，设置 firstRun = false 3. 引导可跳过：用户点击玩偶或右键打开菜单时，立即结束引导 4. 页面首次引导：用户第一次进入”小莫灵家族”页面时，页面顶部显示一个提示条”这里可以管理玩偶、买零食、看成就，试试看吧~“，3 秒后自动消失 5. 不强制引导：所有引导都是轻量提示，不使用遮罩层或强制点击，不打扰用户
### 12.10 国际化（i18n）考虑
第一版所有文案为中文硬编码，但需要为后续国际化预留空间： 1. 文案集中管理：所有用户可见的文案（按钮文字、提示语、成就名称、商店描述等）集中在配置表顶部的 STRINGS 对象中，不要散落在代码各处 2. 角色语录和对话：语录库（QUOTES）和对话库（DIALOGUES）本身就是按语言组织的，后续增加其他语言时只需增加对应语言的语录/对话对象 3. 数字和日期格式：金币数字、日期字符串等使用本地化格式（toLocaleString、toLocaleDateString），不要硬编码格式 4. SVG 中的文字：尽量避免在 SVG 中使用文字（装饰元素如 zzz、?、! 等符号除外，这些是通用的），所有用户可读文字放在 HTML 气泡中 5. 第一版不实现多语言切换：但代码结构要支持，后续增加语言切换时只需替换 STRINGS/QUOTES/DIALOGUES 对象，不需要改逻辑代码
### 12.11 常见问题（FAQ）
Q：为什么不直接用 emotion-ball？ A：emotion-ball 使用非商业许可证（NC），与 sonder520 的 MIT 许可证冲突。MIT 允许下游商用，但 NC 禁止商用，集成后会产生法律风险。详见附录 G 的 ADR-001。
Q：三个玩偶会拖慢页面吗？ A：不会。三个玩偶共享一个 rAF 循环，隐藏的玩偶不运行动画，页面切后台时循环暂停。正常情况下 CPU 占用 < 1%。详见 9.4 节。
Q：用户修改 localStorage 金币怎么办？ A：这是本地单机工具，无服务端，数据篡改不影响他人，属可接受风险。不做防篡改校验。详见 12.2 节。
Q：为什么关闭模块开关后玩偶还在？ A：模块开关（modules.desktopPet）只控制导航项显示，系统总开关（desktopPet.enabled）控制玩偶启停。两个开关职责不同，互相独立。详见 3.5 节”两个开关的关系”。
Q：串门玩偶什么时候出现？ A：duo 模式下每 8-15 分钟随机触发一次，停留 2-4 分钟。也可以通过右键菜单”叫小伙伴来玩”手动召唤（受角色 10 分钟冷却限制）。
Q：金币会过期吗？ A：不会。金币永久保存在本地，不清零。
Q：亲密度有上限吗？ A：第一版无上限，也不衰减。达到 50/100/200/500 时有特殊庆祝反应。
Q：可以只显示一个玩偶吗？ A：可以。在独立板块页面的显示设置中选择”单玩偶”模式，并选择常驻角色。
Q：手机上三个玩偶会不会挡屏幕？ A：移动端默认 single 模式（只显示一个），尺寸缩小到 64px，半透明。用户仍可手动切换到 duo/trio。详见 12.8 节。
Q：后续想加新角色怎么办？ A：只需在 CHARACTERS 配置表中增加一个角色对象（颜色、参数、语录），不需要修改 Pet 类和 PetFamily 的核心逻辑。详见 2.5 节。
Q：后续想加角色喜好零食系统怎么办？ A：零食配置已预留 preference 字段，角色配置可增加 preferences 字段。喂食时检查喜好，匹配则亲密度 ×1.5。数据结构不需要迁移。
Q：实现过程中发现文档有遗漏或矛盾怎么办？ A：优先按文档明确写出的规格实现；文档未明确的细节，参考项目现有代码风格和惯例做出合理决策，并在代码注释中标注”TODO: 规格未明确”。

## 附录 A：语录库结构
语录按角色 + 场景分类，每个角色每个场景至少 5-8 条：
QUOTES = {
  xiaomo: {
    idle/happy/thinking/sleepy/excited/wave/focus/sad/
    surprised/proud/relax/confused/encourage/busy/goodbye/
    feed/achievement/coinEarn: [...]
  },
  xiaoyu: { /* 同上 */ },
  lanling: { /* 同上 */ }
}
## 附录 B：互动对话库结构
DIALOGUES = {
  'xiaomo+xiaoyu': [
    { type: 'chat', lines: [
      { speaker: 'xiaomo', text: '...' },
      { speaker: 'xiaoyu', text: '...' }
    ]},
  ],
  'xiaomo+lanling': [/* ... */],
  'xiaoyu+lanling': [/* ... */],
  'trio': [/* 三角色对话 */]
}

## 附录 C：单玩偶核心实现规格（Pet 类前置基础）
本附录为 v1.0 单玩偶的完整技术规格，v2.0 的 Pet 类在此基础上扩展（注入角色配置、增加喂食/出场离场等方法）。AI agent 必须先理解本附录内容，再实现 v2.0 的 PetFamily 扩展。
### C.1 15 种表情完整配置表
每种表情的配置字段：name（名称）、breathe（呼吸幅度）、blink（眨眼间隔 [min,max] ms）、eyes（眼睛配置 shape/lookX/lookY/scaleY）、mouth（嘴巴配置 type/w/h）、decor（装饰元素列表）、特殊动画标记。
表情切换规则： - 每个表情可设置持续时间（duration），到期自动恢复 idle - duration = 0 表示持续保持 - 表情优先级：surprised > busy > excited > proud > encourage > happy > thinking > confused > focus > relax > wave > sleepy > sad > goodbye > idle - 冷却机制：同一表情 5 秒内不重复触发，高优先级可打断低优先级
### C.2 完整 SVG 结构（viewBox=“0 0 100 100”）
<svg viewBox="0 0 100 100" width="100%" height="100%" style="overflow:visible">
  <defs>
    <radialGradient id="dpBodyGrad" cx="38%" cy="32%" r="70%">
      <stop offset="0%" stop-color="var(--dp-body-light,#fff)"/>
      <stop offset="55%" stop-color="var(--dp-body,#c23b2e)"/>
      <stop offset="100%" stop-color="var(--dp-body-dark,#8f2d1f)"/>
    </radialGradient>
    <radialGradient id="dpGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="var(--dp-body,#c23b2e)" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="var(--dp-body,#c23b2e)" stop-opacity="0"/>
    </radialGradient>
    <filter id="dpInk" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="blur"/>
      <feOffset in="blur" dx="0" dy="2" result="offset"/>
      <feComponentTransfer in="offset" result="shadow">
        <feFuncA type="linear" slope="0.25"/>
      </feComponentTransfer>
      <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- 光晕（底层） -->
  <ellipse class="dp-glow" cx="50" cy="52" rx="42" ry="40" fill="url(#dpGlow)"/>

  <!-- 身体组（可整体变换） -->
  <g class="dp-body-group">
    <!-- 身体：墨滴形状 -->
    <path class="dp-body" d="M50 12 C68 12 82 28 82 48 C82 68 72 84 50 86 C28 84 18 68 18 48 C18 28 32 12 50 12 Z"
          fill="url(#dpBodyGrad)" filter="url(#dpInk)"/>
    <!-- 高光 -->
    <ellipse class="dp-highlight" cx="38" cy="30" rx="10" ry="7" fill="rgba(255,255,255,0.35)"/>
    <!-- 眼睛组（左眼 x=38，右眼 x=62，y=48） -->
    <g class="dp-eyes">
      <g class="dp-eye-l" transform="translate(38,48)"></g>
      <g class="dp-eye-r" transform="translate(62,48)"></g>
    </g>
    <!-- 嘴巴（y=62 基准线） -->
    <path class="dp-mouth" fill="none" stroke="var(--dp-mouth,rgba(43,38,32,0.7))"
          stroke-width="2" stroke-linecap="round"/>
    <!-- 腮红（左右各一，默认 opacity=0） -->
    <ellipse class="dp-blush-l" cx="30" cy="56" rx="5" ry="3" fill="rgba(255,120,100,0.4)" opacity="0"/>
    <ellipse class="dp-blush-r" cx="70" cy="56" rx="5" ry="3" fill="rgba(255,120,100,0.4)" opacity="0"/>
    <!-- zzz（困倦） -->
    <text class="dp-zzz" x="72" y="28" font-size="10" font-weight="700"
          fill="var(--muted,#6f675c)" opacity="0">z</text>
    <!-- 星星眼（兴奋） -->
    <text class="dp-star-l" x="34" y="52" font-size="10" fill="#f5c542" opacity="0">★</text>
    <text class="dp-star-r" x="58" y="52" font-size="10" fill="#f5c542" opacity="0">★</text>
    <!-- 挥手鳍（wave/goodbye） -->
    <path class="dp-wave-fin" d="M82 50 Q92 44 90 36 Q86 40 80 46 Z"
          fill="var(--dp-body-dark,#8f2d1f)" opacity="0" transform-origin="82px 50px"/>
    <!-- 思考气泡（thinking） -->
    <g class="dp-think" opacity="0">
      <circle cx="72" cy="30" r="2" fill="var(--muted,#6f675c)"/>
      <circle cx="78" cy="24" r="1.5" fill="var(--muted,#6f675c)"/>
      <circle cx="82" cy="18" r="1" fill="var(--muted,#6f675c)"/>
    </g>
    <!-- 感叹号（surprised） -->
    <g class="dp-exclaim" opacity="0">
      <rect x="74" y="14" width="3" height="8" rx="1.5" fill="var(--accent,#c23b2e)"/>
      <circle cx="75.5" cy="26" r="1.8" fill="var(--accent,#c23b2e)"/>
    </g>
    <!-- 问号（confused） -->
    <text class="dp-question" x="72" y="22" font-size="12" font-weight="700"
          fill="var(--muted,#6f675c)" opacity="0">?</text>
    <!-- 闪光（proud） -->
    <g class="dp-sparkle" opacity="0">
      <path class="dp-sparkle-l" d="M28 18 L30 22 L34 24 L30 26 L28 30 L26 26 L22 24 L26 22 Z" fill="#f5c542"/>
      <path class="dp-sparkle-r" d="M72 16 L73.5 19 L77 20.5 L73.5 22 L72 25 L70.5 22 L67 20.5 L70.5 19 Z" fill="#f5c542"/>
    </g>
    <!-- 放松波纹（relax） -->
    <g class="dp-relax-waves" opacity="0">
      <path class="dp-wave-1" d="M12 50 Q6 50 6 56 Q6 62 12 62" fill="none"
            stroke="var(--accent,#c23b2e)" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
      <path class="dp-wave-2" d="M88 50 Q94 50 94 56 Q94 62 88 62" fill="none"
            stroke="var(--accent,#c23b2e)" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
    </g>
    <!-- 上升箭头（encourage） -->
    <g class="dp-arrow-up" opacity="0">
      <path d="M78 24 L78 14 M74 17 L78 12 L82 17" fill="none"
            stroke="var(--ok,#2e7d63)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <!-- 汗珠（busy） -->
    <g class="dp-sweat" opacity="0">
      <path class="dp-sweat-l" d="M32 36 Q30 40 32 42 Q34 40 32 36 Z" fill="rgba(100,160,220,0.7)"/>
      <path class="dp-sweat-r" d="M68 36 Q66 40 68 42 Q70 40 68 36 Z" fill="rgba(100,160,220,0.7)"/>
    </g>
  </g>
</svg>
DOM 创建方式：使用 document.createElementNS('http://www.w3.org/2000/svg', tagName) 逐个创建元素。defs 部分可用 innerHTML 一次性写入（不涉及动态命名空间问题），动态元素必须用 createElementNS。
### C.3 眼睛绘制规则（6 种形状 + 2 种特殊）
眼睛在每帧动态重绘（清空 <g> 后重新 append）：
特殊处理： - confused（asymmetric）：左眼用 dot 且 lookY=-2（向上看），右眼用 arc 且 scaleY=0.5（眯眼）。_drawEye 接收 side 参数区分左右。 - busy（darting）：双眼用 dot，lookX 每 150ms 翻转一次（+3 ↔ -3），模拟快速扫视。在 _tick 中维护计时器。
眨眼：对整个眼睛 <g> 做 scale(1, eyeScaleY)，eyeScaleY 由 sin 函数驱动 1→0.1→1，动画时长 150ms。wide 形状眨眼时 scaleY 下限 0.15（惊讶时不完全闭眼）。
### C.4 嘴巴绘制规则（9 种类型）
嘴巴为单条 path 或填充形状，y 基准线=62，stroke-width=2，stroke-linecap=round：
### C.5 动画循环设计（requestAnimationFrame）
所有玩偶共享一个 rAF 循环（由 PetFamily 统一驱动），帧率无关（基于 dt）。每帧执行：
计算 dt = (currentTime - lastTime) / 1000，上限 0.05s（防止切后台后跳变）
表情超时检测：duration>0 且已超时 → 恢复 idle
目标表情过渡：emotion !== targetEmotion → 切换，更新装饰元素 opacity
呼吸更新：breathe += dt2，breatheScale = 1 + sin(breathe)  amplitude
注视平滑：lookX += (targetLookX - lookX) * min(dt*8, 1)，lookY 同理
表情专属动画：
bounce：bounceY = |sin(t/200)| * -4
wobble：wobble = sin(t/600) * 3（busy 用 t/300 频率翻倍）
wave：waveAngle = sin(t/150) * 20（goodbye 用 t/600 更慢）
stretch：scaleY 增大 scaleX 减小
recoil/chest/sink/lean：translateY 偏移
tilt：rotate 角度
眨眼状态更新：blinking 时 eyeScaleY = 1 - sin(btPI)0.9，150ms 后结束并调度下次眨眼
应用身体变换：bodyG 的 transform = translate(0, bounceY+sink) rotate(wobble+tilt, 50,50) scale(breatheScale, 1/breatheScale)
应用眼睛位置：eyeL/eyeR 的 transform = translate(38+lookX+emoLookX, 48+lookY+emoLookY) scale(1, eyeScaleY*emoScaleY)
重绘眼睛：调用 _drawEye(g, shape, scaleY, side)
重绘嘴巴：调用 _drawMouth(config)
装饰元素动画：
光晕：glowScale = 1 + sin(breathe)*0.05，应用到 rx/ry
星星闪烁：opacity = 0.7 + sin(t/100)*0.3
zzz 飘动：y = 28 - (t/30 % 20)，opacity = 1 - (t/30 % 20)/20
思考气泡浮动：translateY = sin(t/400)*2
汗珠滑落：translateY 递增 + opacity 渐隐，循环
放松波纹扩散：stroke-dashoffset 或 scale+opacity 渐隐
#### 页面切后台时的处理（visibilitychange）
当用户切换到其他标签页或最小化浏览器时，document.hidden 变为 true，此时： 1. 暂停 rAF 循环：PetFamily 监听 visibilitychange 事件，页面隐藏时调用 cancelAnimationFrame 停止循环，避免后台空转消耗 CPU 2. 暂停所有定时器：串门触发计时、互动冷却计时、眨眼调度、待机语录调度等全部暂停（记录已过时间，恢复时续算，不是重置） 3. 页面恢复时：document.hidden 变为 false 时，重新启动 rAF 循环，恢复所有定时器（从暂停时的状态继续，不是从头开始） 4. dt 保护：即使没有暂停 rAF，dt 上限 0.05s 也能防止切后台很久后回来时动画跳变 5. 串门/互动状态：如果切后台时正在播放串门或互动对话，恢复时继续播放剩余部分（不因为切后台就中断）
### C.6 Pet 类完整方法列表
Pet（原型链方式，ES5 风格）
├── 构造函数(options)
│   ├── container, size, color, position, enabled, autoIntegrate
│   ├── character（v2.0 新增：角色配置注入）
│   ├── emotion/targetEmotion/emotionStart/emotionDuration
│   ├── 动画状态：breathe/blink/lookX/lookY/bounceY/wobble 等
│   ├── 交互状态：dragging/dragOffset/hovering/bubbleTimer/idleTimer
│   ├── 集成引用：bus/store/unsubs
├── _build()                     构建 DOM/SVG（含气泡、所有装饰元素）
├── _bindEvents()                绑定 mousedown/mousemove/mouseup/click/touch/resize
├── _start()                     启动动画（rAF 由 PetFamily 统一驱动时此方法简化）
├── _tick(dt, t)                 每帧更新（见 C.5 动画循环）
├── _drawEye(g, shape, scaleY, side)  绘制眼睛（见 C.3）
├── _drawMouth(config)           绘制嘴巴（见 C.4）
├── _scheduleBlink()             调度下次眨眼（随机间隔）
├── _scheduleIdleQuote()         调度待机语录（15-30秒，40%概率）
├── _checkLateNight()            深夜检测（23-6点 idle→sleepy）
├── _tryIntegrate()              尝试接入 SonderBus/SonderStore
├── _onDataChange(path)          数据变更反应
├── _onSettingsChange()          设置变更响应
├── _applyPosition(pos)          应用位置
├── _savePosition()              保存位置（store 优先，localStorage fallback）
├── _loadPosition()              加载位置
├── setEmotion(name, duration)   设置表情（公开）
├── getEmotion()                 获取当前表情（公开）
├── say(text, duration)          显示气泡（公开）
├── sayLine(text, duration)      互动对话专用气泡（v2.0 新增，公开）
├── setSize(px)                  调整大小（公开）
├── show() / hide()              显示隐藏（公开）
├── feed(snackId)                喂食（v2.0 新增，公开）
├── enter(fromSide)              出场动画（v2.0 新增，公开）
├── exit(toSide)                 离场动画（v2.0 新增，公开）
└── destroy()                    销毁（移除监听/定时器/DOM）
### C.7 颜色体系与 CSS 变量
玩偶颜色通过 CSS 变量定义，每个角色实例独立设置：
--dp-body: var(--accent, #c23b2e);        /* 主体色 */
--dp-body-light: #fff;                       /* 高光端渐变 */
--dp-body-dark: #8f2d1f;                     /* 暗端渐变 */
--dp-eye: rgba(43, 38, 32, 0.85);          /* 眼睛颜色 */
--dp-mouth: rgba(43, 38, 32, 0.7);         /* 嘴巴颜色 */
--dp-bubble-bg: var(--glass, rgba(255,255,255,0.85));  /* 气泡背景 */
三角色通过 .pet-xiaomo / .pet-xiaoyu / .pet-lanling class 覆盖这些变量。深色主题 [data-theme="dark"] 下眼睛/嘴巴颜色自动适配。
### C.8 位置持久化
存储优先级：SonderStore（store.state.settings.desktopPet.positions[角色ID]）→ localStorage（sonder.desktopPet.pos.角色ID）
保存时机：拖拽结束（mouseup/touchend）且移动距离 > 3px
约束：位置不超出视口（0 ≤ x ≤ innerWidth-size，0 ≤ y ≤ innerHeight-size）
默认位置：右下角，距右/下边各 24px
### C.9 事件总线集成（SonderBus）
订阅 /data/* → _onDataChange(path)：根据路径前缀触发表情（tasks/memos→happy，designs/dev→thinking）
订阅 /data/settings → _onSettingsChange()：响应开关/大小变化
v2.0 新增：PetFamily 订阅 /data/tasks → 检测任务完成 → 发放金币 + 检测成就
内部事件（金币变更、成就解锁、喂食）直接调用，不走 SonderBus
### C.10 气泡对话组件
DOM 结构：<div class="dp-bubble">，位于玩偶头顶上方
样式：液态玻璃（backdrop-filter blur），带小尾巴（CSS ::after 三角形）
显示：添加 .dp-show class，opacity 0→1，transform translateY(8px)→0
隐藏：移除 .dp-show，3 秒后自动隐藏（可配置 duration）
最大宽度 200px，文字自动换行，textContent 赋值（防 XSS）
v2.0 互动对话：调用 sayLine()，与普通 say() 共用 UI，但由 PetFamily 控制逐轮播放

## 附录 D：完整语录库（3 角色 × 18 场景 × 5 条 = 270 条）
语录写作规范： - 小莫：活泼机灵幽默，多用感叹号、网络用语、俏皮吐槽，语气轻快 - 小余：责任担当成熟稳重，多用句号、沉稳鼓励、有条理，语气平和 - 懒零：贪吃贪睡无忧无虑，多用省略号、拖长语气、吃睡相关，语气慵懒 - AI agent 可按此风格每条再扩展 2-3 条，但必须保持角色一致性，禁止 OOC（角色崩坏）
### D.1 小莫语录
### D.2 小余语录
### D.3 懒零语录
### D.4 语录使用规则
每个场景从对应 5 条中随机选取，避免连续重复（记录上一条，下一次不选同一条）
待机语录（idle）触发概率 40%，间隔 15-30 秒
事件触发表情时，50% 概率同时显示对应场景语录
喂食语录（feed）每次喂食必显示，持续 3 秒
成就语录（achievement）和金币语录（coinEarn）在对应事件发生时显示
所有语录通过 textContent 赋值到气泡，禁止 innerHTML（防 XSS）
AI agent 扩展语录时必须严格遵守角色写作规范，禁止小莫说沉稳的话、禁止小余用感叹号、禁止懒零说积极向上的话

## 附录 E：完整互动对话库（4 组合 × 5 组 = 20 组）
对话为 2-4 轮短对话，每轮 1 个角色说话。播放时每轮间隔 1.5-2.5 秒，气泡显示 3 秒。 AI agent 可按每组风格再扩展 3-5 组，但必须保持角色性格和对话逻辑。
### E.1 小莫 + 小余（5 组）
第 1 组（chat · 日常闲聊） - 小莫：“小余小余，你看我今天是不是特别帅？” - 小余：“……你开心就好。” - 小莫：“嘿嘿，我就当你夸我了！” - 小余：“嗯。”
第 2 组（comfort · 小余安慰小莫） - 小莫：“唉……今天任务没做完，好挫败……” - 小余：“没关系，剩下的明天再做。你今天已经很努力了。” - 小莫：“真的吗……？” - 小余：“真的。先休息，明天我陪你一起。”
第 3 组（tease · 小莫逗小余） - 小莫：“小余小余，你怎么总是这么严肃？笑一个嘛~” - 小余：“……我在认真做事。” - 小莫：“认真做事也可以笑呀！你看我——（做鬼脸）” - 小余：“……（嘴角微扬）幼稚。”
第 4 组（chat · 讨论任务） - 小莫：“今天任务好多啊……做不完了怎么办？” - 小余：“按优先级排序，先做重要的。剩下的分批处理。” - 小莫：“有道理！那我先去摸个鱼——” - 小余：“……先做最重要的那件。” - 小莫：“好啦好啦，知道了~”
第 5 组（sync · 一起鼓励用户） - 小莫：“一二三——” - 小余：“今天也辛苦了。” - 小莫：“你超棒的！继续加油！” - 小余：“我们都在。”
### E.2 小莫 + 懒零（5 组）
第 1 组（tease · 小莫叫懒零起床） - 小莫：“懒零！别睡了起来玩！” - 懒零：“……不要，被窝里好舒服……” - 小莫：“再睡就要变成球啦！” - 懒零：“……球就球，球也很可爱。”
第 2 组（chat · 讨论吃的） - 小莫：“懒零懒零，你说世界上最好吃的东西是什么？” - 懒零：“……只要是吃的，都好吃。” - 小莫：“那你最想吃什么？” - 懒零：“……现在最想吃的……是你手里的零食。” - 小莫：“嘿！你倒是不傻！”
第 3 组（play · 一起玩闹） - 小莫：“懒零！来玩游戏！我追你跑！” - 懒零：“……跑不动……你追我，我也不跑。” - 小莫：“那玩什么？” - 懒零：“……比赛谁先睡着。” - 小莫：“……这算什么游戏啊！”
第 4 组（comfort · 小莫安慰懒零） - 小莫：“懒零你怎么了？看起来闷闷不乐的。” - 懒零：“……今天的零食吃完了……好难过……” - 小莫：“就这？走！我请你吃！” - 懒零：“！！！真的吗！！你是世界上最好的人！” - 小莫：“哈哈，吃完要陪我玩哦！”
第 5 组（chat · 懒零的人生哲学） - 小莫：“懒零，你每天除了吃就是睡，不觉得无聊吗？” - 懒零：“……不无聊呀。吃的时候很幸福，睡的时候很舒服。” - 小莫：“那你就没有什么梦想吗？” - 懒零：“……梦想？嗯……每天都有吃不完的零食，和睡不完的觉。” - 小莫：“……还真是符合你的风格。”
### E.3 小余 + 懒零（5 组）
第 1 组（comfort · 小余照顾懒零） - 小余：“懒零，今天任务都完成了吗？” - 懒零：“还没……好困……” - 小余：“先睡一会儿吧，醒了我陪你做。” - 懒零：“小余最好了……zzZ……” - 小余：“……（轻轻盖上被子）”
第 2 组（chat · 小余提醒懒零吃饭） - 小余：“懒零，该吃饭了。” - 懒零：“……不饿……再睡会儿……” - 小余：“你昨天也是这么说的，然后半夜起来找吃的。” - 懒零：“……好吧，那我勉为其难去吃一点。” - 小余：“这才对。”
第 3 组（tease · 懒零撒娇） - 懒零：“小余……我好累……可以不做任务吗？” - 小余：“不可以。做完再休息。” - 懒零：“就一次嘛……好不好嘛……” - 小余：“……做完这件，我让你睡半小时。” - 懒零：“成交！！”
第 4 组（chat · 讨论周末计划） - 小余：“周末有什么计划？” - 懒零：“……睡觉。” - 小余：“除了睡觉呢？” - 懒零：“……睡醒了吃，吃完了继续睡。” - 小余：“……出门走走吧，对你身体好。” - 懒零：“……出门的话……有好吃的吗？” - 小余：“有。” - 懒零：“那我去！”
第 5 组（sync · 一起鼓励用户） - 小余：“今天的任务完成得不错。” - 懒零：“……好厉害……（鼓掌）” - 小余：“辛苦了，休息一下吧。” - 懒零：“……休息！我最擅长了！”
### E.4 三人一起（5 组）
第 1 组（sync · 集体加油） - 小莫：“一二三——” - 小余：“今天也辛苦了。” - 懒零：“……加油……（打哈欠）” - 小莫：“你超棒的！继续冲！” - 小余：“我们都在。” - 懒零：“……冲完可以吃零食吗？” - 小莫：“哈哈哈哈当然可以！”
第 2 组（chat · 讨论谁最靠谱） - 小莫：“你们说，咱们三个谁最靠谱？” - 小余：“……” - 懒零：“……反正不是我。” - 小莫：“那肯定是小余啦！成熟稳重可靠！” - 小余：“……谢谢。” - 懒零：“那谁最不靠谱？” - 小莫：“……（看向懒零）” - 懒零：“……看我干嘛，我只是爱吃爱睡，又不闯祸。” - 小余：“……都靠谱。”
第 3 组（play · 小莫组织活动） - 小莫：“大家！我们来玩个游戏吧！” - 小余：“什么游戏？” - 懒零：“……可以躺着玩吗？” - 小莫：“比赛谁先把今天的任务做完！” - 懒零：“……我退出。” - 小余：“……我参加。” - 小莫：“懒零你别走！赢了有零食！” - 懒零：“……我突然觉得我可以了。”
第 4 组（comfort · 集体安慰用户） - 小莫：“唉……今天好像什么都没做好……” - 小余：“没关系。你已经尽力了。” - 懒零：“……吃点好吃的，睡一觉，明天就好了。” - 小莫：“对！懒零说得对！没有什么是一顿好吃的解决不了的！” - 小余：“如果有，就两顿。” - 懒零：“……三顿也行。”
第 5 组（chat · 深夜闲聊） - 小莫：“你们说，用户现在在干嘛呢？” - 小余：“应该在休息。夜深了。” - 懒零：“……好羡慕……我也想睡……” - 小莫：“那你睡呀！” - 懒零：“……你们聊天太吵了，睡不着。” - 小余：“……那我们安静一点。” - 小莫：“好好好，嘘——” - （三个都安静了，只有懒零的呼噜声……）
### E.5 对话播放规则
互动触发时，从对应组合的 5 组中随机选取一组（记录上一组，避免连续重复）
按对话剧本逐轮播放，每轮间隔 1.5-2.5 秒（随机），气泡显示 3 秒
播放期间，参与角色的表情根据对话内容变化（比如小莫说开心的话时做 happy，懒零说困的话时做 sleepy）
播放期间用户点击任意参与角色，立即结束当前对话，然后正常响应用户点击
对话结束后，参与角色恢复 idle，进入互动冷却（3-6 分钟内不再触发）
三人对话需要三个玩偶都在屏幕上（trio 模式或 duo 模式串门时恰好三个都在）
AI agent 扩展对话时必须保证：每轮对话有逻辑关联、角色不 OOC、对话长度 2-4 轮、结尾自然（不要戛然而止）

## 附录 F：术语表

## 附录 G：关键设计决策记录（ADR）
ADR（Architecture Decision Record）记录重要设计决策的背景、选择和理由，帮助后续维护者理解”为什么这么设计”。
### ADR-001：完全原创实现，不集成 emotion-ball
背景：用户最初考虑将 GitHub 项目 sam70361/emotion-ball 集成到 sonder520 中作为桌面玩偶
决策：完全从零原创实现，不参考、不复制 emotion-ball 的任何代码
理由：
emotion-ball 使用非商业许可证（NC），与 sonder520 的 MIT 许可证冲突
MIT 允许下游商用，但 NC 禁止商用，集成后下游用户商用会违反 emotion-ball 条款
许可证冲突的责任会追溯到集成者（sonder520 维护者）
原创实现可完全掌控代码质量、架构设计和后续扩展
影响：开发工作量增加，但无法律风险，代码风格与项目完全一致
### ADR-002：三角色共用一套 SVG 结构和 Pet 类
背景：三个角色外观不同，可能需要三套独立的渲染代码
决策：共用同一套 SVG 结构和 JS 类，通过 CSS 变量 + 配置参数差异化
理由：
三个角色的身体形状相同（墨滴形），只是颜色、大小、眼睛/嘴巴参数不同
共用代码减少维护成本，修复 bug 一次生效
新增角色只需增加配置，不需要写新类
影响：Pet 类需要支持角色配置注入，CSS 变量体系需要设计完善
### ADR-003：数据存在 settings 下而非独立存储
背景：桌面玩偶数据（金币、亲密度、库存等）可能需要独立的存储方案
决策：所有数据存在 store.state.settings.desktopPet 下
理由：
数据量小（几十个字段），不需要 IndexedDB
跟随 settings 的持久化和备份导出机制，零额外成本
桌面玩偶本质是设置/偏好类数据，不是业务记录
影响：数据迁移需要深合并处理，导入备份时整体替换
### ADR-004：共享单个 rAF 循环而非每实例独立循环
背景：每个 Pet 实例可以有自己的 requestAnimationFrame 循环
决策：所有 Pet 共享一个 rAF 循环，由 PetFamily 统一驱动
理由：
三个独立 rAF 循环会增加 CPU 占用，尤其在低端设备上
共享循环可以统一控制暂停/恢复（页面隐藏、页面模式）
帧率无关的 dt 计算确保不同设备上动画速度一致
影响：Pet 类的 _tick(dt, t) 由 PetFamily 调用，Pet 不自己启动 rAF
### ADR-005：两个独立开关而非一个
背景：可以只用一个开关控制桌面玩偶的启用/禁用
决策：设置两个独立开关：modules.desktopPet（导航项显示）和 desktopPet.enabled（系统启停）
理由：
用户可能想隐藏导航入口但保留悬浮玩偶（不常访问页面但喜欢玩偶陪伴）
用户可能想暂时关闭玩偶但保留导航入口（方便重新开启）
两个需求正交，合并成一个开关会牺牲灵活性
影响：需要在文档中明确说明两个开关的关系，避免用户困惑
### ADR-006：独立导航板块而非设置页子页面
背景：桌面玩偶的设置和商店可以放在设置页中
决策：在导航栏”游戏”下方新增独立板块”小莫灵家族”
理由：
桌面玩偶是一个完整的功能模块（角色展示、商店、成就、设置），不只是一个设置项
独立板块有更大的展示空间，可以放角色大图和互动
放在导航栏中提高可见性和用户参与度
设置页保持简洁，只保留模块总开关
影响：需要新建 desktop-pet-page.js，修改 app.js 导航注册
### ADR-007：第一版无角色喜好系统
背景：可以设计每个角色喜欢/讨厌特定零食，喂养喜好零食加更多亲密度
决策：第一版所有零食对所有角色加相同亲密度，预留 preference 字段
理由：
用户明确要求”先做没有喜好，按价格越贵加的亲密值越多”
喜好系统增加复杂度（需要UI提示、语录分支），第一版先验证核心玩法
预留字段确保后续升级不需要数据迁移
影响：9 种零食的亲密度只与价格挂钩，性价比随价格递增
### ADR-008：金币防刷采用”只加不减”策略
背景：用户取消已完成的任务时，理论上应该扣除已发放的金币
决策：取消任务不扣金币，但任务ID保留在已奖励列表中（再次勾选不重复发放）
理由：
“只加不减”逻辑简单，不会出现金币扣成负数的边界情况
单机工具无服务端校验，复杂的扣减逻辑容易被利用
配合会话上限（100金币/会话）和已奖励ID记录，已足够防止异常
影响：用户理论上可以通过勾选→取消→勾选不同任务来刷金币，但会话上限限制了总量

## 附录 H：分阶段验收标准
对应第十二章 12.5 节的三阶段实现计划，每个阶段有明确的完成标准。
### Phase 1 验收：三角色 + 显示模式 + 串门
功能验收： - [ ] 页面加载后右下角出现常驻玩偶（默认小莫，琥珀橙色） - [ ] 三个角色外观正确：小莫橙/略小/弹跳，小余蓝/略高/沉稳，懒零绿/最圆/常半闭眼 - [ ] 三个角色的呼吸频率、眨眼间隔、待机动作符合第二章配置 - [ ] single 模式只显示常驻玩偶 - [ ] duo 模式（默认）：常驻玩偶始终显示，另一个角色 8-15 分钟内串门出场 - [ ] 串门玩偶从右侧滑入（600ms），挥手打招呼，停留 2-4 分钟后挥手滑出（500ms） - [ ] trio 模式三个玩偶同时显示，横向排列不重叠 - [ ] 切换常驻角色即时生效，拖拽位置独立持久化 - [ ] 串门玩偶不可拖拽，常驻玩偶可拖拽 - [ ] 右键菜单包含：喂零食（灰态，Phase 2 实现）、商店（灰态）、叫小伙伴来玩、隐藏 - [ ] 手动召唤串门玩偶可无视触发间隔（受角色冷却 10 分钟限制） - [ ] 页面切后台时 rAF 暂停，恢复后续算 - [ ] 独立板块页面显示三角色展示卡（SVG 动画 + 名称 + 描述） - [ ] 页面打开时悬浮玩偶隐藏，离开时恢复 - [ ] 显示设置分区可切换模式/常驻/大小/总开关，即时生效并持久化
技术验收： - [ ] 所有玩偶共享一个 rAF 循环（Performance 面板验证只有一个 rAF） - [ ] 三玩偶同屏单帧 < 16ms（60fps） - [ ] 刷新页面后位置/模式/常驻角色保持 - [ ] 现有 584 项测试全部通过 - [ ] 深色主题下玩偶颜色正常 - [ ] 移动端默认 single 模式，尺寸 64px
### Phase 2 验收：任务金币 + 商店 + 喂养 + 亲密度
功能验收： - [ ] 完成今日任务后金币增加（低优先级5/普通10/高优先级15） - [ ] 金币飘字动画从任务项飘向玩偶区域 - [ ] 玩偶同时做 happy 表情 + 金币语录气泡 - [ ] 反复勾选同一任务不重复发金币 - [ ] 单会话金币上限 100，超出后不再发放 - [ ] 商店弹窗显示 9 种零食，价格/亲密度/图标正确 - [ ] 购买零食扣金币、库存+1、播放飞入动画 - [ ] 余额不足时购买按钮置灰，点击抖动提示 - [ ] 右键菜单”喂零食”弹出库存面板，选择后零食飞向玩偶 - [ ] 玩偶做 excited/happy 表情 + 喂食语录，亲密度飘字”+N ❤️” - [ ] 库存扣减，亲密度增加并持久化 - [ ] 独立板块页面角色卡显示亲密度进度条和[喂食]按钮 - [ ] 页面内喂食正常工作 - [ ] 商店预览分区显示库存摘要 - [ ] 金币余额在页面标题栏正确显示
技术验收： - [ ] 数据深合并迁移正常（旧数据缺失字段不报错） - [ ] 导出/导入备份包含桌面玩偶数据 - [ ] 导入数据过程中不触发金币发放 - [ ] 所有用户可见文字通过 textContent 赋值（无 innerHTML XSS 风险） - [ ] 重置数据按钮工作（二次确认后清零，保留开关状态）
### Phase 3 验收：成就系统 + 多玩偶互动对话
功能验收： - [ ] 完成第一个任务后弹出”初出茅庐”成就横幅 + 20 金币 - [ ] 10 个成就均可在满足条件时正确解锁 - [ ] streak 连续天数：跨天完成任务 streak+1，中断后重置 - [ ] 成就横幅弹出时所有在场玩偶做 excited 表情 - [ ] 独立板块页面成就分区显示 10 个成就解锁状态 - [ ] 两玩偶同屏 3-6 分钟内触发互动对话 - [ ] 对话内容符合角色性格（小莫活泼/小余沉稳/懒零慵懒） - [ ] 四种组合（小莫+小余/小莫+懒零/小余+懒零/三人）对话不同 - [ ] 对话期间点击玩偶立即结束对话并响应点击 - [ ] 对话结束后进入 3-6 分钟冷却 - [ ] 附录 D 的 270 条语录在对应场景正确触发 - [ ] 附录 E 的 20 组对话可正常播放
技术验收： - [ ] 成就解锁不重复（已解锁的不会再次触发） - [ ] 对话气泡通过 aria-live 播报（无障碍） - [ ] prefers-reduced-motion 下动画正确降级 - [ ] Tab 键可导航所有按钮，Esc 关闭弹窗 - [ ] 移动端弹窗为底部抽屉样式，触摸操作正常 - [ ] 核心模块未加载时页面优雅降级（不报错）

文档结束。实现时建议按第十二章 12.5 节的三阶段计划推进，每阶段完成后对照附录 H 验收。

| 版本 | 日期 | 主要变更 |
| --- | --- | --- |
| v1.0 | 2026-08 | 单玩偶方案，15 种表情，基础交互 |
| v2.0 | 2026-08-20 | 三伙伴家族体系 + 任务金币 + 零食喂养 + 成就系统 + 多玩偶互动 + 独立导航板块 |
| v2.0（完善版） | 2026-08-20 | 补充 270 条语录库、20 组对话库、串门机制细节、页面通信机制、防刷逻辑、数据迁移、无障碍、移动端适配 |
| v2.0（全面检查修复版） | 2026-08-20 | 修复 11 项问题，增加术语表、设计决策记录、验收标准 |
| v2.1（质量提升版） | 2026-08-20 | 补全附录 F/G/H，增加代码规范（9.6）、FAQ（12.11），全文格式统一与交叉引用校验 |

| 读者 | 推荐阅读章节 | 目的 |
| --- | --- | --- |
| AI 实现工程师 | 全文（重点：第三~九章、附录 C） | 按规格从零实现代码 |
| 项目维护者 | 第一、二、九、十二章、附录 G | 理解设计决策和技术架构 |
| 产品/体验评审 | 第一、二、三、四、六、七章 | 评估功能完整性和用户体验 |
| 快速上手 | 第十二章 12.5 节 + 附录 H | 了解实现优先级和完成标准 |

| 属性 | 值 |
| --- | --- |
| 角色定位 | 团队里的开心果，话多、爱吐槽、反应快 |
| 主体色 | #e8a84c（琥珀橙） |
| 高光色 | #fff3d6 |
| 暗部色 | #b87a2a |
| 身体形态 | 偏圆，略小（默认尺寸的 0.95 倍） |
| 眼睛 | 大而灵动，圆点眼，眨眼频繁 |
| 嘴巴 | 常笑，弧度大 |
| 呼吸幅度 | 0.025（偏快） |
| 眨眼间隔 | 1500-3000ms（频繁） |
| 待机动作 | 弹跳、左右晃动、偶尔自旋 |
| 语录风格 | 俏皮、幽默、偶尔吐槽、网络用语、感叹号多 |

| 属性 | 值 |
| --- | --- |
| 角色定位 | 团队里的可靠担当，话少、沉稳、会照顾人 |
| 主体色 | #4a6fa5（靛青蓝） |
| 高光色 | #d6e4f5 |
| 暗部色 | #2e4a7a |
| 身体形态 | 略高略方，最挺拔（默认尺寸的 1.05 倍，scaleY 微增） |
| 眼睛 | 平静正视，圆点眼，眨眼间隔长 |
| 嘴巴 | 抿成线或浅微笑，弧度小 |
| 呼吸幅度 | 0.012（平缓） |
| 眨眼间隔 | 3500-6000ms（沉稳） |
| 待机动作 | 几乎不动，偶尔轻微点头 |
| 语录风格 | 沉稳、鼓励、有条理、像长辈/可靠的朋友 |

| 属性 | 值 |
| --- | --- |
| 角色定位 | 团队里的团宠，爱吃爱睡、没心没肺、最治愈 |
| 主体色 | #7ab89a（薄荷绿） |
| 高光色 | #d6f0e4 |
| 暗部色 | #4a8a6a |
| 身体形态 | 最圆最胖（默认尺寸的 1.1 倍，scaleX 微增） |
| 眼睛 | 常半闭（弧线），困倦时几乎闭眼 |
| 嘴巴 | 小，偶尔打哈欠 |
| 呼吸幅度 | 0.008（慢而深） |
| 眨眼间隔 | 800-2000ms（频繁眯眼，像犯困） |
| 待机动作 | 打哈欠、偶尔伸懒腰、大部分时间安静”睡觉” |
| 语录风格 | 吃、睡、懒洋洋、语气拖长、无忧无虑 |

| 模式 | 显示数量 | 说明 |
| --- | --- | --- |
| single | 1 个 | 只显示用户指定的”常驻玩偶”，其他两个不出现 |
| duo | 2 个（默认） | 一个常驻 + 一个”串门”。串门玩偶每隔一段时间出现，停留几分钟后离开 |
| trio | 3 个 | 三个玩偶同时显示在屏幕角落 |

| 显示数量 | 布局方式 |
| --- | --- |
| 1 个 | 用户自定义位置（默认右下角，距右/下各 24px） |
| 2 个 | 右下角横向并排，间距 10px；常驻在右，串门/第二个在左 |
| 3 个 | 右下角横向排列，间距 8px；屏幕宽度不足（< 480px）时改为纵向堆叠 |

| 开关 | 存储位置 | 控制范围 | 默认值 |
| --- | --- | --- | --- |
| settings.modules.desktopPet | 模块开关 | 控制侧边栏导航项是否显示（隐藏/显示”小莫灵家族”导航入口） | true |
| settings.desktopPet.enabled | 桌面玩偶总开关 | 控制悬浮玩偶的显示/隐藏，以及整个桌面玩偶系统的启停 | true |

| 互动类型 | 说明 | 触发概率 |
| --- | --- | --- |
| chat | 对话：两个玩偶轮流显示气泡对话 | 40% |
| play | 嬉戏：一个做 happy/excited，另一个回应 | 25% |
| tease | 打闹：一个做 wave/bounce，另一个做 surprised/happy | 20% |
| comfort | 安慰：一个”难过”时，另一个靠近做 encourage | 10% |
| sync | 同步：两个玩偶同时做相同动作（如同时眨眼、同时弹跳） | 5% |

| 组合 | 偏好互动 | 说明 |
| --- | --- | --- |
| 小莫 + 小余 | chat / comfort | 小莫话多，小余倾听；小余会”管教”小莫 |
| 小莫 + 懒零 | play / tease | 小莫逗懒零玩，懒零懒洋洋地回应 |
| 小余 + 懒零 | comfort / chat | 小余照顾懒零，懒零依赖小余 |
| 三个一起 | sync / play | 集体动作，或小莫主导、另外两个配合 |

| 途径 | 说明 | 金币量 |
| --- | --- | --- |
| 今日任务完成 | 完成”今日任务”模块中的任务 | 每任务 5-15 金币（按任务难度/重要性） |
| 成就奖励 | 达成特定成就 | 20-100 金币不等 |

| 成就 ID | 名称 | 条件 | 奖励 |
| --- | --- | --- | --- |
| first_task | 初出茅庐 | 完成第一个任务 | 20 金币 |
| task_10 | 小有所成 | 累计完成 10 个任务 | 30 金币 |
| task_50 | 任务达人 | 累计完成 50 个任务 | 50 金币 |
| task_100 | 百炼成钢 | 累计完成 100 个任务 | 100 金币 |
| all_done_today | 今日事今日毕 | 某一天所有今日任务全部完成 | 30 金币 |
| streak_3 | 三连胜 | 连续 3 天有完成任务 | 25 金币 |
| streak_7 | 一周坚持 | 连续 7 天有完成任务 | 50 金币 |
| first_feed | 初次投喂 | 第一次喂零食给玩偶 | 10 金币 |
| feed_10 | 饲养员 | 累计喂食 10 次 | 20 金币 |
| affection_100 | 亲密无间 | 任意角色亲密度达到 100 | 50 金币 |

| 零食 ID | 名称 | 价格 | 亲密度 | 图标 | 描述 |
| --- | --- | --- | --- | --- | --- |
| snack_01 | 小饼干 | 5 | 2 | 🍪 | 普通的小饼干，聊胜于无 |
| snack_02 | 糖果 | 8 | 3 | 🍬 | 甜甜的糖果，吃了心情好 |
| snack_03 | 苹果 | 10 | 4 | 🍎 | 健康的水果，营养满分 |
| snack_04 | 蛋糕 | 15 | 6 | 🍰 | 小小的蛋糕，幸福感满满 |
| snack_05 | 奶茶 | 20 | 8 | 🧋 | 快乐水，喝了就开心 |
| snack_06 | 披萨 | 25 | 10 | 🍕 | 香喷喷的披萨，超满足 |
| snack_07 | 寿司 | 30 | 12 | 🍣 | 精致的寿司，高级感 |
| snack_08 | 烤肉 | 40 | 16 | 🍖 | 大块烤肉，吃货最爱 |
| snack_09 | 豪华大餐 | 60 | 25 | 🍱 | 超级豪华大餐，亲密度暴涨 |

| 子管理器 | 职责 |
| --- | --- |
| DisplayManager | 显示模式、实例生命周期、串门、布局、页面模式 |
| CoinManager | 金币收支、防刷记录、飘字动画 |
| ShopManager | 零食商店、库存、购买逻辑 |
| FeedManager | 喂食逻辑、亲密度、喂食动画 |
| AchievementManager | 成就检测、解锁、streak 连续天数 |
| InteractionManager | 互动触发、对话播放、冷却管理 |
| AnimationLoop | 共享 rAF 循环、统一驱动所有实例 _tick |

| 分类 | 验证项 | 预期结果 |
| --- | --- | --- |
| 基础 | 页面加载 | 默认 duo 模式：常驻玩偶（小莫）在右下角 |
| 基础 | 三角色外观 | 小莫橙、小余蓝、懒零绿，形态有差异 |
| 基础 | 角色性格 | 小莫活泼、小余沉稳、懒零常打哈欠 |
| 导航 | 导航栏显示 | 侧边栏”游戏”下方出现”🐾 小莫灵家族”导航项 |
| 导航 | 点击导航 | 切换到桌面玩偶独立页面，标题显示”小莫灵家族” |
| 导航 | 设置页关闭模块 | 设置页模块开关中关闭”桌面玩偶”后，导航项消失 |
| 页面 | 三角色展示卡 | 页面显示三张角色卡，含 SVG 动画、亲密度、喂食按钮 |
| 页面 | 金币余额 | 页面标题栏右侧显示当前金币数，与实际一致 |
| 页面 | 显示设置 | 页面内可切换显示模式/常驻角色/大小，即时生效并持久化 |
| 页面 | 商店预览 | 页面显示库存摘要，点击”打开商店”弹出商店面板 |
| 页面 | 成就列表 | 页面显示 10 个成就的解锁状态，已解锁高亮 |
| 页面 | 页面打开/离开 | 打开页面时悬浮玩偶隐藏/缩小，离开时恢复 |
| 显示 | 切换 single/duo/trio | 对应数量玩偶显示，排列不重叠 |
| 显示 | 切换常驻角色 | 常驻玩偶变为所选角色 |
| 显示 | 拖拽玩偶 | 位置独立保存，刷新保持 |
| 串门 | duo 模式等待 | 8-15 分钟内有另一个玩偶串门出场（可调短间隔测试） |
| 串门 | 串门玩偶离场 | 2-4 分钟后挥手离开 |
| 互动 | 两玩偶同屏 | 3-6 分钟内触发互动对话 |
| 互动 | 对话内容 | 不同角色组合对话内容符合性格 |
| 金币 | 完成今日任务 | 金币增加，飘字动画，玩偶开心 |
| 金币 | 反复勾选同一任务 | 不重复发金币 |
| 成就 | 完成第一个任务 | 弹出”初出茅庐”成就横幅+20金币 |
| 商店 | 打开商店 | 9种零食显示，价格/图标正确，余额显示 |
| 商店 | 购买零食 | 扣金币，库存+1，成功动画 |
| 商店 | 余额不足购买 | 按钮置灰，提示金币不足 |
| 喂养 | 页面内喂食 | 点击角色卡[喂食]按钮，弹出零食选择，喂食成功 |
| 喂养 | 悬浮玩偶喂食 | 右键/长按悬浮玩偶→喂零食，正常喂食 |
| 喂养 | 不同角色反应 | 小莫兴奋、小余克制、懒零贪吃 |
| 喂养 | 亲密度里程碑 | 达到50/100有庆祝反应 |
| 数据 | 刷新页面 | 金币/亲密度/库存/配置都保持 |
| 数据 | 导出/导入备份 | 桌面玩偶数据包含并可恢复 |
| 数据 | 部分字段缺失的旧数据 | 深合并补全默认值，不丢失已有数据 |
| 性能 | 三玩偶同屏 | 动画流畅，单帧<16ms |
| 性能 | 页面打开时 | 悬浮玩偶隐藏，不重复渲染 |
| 性能 | 60fps 档位 | 装饰性 CSS 动画停止，JS 动画正常 |
| 无障碍 | Tab 键导航 | 所有按钮可聚焦，焦点顺序合理 |
| 无障碍 | Enter/Esc 键 | Enter 触发按钮，Esc 关闭弹窗 |
| 无障碍 | 屏幕阅读器 | 表情变化更新 aria-label，对话通过 aria-live 播报 |
| 无障碍 | prefers-reduced-motion | CSS 动画暂停，JS 动画降级，飘字/出场无过渡 |
| 移动端 | 默认显示模式 | 移动端默认 single 模式，玩偶尺寸 64px |
| 移动端 | trio 模式布局 | 玩偶纵向堆叠，页面卡片纵向排列 |
| 移动端 | 触摸操作 | 长按触发菜单，单指拖拽，点击有反应 |
| 移动端 | 弹窗样式 | 商店/喂食弹窗为底部抽屉样式 |
| 兼容 | 深色主题/离线 | 均正常工作 |
| 防刷 | 反复勾选同一任务 | 不重复发金币（rewardedTaskIds 生效） |
| 防刷 | 会话金币上限 | 单会话超过 100 金币后不再发放 |
| 防刷 | 导入数据 | 导入过程中不触发金币发放 |
| 成就 | streak 连续天数 | 跨天完成任务 streak+1，中断后重置为 0 |
| 串门 | 手动召唤 | 右键菜单”叫小伙伴来玩”可无视间隔召唤（受角色冷却限制） |
| 串门 | 角色冷却 | 同一角色离场后 10 分钟内不再被选中 |
| 互动 | 互动期间点击 | 立即结束互动，然后正常响应用户点击 |
| 页面 | 页面打开/离开 | 打开时悬浮玩偶隐藏，离开时恢复 |
| 页面 | 页面内喂食 | 点击角色卡[喂食]按钮，弹出零食选择，喂食成功 |

| 表情 ID | name | breathe | blink | eyes.shape | eyes.look | eyes.scaleY | mouth.type | mouth.w/h | decor | 特殊动画 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| idle | 待机 | 0.018 | [2600,5200] | dot | (0,0) | 1 | smile | 10/4 | — | antics |
| happy | 开心 | 0.028 | [1800,3600] | arc | (0,-1) | 0.6 | smile | 14/7 | blush | bounce |
| thinking | 思考 | 0.012 | [4000,7000] | dot | (2,-2) | 1 | flat | 8/0 | think | wobble |
| sleepy | 困倦 | 0.008 | [800,1600] | arc | (0,2) | 0.25 | flat | 6/0 | zzz | — |
| excited | 兴奋 | 0.035 | [1200,2400] | star | (0,-1) | 0.8 | open | 10/8 | blush,star | bounce,sparkle |
| wave | 打招呼 | 0.02 | [2400,4800] | dot | (0,0) | 1 | smile | 12/5 | wave-fin | wave |
| focus | 专注 | 0.01 | [5000,9000] | dot | (0,0) | 1 | flat | 5/0 | — | — |
| sad | 难过 | 0.012 | [5000,8000] | dot | (0,3) | 0.8 | frown | 10/4 | — | — |
| surprised | 惊讶 | 0.012 | [4000,7000] | wide | (0,0) | 1 | o-small | — | exclaim | recoil |
| proud | 得意 | 0.024 | [2000,4000] | arc-up | (0,-1) | 0.5 | big-smile | 16/8 | blush,sparkle | bounce,chest |
| relax | 放松 | 0.03 | [3000,5500] | arc | (0,1) | 0.4 | smile | 10/3 | relax-waves | stretch |
| confused | 疑惑 | 0.015 | [2500,4500] | asymmetric | — | — | wavy | 12/— | question | tilt(2°) |
| encourage | 加油 | 0.022 | [2200,4200] | dot | (0,0) | 1 | smile | 12/4 | arrow-up | bounce,lean |
| busy | 忙碌 | 0.03 | [1500,2800] | darting | — | — | o-tiny | — | sweat | wobble(300ms) |
| goodbye | 再见 | 0.012 | [3500,6000] | arc-up | (0,0) | 0.3 | smile | 8/2 | wave-fin(slow) | sink |

| 形状 | 适用表情 | 绘制方式 |
| --- | --- | --- |
| dot | idle/thinking/focus/sad/encourage | <circle r="3" fill="var(--dp-eye)"/> + <circle r="0.8" cx="-1" cy="-1" fill="rgba(255,255,255,0.8)"/> 高光 |
| arc | happy/sleepy/relax | <path d="M-4 0 Q0 4 4 0" fill="none" stroke="var(--dp-eye)" stroke-width="2" stroke-linecap="round"/> |
| arc-up | proud/goodbye | <path d="M-5 -1 Q0 -5 5 -1" fill="none" stroke="var(--dp-eye)" stroke-width="2" stroke-linecap="round"/>（比 arc 更弯、位置更高） |
| star | excited | <text x="-5" y="3" font-size="10" fill="#f5c542">★</text> |
| wide | surprised | <circle r="4" fill="var(--dp-eye)"/> + <circle r="1.5" fill="rgba(255,255,255,0.9)"/> 瞳孔居中（无偏移高光），整体放大模拟瞪眼 |
| closed | goodbye（备选） | <path d="M-4 1 Q0 -2 4 1" fill="none" stroke="var(--dp-eye)" stroke-width="2" stroke-linecap="round"/>（向下凸的弧线，闭眼微笑） |

| 类型 | 适用 | 绘制方式 |
| --- | --- | --- |
| smile | idle/happy/wave/encourage/relax/goodbye | M(50-w/2) 62 Q50 (62+h) (50+w/2) 62，stroke 无填充 |
| big-smile | proud | M(50-w/2) 61 Q50 (62+h*1.5) (50+w/2) 61，w=16 h=8，更大弧度 |
| frown | sad | M(50-w/2) (62+h) Q50 (62-h) (50+w/2) (62+h)，下弧线 |
| open | excited | 上弧 path + fill 深色（张嘴），w=10 h=8 |
| flat | thinking/sleepy/focus | M(50-w/2) 62 L(50+w/2) 62，直线 |
| o-small | surprised | <ellipse cx="50" cy="63" rx="3" ry="4" fill="var(--dp-eye)"/>，小 O 形 |
| o-tiny | busy | <ellipse cx="50" cy="63" rx="2" ry="2.5" fill="var(--dp-eye)"/>，更小的 O |
| wavy | confused | M(50-w/2) 62 Q(50-w/4) 59 50 62 Q(50+w/4) 65 (50+w/2) 62，波浪线（一上一下），stroke 无填充 |
| yawn | relax（备选） | <ellipse cx="50" cy="63" rx="5" ry="6" fill="var(--dp-eye)"/>，打哈欠大 O |

| 场景 | 语录 1 | 语录 2 | 语录 3 | 语录 4 | 语录 5 |
| --- | --- | --- | --- | --- | --- |
| idle | 呼……今天也要元气满满！ | 有什么好玩的吗？ | 静静地陪着你~ | 墨香四溢的一天！ | 摸鱼中，勿cue~ |
| happy | 太棒啦！嘿嘿！ | 这件事做得真不错！ | 哇哦，厉害厉害！ | 为你鼓掌啪啪啪！ | 开心心~今天也是好日子！ |
| thinking | 让我想想……这个有点意思 | 嗯……容我琢磨琢磨 | 正在运转中，稍等！ | 这个问题嘛……我有个大胆的想法 | 大脑飞速旋转ing |
| sleepy | 好困啊……眼皮好重 | zzz……再睡五分钟就好 | 哈欠……今天好漫长 | 困困……可以躺平吗？ | 眼睛睁不开了……zzZ |
| excited | 哇！！太厉害了吧！ | 冲冲冲！就是现在！ | 庆祝一下！撒花！ | 这也太牛了！我就知道！ | 激动到弹跳！耶！ |
| wave | 你好呀！嗨嗨嗨！ | 又见面啦~欢迎回来！ | 哈喽哈喽！今天过得好吗？ | 哟！你来啦！等你好久了！ | 嗨~看到你真开心！ |
| focus | 嘘……专注中，别分心 | 正在认真工作，保持节奏 | 别吵别吵，关键时刻！ | 沉浸式干活ing…… | 专注的男人最帅（不是） |
| sad | 唉……有点小失落 | 没关系的，会好起来 | 抱抱……今天不太顺利呢 | 呜呜……被打击到了 | 低落ing……需要安慰 |
| surprised | 咦？！这是什么情况？ | 哇哦！吓我一跳！ | 居然……！这也太意外了 | 等等等等，我没看错吧？ | 震惊！这操作可以啊！ |
| proud | 看吧，我就说你行！ | 干得漂亮！为你骄傲！ | 今天的你闪闪发光！ | 厉害吧？这可是我罩的人！ | 成就感满满~继续加油！ |
| relax | 呼——松口气，歇会儿 | 伸个懒腰~真舒服 | 慢慢来不着急，休息也是努力 | 躺平ing……请勿打扰 | 放松放松，天塌下来有高个子顶着 |
| confused | 嗯？这不对啊…… | 我没看懂……什么情况？ | 这是什么操作？容我缓缓 | 好像哪里不太对……让我再看看 | 脑袋上冒问号了？？ |
| encourage | 你可以的！相信自己！ | 加油加油！再坚持一下下！ | 你比想象中更厉害！冲！ | 别怕，有我在呢！一定行！ | 奥利给！干就完了！ |
| busy | 忙忙忙……转不过来了 | 稍等稍等！事情好多啊！ | 飞速运转中……别催别催！ | 忙碌ing……三头六臂不够用 | 冲冲冲！事情一件一件来！ |
| goodbye | 明天见啦~做个好梦！ | 拜拜~早点休息哦！ | 下次见！今天也辛苦啦！ | 走啦走啦~记得想我！ | 拜拜拜~明天继续加油！ |
| feed | 哇！好吃好吃！再来一个？ | 嘿嘿，谢谢投喂~你最好了！ | 这个我喜欢！幸福感爆棚！ | 投喂成功，好感度UPUP！ | 吧唧吧唧……美味！还想要！ |
| achievement | 成就解锁！厉害厉害！ | 哇！又达成一个成就！ | 这就是实力！继续冲！ | 成就+1！离大佬又近一步！ | 太棒了！这个成就我收下了！ |
| coinEarn | 金币+1！又赚一笔！ | 嘿嘿，小钱钱到手~ | 金币入账！买买买！ | 又赚了！离豪华大餐更近了！ | 叮~到账提醒！开心！ |

| 场景 | 语录 1 | 语录 2 | 语录 3 | 语录 4 | 语录 5 |
| --- | --- | --- | --- | --- | --- |
| idle | 一切安好。 | 有什么需要帮忙的吗。 | 静静地陪着你。 | 今日事今日毕。 | 我在。 |
| happy | 做得不错。 | 这件事处理得很好。 | 值得肯定。 | 辛苦了，结果很好。 | 不错，继续保持。 |
| thinking | 让我想想…… | 这个问题需要斟酌。 | 正在分析中。 | 嗯……容我考虑一下。 | 理清思路再行动。 |
| sleepy | 夜深了，早点休息。 | 有些倦了…… | 睡眠很重要，别熬夜。 | 困了……明天继续。 | 休息也是一种准备。 |
| excited | 太好了。 | 这个结果令人欣喜。 | 值得庆祝。 | 非常好，超出预期。 | 令人振奋的进展。 |
| wave | 你好。 | 又见面了。 | 欢迎回来。 | 见到你很高兴。 | 你来了，一切都在掌控中。 |
| focus | 专注。 | 保持节奏。 | 认真做事。 | 不分心，才能做好。 | 沉浸其中。 |
| sad | 没关系，会好起来的。 | 别灰心，下次会更好。 | 我理解你的感受。 | 挫折是暂时的。 | 有我在，别怕。 |
| surprised | 这倒是出乎意料。 | 哦？有点意思。 | 没想到会这样。 | 令人意外的结果。 | 这……我没预料到。 |
| proud | 我就知道你可以。 | 干得漂亮。 | 你的努力有了回报。 | 为你感到骄傲。 | 实至名归。 |
| relax | 辛苦了，歇一歇。 | 放松一下，不着急。 | 劳逸结合，才能长久。 | 深呼吸……一切都好。 | 休息是为了走更远的路。 |
| confused | 这似乎不太对。 | 我需要再确认一下。 | 这里有些说不通。 | 让我再看看…… | 这个逻辑我没跟上。 |
| encourage | 你可以的，相信自己。 | 再坚持一下，快到了。 | 你的能力不止于此。 | 别怕，有我在。 | 一步一步来，你能行。 |
| busy | 稍等，我处理一下。 | 事情较多，按顺序来。 | 正在处理，请勿着急。 | 忙碌中，很快就好。 | 一件一件来，不慌乱。 |
| goodbye | 明天见。 | 早点休息，晚安。 | 今天辛苦了。 | 路上小心。 | 明天继续，我等你。 |
| feed | 谢谢。 | 有心了。 | 味道不错。 | 你也记得按时吃饭。 | ……下次不用破费。 |
| achievement | 恭喜，达成成就。 | 这是你应得的。 | 努力没有白费。 | 又进了一步。 | 值得记录的里程碑。 |
| coinEarn | 又有收获。 | 积少成多。 | 这是努力的回报。 | 收入增加了。 | 不错的进账。 |

| 场景 | 语录 1 | 语录 2 | 语录 3 | 语录 4 | 语录 5 |
| --- | --- | --- | --- | --- | --- |
| idle | 呼……好舒服…… | 不想动…… | 静静地躺着…… | 今天也是躺平的一天~ | 发呆ing…… |
| happy | 嘿嘿……好开心…… | 好吃的！！ | 嘿嘿……幸福…… | 开心到打滚~ | 嘻嘻……今天真好…… |
| thinking | 嗯……？什么？ | 让我想想……想着想着就困了 | 这个……好难想…… | 脑子转不动了…… | 想什么呢……不如睡觉 |
| sleepy | 好困啊……再睡五分钟…… | zzz……被窝里好舒服…… | 眼皮好重……撑不住了…… | 不要叫我……我在冬眠…… | 困困……zzZ…… |
| excited | 哇！！吃的！！ | 太好啦！！可以吃了吗！ | 兴奋到打滚！！ | 哇哦！！好棒！！ | 开心！！要飞起来了！！ |
| wave | 嗨……你好呀…… | 又见面啦……好困…… | 欢迎回来……有吃的吗？ | 哈喽……我刚睡醒…… | 你好呀……要不要一起躺？ |
| focus | 嗯……专注中…… | 别吵……我在认真…… | 正在努力……zzZ…… | 专注……好难…… | 认真脸……（其实快睡着了） |
| sad | 唉……好难过…… | 不想动……心情不好…… | 呜呜……需要抱抱…… | 低落……想吃好吃的安慰自己…… | 没精神…… |
| surprised | 咦？！什么？！ | 哇！吓我一跳！ | 居然……？好意外！ | 等等……我没看错吧？ | 震惊到清醒了！！ |
| proud | 嘿嘿……我就知道…… | 厉害吧……（其实没出力） | 成就感……好困…… | 干得漂亮……可以奖励吃的吗？ | 骄傲……然后继续躺…… |
| relax | 呼——松口气……好舒服 | 伸个懒腰~继续睡 | 放松……就是要躺平嘛 | 躺平ing……人生就该这样 | 不着急……慢慢来……先睡一觉 |
| confused | 嗯？什么意思？ | 我没懂……可以再说一遍吗？ | 这是什么……好吃吗？ | 脑袋转不过来……好困 | 问号？？发生什么了？ |
| encourage | 加油哦……你可以的…… | 再坚持一下……然后就可以休息了 | 你很棒的……（打哈欠） | 别怕……我在精神上支持你…… | 冲鸭……（躺着冲） |
| busy | 好忙啊……不想动…… | 事情好多……可以明天再做吗？ | 忙碌ing……（其实在摸鱼） | 转不动了……需要吃的补充能量 | 忙忙忙……忙完就可以睡了 |
| goodbye | 明天见……做个好梦…… | 拜拜……我要去睡觉了 | 下次见……记得带吃的 | 晚安……zzZ…… | 走啦……记得想我……（已经睡着了） |
| feed | 吃的！！！终于！！ | 唔……好吃……还要还要！ | 吧唧吧唧……太幸福了…… | 吃饱了……好困…… | 你是世界上最好的人！！ |
| achievement | 哇……成就！！有奖励吗？ | 厉害厉害……可以吃好吃的庆祝吗？ | 成就+1……然后继续躺…… | 太棒了……（睡梦中鼓掌） | 成就达成……需要零食补充体力！ |
| coinEarn | 金币！！可以买吃的了！ | 嘿嘿……小钱钱……买零食！ | 又赚了……离大餐更近了！ | 金币+1……攒着买好吃的！ | 叮~到账！开心到打滚！ |

| 术语 | 定义 |
| --- | --- |
| Pet | 单个桌面玩偶实例，对应一个角色（小莫/小余/懒零），负责自身的 SVG 渲染、动画、交互 |
| PetFamily | 多玩偶管理器，统一管理所有 Pet 实例的生命周期、布局、金币、商店、喂养、成就、互动 |
| 常驻玩偶 | 用户指定的始终显示的玩偶，由 desktopPet.resident 配置，默认小莫 |
| 串门玩偶 | duo 模式下偶尔出现、停留几分钟后离开的玩偶，非常驻角色随机选取 |
| 显示模式 | single（1个）/ duo（2个，默认）/ trio（3个）三档，控制同屏玩偶数量 |
| rAF 循环 | requestAnimationFrame 驱动的动画循环，所有 Pet 共享一个循环以控制 CPU 占用 |
| 表情（Emotion） | 玩偶的面部状态，共 15 种（idle/happy/thinking/sleepy/excited/wave/focus/sad/surprised/proud/relax/confused/encourage/busy/goodbye） |
| 装饰元素（Decor） | SVG 中根据表情显示/隐藏的附属图形，如腮红、星星、zzz、汗珠、感叹号等 |
| 待机动作（Antics） | 玩偶 idle 时随机播放的小动作，如弹跳、晃动、自旋、点头、打哈欠 |
| 气泡（Bubble） | 玩偶头顶显示的文字对话气泡，用于语录和互动对话 |
| 语录（Quotes） | 单个玩偶在特定场景下说的话，按角色×场景分类，共 270 条 |
| 对话（Dialogues） | 两个或三个玩偶之间的多轮互动对话，共 20 组 |
| OOC | Out of Character，角色崩坏，指玩偶说出不符合自身性格设定的话 |
| SonderBus | 项目的事件总线，桌面玩偶通过它监听任务完成等事件 |
| SonderStore | 项目的数据存储，桌面玩偶数据存在 settings.desktopPet 下 |
| 页面模式 | 用户进入”小莫灵家族”独立板块时的状态，悬浮玩偶隐藏，页面内展示大尺寸玩偶 |
| 深合并 | 递归合并两个对象，用户数据优先、缺失字段用默认值补全的数据迁移策略 |
| streak | 连续活跃天数，用户每天至少完成一个任务则 streak+1，中断则重置 |
| 防刷 | 防止用户通过反复勾选/取消任务等方式异常获取金币的机制 |
| UMD | Universal Module Definition，项目模块的包装方式，通过全局变量暴露 |
