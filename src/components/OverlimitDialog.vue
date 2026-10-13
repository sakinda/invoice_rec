<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { SplitInvoice } from '../lib/types'
import { condensePurposeShort } from '../lib/gemini'
import { getApiKeys, getModelId } from '../lib/storage'

const props = defineProps<{
  visible: boolean
  invoices: SplitInvoice[]
  currentIndex?: number
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'apply', invoiceId: string, resolvedShort: string): void
  (e: 'allResolved'): void
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (val: boolean) => emit('update:visible', val)
})

const localIndex = ref(0)

watch(
  () => props.currentIndex,
  (val) => {
    if (typeof val === 'number') {
      localIndex.value = Math.max(0, Math.min(val, (props.invoices?.length || 1) - 1))
    }
  },
  { immediate: true }
)

const currentInvoice = computed<SplitInvoice | null>(() => {
  if (!props.invoices || props.invoices.length === 0) return null
  return props.invoices[localIndex.value] ?? null
})

const currentExtract = computed(() => currentInvoice.value?.extract ?? null)

// 当前精简用途与字数
const currentText = computed(() => String(currentExtract.value?.purpose_short ?? '').trim())
const currentLen = computed(() => Array.from(currentText.value).length)

// 手动输入方案
const manualText = ref('')
const manualLen = computed(() => Array.from(manualText.value).length)

// AI 智能浓缩方案
const aiCondensedText = ref('')
const aiCondensedLen = computed(() => Array.from(aiCondensedText.value).length)
const aiLoading = ref(false)

// 选定的方案模式：'ai' | 'candidate' | 'manual' | 'keep_raw'
const selectedMode = ref<'ai' | 'candidate' | 'manual' | 'keep_raw'>('ai')
const selectedCandidateText = ref('')

// 当切换发票时，重置状态
watch(
  currentInvoice,
  (inv) => {
    if (!inv || !inv.extract) return
    manualText.value = inv.extract.purpose_short || ''
    aiCondensedText.value = ''
    selectedCandidateText.value = ''
    // 若有候选方案长度 <= 48，默认选择首个合规候选，否则默认 AI
    const candidates = inv.extract.purpose_short_candidates || []
    const firstValid = candidates.find(c => Array.from(c.trim()).length <= 48 && c.trim() !== inv.extract?.purpose_short?.trim())
    if (firstValid) {
      selectedCandidateText.value = firstValid
      selectedMode.value = 'candidate'
    } else {
      selectedMode.value = 'ai'
      generateAiCondense()
    }
  },
  { immediate: true }
)

async function generateAiCondense() {
  if (!currentInvoice.value || !currentExtract.value) return
  const keys = getApiKeys()
  if (keys.length === 0) {
    ElMessage.warning('未检测到 API Key，无法调用 AI 浓缩，可直接手动微调')
    return
  }

  aiLoading.value = true
  try {
    const res = await condensePurposeShort({
      apiKeys: keys,
      modelId: getModelId(),
      company: currentExtract.value.company_name,
      purpose: currentExtract.value.purpose,
      currentShort: currentExtract.value.purpose_short || ''
    })
    aiCondensedText.value = res
  } catch (err: any) {
    ElMessage.error(err?.message || '生成 AI 浓缩方案失败')
  } finally {
    aiLoading.value = false
  }
}

function selectCandidate(cand: string) {
  selectedCandidateText.value = cand
  selectedMode.value = 'candidate'
}

function selectManual() {
  selectedMode.value = 'manual'
}

function selectKeepRaw() {
  selectedMode.value = 'keep_raw'
}

function getFinalValue(): string {
  if (selectedMode.value === 'ai') {
    return aiCondensedText.value.trim() || currentText.value
  }
  if (selectedMode.value === 'candidate') {
    return selectedCandidateText.value.trim() || currentText.value
  }
  if (selectedMode.value === 'manual') {
    return manualText.value.trim()
  }
  return currentText.value
}

function applyCurrent() {
  if (!currentInvoice.value || !currentExtract.value) return
  const finalVal = getFinalValue()

  if (selectedMode.value !== 'keep_raw' && Array.from(finalVal).length > 48) {
    ElMessage.warning(`所选方案依然超过 48 个字符（当前 ${Array.from(finalVal).length} 字），请微调或选择“破例保留原样”`)
    return
  }

  currentExtract.value.purpose_short = finalVal
  emit('apply', currentInvoice.value.id, finalVal)
  ElMessage.success('已应用该修改方案')

  // 若有多笔，自动切到下一笔
  if (localIndex.value < (props.invoices?.length || 0) - 1) {
    localIndex.value++
  } else {
    emit('allResolved')
    dialogVisible.value = false
  }
}

function prevInvoice() {
  if (localIndex.value > 0) localIndex.value--
}

function nextInvoice() {
  if (localIndex.value < (props.invoices?.length || 0) - 1) localIndex.value++
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="精简用途超出 48 字符限制 - 协商修改方案"
    width="680px"
    destroy-on-close
    :close-on-click-modal="false"
  >
    <div v-if="currentInvoice && currentExtract" class="flex flex-col gap-4 text-xs">
      <!-- 多笔超限导航条 -->
      <div v-if="invoices.length > 1" class="flex items-center justify-between bg-blue-50/70 p-2.5 rounded-lg border border-blue-200">
        <span class="font-medium text-blue-900">
          共发现 {{ invoices.length }} 笔超限发票，当前为第 {{ localIndex + 1 }} 笔
        </span>
        <div class="flex items-center gap-2">
          <el-button size="small" :disabled="localIndex === 0" @click="prevInvoice">上一笔</el-button>
          <el-button size="small" :disabled="localIndex >= invoices.length - 1" @click="nextInvoice">下一笔</el-button>
        </div>
      </div>

      <!-- 发票基础信息 -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200 text-gray-700">
        <div>
          <span class="text-gray-400 block text-[11px]">公司名称</span>
          <span class="font-semibold">{{ currentExtract.company_name || '-' }}</span>
        </div>
        <div>
          <span class="text-gray-400 block text-[11px]">发票日期</span>
          <span class="font-semibold">{{ currentExtract.date || '-' }}</span>
        </div>
        <div>
          <span class="text-gray-400 block text-[11px]">发票号</span>
          <span class="font-semibold">{{ currentExtract.invoice_no || '-' }}</span>
        </div>
        <div>
          <span class="text-gray-400 block text-[11px]">总金额</span>
          <span class="font-semibold">{{ currentExtract.total_amount }} {{ currentExtract.currency }}</span>
        </div>
      </div>

      <!-- 当前超限内容展示 -->
      <div class="border border-rose-200 bg-rose-50/40 p-3 rounded-lg flex flex-col gap-1.5">
        <div class="flex items-center justify-between">
          <span class="font-semibold text-rose-800 flex items-center gap-1">
            <span>⚠️ 当前识别出的精简用途（未直接截断）</span>
          </span>
          <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-300">
            {{ currentLen }} / 48 字符 (超出 {{ currentLen - 48 }} 字)
          </span>
        </div>
        <div class="text-gray-800 bg-white p-2 rounded border border-rose-200 break-words font-mono text-[13px]">
          {{ currentText }}
        </div>
        <div class="text-[11px] text-gray-500">
          完整用途参考: {{ currentExtract.purpose }}
        </div>
      </div>

      <div class="font-semibold text-gray-700 text-sm mt-1">
        请选择处理方案：
      </div>

      <!-- 方案选择卡片列表 -->
      <div class="flex flex-col gap-2.5">
        <!-- 方案 1: AI 智能重新浓缩 -->
        <div
          class="border rounded-lg p-3 transition-colors cursor-pointer flex flex-col gap-2"
          :class="selectedMode === 'ai' ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200 hover:border-gray-300'"
          @click="selectedMode = 'ai'"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <input type="radio" :checked="selectedMode === 'ai'" name="plan_choice" class="cursor-pointer" />
              <span class="font-bold text-gray-800">方案一：AI 智能重新浓缩 (≤48 字符)</span>
              <el-tag size="small" type="success" effect="plain">推荐</el-tag>
            </div>
            <el-button size="small" link type="primary" :loading="aiLoading" @click.stop="generateAiCondense">
              重新生成
            </el-button>
          </div>

          <div v-if="aiCondensedText" class="flex items-center justify-between bg-white p-2 rounded border gap-2">
            <span class="break-words font-medium text-gray-800">{{ aiCondensedText }}</span>
            <span
              class="shrink-0 text-[11px] font-mono px-1.5 py-0.5 rounded"
              :class="aiCondensedLen <= 48 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'"
            >
              {{ aiCondensedLen }} / 48 字
            </span>
          </div>
          <div v-else-if="aiLoading" class="text-gray-400 py-2 text-center">
            Gemini 正在重新浓缩提炼中...
          </div>
          <div v-else class="text-gray-400">
            点击右侧按钮生成 AI 浓缩文本
          </div>
        </div>

        <!-- 方案 2: 从备选项中挑选 -->
        <div
          v-if="currentExtract.purpose_short_candidates && currentExtract.purpose_short_candidates.length > 0"
          class="border rounded-lg p-3 transition-colors flex flex-col gap-2"
          :class="selectedMode === 'candidate' ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200 hover:border-gray-300'"
          @click="selectedMode = 'candidate'"
        >
          <div class="flex items-center gap-2">
            <input type="radio" :checked="selectedMode === 'candidate'" name="plan_choice" class="cursor-pointer" />
            <span class="font-bold text-gray-800">方案二：从已有 AI 备选方案中选取</span>
          </div>

          <div class="flex flex-col gap-1.5 pl-6">
            <div
              v-for="(cand, cIdx) in currentExtract.purpose_short_candidates"
              :key="cIdx"
              class="p-2 rounded border bg-white flex items-center justify-between gap-2 cursor-pointer transition-colors"
              :class="selectedCandidateText === cand ? 'border-blue-400 bg-blue-50/60 font-semibold text-blue-900' : 'border-gray-200 hover:bg-gray-50'"
              @click.stop="selectCandidate(cand)"
            >
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <span class="text-gray-400 text-[11px]">备选{{ cIdx + 1 }}:</span>
                <span class="truncate">{{ cand }}</span>
              </div>
              <span
                class="shrink-0 text-[11px] font-mono px-1.5 py-0.5 rounded"
                :class="Array.from(cand).length <= 48 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'"
              >
                {{ Array.from(cand).length }} / 48 字
              </span>
            </div>
          </div>
        </div>

        <!-- 方案 3: 手动微调输入 -->
        <div
          class="border rounded-lg p-3 transition-colors flex flex-col gap-2"
          :class="selectedMode === 'manual' ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200 hover:border-gray-300'"
          @click="selectManual"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <input type="radio" :checked="selectedMode === 'manual'" name="plan_choice" class="cursor-pointer" />
              <span class="font-bold text-gray-800">方案三：手动微调输入</span>
            </div>
            <span
              class="text-[11px] font-mono font-semibold"
              :class="manualLen <= 48 ? 'text-emerald-700' : 'text-rose-600'"
            >
              实时字数: {{ manualLen }} / 48 字符
            </span>
          </div>
          <div class="pl-6">
            <el-input
              v-model="manualText"
              size="small"
              placeholder="请输入精简用途..."
              @focus="selectManual"
            />
          </div>
        </div>

        <!-- 方案 4: 破例保留原样 -->
        <div
          class="border rounded-lg p-3 transition-colors flex items-center justify-between"
          :class="selectedMode === 'keep_raw' ? 'border-amber-400 bg-amber-50/30' : 'border-gray-200 hover:border-gray-300'"
          @click="selectKeepRaw"
        >
          <div class="flex items-center gap-2">
            <input type="radio" :checked="selectedMode === 'keep_raw'" name="plan_choice" class="cursor-pointer" />
            <span class="font-bold text-gray-800">方案四：破例保留当前长文本原样</span>
            <span class="text-gray-400 text-[11px]">（直接放行，不截断也不修改）</span>
          </div>
          <span class="text-amber-700 font-mono text-[11px] font-medium">保留 {{ currentLen }} 字符</span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between">
        <span class="text-[11px] text-gray-400">已全面移除强制截断机制，您的选择将作为最终入库值</span>
        <div class="flex items-center gap-2">
          <el-button size="small" @click="dialogVisible = false">稍后处理</el-button>
          <el-button size="small" type="primary" @click="applyCurrent">应用所选方案</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>
