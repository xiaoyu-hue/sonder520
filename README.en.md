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
| 🌐 **Pure Frontend** | HTML/CSS/Vanilla JS, zero build, zero dependencies |
| 🔒 **Privacy First** | Data stored only in local browser, optional encryption |
| 🎨 **Ink-Wash Style** | Rice-paper / Ink-black dual themes, liquid glass card design |
| 📱 **Cross-Platform** | Desktop/Tablet/Phone responsive, PWA offline support |
| 🎮 **Built-in Games** | Tic-Tac-Toe, Gomoku, Minesweeper, and 3 more mini games |
| 🧪 **Test Coverage** | 699 tests passing (Unit + Contract + Integration + E2E) |

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
| **Vanilla JS** | Zero dependencies, zero build, high performance |
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
- **[AGENTS.md](AGENTS.md)** - Project collaboration rules (AI Agent development spec)
- **[CHANGELOG.md](CHANGELOG.md)** - Update log
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** - Code of conduct
- **[LICENSE](LICENSE)** - MIT License
- **[docs/](docs/README.md)** - Documentation index (ADRs, migration plans, specs & acceptance)
- **[AUTHOR.en.md](docs/AUTHOR.en.md)** - About the author

---

## 📈 Changelog

### v6.0 (Current)

- **Sonder-Frame Progressive Framework**
- **IndexedDB Source-of-Truth Reversal** (IDB primary, LS fallback)
- **Desktop Pet Module** (3 characters + coins + shop + feeding + achievements)
- **Offline Status Indicator**
- **Three-Device Adaptation** (Desktop/Tablet/Phone)

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

Welcome! Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [AGENTS.md](AGENTS.md) for project guidelines.

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

## 🙏 Acknowledgments

- **AI Agent**: Project development assisted by AI Agent
- **Open Source Community**: Thanks to all open source contributors
- **Users**: Thanks to everyone who uses Sonder520

---

<div align="center">

**Made with 💧 Ink-Wash Style**

> "Everyone is the protagonist of their own story. Sonder520 is the protagonist's tool."

</div>
