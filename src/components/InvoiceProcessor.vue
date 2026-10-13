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
        <el-table-column label="公司" min-width="170">
          <template #default="{ row }">
            <CandidateSelect
              v-if="row.extract"
              v-model="row.extract.company_name"
              :candidates="row.extract.company_name_candidates"
              placeholder="公司名称"
              :popover-width="280"
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
        <el-table-column label="用途" min-width="220">
          <template #default="{ row }">
            <CandidateSelect
              v-if="row.extract"
              v-model="row.extract.purpose"
              :candidates="row.extract.purpose_candidates"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 3 }"
              placeholder="用途说明"
              :popover-width="380"
              @input="onPurposeEdit(row)"
              @candidate-select="onPurposeCandidateSelect(row, $event)"
            />
            <span v-else class="text-gray-400">-</span>
          </template>
        </el-table-column>
        <el-table-column label="用途(精简)" min-width="190">
          <template #default="{ row }">
            <div class="flex flex-col gap-1 w-full">
              <CandidateSelect
                v-if="row.extract"
                v-model="(row.extract as any).purpose_short"
                :candidates="(row.extract as any).purpose_short_candidates"
                placeholder="用途精简(用于文件名)"
                :popover-width="320"
                :max-characters="48"
                @overlimit-click="openOverlimitDialog(row)"
              />
              <div
                v-if="row.extract && isPurposeShortOverlimit(row.extract.purpose_short)"
                class="flex items-center justify-between text-[11px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200"
              >
                <span>⚠️ 超过 48 字 ({{ Array.from(row.extract.purpose_short || '').length }}字)</span>
                <button
                  type="button"
                  class="text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer ml-1 shrink-0"
                  @click="openOverlimitDialog(row)"
                >
                  协商修改方案
                </button>
              </div>
              <span v-else-if="!row.extract" class="text-gray-400">-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="310">
          <template #default="{ $index, row }">
            <div class="flex items-center justify-between gap-2 w-full">
              <span class="flex-1 min-w-0 truncate" :title="row.error">
                <span v-if="row.error" class="text-red-600">{{ row.error }}</span>
                <span v-else-if="row.extract" class="text-green-700 flex items-center gap-1.5 flex-wrap">
                  <span>完成</span>
                  <span v-if="isRowModified(row)" class="text-amber-600 text-[11px] font-medium bg-amber-50 px-1 rounded border border-amber-200">
                    已修改
                  </span>
                </span>
                <span v-else class="text-gray-600">待处理</span>
              </span>

              <div class="flex items-center gap-1 shrink-0">
                <el-button
                  v-if="row.extract && isRowModified(row)"
                  size="small"
                  type="warning"
                  plain
                  @click="openExperienceDialog(row)"
                >
                  沉淀经验
                </el-button>
                <el-button
                  v-else-if="row.extract"
                  size="small"
                  link
                  type="info"
                  title="将当前提取内容沉淀为公司偏好经验"
                  @click="openExperienceDialog(row)"
                >
                  沉淀经验
                </el-button>

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
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 经验沉淀弹窗 -->
    <ExperienceDialog
      v-model:visible="expDialogVisible"
      :invoice="selectedInvoiceForExp"
      @saved="onExperienceSaved"
    />

    <!-- 精简用途超限协商弹窗 -->
    <OverlimitDialog
      v-model:visible="overlimitDialogVisible"
      :invoices="overlimitInvoices"
      :current-index="overlimitCurrentIndex"
      @apply="onOverlimitResolved"
    />
  </el-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { SplitInvoice } from '../lib/types'
import { extractInvoiceByGemini, executeWithKeyRotation, resetGlobalKeyState } from '../lib/gemini'
import { getApiKeys, getEffectivePrompt, getModelId } from '../lib/storage'
import ExperienceDialog from './ExperienceDialog.vue'
import OverlimitDialog from './OverlimitDialog.vue'
import CandidateSelect from './CandidateSelect.vue'

const props = defineProps<{
  invoices: SplitInvoice[]
}>()

const busy = ref(false)
const hasKeys = computed(() => getApiKeys().length > 0)
const keyStatusMsg = ref('')

const expDialogVisible = ref(false)
const selectedInvoiceForExp = ref<SplitInvoice | null>(null)

const overlimitDialogVisible = ref(false)
const overlimitInvoices = ref<SplitInvoice[]>([])
const overlimitCurrentIndex = ref(0)

function isPurposeShortOverlimit(text?: string): boolean {
  if (!text) return false
  return Array.from(String(text).trim()).length > 48
}

function openOverlimitDialog(row: SplitInvoice) {
  overlimitInvoices.value = [row]
  overlimitCurrentIndex.value = 0
  overlimitDialogVisible.value = true
}

function onOverlimitResolved(invId: string, finalVal: string) {
  const target = props.invoices.find(inv => inv.id === invId)
  if (target && target.extract) {
    ;(target.extract as any).purpose_short = finalVal
  }
}

function isRowModified(row: SplitInvoice): boolean {
  if (!row.extract || !row.rawExtract) return false
  const cNow = String(row.extract.company_name ?? '').trim()
  const cOrig = String(row.rawExtract.company_name ?? '').trim()
  const pNow = String(row.extract.purpose ?? '').trim()
  const pOrig = String(row.rawExtract.purpose ?? '').trim()
  const sNow = String((row.extract as any).purpose_short ?? '').trim()
  const sOrig = String((row.rawExtract as any).purpose_short ?? '').trim()
  return (
    (cNow !== cOrig || pNow !== pOrig || sNow !== sOrig) &&
    (cNow.length > 0 || pNow.length > 0 || sNow.length > 0)
  )
}

function onPurposeCandidateSelect(row: SplitInvoice, cand: string) {
  if (!row.extract) return
  onPurposeEdit(row)
}

function openExperienceDialog(row: SplitInvoice) {
  selectedInvoiceForExp.value = row
  expDialogVisible.value = true
}

function onExperienceSaved() {
  // 规则保存后，更新当前行原始快照为当前修改值，避免重复提示已修改
  if (selectedInvoiceForExp.value?.extract) {
    selectedInvoiceForExp.value.rawExtract = { ...selectedInvoiceForExp.value.extract }
  }
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

  try {
    const ex = await executeWithKeyRotation({
      keys,
      actionName: `发票 ${invoiceIndex + 1}/${props.invoices.length}`,
      onStatusChange: (msg) => {
        keyStatusMsg.value = msg
      },
      fn: (apiKey) => extractInvoiceByGemini({ apiKey, modelId, prompt, pdfBlob: inv.pdfBlob })
    })
    inv.extract = ex
    inv.rawExtract = { ...ex }
  } catch (e: any) {
    inv.error = e instanceof Error ? e.message : String(e)
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
  const prompt = getEffectivePrompt()
  busy.value = true
  try {
    await extractOneInvoice(index, keys, modelId, prompt)
    keyStatusMsg.value = '已完成该行重试'
    const inv = props.invoices[index]
    if (inv?.extract && isPurposeShortOverlimit(inv.extract.purpose_short)) {
      openOverlimitDialog(inv)
      ElMessage.warning('检测到精简用途超过 48 个字符，已为您弹出协商修改方案。')
    }
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
    const prompt = getEffectivePrompt()
    resetGlobalKeyState()

    for (let i = 0; i < props.invoices.length; i++) {
      await extractOneInvoice(i, keys, modelId, prompt)
    }

    if (!hasKeys.value) return
    keyStatusMsg.value = '抽取流程已完成'
    ElMessage.success('抽取流程已完成')

    const overlimitList = props.invoices.filter(
      inv => inv.extract && isPurposeShortOverlimit(inv.extract.purpose_short)
    )
    if (overlimitList.length > 0) {
      overlimitInvoices.value = overlimitList
      overlimitCurrentIndex.value = 0
      overlimitDialogVisible.value = true
      ElMessage.warning(`检测到 ${overlimitList.length} 张发票的精简用途超过 48 个字符，已为您弹出协商修改方案。`)
    }
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
