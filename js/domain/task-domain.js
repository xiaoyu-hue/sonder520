/* task-domain.js - 任务领域规则（v6.x Phase 7：克制提取，纯函数、无 DOM/存储）
 *
 * 定位：全项目唯一值得提炼的真实业务规则 = 任务完成语义（完成/重开/不可重复完成）。
 * 规则原散在 today.js 页面层，现收敛为纯函数，页面只负责"读规则结果 + 落盘"。
 *
 * 字段说明：数据模型使用 done(boolean) + doneAt(ISO 串)（与 state.tasks 一致，
 * 方案中的 completed/completedAt 为语义示意名，实际落盘字段按既有格式不动）。
 *
 * 浏览器：<script src="js/domain/task-domain.js">（在 today.js 之前加载）
 * Node：module.exports 返回纯函数集合（无 Store 依赖，可直接单测）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SonderTaskDomain = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 完成：未完成 → 返回应应用的 patch {done:true, doneAt:now}；
   * 已完成 → 返回 null（不可重复完成——不覆盖原 doneAt，防事件竞态/重绘覆盖）。
   * 纯函数：不修改入参 task。 */
  function complete(task, now) {
    if (!task || typeof task !== 'object') return null;
    if (task.done === true) return null;
    return { done: true, doneAt: now || null };
  }

  /* 重开：已完成 → 返回应应用的 patch {done:false, doneAt:null}；
   * 未完成 → 返回 null（无可重开）。纯函数：不修改入参 task。 */
  function reopen(task) {
    if (!task || typeof task !== 'object') return null;
    if (task.done !== true) return null;
    return { done: false, doneAt: null };
  }

  return {
    complete: complete,
    reopen: reopen
  };
});
