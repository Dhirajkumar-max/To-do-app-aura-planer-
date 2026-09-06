# Aura Planner & Life Dashboard

> A sophisticated, all-in-one personal productivity dashboard built with vanilla HTML, CSS, and JavaScript. Features task management, daily planning, finance tracking, fitness monitoring, and habit building—all in a beautiful glassmorphism interface.

![Aura Dashboard Preview](https://img.shields.io/badge/Status-Active-brightgreen) ![License](https://img.shields.io/badge/License-MIT-blue) ![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-yellow) ![CSS3](https://img.shields.io/badge/CSS3-Glassmorphism-purple)

## ✨ Features

### 🔐 Accounts & Security
- **Email sign up / sign in / sign out** with per-user data isolation
- **Salted PBKDF2 (120k iterations, SHA-256)** password hashing via the Web Crypto API — passwords are never stored in plaintext
- **Persistent sessions** with automatic 7-day expiry
- Runs fully client-side — no backend, external service, or API keys required

### 📱 Installable (PWA)
- **Installable on Android/desktop** like a native app (add to home screen)
- **Offline support** via a service worker that caches the entire app shell
- Works over HTTPS or `localhost` (required for the secure login system)

### 📋 Task Management
- **Smart task creation** with priorities (High/Medium/Low), due dates, and audio alarms
- **Real-time filtering** (All, Pending, Completed, Overdue, High Priority)
- **Search functionality** with instant results
- **Alarm system** with Web Audio API synthesized sounds + desktop notifications
- **Snooze & dismiss** controls for triggered alarms
- **Inline editing** and quick actions

### 📅 Daily Planner
- **Hour-by-hour scheduling** with start/end times
- **Detailed execution notes** for each time block
- **Status tracking** (Not Started → In Progress → Completed)
- **Visual timeline** with chronological ordering
- **One-click templates**: Standard Workday & Chill Weekend

### 💰 Finance Tracker
- **Income/Expense logging** with categories
- **Real-time dashboard** (Income, Expenses, Net Savings, Target)
- **AI-powered Money Advisor** with contextual insights
- **Spending pattern analysis** & actionable recommendations
- **Daily savings goal** configuration

### 🏃 Fitness Monitor
- **Animated progress ring** with gradient stroke
- **Step logging** (manual entry + quick-add buttons)
- **Calorie & distance calculations** (auto-computed)
- **Customizable daily step goal**
- **Real-time metrics**: Calories burned, distance, completion %

### 🎯 Habit Tracker
- **Weekly grid view** (Mon-Sun with dates)
- **Streak calculation** (consecutive day tracking)
- **Category organization** (Health, Learning, Work, Lifestyle)
- **One-tap day toggling** with visual feedback
- **Habit-specific streak badges**

### 🎨 UI/UX Highlights
- **Glassmorphism design** with layered depth
- **Dark/Light/System theme** with smooth transitions
- **Responsive layout** (desktop → mobile)
- **Micro-interactions** & spring animations
- **Live clock** in header
- **Audio system priming** for browser autoplay policies

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/aura-dashboard.git

# Navigate to project
cd aura-dashboard

# Open in browser (no build step required!)
open index.html
# or simply double-click index.html
```

> **No dependencies, no build tools, no node_modules.** Pure vanilla web technologies.

## 📁 Project Structure

```
aura-dashboard/
├── index.html          # Main HTML structure (semantic, accessible)
├── style.css           # Complete design system + components
├── script.js           # Application logic (modular, documented)
├── manifest.json       # PWA manifest (name, icons, display mode)
├── sw.js               # Service worker (offline caching)
├── icons/              # PWA app icons (192px, 512px)
├── README.md           # This file
└── .gitignore          # Git ignore rules
```

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Structure** | Semantic HTML5 |
| **Styling** | CSS3 (Custom Properties, Grid, Flexbox, Animations) |
| **Logic** | ES6+ Vanilla JavaScript (Modules pattern) |
| **Storage** | localStorage (per-user, no backend) |
| **Authentication** | Web Crypto API (PBKDF2 + SHA-256, salted) |
| **Audio** | Web Audio API (synthesized, zero assets) |
| **Notifications** | Notifications API |
| **PWA** | Web App Manifest + Service Worker (offline-ready) |
| **Fonts** | Google Fonts (Outfit, Plus Jakarta Sans) |

## 🎯 Key Implementation Details

### State Management
- Single-source-of-truth pattern with `localStorage` persistence
- Automatic serialization/deserialization on load/save
- Reactive UI updates via `render()` functions

### Alarm System
```javascript
// Synthesized audio (no external files)
class SynthesizedAlarm {
  play()    // Pulsing sine wave via Web Audio API
  stop()    // Clean oscillator teardown
  playShortPing()  // UI feedback sound
}
```
- Respects browser autoplay policies with user gesture priming
- Desktop notifications fallback when audio context suspended

### Theme System
```css
:root { /* Dark theme (default) */ }
[data-theme="light"] { /* Light theme overrides */ }
@media (prefers-color-scheme: light) { /* System preference */ }
```
- CSS custom properties for instant switching
- Smooth 300ms transitions on all color properties
- Persisted to localStorage

### Responsive Breakpoints
- **≥1200px**: Full 3-column finance, 2-column tasks/planner/fitness
- **≤1024px**: Stacked sidebar, single-column grids
- **≤640px**: Compact headers, 2-column stats, stacked forms

## 📸 Screenshots

| Dark Theme | Light Theme | Mobile View |
|------------|-------------|-------------|
| ![Dark](https://via.placeholder.com/400x250/070913/ffffff?text=Dark+Theme) | ![Light](https://via.placeholder.com/400x250/f8fafc/0f172a?text=Light+Theme) | ![Mobile](https://via.placeholder.com/200x350/070913/ffffff?text=Mobile) |

> *Add actual screenshots by replacing placeholder URLs*

## 🔧 Customization

### Modify Color Palette
Edit CSS custom properties in `:root`:
```css
:root {
  --accent-blue: #your-brand-blue;
  --accent-purple: #your-brand-purple;
  /* ... */
}
```

### Add New Task Categories
1. Add `<option>` in `index.html` task form
2. Update `priorityLabels` object in `script.js`
3. Add corresponding badge styles in `style.css`

### Extend Finance Categories
Add options to `#txCategory` select in `index.html`—advisor auto-detects new categories.

## 🧪 Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Core UI | ✅ 80+ | ✅ 75+ | ✅ 14+ | ✅ 80+ |
| Web Audio API | ✅ 66+ | ✅ 65+ | ✅ 14.1+ | ✅ 79+ |
| Notifications API | ✅ 60+ | ✅ 55+ | ✅ 16.4+ | ✅ 79+ |
| localStorage | ✅ 4+ | ✅ 3.5+ | ✅ 4+ | ✅ 12+ |

## 📝 License

MIT License — see [LICENSE](LICENSE) for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🙏 Acknowledgments

- **Fonts**: [Outfit](https://fonts.google.com/specimen/Outfit) & [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) by Google Fonts
- **Icons**: Unicode emoji (zero dependency, native rendering)
- **Design Inspiration**: Modern glassmorphism trends, Linear, Notion, Raycast
- **Audio Synthesis**: Web Audio API fundamentals

---

<div align="center">

**Built with ❤️ for personal productivity**

[⭐ Star this repo](https://github.com/yourusername/aura-dashboard) • [🐛 Report Bug](https://github.com/yourusername/aura-dashboard/issues) • [💡 Request Feature](https://github.com/yourusername/aura-dashboard/issues)

</div>