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
        <el-button type="primary" :disabled="busy" @click="confirmSplit">确认生成拆分 PDF</el-button>
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
        <div class="font-medium mb-1">逻辑分组 groups（0-based 原始页码索引）</div>
        <pre class="bg-[color:var(--rf-surface-low)] border rounded-[12px] p-3 overflow-auto text-xs font-medium">{{
          JSON.stringify(groups, null, 2)
        }}</pre>
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
        breakAfter: false,
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
    draggable: '[data-id]',
    onEnd: () => {
      const els = Array.from(sortableRoot.value?.querySelectorAll('[data-id]') ?? []) as HTMLElement[]
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
    p.breakAfter = false
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
