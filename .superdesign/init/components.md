# Shared Components

This project has **no custom UI-primitive directory**. All primitives (Button, Input, Table, Card, Select, Form, Tooltip, Radio, Message) come from **Element Plus** (full import in `src/main.ts`), themed via CSS variables in `src/styles.css`. The 4 components under `src/components/` are page-level feature components. Below: the Element Plus usage patterns + the 4 feature components (full source), since these are the only custom components in the repo.

## Element Plus primitives used (imported globally)

- `el-card` — `.rf-card` wrapper class (border + shadow + styled header)
- `el-button` (default / primary / danger plain / small / large) — styled in styles.css
- `el-table` / `el-table-column` — `.rf-table` wrapper (sticky uppercase headers, zebra, 12px radius)
- `el-input` (incl. textarea, clearable) — small size inside tables
- `el-form` / `el-form-item` — label-position top, uppercase 12px labels
- `el-select` / `el-option`
- `el-tooltip`
- `el-radio-group` / `el-radio-button`
- `ElMessage` (imperative toasts)

## Feature Components

### 1. PdfSplitter — `src/components/PdfSplitter.vue`
PDF preprocessor: multi-file import mode (each file = one invoice, deletable) OR single-PDF page-grouping mode (thumbnail grid, drag-sort, break/join per page gap, delete/restore, live group chips, split via pdf-lib).

```vue
<template>
  <el-card class="rf-card">
    <template #header>PDF 预处理器（拆分/排序/删除）</template>

    <div class="flex flex-col gap-4">
      <input ref="fileInput" class="hidden" type="file" multiple accept="application/pdf,.pdf" @change="onPickPdf" />

      <div class="rf-dropzone p-6 flex items-center justify-between gap-4">
        <div class="flex flex-col gap-1">
          <div class="text-sm font-medium">选择或从 iCloud 导入 PDF</div>
          <div class="text-xs text-[color:var(--rf-text-muted)]">建议先拆分为单发票，再进行语义提取</div>
        </div>
        <el-button type="primary" :disabled="busy" @click="openPicker">选择文件</el-button>
      </div>

      <div v-if="fileName" class="text-sm text-[color:var(--rf-text-muted)]">已选择：{{ fileName }}</div>

      <div v-if="fileItems.length > 0" class="flex flex-col gap-3">
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm font-medium">多文件模式</div>
          <div class="text-xs text-[color:var(--rf-text-muted)]">默认每个文件是一张独立发票（全部断开）</div>
        </div>

        <div class="border rounded-[12px] p-3 bg-[color:var(--rf-surface-low)] flex flex-col gap-2">
          <div
            v-for="it in fileItems"
            :key="it.id"
            class="flex items-center justify-between gap-3 border rounded-[12px] px-3 py-2 bg-white"
            :class="it.deleted ? 'opacity-40' : ''"
          >
            <div class="min-w-0">
              <div class="text-sm font-medium truncate">{{ it.file.name }}</div>
              <div class="text-xs text-[color:var(--rf-text-muted)]">按文件导入为单发票</div>
            </div>
            <el-button size="small" type="danger" plain @click="toggleFileDelete(it.id)">
              {{ it.deleted ? '恢复' : '删除' }}
            </el-button>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <el-button type="primary" :disabled="busy" @click="confirmSplit">确认导入 {{ activeFileCount }} 份发票</el-button>
          <el-button :disabled="busy" @click="resetAll">重置</el-button>
          <div class="text-xs text-[color:var(--rf-text-muted)]">可删除/恢复某些文件后再导入</div>
        </div>
      </div>

      <div v-else-if="pages.length" class="flex items-center gap-2">
        <el-button type="primary" :disabled="busy" @click="confirmSplit">拆分 PDF</el-button>
        <el-button :disabled="busy" @click="resetAll">重置</el-button>
        <div class="text-xs text-gray-500">拖拽页面可排序；点击“剪断/缝合”控制分组；点击“删除”丢入垃圾桶</div>
      </div>

      <div v-if="pages.length" class="border rounded-[12px] p-3 md:p-4 bg-[color:var(--rf-surface-low)]">
        <div ref="sortableRoot" class="rf-thumb-grid">
          <div
            v-for="p in pages"
            :key="p.id"
            class="rf-thumb-card border rounded-[12px] p-3 md:p-4 bg-white shadow-[0px_1px_2px_rgba(15,23,42,0.04)]"
            :class="p.deleted ? 'opacity-40' : ''"
            :data-id="p.id"
          >
            <div class="text-xs text-gray-700 mb-2 flex items-center justify-between">
              <span>Page {{ p.originalIndex + 1 }}</span>
              <el-button size="small" type="danger" plain @click="toggleDelete(p.id)">
                {{ p.deleted ? '恢复' : '删除' }}
              </el-button>
            </div>
            <div class="w-full">
              <img v-if="p.thumbUrl" :src="p.thumbUrl" class="w-full h-auto rounded-[8px]" />
              <div v-else class="w-full aspect-[3/4] bg-gray-100 animate-pulse rounded-[8px]"></div>
            </div>

            <div class="mt-2 flex items-center justify-between" v-if="p.isLast !== true">
              <el-button size="small" @click="toggleBreakAfter(p.id)">
                {{ p.breakAfter ? '缝合' : '剪断' }}
              </el-button>
              <div class="text-xs text-gray-500">{{ p.breakAfter ? '断开' : '连接' }}</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="pages.length" class="text-sm">
        <div class="flex items-center justify-between gap-3">
          <div class="font-medium">逻辑分组</div>
          <div class="text-xs text-[color:var(--rf-text-muted)]">{{ groupsSummary }}</div>
        </div>
        <div class="mt-2 flex gap-2 overflow-x-auto pb-1">
          <el-tooltip v-for="(g, idx) in groups" :key="idx" placement="top" :content="formatGroupFull(g)">
            <div class="px-3 py-2 rounded-full border bg-white text-xs font-medium whitespace-nowrap">
              组{{ idx + 1 }}: {{ formatGroupCompact(g) }}
            </div>
          </el-tooltip>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, computed } from 'vue'
import Sortable from 'sortablejs'
import { ElMessage } from 'element-plus'
import { loadPdfPageCount, renderPdfPageToCanvas, splitPdfByGroups } from '../lib/pdf'
import type { SplitInvoice } from '../lib/types'

function newId(): string {
  const c = (globalThis as any).crypto
  if (c?.randomUUID) return c.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function isPdfBytes(bytes: ArrayBuffer): boolean {
  const u8 = new Uint8Array(bytes.slice(0, 4))
  return u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46
}

type PageItem = {
  id: string
  originalIndex: number
  deleted: boolean
  breakAfter: boolean
  thumbUrl: string
  isLast?: boolean
}

const emit = defineEmits<{
  (e: 'split-ready', payload: { invoices: SplitInvoice[]; sourceName: string; pdfBytes?: ArrayBuffer }): void
}>()

const fileName = ref('')
const pdfBytes = ref<ArrayBuffer | null>(null)
const pages = ref<PageItem[]>([])
const busy = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

type FileItem = {
  id: string
  file: File
  deleted: boolean
}

const selectedFiles = ref<File[]>([])
const activeFileIndex = ref(0)
const fileItems = ref<FileItem[]>([])

const activeFileCount = computed(() => fileItems.value.filter(it => !it.deleted).length)

const sortableRoot = ref<HTMLElement | null>(null)
let sortable: any = null

const alivePageCount = computed(() => pages.value.filter((p: PageItem) => !p.deleted).length)

const groups = computed(() => {
  const alive = pages.value.filter((p: PageItem) => !p.deleted)
  const out: number[][] = []
  let cur: number[] = []
  for (let i = 0; i < alive.length; i++) {
    const p = alive[i]
    cur.push(p.originalIndex)
    const isLast = i === alive.length - 1
    if (p.breakAfter && !isLast) {
      out.push(cur)
      cur = []
    }
  }
  if (cur.length) out.push(cur)
  return out
})

const groupsSummary = computed(() => `${groups.value.length} 组 / ${alivePageCount.value} 页`)

function toRanges1Based(pages0: number[]): string {
  if (pages0.length === 0) return ''
  const pages1 = pages0.map(n => n + 1)
  const out: string[] = []
  let start = pages1[0]
  let prev = pages1[0]
  for (let i = 1; i < pages1.length; i++) {
    const cur = pages1[i]
    if (cur === prev + 1) {
      prev = cur
      continue
    }
    out.push(start === prev ? `${start}` : `${start}-${prev}`)
    start = cur
    prev = cur
  }
  out.push(start === prev ? `${start}` : `${start}-${prev}`)
  return out.join(',')
}

function formatGroupCompact(g: number[]): string {
  return toRanges1Based(g)
}

function formatGroupFull(g: number[]): string {
  return `页码(1-based): ${toRanges1Based(g)}`
}

async function loadFile(f: File, inputEl?: HTMLInputElement) {
  const name = (f.name ?? '').toLowerCase()
  const looksLikePdfByMeta = f.type === 'application/pdf' || f.type.includes('pdf') || name.endsWith('.pdf')
  if (!looksLikePdfByMeta) {
    ElMessage.error('请选择 PDF 文件')
    if (inputEl) inputEl.value = ''
    return
  }

  busy.value = true
  try {
    fileName.value = f.name
    pages.value = []
    pdfBytes.value = null

    const bytes = await f.arrayBuffer()

    if (!isPdfBytes(bytes)) {
      ElMessage.error('文件不是有效的 PDF')
      if (inputEl) inputEl.value = ''
      return
    }

    pdfBytes.value = bytes

    const n = await loadPdfPageCount(bytes)
    const list: PageItem[] = []
    for (let i = 0; i < n; i++) {
      list.push({
        id: newId(),
        originalIndex: i,
        deleted: false,
        breakAfter: true,
        thumbUrl: '',
        isLast: i === n - 1
      })
    }
    pages.value = list

    await nextTick()
    initSortable()
    await renderThumbs()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    ElMessage.error(msg || '处理 PDF 失败')
    pages.value = []
    pdfBytes.value = null
    fileName.value = ''
    if (inputEl) inputEl.value = ''
  } finally {
    busy.value = false
  }
}

async function onPickPdf(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (files.length === 0) return

  const pdfs = files.filter(f => {
    const n = (f.name ?? '').toLowerCase()
    return f.type === 'application/pdf' || f.type.includes('pdf') || n.endsWith('.pdf')
  })

  if (pdfs.length === 0) {
    ElMessage.error('请选择 PDF 文件')
    input.value = ''
    return
  }

  selectedFiles.value = pdfs
  activeFileIndex.value = 0

  if (pdfs.length === 1) {
    fileItems.value = []
    await loadFile(pdfs[0], input)
    input.value = ''
    return
  }

  fileName.value = ''
  pages.value = []
  pdfBytes.value = null
  fileItems.value = pdfs.map(f => ({ id: newId(), file: f, deleted: false }))
  input.value = ''
}

async function onActiveFileChange() {
  const f = selectedFiles.value[activeFileIndex.value]
  if (!f) return
  await loadFile(f)
}

function openPicker() {
  fileInput.value?.click()
}

function initSortable() {
  if (!sortableRoot.value) return
  sortable?.destroy()
  sortable = new Sortable(sortableRoot.value, {
    animation: 150,
    draggable: '.rf-thumb-card',
    onEnd: () => {
      const els = Array.from(sortableRoot.value?.querySelectorAll('.rf-thumb-card[data-id]') ?? []) as HTMLElement[]
      const ids = els.map(el => el.dataset.id ?? '')
      const map = new Map(pages.value.map((p: PageItem) => [p.id, p] as const))
      const next = ids.map(id => map.get(id)).filter(Boolean) as PageItem[]
      next.forEach((p: PageItem, idx: number) => (p.isLast = idx === next.length - 1))
      pages.value = next
    }
  })
}

async function renderThumbs() {
  const bytes = pdfBytes.value
  if (!bytes) return

  const w = window.innerWidth
  const cols = w > 1180 ? 5 : w > 500 ? 3 : 1
  const gapPx = w > 500 ? 16 : 12

  const containerWidth = sortableRoot.value?.clientWidth ?? w
  const cardCssWidth = Math.max(240, Math.floor((containerWidth - gapPx * (cols - 1)) / cols))

  const targetWidth = Math.min(720, cardCssWidth)
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1)

  for (const p of pages.value) {
    const canvas = await renderPdfPageToCanvas({
      pdfBytes: bytes,
      pageNumber1: p.originalIndex + 1,
      maxWidth: targetWidth,
      pixelRatio,
      maxRenderScale: 3
    })
    p.thumbUrl = canvas.toDataURL('image/png')
  }
}

function toggleBreakAfter(id: string) {
  const p = pages.value.find((x: PageItem) => x.id === id)
  if (!p) return
  p.breakAfter = !p.breakAfter
}

function toggleDelete(id: string) {
  const p = pages.value.find((x: PageItem) => x.id === id)
  if (!p) return
  p.deleted = !p.deleted
}

function resetAll() {
  if (fileItems.value.length > 0) {
    fileItems.value = fileItems.value.map(it => ({ ...it, deleted: false }))
    return
  }
  pages.value.forEach((p: PageItem) => {
    p.deleted = false
    p.breakAfter = true
  })
}

function toggleFileDelete(id: string) {
  const it = fileItems.value.find(x => x.id === id)
  if (!it) return
  it.deleted = !it.deleted
}

async function confirmSplit() {
  if (fileItems.value.length > 0) {
    const alive = fileItems.value.filter(it => !it.deleted)
    if (alive.length === 0) {
      ElMessage.error('没有可导入的文件')
      return
    }

    const invoices: SplitInvoice[] = alive.map((it, idx) => ({
      id: newId(),
      pagesOriginal: [idx],
      pdfBlob: it.file,
      filenameSuggested: it.file.name
    }))

    emit('split-ready', { invoices, sourceName: 'multiple' })
    ElMessage.success(`已导入 ${invoices.length} 份发票`)
    return
  }

  const bytes = pdfBytes.value
  if (!bytes) return
  if (!groups.value.length) {
    ElMessage.error('没有可生成的分组')
    return
  }

  busy.value = true
  try {
    const parts = await splitPdfByGroups({ pdfBytes: bytes, groups: groups.value })
    const invoices: SplitInvoice[] = parts.map((u8, idx) => {
      const copy = new Uint8Array(u8.byteLength)
      copy.set(u8)
      return {
        id: newId(),
        pagesOriginal: groups.value[idx],
        pdfBlob: new Blob([copy.buffer], { type: 'application/pdf' })
      }
    })
    emit('split-ready', { pdfBytes: bytes, invoices, sourceName: fileName.value || 'source.pdf' })
    ElMessage.success(`已生成 ${invoices.length} 份单发票 PDF`)
  } finally {
    busy.value = false
  }
}

onBeforeUnmount(() => {
  sortable?.destroy()
  sortable = null
})
</script>

<style scoped>
.rf-thumb-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

.rf-thumb-card {
  flex: 0 0 100%;
  max-width: 100%;
}

@media (min-width: 500px) {
  .rf-thumb-grid {
    gap: 16px;
  }

  .rf-thumb-card {
    flex-basis: calc((100% - 16px * 2) / 3);
    max-width: calc((100% - 16px * 2) / 3);
  }
}

@media (min-width: 1181px) {
  .rf-thumb-card {
    flex-basis: calc((100% - 16px * 4) / 5);
    max-width: calc((100% - 16px * 4) / 5);
  }
}
</style>
```

### 2. InvoiceProcessor — `src/components/InvoiceProcessor.vue`
Gemini semantic extraction: run button, multi-key rotation with rate-limit freezing, editable results table (company/date/amount/tva/purpose/purpose_short), per-row retry, status column.

```vue
<template>
  <el-card class="rf-card">
    <template #header>Gemini 语义提取</template>

    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <el-button type="primary" :disabled="busy || invoices.length === 0" @click="runExtract">开始识别</el-button>
        <div class="text-xs text-[color:var(--rf-text-muted)] flex-1">
          <span v-if="keyStatusMsg" class="text-[color:var(--rf-primary)]">{{ keyStatusMsg }}</span>
          <span v-else>按顺序轮替使用 API Key；失败会记录错误信息</span>
        </div>
      </div>

      <el-table class="rf-table" :data="invoices" size="small" border stripe table-layout="fixed" style="width: 100%">
        <el-table-column label="ID" width="110" class-name="rf-col-id">
          <template #default="{ row }">
            <span
              :title="row.id"
              class="font-mono tabular-nums"
            >…{{ (row.id ?? '').slice(-6) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="页" width="56" min-width="56" align="center" class-name="rf-col-pages" show-overflow-tooltip>
          <template #default="{ row }">{{ formatPages(row.pagesOriginal) }}</template>
        </el-table-column>
        <el-table-column label="公司" min-width="160">
          <template #default="{ row }">
            <el-input
              v-if="row.extract"
              v-model="row.extract.company_name"
              size="small"
              clearable
              placeholder="公司名称"
            />
            <span v-else class="text-gray-400">-</span>
          </template>
        </el-table-column>
        <el-table-column label="日期" width="130">
          <template #default="{ row }">
            <el-input
              v-if="row.extract"
              v-model="row.extract.date"
              size="small"
              clearable
              placeholder="YYYY-MM-DD"
            />
            <span v-else class="text-gray-400">-</span>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="110">
          <template #default="{ row }">
            <el-input
              v-if="row.extract"
              v-model="row.extract.total_amount"
              size="small"
              clearable
              placeholder="总金额"
            />
            <span v-else class="text-gray-400">-</span>
          </template>
        </el-table-column>
        <el-table-column label="税费" width="100">
          <template #default="{ row }">
            <el-input
              v-if="row.extract"
              v-model="row.extract.tva"
              size="small"
              clearable
              placeholder="TVA"
            />
            <span v-else class="text-gray-400">-</span>
          </template>
        </el-table-column>
        <el-table-column label="用途" min-width="200">
          <template #default="{ row }">
            <el-input
              v-if="row.extract"
              v-model="row.extract.purpose"
              size="small"
              clearable
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 3 }"
              placeholder="用途说明"
              @input="onPurposeEdit(row)"
            />
            <span v-else class="text-gray-400">-</span>
          </template>
        </el-table-column>
        <el-table-column label="用途(精简)" min-width="160">
          <template #default="{ row }">
            <el-input
              v-if="row.extract"
              v-model="(row.extract as any).purpose_short"
              size="small"
              clearable
              placeholder="用途精简(用于文件名)"
            />
            <span v-else class="text-gray-400">-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="300">
          <template #default="{ $index, row }">
            <div class="flex items-center justify-between gap-2 w-full">
              <span class="flex-1 min-w-0 truncate" :title="row.error">
                <span v-if="row.error" class="text-red-600">{{ row.error }}</span>
                <span v-else-if="row.extract" class="text-green-700">完成</span>
                <span v-else class="text-gray-600">待处理</span>
              </span>
              <el-button
                v-if="row.error || !row.extract"
                size="small"
                type="primary"
                plain
                :disabled="busy"
                @click="retryOne($index as number)"
              >
                {{ row.extract ? '重新识别' : '重试' }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { SplitInvoice } from '../lib/types'
import { extractInvoiceByGemini, GeminiApiError } from '../lib/gemini'
import { getApiKeys, getModelId, getPrompt } from '../lib/storage'

const props = defineProps<{
  invoices: SplitInvoice[]
}>()

const busy = ref(false)
const hasKeys = computed(() => getApiKeys().length > 0)
const keyStatusMsg = ref('')

const nextKeyIndex = ref(0)
const keyState = ref<Map<string, KeyState>>(new Map())

type KeyState = {
  nextAvailableAt: number
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function nowMs() {
  return Date.now()
}

function pickNextUsableKey(keys: string[], state: Map<string, KeyState>): string | null {
  if (keys.length === 0) return null

  const start = nextKeyIndex.value % keys.length
  for (let i = 0; i < keys.length; i++) {
    const idx = (start + i) % keys.length
    const k = keys[idx]
    const s = state.get(k)
    if (!s || s.nextAvailableAt <= nowMs()) {
      nextKeyIndex.value = idx + 1
      return k
    }
  }

  return null
}

async function waitUntilAnyKeyAvailable(keys: string[], state: Map<string, KeyState>) {
  const times = keys.map(k => state.get(k)?.nextAvailableAt ?? 0).filter(t => t > nowMs())
  if (times.length === 0) return
  const waitMs = Math.max(0, Math.min(...times) - nowMs())
  if (waitMs > 0) await sleep(waitMs)
}

function formatPages(pages0: number[]): string {
  if (!Array.isArray(pages0) || pages0.length === 0) return '-'
  const pages = pages0
    .slice()
    .sort((a, b) => a - b)
    .map(n => n + 1)

  const out: string[] = []
  let start = pages[0]
  let prev = pages[0]

  for (let i = 1; i < pages.length; i++) {
    const cur = pages[i]
    if (cur === prev + 1) {
      prev = cur
      continue
    }
    out.push(start === prev ? `${start}` : `${start}-${prev}`)
    start = cur
    prev = cur
  }

  out.push(start === prev ? `${start}` : `${start}-${prev}`)
  return out.join(',')
}

function onPurposeEdit(row: SplitInvoice) {
  if (!row.extract) return
  const edited = String(row.extract.purpose ?? '').trim()
  // 手动编辑用途后，同步覆盖 purpose_short，确保文件名优先使用人工输入值
  ;(row.extract as any).purpose_short = edited
}

async function extractOneInvoice(
  invoiceIndex: number,
  keys: string[],
  modelId: ReturnType<typeof getModelId>,
  prompt: string
) {
  const inv = props.invoices[invoiceIndex]
  if (!inv) return
  inv.error = undefined

  const state = keyState.value
  let lastErr: unknown = undefined

  for (let attempt = 0; attempt < keys.length; attempt++) {
    let apiKey = pickNextUsableKey(keys, state)
    if (!apiKey) {
      keyStatusMsg.value = `发票 ${invoiceIndex + 1}/${props.invoices.length}: 所有 API Key 均达上限，等待可用...`
      await waitUntilAnyKeyAvailable(keys, state)
      apiKey = pickNextUsableKey(keys, state)
    }
    if (!apiKey) {
      lastErr = new Error('没有可用的 API Key（均处于限流等待中）')
      break
    }

    const keyIndex = keys.indexOf(apiKey) + 1
    keyStatusMsg.value = `发票 ${invoiceIndex + 1}/${props.invoices.length}: 正在使用 API Key ${keyIndex}...`

    try {
      const ex = await extractInvoiceByGemini({ apiKey, modelId, prompt, pdfBlob: inv.pdfBlob })
      inv.extract = ex
      lastErr = undefined
      break
    } catch (e) {
      lastErr = e
      if (e instanceof GeminiApiError) {
        if (e.status === 429 && e.retryAfterSeconds && e.retryAfterSeconds > 0) {
          keyStatusMsg.value = `API Key ${keyIndex} 达上限，冻结 ${e.retryAfterSeconds}s，切换下一个...`
          state.set(apiKey, { nextAvailableAt: nowMs() + e.retryAfterSeconds * 1000 + 250 })
          continue
        }
        if (e.status === 429) {
          keyStatusMsg.value = `API Key ${keyIndex} 达上限，冻结 30s，切换下一个...`
          state.set(apiKey, { nextAvailableAt: nowMs() + 30_000 })
          continue
        }
        if (e.status >= 500 && e.status < 600) {
          keyStatusMsg.value = `API Key ${keyIndex} 服务端错误，暂时冻结，切换下一个...`
          state.set(apiKey, { nextAvailableAt: nowMs() + 3_000 })
          continue
        }
      }
      break
    }
  }

  if (lastErr) {
    inv.error = lastErr instanceof Error ? lastErr.message : String(lastErr)
  }
}

async function retryOne(index: number) {
  const keys = getApiKeys()
  if (keys.length === 0) {
    ElMessage.error('请先在设置中填写 API Key')
    return
  }
  if (!props.invoices[index]) return
  const modelId = getModelId()
  const prompt = getPrompt()
  busy.value = true
  try {
    await extractOneInvoice(index, keys, modelId, prompt)
    keyStatusMsg.value = '已完成该行重试'
  } finally {
    busy.value = false
    setTimeout(() => {
      if (!busy.value) keyStatusMsg.value = ''
    }, 2000)
  }
}

async function runExtract() {
  const keys = getApiKeys()
  if (keys.length === 0) {
    ElMessage.error('请先在设置中填写 API Key')
    return
  }
  if (props.invoices.length === 0) return

  busy.value = true
  try {
    const modelId = getModelId()
    const prompt = getPrompt()
    keyState.value = new Map<string, KeyState>()

    for (let i = 0; i < props.invoices.length; i++) {
      await extractOneInvoice(i, keys, modelId, prompt)
    }

    if (!hasKeys.value) return
    keyStatusMsg.value = '抽取流程已完成'
    ElMessage.success('抽取流程已完成')
  } finally {
    busy.value = false
    setTimeout(() => {
      if (!busy.value) keyStatusMsg.value = ''
    }, 3000)
  }
}

</script>

<style scoped>
@media (max-width: 640px) {
  :deep(.rf-col-id) {
    display: none;
  }

  :deep(th.rf-col-pages .cell),
  :deep(td.rf-col-pages .cell) {
    padding-left: 6px;
    padding-right: 6px;
    font-size: 12px;
  }
}
</style>
```

### 3. Exporter — `src/components/Exporter.vue`
Export ZIP + Excel: filename/col-8 preview table, download button.

```vue
<template>
  <el-card class="rf-card">
    <template #header>导出 ZIP + Excel</template>

    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <el-button type="primary" :disabled="invoices.length === 0" @click="doExport">导出 zip</el-button>
        <div class="text-xs text-[color:var(--rf-text-muted)]">包含 report.xlsx + pdfs/ 下的重命名 PDF</div>
      </div>

      <el-table class="rf-table" :data="previewRows" size="small" border stripe style="width: 100%">
        <el-table-column prop="name" label="文件名预览" />
        <el-table-column prop="col8" label="Excel 第 8 列预览" />
      </el-table>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { SplitInvoice } from '../lib/types'
import { applyRenameTemplate, buildExcelRows, exportZip } from '../lib/export'
import { getRenameTemplate } from '../lib/storage'

const props = defineProps<{
  invoices: SplitInvoice[]
}>()

const previewRows = computed(() => {
  const tpl = getRenameTemplate()
  const rows = buildExcelRows(props.invoices, tpl)
  return props.invoices.map((inv: SplitInvoice, idx: number) => ({
    name: applyRenameTemplate(tpl, inv),
    col8: rows[idx]?.[7] ?? ''
  }))
})

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function doExport() {
  const tpl = getRenameTemplate()
  const ok = props.invoices.filter((i: SplitInvoice) => i.extract && !i.error)
  if (ok.length === 0) {
    ElMessage.error('没有可导出的已抽取发票')
    return
  }
  const blob = await exportZip({ invoices: ok, renameTemplate: tpl })
  downloadBlob(blob, 'invoices_export.zip')
  ElMessage.success('已导出')
}
</script>
```

### 4. SettingsPanel — `src/components/SettingsPanel.vue`
Settings: API keys (CSV), model select, rename template token builder (draggable chips + separator radio), prompt template editor, save button.

```vue
<template>
  <el-card class="rf-card">
    <template #header>设置</template>

    <el-form label-position="top" class="rf-form">
      <div class="grid grid-cols-1 gap-4">
        <el-form-item label="API Key（多个用逗号分隔，自动轮替）">
          <el-input v-model="apiKeysCsv" type="textarea" :rows="3" placeholder="AIza...,AIza..." />
        </el-form-item>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <el-form-item label="模型">
            <el-select v-model="modelId" style="width: 100%">
              <el-option label="gemini-2.5-flash-lite" value="gemini-2.5-flash-lite" />
              <el-option label="gemini-3.0-flash-preview" value="gemini-3.0-flash-preview" />
            </el-select>
          </el-form-item>

          <el-form-item label="重命名模板">
            <div class="flex flex-col gap-3 w-full">
              <div class="flex items-center justify-between gap-3">
                <div class="text-xs text-[color:var(--rf-text-muted)]">点击添加，拖拽调整顺序</div>
                <el-radio-group v-model="separator" size="small">
                  <el-radio-button label="_">下划线</el-radio-button>
                  <el-radio-button label=" ">空格</el-radio-button>
                </el-radio-group>
              </div>

              <div class="flex flex-wrap gap-2">
                <button
                  v-for="t in availableTokens"
                  :key="t.key"
                  type="button"
                  class="px-3 py-2 rounded-full border bg-white text-xs font-semibold tracking-[-0.01em]"
                  :class="selectedTokenKeys.includes(t.key) ? 'opacity-50 cursor-not-allowed' : 'hover:border-[color:var(--rf-accent)]'"
                  :disabled="selectedTokenKeys.includes(t.key)"
                  @click="addToken(t.key)"
                >
                  {{ t.label }}
                </button>
              </div>

              <div class="border rounded-[12px] bg-[color:var(--rf-surface-low)] p-3">
                <div class="text-xs text-[color:var(--rf-text-muted)] mb-2">已选（可拖拽）</div>
                <div ref="selectedTokensRoot" class="flex flex-wrap gap-2">
                  <div
                    v-for="k in selectedTokenKeys"
                    :key="k"
                    class="px-3 py-2 rounded-full border bg-white text-xs font-semibold flex items-center gap-2"
                    :data-key="k"
                  >
                    <span class="cursor-move select-none">{{ tokenLabel(k) }}</span>
                    <button type="button" class="text-[color:var(--rf-text-muted)] hover:text-black" @click="removeToken(k)">
                      ×
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-between gap-3">
                <div class="text-xs text-[color:var(--rf-text-muted)] truncate">预览：{{ renameTpl }}</div>
                <el-button size="small" @click="resetRenameTpl">重置</el-button>
              </div>
            </div>
          </el-form-item>
        </div>

        <el-form-item label="Prompt 模板">
          <el-input v-model="prompt" type="textarea" :rows="12" />
        </el-form-item>

        <div class="border-t pt-4 mt-2 flex flex-col items-center gap-3">
          <el-button type="primary" size="large" style="width: min(520px, 100%)" @click="save">保存设置</el-button>
        </div>
      </div>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch, watchEffect } from 'vue'
import Sortable from 'sortablejs'
import { ElMessage } from 'element-plus'
import {
  getApiKeys,
  getModelId,
  getPrompt,
  getRenameTemplate,
  setApiKeys,
  setModelId,
  setPrompt,
  setRenameTemplate
} from '../lib/storage'
import type { GeminiModelId } from '../lib/types'

type TokenKey = 'date' | 'company' | 'amount' | 'invoice_no' | 'purpose_short' | 'currency'

const tokenMeta: Array<{ key: TokenKey; label: string; tpl: string }> = [
  { key: 'date', label: '日期', tpl: '{date}' },
  { key: 'company', label: '公司', tpl: '{company}' },
  { key: 'invoice_no', label: '发票号', tpl: '{invoice_no}' },
  { key: 'purpose_short', label: '用途(精简)', tpl: '{purpose_short}' },
  { key: 'amount', label: '金额', tpl: '{amount}' },
  { key: 'currency', label: '货币', tpl: '{currency}' }
]

const availableTokens = tokenMeta

function tokenLabel(k: TokenKey): string {
  return tokenMeta.find(t => t.key === k)?.label ?? k
}

function tokenTpl(k: TokenKey): string {
  return tokenMeta.find(t => t.key === k)?.tpl ?? `{${k}}`
}

function parseTemplate(tpl: string): { keys: TokenKey[]; sep: '_' | ' ' } {
  const sep: '_' | ' ' = tpl.includes('_') ? '_' : ' '
  const matches = Array.from(tpl.matchAll(/\{(date|company|invoice_no|purpose_short|amount|currency)\}/g)).map(
    m => m[1] as TokenKey
  )
  const uniq: TokenKey[] = []
  for (const k of matches) {
    if (!uniq.includes(k)) uniq.push(k)
  }
  if (uniq.length === 0) return { keys: ['date', 'company', 'invoice_no', 'purpose_short', 'amount', 'currency'], sep }
  return { keys: uniq, sep }
}

function buildTemplate(keys: TokenKey[], sep: '_' | ' '): string {
  const base = keys.map(k => tokenTpl(k)).join(sep)
  return base.endsWith('.pdf') ? base : `${base}.pdf`
}

const apiKeysCsv = ref('')
const prompt = ref('')
const renameTpl = ref('')
const modelId = ref<GeminiModelId>('gemini-2.5-flash-lite')

const separator = ref<'_' | ' '>('_')
const selectedTokenKeys = ref<TokenKey[]>(['date', 'company', 'invoice_no', 'purpose_short', 'amount', 'currency'])

const selectedTokensRoot = ref<HTMLElement | null>(null)
let sortable: any = null

watchEffect(() => {
  apiKeysCsv.value = getApiKeys().join(',')
  prompt.value = getPrompt()
  modelId.value = getModelId()

  const tpl = getRenameTemplate()
  renameTpl.value = tpl
  const parsed = parseTemplate(tpl)
  separator.value = parsed.sep
  selectedTokenKeys.value = parsed.keys
})

watch(
  [selectedTokenKeys, separator],
  () => {
    renameTpl.value = buildTemplate(selectedTokenKeys.value, separator.value)
  },
  { deep: true }
)

watch(
  () => selectedTokenKeys.value.length,
  async () => {
    await nextTick()
    initSortable()
  }
)

function initSortable() {
  if (!selectedTokensRoot.value) return
  sortable?.destroy()
  sortable = new Sortable(selectedTokensRoot.value, {
    animation: 150,
    draggable: '[data-key]',
    onEnd: () => {
      const els = Array.from(selectedTokensRoot.value?.querySelectorAll('[data-key]') ?? []) as HTMLElement[]
      const keys = els.map(el => (el.dataset.key ?? '') as TokenKey).filter(Boolean)
      selectedTokenKeys.value = keys
    }
  })
}

function addToken(k: TokenKey) {
  if (selectedTokenKeys.value.includes(k)) return
  selectedTokenKeys.value = [...selectedTokenKeys.value, k]
}

function removeToken(k: TokenKey) {
  selectedTokenKeys.value = selectedTokenKeys.value.filter(x => x !== k)
}

function resetRenameTpl() {
  selectedTokenKeys.value = ['date', 'company', 'invoice_no', 'purpose_short', 'amount', 'currency']
  separator.value = ' '
}

function save() {
  setApiKeys(apiKeysCsv.value)
  setPrompt(prompt.value)
  setRenameTemplate(renameTpl.value)
  setModelId(modelId.value)
  ElMessage.success('已保存')
}

onBeforeUnmount(() => {
  sortable?.destroy()
  sortable = null
})
</script>
```
