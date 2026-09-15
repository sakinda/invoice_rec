<template>
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="800px"
    destroy-on-close
    :close-on-click-modal="false"
    class="rf-import-wizard"
  >
    <!-- 步骤指示器 -->
    <div class="mb-4">
      <el-steps :active="currentStep - 1" finish-status="success" simple size="small">
        <el-step title="1. 勾选条目" />
        <el-step title="2. 智能融合" />
        <el-step title="3. 审查与批准" />
      </el-steps>
    </div>

    <!-- 步骤 1：文件解析与条目初选 -->
    <div v-if="currentStep === 1" class="flex flex-col gap-3">
      <div class="flex items-center justify-between text-xs bg-[color:var(--rf-surface-low)] p-2.5 rounded border">
        <div>
          共从文件中解析到 <span class="font-bold text-gray-800">{{ incomingRules.length }}</span> 条规则，
          已选 <span class="font-bold text-[color:var(--rf-primary)]">{{ selectedCount }}</span> 条
        </div>
        <div class="flex items-center gap-2">
          <el-checkbox
            :model-value="isAllSelected"
            :indeterminate="isIndeterminate"
            @change="toggleSelectAll"
          >
            全选 (默认全局导入)
          </el-checkbox>
        </div>
      </div>

      <!-- 待选规则列表 -->
      <div class="max-h-[420px] overflow-y-auto flex flex-col gap-2 pr-1">
        <div
          v-for="r in incomingRules"
          :key="r.id"
          class="border rounded-lg p-2.5 bg-white hover:border-gray-400 transition-colors flex items-start gap-3"
          :class="selectedIds.has(r.id) ? 'border-[color:var(--rf-accent)] bg-blue-50/20' : 'opacity-70'"
        >
          <el-checkbox
            :model-value="selectedIds.has(r.id)"
            class="mt-0.5"
            @change="toggleRowSelect(r.id)"
          />
          <div class="flex-1 min-w-0 flex flex-col gap-1 text-xs">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-bold text-sm text-gray-800">{{ r.company }}</span>
                <el-tag
                  v-for="a in r.aliases || []"
                  :key="a"
                  size="small"
                  type="info"
                  effect="plain"
                >
                  {{ a }}
                </el-tag>
                <el-tag v-if="hasLocalMatch(r.company)" size="small" type="warning" effect="light">
                  本地已有记录
                </el-tag>
                <el-tag v-else size="small" type="success" effect="light">
                  新公司
                </el-tag>
              </div>
              <span class="text-[11px] text-gray-400">{{ formatDate(r.updatedAt) }}</span>
            </div>

            <div class="text-gray-600 truncate" :title="r.rule">
              <span class="text-gray-400">用途: </span>{{ r.rule }}
            </div>
            <div v-if="r.purpose_short_rule" class="text-gray-500 truncate">
              <span class="text-gray-400">精简: </span>{{ r.purpose_short_rule }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 步骤 2：AI 正在比对处理 -->
    <div
      v-else-if="currentStep === 2"
      v-loading="true"
      :element-loading-text="processingStatusMsg || 'Gemini 正在全量语义对齐公司实体，并智能融合新旧规则差异...'"
      class="py-16 flex flex-col items-center justify-center gap-3 text-center"
    >
      <div class="text-xs text-gray-400 mt-2">
        系统正在比对已选条目与本地全部条目，如有同名或语义相同公司将自动拟定合并方案
      </div>
    </div>

    <!-- 步骤 3：结果审查与放行批准界面 -->
    <div v-else-if="currentStep === 3" class="flex flex-col gap-3">
      <!-- 汇总状态卡片与筛选 -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-[color:var(--rf-surface-low)] p-2.5 rounded border text-xs">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-medium text-gray-700">比对结果：</span>
          <el-tag size="small" type="warning" effect="light">
            待合并: {{ mergedList.length }} 条
          </el-tag>
          <el-tag size="small" type="success" effect="light">
            全新公司: {{ newList.length }} 条
          </el-tag>
          <el-tag size="small" type="info" effect="plain">
            内容一致: {{ identicalList.length }} 条
          </el-tag>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-gray-500">已批准放行: <b>{{ approvedCount }}</b> / {{ reconciledItems.length }} 条</span>
          <el-button size="small" link type="primary" @click="setAllApproved(true)">全选批准</el-button>
          <el-button size="small" link type="info" @click="setAllApproved(false)">全不选</el-button>
        </div>
      </div>

      <!-- 审查列表展示 -->
      <div class="max-h-[460px] overflow-y-auto flex flex-col gap-3 pr-1">
        <div
          v-for="item in reconciledItems"
          :key="item.id"
          class="border rounded-lg p-3 bg-white transition-all flex flex-col gap-2.5 shadow-xs"
          :class="item.type === 'merged' ? 'border-amber-300 bg-amber-50/10' : item.type === 'new' ? 'border-green-200' : 'border-gray-200'"
        >
          <!-- 头部信息 -->
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2">
              <el-checkbox v-model="item.approved">
                <span class="font-bold text-sm text-gray-800">{{ item.company }}</span>
              </el-checkbox>

              <el-tag v-if="item.type === 'merged'" size="small" type="warning" effect="dark">
                智能合并
              </el-tag>
              <el-tag v-else-if="item.type === 'new'" size="small" type="success" effect="light">
                全新公司
              </el-tag>
              <el-tag v-else size="small" type="info" effect="plain">
                两端一致
              </el-tag>

              <el-tag
                v-for="a in item.aliases || []"
                :key="a"
                size="small"
                type="info"
                effect="plain"
              >
                {{ a }}
              </el-tag>
            </div>

            <div class="text-[11px] text-gray-400">
              {{ item.approved ? '已批准放行' : '未放行(不导入)' }}
            </div>
          </div>

          <!-- 若发生合并冲突：展示新旧双版本对照 -->
          <div v-if="item.type === 'merged'" class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <!-- 本地版本 -->
            <div class="p-2 rounded bg-gray-50 border border-gray-200 flex flex-col gap-1">
              <div class="flex items-center justify-between text-gray-500 font-semibold text-[11px]">
                <span>【当前设备·本地旧版】</span>
                <span>{{ formatDate(item.localRule?.updatedAt) }}</span>
              </div>
              <div class="text-gray-800 break-words">
                <span class="text-gray-400">用途: </span>{{ item.localRule?.rule }}
              </div>
              <div v-if="item.localRule?.purpose_short_rule" class="text-gray-600">
                <span class="text-gray-400">精简: </span>{{ item.localRule?.purpose_short_rule }}
              </div>
            </div>

            <!-- 导入文件版本 -->
            <div class="p-2 rounded bg-blue-50/40 border border-blue-200 flex flex-col gap-1">
              <div class="flex items-center justify-between text-blue-700 font-semibold text-[11px]">
                <span>【导入文件·新版本】</span>
                <span>{{ formatDate(item.importedRule.updatedAt) }}</span>
              </div>
              <div class="text-gray-800 break-words">
                <span class="text-gray-400">用途: </span>{{ item.importedRule.rule }}
              </div>
              <div v-if="item.importedRule.purpose_short_rule" class="text-gray-600">
                <span class="text-gray-400">精简: </span>{{ item.importedRule.purpose_short_rule }}
              </div>
            </div>
          </div>

          <!-- 决策策略选择（针对合并项） -->
          <div v-if="item.type === 'merged'" class="flex flex-col gap-2 pt-1 border-t border-dashed">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="text-xs font-semibold text-gray-700">采纳策略：</div>
              <el-radio-group v-model="item.selectedStrategy" size="small" @change="onStrategyChange(item)">
                <el-radio-button label="ai_merged">AI 智能融合版</el-radio-button>
                <el-radio-button label="keep_local">仅保留本地版</el-radio-button>
                <el-radio-button label="take_imported">完全采用导入版</el-radio-button>
              </el-radio-group>
            </div>

            <!-- AI 融合原因说明 -->
            <div v-if="item.suggestedRule.explanation && item.selectedStrategy === 'ai_merged'" class="text-[11px] bg-amber-50 text-amber-900 p-1.5 rounded border border-amber-200 flex items-center gap-1.5">
              <span>💡 <b>融合建议:</b> {{ item.suggestedRule.explanation }}</span>
            </div>

            <!-- 最终写入规则（可实时手动编辑） -->
            <div v-if="item.selectedStrategy === 'ai_merged'" class="flex flex-col gap-1.5 bg-gray-50/80 p-2 rounded border">
              <div class="text-[11px] font-medium text-gray-600">最终用途规范 (可直接手动微调)：</div>
              <el-input
                v-model="item.customRuleText"
                size="small"
                type="textarea"
                :rows="2"
                placeholder="融合后的用途规则..."
              />
              <div class="flex items-center gap-2 mt-1">
                <span class="text-[11px] text-gray-500 shrink-0">精简用途:</span>
                <el-input
                  v-model="item.customShortRuleText"
                  size="small"
                  placeholder="融合后的精简用途..."
                />
              </div>
            </div>
          </div>

          <!-- 若为全新公司条目 -->
          <div v-else-if="item.type === 'new'" class="text-xs bg-gray-50 p-2 rounded border flex flex-col gap-1">
            <div class="text-gray-800 break-words">
              <span class="text-gray-400">用途: </span>{{ item.importedRule.rule }}
            </div>
            <div v-if="item.importedRule.purpose_short_rule" class="text-gray-600">
              <span class="text-gray-400">精简: </span>{{ item.importedRule.purpose_short_rule }}
            </div>
          </div>

          <!-- 若为两端完全一致条目 -->
          <div v-else class="text-xs text-gray-500 bg-gray-50 p-1.5 rounded">
            两端规则完全一致，无需改动。
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作按钮 -->
    <template #footer>
      <div class="flex items-center justify-between gap-2">
        <el-button
          v-if="currentStep === 3"
          size="small"
          @click="currentStep = 1"
        >
          上一步：重选条目
        </el-button>
        <span v-else></span>

        <div class="flex items-center gap-2">
          <el-button size="small" @click="dialogVisible = false">取消</el-button>

          <!-- 步骤 1 -> 步骤 2/3 -->
          <el-button
            v-if="currentStep === 1"
            size="small"
            type="primary"
            :disabled="selectedCount === 0"
            @click="startAiReconcile"
          >
            下一步：AI 智能比对与合并 (已选 {{ selectedCount }} 条)
          </el-button>

          <!-- 步骤 3 完成入库 -->
          <el-button
            v-if="currentStep === 3"
            size="small"
            type="primary"
            :disabled="approvedCount === 0"
            @click="executeApproval"
          >
            一键批准并入库 (放行 {{ approvedCount }} 条)
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { CompanyPreferenceRule, ReconciledRuleItem } from '../lib/types'
import { batchReconcileRules } from '../lib/gemini'
import {
  applyApprovedImportRules,
  getApiKeys,
  getCompanyRules,
  getModelId,
  parseImportRules
} from '../lib/storage'

const props = defineProps<{
  visible: boolean
  jsonContent: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'applied', result: { updatedCount: number; newCount: number; untouchedCount: number }): void
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v)
})

const currentStep = ref<1 | 2 | 3>(1)
const incomingRules = ref<CompanyPreferenceRule[]>([])
const selectedIds = ref<Set<string>>(new Set())
const processingStatusMsg = ref('')
const reconciledItems = ref<ReconciledRuleItem[]>([])

const dialogTitle = computed(() => {
  if (currentStep.value === 1) return '导入规则 (步骤 1/3：选择待导入条目)'
  if (currentStep.value === 2) return '导入规则 (步骤 2/3：AI 智能比对与合并中)'
  return '导入规则 (步骤 3/3：审查与批准)'
})

const selectedCount = computed(() => selectedIds.value.size)
const isAllSelected = computed(
  () => incomingRules.value.length > 0 && selectedIds.value.size === incomingRules.value.length
)
const isIndeterminate = computed(
  () => selectedIds.value.size > 0 && selectedIds.value.size < incomingRules.value.length
)

const mergedList = computed(() => reconciledItems.value.filter(it => it.type === 'merged'))
const newList = computed(() => reconciledItems.value.filter(it => it.type === 'new'))
const identicalList = computed(() => reconciledItems.value.filter(it => it.type === 'identical'))
const approvedCount = computed(() => reconciledItems.value.filter(it => it.approved).length)

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      initWizard()
    }
  }
)

function initWizard() {
  currentStep.value = 1
  processingStatusMsg.value = ''
  reconciledItems.value = []

  const parsed = parseImportRules(props.jsonContent)
  if (!parsed.success) {
    ElMessage.error(parsed.error || '文件解析失败')
    dialogVisible.value = false
    return
  }

  incomingRules.value = parsed.rules
  // 默认全局全选
  selectedIds.value = new Set(parsed.rules.map(r => r.id))
}

function hasLocalMatch(company: string): boolean {
  const local = getCompanyRules()
  const lower = company.trim().toLowerCase()
  return local.some(
    r => r.company.toLowerCase() === lower || r.aliases?.some(a => a.toLowerCase() === lower)
  )
}

function formatDate(ts?: number) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toggleSelectAll(val: any) {
  if (val) {
    selectedIds.value = new Set(incomingRules.value.map(r => r.id))
  } else {
    selectedIds.value = new Set()
  }
}

function toggleRowSelect(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedIds.value = next
}

function onStrategyChange(item: ReconciledRuleItem) {
  if (item.selectedStrategy === 'keep_local') {
    item.customRuleText = item.localRule?.rule || ''
    item.customShortRuleText = item.localRule?.purpose_short_rule || ''
  } else if (item.selectedStrategy === 'take_imported') {
    item.customRuleText = item.importedRule.rule
    item.customShortRuleText = item.importedRule.purpose_short_rule || ''
  } else {
    item.customRuleText = item.suggestedRule.rule
    item.customShortRuleText = item.suggestedRule.purpose_short_rule || ''
  }
}

function setAllApproved(val: boolean) {
  for (const it of reconciledItems.value) {
    it.approved = val
  }
}

async function startAiReconcile() {
  const picked = incomingRules.value.filter(r => selectedIds.value.has(r.id))
  if (picked.length === 0) {
    ElMessage.warning('请先勾选需要导入的规则条目')
    return
  }

  currentStep.value = 2
  processingStatusMsg.value = ''

  try {
    const keys = getApiKeys()
    const modelId = getModelId()
    const localRules = getCompanyRules()

    const results = await batchReconcileRules({
      apiKeys: keys,
      modelId,
      importedRules: picked,
      localRules,
      onStatusChange: (msg) => {
        processingStatusMsg.value = msg
      }
    })

    reconciledItems.value = results
    currentStep.value = 3
  } catch (err: any) {
    console.error('Reconciliation error:', err)
    ElMessage.error(err?.message || '智能比对失败')
    currentStep.value = 1
  }
}

function executeApproval() {
  const toApply = reconciledItems.value.filter(it => it.approved)
  if (toApply.length === 0) {
    ElMessage.warning('尚未批准任何条目')
    return
  }

  const result = applyApprovedImportRules(reconciledItems.value)
  dialogVisible.value = false
  emit('applied', result)
}
</script>

<style scoped>
:deep(.el-step__title) {
  font-size: 12px;
}
</style>

