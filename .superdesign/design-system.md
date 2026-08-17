# Design System — 智能发票解析归档 (Smart Invoice Parsing & Archiving)

## Product Context

- **What**: A pure-frontend personal finance tool that parses scanned invoice PDFs via Gemini AI. User picks PDF(s) (incl. from iCloud), splits multi-invoice scans into single invoices, AI-extracts structured fields (company, date, invoice no, purpose, TVA, total, currency), lets the user proofread/edit in a table, then exports renamed PDFs + an Excel report as a ZIP.
- **Key promise**: 数据零落地 (data never leaves the browser) — privacy-first, "仅在浏览器内完成处理".
- **Platforms**: PC/Mac browsers + iOS Safari (PWA, bottom-nav friendly).
- **Users**: Individuals/family finance managers handling cross-border (FR/EU) invoices; non-technical; want speed + trust.
- **Core flow (single page, 3 stacked cards)**: ① PDF 预处理器 (split/order/delete pages) → ② Gemini 语义提取 (editable results table) → ③ 导出 ZIP + Excel (filename preview). Plus a 设置 tab (API keys, model, rename template builder, prompt editor).
- **JTBD**: "Give me properly named, archived invoice files and one consolidated Excel in under a minute, without uploading my private invoices anywhere."

## Brand & Personality

"Institutional trust meets quiet precision" (per DESIGN.md: Reliant Financial). Corporate/Modern. High information density without sacrificing legibility; "quietly premium"; feels secure and methodical; user feels in total control of their data. Professional financial-tool aesthetic, not flashy consumer design.

## Colors (source of truth: `src/styles.css` `:root`)

| Token | Value | Usage |
| --- | --- | --- |
| `--rf-surface` | `#f7f9fb` | Page background (near-white cool) |
| `--rf-surface-low` | `#f2f4f6` | Grouping containers, sticky table header bg |
| `--rf-surface-card` | `#ffffff` | Cards, inputs, active nav item |
| `--rf-text` | `#191c1e` | Primary text (near-black cool) |
| `--rf-text-muted` | `#45464d` | Secondary/hints |
| `--rf-border` | `#e2e8f0` | Borders (slate-200) |
| `--rf-border-muted` | `#c6c6cd` | Subtle separators |
| `--rf-accent` | `#3b82f6` | PRIMARY actions, focus rings, dropzone dashes (blue-500) |
| `--rf-accent-hover` | `#2563eb` | Primary button hover (blue-600) |
| `--rf-shadow-card` | `0 4px 6px rgba(15,23,42,0.05)` | Cards |
| `--rf-shadow-overlay` | `0 10px 15px rgba(15,23,42,0.1)` | Modals/dropdowns |

Semantic states: success `#16a34a`-ish (text-green-700), error `#dc2626` (text-red-600 / el danger). Element Plus theme is remapped to these tokens (`--el-color-primary` = accent, radius 12px).

## Typography

- Font family: **Inter** (Google Fonts, weights 400/500/600; fallback system-ui stack). No serif anywhere.
- Page title: 24px/600, tracking -0.01em
- Card headers: 16px/600 via el-card header (letter-spacing -0.01em)
- Body: 14px–16px, 400–500
- Labels & table headers: 12px/600, letter-spacing 0.05em, UPPERCASE (`.rf-form .el-form-item__label`, `.rf-table` th)
- Numbers/IDs: monospace + tabular-nums (`font-mono tabular-nums`)
- Muted hints: 12px, `--rf-text-muted`

## Spacing & Layout

- 4px baseline grid; cards use gap-4 (16px) internally; `p-6` on hero zones; page container `py-6` + `pb-24` (clear bottom nav), `gap-6` between cards.
- Container: max-width **1440px**, centered (`mx-auto px-5 md:px-6`).
- Bottom fixed navbar: 72px tall, frosted glass (white 92% + backdrop-blur), centered pill (max-width 420px, 44px inner, radius 9999px) with 2 segmented tabs 处理/设置; active tab = white pill + shadow.
- Thumbnail grid: 1 col (<500px), 3 cols (500–1180px), 5 cols (>1181px); thumbs rounded 8px; cards rounded 12px.

## Radius & Elevation

- 12px: cards, buttons, inputs, tables, dropzone (consistent)
- 8px: thumbnails/images
- 9999px: pills/chips/nav
- Elevation L0 = surface; L1 = white card + 1px `#e2e8f0` border + soft shadow; L2 = overlay shadow.

## Components (Element Plus themed + custom)

- **WorkflowCard**: `el-card.rf-card` — white, 1px border, soft shadow, bold header row with bottom border; body `flex flex-col gap-4`.
- **Primary button**: accent blue bg, white text, 600 weight, hover darkens to `#2563eb`; small sizes inside tables.
- **Data table** (`.rf-table`): sticky uppercase muted headers on `--rf-surface-low`, zebra striping, tabular-nums, 12px radius, horizontal scroll on mobile, small size.
- **Dropzone**: dashed accent border, 12px radius, white bg, title + hint + primary CTA button.
- **Chips/pills**: white bg, border, rounded-full, 12px/600 (group labels, template tokens, draggable).
- **ThumbnailCard**: white card, "Page N" + danger delete toggle, thumb image (or pulsing placeholder), break/join toggle below; deleted = opacity-40; drag-sortable.
- **Nav**: bottom pill segmented control (处理 / 设置).
- Toasts: `ElMessage`.

## Motion

- Minimal. SortableJS drag 150ms animation; pulsing placeholder (`animate-pulse`) while thumbs render; no other motion. Keep restrained — institutional feel.

## Constraints / Requirements

- Chinese-language UI (zh-CN), all copy simplified Chinese.
- Must remain fully client-side, no backend; performance matters on mobile Safari (PDF thumb rendering is heavy — avoid over-designing imagery).
- Mobile-first considerations: bottom nav, single-column cards, table horizontal scroll, hide ID column on <640px.
- Strict 8-column+1 Excel export logic is product behavior — UI must expose filename preview (col 8) clearly.
- Keep Element Plus components (theming via CSS vars only) — visual redesign should not require rewriting component logic.
- iOS PWA: standalone display, theme color `#f7f9fb`, safe-area aware bottom nav.
