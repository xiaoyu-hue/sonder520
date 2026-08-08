/* quotes.js - 每日金句库：按日期做种子选取，同一天稳定、0 点后换新。浏览器/Node 通用 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SonderQuotes = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var QUOTES = [
    '心之所向，素履以往。',
    '不积跬步，无以至千里。',
    '凡是过往，皆为序章。',
    '行到水穷处，坐看云起时。',
    '采菊东篱下，悠然见南山。',
    '竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。',
    '山重水复疑无路，柳暗花明又一村。',
    '路漫漫其修远兮，吾将上下而求索。',
    '博观而约取，厚积而薄发。',
    '纸上得来终觉浅，绝知此事要躬行。',
    '少壮不努力，老大徒伤悲。',
    '千里之行，始于足下。',
    '业精于勤，荒于嬉。',
    '温故而知新，可以为师矣。',
    '学而不思则罔，思而不学则殆。',
    '锲而不舍，金石可镂。',
    '志当存高远。',
    '非淡泊无以明志，非宁静无以致远。',
    '天行健，君子以自强不息。',
    '博学之，审问之，慎思之，明辨之，笃行之。',
    '百尺竿头，更进一步。',
    '操千曲而后晓声，观千剑而后识器。',
    '不患人之不己知，患不知人也。',
    '知人者智，自知者明。',
    '知不足者好学，耻下问者自满。',
    '流水不腐，户枢不蠹。',
    '绳锯木断，水滴石穿。',
    '及时当勉励，岁月不待人。',
    '盛年不重来，一日难再晨。',
    '海内存知己，天涯若比邻。',
    '莫愁前路无知己，天下谁人不识君。',
    '长风破浪会有时，直挂云帆济沧海。',
    '会当凌绝顶，一览众山小。',
    '千磨万击还坚劲，任尔东西南北风。',
    '不畏浮云遮望眼，自缘身在最高层。',
    '沉舟侧畔千帆过，病树前头万木春。',
    '宝剑锋从磨砺出，梅花香自苦寒来。',
    '读书破万卷，下笔如有神。',
    '问渠那得清如许？为有源头活水来。',
    '日出江花红胜火，春来江水绿如蓝。'
  ];

  /* 字符串哈希（DJB2），用于把日期稳定映射到金句索引 */
  function hashStr(s) {
    var h = 5381, i;
    for (i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
    return Math.abs(h);
  }

  /* 取某天的金句；dateStr 形如 'YYYY-MM-DD'，缺省取今天 */
  function quoteOfDay(dateStr) {
    var d = String(dateStr || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      d = new Date().toISOString().slice(0, 10);
    }
    return QUOTES[hashStr(d) % QUOTES.length];
  }

  return { quoteOfDay: quoteOfDay, quotes: QUOTES };
});