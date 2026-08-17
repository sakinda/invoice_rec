<template>
  <el-card class="rf-card">
    <template #header>导出 ZIP + Excel</template>

    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <el-button type="primary" :disabled="invoices.length === 0" @click="doExport">导出 zip</el-button>
        <div class="text-xs text-[color:var(--rf-text-muted)]">包含 report.xlsx + pdfs/ 下的重命名 PDF</div>
      </div>

      <el-table class="rf-table" :data="previewRows" size="small" border stripe style="width: 100%">
        <el-table-column prop="name" label="文件名预览" />
        <el-table-column prop="col8" label="Excel 第 8 列预览" />
      </el-table>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { SplitInvoice } from '../lib/types'
import { applyRenameTemplate, buildExcelRows, exportZip } from '../lib/export'
import { getRenameTemplate } from '../lib/storage'

const props = defineProps<{
  invoices: SplitInvoice[]
}>()

const previewRows = computed(() => {
  const tpl = getRenameTemplate()
  const rows = buildExcelRows(props.invoices, tpl)
  return props.invoices.map((inv: SplitInvoice, idx: number) => ({
    name: applyRenameTemplate(tpl, inv),
    col8: rows[idx]?.[7] ?? ''
  }))
})

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function doExport() {
  const tpl = getRenameTemplate()
  const ok = props.invoices.filter((i: SplitInvoice) => i.extract && !i.error)
  if (ok.length === 0) {
    ElMessage.error('没有可导出的已抽取发票')
    return
  }
  const blob = await exportZip({ invoices: ok, renameTemplate: tpl })
  downloadBlob(blob, 'invoices_export.zip')
  ElMessage.success('已导出')
}
</script>
