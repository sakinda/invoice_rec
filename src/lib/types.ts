export type GeminiModelId = 'gemini-2.5-flash-lite' | 'gemini-3.0-flash-preview'

export type InvoiceExtract = {
  company_name: string
  company_name_candidates?: string[]
  date: string
  invoice_no: string
  purpose: string
  purpose_candidates?: string[]
  purpose_short?: string
  purpose_short_candidates?: string[]
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

export type ReconcileStrategy = 'ai_merged' | 'keep_local' | 'take_imported'

export type ReconciledRuleItem = {
  id: string
  company: string
  aliases: string[]
  type: 'merged' | 'new' | 'identical'
  localRule?: CompanyPreferenceRule
  importedRule: CompanyPreferenceRule
  suggestedRule: {
    rule: string
    purpose_short_rule?: string
    aliases?: string[]
    explanation?: string
  }
  selectedStrategy: ReconcileStrategy
  customRuleText: string
  customShortRuleText: string
  approved: boolean
}
