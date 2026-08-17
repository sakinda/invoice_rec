import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import type { SplitInvoice } from './types'

function sanitizeFilenamePart(s: string): string {
  return s
    .replace(/[\/\\:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
}

export function applyRenameTemplate(tpl: string, inv: SplitInvoice): string {
  const e = inv.extract
  const company = sanitizeFilenamePart(e?.company_name ?? 'UNKNOWN')
  const date = sanitizeFilenamePart(e?.date ?? 'UNKNOWN_DATE')
  const amount = sanitizeFilenamePart(e?.total_amount ?? '0.00')
  const invoiceNo = sanitizeFilenamePart(e?.invoice_no ?? '')
  const purposeShort = sanitizeFilenamePart((e as any)?.purpose_short ?? '')
  const currencyRaw = String(e?.currency ?? '').toUpperCase()
  const currency = sanitizeFilenamePart(currencyRaw === 'EUR' ? 'EUROS' : currencyRaw)

  const raw = tpl
    .replaceAll('{company}', company)
    .replaceAll('{date}', date)
    .replaceAll('{amount}', amount)
    .replaceAll('{invoice_no}', invoiceNo)
    .replaceAll('{purpose_short}', purposeShort)
    .replaceAll('{currency}', currency)

  let base = raw.endsWith('.pdf') ? raw : `${raw}.pdf`
  base = base.replace(/\s+/g, ' ').replace(/_+/g, '_').trim()
  base = base.replace(/^[_\s]+|[_\s]+$/g, '')
  base = base.replace(/[_\s]+\.pdf$/i, '.pdf')

  const prefix = 'Facture(Richelieu)'
  if (new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(base)) return base
  return `${prefix} ${base}`
}

export function buildExcelRows(
  invoices: SplitInvoice[],
  renameTemplate: string
): Array<(string | number)[]> {
  const rows: Array<(string | number)[]> = []

  for (const inv of invoices) {
    const e = inv.extract
    if (!e) continue
    const col1 = 'Facture(Richelieu)'
    const col2 = e.company_name.replace(/\s+/g, ' ').trim()
    const col3 = e.date
    const invoiceNo = String(e.invoice_no ?? '').trim()
    const purposeShort = String((e as any)?.purpose_short ?? '').trim()
    const col4 = [invoiceNo, purposeShort].filter(Boolean).join(' & ').trim()
    const col5 = e.total_amount
    const col6 = e.currency === 'EUR' ? 'EUROS' : e.currency
    const col7 = e.tva
    // 第8列与导出的 PDF 文件名保持完全一致（含前缀 Facture(Richelieu)）
    const filenameNoExt = applyRenameTemplate(renameTemplate, inv)
    const col8 = filenameNoExt.replace(/\.pdf$/i, '')
    const col9 = String(e.purpose ?? '').trim()
    rows.push([col1, col2, col3, col4, col5, col6, col7, col8, col9])
  }

  return rows
}

export function buildWorkbook(
  invoices: SplitInvoice[],
  renameTemplate: string
): XLSX.WorkBook {
  const header = [
    '项目分类',
    '公司名称',
    '发票日期',
    '发票号&用途(精简)',
    '总金额',
    '货币单位',
    'TVA 金额',
    'PDF文件名',
    '用途(完整版)'
  ]
  const data = [header, ...buildExcelRows(invoices, renameTemplate)]
  const ws = XLSX.utils.aoa_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Invoices')
  return wb
}

export async function exportZip(opts: { invoices: SplitInvoice[]; renameTemplate: string }): Promise<Blob> {
  const zip = new JSZip()

  const wb = buildWorkbook(opts.invoices, opts.renameTemplate)
  const excelBytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  zip.file('report.xlsx', excelBytes)

  const pdfFolder = zip.folder('pdfs')
  if (!pdfFolder) throw new Error('创建 ZIP 目录失败')

  for (const inv of opts.invoices) {
    const filename = applyRenameTemplate(opts.renameTemplate, inv)
    pdfFolder.file(filename, inv.pdfBlob)
  }

  return zip.generateAsync({ type: 'blob' })
}
