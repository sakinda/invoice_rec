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
  const currency = sanitizeFilenamePart(e?.currency ?? '')

  const raw = tpl
    .replaceAll('{company}', company)
    .replaceAll('{date}', date)
    .replaceAll('{amount}', amount)
    .replaceAll('{invoice_no}', invoiceNo)
    .replaceAll('{currency}', currency)

  const base = (raw.endsWith('.pdf') ? raw : `${raw}.pdf`).replace(/\s+/g, ' ').trim()

  const prefix = 'Facture(Richelieu)'
  if (base.startsWith(prefix)) return base
  return `${prefix} ${base}`
}

export function buildExcelRows(invoices: SplitInvoice[]): Array<(string | number)[]> {
  const rows: Array<(string | number)[]> = []

  for (const inv of invoices) {
    const e = inv.extract
    if (!e) continue
    const col1 = 'Facture(Richelieu)'
    const col2 = e.company_name.replace(/\s+/g, ' ').trim()
    const col3 = e.date
    const col4 = `${e.invoice_no} ${e.purpose}`.trim()
    const col5 = e.total_amount
    const col6 = e.currency === 'EUR' ? 'EUROS' : e.currency
    const col7 = e.tva
    const col8 = [col1, col2, col3, col4, col5, col6, col7].join(' ')
    rows.push([col1, col2, col3, col4, col5, col6, col7, col8])
  }

  return rows
}

export function buildWorkbook(invoices: SplitInvoice[]): XLSX.WorkBook {
  const header = ['项目分类', '公司名称', '发票日期', '发票号及用途', '总金额', '货币单位', 'TVA 金额', '合并信息']
  const data = [header, ...buildExcelRows(invoices)]
  const ws = XLSX.utils.aoa_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Invoices')
  return wb
}

export async function exportZip(opts: { invoices: SplitInvoice[]; renameTemplate: string }): Promise<Blob> {
  const zip = new JSZip()

  const wb = buildWorkbook(opts.invoices)
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
