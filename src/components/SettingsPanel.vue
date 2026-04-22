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
            <el-input v-model="renameTpl" placeholder="{date}_{company}_{amount}.pdf" />
          </el-form-item>
        </div>

        <el-form-item label="Prompt 模板">
          <el-input v-model="prompt" type="textarea" :rows="12" />
        </el-form-item>

        <div class="flex items-center justify-between gap-3">
          <div class="text-xs text-[color:var(--rf-text-muted)]">
            支持变量：{date} {company} {amount} {invoice_no} {currency}
          </div>
          <el-button type="primary" @click="save">保存</el-button>
        </div>
      </div>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { ref, watchEffect } from 'vue'
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

const apiKeysCsv = ref('')
const prompt = ref('')
const renameTpl = ref('')
const modelId = ref<GeminiModelId>('gemini-2.5-flash-lite')

watchEffect(() => {
  apiKeysCsv.value = getApiKeys().join(',')
  prompt.value = getPrompt()
  renameTpl.value = getRenameTemplate()
  modelId.value = getModelId()
})

function save() {
  setApiKeys(apiKeysCsv.value)
  setPrompt(prompt.value)
  setRenameTemplate(renameTpl.value)
  setModelId(modelId.value)
  ElMessage.success('已保存')
}
</script>
