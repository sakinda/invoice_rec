export type GeminiModelId = 'gemini-2.5-flash-lite' | 'gemini-3.0-flash-preview'

export type InvoiceExtract = {
  company_name: string
  date: string
  invoice_no: string
  purpose: string
  tva: string
  total_amount: string
  currency: string
}

export type SplitInvoice = {
  id: string
  pagesOriginal: number[]
  pdfBlob: Blob
  filenameSuggested?: string
  extract?: InvoiceExtract
  error?: string
}
