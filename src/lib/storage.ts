import type { CompanyPreferenceRule, GeminiModelId, ReconciledRuleItem } from './types'

const K = {
  apiKeys: 'invoice_rec_ai.api_keys',
  prompt: 'invoice_rec_ai.prompt',
  renameTpl: 'invoice_rec_ai.rename_tpl',
  modelId: 'invoice_rec_ai.model_id',
  experienceEnabled: 'invoice_rec_ai.experience_enabled',
  companyRules: 'invoice_rec_ai.company_rules'
} as const

export const defaultPrompt = `你是一个专业的跨国财务审计与数据提取专家。
请仔细分析我提供的发票文件（图片或PDF），并严格按照以下规则提取信息。

【提取字段与处理规则】
1. company_name (公司名称): 提取开具发票的销售方主体名称（最推荐方案）。必须去除多余的空格和换行符。
   - company_name_candidates (备选公司名列表): 字符串数组，提供最多 5 种不同视角的备选公司名称（如：1. 最推荐规范名；2. 营业执照/法律实体全称；3. 常用简称/品牌名；4. 母公司或集团名；5. 原文外文别名）。第1项必须与 company_name 一致。
2. date (发票日期): 统一格式化为 "YYYY-MM-DD"。如果原日期是其他格式（如 DD/MM/YYYY 或拼写出的月份），请务必转换。
3. invoice_no (发票号): 完整保留原文的发票号码，包括任何字母前缀和连字符（如 FR-2024-001），不可擅自改写或缩减。
4. purpose (发票用途): 提取购买的商品主体名称和数量（最推荐方案）。
   - 如果原文是法语或其他外语，请准确翻译成尽量精简的中文。
   - 格式统一为：“商品名称 x数量”（例如：“木质A4夹板夹 x6”）。如果一张发票包含多个不同的商品，请用逗号将它们连接起来。
   - purpose_candidates (备选用途列表): 字符串数组，提供最多 5 种不同侧重点的备选用途方案（如：1. 匹配用户个性化规则的最优方案；2. 详尽商品明细与数量；3. 双语对照；4. 概括性业务大类；5. 原文摘录等）。最多5条，第1项必须与 purpose 一致。
5. purpose_short (用途精简，用于文件命名): 将用途提炼为便于检索的短语（中文为主），不要超过 48 个字符（最推荐方案）。
   - 【强制禁令】禁止任何形式的“YYYY-MM 上半月”或“YYYY-MM 下半月”类表述作为兜底（即使后面不跟“食品采购”等后缀也禁止）。
     - 【唯一例外】仅当 company_name 同时满足以下两个条件时，才允许使用“YYYY-MM 上半月 食品采购”或“YYYY-MM 下半月 食品采购”：
       1) company_name 为 “EUROPE CHINA”（大小写不敏感）。
       2) 发票内容中明确体现半月/周期性采购（例如文本中直接写明“上半月 / 下半月 / 半月订单 / 半个月 / 两次配送周期”等可证实的周期描述）。
     - 除上述例外以外，绝对禁止出现“YYYY-MM 上半月 / YYYY-MM 下半月 / 半月”这类时间区间推测；无法确定时要么留白，要么输出更稳妥的大致类别，例如“食材采购”、“食品采购”、“电器设备采购”、“电子产品采购”、“办公用品采购”、“日用百货”、“家居用品采购”、“清洁用品采购”、“服装采购”、“药妆采购”、“水费”、“电费”、“燃气费”、“通讯费”、“网络费”、“交通费”、“加油费”、“停车费”、“酒店住宿”、“餐饮消费”、“服务费”、“维修费”、“医疗保健”、“教育培训”、“订阅费”、“软件服务”等。
   - 电商平台购买多个类目：归纳为大类（如“电子产品”、“厨具”、“办公用品”、“家居用品”、“清洁用品”等）。
   - 若存在单件大额商品（非食品）且单件金额 > 100 EUR：优先用具体商品名（如“微波炉”、“显示器”、“吸尘器”）。若无法确定单件金额，则退回使用大类。
   - purpose_short_candidates (备选精简用途列表): 字符串数组，提供最多 5 种不同风格的精简备选（如：1. 最推荐精简用途；2. 核心大类标签；3. 关键单品名称；4. 双语简短标签；5. 紧凑分类标签等）。所有备选均不得超过 48 个字符，且第1项必须与 purpose_short 一致。
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
  "company_name_candidates": ["", ""],
  "date": "",
  "invoice_no": "",
  "purpose": "",
  "purpose_candidates": ["", ""],
  "purpose_short": "",
  "purpose_short_candidates": ["", ""],
  "tva": "",
  "total_amount": "",
  "currency": ""
}
`

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
  const marker = '【强制禁令】禁止任何形式的“YYYY-MM 上半月”或“YYYY-MM 下半月”类表述作为兜底';
  if (p.includes(marker) && p.includes('purpose_short')) return p;

  const patchNo = p.includes('purpose_short')
    ? ''
    : '\n\n【新增字段: purpose_short（用途精简，用于文件命名）】\n' +
      '- 输出 JSON 中必须包含字段 "purpose_short"。\n' +
      '- 若无法确定，请返回 "[]"（不要留空）。\n' +
      '- 不要超过 48 个字符。\n' +
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
      '}\n';

  const addon =
    patchNo +
    (patchNo ? '\n' : '\n\n【purpose_short 强规则补丁】\n') +
    '- 【强制禁令】禁止任何形式的“YYYY-MM 上半月”或“YYYY-MM 下半月”类表述作为兜底（即使后面不跟“食品采购”等后缀也禁止）。\n' +
    '  - 【唯一例外】仅当 company_name 同时满足以下两个条件时，才允许使用“YYYY-MM 上半月 食品采购”或“YYYY-MM 下半月 食品采购”：\n' +
    '    1) company_name 为 “EUROPE CHINA”（大小写不敏感）。\n' +
    '    2) 发票内容中明确体现半月/周期性采购（例如文本中直接写明“上半月 / 下半月 / 半月订单 / 半个月 / 两次配送周期”等可证实的周期描述）。\n' +
    '  - 除上述例外以外，绝对禁止出现“YYYY-MM 上半月 / YYYY-MM 下半月 / 半月”这类时间区间推测；无法确定时要么留白，要么输出更稳妥的大致类别，例如“食材采购”“食品采购”“电器设备采购”“电子产品采购”“办公用品采购”“日用百货”“家居用品采购”“清洁用品采购”“服装采购”“药妆采购”“水费”“电费”“燃气费”“通讯费”“网络费”“交通费”“加油费”“停车费”“酒店住宿”“餐饮消费”“服务费”“维修费”“医疗保健”“教育培训”“订阅费”“软件服务”等。\n' +
    '- 电商多类目：归纳为大类（如“电子产品”“厨具”“办公用品”“家居用品”“清洁用品”等）。\n' +
    '- 单件大额商品（非食品）且单件金额 > 100 EUR：优先用具体商品名（如“微波炉”“显示器”“吸尘器”）。若无法确定单件金额，则退回使用大类。\n';

  return p.trimEnd() + addon;
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

function ensurePromptHasCandidates(p: string): string {
  if (p.includes('company_name_candidates') && p.includes('purpose_candidates') && p.includes('purpose_short_candidates')) {
    return p
  }

  const patch =
    '\n\n【多候选备选方案要求 (candidates)】\n' +
    '为了提供更丰富的选择，请针对“公司名 (company_name)”、“用途 (purpose)”和“用途精简 (purpose_short)”分别提供最多 5 种不同视角的备选方案数组，并确保最推荐的方案置于数组首位（index 0），且与主字段完全一致：\n' +
    '1. "company_name_candidates": 最多5个备选公司名（如：规范名称、全称/法律实体、简称/常用名、母公司/外文别名等）。\n' +
    '2. "purpose_candidates": 最多5个备选用途（如：个性化规则推荐、具体品名x数量、双语对照、概括大类、原文摘录等）。\n' +
    '3. "purpose_short_candidates": 最多5个备选精简用途（如：最推荐短语、核心类别、重点单品、双语短语等，均<=48字符）。\n' +
    '\n请确保返回的 JSON 结构包含以下字段：\n' +
    '{\n' +
    '  "company_name": "",\n' +
    '  "company_name_candidates": [],\n' +
    '  "date": "",\n' +
    '  "invoice_no": "",\n' +
    '  "purpose": "",\n' +
    '  "purpose_candidates": [],\n' +
    '  "purpose_short": "",\n' +
    '  "purpose_short_candidates": [],\n' +
    '  "tva": "",\n' +
    '  "total_amount": "",\n' +
    '  "currency": ""\n' +
    '}\n'

  return p.trimEnd() + patch
}

export function getPrompt(): string {
  const saved = localStorage.getItem(K.prompt)
  const p = ensurePromptHasPurposeShort(saved ?? defaultPrompt)
  const upgraded = p
    .replaceAll('14 个汉字（或 24 个字符）', '48 个字符')
    .replaceAll('14 个汉字（或 24 字符）', '48 个字符')
    .replaceAll('14汉字或24字符', '48字符')
  return ensurePromptHasCandidates(upgraded)
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

export function getExperienceEnabled(): boolean {
  const v = localStorage.getItem(K.experienceEnabled)
  if (v === null) return true // 默认开启
  return v === 'true'
}

export function setExperienceEnabled(v: boolean) {
  localStorage.setItem(K.experienceEnabled, String(v))
}

export function getCompanyRules(): CompanyPreferenceRule[] {
  try {
    const raw = localStorage.getItem(K.companyRules)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    console.error('Failed to parse company rules from localStorage', e)
    return []
  }
}

export function saveCompanyRules(rules: CompanyPreferenceRule[]) {
  localStorage.setItem(K.companyRules, JSON.stringify(rules))
}

export function upsertCompanyRule(
  rule: Omit<CompanyPreferenceRule, 'id' | 'updatedAt'> & { id?: string }
): CompanyPreferenceRule {
  const current = getCompanyRules()
  const now = Date.now()
  const id = rule.id || `rule_${now}_${Math.random().toString(36).slice(2, 7)}`

  const existingIdx = current.findIndex(r => r.id === id || r.company.trim().toLowerCase() === rule.company.trim().toLowerCase())
  const newRule: CompanyPreferenceRule = {
    id: existingIdx >= 0 ? current[existingIdx].id : id,
    company: rule.company.trim(),
    aliases: rule.aliases?.map(a => a.trim()).filter(Boolean) ?? [],
    rule: rule.rule.trim(),
    purpose_short_rule: rule.purpose_short_rule?.trim() || undefined,
    examples: rule.examples ?? (existingIdx >= 0 ? current[existingIdx].examples : []),
    enabled: rule.enabled ?? true,
    updatedAt: now
  }

  if (existingIdx >= 0) {
    current[existingIdx] = newRule
  } else {
    current.unshift(newRule)
  }

  saveCompanyRules(current)
  return newRule
}

export function deleteCompanyRule(id: string) {
  const current = getCompanyRules()
  const filtered = current.filter(r => r.id !== id)
  saveCompanyRules(filtered)
}

export function exportRulesJson(): string {
  const rules = getCompanyRules()
  return JSON.stringify({
    version: 1,
    exportDate: new Date().toISOString(),
    rules
  }, null, 2)
}

export function importRulesJson(jsonStr: string): { success: boolean; count: number; error?: string } {
  try {
    const data = JSON.parse(jsonStr)
    const list = Array.isArray(data) ? data : data?.rules
    if (!Array.isArray(list)) {
      return { success: false, count: 0, error: '导入的 JSON 必须包含规则数组' }
    }

    const current = getCompanyRules()
    let count = 0
    for (const item of list) {
      if (!item || typeof item.company !== 'string' || !item.rule) continue
      const existingIdx = current.findIndex(
        r => r.id === item.id || r.company.trim().toLowerCase() === item.company.trim().toLowerCase()
      )
      const formatted: CompanyPreferenceRule = {
        id: item.id || `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        company: String(item.company).trim(),
        aliases: Array.isArray(item.aliases) ? item.aliases.map(String) : [],
        rule: String(item.rule).trim(),
        purpose_short_rule: item.purpose_short_rule ? String(item.purpose_short_rule).trim() : undefined,
        examples: Array.isArray(item.examples) ? item.examples : [],
        enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
        updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now()
      }

      if (existingIdx >= 0) {
        current[existingIdx] = formatted
      } else {
        current.push(formatted)
      }
      count++
    }

    saveCompanyRules(current)
    return { success: true, count }
  } catch (e: any) {
    return { success: false, count: 0, error: e?.message || 'JSON 解析失败' }
  }
}

export function parseImportRules(jsonStr: string): { success: boolean; rules: CompanyPreferenceRule[]; error?: string } {
  try {
    const data = JSON.parse(jsonStr)
    const list = Array.isArray(data) ? data : data?.rules
    if (!Array.isArray(list)) {
      return { success: false, rules: [], error: '导入的 JSON 文件缺少有效的规则数组' }
    }

    const rules: CompanyPreferenceRule[] = []
    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      if (!item || typeof item.company !== 'string' || !item.rule) continue
      rules.push({
        id: item.id || `imp_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        company: String(item.company).trim(),
        aliases: Array.isArray(item.aliases) ? item.aliases.map(String).filter(Boolean) : [],
        rule: String(item.rule).trim(),
        purpose_short_rule: item.purpose_short_rule ? String(item.purpose_short_rule).trim() : undefined,
        examples: Array.isArray(item.examples) ? item.examples : [],
        enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
        updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now()
      })
    }

    if (rules.length === 0) {
      return { success: false, rules: [], error: 'JSON 文件中未找到有效的公司偏好规则条目' }
    }

    return { success: true, rules }
  } catch (e: any) {
    return { success: false, rules: [], error: `JSON 解析失败: ${e?.message || e}` }
  }
}

export function applyApprovedImportRules(items: ReconciledRuleItem[]): {
  updatedCount: number
  newCount: number
  untouchedCount: number
} {
  const current = getCompanyRules()
  const approved = items.filter(it => it.approved)
  let updatedCount = 0
  let newCount = 0

  const now = Date.now()

  for (const item of approved) {
    // 寻找本地对应规则
    const localIdx = current.findIndex(
      r => (item.localRule && r.id === item.localRule.id) ||
           r.company.trim().toLowerCase() === item.company.trim().toLowerCase() ||
           (item.localRule && r.company.trim().toLowerCase() === item.localRule.company.trim().toLowerCase())
    )

    if (item.selectedStrategy === 'keep_local') {
      // 保持本地不变
      continue
    }

    if (item.selectedStrategy === 'take_imported') {
      const formatted: CompanyPreferenceRule = {
        id: localIdx >= 0 ? current[localIdx].id : item.importedRule.id || `rule_${now}_${Math.random().toString(36).slice(2, 6)}`,
        company: item.importedRule.company.trim(),
        aliases: item.importedRule.aliases || [],
        rule: item.importedRule.rule.trim(),
        purpose_short_rule: item.importedRule.purpose_short_rule?.trim() || undefined,
        examples: item.importedRule.examples || (localIdx >= 0 ? current[localIdx].examples : []),
        enabled: item.importedRule.enabled ?? true,
        updatedAt: now
      }

      if (localIdx >= 0) {
        current[localIdx] = formatted
        updatedCount++
      } else {
        current.push(formatted)
        newCount++
      }
      continue
    }

    // 默认或 ai_merged
    const mergedRuleText = item.customRuleText.trim()
    const mergedShortRule = item.customShortRuleText.trim() || undefined

    const mergedEntry: CompanyPreferenceRule = {
      id: localIdx >= 0 ? current[localIdx].id : item.importedRule.id || `rule_${now}_${Math.random().toString(36).slice(2, 6)}`,
      company: item.company.trim(),
      aliases: item.aliases,
      rule: mergedRuleText,
      purpose_short_rule: mergedShortRule,
      examples: [
        ...(localIdx >= 0 && current[localIdx].examples ? current[localIdx].examples! : []),
        ...(item.importedRule.examples || [])
      ].slice(-5),
      enabled: true,
      updatedAt: now
    }

    if (localIdx >= 0) {
      current[localIdx] = mergedEntry
      updatedCount++
    } else {
      current.push(mergedEntry)
      newCount++
    }
  }

  saveCompanyRules(current)
  return {
    updatedCount,
    newCount,
    untouchedCount: current.length - updatedCount - newCount
  }
}

export function buildExperiencePromptSection(): string {
  if (!getExperienceEnabled()) return ''
  const rules = getCompanyRules().filter(r => r.enabled)
  if (rules.length === 0) return ''

  const lines: string[] = [
    '【用户偏好与公司特定规则经验库（最高优先级）】',
    '以下是用户针对特定公司开具的发票所沉淀的个性化提取偏好规则。',
    '当识别的发票开具方（company_name）匹配下列任意公司名称或其别名时，必须无条件优先遵循其对应规则，生成匹配用户偏好的 purpose 与 purpose_short：'
  ]

  for (const r of rules) {
    const aliasStr = r.aliases && r.aliases.length > 0 ? `（包含别名: ${r.aliases.join(' / ')}）` : ''
    lines.push(`- 公司: ${r.company} ${aliasStr}`)
    lines.push(`  * 用途要求: ${r.rule}`)
    if (r.purpose_short_rule) {
      lines.push(`  * 精简用途要求: ${r.purpose_short_rule}`)
    }
  }

  return '\n\n' + lines.join('\n')
}

export function getEffectivePrompt(): string {
  const base = getPrompt()
  const section = buildExperiencePromptSection()
  return base + section
}
