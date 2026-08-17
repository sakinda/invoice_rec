# Theme & Design System

## Part 1 — Compact Token Summary

**Product**: 智能发票解析归档 (Smart Invoice Parsing & Archiving) — a pure-frontend personal finance tool for parsing/archiving scanned invoice PDFs via Gemini AI.

**Design direction** (from `DESIGN.md`): "Reliant Financial" — Corporate/Modern style, institutional trust, high information density, "quietly premium". Target: private wealth managers / financial analysts; must feel sophisticated yet utilitarian.

### Colors (from `src/styles.css` `:root`)

| Token | Value | Usage |
| --- | --- | --- |
| `--rf-surface` | `#f7f9fb` | Page background |
| `--rf-surface-low` | `#f2f4f6` | Grouping containers, table header bg |
| `--rf-surface-card` | `#ffffff` | Cards |
| `--rf-text` | `#191c1e` | Primary text |
| `--rf-text-muted` | `#45464d` | Secondary text |
| `--rf-border` | `#e2e8f0` | Card/border |
| `--rf-border-muted` | `#c6c6cd` | Subtle border |
| `--rf-accent` | `#3b82f6` | Primary actions, focus |
| `--rf-shadow-card` | `0px 4px 6px rgba(15,23,42,0.05)` | Card elevation |
| `--rf-shadow-overlay` | `0px 10px 15px rgba(15,23,42,0.1)` | Modal/dropdown |

Element Plus theme is overridden via CSS vars: `--el-color-primary: var(--rf-accent)`, `--el-border-radius-base: 12px`, `--el-border-color: var(--rf-border)`, etc.

### Typography

- Font: **Inter** (loaded from Google Fonts, weights 400/500/600) with system-ui fallbacks
- Body: 16px/400, 24px line-height; small text 14px; labels 12px/600 with `0.05em` letter-spacing + uppercase (`.rf-form .el-form-item__label`, `.rf-table` headers)
- Numbers use `tabular-nums` (`font-variant-numeric` on table body)

### Spacing & Radius

- 4px baseline grid; card padding `lg` (24px), internal grouping `md` (16px)
- Radius: cards/buttons/inputs **12px**, dropzone 12px, navbar pill `9999px`, thumbs 8px
- Layout: max-width `1440px` centered (`.rf-container`), 12-col grid intent

### Elevation

- Level 0: `#f7f9fb` surface
- Level 1 (cards): white + 1px `#e2e8f0` border + `0 4px 6px rgba(15,23,42,0.05)`
- Level 2 (overlays): `0 10px 15px rgba(15,23,42,0.1)`

### Key Layout Facts

- **Bottom fixed navbar** (72px tall, `position:fixed; bottom:0`, white 92% + backdrop-blur), inner pill-shaped (420px max, `border-radius:9999px`) with 2 tabs: 处理 / 设置. Content has `pb-24` bottom padding to clear it.
- Tab switching via `v-show` (both views stay mounted).
- Responsive thumbnail grid: 1 col (<500px), 3 cols (500–1180px), 5 cols (>1181px).

## Part 2 — Raw Source Dumps

### `src/styles.css` (full)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --rf-surface: #f7f9fb;
  --rf-surface-low: #f2f4f6;
  --rf-surface-card: #ffffff;
  --rf-text: #191c1e;
  --rf-text-muted: #45464d;
  --rf-border: #e2e8f0;
  --rf-border-muted: #c6c6cd;
  --rf-accent: #3b82f6;
  --rf-shadow-card: 0px 4px 6px rgba(15, 23, 42, 0.05);
  --rf-shadow-overlay: 0px 10px 15px rgba(15, 23, 42, 0.1);

  --el-color-primary: var(--rf-accent);
  --el-border-radius-base: 12px;
  --el-border-color: var(--rf-border);
  --el-text-color-primary: var(--rf-text);
  --el-text-color-regular: var(--rf-text-muted);
  --el-fill-color-blank: var(--rf-surface-card);
  --el-bg-color: var(--rf-surface);
  --el-bg-color-page: var(--rf-surface);
  --el-box-shadow-light: var(--rf-shadow-card);
  --el-box-shadow: var(--rf-shadow-overlay);
}

html,
body {
  height: 100%;
}

body {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial,
    'Apple Color Emoji', 'Segoe UI Emoji';
  background: var(--rf-surface);
  color: var(--rf-text);
}

.rf-container {
  max-width: 1440px;
}

.rf-card.el-card {
  border: 1px solid var(--rf-border);
  box-shadow: var(--rf-shadow-card);
}

.rf-card.el-card .el-card__header {
  border-bottom: 1px solid var(--rf-border);
  font-weight: 600;
  letter-spacing: -0.01em;
}

.rf-form .el-form-item__label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--rf-text-muted);
}

.rf-table.el-table {
  border-radius: 12px;
  overflow: hidden;
}

.rf-table.el-table .el-table__header-wrapper th.el-table__cell {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--rf-surface-low);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.rf-table.el-table .el-table__body td.el-table__cell {
  font-variant-numeric: tabular-nums;
}

.rf-dropzone {
  border: 1px dashed var(--rf-accent);
  background: var(--rf-surface-card);
  border-radius: 12px;
}

.el-button {
  font-weight: 600;
}

.el-button--default {
  background: var(--rf-surface-card);
  border-color: var(--rf-border);
  color: var(--rf-text);
}

.el-button--default:hover,
.el-button--default:focus-visible {
  border-color: var(--rf-accent);
  color: var(--rf-text);
}

.el-button--primary {
  background: var(--rf-accent);
  border-color: var(--rf-accent);
  color: #ffffff;
}

.el-button--primary:hover,
.el-button--primary:focus-visible {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
}

.rf-navbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 72px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border-top: 1px solid var(--rf-border);
  z-index: 50;
}

.rf-navbar__inner {
  width: 100%;
  max-width: 420px;
  height: 44px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  background: var(--rf-surface-low);
  border: 1px solid var(--rf-border);
  border-radius: 9999px;
  padding: 4px;
  box-shadow: 0px 4px 6px rgba(15, 23, 42, 0.04);
}

.rf-nav-item {
  appearance: none;
  border: 0;
  background: transparent;
  border-radius: 9999px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--rf-text-muted);
  cursor: pointer;
}

.rf-nav-item:hover {
  color: var(--rf-text);
}

.rf-nav-item:focus-visible {
  outline: 2px solid rgba(59, 130, 246, 0.35);
  outline-offset: 2px;
}

.rf-nav-item--active {
  background: var(--rf-surface-card);
  box-shadow: var(--rf-shadow-card);
  color: var(--rf-text);
}
```

### `tailwind.config.cjs` (full)

```js
module.exports = {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {}
  },
  plugins: []
}
```

### `DESIGN.md` brand tokens (excerpt — colors & typography)

- Colors: surface `#f7f9fb`, on-surface `#191c1e`, on-surface-variant `#45464d`, outline `#76777d`, outline-variant `#c6c6cd`, secondary `#0058be`, secondary-container `#2170e4`, error `#ba1a1a`, error-container `#ffdad6`, on-error-container `#93000a`
- Type scale: h1 30px/600/-0.02em, h2 24px/600/-0.01em, h3 20px/600, body-md 16px/400, body-sm 14px/400, label-md 12px/600/+0.05em, mono-data 14px/500 (tabular `tnum`)
- Rounded: sm 0.25rem, DEFAULT 0.5rem, md 0.75rem, lg 1rem, xl 1.5rem, full 9999px
- Spacing unit 4px; gutter 20px; margin 24px; max width 1440px
