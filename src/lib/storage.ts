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
5. purpose_short (用途精简，用于文件命名): 将用途提炼为便于检索的短语（中文为主），不要超过 14 个汉字（或 24 个字符）。
   - 禁止兜底：不得以“YYYY-MM 上半月 食品采购”或“YYYY-MM 下半月 食品采购”作为任何无法确定时的默认兜底。
     - 仅当 company_name 为 “EUROPE CHINA”（大小写不敏感），并且发票内容中明确体现半月/周期性采购（例如写明上半月/下半月/半月订单/半个月/两次配送周期等）时，才允许使用“YYYY-MM 上半月 食品采购”或“YYYY-MM 下半月 食品采购”。
     - 其他情况不得自行推测上下半月：无法确定时要么留白，要么输出更稳妥的大致类别，例如“食材采购”、“食品采购”、“电器设备采购”、“电子产品采购”、“办公用品采购”、“日用百货”、“家居用品采购”、“清洁用品采购”、“服装采购”、“药妆采购”、“水费”、“电费”、“燃气费”、“通讯费”、“网络费”、“交通费”、“加油费”、“停车费”、“酒店住宿”、“餐饮消费”、“服务费”、“维修费”、“医疗保健”、“教育培训”、“订阅费”、“软件服务”等。
   - 电商平台购买多个类目：归纳为大类（如“电子产品”、“厨具”、“办公用品”、“家居用品”、“清洁用品”等）。
   - 若存在单件大额商品（非食品）且单件金额 > 100 EUR：优先用具体商品名（如“微波炉”、“显示器”、“吸尘器”）。若无法确定单件金额，则退回使用大类。
6. tva (TVA增值税): 仅提取增值税金额。只保留纯数字和对应的小数点，绝对不要带税率百分比，也不要带货币符号（例如正确格式为 "6.30"）。如果没有列出税额，请返回 "0.00"。
7. total_amount (总金额): 仅提取发票的总金额（含税金额）。只保留纯数字和对应的小数点，绝对不要带货币符号（例如正确格式为 "37.78"）。
8. currency (货币单位): 识别发票使用的货币，并返回标准的三个字母代码（如 "EUR", "USD", "CNY" 等）。

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
  "purpose_short": "",
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

function ensurePromptHasPurposeShort(p: string): string {
  if (p.includes('purpose_short')) return p

  const addon =
    '\n\n【新增字段: purpose_short（用途精简，用于文件命名）】\n' +
    '- 输出 JSON 中必须包含字段 "purpose_short"。\n' +
    '- 若无法确定，请返回 "[]"（不要留空）。\n' +
    '- 不要超过 14 个汉字（或 24 个字符）。\n' +
    '- 禁止兜底：不得以“YYYY-MM 上半月 食品采购”或“YYYY-MM 下半月 食品采购”作为任何无法确定时的默认兜底。\n' +
    '  - 仅当 company_name 为 “EUROPE CHINA”（大小写不敏感），并且发票内容中明确体现半月/周期性采购（例如写明上半月/下半月/半月订单/半个月/两次配送周期等）时，才允许使用“YYYY-MM 上半月 食品采购”或“YYYY-MM 下半月 食品采购”。\n' +
    '  - 其他情况不得自行推测上下半月：无法确定时要么留白，要么输出更稳妥的大致类别，例如“食材采购”“食品采购”“电器设备采购”“电子产品采购”“办公用品采购”“日用百货”“家居用品采购”“清洁用品采购”“服装采购”“药妆采购”“水费”“电费”“燃气费”“通讯费”“网络费”“交通费”“加油费”“停车费”“酒店住宿”“餐饮消费”“服务费”“维修费”“医疗保健”“教育培训”“订阅费”“软件服务”等。\n' +
    '- 电商多类目：归纳为大类（如“电子产品”“厨具”“办公用品”“家居用品”“清洁用品”等）。\n' +
    '- 单件大额商品（非食品）且单件金额 > 100 EUR：优先用具体商品名（如“微波炉”“显示器”“吸尘器”）。若无法确定单件金额，则退回使用大类。\n' +
    '\n请确保输出 JSON 结构包含：\n' +
    '{\n' +
    '  "company_name": "",\n' +
    '  "date": "",\n' +
    '  "invoice_no": "",\n' +
    '  "purpose": "",\n' +
    '  "purpose_short": "",\n' +
    '  "tva": "",\n' +
    '  "total_amount": "",\n' +
    '  "currency": ""\n' +
    '}\n'

  return p.trimEnd() + addon
}

function ensureRenameTemplateHasPurposeShort(tpl: string): string {
  if (tpl.includes('{purpose_short}')) return tpl
  const sep = tpl.includes('_') ? '_' : ' '

  if (tpl.includes('{invoice_no}')) {
    return tpl.replace('{invoice_no}', `{invoice_no}${sep}{purpose_short}`)
  }

  if (tpl.includes('{company}')) {
    return tpl.replace('{company}', `{company}${sep}{purpose_short}`)
  }

  const withoutExt = tpl.replace(/\.pdf$/i, '')
  return `${withoutExt}${sep}{purpose_short}.pdf`
}

export function getPrompt(): string {
  const saved = localStorage.getItem(K.prompt)
  return ensurePromptHasPurposeShort(saved ?? defaultPrompt)
}

export function setPrompt(v: string) {
  localStorage.setItem(K.prompt, v)
}

export function getRenameTemplate(): string {
  const fallback = '{date} {company} {invoice_no} {purpose_short} {amount} {currency}.pdf'
  const saved = localStorage.getItem(K.renameTpl) ?? fallback
  return ensureRenameTemplateHasPurposeShort(saved)
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
