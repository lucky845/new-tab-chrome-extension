# New Tab Pro - Intelligent New Tab Manager

![Plugin Screenshot](img/preview.png)

New Tab Pro turns your new tab into a clean and efficient workspace: Picsum wallpapers, clock, weather, todo, notes and pomodoro widgets in two side wings — all in one page, all local.

**Fully usable with zero API keys.** Weather uses Open-Meteo, wallpapers use Picsum. Pexels and AMap are optional enhancements only. Everything is stored in `chrome.storage.local`; no telemetry, no data collection.

## 🚀 Core Features

### 🌟 Wallpaper

- Picsum keyless gallery by default (Unsplash curated photos): page browsing, pagination, random switch. **No category/keyword filtering** (the service ignores `?q=`); category requests fall through to Wallhaven automatically
- Wallhaven as an optional source (settings switch; the only keyless source with **real category/keyword filtering**, needs access to wallhaven.cc)
- Pexels (optional key) for keyword search
- Cached-first loading with no flicker; brightness 30–100% and blur 0–20px

### 🔍 Search

- One-click switch among Baidu, Google, Bing, Sogou, DuckDuckGo
- Search history (click-to-fill, clear all, remove single)
- Custom engines with `%s` placeholder

### 🎯 Shortcuts

- 10 per page (9 items + 1 add button), unified sizing
- Drag-and-drop sort (same page), right-click edit/delete
- Folder grouping: collect sites into folders with a 2×2 icon preview and count badge; click to expand, add more from within
- Responsive grid: 5 / 4 / 3 columns by viewport, square at any zoom level

### 🌤️ Weather (Open-Meteo by default)

- Keyless Open-Meteo data, auto location or manual city
- AMap Key optional (bottom of settings) to switch data source
- Caching and rate limiting, built-in SVG icons

### ⏱️ Widgets and side wings

- Clock / date / time greeting
- Todo: categories, due dates with overdue highlight, drag sort, daily stats
- Notes: multiple notes, pin, search, autosave
- Pomodoro: configurable durations, long-break rotation, daily 🍅 stats, ring progress
- Tools: timestamp / JSON / Base64 / URL / SHA-256 / radix / case / dedupe / word count / color / password / UUID, fully local
- Always-on left/right side wings (toggle in settings); ⤢ opens the full panel

## ⚙️ Config & Permissions

- All settings are optional:
    - Wallpaper source: Picsum (default) / Wallhaven
    - Pexels API Key (enhancement only)
    - AMap Weather Key (enhancement only) and city
    - Homepage tagline, custom search engines, side-widget toggle
- `manifest.json` permissions:
    - `storage`, `geolocation`
    - `host_permissions`: `picsum.photos`, `wallhaven.cc`, `pexels.com`, `amap.com`, `open-meteo.com`
- CSP: favicon icons come from target sites, `img-src * data:` allows broad compatibility.

## 🧱 Architecture & Conventions

- Modular: see `README-MODULES.md`
    - `SettingsManager` central config I/O and legacy key migration
    - `WeatherManager` uses `utils/request.js` and `config/weather-config.js`
    - Selector constants: `constants/selectors.js` via `window.SELECTORS`
    - Weather icons & visibility toggle: `components/weather-icons.js`, `components/visibility-toggle.js`
- Code quality:
    - Lint/Format: `npm run lint`, `npm run format`
    - EditorConfig for consistent whitespace/newlines

## 📦 Install & Use

### From Store (Edge)

1. Open Edge Add-ons Store
2. Search "New Tab Pro" and install
3. Open a new tab

### Load Locally

1. Clone the repository
2. Open extensions page, enable Developer Mode
3. Load unpacked and select the project folder

## 🔧 Advanced

### Wallpaper cache verification

1. Open the wallpaper library (no key needed)
2. Pick a wallpaper and refresh the tab
3. Observe flicker-free loading and persistence

### Shortcuts

1. Click Add to input info
2. Drag to sort (same page)
3. Right-click to edit/delete

## Development

Install tools and run lint/format:

```bash
npm install
npm run lint
npm run format
```

ESLint is configured for browser extensions and recognizes globals like `chrome` and `Sortable`.

## 🤝 Contributing

- Run `npm run lint` before PRs
- Follow modularization and selector constantization conventions

## 📄 License

- MIT

## 🔮 Roadmap

- [ ] More wallpaper sources
- [ ] Optional themes and sync
- [ ] Tests and TypeScript support

---

New Tab Pro - Redefine your new tab
