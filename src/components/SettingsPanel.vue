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
