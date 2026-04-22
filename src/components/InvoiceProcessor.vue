<template>
  <el-card class="rf-card">
    <template #header>Gemini 语义提取</template>

    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <el-button type="primary" :disabled="busy || invoices.length === 0" @click="runExtract">开始抽取</el-button>
        <div class="text-xs text-[color:var(--rf-text-muted)]">按顺序轮替使用 API Key；失败会记录错误信息</div>
      </div>

      <el-table class="rf-table" :data="invoices" size="small" border stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="220" />
        <el-table-column label="页码(原始 0-based)">
          <template #default="{ row }">{{ row.pagesOriginal.join(',') }}</template>
        </el-table-column>
        <el-table-column label="公司">
          <template #default="{ row }">{{ row.extract?.company_name ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="日期">
          <template #default="{ row }">{{ row.extract?.date ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="金额">
          <template #default="{ row }">{{ row.extract?.total_amount ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="货币">
          <template #default="{ row }">{{ row.extract?.currency ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="220">
          <template #default="{ row }">
            <span v-if="row.error" class="text-red-600">{{ row.error }}</span>
            <span v-else-if="row.extract" class="text-green-700">完成</span>
            <span v-else class="text-gray-600">待处理</span>
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
import { extractInvoiceByGemini, pickApiKeyRoundRobin } from '../lib/gemini'
import { getApiKeys, getModelId, getPrompt } from '../lib/storage'

const props = defineProps<{
  invoices: SplitInvoice[]
}>()

const busy = ref(false)
const hasKeys = computed(() => getApiKeys().length > 0)

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
    for (let i = 0; i < props.invoices.length; i++) {
      const inv = props.invoices[i]
      inv.error = undefined
      try {
        const apiKey = pickApiKeyRoundRobin(keys, i)
        const ex = await extractInvoiceByGemini({ apiKey, modelId, prompt, pdfBlob: inv.pdfBlob })
        inv.extract = ex
      } catch (e) {
        inv.error = e instanceof Error ? e.message : String(e)
      }
    }
    if (!hasKeys.value) return
    ElMessage.success('抽取流程已完成')
  } finally {
    busy.value = false
  }
}
</script>
