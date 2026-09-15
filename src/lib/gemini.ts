import type { CompanyPreferenceRule, GeminiModelId, InvoiceExtract, ReconciledRuleItem } from './types'
import { safeJsonParse } from './json'

type GeminiRetryInfo = {
  status: number
  retryAfterSeconds?: number
  raw?: string
}

export class GeminiApiError extends Error {
  status: number
  retryAfterSeconds?: number
  raw?: string

  constructor(message: string, info: GeminiRetryInfo) {
    super(message)
    this.name = 'GeminiApiError'
    this.status = info.status
    this.retryAfterSeconds = info.retryAfterSeconds
    this.raw = info.raw
  }
}

function parseRetryAfterSeconds(payload: any, fallbackText: string): number | undefined {
  const details: any[] = payload?.error?.details ?? payload?.details ?? []
  const retry = details.find(d => typeof d?.retryDelay === 'string')?.retryDelay
  if (typeof retry === 'string') {
    const m = retry.match(/([0-9]+(?:\.[0-9]+)?)s/)
    if (m) return Math.ceil(Number(m[1]))
  }

  const m2 = fallbackText.match(/retry in\s+([0-9]+(?:\.[0-9]+)?)s/i)
  if (m2) return Math.ceil(Number(m2[1]))

  return undefined
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error('读取文件失败'))
    r.onload = () => {
      const res = String(r.result ?? '')
      const idx = res.indexOf('base64,')
      resolve(idx >= 0 ? res.slice(idx + 7) : res)
    }
    r.readAsDataURL(blob)
  })
}

function normalizeCandidates(primary: string, rawCandidates: any, maxLen = 5, itemLimiter?: (s: string) => string): string[] {
  const list: string[] = []
  let normPrimary = primary.trim()
  if (itemLimiter && normPrimary) normPrimary = itemLimiter(normPrimary)
  if (normPrimary) {
    list.push(normPrimary)
  }

  if (Array.isArray(rawCandidates)) {
    for (const item of rawCandidates) {
      if (!item || typeof item !== 'string') continue
      let cleaned = item.trim().replace(/\s+/g, ' ')
      if (itemLimiter) cleaned = itemLimiter(cleaned)
      if (cleaned && !list.includes(cleaned)) {
        list.push(cleaned)
      }
      if (list.length >= maxLen) break
    }
  }

  return list.slice(0, maxLen)
}

export async function extractInvoiceByGemini(opts: {
  apiKey: string
  modelId: GeminiModelId
  prompt: string
  pdfBlob: Blob
}): Promise<InvoiceExtract> {
  const b64 = await blobToBase64(opts.pdfBlob)

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    opts.modelId
  )}:generateContent?key=${encodeURIComponent(opts.apiKey)}`

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: opts.prompt },
            {
              inline_data: {
                mime_type: 'application/pdf',
                data: b64
              }
            }
          ]
        }
      ],
      generationConfig: { temperature: 0 }
    })
  })

  if (!resp.ok) {
    const t = await resp.text().catch(() => '')
    let payload: any = undefined
    try {
      payload = t ? JSON.parse(t) : undefined
    } catch {
      payload = undefined
    }

    const retryAfterSeconds = parseRetryAfterSeconds(payload, t)
    const msg = `Gemini API 请求失败: ${resp.status} ${resp.statusText} ${t}`.trim()
    throw new GeminiApiError(msg, { status: resp.status, retryAfterSeconds, raw: t })
  }

  const json = (await resp.json()) as any
  const text =
    json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join('\n') ??
    json?.candidates?.[0]?.content?.parts?.[0]?.text ??
    ''

  const parsed = safeJsonParse<InvoiceExtract>(text)
  if (!parsed.ok) throw new Error(`解析 JSON 失败: ${parsed.error}`)

  const v = parsed.value as any
  const purposeShortRaw = v.purpose_short ?? v.purpose_brief ?? v.purpose_compact ?? ''

  const purposeShortNorm = String(purposeShortRaw ?? '').trim().replace(/\s+/g, ' ')
  const purposeShortLimited = Array.from(purposeShortNorm).slice(0, 24).join('')
  const purposeShortFinal = purposeShortLimited.length > 0 ? purposeShortLimited : '[]'

  const company = String(v.company_name ?? '').trim().replace(/\s+/g, ' ')
  const purpose = String(v.purpose ?? '').trim().replace(/\s+/g, ' ')

  const companyCandidates = normalizeCandidates(company, v.company_name_candidates, 5)
  const purposeCandidates = normalizeCandidates(purpose, v.purpose_candidates, 5)
  const purposeShortCandidates = normalizeCandidates(
    purposeShortFinal,
    v.purpose_short_candidates,
    5,
    s => Array.from(s).slice(0, 24).join('')
  )

  return {
    company_name: company || (companyCandidates[0] ?? ''),
    company_name_candidates: companyCandidates,
    date: String(v.date ?? '').trim(),
    invoice_no: String(v.invoice_no ?? '').trim(),
    purpose: purpose || (purposeCandidates[0] ?? ''),
    purpose_candidates: purposeCandidates,
    purpose_short: purposeShortFinal || (purposeShortCandidates[0] ?? ''),
    purpose_short_candidates: purposeShortCandidates,
    tva: String(v.tva ?? '').trim(),
    total_amount: String(v.total_amount ?? '').trim(),
    currency: String(v.currency ?? '').trim().toUpperCase()
  }
}

export function pickApiKeyRoundRobin(keys: string[], index: number): string {
  if (keys.length === 0) return ''
  return keys[index % keys.length]
}

type KeyCooldownState = {
  nextAvailableAt: number
}

const globalKeyState = new Map<string, KeyCooldownState>()
let globalKeyCursor = 0

export function resetGlobalKeyState() {
  globalKeyState.clear()
}

export async function executeWithKeyRotation<T>(opts: {
  keys: string[]
  actionName?: string
  fn: (apiKey: string, keyIndex: number) => Promise<T>
  onStatusChange?: (msg: string) => void
}): Promise<T> {
  const { keys, actionName = '请求', fn, onStatusChange } = opts
  if (!keys || keys.length === 0) {
    throw new Error('未配置 API Key，请先在设置中配置')
  }

  let lastErr: unknown = undefined
  const total = keys.length

  for (let attempt = 0; attempt < total; attempt++) {
    const now = Date.now()
    const start = globalKeyCursor % total
    let selectedKey: string | null = null
    let selectedIdx = 0

    // 挑选当前未处于冷却期的 key
    for (let i = 0; i < total; i++) {
      const idx = (start + i) % total
      const k = keys[idx]
      const s = globalKeyState.get(k)
      if (!s || s.nextAvailableAt <= now) {
        selectedKey = k
        selectedIdx = idx
        globalKeyCursor = idx + 1
        break
      }
    }

    // 若全部 key 都在冷却中，检查等待时间
    if (!selectedKey) {
      const times = keys.map(k => globalKeyState.get(k)?.nextAvailableAt ?? 0).filter(t => t > now)
      if (times.length > 0) {
        const waitMs = Math.max(0, Math.min(...times) - now)
        const waitSec = Math.ceil(waitMs / 1000)
        if (waitMs <= 20000) {
          onStatusChange?.(`所有 API Key 均处于限流冷却中，等待 ${waitSec}s 后重试...`)
          await new Promise(r => setTimeout(r, waitMs + 250))
          continue
        } else {
          throw new Error(`所有 ${total} 个 API Key 均达限流或配额上限，需等待约 ${waitSec}s，请稍后再试`)
        }
      }
      throw new Error(`所有 ${total} 个 API Key 均不可用`)
    }

    const keyNumber = selectedIdx + 1
    onStatusChange?.(`${actionName}: 正在使用 API Key ${keyNumber}/${total}...`)

    try {
      const res = await fn(selectedKey, keyNumber)
      lastErr = undefined
      return res
    } catch (e: any) {
      lastErr = e
      if (e instanceof GeminiApiError) {
        const retrySec = e.retryAfterSeconds && e.retryAfterSeconds > 0 ? e.retryAfterSeconds : 30
        if (e.status === 429) {
          globalKeyState.set(selectedKey, { nextAvailableAt: Date.now() + retrySec * 1000 + 300 })
          onStatusChange?.(`API Key ${keyNumber} 限流 (429)，冷却 ${retrySec}s，自动切换下一个 Key...`)
          continue
        }
        if (e.status >= 500 && e.status < 600) {
          globalKeyState.set(selectedKey, { nextAvailableAt: Date.now() + 3000 })
          onStatusChange?.(`API Key ${keyNumber} 服务端错误 (${e.status})，自动切换下一个 Key...`)
          continue
        }
      }
      if (attempt < total - 1) {
        onStatusChange?.(`API Key ${keyNumber} 失败，自动切换下一个 Key...`)
        continue
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

export type DistillExperienceInput = {
  apiKey?: string
  apiKeys?: string[]
  modelId: GeminiModelId
  company: string
  originalPurpose?: string
  userPurpose?: string
  originalShort?: string
  userShort?: string
  date?: string
  invoiceNo?: string
  existingRule?: {
    rule: string
    purpose_short_rule?: string
    aliases?: string[]
  }
  onStatusChange?: (msg: string) => void
}

export type DistilledRuleResult = {
  company: string
  aliases: string[]
  rule: string
  purpose_short_rule: string
  explanation: string
}

export async function distillExperienceRule(opts: DistillExperienceInput): Promise<DistilledRuleResult> {
  // 如果提供了 apiKeys 数组，则自动启用轮替与限流容错
  if (opts.apiKeys && opts.apiKeys.length > 0) {
    return executeWithKeyRotation({
      keys: opts.apiKeys,
      actionName: '语义提炼',
      onStatusChange: opts.onStatusChange,
      fn: (key) => distillExperienceRule({ ...opts, apiKey: key, apiKeys: undefined })
    })
  }

  const apiKey = opts.apiKey
  if (!apiKey) {
    throw new Error('未提供 API Key 进行语义提炼')
  }

  const prompt = `你是一个专业的规则提炼专家。
用户在处理发票识别系统时，对大模型初始提取的“用途（purpose）”或“精简用途（purpose_short）”进行了手动修改。
请根据开票公司、发票日期、大模型原提取内容、用户的最终修改，以及该公司已有的历史规则（如果有），提炼或迭代出一套通用的偏好规则，以便大模型未来处理该公司发票时直接遵循。

【输入信息】
- 公司名称: ${opts.company || '未知公司'}
- 发票日期: ${opts.date || '未知'}
- 发票号: ${opts.invoiceNo || '未知'}
- 大模型初始提取:
  * 用途(purpose): "${opts.originalPurpose || ''}"
  * 精简用途(purpose_short): "${opts.originalShort || ''}"
- 用户手动修改为:
  * 用途(purpose): "${opts.userPurpose || ''}"
  * 精简用途(purpose_short): "${opts.userShort || ''}"
${
  opts.existingRule
    ? `- 该公司目前已有的历史规则:
  * 既有用途规则: "${opts.existingRule.rule || ''}"
  * 既有精简用途规则: "${opts.existingRule.purpose_short_rule || ''}"
  * 既有别名: "${(opts.existingRule.aliases || []).join(', ')}"`
    : '- 目前尚无针对该公司的历史规则（这是第一次沉淀）'
}

【提炼与融合要求】
1. 分析用户修改的深层意图：
   - 是否包含特定动态占位符（例如用户填入了 "2024-05"，而发票日期是 2024-05-12，则应抽象为通用的 "YYYY-MM" 或所属账单年月）？
   - 是否有双语偏好（如法语+中文、特定前缀等）？
   - 是否属于特定业务大类（如“电费”、“燃气费”、“耗材采购”）？
2. 智能融合（若存在已有历史规则）：
   - 请将已有规则与本次新修改进行有机融合，保持全面、和谐且互不矛盾。例如：若以前有电费规则，本次是燃气费，应整合为“根据购买内容区分：若是电费则...；若是燃气则...”。
   - 若本次修改属于对旧规则的纠偏或更优表达，则以更优规范为准。
3. 输出要求：
   - "company": 规范的公司名称。
   - "aliases": 识别或补充该公司的常见变体/别名（字符串数组，如包含不同大小写、缩写或空格变体）。
   - "rule": 用途(purpose)提取的通用规范说明，语言精炼明确，指导大模型如何生成期望格式。
   - "purpose_short_rule": 精简用途(purpose_short)的规范（用于生成文件名，通常不超过14个汉字或24字符）。
   - "explanation": 简短说明本次提炼/融合的核心逻辑（1句话，中文）。

【输出格式】
必须且只能返回纯 JSON，严禁包裹 Markdown 标记（如不要带 \`\`\`json）：
{
  "company": "",
  "aliases": [],
  "rule": "",
  "purpose_short_rule": "",
  "explanation": ""
}`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    opts.modelId
  )}:generateContent?key=${encodeURIComponent(apiKey)}`

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 }
    })
  })

  if (!resp.ok) {
    const t = await resp.text().catch(() => '')
    let payload: any = undefined
    try {
      payload = t ? JSON.parse(t) : undefined
    } catch {
      payload = undefined
    }
    const retryAfterSeconds = parseRetryAfterSeconds(payload, t)
    throw new GeminiApiError(`Gemini 提炼规则失败: ${resp.status} ${t}`, {
      status: resp.status,
      retryAfterSeconds,
      raw: t
    })
  }

  const json = (await resp.json()) as any
  const text =
    json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join('\n') ??
    json?.candidates?.[0]?.content?.parts?.[0]?.text ??
    ''

  const parsed = safeJsonParse<DistilledRuleResult>(text)
  if (!parsed.ok) throw new Error(`解析规则提炼 JSON 失败: ${parsed.error}`)

  const res = parsed.value
  return {
    company: String(res.company || opts.company).trim(),
    aliases: Array.isArray(res.aliases) ? res.aliases.map(a => String(a).trim()).filter(Boolean) : [],
    rule: String(res.rule || '').trim(),
    purpose_short_rule: String(res.purpose_short_rule || '').trim(),
    explanation: String(res.explanation || '提炼完成').trim()
  }
}

export type BatchReconcileInput = {
  apiKeys: string[]
  modelId: GeminiModelId
  importedRules: CompanyPreferenceRule[]
  localRules: CompanyPreferenceRule[]
  onStatusChange?: (msg: string) => void
}

export async function batchReconcileRules(opts: BatchReconcileInput): Promise<ReconciledRuleItem[]> {
  const { apiKeys, modelId, importedRules, localRules, onStatusChange } = opts

  if (importedRules.length === 0) return []

  // 本地简易对齐函数（作为无 API Key 或 LLM 异常时的安全降级容错）
  const fallbackReconcile = (): ReconciledRuleItem[] => {
    return importedRules.map(imp => {
      const impCompany = imp.company.trim().toLowerCase()
      const impAliases = (imp.aliases || []).map(a => a.trim().toLowerCase())

      const matchedLocal = localRules.find(loc => {
        const locCompany = loc.company.trim().toLowerCase()
        const locAliases = (loc.aliases || []).map(a => a.trim().toLowerCase())
        return (
          locCompany === impCompany ||
          locAliases.includes(impCompany) ||
          impAliases.includes(locCompany)
        )
      })

      if (!matchedLocal) {
        return {
          id: imp.id,
          company: imp.company,
          aliases: imp.aliases || [],
          type: 'new',
          importedRule: imp,
          suggestedRule: {
            rule: imp.rule,
            purpose_short_rule: imp.purpose_short_rule,
            aliases: imp.aliases,
            explanation: '本地尚无该公司记录，作为全新条目直接新增'
          },
          selectedStrategy: 'take_imported',
          customRuleText: imp.rule,
          customShortRuleText: imp.purpose_short_rule || '',
          approved: true
        }
      }

      const isIdentical =
        matchedLocal.rule.trim() === imp.rule.trim() &&
        (matchedLocal.purpose_short_rule || '').trim() === (imp.purpose_short_rule || '').trim()

      const combinedAliases = Array.from(new Set([...(matchedLocal.aliases || []), ...(imp.aliases || [])]))

      return {
        id: imp.id,
        company: matchedLocal.company || imp.company,
        aliases: combinedAliases,
        type: isIdentical ? 'identical' : 'merged',
        localRule: matchedLocal,
        importedRule: imp,
        suggestedRule: {
          rule: isIdentical ? matchedLocal.rule : `${matchedLocal.rule}；${imp.rule}`,
          purpose_short_rule: matchedLocal.purpose_short_rule || imp.purpose_short_rule,
          aliases: combinedAliases,
          explanation: isIdentical ? '两端规则完全一致，无需变动' : '检测到同名公司规则存在差异，建议融合'
        },
        selectedStrategy: isIdentical ? 'keep_local' : 'ai_merged',
        customRuleText: isIdentical ? matchedLocal.rule : `${matchedLocal.rule}；${imp.rule}`,
        customShortRuleText: matchedLocal.purpose_short_rule || imp.purpose_short_rule || '',
        approved: true
      }
    })
  }

  // 若未配置 API Key，直接使用本地降级方案
  if (!apiKeys || apiKeys.length === 0) {
    onStatusChange?.('未检测到 API Key，使用本地规则匹配模式...')
    return fallbackReconcile()
  }

  const prompt = `你是一个专业的配置合并与数据同步专家。
用户在手机和电脑等多台设备之间同步发票提取经验规则。
请将用户勾选的【待导入规则列表 (importedRules)】与本设备【本地已有规则列表 (localRules)】进行语义比对、公司实体对齐，并将新旧存在差异的规则智能融合成不冲突的新版本。

【本地已有规则列表 (localRules)】:
${JSON.stringify(
  localRules.map(r => ({
    id: r.id,
    company: r.company,
    aliases: r.aliases,
    rule: r.rule,
    purpose_short_rule: r.purpose_short_rule
  })),
  null,
  2
)}

【待导入规则列表 (importedRules)】:
${JSON.stringify(
  importedRules.map(r => ({
    id: r.id,
    company: r.company,
    aliases: r.aliases,
    rule: r.rule,
    purpose_short_rule: r.purpose_short_rule
  })),
  null,
  2
)}

【处理要求】
请针对【待导入规则列表】中的每一个规则条目进行判定：
1. 公司实体对齐：比对公司全称、简称、常见别名（例如 "TotalEnergies"、"Total Energies"、"TOTALENERGIES MARKETING" 应视为同一家公司）。
2. 类型分类 (type)：
   - "new"：本地完全没有该公司，属于全新导入条目。
   - "identical"：本地有该公司，且用途规则与精简规则完全相同或语义完全一致。
   - "merged"：本地已有该公司，但两端规则有差异（例如一台设备增加了燃气费，另一台只写了电费，或格式略有不同）。
3. 智能融合要求（仅当 type 为 "merged" 时）：
   - 将本地旧规则与导入新规则进行有机融合，生成一份兼顾两端场景、语言精炼且无内在矛盾的综合规则；
   - 提取更规范的公司名称，并合并整理双方的别名数组；
   - 给出一句简短的融合说明（explanation），告知用户融合了哪些改动。
4. 输出要求：
   必须且仅返回合法的 JSON 数组，严禁包含任何 Markdown 格式包裹（不要用 \`\`\`json 等）：
   [
     {
       "imported_id": "待导入条目的id",
       "matched_local_id": "匹配到的本地条目id，未匹配到则为 null",
       "company": "规范公司名",
       "aliases": ["合并后的别名列表"],
       "type": "new" | "identical" | "merged",
       "merged_rule": "合并后的用途规则（若是new则填imported原本的rule）",
       "merged_purpose_short_rule": "合并后的精简用途规则",
       "explanation": "简短说明（中文）"
     }
   ]`

  try {
    const rawText = await executeWithKeyRotation({
      keys: apiKeys,
      actionName: '规则智能比对与合并',
      onStatusChange,
      fn: async (apiKey) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          modelId
        )}:generateContent?key=${encodeURIComponent(apiKey)}`

        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1 }
          })
        })

        if (!resp.ok) {
          const t = await resp.text().catch(() => '')
          let payload: any = undefined
          try {
            payload = t ? JSON.parse(t) : undefined
          } catch {
            payload = undefined
          }
          const retryAfterSeconds = parseRetryAfterSeconds(payload, t)
          throw new GeminiApiError(`Gemini 规则比对失败: ${resp.status} ${t}`, {
            status: resp.status,
            retryAfterSeconds,
            raw: t
          })
        }

        const json = (await resp.json()) as any
        return (
          json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join('\n') ??
          json?.candidates?.[0]?.content?.parts?.[0]?.text ??
          ''
        )
      }
    })

    const parsed = safeJsonParse<any[]>(rawText)
    if (!parsed.ok || !Array.isArray(parsed.value)) {
      console.warn('LLM reconcile output parse failed, falling back to local reconcile', parsed)
      return fallbackReconcile()
    }

    const planList = parsed.value
    const results: ReconciledRuleItem[] = []

    for (const imp of importedRules) {
      const plan = planList.find((p: any) => p?.imported_id === imp.id || p?.company?.toLowerCase() === imp.company.toLowerCase())
      if (!plan) {
        // 单项未在计划中，使用本地匹配兜底
        const matched = localRules.find(l => l.company.toLowerCase() === imp.company.toLowerCase())
        results.push({
          id: imp.id,
          company: imp.company,
          aliases: imp.aliases || [],
          type: matched ? 'merged' : 'new',
          localRule: matched,
          importedRule: imp,
          suggestedRule: {
            rule: matched ? `${matched.rule}；${imp.rule}` : imp.rule,
            purpose_short_rule: matched?.purpose_short_rule || imp.purpose_short_rule,
            aliases: imp.aliases,
            explanation: matched ? '本地对齐合并' : '新增规则'
          },
          selectedStrategy: matched ? 'ai_merged' : 'take_imported',
          customRuleText: matched ? `${matched.rule}；${imp.rule}` : imp.rule,
          customShortRuleText: matched?.purpose_short_rule || imp.purpose_short_rule || '',
          approved: true
        })
        continue
      }

      const matchedLocal = localRules.find(
        l => l.id === plan.matched_local_id || l.company.toLowerCase() === plan.company?.toLowerCase()
      )

      const type: 'merged' | 'new' | 'identical' =
        plan.type === 'merged' || plan.type === 'identical' || plan.type === 'new'
          ? plan.type
          : matchedLocal ? 'merged' : 'new'

      const ruleText = String(plan.merged_rule || imp.rule).trim()
      const shortRuleText = String(plan.merged_purpose_short_rule || imp.purpose_short_rule || '').trim()

      results.push({
        id: imp.id,
        company: String(plan.company || imp.company).trim(),
        aliases: Array.isArray(plan.aliases) ? plan.aliases.map(String) : imp.aliases || [],
        type,
        localRule: matchedLocal,
        importedRule: imp,
        suggestedRule: {
          rule: ruleText,
          purpose_short_rule: shortRuleText || undefined,
          aliases: Array.isArray(plan.aliases) ? plan.aliases.map(String) : undefined,
          explanation: String(plan.explanation || (type === 'new' ? '全新条目' : '规则已融合')).trim()
        },
        selectedStrategy: type === 'merged' ? 'ai_merged' : type === 'identical' ? 'keep_local' : 'take_imported',
        customRuleText: ruleText,
        customShortRuleText: shortRuleText,
        approved: true
      })
    }

    return results
  } catch (err) {
    console.error('Batch reconcile error, using fallback:', err)
    onStatusChange?.('AI 识别异常，已切换为本地快速匹配模式')
    return fallbackReconcile()
  }
}
