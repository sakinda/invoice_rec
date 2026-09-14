<template>
  <el-card class="rf-card">
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span>用户偏好与规则经验库 (Skill 沉淀)</span>
          <el-tag size="small" type="info">{{ rules.length }} 条规则</el-tag>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-[color:var(--rf-text-muted)]">全局注入开关：</span>
          <el-switch
            v-model="experienceEnabled"
            inline-prompt
            active-text="开"
            inactive-text="关"
            @change="onToggleGlobal"
          />
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-4">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <el-input
          v-model="searchQuery"
          placeholder="搜索公司名称或别名..."
          size="small"
          clearable
          style="max-width: 280px"
        />

        <div class="flex items-center gap-2">
          <el-button size="small" @click="openAddDialog">
            新增规则
          </el-button>
          <el-button size="small" @click="exportRules">
            导出备份
          </el-button>
          <el-button size="small" @click="triggerImport">
            导入规则
          </el-button>
          <input
            ref="fileInputRef"
            type="file"
            accept=".json"
            class="hidden"
            @change="handleFileSelected"
          />
        </div>
      </div>

      <!-- 规则列表 -->
      <div v-if="filteredRules.length > 0" class="flex flex-col gap-3">
        <div
          v-for="r in filteredRules"
          :key="r.id"
          class="border rounded-[10px] bg-white p-3 shadow-xs hover:border-gray-400 transition-colors flex flex-col gap-2"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-semibold text-sm text-gray-800">{{ r.company }}</span>
              <el-tag
                v-for="a in r.aliases || []"
                :key="a"
                size="small"
                type="info"
                effect="plain"
              >
                {{ a }}
              </el-tag>
            </div>

            <div class="flex items-center gap-3">
              <span class="text-[11px] text-gray-400 hidden sm:inline">
                {{ formatDate(r.updatedAt) }}
              </span>
              <el-switch
                v-model="r.enabled"
                size="small"
                @change="onRuleEnabledChange(r)"
              />
              <el-button
                size="small"
                link
                type="primary"
                @click="openEditDialog(r)"
              >
                编辑
              </el-button>
              <el-popconfirm
                title="确定删除此条公司经验规则吗？"
                confirm-button-text="删除"
                cancel-button-text="取消"
                confirm-button-type="danger"
                @confirm="onDeleteRule(r.id)"
              >
                <template #reference>
                  <el-button size="small" link type="danger">删除</el-button>
                </template>
              </el-popconfirm>
            </div>
          </div>

          <div class="text-xs bg-[color:var(--rf-surface-low)] rounded p-2.5 flex flex-col gap-1.5 border">
            <div>
              <span class="text-gray-500 font-medium">用途要求: </span>
              <span class="text-gray-800">{{ r.rule }}</span>
            </div>
            <div v-if="r.purpose_short_rule">
              <span class="text-gray-500 font-medium">精简用途: </span>
              <span class="text-gray-800">{{ r.purpose_short_rule }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="text-center py-8 text-gray-400 text-xs border rounded-lg border-dashed">
        <div v-if="searchQuery">未找到匹配的经验规则</div>
        <div v-else class="flex flex-col gap-1">
          <span>暂无沉淀的经验规则。</span>
          <span class="text-gray-400">在处理发票时，手动修改用途即可点击【沉淀经验】一键生成！</span>
        </div>
      </div>
    </div>

    <!-- 手动编辑/新增弹窗 -->
    <el-dialog
      v-model="editDialogVisible"
      :title="editingRuleId ? '编辑经验规则' : '新增经验规则'"
      width="560px"
      :close-on-click-modal="false"
    >
      <el-form label-position="top" size="small" class="flex flex-col gap-2">
        <el-form-item label="开票公司主体" required>
          <el-input v-model="editForm.company" placeholder="例如：TotalEnergies" />
        </el-form-item>

        <el-form-item label="别名 / 常见变体 (逗号分隔)">
          <el-input v-model="editForm.aliasesStr" placeholder="例如：Total Energies, TOTALENERGIES SE" />
        </el-form-item>

        <el-form-item label="用途(purpose)提炼规则" required>
          <el-input
            v-model="editForm.rule"
            type="textarea"
            :rows="3"
            placeholder="例如：统一输出格式为 '电 Electricite YYYY-MM'，其中 YYYY-MM 为账单所属年月"
          />
        </el-form-item>

        <el-form-item label="精简用途(purpose_short)规则 (用于文件名)">
          <el-input v-model="editForm.purpose_short_rule" placeholder="例如：电费 YYYY-MM" />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button size="small" @click="editDialogVisible = false">取消</el-button>
          <el-button size="small" type="primary" @click="saveEditForm">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { CompanyPreferenceRule } from '../lib/types'
import {
  deleteCompanyRule,
  exportRulesJson,
  getCompanyRules,
  getExperienceEnabled,
  importRulesJson,
  saveCompanyRules,
  setExperienceEnabled,
  upsertCompanyRule
} from '../lib/storage'

const experienceEnabled = ref(true)
const rules = ref<CompanyPreferenceRule[]>([])
const searchQuery = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

const editDialogVisible = ref(false)
const editingRuleId = ref<string | null>(null)
const editForm = ref({
  company: '',
  aliasesStr: '',
  rule: '',
  purpose_short_rule: ''
})

function loadData() {
  experienceEnabled.value = getExperienceEnabled()
  rules.value = getCompanyRules()
}

onMounted(() => {
  loadData()
})

defineExpose({
  reload: loadData
})

const filteredRules = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return rules.value
  return rules.value.filter(
    (r) =>
      r.company.toLowerCase().includes(q) ||
      r.aliases?.some((a) => a.toLowerCase().includes(q)) ||
      r.rule.toLowerCase().includes(q)
  )
})

function formatDate(ts?: number) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function onToggleGlobal(v: boolean) {
  setExperienceEnabled(v)
  ElMessage.success(v ? '已开启全局经验规则注入' : '已停用全局经验规则注入')
}

function onRuleEnabledChange(r: CompanyPreferenceRule) {
  saveCompanyRules(rules.value)
  ElMessage.success(`已${r.enabled ? '启用' : '禁用'} [${r.company}] 的偏好规则`)
}

function onDeleteRule(id: string) {
  deleteCompanyRule(id)
  loadData()
  ElMessage.success('已删除规则')
}

function openAddDialog() {
  editingRuleId.value = null
  editForm.value = {
    company: '',
    aliasesStr: '',
    rule: '',
    purpose_short_rule: ''
  }
  editDialogVisible.value = true
}

function openEditDialog(r: CompanyPreferenceRule) {
  editingRuleId.value = r.id
  editForm.value = {
    company: r.company,
    aliasesStr: (r.aliases || []).join(', '),
    rule: r.rule,
    purpose_short_rule: r.purpose_short_rule || ''
  }
  editDialogVisible.value = true
}

function saveEditForm() {
  if (!editForm.value.company.trim()) {
    ElMessage.warning('请输入公司名称')
    return
  }
  if (!editForm.value.rule.trim()) {
    ElMessage.warning('请输入用途规则')
    return
  }

  const aliases = editForm.value.aliasesStr
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)

  upsertCompanyRule({
    id: editingRuleId.value || undefined,
    company: editForm.value.company.trim(),
    aliases,
    rule: editForm.value.rule.trim(),
    purpose_short_rule: editForm.value.purpose_short_rule.trim() || undefined,
    enabled: true
  })

  editDialogVisible.value = false
  loadData()
  ElMessage.success('保存成功')
}

function exportRules() {
  const json = exportRulesJson()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `invoice_preference_rules_${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  ElMessage.success('已导出规则备份文件')
}

function triggerImport() {
  fileInputRef.value?.click()
}

async function handleFileSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const res = importRulesJson(text)
    if (res.success) {
      loadData()
      ElMessage.success(`导入成功，共解析并更新 ${res.count} 条规则！`)
    } else {
      ElMessage.error(res.error || '导入失败')
    }
  } catch (err: any) {
    ElMessage.error(`读取文件失败: ${err?.message || err}`)
  } finally {
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}
</script>
