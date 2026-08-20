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