# Pages

## 处理 (Process View) — default tab

Entry: `src/App.vue` (template block `v-show="activeTab === 'process'"`)

Dependencies:
- src/App.vue
  - src/components/PdfSplitter.vue
    - src/lib/pdf.ts
    - src/lib/types.ts
    - sortablejs (external)
    - element-plus (ElMessage, el-card, el-button, el-tooltip)
  - src/components/InvoiceProcessor.vue
    - src/lib/gemini.ts
      - src/lib/json.ts
      - src/lib/types.ts
    - src/lib/storage.ts
      - src/lib/types.ts
    - element-plus (ElMessage, el-table, el-input, el-button)
  - src/components/Exporter.vue
    - src/lib/export.ts
      - jszip, xlsx (external)
      - src/lib/types.ts
    - src/lib/storage.ts
    - element-plus (ElMessage, el-table, el-button)

Renders (top→bottom): page header "发票处理" + subtitle "仅在浏览器内完成处理" → PDF 预处理器 card → Gemini 语义提取 card → 导出 ZIP + Excel card.

## 设置 (Settings View)

Entry: `src/App.vue` (template block `v-show="activeTab === 'settings'"`)

Dependencies:
- src/App.vue
  - src/components/SettingsPanel.vue
    - src/lib/storage.ts
      - src/lib/types.ts
    - sortablejs (external)
    - element-plus (ElMessage, el-form, el-input, el-select, el-radio-group, el-button)

Renders: 设置 card with API Key textarea, model select + rename template builder (2-col on md+), Prompt template textarea, centered 保存设置 button (max 520px).
