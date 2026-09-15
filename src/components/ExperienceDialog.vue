<template>
  <el-dialog
    v-model="dialogVisible"
    title="沉淀为经验偏好 (Skill)"
    width="640px"
    destroy-on-close
    :close-on-click-modal="false"
  >
    <div
      v-loading="loading"
      :element-loading-text="keyStatusMsg || 'Gemini 正在分析修改意图并提炼/融合规则...'"
      class="flex flex-col gap-4"
    >
      <!-- 变动比对区 -->
      <div class="bg-[color:var(--rf-surface-low)] rounded-lg p-3 text-xs flex flex-col gap-2 border">
        <div class="flex items-center justify-between">
          <span class="font-semibold text-gray-700">开票公司：{{ companyName || '未识别' }}</span>
          <el-tag v-if="hasExistingRule" size="small" type="warning" effect="light">已融合既有历史规则</el-tag>
          <el-tag v-else size="small" type="success" effect="light">新公司首次沉淀</el-tag>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
          <div class="p-2 rounded bg-white border">
            <div class="text-[11px] text-gray-400 mb-1 font-medium">大模型初始输出</div>
            <div class="text-gray-600 line-through text-[12px] break-words">
              {{ originalPurpose || '（空）' }}
            </div>
            <div v-if="originalShort" class="text-gray-400 text-[11px] mt-1">
              精简: {{ originalShort }}
            </div>
          </div>

          <div class="p-2 rounded bg-green-50/60 border border-green-200">
            <div class="text-[11px] text-green-700 mb-1 font-medium">你的手动修改</div>
            <div class="text-green-900 font-medium text-[12px] break-words">
              {{ userPurpose || '（未修改）' }}
            </div>
            <div v-if="userShort" class="text-green-700 text-[11px] mt-1">
              精简: {{ userShort }}
            </div>
          </div>
        </div>
      </div>

      <!-- 提炼说明解释 -->
      <div v-if="explanation" class="text-xs bg-blue-50 text-blue-800 p-2.5 rounded border border-blue-200 flex items-start gap-2">
        <span class="font-bold shrink-0">💡 提炼要点:</span>
        <span class="flex-1">{{ explanation }}</span>
      </div>

      <!-- 提炼结果可编辑表单 -->
      <el-form label-position="top" size="small" class="flex flex-col gap-2">
        <el-form-item label="开票公司名称">
          <el-input v-model="formCompany" placeholder="公司主体名称" />
        </el-form-item>

        <el-form-item label="别名 / 常见变体 (多个用逗号隔开)">
          <el-input v-model="formAliasesStr" placeholder="例如：Total Energies, TOTALENERGIES SE" />
        </el-form-item>

        <el-form-item label="用途(purpose)提炼规则">
          <el-input
            v-model="formRule"
            type="textarea"
            :rows="3"
            placeholder="例如：统一输出格式为 '电 Electricite YYYY-MM'，其中 YYYY-MM 为账单所属年月"
          />
        </el-form-item>

        <el-form-item label="精简用途(purpose_short)规则 (用于文件名，建议简短)">
          <el-input
            v-model="formShortRule"
            placeholder="例如：电费 YYYY-MM（不超过14汉字）"
          />
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <div class="flex items-center justify-between gap-2">
        <el-button size="small" :disabled="loading" @click="doDistill">
          重新提炼
        </el-button>
        <div class="flex items-center gap-2">
          <el-button size="small" @click="dialogVisible = false">取消</el-button>
          <el-button size="small" type="primary" :loading="loading" @click="saveRule">
            保存到经验库
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { SplitInvoice } from '../lib/types'
import { distillExperienceRule } from '../lib/gemini'
import { getApiKeys, getCompanyRules, getModelId, upsertCompanyRule } from '../lib/storage'

const props = defineProps<{
  visible: boolean
  invoice: SplitInvoice | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'saved'): void
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v)
})

const loading = ref(false)
const companyName = ref('')
const originalPurpose = ref('')
const originalShort = ref('')
const userPurpose = ref('')
const userShort = ref('')
const explanation = ref('')

const formCompany = ref('')
const formAliasesStr = ref('')
const formRule = ref('')
const formShortRule = ref('')
const hasExistingRule = ref(false)
const existingRuleObj = ref<any>(null)

watch(
  () => props.visible,
  async (newVal) => {
    if (newVal && props.invoice?.extract) {
      initAndDistill()
    }
  }
)

async function initAndDistill() {
  const inv = props.invoice
  if (!inv || !inv.extract) return

  companyName.value = inv.extract.company_name || ''
  originalPurpose.value = inv.rawExtract?.purpose ?? ''
  originalShort.value = (inv.rawExtract as any)?.purpose_short ?? ''
  userPurpose.value = inv.extract.purpose ?? ''
  userShort.value = (inv.extract as any)?.purpose_short ?? ''

  formCompany.value = companyName.value
  explanation.value = ''

  // 检查是否已有该公司规则
  const allRules = getCompanyRules()
  const matched = allRules.find(
    (r) =>
      r.company.toLowerCase() === companyName.value.toLowerCase() ||
      r.aliases?.some((a) => a.toLowerCase() === companyName.value.toLowerCase())
  )

  if (matched) {
    hasExistingRule.value = true
    existingRuleObj.value = matched
    formAliasesStr.value = (matched.aliases || []).join(', ')
    formRule.value = matched.rule
    formShortRule.value = matched.purpose_short_rule || ''
  } else {
    hasExistingRule.value = false
    existingRuleObj.value = null
    formAliasesStr.value = ''
    formRule.value = ''
    formShortRule.value = ''
  }

  await doDistill()
}

const keyStatusMsg = ref('')

async function doDistill() {
  const keys = getApiKeys()
  if (keys.length === 0) {
    ElMessage.warning('尚未配置 Gemini API Key，已填入基础草稿供手动编辑')
    formRule.value = formRule.value || `用途固定格式为：${userPurpose.value || originalPurpose.value}`
    formShortRule.value = formShortRule.value || userShort.value || originalShort.value
    return
  }

  loading.value = true
  keyStatusMsg.value = ''
  try {
    const modelId = getModelId()
    const res = await distillExperienceRule({
      apiKeys: keys,
      modelId,
      company: formCompany.value || companyName.value,
      originalPurpose: originalPurpose.value,
      userPurpose: userPurpose.value,
      originalShort: originalShort.value,
      userShort: userShort.value,
      date: props.invoice?.extract?.date,
      invoiceNo: props.invoice?.extract?.invoice_no,
      existingRule: existingRuleObj.value
        ? {
            rule: existingRuleObj.value.rule,
            purpose_short_rule: existingRuleObj.value.purpose_short_rule,
            aliases: existingRuleObj.value.aliases
          }
        : undefined,
      onStatusChange: (msg) => {
        keyStatusMsg.value = msg
      }
    })

    formCompany.value = res.company || formCompany.value
    if (res.aliases && res.aliases.length > 0) {
      formAliasesStr.value = res.aliases.join(', ')
    }
    formRule.value = res.rule
    formShortRule.value = res.purpose_short_rule
    explanation.value = res.explanation
  } catch (err: any) {
    console.error('Distill error:', err)
    ElMessage.error(err?.message || '提炼规则失败，请手动修改表单内容')
    if (!formRule.value) {
      formRule.value = `用途固定格式为：${userPurpose.value || originalPurpose.value}`
    }
    if (!formShortRule.value && userShort.value) {
      formShortRule.value = userShort.value
    }
  } finally {
    loading.value = false
    setTimeout(() => {
      keyStatusMsg.value = ''
    }, 2000)
  }
}

function saveRule() {
  if (!formCompany.value.trim()) {
    ElMessage.warning('请输入开票公司名称')
    return
  }
  if (!formRule.value.trim()) {
    ElMessage.warning('请输入用途规则说明')
    return
  }

  const aliases = formAliasesStr.value
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)

  upsertCompanyRule({
    id: existingRuleObj.value?.id,
    company: formCompany.value.trim(),
    aliases,
    rule: formRule.value.trim(),
    purpose_short_rule: formShortRule.value.trim() || undefined,
    examples: [
      ...(existingRuleObj.value?.examples || []),
      {
        originalPurpose: originalPurpose.value,
        userPurpose: userPurpose.value,
        originalShort: originalShort.value,
        userShort: userShort.value
      }
    ].slice(-5), // 保留最近5个修改对照
    enabled: true
  })

  ElMessage.success(`已沉淀 [${formCompany.value}] 的偏好经验！`)
  dialogVisible.value = false
  emit('saved')
}
</script>
