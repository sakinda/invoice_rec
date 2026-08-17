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
