<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    candidates?: string[]
    type?: 'input' | 'textarea'
    placeholder?: string
    size?: '' | 'default' | 'small' | 'large'
    clearable?: boolean
    autosize?: any
    popoverWidth?: number
    maxCharacters?: number
    expandOnFocus?: boolean
  }>(),
  {
    candidates: () => [],
    type: 'input',
    placeholder: '',
    size: 'small',
    clearable: true,
    autosize: () => ({ minRows: 1, maxRows: 3 }),
    popoverWidth: 320,
    maxCharacters: undefined,
    expandOnFocus: false
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
  (e: 'input', value: string): void
  (e: 'candidateSelect', value: string, index: number): void
  (e: 'overlimitClick'): void
  (e: 'focus', event: FocusEvent): void
  (e: 'blur', event: FocusEvent): void
}>()

const popoverVisible = ref(false)
const isFocused = ref(false)
const textareaRef = ref<any>(null)
let blurTimer: any = null

const displayCandidates = computed<string[]>(() => {
  const list: string[] = []
  if (Array.isArray(props.candidates)) {
    for (const item of props.candidates) {
      if (typeof item === 'string') {
        const t = item.trim()
        if (t && !list.includes(t)) {
          list.push(t)
        }
      }
    }
  }

  // 若当前输入值不在备选列表中且不为空，可作为参考，但 displayCandidates 主要展示候选项
  return list.slice(0, 5)
})

const hasMultiple = computed(() => displayCandidates.value.length > 1)

function onInput(val: string) {
  let finalVal = val
  if (props.expandOnFocus) {
    // 聚焦自动展开模式下，防止在精简文件名中输入换行
    finalVal = val.replace(/[\r\n]+/g, ' ')
  }
  emit('update:modelValue', finalVal)
  emit('input', finalVal)
}

function onChange(val: string) {
  emit('change', val)
}

function onFocus(e: FocusEvent) {
  if (blurTimer) {
    clearTimeout(blurTimer)
    blurTimer = null
  }
  isFocused.value = true
  nextTick(() => {
    textareaRef.value?.resizeTextarea?.()
  })
  emit('focus', e)
}

function onBlur(e: FocusEvent) {
  blurTimer = setTimeout(() => {
    if (popoverVisible.value) return
    isFocused.value = false
    nextTick(() => {
      textareaRef.value?.resizeTextarea?.()
    })
  }, 160)
  emit('blur', e)
}

function onKeydown(e: KeyboardEvent) {
  if (props.expandOnFocus && e.key === 'Enter') {
    e.preventDefault()
    ;(e.target as HTMLElement)?.blur()
  } else if (props.expandOnFocus && e.key === 'Escape') {
    ;(e.target as HTMLElement)?.blur()
  }
}

watch(popoverVisible, (visible) => {
  if (!visible && props.expandOnFocus) {
    const ta = textareaRef.value?.$el?.querySelector('textarea')
    if (document.activeElement !== ta) {
      isFocused.value = false
      nextTick(() => {
        textareaRef.value?.resizeTextarea?.()
      })
    }
  }
})

function selectCandidate(cand: string, idx: number) {
  emit('update:modelValue', cand)
  emit('input', cand)
  emit('change', cand)
  emit('candidateSelect', cand, idx)
  popoverVisible.value = false
  if (props.expandOnFocus) {
    isFocused.value = false
    nextTick(() => {
      textareaRef.value?.resizeTextarea?.()
    })
  }
}
</script>

<template>
  <div class="candidate-select-root w-full relative">
    <!-- 聚焦自动展开模式 (针对用途(简称)) -->
    <div
      v-if="expandOnFocus"
      class="expand-candidate-select flex flex-col gap-1 w-full relative"
      :class="{ 'is-focused-container': isFocused }"
    >
      <div class="flex items-start gap-1 w-full">
        <el-input
          ref="textareaRef"
          class="flex-1 min-w-0 expand-textarea"
          :class="isFocused ? 'is-expanded' : 'is-collapsed'"
          :model-value="modelValue"
          type="textarea"
          :autosize="isFocused ? { minRows: 2, maxRows: 8 } : false"
          :rows="1"
          :size="size"
          :placeholder="placeholder"
          @input="onInput"
          @change="onChange"
          @focus="onFocus"
          @blur="onBlur"
          @keydown="onKeydown"
        />

        <span
          v-if="maxCharacters && Array.from(modelValue || '').length > maxCharacters"
          class="shrink-0 text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded font-medium flex items-center gap-0.5 cursor-pointer hover:bg-rose-100 mt-0.5"
          :title="`已超出 ${maxCharacters} 字符限制（当前 ${Array.from(modelValue).length} 字），点击协商修改方案`"
          @mousedown.prevent
          @click="$emit('overlimitClick')"
        >
          ⚠️超限({{ Array.from(modelValue).length }}字)
        </span>

        <el-popover
          v-if="hasMultiple"
          v-model:visible="popoverVisible"
          trigger="click"
          placement="bottom-end"
          :width="popoverWidth"
          popper-class="candidate-popover"
        >
          <template #reference>
            <button
              type="button"
              class="candidate-badge-btn shrink-0 px-1.5 py-1 text-[11px] leading-none rounded border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer flex items-center gap-0.5 transition-colors mt-0.5"
              :title="`查看 ${displayCandidates.length} 种 AI 备选方案`"
              @mousedown.prevent
            >
              <span>{{ displayCandidates.length }}方案</span>
              <span class="text-[8px] opacity-75">▼</span>
            </button>
          </template>

          <div class="candidate-dropdown-panel text-xs">
            <div class="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-100 text-gray-500 font-medium">
              <span>AI 备选方案 (共 {{ displayCandidates.length }} 项)</span>
              <span class="text-[10px] text-gray-400">点击直接填入</span>
            </div>

            <div class="flex flex-col gap-1 max-h-60 overflow-y-auto pr-0.5">
              <div
                v-for="(cand, idx) in displayCandidates"
                :key="idx"
                class="p-2 rounded cursor-pointer transition-colors text-xs flex items-start justify-between gap-2 border"
                :class="cand === modelValue ? 'bg-blue-50 text-blue-700 font-medium border-blue-200' : 'hover:bg-gray-50 text-gray-700 border-transparent'"
                @click="selectCandidate(cand, idx)"
              >
                <div class="flex items-start gap-1.5 min-w-0 flex-1">
                  <span
                    v-if="idx === 0"
                    class="shrink-0 text-[10px] px-1 py-0.5 bg-emerald-100 text-emerald-700 rounded border border-emerald-300 font-normal leading-none mt-0.5"
                  >
                    AI 首选
                  </span>
                  <span
                    v-else
                    class="shrink-0 text-[10px] px-1 py-0.5 bg-gray-100 text-gray-600 rounded font-normal leading-none mt-0.5"
                  >
                    备选 {{ idx + 1 }}
                  </span>
                  <span class="break-words whitespace-pre-wrap leading-relaxed flex-1">{{ cand }}</span>
                </div>
                <div class="flex items-center gap-1 shrink-0 ml-1">
                  <span
                    v-if="maxCharacters"
                    class="text-[10px] font-mono px-1 py-0.2 rounded"
                    :class="Array.from(cand).length <= maxCharacters ? 'text-gray-400' : 'text-rose-600 bg-rose-50 border border-rose-200'"
                  >
                    {{ Array.from(cand).length }}字
                  </span>
                  <span v-if="cand === modelValue" class="text-blue-600 font-bold">✓</span>
                </div>
              </div>
            </div>
          </div>
        </el-popover>
      </div>

      <!-- 聚焦展开后的辅助状态条 -->
      <div
        v-if="isFocused"
        class="flex items-center justify-between text-[11px] px-1.5 py-0.5 bg-blue-50/80 rounded border border-blue-100 text-gray-600 animate-fadeIn"
      >
        <div class="flex items-center gap-1.5">
          <span
            v-if="maxCharacters"
            class="font-mono text-[10px]"
            :class="Array.from(modelValue || '').length > maxCharacters ? 'text-rose-600 font-semibold' : 'text-gray-500'"
          >
            {{ Array.from(modelValue || '').length }} / {{ maxCharacters }} 字
          </span>
          <span
            v-if="maxCharacters && Array.from(modelValue || '').length > maxCharacters"
            class="text-[10px] text-rose-600 hover:text-rose-800 underline font-medium cursor-pointer"
            @mousedown.prevent
            @click="$emit('overlimitClick')"
          >
            协商修改方案
          </span>
        </div>
        <span class="text-[10px] text-gray-400">Enter 或失焦完成修改</span>
      </div>
    </div>

    <!-- 单行输入框模式 -->
    <div v-else-if="type === 'input'" class="flex items-center gap-1 w-full">
      <el-input
        class="flex-1 min-w-0"
        :model-value="modelValue"
        :size="size"
        :clearable="clearable"
        :placeholder="placeholder"
        @input="onInput"
        @change="onChange"
      />

      <span
        v-if="maxCharacters && Array.from(modelValue || '').length > maxCharacters"
        class="shrink-0 text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded font-medium flex items-center gap-0.5 cursor-pointer hover:bg-rose-100"
        :title="`已超出 ${maxCharacters} 字符限制（当前 ${Array.from(modelValue).length} 字），点击协商修改方案`"
        @click="$emit('overlimitClick')"
      >
        ⚠️超限({{ Array.from(modelValue).length }}字)
      </span>

      <el-popover
        v-if="hasMultiple"
        v-model:visible="popoverVisible"
        trigger="click"
        placement="bottom-end"
        :width="popoverWidth"
        popper-class="candidate-popover"
      >
        <template #reference>
          <button
            type="button"
            class="candidate-badge-btn shrink-0 px-1.5 py-1 text-[11px] leading-none rounded border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer flex items-center gap-0.5 transition-colors"
            :title="`查看 ${displayCandidates.length} 种 AI 备选方案`"
          >
            <span>{{ displayCandidates.length }}方案</span>
            <span class="text-[8px] opacity-75">▼</span>
          </button>
        </template>

        <div class="candidate-dropdown-panel text-xs">
          <div class="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-100 text-gray-500 font-medium">
            <span>AI 备选方案 (共 {{ displayCandidates.length }} 项)</span>
            <span class="text-[10px] text-gray-400">点击直接填入</span>
          </div>

          <div class="flex flex-col gap-1 max-h-60 overflow-y-auto pr-0.5">
            <div
              v-for="(cand, idx) in displayCandidates"
              :key="idx"
              class="p-2 rounded cursor-pointer transition-colors text-xs flex items-start justify-between gap-2 border"
              :class="cand === modelValue ? 'bg-blue-50 text-blue-700 font-medium border-blue-200' : 'hover:bg-gray-50 text-gray-700 border-transparent'"
              @click="selectCandidate(cand, idx)"
            >
              <div class="flex items-start gap-1.5 min-w-0 flex-1">
                <span
                  v-if="idx === 0"
                  class="shrink-0 text-[10px] px-1 py-0.5 bg-emerald-100 text-emerald-700 rounded border border-emerald-300 font-normal leading-none mt-0.5"
                >
                  AI 首选
                </span>
                <span
                  v-else
                  class="shrink-0 text-[10px] px-1 py-0.5 bg-gray-100 text-gray-600 rounded font-normal leading-none mt-0.5"
                >
                  备选 {{ idx + 1 }}
                </span>
                <span class="break-words whitespace-pre-wrap leading-relaxed flex-1">{{ cand }}</span>
              </div>
              <div class="flex items-center gap-1 shrink-0 ml-1">
                <span
                  v-if="maxCharacters"
                  class="text-[10px] font-mono px-1 py-0.2 rounded"
                  :class="Array.from(cand).length <= maxCharacters ? 'text-gray-400' : 'text-rose-600 bg-rose-50 border border-rose-200'"
                >
                  {{ Array.from(cand).length }}字
                </span>
                <span v-if="cand === modelValue" class="text-blue-600 font-bold">✓</span>
              </div>
            </div>
          </div>
        </div>
      </el-popover>
    </div>

    <!-- 多行文本域模式 (针对用途) -->
    <div v-else class="flex flex-col gap-1 w-full">
      <el-input
        class="w-full"
        :model-value="modelValue"
        type="textarea"
        :autosize="autosize"
        :size="size"
        :clearable="clearable"
        :placeholder="placeholder"
        @input="onInput"
        @change="onChange"
      />

      <div v-if="hasMultiple" class="flex justify-end">
        <el-popover
          v-model:visible="popoverVisible"
          trigger="click"
          placement="bottom-end"
          :width="popoverWidth"
          popper-class="candidate-popover"
        >
          <template #reference>
            <button
              type="button"
              class="candidate-badge-btn shrink-0 px-1.5 py-0.5 text-[10px] leading-none rounded border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer flex items-center gap-0.5 transition-colors"
              :title="`查看 ${displayCandidates.length} 种 AI 备选方案`"
            >
              <span>AI 备选方案 ({{ displayCandidates.length }})</span>
              <span class="text-[7px] opacity-75">▼</span>
            </button>
          </template>

          <div class="candidate-dropdown-panel text-xs">
            <div class="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-100 text-gray-500 font-medium">
              <span>AI 备选方案 (共 {{ displayCandidates.length }} 项)</span>
              <span class="text-[10px] text-gray-400">点击直接填入</span>
            </div>

            <div class="flex flex-col gap-1 max-h-64 overflow-y-auto pr-0.5">
              <div
                v-for="(cand, idx) in displayCandidates"
                :key="idx"
                class="p-2 rounded cursor-pointer transition-colors text-xs flex items-start justify-between gap-2 border"
                :class="cand === modelValue ? 'bg-blue-50 text-blue-700 font-medium border-blue-200' : 'hover:bg-gray-50 text-gray-700 border-transparent'"
                @click="selectCandidate(cand, idx)"
              >
                <div class="flex items-start gap-1.5 min-w-0 flex-1">
                  <span
                    v-if="idx === 0"
                    class="shrink-0 text-[10px] px-1 py-0.5 bg-emerald-100 text-emerald-700 rounded border border-emerald-300 font-normal leading-none mt-0.5"
                  >
                    AI 首选
                  </span>
                  <span
                    v-else
                    class="shrink-0 text-[10px] px-1 py-0.5 bg-gray-100 text-gray-600 rounded font-normal leading-none mt-0.5"
                  >
                    备选 {{ idx + 1 }}
                  </span>
                  <span class="break-words whitespace-pre-wrap leading-relaxed flex-1">{{ cand }}</span>
                </div>
                <span v-if="cand === modelValue" class="text-blue-600 shrink-0 font-bold ml-1">✓</span>
              </div>
            </div>
          </div>
        </el-popover>
      </div>
    </div>
  </div>
</template>

<style scoped>
.candidate-badge-btn {
  user-select: none;
}

.expand-textarea :deep(textarea) {
  font-size: 12px;
  font-family: inherit;
  transition: all 0.15s ease;
}

.expand-textarea.is-collapsed :deep(textarea) {
  height: 28px !important;
  min-height: 28px !important;
  max-height: 28px !important;
  line-height: 20px !important;
  padding: 3px 8px !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis;
  resize: none !important;
}

.expand-textarea.is-expanded :deep(textarea) {
  white-space: pre-wrap !important;
  word-break: break-all !important;
  line-height: 1.45 !important;
  padding: 6px 8px !important;
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
  resize: vertical !important;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.15s ease-out;
}
</style>

