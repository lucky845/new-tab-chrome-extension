# New Tab Pro - Intelligent New Tab Manager

![Plugin Screenshot](img/preview.png)

New Tab Pro turns your new tab into a clean and efficient workspace: Picsum wallpapers, clock, weather, todo, notes and pomodoro widgets in two side wings — all in one page, all local.

**Fully usable with zero API keys.** Weather uses Open-Meteo, wallpapers use Picsum. Pexels and AMap are optional enhancements only. Everything is stored in `chrome.storage.local`; no telemetry, no data collection.

## 🚀 Core Features

### 🌟 Wallpaper

- Picsum keyless gallery by default (Unsplash curated photos): page browsing, pagination, random switch. **No category/keyword filtering** (the service ignores `?q=`); category requests fall through to Wallhaven automatically
- Wallhaven as an optional source (settings switch; the only keyless source with **real category/keyword filtering**, needs access to wallhaven.cc)
- Pexels (optional key) for keyword search
- **Persisted on switch, read from disk next time**: picking a wallpaper immediately fetches it as a blob, converts it to a data URL and stores it in `chrome.storage.local` alongside its source URL (a URL mismatch marks it stale). The next new tab reads the cache and never hits the image host — measured 0 image requests and first paint 112ms after DCL on the second open
- `fetch` rather than a canvas bake: image hosts 302-redirect to CDNs, and any hop missing CORS headers makes a canvas bake produce snow noise; reading the bytes keeps it faithful
- Writing happens at switch time, never on the startup path — no added first-paint cost
- Brightness 30–100% and blur 0–20px

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

### 🎨 Themes (v1.8.0)

- Four modes: light / dark / follow system / sunrise–sunset
- **Light = raw wallpaper**: no veil, no text color changes. Only the clock sits directly on the photo, held by a radial scrim (`--on-photo-scrim`); everything else sits on glass
- **Dark = dimmed wallpaper**: the veil is set to 0.38 (was 0.55). The darker the veil, the less color is left for the glass to pick up — at 0.55 the glass chroma-retention ratio fell to 0.8. 0.38 is the intersection of "white text still passes WCAG AA" and "glass still shows the wallpaper's color"
- Sunrise–sunset switches automatically using local times; falls back to a custom window and says so in settings when location or network is unavailable
- Zero first-paint flash: the theme is applied synchronously before CSS is parsed (`js/theme-boot.js`)
- Preview-then-save: switching in settings previews instantly; only Save persists, closing the panel rolls back

### 🧊 Liquid glass material (v1.8.0)

- Material is **graded by role**, the biggest change in this release. The previous version gave every element one grade (blur 34 / tint 0.34): decoration turned into grey fog, text surfaces were still too thin — bad at both ends.

  | Grade | Tokens | blur | tint | saturate | Used by |
  | --- | --- | --- | --- | --- | --- |
  | Decorative | `--glass-*` | 14px | 0.22 | 150% | quick access, weather card |
  | Field | `--glass-field-*` | 16px | 0.34 | 160% | search box |
  | Card | `--glass-card-*` | 20px | 0.40 | 220% | side widgets (11–14px text needs a luminance floor) |
  | Panel | `--glass-panel-fill` | — | 0.72 | — | settings (a working surface, allowed to be thick) |

- **Low blur is the turning point**: at 34px the structure behind is gone and it reads as frosted plastic; at 14–20px you can see the wallpaper's shapes through the glass
- **Four layers — without all four it is just fancy frosted glass**:
  1. Frosted base — `--glass-backdrop` composes blur / saturate / brightness / contrast once; elements reference it instead of re-assembling their own
  2. Refraction — `#liquid-refract` (`feTurbulence` + `feDisplacementMap`, scale 40) pulls the wallpaper behind the element through its rounded corners. Gated behind `@supports (backdrop-filter: url(#…))`; unsupported browsers fall back to plain blur, and a half-applied `url()` can never end up making the glass fully transparent
  3. **Bevel + grain** — a 1.5px ring drawn by `::after` from a 154° gradient (two masks XORed, leaving only the padding ring): lit top-left, shaded bottom-right. `::before` lays a 5% `feTurbulence` grain (overlay). A uniform 1px stroke reads as a plastic chamfer; the grain turns a blurred colour patch into a material
  4. Highlights and shadow — top sheen plus a six-part `--glass-shadow` (rim light / bevel inner shade / bottom inner shadow / hairline / near shadow / far shadow)
- **Order matters**: `url(#liquid-refract)` must come before `blur()`. Blurring first blurs away exactly the detail you are about to displace — measured 26.1% vs 15.0% pixel difference
- **24px radii** (`--radius-glass`); the “add” slot moved from a 2px dashed outline to a 1px solid edge plus the bevel ring
- **Measured, not eyeballed**: chroma retained versus the real ground (wallpaper + veil) is 0.99–1.60 in light and 0.95–1.55 in dark; dark luminance offset stays within ±8 L\*
- **Text contrast**: scanned per glyph — render the text transparent, diff out the glyph pixels, sample the real background underneath (a rectangle mean counts the glyph itself as background and misreports thin strokes and large type). 52 nodes on the page, 44 across three scrolled screens of settings, plus wallpaper / weather / tools / add-site / engine dropdown / folder overlay: zero failures in both themes
- **Never dim text with `opacity`**: it dissolves the glyph together with its own halo and only gets muddier. Explicit steps (`--text-primary/secondary`) and semantic pairs (`--accent-ink` / `--on-accent`) instead — the dark accent is a bright solid and needs dark ink on it
- Under `prefers-reduced-transparency: reduce` all three grades degrade to `blur(20px) saturate(140%)`

### 🧪 How the liquid glass is actually rendered (v1.8.1)

The refraction above used to be an SVG filter; from v1.8.1 the body is real-time WebGL2 (`js/utils/liquid-glass.js`, falling back to the SVG path when WebGL2 is unavailable). This release fixed four genuine causes of "the glass looks wrong":

| Symptom | Real cause | Fix |
| --- | --- | --- |
| Glass looks veiled white in the dark theme | The sampler used window coordinates ÷ viewport size as UVs, assuming `background-size: 100% 100%`. The CSS is `cover`: a 1920×1080 image in a 1440×900 window is cropped 160px horizontally, so every sample landed 192px off | Added `uSceneOrigin` (offset of the drawn rectangle relative to the viewport) and repurposed `uSceneRect.zw` to hold the drawn size, derived from `scale = max(vw/iw, vh/ih)` and recomputed on resize |
| Saturated wallpapers turn grey | Dark dimming went through `mix(color, neutral grey, m)`, pulling all three channels toward grey (pure red `[255,0,0]` → `[206,58,65]`, saturation 1.0 → 0.718) | The dark grade now dims by multiplication, which keeps the hue |
| Icons and labels vanish on white or snow wallpapers | Hue-preserving dimming no longer darkens anything, so a pale wallpaper came straight through at full white | Luminance ceiling applied right before the final output (linear 1.0 → 0.182 → sRGB 118), holding white text above AA; measured 4.81–19.09:1 across eight wallpapers |
| Every glass surface disappears after resizing the window | The shared ping-pong FBOs were rebuilt on every size switch; after pooling, the cache-hit path neither reset accumulation nor maintained the export canvas size, so `drawImage` read pixels from a 1×1 buffer | Size-keyed FBO pool, plus an export canvas that only ever grows and is read from its bottom-left corner |

- **FBOs pooled by size**: 21 glass surfaces use only 8 distinct sizes, and each size switch used to `deleteTexture` + `deleteFramebuffer` the whole set. After pooling, 12 frames × 21 surfaces produced **0** FBO allocations and dropped render time from **414.4ms to 4.1ms**
- **The default framebuffer only grows**: assigning `canvas.width` reallocates the entire drawing buffer — costlier than building an FBO. It is pinned to the largest size seen, and exports read the bottom-left sub-rectangle (WebGL's origin is bottom-left)
- **Why frames accumulate**: several frames are averaged to suppress noise, so any change to size, scene or geometry must zero `frame`, otherwise history from the old position bleeds into the new picture
- **Cross-origin requirement when loading the scene**: an extension page's origin is `chrome-extension://` and image hosts are cross-origin. Without `crossOrigin = 'anonymous'` on `new Image()` the `onload` still fires but `texImage2D` throws → the scene stays invalid forever → every surface renders nothing

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
    - `host_permissions`: `picsum.photos`, `wallhaven.cc`, `pexels.com`, `amap.com`, `open-meteo.com`; image CDNs (`images.picsum.photos`, `images.pexels.com`, `th.wallhaven.cc`, `w.wallhaven.cc`) so the wallpaper cache can read bytes
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
- [x] Theme switching: light (as-is) / dark (veiled wallpaper) / follow system / sunrise–sunset (v1.7.0)
- [x] Three-layer liquid glass (blur + SVG refraction + edge light) with measured acceptance for glass chroma and text contrast (v1.7.1)
- [x] Theme system and liquid-glass rebuild, unified panel material, panel enter/exit motion, URL-scheme and import-field sanitising (v1.8.0)
- [x] WebGL2 liquid-glass refraction, wallpaper persisted on switch, weather backoff and FBO pooling (v1.8.1)
- [ ] Tests and TypeScript support

## 🗓️ Changelog

| Version | Highlights |
| --- | --- |
| **v1.8.1** | WebGL2 liquid-glass refraction fixing three real causes (scene sampling under `cover`, desaturation, resize failure), FBOs pooled by size (render 414ms → 4.1ms), wallpaper persisted on switch (zero image requests on reopen), weather request backoff (worst case 40s → two requests per round), refresh button removed |
| v1.8.0 | Role-graded liquid glass rebuild, theme system with zero first-paint flash, unified panel material across six overlays, rebuilt folder preview and count badge, panel enter/exit motion, import sanitising for URL schemes and field types, assorted security fix-ups |
| v1.7.1 | Three-layer liquid glass (blur + SVG refraction + edge light) with measured glass-chroma and text-contrast acceptance |
| v1.7.0 | Theme switching: light (raw wallpaper) / dark (veiled) / follow system / sunrise–sunset |
| v1.6.0 | Unified confirm/input dialog, forward-compatible backup & restore, wallpaper category filter fix |

---

New Tab Pro - Redefine your new tab