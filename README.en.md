# 🌊 Sonder520

> A personal work & life management tool
>
> Pure Frontend · Zero Dependencies · Local-First · Ink-Wash Liquid Glass Style

**One person, one computer, a browser is all you need.** Data is stored locally in your browser. No registration, no internet required, no fees.

---

<div align="center">

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![PWA](https://img.shields.io/badge/PWA-Support-green)
![Zero-Dependency](https://img.shields.io/badge/Zero-Dependency-6B728C)

</div>

---

**[🚀 Live Demo](https://sonder520.pages.dev/)** · **[📖 Documentation](#-getting-started)** · **[🛠️ Architecture](#-architecture)** · **[📦 Local Run](#-getting-started)**

---

## 🎯 Project Overview

**Sonder520** is a **zero-backend, pure frontend** personal work & life management tool, assisted by AI Agent. The project fuses productivity tools with Eastern aesthetics through an "Ink-Wash × Liquid Glass" visual language.

### ✨ Core Features

| Feature | Description |
|---------|-------------|
| 🌐 **Pure Frontend** | HTML/CSS/Vanilla JS, zero build, zero runtime dependencies |
| 🔒 **Privacy First** | Data stored only in local browser, optional encryption |
| 🎨 **Ink-Wash Style** | Rice-paper / Ink-black dual themes, liquid glass card design |
| 📱 **Responsive in-browser (3 viewports)** | Desktop/Tablet/Phone responsive layout, PWA offline support |
| 🎮 **Built-in Games** | Tic-Tac-Toe, Gomoku, Minesweeper, and 3 more mini games |
| 🧪 **Test Coverage** | 706 tests passing (Unit + Contract + Integration + E2E) |

### 🔐 Data & Privacy

- **Your data stays only in your browser**: Primary storage is IndexedDB (source of truth), localStorage is used as a fallback copy and cross-tab signal. Data is never uploaded to any server.
- **Optional encryption**: Enable encrypted storage in Settings (PBKDF2 key derivation + AES-GCM-256). Once encrypted, no one can read your data even if they gain access to the browser.
- **Manual backup**: Export a JSON backup via "Settings → Export Backup". Please back up before clearing browser data or switching devices.
- **Zero runtime dependencies**: The project does not depend on any third-party runtime libraries — all features are built on browser-native APIs.

### ⚠️ When Sonder520 is NOT a good fit

To be honest, Sonder520 is not a universal tool. Please think twice or choose more specialized software in these scenarios:

- **Need automatic cross-device sync** — Data only lives in the current browser. It cannot be automatically restored after switching devices or clearing browser data (manual import required).
- **Need team collaboration** — This is a personal tool with no multi-user sharing, collaboration, or permission management.
- **Need native app experience** — It is a Web App (PWA), not a native iOS/Android app. Some system-level capabilities (background push, system notifications) are limited.
- **Sole storage for important data** — Browser data can be cleared or corrupted. Back up regularly and do not keep the only copy in the browser.

---

## 📋 Features

### 12 Core Modules

| Module | Function | Highlights |
|--------|----------|------------|
| 🏠 **Home** | Greeting + daily quote + task overview | Completion ring, quick memo |
| 📅 **Today** | Four-level priority, Pomodoro timer, group management | 25-min focus timer |
| 📝 **Quick Memo** | Instant recording, history, archive | Quick save, one-click archive |
| 📱 **Self-Media** | Multi-platform scheduling, publish stats | WeChat / Xiaohongshu / Bilibili / Douyin |
| 💻 **Dev Work** | Project tasks, tech notes | Markdown rendering, code highlighting |
| 🤝 **Consulting** | Client management, income records | Phase tracking, income statistics |
| 📚 **Reading** | Book list, reading timer, excerpts | Progress tracking, reading sharing |
| 📰 **News** | Article collection, unread management | Link navigation, category sorting |
| 🎨 **Design** | Inspiration collection, design projects | Phase-based management |
| 🎮 **Entertainment** | 6 mini games | Tic-Tac-Toe, Gomoku, Minesweeper, etc. |
| 📊 **Statistics** | Multi-dimensional data visualization | Completion rate, progress charts |
| ⚙️ **Settings** | Theme, wallpaper, encryption, backup | Personalized customization |

---

## 🛠️ Architecture

### Sonder-Frame Progressive Framework

> Note: Sonder-Frame is a lightweight framework developed internally for this project, not a general-purpose open-source framework. It is designed specifically for personal productivity tools.

```
Application (Application Layer)
    ↓
ModuleFactory (Standard Module Factory)
    ↓
VisualEngine + EventBridge (UI Rendering + Event Bus)
    ↓
TrustLayer (Security Storage Layer)
    ↓
IDB (Primary Storage) + localStorage (Fallback Copy) + Crypto (Encryption)
```

### Core Tech Stack

| Technology | Purpose |
|------------|---------|
| **HTML5** | Semantic structure |
| **CSS3** | Liquid glass design, ink-wash style, responsive layout |
| **Vanilla JS** | Zero runtime dependencies, zero build steps, runs directly in browser |
| **IndexedDB** | Primary data storage (source of truth) |
| **localStorage** | Fallback copy + cross-tab signaling |
| **Crypto API** | PBKDF2 + AES-GCM-256 encryption |
| **Web Worker** | Gomoku AI async computation |
| **PWA** | Offline support, installable to desktop |
| **Playwright** | E2E testing (Desktop/Tablet/Phone) |

### Quality Assurance

- ✅ **699 tests** passing (Unit + Contract + Integration + E2E)
- ✅ **Zero-build** type checking (JSDoc + TypeScript)
- ✅ **ESLint** code standards
- ✅ **14 ADRs** Architecture Decision Records
- ✅ **PWA** offline support + version updates

---

## 🎨 Visual & Interaction

### Ink-Wash × Liquid Glass Design Language

- **Dual Themes**: Rice-paper (light) / Ink-black (dark), follows system by default
- **Liquid Glass Cards**: `backdrop-filter` frosted glass effect + inner highlight
- **Cinnabar Red Accent**: Chinese traditional color as accent
- **Chinese Pigment Palette**: Charts use traditional color spectrum

### Micro-Interactions

- Staggered fade-in animations
- Ink-spread chart animations
- Button press feedback
- Breathing empty states
- Sliding toast notifications
- Bottom-sheet dialogs on mobile

### Contrast Compliance

- All text contrast ≥4.5:1 (WCAG AA standard)
- Minesweeper digits readable in both themes
- Test-locked contrast tokens

---

## 📱 Platform Adaptation

| Device | Layout |
|--------|--------|
| **Desktop (>960px)** | Left liquid-glass sidebar + multi-column grid |
| **Tablet (721–960px)** | Sidebar collapses to 70px icon bar |
| **Phone Portrait (≤720px)** | Bottom liquid-glass nav bar (scrollable icons) |
| **Tiny Screens (≤360px)** | Compressed spacing, nav never breaks |
| **Phone Landscape** | Slimmer top bar and nav |

### Mobile Optimization

- ✅ iOS/Android adaptation
- ✅ viewport-fit=cover (notch adaptation)
- ✅ safe-area inset (gesture bar adaptation)
- ✅ 100vh→100dvh fallback
- ✅ Touch targets ≥44px
- ✅ 16px inputs to prevent iOS zoom

---

## 🚀 Getting Started

### Online Use (Recommended)

Visit https://sonder520.pages.dev/ to use immediately, no installation needed.

### Local Run

1. Clone the repository:
```bash
git clone https://github.com/xiaoyu-hue/sonder520.git
cd sonder520
```

2. Open `index.html` in a browser (double-click)

> 💡 Chrome / Edge recommended

### Data Management

- Data is stored locally in the browser (localStorage + IndexedDB)
- Regularly download JSON backups via "Data & Settings → Export Backup"
- Enable encrypted storage in Settings for extra privacy (PBKDF2 + AES-GCM)

---

## 📦 Development

### Requirements

- Node.js 18+
- npm 9+

### Commands

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Type check (zero-build)
npm run typecheck

# Lint
npm run lint

# E2E tests (Playwright)
npm run test:e2e

# Sync Service Worker cache
npm run sync-sw
```

### Test Coverage

- **Unit Tests**: Storage, encryption, TrustLayer
- **Contract Tests**: ModuleFactory CRUD
- **Integration Tests**: Factory+TrustLayer, Factory+VisualEngine, Module+EventBridge
- **E2E Tests**: Playwright three-device (Desktop/Tablet/Phone)

---

## 📚 Documentation

- **[PRD.md](docs/PRD.md)** - Product requirements (Chinese, contains version history, visual design, data specs, acceptance criteria)
- **[PRD.en.md](docs/PRD.en.md)** - Product requirements (English translation; Sections 1-12 current spec, Section 0 history kept in Chinese)
- **[AGENTS.md](AGENTS.md)** - Project collaboration rules (AI Agent development spec)
- **[CHANGELOG.md](CHANGELOG.md)** - Update log
- **[CODE_OF_CONDUCT.en.md](CODE_OF_CONDUCT.en.md)** - Code of conduct
- **[LICENSE](LICENSE)** - MIT License
- **[docs/](docs/README.md)** - Documentation index (ADRs, migration plans, specs & acceptance)
- **[AUTHOR.en.md](docs/AUTHOR.en.md)** - About the author

---

## 📈 Changelog

### v6.3 (Current)

- **v6.x Architecture Upgrade**: Repository data boundary (9) + Domain rule layer (task-domain) + store.js responsibility split (10 domain extension files)
- **UX fixes**: Chinese status dropdowns, mobile date/time, per-second clock tick

### v6.0 (Architecture foundation & visual)

### History

- v5.2 - Engineering defense + reliability improvements
- v5.1 - Performance & reliability patches
- v5.0 - Statistics semantic correction + CSV injection protection
- v4.0 - Quality hardening
- v3.0 - Optional encryption + 4 new games
- v2.1 - Games/Performance/PWA/Security/Storage upgrade
- v2.0 - Game interaction quality regression
- v1.3 - Mobile adaptation + daily quotes
- v1.2 - Ink-wash micro-interactions
- v1.1 - Ink-wash liquid glass visuals
- v1.0 - Initial release

---

## 🤝 Contributing

Welcome! Please read [CODE_OF_CONDUCT.en.md](CODE_OF_CONDUCT.en.md) and [AGENTS.md](AGENTS.md) for project guidelines.

### Contribution Flow

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/xxx`)
3. Commit your changes (`git commit -m 'Add xxx feature'`)
4. Push to the branch (`git push origin feature/xxx`)
5. Create a Pull Request

---

## 📄 License

This project uses the [MIT License](LICENSE) — free to use, modify, and distribute.

---

## 🙏 Acknowledgments & Dependencies

> **"If I have seen further, it is by standing on the shoulders of giants."**
> — Dedicated to the open-source community, browser standards, and the AI Agent that support Sonder520.

Sonder520 stands on the shoulders of these open-source projects and browser standards. Without them, a zero-programming-background author could not have built this.

### Development & Testing Toolchain

| Project | License | Notes |
|---------|---------|-------|
| [Node.js](https://nodejs.org) | MIT | Dev/test runtime (node --test, tsc, eslint, playwright all run on it) |
| [npm](https://www.npmjs.com) | Artistic-2.0 | Package management & scripts (zero runtime deps; dev-time only) |
| [Playwright](https://playwright.dev) | Apache-2.0 | E2E testing (Desktop/Tablet/Phone) |
| [ESLint](https://eslint.org) | MIT | Code linting |
| [eslint-plugin-jsdoc](https://github.com/gajus/eslint-plugin-jsdoc) | BSD-3-Clause | JSDoc comment linting |
| [TypeScript](https://www.typescriptlang.org) | Apache-2.0 | Zero-build type checking (via JSDoc) |
| [jsdom](https://github.com/jsdom/jsdom) | MIT | DOM test environment |
| [fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB) | Apache-2.0 | IndexedDB test mock |

### Architecture Ideas & Design Inspirations

Sonder520 is a zero-dependency self-built implementation, but its architecture was not invented in a vacuum — it stands on the shoulders of open-source ideas and engineering practice. **The patterns and standards are borrowed; the code is entirely original.**

| Inspiration | Idea / Pattern | Where it shows up |
|---------|---------|-------|
| [Martin Fowler, *Patterns of Enterprise Application Architecture*](https://martinfowler.com/eaaCatalog/repository.html) | Repository pattern (data-access boundary) | `js/repositories/` — 9 thin Repositories with unified get/getAll/create/update/remove; pages never touch storage details |
| [Clean Architecture (Robert C. Martin)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) | Layered architecture, dependencies point inward | UI → Domain → Repository → Persistence dependency direction; clear, testable boundaries |
| [DDD tactical layering (Eric Evans)](https://martinfowler.com/bliki/AnemicDomainModel.html) | Domain model separated from storage/UI | `js/domain/task-domain.js` — pure-function rule layer (task complete/reopen semantics), no DOM or storage |
| Frontend componentization & event-driven ecosystem (module systems & pub-sub across frameworks) | Module factory + event bus | ModuleFactory standard module protocol + SonderBus event bus (store changes → pages auto re-render) |
| [Ink & Switch, "Local-First Software"](https://www.inkandswitch.com/local-first/) and the local-first community | Device-local primary copy, offline-capable | IndexedDB as source of truth + localStorage replica + dual-write + PWA offline |
| [The TypeScript team](https://www.typescriptlang.org) | JSDoc type annotations + zero-build tsc checking | `globals.d.ts` + `tsc --noEmit` — type contracts without a build step |
| Community-wide module convention | UMD (Universal Module Definition) | All domain/Repository/Domain files load in both browser and Node |
| [W3C / MDN open standards](https://developer.mozilla.org) | WebCrypto (PBKDF2 + AES-GCM-256), IndexedDB, Web Worker, Service Worker, backdrop-filter, CSS custom properties | Encryption, persistence, AI worker, PWA, liquid-glass visuals — all built on native browser capabilities |

### Visual & Design Inspiration

- **Glassmorphism**: frosted-glass cards, inner highlights, and translucent layering come from the community Glassmorphism design movement ([glassmorphism.com](https://glassmorphism.com) and countless UI design community practices).
- **Ink-wash aesthetics**: the Rice Paper / Ink Black dual themes, cinnabar-red accents, and traditional Chinese painting palette come from traditional Chinese ink-wash art — a cultural gift, not open-source code, but equally respected.

### Hosting & CI Platforms

| Platform | Notes |
|---------|-------|
| [Cloudflare Pages](https://pages.cloudflare.com) | Free static hosting (main site https://sonder520.pages.dev/) |
| [Netlify](https://www.netlify.com) | Free static hosting (mirror site https://sonder520.netlify.app/) |
| [GitHub Actions](https://github.com/features/actions) | Free CI: tests / typecheck / lint / SW fingerprint gate + E2E 3-device matrix |

### Special Thanks

- **Browser-native capabilities** (see the W3C/MDN row above): Sonder520 has zero runtime dependencies; every feature is built on browser-native APIs.
- **Browser vendors**: the Chromium (Chrome/Edge), Firefox (Gecko), and WebKit (Safari) teams — standards like WebCrypto, backdrop-filter, and PWA are implemented and pushed forward by them; the W3C/MDN that write the standards and the vendors that ship them are both indispensable.
- **AI Agent**: Project development assisted by AI Agent
- **Everyone who contributes code, documentation, and time to the open-source community.**

> One line to sum it up: **patterns and standards borrowed, code entirely original — zero dependencies, full gratitude.**

---

<div align="center">

**Made with 💧 Ink-Wash Style**

> "Everyone is the protagonist of their own story. Sonder520 is the protagonist's tool."

</div>
