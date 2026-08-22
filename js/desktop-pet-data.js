/* ============================================================
 * desktop-pet-data.js - 小莫灵家族配置数据（语录/角色/零食/成就/对话）
 * 浏览器(window.DesktopPetData)与 Node(module.exports)通用。
 * 从 desktop-pet.js 第一区提取，保持逻辑与数据分离。
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DesktopPetData = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var QUOTES = {
    xiaomo: {
      idle: ['呼……今天也要元气满满！', '有什么好玩的吗？', '静静地陪着你~', '墨香四溢的一天！', '摸鱼中，勿cue~'],
      happy: ['太棒啦！嘿嘿！', '这件事做得真不错！', '哇哦，厉害厉害！', '为你鼓掌啪啪啪！', '开心心~今天也是好日子！'],
      thinking: ['让我想想……这个有点意思', '嗯……容我琢磨琢磨', '正在运转中，稍等！', '这个问题嘛……我有个大胆的想法', '大脑飞速旋转ing'],
      sleepy: ['好困啊……眼皮好重', 'zzz……再睡五分钟就好', '哈欠……今天好漫长', '困困……可以躺平吗？', '眼睛睁不开了……zzZ'],
      excited: ['哇！！太厉害了吧！', '冲冲冲！就是现在！', '庆祝一下！撒花！', '这也太牛了！我就知道！', '激动到弹跳！耶！'],
      wave: ['你好呀！嗨嗨嗨！', '又见面啦~欢迎回来！', '哈喽哈喽！今天过得好吗？', '哟！你来啦！等你好久了！', '嗨~看到你真开心！'],
      focus: ['嘘……专注中，别分心', '正在认真工作，保持节奏', '别吵别吵，关键时刻！', '沉浸式干活ing……', '专注的男人最帅（不是）'],
      sad: ['唉……有点小失落', '没关系的，会好起来', '抱抱……今天不太顺利呢', '呜呜……被打击到了', '低落ing……需要安慰'],
      surprised: ['咦？！这是什么情况？', '哇哦！吓我一跳！', '居然……！这也太意外了', '等等等等，我没看错吧？', '震惊！这操作可以啊！'],
      proud: ['看吧，我就说你行！', '干得漂亮！为你骄傲！', '今天的你闪闪发光！', '厉害吧？这可是我罩的人！', '成就感满满~继续加油！'],
      relax: ['呼——松口气，歇会儿', '伸个懒腰~真舒服', '慢慢来不着急，休息也是努力', '躺平ing……请勿打扰', '放松放松，天塌下来有高个子顶着'],
      confused: ['嗯？这不对啊……', '我没看懂……什么情况？', '这是什么操作？容我缓缓', '好像哪里不太对……让我再看看', '脑袋上冒问号了？？'],
      encourage: ['你可以的！相信自己！', '加油加油！再坚持一下下！', '你比想象中更厉害！冲！', '别怕，有我在呢！一定行！', '奥利给！干就完了！'],
      busy: ['忙忙忙……转不过来了', '稍等稍等！事情好多啊！', '飞速运转中……别催别催！', '忙碌ing……三头六臂不够用', '冲冲冲！事情一件一件来！'],
      goodbye: ['明天见啦~做个好梦！', '拜拜~早点休息哦！', '下次见！今天也辛苦啦！', '走啦走啦~记得想我！', '拜拜拜~明天继续加油！'],
      feed: ['哇！好吃好吃！再来一个？', '嘿嘿，谢谢投喂~你最好了！', '这个我喜欢！幸福感爆棚！', '投喂成功，好感度UPUP！', '吧唧吧唧……美味！还想要！'],
      achievement: ['成就解锁！厉害厉害！', '哇！又达成一个成就！', '这就是实力！继续冲！', '成就+1！离大佬又近一步！', '太棒了！这个成就我收下了！'],
      coinEarn: ['金币+1！又赚一笔！', '嘿嘿，小钱钱到手~', '金币入账！买买买！', '又赚了！离豪华大餐更近了！', '叮~到账提醒！开心！']
    },
    xiaoyu: {
      idle: ['一切安好。', '有什么需要帮忙的吗。', '静静地陪着你。', '今日事今日毕。', '我在。'],
      happy: ['做得不错。', '这件事处理得很好。', '值得肯定。', '辛苦了，结果很好。', '不错，继续保持。'],
      thinking: ['让我想想……', '这个问题需要斟酌。', '正在分析中。', '嗯……容我考虑一下。', '理清思路再行动。'],
      sleepy: ['夜深了，早点休息。', '有些倦了……', '睡眠很重要，别熬夜。', '困了……明天继续。', '休息也是一种准备。'],
      excited: ['太好了。', '这个结果令人欣喜。', '值得庆祝。', '非常好，超出预期。', '令人振奋的进展。'],
      wave: ['你好。', '又见面了。', '欢迎回来。', '见到你很高兴。', '你来了，一切都在掌控中。'],
      focus: ['专注。', '保持节奏。', '认真做事。', '不分心，才能做好。', '沉浸其中。'],
      sad: ['没关系，会好起来的。', '别灰心，下次会更好。', '我理解你的感受。', '挫折是暂时的。', '有我在，别怕。'],
      surprised: ['这倒是出乎意料。', '哦？有点意思。', '没想到会这样。', '令人意外的结果。', '这……我没预料到。'],
      proud: ['我就知道你可以。', '干得漂亮。', '你的努力有了回报。', '为你感到骄傲。', '实至名归。'],
      relax: ['辛苦了，歇一歇。', '放松一下，不着急。', '劳逸结合，才能长久。', '深呼吸……一切都好。', '休息是为了走更远的路。'],
      confused: ['这似乎不太对。', '我需要再确认一下。', '这里有些说不通。', '让我再看看……', '这个逻辑我没跟上。'],
      encourage: ['你可以的，相信自己。', '再坚持一下，快到了。', '你的能力不止于此。', '别怕，有我在。', '一步一步来，你能行。'],
      busy: ['稍等，我处理一下。', '事情较多，按顺序来。', '正在处理，请勿着急。', '忙碌中，很快就好。', '一件一件来，不慌乱。'],
      goodbye: ['明天见。', '早点休息，晚安。', '今天辛苦了。', '路上小心。', '明天继续，我等你。'],
      feed: ['谢谢。', '有心了。', '味道不错。', '你也记得按时吃饭。', '……下次不用破费。'],
      achievement: ['恭喜，达成成就。', '这是你应得的。', '努力没有白费。', '又进了一步。', '值得记录的里程碑。'],
      coinEarn: ['又有收获。', '积少成多。', '这是努力的回报。', '收入增加了。', '不错的进账。']
    },
    lanling: {
      idle: ['呼……好舒服……', '不想动……', '静静地躺着……', '今天也是躺平的一天~', '发呆ing……'],
      happy: ['嘿嘿……好开心……', '好吃的！！', '嘿嘿……幸福……', '开心到打滚~', '嘻嘻……今天真好……'],
      thinking: ['嗯……？什么？', '让我想想……想着想着就困了', '这个……好难想……', '脑子转不动了……', '想什么呢……不如睡觉'],
      sleepy: ['好困啊……再睡五分钟……', 'zzz……被窝里好舒服……', '眼皮好重……撑不住了……', '不要叫我……我在冬眠……', '困困……zzZ……'],
      excited: ['哇！！吃的！！', '太好啦！！可以吃了吗！', '兴奋到打滚！！', '哇哦！！好棒！！', '开心！！要飞起来了！！'],
      wave: ['嗨……你好呀……', '又见面啦……好困……', '欢迎回来……有吃的吗？', '哈喽……我刚睡醒……', '你好呀……要不要一起躺？'],
      focus: ['嗯……专注中……', '别吵……我在认真……', '正在努力……zzZ……', '专注……好难……', '认真脸……（其实快睡着了）'],
      sad: ['唉……好难过……', '不想动……心情不好……', '呜呜……需要抱抱……', '低落……想吃好吃的安慰自己……', '没精神……'],
      surprised: ['咦？！什么？！', '哇！吓我一跳！', '居然……？好意外！', '等等……我没看错吧？', '震惊到清醒了！！'],
      proud: ['嘿嘿……我就知道……', '厉害吧……（其实没出力）', '成就感……好困……', '干得漂亮……可以奖励吃的吗？', '骄傲……然后继续躺……'],
      relax: ['呼——松口气……好舒服', '伸个懒腰~继续睡', '放松……就是要躺平嘛', '躺平ing……人生就该这样', '不着急……慢慢来……先睡一觉'],
      confused: ['嗯？什么意思？', '我没懂……可以再说一遍吗？', '这是什么……好吃吗？', '脑袋转不过来……好困', '问号？？发生什么了？'],
      encourage: ['加油哦……你可以的……', '再坚持一下……然后就可以休息了', '你很棒的……（打哈欠）', '别怕……我在精神上支持你……', '冲鸭……（躺着冲）'],
      busy: ['好忙啊……不想动……', '事情好多……可以明天再做吗？', '忙碌ing……（其实在摸鱼）', '转不动了……需要吃的补充能量', '忙忙忙……忙完就可以睡了'],
      goodbye: ['明天见……做个好梦……', '拜拜……我要去睡觉了', '下次见……记得带吃的', '晚安……zzZ……', '走啦……记得想我……（已经睡着了）'],
      feed: ['吃的！！！终于！！', '唔……好吃……还要还要！', '吧唧吧唧……太幸福了……', '吃饱了……好困……', '你是世界上最好的人！！'],
      achievement: ['哇……成就！！有奖励吗？', '厉害厉害……可以吃好吃的庆祝吗？', '成就+1……然后继续躺……', '太棒了……（睡梦中鼓掌）', '成就达成……需要零食补充体力！'],
      coinEarn: ['金币！！可以买吃的了！', '嘿嘿……小钱钱……买零食！', '又赚了……离大餐更近了！', '金币+1……攒着买好吃的！', '叮~到账！开心到打滚！']
    }
  };

  /* 角色配置（CHARACTERS）：规格 2.5 */
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
      quotes: QUOTES.xiaomo,
      decor: ['exclaim', 'bulb']
    },
    xiaoyu: {
      id: 'xiaoyu',
      name: '小余',
      desc: '责任担当安静成熟稳重的小家伙',
      colors: { body: '#4a6fa5', light: '#d6e4f5', dark: '#2e4a7a' },
      bodyScale: { x: 1, y: 1.08 },
      breathe: 0.012,
      blink: [3500, 6000],
      defaultEmotion: 'idle',
      antics: { nod: true },
      quotes: QUOTES.xiaoyu,
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
      quotes: QUOTES.lanling,
      decor: ['zzz', 'drool']
    }
  };

  /* 零食配置（SNACKS）：规格 6.1 表 */
  var SNACKS = {
    snack_01: { id: 'snack_01', name: '小饼干', price: 5, affection: 2, icon: '🍪', desc: '普通的小饼干，聊胜于无' },
    snack_02: { id: 'snack_02', name: '糖果', price: 8, affection: 3, icon: '🍬', desc: '甜甜的糖果，吃了心情好' },
    snack_03: { id: 'snack_03', name: '苹果', price: 10, affection: 4, icon: '🍎', desc: '健康的水果，营养满分' },
    snack_04: { id: 'snack_04', name: '蛋糕', price: 15, affection: 6, icon: '🍰', desc: '小小的蛋糕，幸福感满满' },
    snack_05: { id: 'snack_05', name: '奶茶', price: 20, affection: 8, icon: '🧋', desc: '快乐水，喝了就开心' },
    snack_06: { id: 'snack_06', name: '披萨', price: 25, affection: 10, icon: '🍕', desc: '香喷喷的披萨，超满足' },
    snack_07: { id: 'snack_07', name: '寿司', price: 30, affection: 12, icon: '🍣', desc: '精致的寿司，高级感' },
    snack_08: { id: 'snack_08', name: '烤肉', price: 40, affection: 16, icon: '🍖', desc: '大块烤肉，吃货最爱' },
    snack_09: { id: 'snack_09', name: '豪华大餐', price: 60, affection: 25, icon: '🍱', desc: '超级豪华大餐，亲密度暴涨' }
  };

  /* 成就配置（ACHIEVEMENTS）：规格 5.3 表
   * condition(s) 接收统计上下文并返回是否达成（Task 3 接入真实统计后负责调度检测） */
  function countCompletedTasks(s) {
    return s && Array.isArray(s.tasks) ? s.tasks.filter(function (t) { return t.done; }).length : 0;
  }
  function countFeeds(s) {
    return s && typeof s.totalFeeds === 'number' ? s.totalFeeds : 0;
  }
  var ACHIEVEMENTS = {
    first_task: { id: 'first_task', name: '初出茅庐', condition: function (s) { return countCompletedTasks(s) >= 1; }, reward: 20 },
    task_10: { id: 'task_10', name: '小有所成', condition: function (s) { return countCompletedTasks(s) >= 10; }, reward: 30 },
    task_50: { id: 'task_50', name: '任务达人', condition: function (s) { return countCompletedTasks(s) >= 50; }, reward: 50 },
    task_100: { id: 'task_100', name: '百炼成钢', condition: function (s) { return countCompletedTasks(s) >= 100; }, reward: 100 },
    all_done_today: { id: 'all_done_today', name: '今日事今日毕', condition: function (s) { return !!(s && s.allDoneToday); }, reward: 30 },
    streak_3: { id: 'streak_3', name: '三连胜', condition: function (s) { return !!(s && s.streak >= 3); }, reward: 25 },
    streak_7: { id: 'streak_7', name: '一周坚持', condition: function (s) { return !!(s && s.streak >= 7); }, reward: 50 },
    first_feed: { id: 'first_feed', name: '初次投喂', condition: function (s) { return countFeeds(s) >= 1; }, reward: 10 },
    feed_10: { id: 'feed_10', name: '饲养员', condition: function (s) { return countFeeds(s) >= 10; }, reward: 20 },
    affection_100: { id: 'affection_100', name: '亲密无间', condition: function (s) { return !!(s && s.maxAffection >= 100); }, reward: 50 }
  };

  /* 互动对话库（DIALOGUES）：4 组合 × 5 组 = 20 组，附录 E 全文 */
  var DIALOGUES = {
    'xiaomo+xiaoyu': [
      {
        type: 'chat',
        lines: [
          { speaker: 'xiaomo', text: '小余小余，你看我今天是不是特别帅？' },
          { speaker: 'xiaoyu', text: '……你开心就好。' },
          { speaker: 'xiaomo', text: '嘿嘿，我就当你夸我了！' },
          { speaker: 'xiaoyu', text: '嗯。' }
        ]
      },
      {
        type: 'comfort',
        lines: [
          { speaker: 'xiaomo', text: '唉……今天任务没做完，好挫败……' },
          { speaker: 'xiaoyu', text: '没关系，剩下的明天再做。你今天已经很努力了。' },
          { speaker: 'xiaomo', text: '真的吗……？' },
          { speaker: 'xiaoyu', text: '真的。先休息，明天我陪你一起。' }
        ]
      },
      {
        type: 'tease',
        lines: [
          { speaker: 'xiaomo', text: '小余小余，你怎么总是这么严肃？笑一个嘛~' },
          { speaker: 'xiaoyu', text: '……我在认真做事。' },
          { speaker: 'xiaomo', text: '认真做事也可以笑呀！你看我——（做鬼脸）' },
          { speaker: 'xiaoyu', text: '……（嘴角微扬）幼稚。' }
        ]
      },
      {
        type: 'chat',
        lines: [
          { speaker: 'xiaomo', text: '今天任务好多啊……做不完了怎么办？' },
          { speaker: 'xiaoyu', text: '按优先级排序，先做重要的。剩下的分批处理。' },
          { speaker: 'xiaomo', text: '有道理！那我先去摸个鱼——' },
          { speaker: 'xiaoyu', text: '……先做最重要的那件。' },
          { speaker: 'xiaomo', text: '好啦好啦，知道了~' }
        ]
      },
      {
        type: 'sync',
        lines: [
          { speaker: 'xiaomo', text: '一二三——' },
          { speaker: 'xiaoyu', text: '今天也辛苦了。' },
          { speaker: 'xiaomo', text: '你超棒的！继续加油！' },
          { speaker: 'xiaoyu', text: '我们都在。' }
        ]
      }
    ],
    'xiaomo+lanling': [
      {
        type: 'tease',
        lines: [
          { speaker: 'xiaomo', text: '懒零！别睡了起来玩！' },
          { speaker: 'lanling', text: '……不要，被窝里好舒服……' },
          { speaker: 'xiaomo', text: '再睡就要变成球啦！' },
          { speaker: 'lanling', text: '……球就球，球也很可爱。' }
        ]
      },
      {
        type: 'chat',
        lines: [
          { speaker: 'xiaomo', text: '懒零懒零，你说世界上最好吃的东西是什么？' },
          { speaker: 'lanling', text: '……只要是吃的，都好吃。' },
          { speaker: 'xiaomo', text: '那你最想吃什么？' },
          { speaker: 'lanling', text: '……现在最想吃的……是你手里的零食。' },
          { speaker: 'xiaomo', text: '嘿！你倒是不傻！' }
        ]
      },
      {
        type: 'play',
        lines: [
          { speaker: 'xiaomo', text: '懒零！来玩游戏！我追你跑！' },
          { speaker: 'lanling', text: '……跑不动……你追我，我也不跑。' },
          { speaker: 'xiaomo', text: '那玩什么？' },
          { speaker: 'lanling', text: '……比赛谁先睡着。' },
          { speaker: 'xiaomo', text: '……这算什么游戏啊！' }
        ]
      },
      {
        type: 'comfort',
        lines: [
          { speaker: 'xiaomo', text: '懒零你怎么了？看起来闷闷不乐的。' },
          { speaker: 'lanling', text: '……今天的零食吃完了……好难过……' },
          { speaker: 'xiaomo', text: '就这？走！我请你吃！' },
          { speaker: 'lanling', text: '！！！真的吗！！你是世界上最好的人！' },
          { speaker: 'xiaomo', text: '哈哈，吃完要陪我玩哦！' }
        ]
      },
      {
        type: 'chat',
        lines: [
          { speaker: 'xiaomo', text: '懒零，你每天除了吃就是睡，不觉得无聊吗？' },
          { speaker: 'lanling', text: '……不无聊呀。吃的时候很幸福，睡的时候很舒服。' },
          { speaker: 'xiaomo', text: '那你就没有什么梦想吗？' },
          { speaker: 'lanling', text: '……梦想？嗯……每天都有吃不完的零食，和睡不完的觉。' },
          { speaker: 'xiaomo', text: '……还真是符合你的风格。' }
        ]
      }
    ],
    'xiaoyu+lanling': [
      {
        type: 'comfort',
        lines: [
          { speaker: 'xiaoyu', text: '懒零，今天任务都完成了吗？' },
          { speaker: 'lanling', text: '还没……好困……' },
          { speaker: 'xiaoyu', text: '先睡一会儿吧，醒了我陪你做。' },
          { speaker: 'lanling', text: '小余最好了……zzZ……' },
          { speaker: 'xiaoyu', text: '……（轻轻盖上被子）' }
        ]
      },
      {
        type: 'chat',
        lines: [
          { speaker: 'xiaoyu', text: '懒零，该吃饭了。' },
          { speaker: 'lanling', text: '……不饿……再睡会儿……' },
          { speaker: 'xiaoyu', text: '你昨天也是这么说的，然后半夜起来找吃的。' },
          { speaker: 'lanling', text: '……好吧，那我勉为其难去吃一点。' },
          { speaker: 'xiaoyu', text: '这才对。' }
        ]
      },
      {
        type: 'tease',
        lines: [
          { speaker: 'lanling', text: '小余……我好累……可以不做任务吗？' },
          { speaker: 'xiaoyu', text: '不可以。做完再休息。' },
          { speaker: 'lanling', text: '就一次嘛……好不好嘛……' },
          { speaker: 'xiaoyu', text: '……做完这件，我让你睡半小时。' },
          { speaker: 'lanling', text: '成交！！' }
        ]
      },
      {
        type: 'chat',
        lines: [
          { speaker: 'xiaoyu', text: '周末有什么计划？' },
          { speaker: 'lanling', text: '……睡觉。' },
          { speaker: 'xiaoyu', text: '除了睡觉呢？' },
          { speaker: 'lanling', text: '……睡醒了吃，吃完了继续睡。' },
          { speaker: 'xiaoyu', text: '……出门走走吧，对你身体好。' },
          { speaker: 'lanling', text: '……出门的话……有好吃的吗？' },
          { speaker: 'xiaoyu', text: '有。' },
          { speaker: 'lanling', text: '那我去！' }
        ]
      },
      {
        type: 'sync',
        lines: [
          { speaker: 'xiaoyu', text: '今天的任务完成得不错。' },
          { speaker: 'lanling', text: '……好厉害……（鼓掌）' },
          { speaker: 'xiaoyu', text: '辛苦了，休息一下吧。' },
          { speaker: 'lanling', text: '……休息！我最擅长了！' }
        ]
      }
    ],
    trio: [
      {
        type: 'sync',
        lines: [
          { speaker: 'xiaomo', text: '一二三——' },
          { speaker: 'xiaoyu', text: '今天也辛苦了。' },
          { speaker: 'lanling', text: '……加油……（打哈欠）' },
          { speaker: 'xiaomo', text: '你超棒的！继续冲！' },
          { speaker: 'xiaoyu', text: '我们都在。' },
          { speaker: 'lanling', text: '……冲完可以吃零食吗？' },
          { speaker: 'xiaomo', text: '哈哈哈哈当然可以！' }
        ]
      },
      {
        type: 'chat',
        lines: [
          { speaker: 'xiaomo', text: '你们说，咱们三个谁最靠谱？' },
          { speaker: 'xiaoyu', text: '……' },
          { speaker: 'lanling', text: '……反正不是我。' },
          { speaker: 'xiaomo', text: '那肯定是小余啦！成熟稳重可靠！' },
          { speaker: 'xiaoyu', text: '……谢谢。' },
          { speaker: 'lanling', text: '那谁最不靠谱？' },
          { speaker: 'xiaomo', text: '……（看向懒零）' },
          { speaker: 'lanling', text: '……看我干嘛，我只是爱吃爱睡，又不闯祸。' },
          { speaker: 'xiaoyu', text: '……都靠谱。' }
        ]
      },
      {
        type: 'play',
        lines: [
          { speaker: 'xiaomo', text: '大家！我们来玩个游戏吧！' },
          { speaker: 'xiaoyu', text: '什么游戏？' },
          { speaker: 'lanling', text: '……可以躺着玩吗？' },
          { speaker: 'xiaomo', text: '比赛谁先把今天的任务做完！' },
          { speaker: 'lanling', text: '……我退出。' },
          { speaker: 'xiaoyu', text: '……我参加。' },
          { speaker: 'xiaomo', text: '懒零你别走！赢了有零食！' },
          { speaker: 'lanling', text: '……我突然觉得我可以了。' }
        ]
      },
      {
        type: 'comfort',
        lines: [
          { speaker: 'xiaomo', text: '唉……今天好像什么都没做好……' },
          { speaker: 'xiaoyu', text: '没关系。你已经尽力了。' },
          { speaker: 'lanling', text: '……吃点好吃的，睡一觉，明天就好了。' },
          { speaker: 'xiaomo', text: '对！懒零说得对！没有什么是一顿好吃的解决不了的！' },
          { speaker: 'xiaoyu', text: '如果有，就两顿。' },
          { speaker: 'lanling', text: '……三顿也行。' }
        ]
      },
      {
        type: 'chat',
        lines: [
          { speaker: 'xiaomo', text: '你们说，用户现在在干嘛呢？' },
          { speaker: 'xiaoyu', text: '应该在休息。夜深了。' },
          { speaker: 'lanling', text: '……好羡慕……我也想睡……' },
          { speaker: 'xiaomo', text: '那你睡呀！' },
          { speaker: 'lanling', text: '……你们聊天太吵了，睡不着。' },
          { speaker: 'xiaoyu', text: '……那我们安静一点。' },
          { speaker: 'xiaomo', text: '好好好，嘘——' },
          { speaker: '', text: '（三个都安静了，只有懒零的呼噜声……）' }
        ]
      }
    ]
  };


  return { QUOTES: QUOTES, CHARACTERS: CHARACTERS, SNACKS: SNACKS, ACHIEVEMENTS: ACHIEVEMENTS, DIALOGUES: DIALOGUES };
});
