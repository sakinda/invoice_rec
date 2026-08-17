# Routes

No vue-router. Navigation is **tab-state based** in `src/App.vue` (`activeTab: ref<'process' | 'settings'>`), with a fixed bottom navbar. Both views are always mounted (`v-show`).

## View Map

| Tab | Label | Component | Description |
| --- | --- | --- | --- |
| `process` (default) | 处理 | `PdfSplitter` → `InvoiceProcessor` → `Exporter` (vertical stack) | Main workflow: import/split PDF → AI extract → export |
| `settings` | 设置 | `SettingsPanel` | API keys, model, rename template, prompt |

## App entry

- `index.html` → `src/main.ts` → mounts `App` with ElementPlus full import
- `src/App.vue` renders the app shell (header + active view + bottom navbar)

## Workflow (process tab, top to bottom)

1. **PdfSplitter** — select PDFs; emits `split-ready` with `{ invoices: SplitInvoice[], sourceName, pdfBytes? }` up to App, stored in `invoices` ref
2. **InvoiceProcessor** — receives `invoices` prop; user clicks 开始识别; results written into each `SplitInvoice.extract`
3. **Exporter** — receives `invoices` prop; previews filenames and exports ZIP
