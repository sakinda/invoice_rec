# Extractable Components

## Layout Components

### BottomNavBar
- Source: `src/App.vue` (template) + `.rf-navbar*` in `src/styles.css`
- Category: layout
- Description: Fixed bottom pill-shaped segmented control with 2 tabs (处理 / 设置); 72px bar with frosted-glass background
- Extractable props: activeTab (string, default: "process"), tabs (array of {key,label})
- Hardcoded: tab labels 处理/设置, all CSS

### PageHeader
- Source: `src/App.vue` (template)
- Category: layout
- Description: App title (发票处理, 24px/600) with right-aligned muted subtitle (仅在浏览器内完成处理), hidden on mobile
- Extractable props: title (string), subtitle (string)
- Hardcoded: all CSS classes

## Basic Components

### WorkflowCard
- Source: `src/components/PdfSplitter.vue`, `src/components/InvoiceProcessor.vue`, `src/components/Exporter.vue`, `src/components/SettingsPanel.vue` (shared pattern via `el-card.rf-card` + `#header` slot)
- Category: basic
- Description: White card with 1px border, soft shadow, 12px radius, bold header row with bottom border; body uses `flex flex-col gap-4`
- Extractable props: title (string), body slot
- Hardcoded: header styling in styles.css (`.rf-card.el-card`)

### DataTable
- Source: `src/components/InvoiceProcessor.vue`, `src/components/Exporter.vue` (shared pattern via `el-table.rf-table`)
- Category: basic
- Description: Element Plus table wrapped with `.rf-table`: sticky uppercase 12px/600 muted headers on `--rf-surface-low`, zebra striping, tabular-nums body, 12px radius, horizontal scroll on mobile
- Extractable props: columns (array), rows (array), size (default small)
- Hardcoded: header styling in styles.css (`.rf-table.el-table`)

### GroupChip
- Source: `src/components/PdfSplitter.vue` (逻辑分组 chips) and `src/components/SettingsPanel.vue` (token chips)
- Category: basic
- Description: White pill chip, `border` + `rounded-full`, 12px/600 text, bg-white; used for group labels and draggable template tokens
- Extractable props: label (string), active (boolean), onRemove (optional)
- Hardcoded: CSS classes

### Dropzone
- Source: `src/components/PdfSplitter.vue` + `.rf-dropzone` in styles.css
- Category: basic
- Description: Dashed accent-blue border zone, 12px radius, white bg, icon/primary button on right
- Extractable props: title (string), hint (string), onSelect (callback)
- Hardcoded: CSS in styles.css

### ThumbnailCard
- Source: `src/components/PdfSplitter.vue` (`.rf-thumb-card`)
- Category: basic
- Description: White card showing a PDF page thumbnail (rounded 8px img or pulsing placeholder), "Page N" label + delete/restore small danger button in header row, break/join toggle button + status text below; drag-sortable; deleted state = opacity-40
- Extractable props: pageNumber (number), thumbUrl (string), deleted (boolean), breakAfter (boolean), onDelete, onToggleBreak
- Hardcoded: CSS classes in component scoped styles

## Notes

- No logo/brand mark exists anywhere in the app (text-only header) — a logo position is NOT required by current design.
- Element Plus components (el-card/el-button/el-table/el-input/el-form/el-select/el-tooltip/el-radio) are global primitives, not extractable from this repo.
