# ADR-005：安全基线（纵深防御，无后端可依赖）

- 状态：已采纳
- 背景：纯静态应用近期（2026-08）完成全面安全审计（安全/容错/性能/架构四线并行），结论 0 高危；本 ADR 固化审计后基线，防未来回归。
- 决策与现状：
  1. **CSP meta**：`default-src 'self'; script-src 'self' 'nonce-sw'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`。唯一内联脚本（SW 注册块）带 `nonce="sw"`。
  2. **_headers 部署头**（CF Pages 生效，GH Pages 无害忽略）：`X-Frame-Options: DENY`（点击劫持）、`X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`。
  3. **调试钩子门闩**：生产环境不挂载任何测试钩子（`__SONDER_TEST__` 门闩），审计钩子快照仅测试进程可读。
  4. **输入净化**：`innerHTML` 赋值点白名单制（ADR-003）+ `sanitize/sanitizeUrl` 转义 + 属性注入防护（formModal data- 属性经 getAttribute 匹配）。
  5. 已知权衡（评估为可接受）：sessionStorage 明文会话密码是"免密解锁"产品取舍（有测试契约钉死）；静态 nonce 可防未知内联脚本但对 XSS 重放防护有限。真机验证已落地（2026-08）：Playwright 冒烟真实 Chromium 断言 CSP 零违规（SecurityPolicyViolation 事件收集）+ 全部资源 200 + SW 离线可用；线上 CF Pages 用 curl/Invoke-WebRequest 核验 `X-Frame-Options: DENY` / `nosniff` / `Referrer-Policy` 三头全部按 _headers 生效。
- 理由：无后端意味着安全全靠浏览器侧纵深——CSP/头/净化/门闩四层缺一不可；审计结论 0 高危不等于无风险，契约测试让每层防线可防回归。