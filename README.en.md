# Sonder · Personal Productivity App (English README)

> 中文版：全中文说明见 [README.md](README.md)

A privacy-first personal work & life management app. Pure HTML/CSS/vanilla JS — zero build steps, zero dependencies, no backend.

"Ink-wash × Liquid Glass" visual style, custom wallpaper upload and opacity, six mini games, Pomodoro focus timer, optional on-device encryption, offline support (PWA), global search. 100% of your data stays in your own browser.

## Live Sites

Recommended (auto-deployed from git, always in sync):

- Primary: https://sonder520.pages.dev/

- Backup: https://xiaoyu-hue.github.io/sonder520/

A legacy site exists but may be out of date (not recommended): https://sonder520.netlify.app/ (limited deployments).

> Data lives in each device's browser (localStorage + IndexedDB) and is independent between devices. To move data between devices use "Data & Settings → Export Backup / Import Restore".

## License & Disclaimer

This project is licensed under the MIT License — free to use, modify and distribute, provided the copyright and license notice is retained. No warranty is provided. See the LICENSE file in the repository for details.

## Open Source

Source code: https://github.com/xiaoyu-hue/sonder520

(Public repository — browse it without any login)

- Pure frontend project: any visitor can view the full source in browser DevTools ("naturally open source").

- Data safety is unaffected: data is stored only in each visitor's own browser and never passes through any server; optional encrypted storage is available (PBKDF2 + AES-GCM-256).

## Features

- Home: greeting + daily quote (occasionally your own book excerpts), today's completion ring, task summary, quick memo bar, module overview cards

- Today: four-level priority dots, 🍅 25-min focus timer with browser notification, add/edit/check/order/group tasks

- Quick memo: type and save instantly, history, archive

- Self-media: topics, calendar view with drag-and-drop scheduling, publish channels (WeChat 公众号 / Xiaohongshu / Bilibili / Douyin), reads/likes and 5-post line chart, CSV export

- Dev work: projects, task lists, auto progress stats, tech notes (Markdown rendering + one-click code copy)

- Consulting: client profiles, projects, phases, follow-up logs, income records

- Reading: book list, statuses, reading timer (minutes), "My Quotes" page (grouped by book), progress

- News watchlist: saved articles, unread/read/favorite, open links

- Design: inspiration collection + design projects and phases

- Games: Tic-Tac-Toe / Gomoku (AI duel with 3 difficulties, or two-player, undo, resign, auto records; AI moves run in a Web Worker so the board never freezes) + Guess the Number / Minesweeper / Guess the Idiom (中文) / Brain Teasers (中文) — all records merged into match history

- Data & Settings: theme (follows system, overridable), wallpaper upload/opacity, animation fps (60/90/120), module toggles, stats, export/import backup, encryption switch, weekly report generator, desktop notifications, migrate to IndexedDB

- Reliability: PWA offline (network-first navigation, new version on refresh, offline cache fallback), dual storage (IndexedDB primary snapshot + localStorage fallback copy + optional encryption), encryption resilience (no plaintext writes while locked, future-version ciphertext preserved untouched), warning bar when storage exceeds 4.5 MB, red crisis bar (export-only) when both storage backends fail, global search, XSS sanitization everywhere (incl. attribute injection), error reporting with graceful shell degradation

- Note: Chinese-cultural content (daily quotes, Idiom & Brain Teaser games) intentionally stays in Chinese — translating them would lose the flavor.

## Visual & Interaction

- Ink-wash × Liquid Glass: Rice-paper (light) / Ink-black (dark) themes that follow the system by default, frosted glass cards (backdrop-filter + inner highlight), cinnabar red accent, Chinese-pigment color palette for charts.

- Custom wallpaper: upload a background image (≤2 MB) in Settings, adjust opacity (0–100%, default 40%, live preview, persisted), restore default anytime.

- Micro-interactions: staggered fade-in, ink-spread chart animations, button press feedback, breathing empty states, sliding toasts, bottom-sheet dialogs on mobile.

- Both themes keep text/accent contrast ≥4.5:1 (WCAG AA, incl. light/dark tokens and Minesweeper digits, locked by tests).

## Platform Adaptation

| Device | Layout |
| --- | --- |
| Desktop (>960px) | Left liquid-glass sidebar + multi-column grid; content capped at 1240px centered on ultra-wide screens |
| Tablet (721–960px) | Sidebar collapses to a 70px icon bar |
| Phone portrait (≤720px) | Bottom liquid-glass nav bar (scrollable icons) |
| Tiny screens (≤360px) | Compressed spacing, nav never breaks |
| Phone landscape | Slimmer top bar and nav |

- iOS/Android: viewport-fit=cover, safe-area inset for notches/gesture bars, 100vh→100dvh fallback, touch targets ≥44px, 16px inputs to prevent iOS focus zoom.

- "Add to Home Screen" works like an app (PWA), usable offline.

- Respects prefers-reduced-motion.

## Run Locally

Just open (double-click) index.html in a browser. Chrome / Edge recommended.

- Data is stored in browser local storage (localStorage + IndexedDB) — survives refresh, tab close, and full browser restarts.

- For important data, regularly download a JSON backup via "Data & Settings → Export Backup"; enable encrypted storage in Settings for extra privacy.

## Update the Deployed Sites

After changing code, pick one:

1. Web drag & drop (recommended): log in at https://app.netlify.com → open site sonder520 → Deploys page → drag this whole folder into "Drag and drop deploy area here" → wait for "Published" (URL stays the same).

   ⚠️ Do not use app.netlify.com/drop repeatedly — each Drop creates a brand new site.

2. CLI: npm i -g netlify-cli → netlify login → netlify link → netlify deploy --prod --dir=.

3. Git auto-deploy: connect the GitHub repo in Netlify, then git push goes live automatically.

Other static hosts also work (all assets use relative paths, no build needed): GitHub Pages, Cloudflare Pages, Vercel.

## Developers

Notes:

- Pure HTML/CSS/vanilla JS — zero build/run dependencies, no npm install needed to use the app.

- Run all tests: npm test (currently 578 passing, covering storage/encryption (incl. races & future-version resilience)/structured storage status (TrustLayer contract)/standard module factory (ModuleFactory contracts & behavior, incl. v0.1.1 prepend/timeField & v0.1.2 orderField/move extensions)/event-bus contract (EventBridge: EVENT constant table & payload contract)/UI/all modules/styles/animations/wallpaper/mobile adaptation/perf/game engines/interaction regressions/PWA/search/XSS (incl. attribute injection)/contrast/IndexedDB/notifications/Web Worker/crisis fallback/motion-layer contracts & behavior).

- Type check (zero-build): npm run typecheck (JSDoc + tsc --noEmit, contracts locked in globals.d.ts).

- Lint: npm run lint (eslint@8 — bans empty catch blocks and dead variables).

- Sync offline cache: after changing scripts/entry, run npm run sync-sw (auto-syncs the sw.js cache manifest and bumps its version).

## Docs

- Product requirements: PRD.md (in Chinese, contains version history, visual design, data & operations, acceptance criteria, architecture).