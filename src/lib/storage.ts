import type { GeminiModelId } from './types'

const K = {
  apiKeys: 'invoice_rec_ai.api_keys',
  prompt: 'invoice_rec_ai.prompt',
  renameTpl: 'invoice_rec_ai.rename_tpl',
  modelId: 'invoice_rec_ai.model_id'
} as const

export const defaultPrompt = `你是一个专业的跨国财务审计与数据提取专家。
请仔细分析我提供的发票文件（图片或PDF），并严格按照以下规则提取信息。

【提取字段与处理规则】
1. company_name (公司名称): 提取开具发票的销售方主体名称。必须去除多余的空格和换行符。
2. date (发票日期): 统一格式化为 "YYYY-MM-DD"。如果原日期是其他格式（如 DD/MM/YYYY 或拼写出的月份），请务必转换。
3. invoice_no (发票号): 完整保留原文的发票号码，包括任何字母前缀和连字符（如 FR-2024-001），不可擅自改写或缩减。
4. purpose (发票用途): 提取购买的商品主体名称和数量。
   - 如果原文是法语或其他外语，请准确翻译成尽量精简的中文。
   - 格式必须严格统一为：“商品名称 x数量”（例如：“木质A4夹板夹 x6”）。
   - 如果一张发票包含多个不同的商品，请用逗号将它们连接起来。
5. tva (TVA增值税): 仅提取增值税金额。只保留纯数字和对应的小数点，绝对不要带税率百分比，也不要带货币符号（例如正确格式为 "6.30"）。如果没有列出税额，请返回 "0.00"。
6. total_amount (总金额): 仅提取发票的总金额（含税金额）。只保留纯数字和对应的小数点，绝对不要带货币符号（例如正确格式为 "37.78"）。
7. currency (货币单位): 识别发票使用的货币，并返回标准的三个字母代码（如 "EUR", "USD", "CNY" 等）。

【输出格式强制要求】
- 你的回答必须且只能是一个合法的 JSON 对象。
- 绝对不要在 JSON 外面包裹任何 Markdown 标记（例如不要输出 \`\`\`json 和 \`\`\`）。
- 绝对不要输出任何额外的解释、问候或分析过程。

必须严格遵守以下 JSON 结构返回：
{
  "company_name": "",
  "date": "",
  "invoice_no": "",
  "purpose": "",
  "tva": "",
  "total_amount": "",
  "currency": ""
}`

export function getApiKeys(): string[] {
  const raw = localStorage.getItem(K.apiKeys) ?? ''
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

export function setApiKeys(keysCsv: string) {
  localStorage.setItem(K.apiKeys, keysCsv)
}

export function getPrompt(): string {
  return localStorage.getItem(K.prompt) ?? defaultPrompt
}

export function setPrompt(v: string) {
  localStorage.setItem(K.prompt, v)
}

export function getRenameTemplate(): string {
  return localStorage.getItem(K.renameTpl) ?? '{date}_{company}_{amount}.pdf'
}

export function setRenameTemplate(v: string) {
  localStorage.setItem(K.renameTpl, v)
}

export function getModelId(): GeminiModelId {
  const v = (localStorage.getItem(K.modelId) ?? 'gemini-2.5-flash-lite') as GeminiModelId
  if (v === 'gemini-2.5-flash-lite' || v === 'gemini-3.0-flash-preview') return v
  return 'gemini-2.5-flash-lite'
}

export function setModelId(v: GeminiModelId) {
  localStorage.setItem(K.modelId, v)
}
