# Personal Work & Life App · Product Requirements Document (PRD)

> Version: v6.3.2
> Status: v6.3.2 is the latest released version (see CHANGELOG)
> Online:
>
> Main site (GitHub Pages, auto-deployed on push to main):
> https://xiaoyu-hue.github.io/sonder520/
> Backup mirror (Cloudflare Pages):
> https://sonder520.pages.dev/
> Mirror (Netlify, free tier has deployment-count limits, may lag):
> https://sonder520.netlify.app/

> Note: This is the English translation of `PRD.md`. The version history in
> Section 0 is kept in Chinese (historical records, kept verbatim); all current
> specifications in Sections 1–12 are translated into English. The Chinese
> original remains the source of truth.

---

## 0. Version History & v5.0 Update Summary

Historical records, kept in Chinese. See the Chinese `PRD.md`.

### 版本演进

| 版本 | 摘要 |
| --- | --- |
| **v1.0** | 初始化 |
| **v1.1** | 水墨液态玻璃视觉 |
| **v1.2** | 水墨微动态交互 |
| **v1.3** | 手机适配 + 每日金句 |
| **v2.0** | 游戏交互质量回归 |
| **v2.1** | 游戏/性能/PWA/安全/存储升级 |
| **v3.0** | 可选加密 + 四款新游戏 |
| **v4.0** | 质量加固体系 |
| **v5.0** | 两轮评审修复 + 一轮补丁（16 项）：统计语义、CSV 注入、扫雷死局、认输归属、渲染副作用、引擎校验、存储韧性、搜索索引、对比度 token、壳降级、测试 flake 加固、扫雷首击插旗暂存、终局认输防重记、AI 重入守卫、撤销不顶替当前页；测试深化至 423 项 |
| **v5.1** | 性能与可靠性四补丁：PBKDF2 派生密钥缓存（解锁提速）、SonderBus 事件总线（跨模块解耦自动刷新）、五子棋 AI 异步化（Web Worker + 同步兜底 + 过期应手丢弃）、持久化危机兜底（双写失效红色警示条强制引导导出）；测试深化至 451 项 |
| **v5.2** | 工程防线补强 + 可靠性（9 项）：表单注入转义（data-k 属性 + getAttribute 匹配）、waitFor 条件轮询（消除固定延时竞态）、测试超时硬性兜底（npm 30s + CI 10min）、__SONDER_TEST__ 门闩（测试钩子隔离）、死代码清理、重复逻辑收敛（num0/esc/hashStr/copyText）、弱覆盖域页面交互补测 29 项、CI Node 20 弃用警告消除、PWA 导航 Network First（刷新即拿新版，离线仍回退）；测试深化至 514 项 |
| **v6.0** | Sonder-Frame 渐进式框架（规划中，未发布）：TrustLayer 结构化存储状态（getStorageStatus/persistResult/diagnostics）+ IndexedDB 优先写（主快照反转，LS 降级副本）+ 集合级持久化（ADR-009 决策 7：逐集合独立 key 读写/单集合增量写/legacy 整份一次性迁移保旧键/加密逐集合独立 bundle）+ 标准模块工厂（ModuleFactory CRUD/Schema/净化/注册表，prepend/timeField/orderField/move 扩展）+ EventBridge 事件契约（EVENT 常量表）+ 试点迁移（memo/today/dev/news/selfmedia/consulting/reading/design 八个标准模块全部入厂——Phase 7 标准模块收官，嵌套边界/委托绑定收敛/最大模块压测/实时状态模块例外/业务字段 select 白名单归一）+ 桌面玩偶独立 Specialized 模块（三角色+金币+商店+喂养+成就+互动对话，ADR-012）+ 离线状态指示器；测试基线 514 → 696 项 |
| **v6.1** | 深度审查修复（10 项）：C-1 lint 补盲区（js 子目录 + .mjs 纳入检查）+ C-2 ESLint 8→9 迁移（flat config 等价，删除废弃 .eslintrc.json）+ C-4 memo 存储键统一（sonder_data_v1）+ C-7 自定义壁纸迁入 IndexedDB（释放 5MB LS 配额，旧数据自动迁移/降级）+ C-8 加密密码下限 4→6 位 + T-1 CI E2E 三端化 + U-1 Toast 无障碍（aria-live/role）+ U-2 导入覆盖确认按钮语义一致 + 测试稳定性根治（--test-force-exit + 超时 60s）+ 文档同步；测试基线 696 → 704 项 |
| **v6.2** | 「液态玻璃 × 水墨」视觉深化（方向 C，大胆幅度）+ 2 项 UX 修复：①主题切换/壁纸操作生产环境弹"页面发生错误"横幅（applyTheme/applyWallpaper 误置测试门闩，移入常驻 hooks）；②壳层宣纸纹理（SVG 灰度纸粒+纵横纤维+纸角泛黄）与墨黑山水颗粒（双频墨粒+顶部微亮/底部压暗）；③玻璃卡片液态厚度精修（底部内影+顶部内发光+高光白芯，浅深分强度）；④水墨交互（hover 墨晕环+点击墨压+标题笔触线）；⑤动效统一（墨晕过渡/浮现走 --ease-ink）；全部视觉改动隔离于新增 css/style-glass-ink.css 可整体回滚；测试基线 706 项 + E2E 30 项全绿 |
| **v6.3** | v6.x 架构升级（Repository 分层 + Domain 规则层 + store 职责拆分，Phase 1-7）：新增 js/repositories/ 9 个薄包装 Repository（task/book/dev/settings/clients/games/memos/news/design，统一 get/getAll/create/update/remove，行为与直调 Store 一致含 commit/事件/undo）+ js/domain/task-domain.js（任务完成/重开语义纯函数）+ store.js 按职责拆出 store-undo/store-persistence/store-migration/store-import-export（1831 → 约 1090 行，写锁收口 ADR-013 落于 store-persistence）+ 页面迁移（today/home/memos/news/designs/dev/reading/settings/consulting/games 分批经 Repository 边界）+ UX 修复（自媒体/新闻状态下拉中文化、移动端日期时间、顶部时钟秒级跳动）+ 文档体系对齐（新建 docs/ARCHITECTURE.md）；测试基线 706 → 770 项 |
| **v6.3.2** | Security infrastructure consolidation (no functional changes): main branch protection (required checks + strict + enforce_admins + no force-push/delete + linear history) + Test Gate pull_request trigger + Dependabot routine upgrades disabled (alerts & security updates kept) + redundant socket.yml removed (Socket App owns supply-chain scanning) + scanning pipeline consolidated (CodeQL / Semgrep / OSV-Scanner / Socket / Dependabot alerts) + README acknowledgments table for security scanners; test baseline 770 all green |
| **v6.3.1** | Docs & security scanning (no functional changes): README badge overhaul (static version → dynamic release badge + last-commit + CI + tests-770) + third-party automated review phase 1 (CodeQL scan + Dependabot weekly + npm audit gate in Test Gate; 0 known dependency vulnerabilities) |

(Further historical summaries from v5.0 onward are kept in the Chinese PRD.)

---

## 1. Product Goal & Use Cases

### Product Goal
A work & life management app for personal use only: gather scattered personal work (self-media, development, consulting, reading, news, design) and everyday items (today's plan, quick memos) together with leisure (six mini games) into one local tool, reducing context-switching and chaotic ad-hoc notes.

### Use Cases
- Open it in a desktop browser and instantly see what to do today.
- Have a passing thought → jot it into "Quick Memo".
- Plan and handle tasks daily via "Today's Plan", using the 🍅 focus countdown to enter focused state.
- Each work module records progress independently without interference, while the home page gives a global overview.
- Play Gomoku, Tic-tac-toe, Guess the Number, Minesweeper, Guess the Idiom, or Brain Teasers on the phone during spare time; records are saved automatically.

### Core Principles
- Pure frontend: data is stored only in the visitor's own browser (localStorage/IndexedDB), never uploaded to any server.
- Data must survive refresh, tab close, browser close, and restart.
- No login, no cloud database, no cloud sync; the site works offline.
- Chinese UI, usable in desktop / tablet / phone browsers.

---

## 2. Overall Page Frame & Navigation Structure

### App Shell
- **Side navigation**: app name/logo + 10 navigation entries, current page highlighted.
  - Home, Today's Plan, Self-Media, Dev Work, Consulting, Reading Plan, News Plan, Design Plan, Games, Data & Settings
  - Desktop: full sidebar; tablet (721–960px): collapses to a 70px icon rail; phone portrait (≤720px): bottom liquid-glass nav bar (horizontally scrollable, 44px touch targets, safe-area inset support).
- **Top bar**: current module name, today's date, global "+" quick-create button, global "Quick Memo" entry, global search box.
- **Content area**: each module renders independently; switching navigation preserves per-page state (game board state survives page switches).
- **Modal rules**: add/edit/delete-confirm all use a centered overlay + translucent scrim, Esc to close; bottom-sheet style on phones; WCAG focus management (set/trap/restore).
- **Ultra-wide screens**: >1240px content is centered at a max width of 1240px.

### Navigation Structure
```
Sidebar
├── Home
├── Today's Plan
├── Self-Media
├── Dev Work
├── Consulting
├── Reading Plan
├── News Plan
├── Design Plan
├── Games
└── Data & Settings
```

---

## 3. Visual & Interaction Design

- **Theme**: Ink × Liquid Glass. Light "Rice Paper" / dark "Ink Black" dual themes, default follows system `prefers-color-scheme`, manual override remembered; frosted-glass cards (backdrop-filter + inner highlight), cinnabar-red accent color, charts use traditional Chinese painting pigments; text/accent colors tokenized (`--muted/--warn-text/--ok-text/--accent-text` etc.), all contrast ≥4.5:1 (WCAG AA, locked by tests).
- **Custom wallpaper**: upload a background image in Settings (≤2MB, large images auto-compressed), adjust opacity (0–100%, default 40%, live preview persisted, slider debounced), restore default; rendered via a dedicated img element + `object-fit: cover`, full-bleed centered without stretching on all devices.
- **Micro-motion**: staggered page fade-in, ink-diffusion chart growth, button press feedback, breathing empty states, sliding toasts, bottom-sheet modals on phones.
- **Performance**: removed fixed background layers, frosted-glass fallback (@supports), wallpaper preload, storage serialization dedup, global search index cache, hard-AI lookahead pruning — smooth on low-end phones and old browsers.
- **Accessibility**: respects `prefers-reduced-motion`; full keyboard reachability + overlay focus management (set/trap/restore); icon buttons carry aria labels and tooltips.
- **Full-platform adaptation**:
  - Desktop >960px: full sidebar + multi-column grid; >1240px centered max-width
  - Tablet 721–960px: 70px icon rail (text hidden)
  - Phone ≤720px: bottom liquid-glass nav
  - Tiny screens ≤360px: compressed spacing, no overflow; `.row` wraps
  - Phone landscape: top bar and nav shrink
  - Gomoku board ≤720px: width `min(97vw,480px)`, 2px cell gap, 8px padding, square cells, 86% stone fill; further compressed ≤360px; never overflows horizontally (covers iPhone SE)
  - Minesweeper on phones: width `max(100%, cols×26px)` in a horizontal-scroll container, cells ≥26px touch size
  - Safe area `env(safe-area-inset-bottom)`, `100vh→100dvh` fallback (old iOS/Android), touch targets ≥44px, 16px inputs prevent iOS zoom-on-focus, `color-scheme` synced for forms and scrollbars
- **PWA friendly**: `viewport-fit=cover` + `apple-mobile-web-app-capable`, installable as an App; Service Worker offline cache (current cache version sonder-v123, `npm run sync-sw` syncs the asset list and bumps the version); navigation requests network-first (refresh gets the new version, offline falls back to cached home), static assets cache-first.

---

## 4. Home Page Content Structure

1. **Top greeting + today's date**; below it the **daily quote** (stable rotation by date from a built-in library, auto-refreshes at midnight; may randomly show your own book excerpts; degrades gracefully when the library is empty).
2. **Today's task summary**: todo count/total + **today's completion-rate ring progress**; quick check-off without navigating away.
3. **Quick memo bar**: type and save instantly; the latest memo stays visible on the home page.
4. **Per-module overview cards** (one number card per module):
   - Self-Media: topic count / pending-publish count
   - Dev Work: project count / in-progress task count
   - Consulting: client count / pending-follow-up count
   - Reading Plan: reading count / total
   - News Plan: unread count / total
   - Design Plan: project count / in-progress design count
   - Games: matches played / wins & draws
   - Click any card to jump to that module.

---

## 5. Purpose of Each Module

| Module | Purpose |
| --- | --- |
| Today's Plan | Manage daily tasks: schedule by time/priority, focus countdown, track completion |
| Quick Memo | Instant text notes with save time; view history |
| Self-Media | Manage content creation: topics, calendar scheduling, publish channels, status, reads/likes and charts |
| Dev Work | Manage dev projects: tasks, progress, Markdown technical notes |
| Consulting | Manage consulting clients & projects: profiles, stages, follow-ups, income |
| Reading Plan | Manage book list: reading/want/read, reading timer, notes, excerpts |
| News Plan | Save articles to read: title/link/source, unread/read/favorited |
| Design Plan | Collect inspiration, manage design projects and stages |
| Games | Tic-tac-toe / Gomoku / Guess the Number / Minesweeper / Guess the Idiom / Brain Teasers: AI duel, local 2-player, undo, resign, auto records |
| Data & Settings | Stats overview, export/backup/restore, encryption toggle, theme & module toggles, notifications & reports |

---

## 6. Data & Operations per Module

### Today's Plan
- Data: title, description, priority (4 levels × 4 colors, old values auto-migrated), planned date, done state, done time, order, focus session log.
- Operations: add, edit, delete (with confirm), check done/reopen, reorder, start focus (🍅 25-min floating countdown, browser notification when done).

### Quick Memo
- Data: content, save time.
- Operations: instant save, history, archive.

### Self-Media
- Data: topic/content title, platform account, publish channel (公众号/WeChat, 小红书/Xiaohongshu, B站/Bilibili, 抖音/Douyin), tags, status (draft/pending/published), publish date, reads/likes, notes, progress.
- Operations: add, edit, filter (tag/status), change status, detail, **export CSV (formula-injection protection: fields starting with = + - @ get a prefix)**, progress drag bar, calendar drag scheduling (drag on desktop / long-press on mobile), recent-5 SVG read-count line chart, publish data visualization.

### Dev Work
- Data: project name, project tasks, progress, technical notes (Markdown rendered, code snippets one-click copy), completion stats.
- Operations: add project, add/check tasks inside a project, write technical notes (newest-first by update time), view stats.

### Consulting
- Data: client profiles, client projects, project stages, follow-up records, todos, income records.
- Operations: add client, manage projects/follow-ups/income inside the client detail.

### Reading Plan
- Data: title, author, status (reading/want/read), progress, cumulative reading minutes & session log, notes & excerpts, book excerpts (sentence + page number, a dedicated "My Excerpts" page grouped by book), finish date.
- Operations: add book, change status, update progress, start/stop reading timer, write notes & excerpts, browse by status, reading statistics.

### News Plan
- Data: title, link, source, tags, status (unread/read/favorited).
- Operations: add, open link, mark read, favorite, browse by tag.

### Design Plan
- Data: inspiration records (link/idea), inspiration categories, design projects, project stages (concept/in-progress/finalized).
- Operations: add inspiration, browse by category, add project, advance stage.

### Games
- Data: match records (game/mode/winner/forfeit/AI difficulty/note/time), stats summary (matches/wins/draws), mini-game best records (unified miniRecords storage).
- Operations:
  - Game selection: Tic-tac-toe 3×3 / Gomoku 15×15 / Guess the Number / Minesweeper / Guess the Idiom / Brain Teasers.
  - Battle games (Tic-tac-toe/Gomoku): AI duel (first or second move) / local 2-player; three AI levels (easy/normal/hard), persisted.
  - Move: click a cell; in AI mode the AI replies automatically (320ms delay on first move, 220ms after, simulating thinking pace).
  - Undo (AI mode): instant, no confirm, multiple turns; undoing while the AI is thinking cancels its pending move.
  - Undo (2-player): the player who just moved may retract it, opponent confirms; no undo after the game ends.
  - Resign: double-confirm, opponent wins; in AI mode the AI wins; winner attribution matches records.
  - New game: double-confirm when stones are placed, board cleared; rapid re-clicks on "New Game"/mode switch never stack multiple dialogs.
  - Mini games: Guess the Number (7 tries/hint/best record), Minesweeper (3 difficulties/safe first click/safe first flag/no-deadlock reveal), Guess the Idiom (3 tries/hint chars), Brain Teasers (reveal answer/fun questions); records auto-saved.
  - Back to game select: double-confirm when the current game is unfinished; double-confirm to clear records.
- AI behavior: Tic-tac-toe is full search (never loses); Gomoku is heuristic scoring (prioritize own five-in-a-row, block opponent's open fours/live fours, attack weighted above defense, hard level adds one-ply lookahead).
- Match state survives navigation; returning continues the game (interrupted AI auto-continues); records auto-persist; home overview and stats page stay in sync.

### Data & Settings
- Data: app settings (theme, module toggles, animation frame rate, notification toggle, encryption state), statistics.
- Operations: switch theme (follow-system/manual), toggle modules, enable/disable encryption (wizard + lock screen + password-free session), upload/restore wallpaper, adjust opacity, generate weekly report (one-click copy), desktop notification permission, export backup (plaintext or encrypted), import restore, view stats (**completion-rate denominator = today's due tasks: done + todo + overdue**), clear game records, data migration (IndexedDB).

---

## 7. Relationships: Home, Today's Plan & Modules

- **Today's Plan** is the core execution layer for daily tasks; the home page only shows its summary with quick check-off.
- **Quick Memo** is the global instant-capture entry; the home page shows the latest memo, full history lives in the module.
- **Work modules** are independent record units; the home page aggregates key numbers via overview cards, clicking enters the module.
- **Games** is the leisure module: match state survives navigation (continue on return), records feed home overview & stats.
- **Data & Settings** controls global appearance, module visibility, and backup/restore; it does not participate in daily business data.
- Data is stored uniformly; modules are not forcibly linked; Today's Plan and work modules have no automatic interplay.

---

## 8. Local Data, Backup & Recovery Requirements

- **Storage**: data lives in the browser's local storage (localStorage, JSON structure); simultaneously dual-written to IndexedDB (capacity ~5MB → far beyond); on startup the newer copy is auto-restored and backfilled.
- **Encryption**: optionally enable storage encryption in Settings (PBKDF2 600k + AES-GCM-256); when enabled data is stored as ciphertext, the unlock password exists only in browser memory, never stored; **resilience**: no plaintext writes while locked, unknown future encryption versions (e.g. v2 ciphertext) are never parsed/overwritten, migration & import go through ciphertext paths, saves are serialized in call order; **performance**: per-session derived-key cache avoids repeating 600k iterations on unlock.
- **Persistence**: data survives page refresh, tab close, and browser close/restart (covered by full regression).
- **Backup**: "Data & Settings → Export Backup" downloads all data as a local JSON file (requires the unlock password when encrypted; the exported file is ciphertext).
- **Restore**: "Data & Settings → Import Restore" restores all data from a backup file (warns that it overwrites existing data; encrypted backups need the password; import is refused while locked).
- **Notes**: backup files are kept by the user; no automatic cloud backup; multi-device data is independent, migrate via export/import.

---

## 9. Features Completed in This Version

1. Sidebar + top bar shell, 10 switchable pages with preserved state; global search box (real-time fuzzy match/grouped/jump-highlight, index covers book excerpts & game records).
2. Phone bottom nav + tablet icon rail + desktop ultra-wide (>1240px centered max-width) full-platform adaptation; safe area / dvh / touch / no-zoom all in place.
3. Themes (Rice Paper/Ink Black, follow-system overridable), custom wallpaper upload & opacity (0–100%, slider debounced), frosted glass, micro-motion, low-end performance & fallbacks; dual-theme contrast WCAG AA.
4. Daily quote rotation by date (may show your own book excerpts), graceful degradation when library missing.
5. Home: greeting, today summary + completion ring, quick memo, overview cards, card jump.
6. Today's Plan: CRUD/sort/check-off/grouping, 4-level priority color dots, 🍅 25-min floating focus countdown (browser notification on finish), date filter state preserved across pages.
7. One-tap memo: save-instantly, history, archive.
8. Six content modules with per-module CRUD/filter/stats; self-media CSV export (formula-injection safe) + calendar drag scheduling + channels + read-count line chart; dev notes Markdown rendering & code copy; reading timer & "My Excerpts" page; consulting income records.
9. Six games: Tic-tac-toe / Gomoku (AI 3 levels / 2-player, undo/resign/new-game confirm flow, full rule regression locked) + Guess the Number / Minesweeper / Guess the Idiom / Brain Teasers (records merged into battle records, incl. solo mode & notes, AI difficulty shown; mini-game best records unified).
10. Data & Settings: export/import/stats (completion denominator = today's due tasks)/clear records/theme/module toggles/frame rate (60/90/120)/data migration (IndexedDB)/encryption (wizard+lock+password-free session+resilience)/desktop notifications/weekly report one-click copy/wallpaper upload.
11. Unified interaction: modal rules, double-confirm, Esc close, Toast, stacked-dialog prevention, overlay focus management (set/trap/restore).
12. Reliability: PWA offline (cache sonder-v123 auto-sync; network-first navigation, refresh gets new version), dual-write dual-store (per-collection keys), >4.5MB storage warning bar, red crisis bar with forced export when both write backends fail, XSS sanitization across modules (incl. attribute injection & form key escaping), optional encryption, performance (per-collection incremental serialization/search index cache/AI pruning/derived-key cache), error reporting & shell fallback.
13. Engineering: eslint passing, zero-build type contracts (d.ts + tsc), innerHTML assignment-point whitelist audit, state dual-track contract, store domain split (10 domain files) + Repository data boundary + Domain rule layer, index.html as the single script source of truth.
14. **770 automated tests passing** (full-suite verification across versions).

---

## 10. Explicitly Out of Scope / Future Ideas

- Login, user system, permissions, real-time multiplayer online play.
- Cloud sync, cloud database, cross-device data interoperability.
- Automatic news fetching or any networked feature; push notifications (desktop in-browser notifications only).
- Automatic linkage between Today's Plan and content modules.
- Internationalization (multi-language UI) — under consideration, not implemented.

---

## 11. Acceptance Criteria (verifiable)

1. Home: greeting, date, quote, today summary, completion ring, memo bar, overview cards all render correctly.
2. Clicking a card jumps to the module; navigation returns.
3. Today's Plan / memo and all module core operations work and don't interfere; reading & self-media progress update in real time.
4. Focus countdown: after starting, a floating 25-min countdown appears; browser notification fires on finish (permission required).
5. Reading: reading timer accumulates minutes; excerpt page groups by book; marking "read" records the finish date; home quote slot may show your own excerpt.
6. Self-media: calendar view supports drag/long-press scheduling; published cards accept reads/likes and appear in the line chart; CSV export prefixes = + - @ fields.
7. Encryption: Settings wizard → lock-screen unlock → data is ciphertext → export/import of encrypted backup requires the password; wrong password never corrupts ciphertext; no-op when disabled; after manually writing future-version ciphertext (v2), refresh still prompts unlock and ciphertext is preserved verbatim.
8. Settings completion rate = today's due done / (done + todo + overdue), consistent with the task list.
9. Games: all six games complete a round and record to battle records (incl. solo mode, notes, AI difficulty); Gomoku/Tic-tac-toe undo/resign/new-game follow the rules; no undo after game end; re-clicking resign adds no record; rapid "New Game" clicks show a single confirm; Minesweeper first click is always safe (safe even with a pre-placed flag, flag position kept), no-deadlock reveal, correct win/loss.
10. Gomoku mobile: 375px phone shows square cells fitting within the viewport, no distortion, no horizontal scroll; 360px-class screens still allow normal moves; Minesweeper cells ≥26px clickable.
11. Ultra-wide: 2560px desktop shows content centered at max 1240px, not spread edge to edge.
12. Tablet 760px: sidebar collapses to icon rail; phone portrait: bottom nav + sheet modals; landscape shrinks the top bar.
13. Theme follows system (manual override); wallpaper upload works, opacity adjustable, default restorable; body/accent text contrast ≥4.5:1 in both themes.
14. Export JSON → modify data → import restore → data matches the export (overwrite warning shown before import).
15. Persistence: any data entry survives refresh, tab close, and browser restart.
16. Works via phone external links and offline local index.html; data stays in the local browser only.
17. Engineering acceptance: `npm test` (770), `npm run typecheck`, `npm run lint` all pass.

---

## 12. Technical Architecture & Quality Assurance

- **Implementation**: pure HTML + CSS + vanilla JS, zero build, zero runtime dependencies; all assets are relative paths, deployable to any static host (Netlify / Cloudflare Pages / Vercel / GitHub Pages) and openable by double-clicking the local file.
- **Code organization**:
  - Data layer: `store.js` (core: Store construction, state normalization, encryption/decryption & snapshot helpers, shared helpers & `_h` whitelist) + 10 domain extension files (UMD, injected via `SonderStore.Store` & `_h`) — `store-tasks` (quick memo + today's plan), `store-media` (self-media + dev + tech notes), `store-content` (consulting + reading/excerpts + news + design + games), `store-settings` (theme/wallpaper/reminders/module toggles), `store-report` (weekly report), `store-undo` (delete undo), `store-persistence` (persistence core: LS/IDB read-write, save/_commit, write-lock funnel ADR-013), `store-migration` (legacy split migration + IDB load), `store-import-export` (backup export/import/clear) + `store-stats` (pure-function stats/aggregation) + `encryption.js` (optional encryption core: PBKDF2 600k + AES-GCM-256, ciphertext branches, lock screen, serial encryption chain, derived-key cache) + `event-bus.js` (SonderBus event bus: store changes published → pages re-render on subscription)
  - Data access boundary (v6.x Repository layer, `js/repositories/`): 9 thin wrapper Repositories — `task / book / dev / settings / clients / games / memos / news / design`, unified get/getAll/create/update/remove (delegating to Store domain methods, identical behavior incl. commit/events/undo; memos/news/design keep CONFIG single-source in the page)
  - Domain rule layer (v6.x, `js/domain/`): `task-domain.js` — pure functions for task complete/reopen semantics (no double-complete, no re-open), pages persist only after TaskDomain rules pass
  - Components: `ui.js` (modals/Toast/forms, unified sanitize & URL scheme whitelist, focus management)
  - Modules: `home / today / memo / selfmedia / dev / consulting / reading / news / design / settings`, one file each
  - Games: `games-logic.js` (pure game rules & 3-level AI: tic-tac-toe full search, gomoku heuristic scoring + hard-level lookahead; guess-number/minesweeper/idiom/brain-teaser rules & question bank) + `games-shared.js` (shared state & AI scheduling, must load first) + `games-mini.js` (mini-game views & records) + `games-battle.js` (battle views, undo/resign/new-game/records, AI move pacing & worker scheduling) + `games-view.js` (render pure functions) + `games.js` (page orchestration: render dispatch/game select/records/test hooks) + `game-worker.js` (Gomoku AI Web Worker, async non-blocking; falls back to sync when Worker unavailable; stale replies discarded)
  - Search: `search.js` (global index + cache, fuzzy match, grouped jump, ink highlight)
  - Extended rendering: `markdown.js` (tech-note Markdown rendering & code copy)
  - Shell: `app.js` (routing/theme-follow/frame-rate/warning bar/crisis bar/nav fallback/offline indicator), `error-guard.js` (global error net & reporting), `sw.js` (Service Worker offline cache, current sonder-v123, auto-synced by script; navigation network-first), `manifest.json` (PWA manifest & icons)
  - Types: `globals.d.ts` (Pages/SonderStore public methods/UI globals + Repository/Domain/domain-type contracts, 80+ type interfaces)
- **Theme system**: CSS custom properties + light/dark dual themes; `@supports` degrades frosted glass on unsupported browsers; wallpaper as independent img element + `object-fit: cover` + opacity variable; text/accent tokens meet WCAG AA.
- **Data compatibility**: field normalization on read (defaults for missing, clamping for invalid + 9 legacy field migrations), smooth migration of historical data; IndexedDB & localStorage dual-write, newest-by-save-time on conflict; encryption switch fully backward compatible (no-op when off); future ciphertext versions preserved verbatim.
- **Mobile board details**: 15-column board uses grid; `.game-board.big` compresses gaps/padding at the phone breakpoint with `min-height: 0` square cells; width `min(97vw, 480px)` never overflows; minesweeper `max(100%, cols×26px)` + horizontal scroll keeps cells ≥26px; board cells are intrinsic game hot zones (whole board must stay visible), all other UI touch targets ≥44px.
- **Engineering defense**: eslint (no un-commented empty catch), zero-build TypeScript checking (JSDoc + tsc --noEmit), innerHTML assignment-point whitelist audit (12 manual entries, rest cleared or escaped), contract tests (contract/behavior/state/innerhtml/type-sync), index.html as single script source of truth (parsed by harness), `scripts/sync-sw.js` auto-syncs SW asset list & bumps cache version.
- **Automated tests**: jsdom + `node --test` (glob full suite) + fake-indexeddb; covering storage, encryption (races/edges/future-version resilience/derived cache), per-collection persistence (per-key read-write/migration/backfill/encrypted bundle), write-lock yield protocol (ADR-013/014), Repository boundaries, Domain rules, UI, all modules, styles, motion, wallpaper, mobile auto-adaptation, performance, game engine (win detection/forbidden-move/AI strategy/six games/Worker behavior), interaction regression (dialog stacking, undo semantics, end-game locking, board compression), PWA, search, offline indicator, XSS sanitization (incl. attribute injection), IndexedDB dual-write & quota warning, persistence crisis fallback, notifications, contrast, CSS-variable contract, weekly report — currently **770 passing** (`npm test`).
