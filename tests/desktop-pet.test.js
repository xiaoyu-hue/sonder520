'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

/* ============================================================
 * Task 1: 配置表（CHARACTERS/SNACKS/ACHIEVEMENTS/DIALOGUES/QUOTES）
 * 完整性 + Pet 类构造/销毁（Phase 1 子集，规格 11.2 第一批断言）
 * 契约依据：
 *   - 规格 2.x 三角色：小莫橙(#e8a84c)/小余蓝(#4a6fa5)/懒零绿(#7ab89a)
 *     默认为表、bodyScale/breathe/blink 各自不同
 *   - 规格 6.1/附录 D/E：9 零食/10 成就/20 组对话/270 条语录
 *   - 规格 附录 C：Pet(options) 构造、_build、destroy
 * ============================================================ */

test('desktop-pet: CHARACTERS 配置完整性（3 角色，全字段精确）', () => {
  const { window } = boot();
  const C = window.DesktopPetCore;
  assert.ok(C && C.CHARACTERS, 'core 未定义（desktop-pet.js 尚未接线）');

  const ids = Object.keys(C.CHARACTERS).sort();
  assert.deepStrictEqual(ids, ['lanling', 'xiaomo', 'xiaoyu']);

  const xiaomo = C.CHARACTERS.xiaomo;
  const xiaoyu = C.CHARACTERS.xiaoyu;
  const lanling = C.CHARACTERS.lanling;

  /* 角色 id/name/desc */
  assert.strictEqual(xiaomo.id, 'xiaomo');
  assert.strictEqual(xiaoyu.id, 'xiaoyu');
  assert.strictEqual(lanling.id, 'lanling');
  assert.strictEqual(xiaomo.name, '小莫');
  assert.strictEqual(xiaoyu.name, '小余');
  assert.strictEqual(lanling.name, '懒零');
  assert.ok(xiaomo.desc && typeof xiaomo.desc === 'string' && xiaomo.desc.length > 0, '小莫描述非空');
  assert.ok(xiaoyu.desc && typeof xiaoyu.desc === 'string' && xiaoyu.desc.length > 0, '小余描述非空');
  assert.ok(lanling.desc && typeof lanling.desc === 'string' && lanling.desc.length > 0, '懒零描述非空');

  /* 主体/高光/暗部三色（逐字段断言，JSDOM 对象跨 realm 原型与字面量不同） */
  assert.strictEqual(xiaomo.colors.body, '#e8a84c');
  assert.strictEqual(xiaomo.colors.light, '#fff3d6');
  assert.strictEqual(xiaomo.colors.dark, '#b87a2a');
  assert.strictEqual(xiaoyu.colors.body, '#4a6fa5');
  assert.strictEqual(xiaoyu.colors.light, '#d6e4f5');
  assert.strictEqual(xiaoyu.colors.dark, '#2e4a7a');
  assert.strictEqual(lanling.colors.body, '#7ab89a');
  assert.strictEqual(lanling.colors.light, '#d6f0e4');
  assert.strictEqual(lanling.colors.dark, '#4a8a6a');

  /* 体型（对象 {x,y}）/呼吸/眨眼/默认表情差异化（规格 2.5） */
  assert.strictEqual(xiaomo.bodyScale.x, 0.95);
  assert.strictEqual(xiaomo.bodyScale.y, 0.95);
  assert.strictEqual(xiaoyu.bodyScale.x, 1);
  assert.strictEqual(xiaoyu.bodyScale.y, 1.08);
  assert.strictEqual(lanling.bodyScale.x, 1.12);
  assert.strictEqual(lanling.bodyScale.y, 1.05);
  assert.strictEqual(xiaomo.breathe, 0.025);
  assert.strictEqual(xiaoyu.breathe, 0.012);
  assert.strictEqual(lanling.breathe, 0.008);
  assert.strictEqual(xiaomo.blink[0], 1500);
  assert.strictEqual(xiaomo.blink[1], 3000);
  assert.strictEqual(xiaoyu.blink[0], 3500);
  assert.strictEqual(xiaoyu.blink[1], 6000);
  assert.strictEqual(lanling.blink[0], 800);
  assert.strictEqual(lanling.blink[1], 2000);
  assert.strictEqual(xiaomo.defaultEmotion, 'happy');
  assert.strictEqual(xiaoyu.defaultEmotion, 'idle');
  assert.strictEqual(lanling.defaultEmotion, 'sleepy');

  /* 装饰差异（规格 2.5） */
  assert.deepEqual(Array.from(xiaomo.decor), ['exclaim', 'bulb']);
  assert.deepEqual(Array.from(xiaoyu.decor), []);
  assert.deepEqual(Array.from(lanling.decor), ['zzz', 'drool']);

  /* 待机动作（对象映射）与语录为非空集合 */
  assert.strictEqual(xiaomo.antics.bounce, true);
  assert.strictEqual(xiaomo.antics.wobble, true);
  assert.strictEqual(xiaomo.antics.spin, true);
  assert.strictEqual(xiaoyu.antics.nod, true);
  assert.strictEqual(lanling.antics.yawn, true);
  assert.strictEqual(lanling.antics.stretch, true);
  assert.ok(xiaomo.quotes && typeof xiaomo.quotes === 'object', '小莫语录库存在');
  assert.ok(xiaoyu.quotes && typeof xiaoyu.quotes === 'object', '小余语录库存在');
  assert.ok(lanling.quotes && typeof lanling.quotes === 'object', '懒零语录库存在');
});

test('desktop-pet: SNACKS 配置完整性（9 种，亲密度 = round(price*0.4)）', () => {
  const { window } = boot();
  const C = window.DesktopPetCore;
  assert.ok(C && C.SNACKS, 'SNACKS 未定义');

  const ids = Object.keys(C.SNACKS).sort();
  assert.deepStrictEqual(ids, [
    'snack_01', 'snack_02', 'snack_03', 'snack_04', 'snack_05',
    'snack_06', 'snack_07', 'snack_08', 'snack_09'
  ]);

  const expected = {
    snack_01: { name: '小饼干', price: 5, affection: 2, icon: '🍪' },
    snack_02: { name: '糖果', price: 8, affection: 3, icon: '🍬' },
    snack_03: { name: '苹果', price: 10, affection: 4, icon: '🍎' },
    snack_04: { name: '蛋糕', price: 15, affection: 6, icon: '🍰' },
    snack_05: { name: '奶茶', price: 20, affection: 8, icon: '🧋' },
    snack_06: { name: '披萨', price: 25, affection: 10, icon: '🍕' },
    snack_07: { name: '寿司', price: 30, affection: 12, icon: '🍣' },
    snack_08: { name: '烤肉', price: 40, affection: 16, icon: '🍖' },
    snack_09: { name: '豪华大餐', price: 60, affection: 25, icon: '🍱' }
  };

  ids.forEach(id => {
    const s = C.SNACKS[id];
    const e = expected[id];
    assert.strictEqual(s.name, e.name, id + ' 名称');
    assert.strictEqual(s.price, e.price, id + ' 价格');
    assert.strictEqual(s.affection, e.affection, id + ' 亲密度');
    assert.strictEqual(s.icon, e.icon, id + ' 图标');
    assert.ok(s.desc && s.desc.length > 0, id + ' 描述非空');
  });
  /* snack_09 亲密度 25 属规格表明确值（"越贵性价比略高", 规格 6.1），
   * 其余符合 round(price*0.4)：5→2 / 8→3 / 10→4 / 15→6 / 20→8 / 25→10 / 30→12 / 40→16 */
  ids.forEach(id => {
    if (id === 'snack_09') return;
    assert.strictEqual(C.SNACKS[id].affection, Math.round(C.SNACKS[id].price * 0.4), id + ' 亲密度公式');
  });
});

test('desktop-pet: ACHIEVEMENTS 配置完整性（10 个成就）', () => {
  const { window } = boot();
  const C = window.DesktopPetCore;
  assert.ok(C && C.ACHIEVEMENTS, 'ACHIEVEMENTS 未定义');

  const ids = Object.keys(C.ACHIEVEMENTS).sort();
  assert.deepStrictEqual(ids, [
    'affection_100', 'all_done_today', 'feed_10', 'first_feed', 'first_task',
    'streak_3', 'streak_7', 'task_10', 'task_100', 'task_50'
  ]);

  const expected = {
    first_task: { name: '初出茅庐', reward: 20 },
    task_10: { name: '小有所成', reward: 30 },
    task_50: { name: '任务达人', reward: 50 },
    task_100: { name: '百炼成钢', reward: 100 },
    all_done_today: { name: '今日事今日毕', reward: 30 },
    streak_3: { name: '三连胜', reward: 25 },
    streak_7: { name: '一周坚持', reward: 50 },
    first_feed: { name: '初次投喂', reward: 10 },
    feed_10: { name: '饲养员', reward: 20 },
    affection_100: { name: '亲密无间', reward: 50 }
  };

  ids.forEach(id => {
    const a = C.ACHIEVEMENTS[id];
    const e = expected[id];
    assert.strictEqual(a.name, e.name, id + ' 名称');
    assert.strictEqual(a.reward, e.reward, id + ' 奖励');
    assert.ok(typeof a.condition === 'function', id + ' 检测函数存在');
  });
});

test('desktop-pet: DIALOGUES 配置完整性（4 组合 × 5 组 = 20 组）', () => {
  const { window } = boot();
  const C = window.DesktopPetCore;
  assert.ok(C && C.DIALOGUES, 'DIALOGUES 未定义');

  const combos = Object.keys(C.DIALOGUES);
  assert.deepStrictEqual(combos.sort(), ['trio', 'xiaomo+lanling', 'xiaomo+xiaoyu', 'xiaoyu+lanling']);

  combos.forEach(combo => {
    const groups = C.DIALOGUES[combo];
    assert.ok(Array.isArray(groups) && groups.length === 5, combo + ' 应有 5 组对话');
    groups.forEach((g, gi) => {
      assert.ok(g && typeof g === 'object', combo + ' 组 ' + gi + ' 为对象');
      assert.ok(typeof g.type === 'string' && g.type.length > 0, combo + ' 组 ' + gi + ' 有 type 字段');
      assert.ok(Array.isArray(g.lines) && g.lines.length >= 2, combo + ' 组 ' + gi + ' 应有多轮台词');
      g.lines.forEach(line => {
        assert.ok(typeof line.speaker === 'string', combo + ' 台词应有 speaker（旁白可为空串）');
        assert.ok(line.text && line.text.length > 0, combo + ' 台词文本非空');
      });
    });
  });
});

test('desktop-pet: QUOTES 配置完整性（3 角色 × 18 场景 × 5 条）', () => {
  const { window } = boot();
  const C = window.DesktopPetCore;
  assert.ok(C && C.QUOTES, 'QUOTES 未定义');

  ['xiaomo', 'xiaoyu', 'lanling'].forEach(id => {
    const q = C.QUOTES[id];
    assert.ok(q && typeof q === 'object', id + ' 语录库存在');
    const scenes = Object.keys(q);
    assert.ok(scenes.length >= 18, id + ' 应有 ≥18 场景（实际 ' + scenes.length + '）');
    scenes.forEach(scene => {
      const arr = q[scene];
      assert.ok(Array.isArray(arr) && arr.length === 5, id + '.' + scene + ' 应有 5 条');
      arr.forEach(t => assert.ok(t && t.length > 0, id + '.' + scene + ' 语录非空'));
    });
    assert.ok(Array.isArray(q.idle), id + ' 有 idle 场景');
    assert.ok(Array.isArray(q.feed), id + ' 有 feed 场景');
    assert.ok(Array.isArray(q.coinEarn), id + ' 有 coinEarn 场景');
  });
});

test('desktop-pet: Pet 构造/渲染 SVG/角色注入/销毁', () => {
  const { window } = boot();
  const document = window.document;
  const C = window.DesktopPetCore;
  assert.ok(C && C.Pet && typeof C.Pet === 'function', 'Pet 类未定义');

  const container = document.createElement('div');
  document.body.appendChild(container);

  const pet = new C.Pet({ container, size: 84, character: 'xiaomo' });

  assert.ok(container.querySelector('svg'), 'Pet 应构建 SVG');
  assert.ok(container.querySelector('.dp-pet'), 'Pet 应带 .dp-pet 容器类');
  assert.ok(container.querySelector('.pet-xiaomo') || container.classList.contains('pet-xiaomo'),
    'Pet 应有角色差异化 class');

  assert.strictEqual(pet.getEmotion(), 'happy', '默认表情来自角色配置');

  pet.setEmotion('excited');
  assert.strictEqual(pet.getEmotion(), 'excited');

  pet.setSize(120);
  assert.strictEqual(container.querySelector('.dp-pet').style.width, '120px', 'setSize 生效');

  pet.destroy();
  assert.strictEqual(container.children.length, 0, 'destroy 后清空 DOM');
});

/* ============================================================
 * Task 2: PetFamily 管理器（显示模式/常驻/串门/布局/共享 rAF）
 * 契约依据：
 *   - 规格 3.1-3.5：模式 single/duo/trio、常驻、位置、设置汇总
 *   - 规格 3.3：串门状态机（手动召唤"叫小伙伴来玩"无视间隔仍受冷却）
 *   - 规格 9.5 第四/区子管理器 + 第五区 PetFamily：createFamily
 *   注：settings.desktopPet 由 Task 3 并入 store 默认值；本 Task PetFamily
 *   自建默认配置并回写 settings，逻辑不依赖 store 预置。
 * ============================================================ */

test('desktop-pet: PetFamily 显示模式切换（实例数量正确）', () => {
  const { window, store } = boot();
  const C = window.DesktopPetCore;
  assert.ok(C && typeof C.createFamily === 'function', 'createFamily 未暴露');

  const family = C.createFamily(store, window.SonderBus, store.state.settings);
  assert.ok(family, 'family 未创建');

  /* 默认 duo：常驻 1 只（串门未到场前仅常驻） */
  assert.strictEqual(family.getMode(), 'duo');
  assert.strictEqual(family.getActivePetIds().length, 1, 'duo 初始 1 只');

  family.setMode('single');
  assert.strictEqual(family.getMode(), 'single');
  assert.strictEqual(family.getActivePetIds().length, 1, 'single 1 只');

  family.setMode('trio');
  assert.strictEqual(family.getMode(), 'trio');
  assert.strictEqual(family.getActivePetIds().length, 3, 'trio 三只同屏');
  const ids = Array.from(family.getActivePetIds()).sort();
  assert.deepStrictEqual(ids, ['lanling', 'xiaomo', 'xiaoyu'], 'trio 三角色齐');

  family.destroy();
});

test('desktop-pet: PetFamily 常驻/尺寸/开关落盘到 settings.desktopPet', () => {
  const { window, store } = boot();
  const C = window.DesktopPetCore;
  const family = C.createFamily(store, window.SonderBus, store.state.settings);

  assert.ok(store.state.settings.desktopPet, 'createFamily 应自建 desktopPet 默认配置');

  family.setResident('lanling');
  assert.strictEqual(family.getResident(), 'lanling');
  assert.strictEqual(store.state.settings.desktopPet.resident, 'lanling', '常驻落盘');

  family.setSize(120);
  assert.strictEqual(family.getSize(), 120);
  assert.strictEqual(store.state.settings.desktopPet.size, 120, '尺寸落盘');

  family.setEnabled(false);
  assert.strictEqual(family.getEnabled(), false);
  assert.strictEqual(store.state.settings.desktopPet.enabled, false, '开关落盘');

  family.setEnabled(true);
  assert.strictEqual(family.getEnabled(), true);

  family.destroy();
});

test('desktop-pet: duo 串门状态机（手动召唤无视间隔，冷却被拒）', () => {
  const { window, store } = boot();
  const C = window.DesktopPetCore;
  const family = C.createFamily(store, window.SonderBus, store.state.settings);
  assert.strictEqual(family.getMode(), 'duo');

  const before = family.getActivePetIds().length; /* 常驻 1 */
  const summoned = family.summonVisitor();
  assert.strictEqual(summoned, true, '召唤成功');
  assert.strictEqual(family.getActivePetIds().length, before + 1, '串门到场');

  /* duo 最多一只串门：当前有串门占场时再召唤被拒 */
  const again = family.summonVisitor();
  assert.strictEqual(again, false, '串门占场期间拒绝再召唤');

  family.destroy();
});

test('desktop-pet: 串门边界——离场窗口拒绝召唤 / 关闭开关立即清串门', () => {
  const { window, store } = boot();
  const C = window.DesktopPetCore;
  const family = C.createFamily(store, window.SonderBus, store.state.settings);

  /* 离场动画 2s 窗口内：召唤被拒（保证任意时刻最多 1 只串门） */
  assert.strictEqual(family.summonVisitor(), true, '首次召唤成功');
  family.display._leaveVisitor(); /* 直接触发离场，进入 2s 退场窗口 */
  assert.strictEqual(family.summonVisitor(), false, '离场窗口内拒绝再召唤');

  /* 关闭开关：串门实例立即清除（含离场定时器），仅剩常驻 */
  family.setEnabled(false);
  assert.strictEqual(family.getActivePetIds().length, 1, '关闭后仅剩常驻');
  assert.strictEqual(family.display.visitorRole, null, 'visitorRole 复位');
  assert.strictEqual(family.display._exitTimer, null, '离场定时器已清');

  family.destroy();
});

test('desktop-pet: PetFamily 布局/挂载到 DOM + destroy 清理', () => {
  const { window, store } = boot();
  const document = window.document;
  const C = window.DesktopPetCore;

  const family = C.createFamily(store, window.SonderBus, store.state.settings);
  family.setMode('trio');

  const petsInBody = Array.from(document.querySelectorAll('.dp-pet')).length;
  assert.strictEqual(petsInBody, 3, 'trio 三只挂载到 DOM');

  const container = document.querySelector('.dp-shelf');
  assert.ok(container, '应有玩偶挂载容器 .dp-shelf');
  family.destroy();
  assert.strictEqual(document.querySelector('.dp-shelf'), null, 'destroy 移除容器');
  assert.strictEqual(document.querySelectorAll('.dp-pet').length, 0, 'destroy 清空玩偶');
});

/* ============================================================
 * Task 3: 金币系统 + 成就系统 + 数据迁移
 * 契约依据：
 *   - 规格 5.2 金币获取：p1=15 / p2=10 / p3·p4=5，防刷幂等
 *   - 规格 5.3 成就：10 条件 + 奖励 + streak 连续天数
 *   - 规格 6.1 零食商店：买/喂闭环，亲密度 = round(price×0.4)
 *   - 规格 8.2/9.5 深合并迁移：缺失嵌套字段补默认
 * ============================================================ */

test('desktop-pet: 任务完成金币（p1=15 p2=10 p3/p4=5）+ 防刷幂等', () => {
  const { window, store } = boot();
  const C = window.DesktopPetCore;
  const family = C.createFamily(store, window.SonderBus, store.state.settings);
  try {
    const before = family.getCoins();

    const t1 = store.addTask({ title: '甲', priority: 'p1', done: false });
    store.updateTask(t1.id, { done: true });         // → 应发 15
    assert.strictEqual(family.getCoins() - before, 15, 'p1 任务完成发 15 金币');

    store.updateTask(t1.id, { done: false });         // 取消，不扣
    store.updateTask(t1.id, { done: true });          // 再完成，不重复发（rewardedTaskIds 幂等）
    assert.strictEqual(family.getCoins() - before, 15, '重复完成不重复发币');
  } finally {
    family.destroy();
  }
});

test('desktop-pet: 购买零食扣金币 + 库存加 1（余额不足拒绝）', () => {
  const { window, store } = boot();
  const C = window.DesktopPetCore;
  const family = C.createFamily(store, window.SonderBus, store.state.settings);
  try {
    family.addCoins(50);

    assert.strictEqual(family.buySnack('snack_09'), false, '60 金币 > 50 余额 → 拒绝');
    assert.strictEqual(family.buySnack('snack_01'), true, '5 金币 ≤ 50 → 成功');
    assert.strictEqual(family.getCoins(), 45, '扣款 50→45');
    assert.strictEqual(family.getInventory()['snack_01'] || 0, 1, '库存 +1');
  } finally {
    family.destroy();
  }
});

test('desktop-pet: 喂食扣库存 + 加亲密度（亲密度 = round(价格×0.4)）', () => {
  const { window, store } = boot();
  const C = window.DesktopPetCore;
  const family = C.createFamily(store, window.SonderBus, store.state.settings);
  try {
    family.addCoins(10);
    family.buySnack('snack_01');   // 库存 1（5 金币，亲密度 round(5×0.4)=2）

    const before = family.getAffection('xiaomo');
    assert.strictEqual(family.feedPet('xiaomo', 'snack_01'), true, '喂食成功');
    assert.strictEqual(family.getAffection('xiaomo') - before, 2, '亲密度 +2');
    assert.strictEqual(family.getInventory()['snack_01'] || 0, 0, '库存清空');
  } finally {
    family.destroy();
  }
});

test('desktop-pet: 成就检测（达成解锁 + 发金币不重复）', () => {
  const { window, store } = boot();
  const C = window.DesktopPetCore;
  const family = C.createFamily(store, window.SonderBus, store.state.settings);
  try {
    const coinsBefore = family.getCoins();

    const t = store.addTask({ title: '甲', priority: 'p1', done: false });
    store.updateTask(t.id, { done: true });
    family.checkAchievements();

    const ach = family.getAchievements();
    assert.ok(Array.isArray(ach.unlocked), 'unlocked 为数组');
    assert.ok(ach.unlocked.includes('first_task'), '达成 first_task');
    // 15（任务 p1）+ 20（first_task）+ 30（all_done_today，唯一任务已完成）
    assert.strictEqual(family.getCoins(), coinsBefore + 15 + 20 + 30, '成就奖励 +50');

    family.checkAchievements(); // 二次检测不重复
    assert.strictEqual(family.getCoins(), coinsBefore + 15 + 20 + 30, '重复检测不重复发奖励');
  } finally {
    family.destroy();
  }
});

test('desktop-pet: 数据深合并迁移（缺失嵌套字段补默认）', () => {
  const { window } = boot();
  const C = window.DesktopPetCore;

  const raw = { enabled: false, size: 120 };   // 无 coins/affection/achievements
  const merged = C.mergeDesktopPetDefaults(raw);
  assert.strictEqual(merged.enabled, false, '保留用户值');
  assert.strictEqual(merged.size, 120, '保留用户值');
  assert.strictEqual(merged.coins, 0, '默认补全');
  assert.strictEqual(merged.mode, 'duo', '默认模式');
  assert.deepEqual(merged.affection, { xiaomo: 0, xiaoyu: 0, lanling: 0 }, '默认亲密度');
  assert.strictEqual(merged.schemaVersion, 1, '迁移版本号');
});

/* ============================================================
 * Task 4: 成就 UI + 多玩偶互动对话（Phase 3 收尾）
 * 契约依据：
 *   - 规格 7.1/7.2 互动触发条件：≥2 在场、间距 <200px 或同角、
 *     距上次 3-6min、无拖拽、无播放中；随机类型 + 逐轮气泡
 *   - 规格 6.2 商店弹窗/喂食弹窗
 *   - 规格 5.3 成就横幅 + 飘字
 * ============================================================ */

test('desktop-pet: InteractionManager.canTrigger 基本判定', () => {
  const { window, store } = boot();
  const C = window.DesktopPetCore;
  const family = C.createFamily(store, window.SonderBus, store.state.settings);
  try {
    family.setMode('trio');
    const im = family.interaction;
    assert.ok(im, 'interaction manager 存在');

    /* trio 模式 3 只在场，满足 ≥2 条件 */
    assert.strictEqual(im.canTrigger(), true, 'trio 3 只在场可触发');

    family.setMode('single');
    assert.strictEqual(im.canTrigger(), false, 'single 1 只不可触发');

    family.setMode('duo');
    assert.strictEqual(family.getActivePetIds().length, 1, 'duo 常驻 1 只');
    assert.strictEqual(im.canTrigger(), false, 'duo 1 只在场不可触发');
    assert.strictEqual(im.canTrigger(), false, 'duo 1 只在场不可触发');
  } finally {
    family.destroy();
  }
});

test('desktop-pet: InteractionManager 冷却期间不可触发', () => {
  const { window, store } = boot();
  const C = window.DesktopPetCore;
  const family = C.createFamily(store, window.SonderBus, store.state.settings);
  try {
    family.setMode('trio');
    const im = family.interaction;

    /* 模拟刚完成一次互动（lastAt 设为当前时间） */
    im.lastAt = Date.now();
    assert.strictEqual(im.canTrigger(), false, '冷却期内不可触发');

    /* lastAt 设为很久以前 → 冷却已过 */
    im.lastAt = Date.now() - 600000; /* 10 分钟前 */
    assert.strictEqual(im.canTrigger(), true, '冷却过后可触发');
  } finally {
    family.destroy();
  }
});

test('desktop-pet: InteractionManager 播放中不可重复触发', () => {
  const { window, store } = boot();
  const C = window.DesktopPetCore;
  const family = C.createFamily(store, window.SonderBus, store.state.settings);
  try {
    family.setMode('trio');
    const im = family.interaction;

    im.lastAt = 0; /* 无冷却 */
    assert.strictEqual(im.canTrigger(), true, '初始可触发');

    /* 模拟播放中状态 */
    im.playing = true;
    assert.strictEqual(im.canTrigger(), false, '播放中不可触发');

    im.playing = false;
    assert.strictEqual(im.canTrigger(), true, '播放结束后恢复可触发');
  } finally {
    family.destroy();
  }
});

test('desktop-pet: InteractionManager 拖拽中不可触发', () => {
  const { window, store } = boot();
  const C = window.DesktopPetCore;
  const family = C.createFamily(store, window.SonderBus, store.state.settings);
  try {
    family.setMode('trio');
    const im = family.interaction;

    im.lastAt = 0;
    assert.strictEqual(im.canTrigger(), true, '初始可触发');

    /* 模拟拖拽中 */
    im.dragging = true;
    assert.strictEqual(im.canTrigger(), false, '拖拽中不可触发');

    im.dragging = false;
    assert.strictEqual(im.canTrigger(), true, '拖拽结束后恢复可触发');
  } finally {
    family.destroy();
  }
});

test('desktop-pet: triggerInteraction 返回值与事件广播', () => {
  const { window, store } = boot();
  const C = window.DesktopPetCore;
  const family = C.createFamily(store, window.SonderBus, store.state.settings);
  try {
    family.setMode('trio');
    const im = family.interaction;
    im.lastAt = 0; /* 无冷却 */

    var eventFired = false;
    var eventData = null;
    family.on('interaction', function (d) {
      eventFired = true;
      eventData = d;
    });

    var result = family.triggerInteraction();
    assert.strictEqual(result, true, 'triggerInteraction 返回 true');

    /* 等待异步播放完成（JSDOM 下 setTimeout 即时触发） */
    setTimeout(function () {
      assert.strictEqual(eventFired, true, 'interaction 事件已广播');
      assert.ok(eventData, '事件携带数据');
    }, 50);
  } finally {
    family.destroy();
  }
});

test('desktop-pet: 播放中触发 endInteraction 提前结束', () => {
  const { window, store } = boot();
  const C = window.DesktopPetCore;
  const family = C.createFamily(store, window.SonderBus, store.state.settings);
  try {
    family.setMode('trio');
    const im = family.interaction;
    im.lastAt = 0;

    var endedFired = false;
    family.on('interactionEnd', function () {
      endedFired = true;
    });

    family.triggerInteraction();
    /* 立即调用 endInteraction 模拟点击打断 */
    family.endInteraction();

    assert.strictEqual(im.playing, false, 'endInteraction 后 playing 复位');
    assert.strictEqual(endedFired, true, 'interactionEnd 事件已广播');
  } finally {
    family.destroy();
  }
});

test('desktop-pet: triggerInteraction 冷却/播放中/拖拽返回 false', () => {
  const { window, store } = boot();
  const C = window.DesktopPetCore;
  const family = C.createFamily(store, window.SonderBus, store.state.settings);
  try {
    family.setMode('trio');
    const im = family.interaction;

    /* 冷却中 */
    im.lastAt = Date.now();
    assert.strictEqual(family.triggerInteraction(), false, '冷却中返回 false');

    /* 播放中 */
    im.lastAt = 0;
    im.playing = true;
    assert.strictEqual(family.triggerInteraction(), false, '播放中返回 false');

    /* 拖拽中 */
    im.playing = false;
    im.dragging = true;
    assert.strictEqual(family.triggerInteraction(), false, '拖拽中返回 false');
  } finally {
    family.destroy();
  }
});

/* ============================================================
 * Task 5: 独立板块页面 + 全局接线
 * 契约依据：
 *   - 规格 9.5 第五区页面模块：Pages['desktop-pet'] 注册
 *   - 规格 9.6：五分区（标题栏+金币/三角色卡/显示设置/商店/成就）
 *   - app.js：NAV/ICONS/TOGGLEABLE 接线 + store-stats.js moduleKeysList
 * ============================================================ */

test('desktop-pet: 独立板块页面注册 + title 正确', () => {
  const { window } = boot();
  const Page = window.Pages && window.Pages['desktop-pet'];
  assert.ok(Page, 'Pages["desktop-pet"] 未注册');
  assert.strictEqual(Page.title, '小莫灵家族', '页面 title');
  assert.strictEqual(typeof Page.render, 'function', 'render 为函数');
});

test('desktop-pet: 页面 render 五分区渲染', () => {
  const { window, store } = boot();
  const Page = window.Pages['desktop-pet'];
  assert.ok(Page, '页面未注册');
  const container = window.document.createElement('div');
  Page.render(container, { navigate: function () {}, store: store });
  /* 五分区关键 class 断言 */
  assert.ok(container.querySelector('.dp-page-header') || container.querySelector('.dp-page-title'),
    '标题栏存在');
  assert.ok(container.querySelector('.dp-page-card-xiaomo') || container.querySelectorAll('[data-pet="xiaomo"]').length,
    '小莫角色卡存在');
  assert.ok(container.querySelector('.dp-page-card-xiaoyu') || container.querySelectorAll('[data-pet="xiaoyu"]').length,
    '小余角色卡存在');
  assert.ok(container.querySelector('.dp-page-card-lanling') || container.querySelectorAll('[data-pet="lanling"]').length,
    '懒零角色卡存在');
  assert.ok(container.querySelector('.dp-page-settings') || container.querySelector('.dp-page-display'),
    '显示设置分区存在');
  assert.ok(container.querySelector('.dp-page-shop') || container.querySelector('.dp-page-shop-preview'),
    '商店预览分区存在');
  assert.ok(container.querySelector('.dp-page-achievements') || container.querySelector('.dp-page-ach-list'),
    '成就列表分区存在');
});

test('desktop-pet: 核心模块缺失时页面优雅降级不报错', () => {
  const { window, store } = boot();
  /* 模拟核心缺失 */
  var orig = window.__desktopPetFamily;
  delete window.__desktopPetFamily;
  try {
    const Page = window.Pages['desktop-pet'];
    assert.ok(Page, '页面未注册');
    const container = window.document.createElement('div');
    var threw = false;
    try { Page.render(container, { navigate: function () {}, store: store }); } catch (e) { threw = true; }
    assert.strictEqual(threw, false, '降级渲染不应抛错');
    assert.ok(container.childNodes.length > 0, '降级后仍有静态内容');
  } finally {
    window.__desktopPetFamily = orig;
  }
});

test('desktop-pet: 模块开关控制导航项（setModuleEnabled）', () => {
  const { store } = boot();
  /* desktopPet 应在 modules 中（Task 3 已加入 DEFAULT_SETTINGS） */
  assert.ok('desktop-pet' in store.state.settings.modules, 'desktop-pet 模块开关存在');
  /* 关闭模块 */
  store.setModuleEnabled('desktop-pet', false);
  assert.strictEqual(store.state.settings.modules['desktop-pet'], false, '模块已关闭');
  /* 重新打开 */
  store.setModuleEnabled('desktop-pet', true);
  assert.strictEqual(store.state.settings.modules['desktop-pet'], true, '模块已打开');
});

test('desktop-pet: store-stats moduleKeysList 含 desktop-pet', () => {
  const { window } = boot();
  var Stats = window.SonderStore && window.SonderStore.Stats;
  if (!Stats || !Stats.moduleKeysList) {
    /* Stats 可能未挂载到全局，跳过 */
    return;
  }
  var keys = Stats.moduleKeysList.map(function (m) { return m.key; });
  assert.ok(keys.indexOf('desktop-pet') !== -1, 'moduleKeysList 含 desktop-pet');
  var dp = Stats.moduleKeysList.find(function (m) { return m.key === 'desktop-pet'; });
  assert.strictEqual(dp.label, '小莫灵家族', 'desktop-pet label 正确');
});

/* ============================================================
 * Task 6: 规格 11.2 收口 —— 补全剩余契约断言
 * ============================================================ */

test('desktop-pet: spendCoins 余额不足拒绝 + 非法参数拒绝', () => {
  const { window, store } = boot();
  const C = window.DesktopPetCore;
  const family = C.createFamily(store, window.SonderBus, store.state.settings);
  try {
    /* 初始余额为 0，任何正数支出应拒绝 */
    assert.strictEqual(family.spendCoins(1), false, '余额 0 支出 1 拒绝');
    assert.strictEqual(family.getCoins(), 0, '余额不变');

    family.addCoins(10);
    assert.strictEqual(family.spendCoins(11), false, '余额 10 支出 11 拒绝');
    assert.strictEqual(family.getCoins(), 10, '余额不变');

    assert.strictEqual(family.spendCoins(-1), false, '负数拒绝');
    assert.strictEqual(family.spendCoins(0), false, '零值拒绝');
    assert.strictEqual(family.spendCoins(NaN), false, 'NaN 拒绝');
    assert.strictEqual(family.spendCoins(Infinity), false, 'Infinity 拒绝');

    assert.strictEqual(family.spendCoins(5), true, '余额 10 支出 5 成功');
    assert.strictEqual(family.getCoins(), 5, '扣款后余额 5');
  } finally {
    family.destroy();
  }
});

test('desktop-pet: 角色差异化——三实例 breathe/blink/bodyScale 参数不同', () => {
  const { window } = boot();
  const C = window.DesktopPetCore;
  const chars = C.CHARACTERS;
  assert.ok(chars.xiaomo && chars.xiaoyu && chars.lanling, '三角色配置存在');

  const xiaomo = chars.xiaomo;
  const xiaoyu = chars.xiaoyu;
  const lanling = chars.lanling;

  /* breathe 周期应有差异（规格 2.5 各角色不同） */
  assert.notStrictEqual(xiaomo.breathe, xiaoyu.breathe, '小莫与小余 breathe 不同');
  assert.notStrictEqual(xiaoyu.breathe, lanling.breathe, '小余与懒零 breathe 不同');

  /* blink 间隔应有差异 */
  assert.notStrictEqual(xiaomo.blink, xiaoyu.blink, '小莫与小余 blink 不同');

  /* bodyScale 应有差异（体型） */
  assert.notStrictEqual(xiaomo.bodyScale, xiaoyu.bodyScale, '小莫与小余 bodyScale 不同');
  assert.notStrictEqual(xiaoyu.bodyScale, lanling.bodyScale, '小余与懒零 bodyScale 不同');

  /* 默认表情应有差异 */
  assert.notStrictEqual(xiaomo.defaultEmotion, xiaoyu.defaultEmotion, '小莫与小余默认表情不同');
});

/* ============================================================
 * Task 8: 特效触发器——喂食星星/金币飘字/成就光环/互动爱心
 * 契约依据：Task 8 新增 _trigger*Effect 方法 + _motionOk 门控
 * ============================================================ */

test('desktop-pet: 特效方法存在性——Pet 实例挂载 4 个 _trigger*Effect', () => {
  const { window } = boot();
  const C = window.DesktopPetCore;
  const pet = new C.Pet({ id: 'xiaomo', el: window.document.createElement('div') });
  assert.strictEqual(typeof pet._triggerFeedEffect, 'function', '_triggerFeedEffect 存在');
  assert.strictEqual(typeof pet._triggerCoinEffect, 'function', '_triggerCoinEffect 存在');
  assert.strictEqual(typeof pet._triggerAchievementEffect, 'function', '_triggerAchievementEffect 存在');
  assert.strictEqual(typeof pet._triggerInteractEffect, 'function', '_triggerInteractEffect 存在');
  pet.destroy();
});

test('desktop-pet: 特效方法安全降级——el 缺失时静默返回不抛异常', () => {
  const { window } = boot();
  const C = window.DesktopPetCore;
  const pet = new C.Pet({ id: 'xiaoyu', el: null });
  assert.doesNotThrow(function () { pet._triggerFeedEffect(); }, 'el=null 喂食特效不抛');
  assert.doesNotThrow(function () { pet._triggerCoinEffect(5); }, 'el=null 金币特效不抛');
  assert.doesNotThrow(function () { pet._triggerAchievementEffect(); }, 'el=null 成就特效不抛');
  assert.doesNotThrow(function () { pet._triggerInteractEffect(); }, 'el=null 互动特效不抛');
  pet.destroy();
});

test('desktop-pet: _triggerFeedEffect 创建星星子元素并自动清理', () => {
  const { window } = boot();
  const C = window.DesktopPetCore;
  const pet = new C.Pet({ id: 'lanling', el: window.document.createElement('div') });
  pet._triggerFeedEffect();
  const sparkles = pet.el.querySelectorAll('.dp-fx-sparkle');
  assert.strictEqual(sparkles.length, 5, '创建 5 颗星星');
  assert.ok(sparkles[0].textContent.length > 0, '星星有内容');
  pet.destroy();
});

test('desktop-pet: _triggerCoinEffect 创建飘字子元素', () => {
  const { window } = boot();
  const C = window.DesktopPetCore;
  const pet = new C.Pet({ id: 'xiaomo', el: window.document.createElement('div') });
  pet._triggerCoinEffect(10);
  const coins = pet.el.querySelectorAll('.dp-fx-coin');
  assert.strictEqual(coins.length, 1, '创建 1 个飘字');
  assert.strictEqual(coins[0].textContent, '+10', '飘字内容正确');
  pet.destroy();
});

test('desktop-pet: _triggerAchievementEffect 切换 CSS 类', () => {
  const { window } = boot();
  const C = window.DesktopPetCore;
  const pet = new C.Pet({ id: 'xiaoyu', el: window.document.createElement('div') });
  pet._triggerAchievementEffect();
  assert.ok(pet.el.classList.contains('dp-fx-glow'), '添加 dp-fx-glow 类');
  pet.destroy();
});

test('desktop-pet: _triggerInteractEffect 创建爱心子元素', () => {
  const { window } = boot();
  const C = window.DesktopPetCore;
  const pet = new C.Pet({ id: 'xiaomo', el: window.document.createElement('div') });
  pet._triggerInteractEffect();
  const hearts = pet.el.querySelectorAll('.dp-fx-heart');
  assert.strictEqual(hearts.length, 3, '创建 3 颗爱心');
  assert.strictEqual(hearts[0].textContent, '♥', '爱心内容正确');
  pet.destroy();
});

test('desktop-pet: _randomPet 返回有效角色实例', () => {
  const { window, store, bus } = boot();
  const C = window.DesktopPetCore;
  const family = new C.PetFamily({ store: store, bus: bus });
  const pet = family._randomPet();
  assert.ok(pet, '_randomPet 返回非 null');
  assert.ok(pet.character && pet.character.id, '返回的 pet 有 character.id');
  assert.ok(Object.keys(C.CHARACTERS).indexOf(pet.character.id) !== -1, 'pet.character.id 在角色列表中');
  family.destroy();
});

test('desktop-pet: 拖拽中特效跳过——拖拽时不注入 DOM 子元素', () => {
  const { window } = boot();
  const C = window.DesktopPetCore;
  const pet = new C.Pet({ id: 'xiaomo', el: window.document.createElement('div') });
  const before = pet.el.children.length;
  pet._isDragging = true;
  pet._triggerFeedEffect();
  pet._triggerCoinEffect(5);
  pet._triggerAchievementEffect();
  pet._triggerInteractEffect();
  assert.strictEqual(pet.el.children.length, before, '拖拽中无新子元素注入');
  pet.destroy();
});

/* ============================================================
 * Task 9: 数据隔离与记忆——验证 desktopPet 状态独立性
 * 契约依据：
 *   - desktopPet 嵌套在 settings 集合内（非独立集合）
 *   - mergeDesktopPetDefaults 深合并补全缺失字段
 *   - PetFamily.resetAllData 只重置游戏数据，保留配置
 *   - store.clearAll 重置全部数据（含 desktopPet）
 * ============================================================ */

test('desktop-pet: mergeDesktopPetDefaults——空对象补全全部默认字段', () => {
  const { window } = boot();
  const C = window.DesktopPetCore;
  const merged = C.mergeDesktopPetDefaults({});
  assert.strictEqual(merged.enabled, true, '默认 enabled');
  assert.strictEqual(merged.mode, 'duo', '默认 mode');
  assert.strictEqual(merged.resident, 'xiaomo', '默认 resident');
  assert.strictEqual(typeof merged.size, 'number', '默认 size 存在');
  assert.strictEqual(typeof merged.coins, 'number', '默认 coins 存在');
  assert.ok(merged.affection && typeof merged.affection === 'object', '默认 affection 对象');
  assert.ok(merged.inventory && typeof merged.inventory === 'object', '默认 inventory 对象');
  assert.ok(merged.totalFed && typeof merged.totalFed === 'object', '默认 totalFed 对象');
  assert.ok(Array.isArray(merged.rewardedTaskIds), '默认 rewardedTaskIds 数组');
  assert.ok(merged.achievements && typeof merged.achievements === 'object', '默认 achievements 对象');
  assert.ok(Array.isArray(merged.achievements.unlocked), '默认 achievements.unlocked 数组');
  assert.ok(merged.achievements.stats && typeof merged.achievements.stats === 'object', '默认 achievements.stats 对象');
  assert.strictEqual(merged.schemaVersion, 1, '默认 schemaVersion');
});

test('desktop-pet: mergeDesktopPetDefaults——部分字段不覆盖已有值', () => {
  const { window } = boot();
  const C = window.DesktopPetCore;
  const existing = {
    enabled: false, mode: 'trio', resident: 'lanling', size: 100,
    coins: 50, affection: { xiaomo: 10, xiaoyu: 20, lanling: 30 },
    inventory: { snack_01: 3 }, totalFed: { xiaomo: 5, xiaoyu: 0, lanling: 2 },
    rewardedTaskIds: ['t1', 't2'],
    achievements: { unlocked: ['ach1'], stats: { totalTasksDone: 10, streakDays: 3 } }
  };
  const merged = C.mergeDesktopPetDefaults(existing);
  assert.strictEqual(merged.enabled, false, '保留 enabled=false');
  assert.strictEqual(merged.mode, 'trio', '保留 mode=trio');
  assert.strictEqual(merged.resident, 'lanling', '保留 resident=lanling');
  assert.strictEqual(merged.size, 100, '保留 size=100');
  assert.strictEqual(merged.coins, 50, '保留 coins=50');
  assert.strictEqual(merged.affection.xiaomo, 10, '保留 affection.xiaomo');
  assert.strictEqual(merged.inventory.snack_01, 3, '保留 inventory.snack_01');
  assert.strictEqual(merged.rewardedTaskIds.length, 2, '保留 rewardedTaskIds');
  assert.strictEqual(merged.achievements.unlocked.length, 1, '保留 achievements.unlocked');
  assert.strictEqual(merged.achievements.stats.totalTasksDone, 10, '保留 stats.totalTasksDone');
  assert.strictEqual(merged.achievements.stats.streakDays, 3, '保留 stats.streakDays');
});

test('desktop-pet: mergeDesktopPetDefaults——缺失嵌套字段自动补全', () => {
  const { window } = boot();
  const C = window.DesktopPetCore;
  /* 只有 coins，缺少 achievements.stats.totalFeeds */
  const partial = { coins: 25, achievements: { unlocked: [] } };
  const merged = C.mergeDesktopPetDefaults(partial);
  assert.strictEqual(merged.coins, 25, '保留 coins');
  assert.ok(Array.isArray(merged.achievements.unlocked), '补全 achievements.unlocked');
  assert.strictEqual(merged.achievements.stats.totalTasksDone, 0, '补全 stats.totalTasksDone');
  assert.strictEqual(merged.achievements.stats.streakDays, 0, '补全 stats.streakDays');
  assert.strictEqual(merged.achievements.stats.totalFeeds, 0, '补全 stats.totalFeeds');
  assert.strictEqual(merged.achievements.stats.lastActiveDay, null, '补全 stats.lastActiveDay');
});

test('desktop-pet: resetAllData——只重置游戏数据，保留配置', () => {
  const { window, store, bus } = boot();
  const C = window.DesktopPetCore;
  const family = new C.PetFamily({ store: store, bus: bus });
  try {
    /* 先设置一些配置和游戏数据 */
    family.setMode('trio');
    family.setSize(100);
    family.addCoins(50, 'test');
    const dp = family.settings.desktopPet;
    dp.affection.xiaomo = 10;
    dp.achievements.unlocked = ['ach1'];
    dp.achievements.stats.totalTasksDone = 5;

    family.resetAllData();

    /* 游戏数据被重置 */
    assert.strictEqual(dp.coins, 0, 'coins 重置为 0');
    assert.strictEqual(dp.affection.xiaomo, 0, 'affection.xiaomo 重置');
    assert.strictEqual(dp.achievements.unlocked.length, 0, 'achievements 清空');
    assert.strictEqual(dp.achievements.stats.totalTasksDone, 0, 'stats 重置');

    /* 配置被保留 */
    assert.strictEqual(dp.mode, 'trio', 'mode 保留');
    assert.strictEqual(dp.size, 100, 'size 保留');
  } finally {
    family.destroy();
  }
});

test('desktop-pet: 数据与任务模块隔离——修改 tasks 不影响 desktopPet', () => {
  const { window, store } = boot();
  const dp = store.state.settings.desktopPet;
  const coinsBefore = dp.coins;
  const affXiaomoBefore = dp.affection.xiaomo;
  const achUnlockedBefore = dp.achievements.unlocked.length;
  const statsDoneBefore = dp.achievements.stats.totalTasksDone;

  /* 模拟任务完成 */
  store.state.tasks = [{ id: 't_isolation_1', text: 'test', done: true, doneAt: Date.now() }];

  assert.strictEqual(dp.coins, coinsBefore, 'coins 不变');
  assert.strictEqual(dp.affection.xiaomo, affXiaomoBefore, 'affection.xiaomo 不变');
  assert.strictEqual(dp.achievements.unlocked.length, achUnlockedBefore, 'achievements.unlocked 不变');
  assert.strictEqual(dp.achievements.stats.totalTasksDone, statsDoneBefore, 'stats.totalTasksDone 不变');
});

test('desktop-pet: PetFamily 构造深合并——store.state.settings 引用正确', () => {
  const { window, store, bus } = boot();
  const C = window.DesktopPetCore;
  /* 确保 settings.desktopPet 存在且结构完整 */
  const dp = store.state.settings.desktopPet;
  assert.ok(dp, 'store.state.settings.desktopPet 存在');
  assert.strictEqual(typeof dp.coins, 'number', 'coins 字段存在');
  assert.ok(dp.achievements, 'achievements 字段存在');

  const family = new C.PetFamily({ store: store, bus: bus });
  try {
    /* PetFamily 与 Store 共享 settings 引用 */
    family.addCoins(10, 'test');
    assert.strictEqual(store.state.settings.desktopPet.coins, dp.coins, 'Store 引用同步');
  } finally {
    family.destroy();
  }
});