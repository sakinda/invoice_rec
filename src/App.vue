<template>
  <div class="min-h-screen">
    <div class="rf-container mx-auto px-5 md:px-6 py-6 pb-24 flex flex-col gap-6">
      <div class="flex items-end justify-between gap-4">
        <div class="flex flex-col gap-1">
          <div class="text-[24px] leading-8 font-semibold tracking-[-0.01em]">发票处理</div>
          <div class="text-sm text-[color:var(--rf-text-muted)]">自动拆分、识别、导出</div>
        </div>
        <div class="hidden md:flex text-xs text-[color:var(--rf-text-muted)]">
          仅在浏览器内完成处理
        </div>
      </div>

      <div v-show="activeTab === 'process'" class="flex flex-col gap-6">
        <PdfSplitter @split-ready="onSplitReady" />
        <InvoiceProcessor :invoices="invoices" />
        <Exporter :invoices="invoices" />
      </div>

      <div v-show="activeTab === 'settings'">
        <SettingsPanel />
      </div>
    </div>

    <div class="rf-navbar">
      <div class="rf-container mx-auto px-5 md:px-6 h-full flex items-center justify-center">
        <div class="rf-navbar__inner">
          <button
            class="rf-nav-item"
            :class="activeTab === 'process' ? 'rf-nav-item--active' : ''"
            type="button"
            @click="activeTab = 'process'"
          >
            处理
          </button>
          <button
            class="rf-nav-item"
            :class="activeTab === 'settings' ? 'rf-nav-item--active' : ''"
            type="button"
            @click="activeTab = 'settings'"
          >
            设置
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SettingsPanel from './components/SettingsPanel.vue'
import PdfSplitter from './components/PdfSplitter.vue'
import InvoiceProcessor from './components/InvoiceProcessor.vue'
import Exporter from './components/Exporter.vue'
import type { SplitInvoice } from './lib/types'

const activeTab = ref<'process' | 'settings'>('process')
const invoices = ref<SplitInvoice[]>([])

function onSplitReady(payload: { invoices: SplitInvoice[] }) {
  invoices.value = payload.invoices
}
</script>
