export type GeminiModelId = 'gemini-2.5-flash-lite' | 'gemini-3.0-flash-preview'

export type InvoiceExtract = {
  company_name: string
  date: string
  invoice_no: string
  purpose: string
  purpose_short?: string
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
  rawExtract?: InvoiceExtract
  error?: string
}

export type CompanyRuleExample = {
  originalPurpose?: string
  userPurpose?: string
  originalShort?: string
  userShort?: string
}

export type CompanyPreferenceRule = {
  id: string
  company: string
  aliases?: string[]
  rule: string
  purpose_short_rule?: string
  examples?: CompanyRuleExample[]
  enabled: boolean
  updatedAt: number
}
