import type { GeminiModelId, InvoiceExtract } from './types'
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

  return {
    company_name: String(v.company_name ?? '').trim().replace(/\s+/g, ' '),
    date: String(v.date ?? '').trim(),
    invoice_no: String(v.invoice_no ?? '').trim(),
    purpose: String(v.purpose ?? '').trim().replace(/\s+/g, ' '),
    purpose_short: purposeShortFinal,
    tva: String(v.tva ?? '').trim(),
    total_amount: String(v.total_amount ?? '').trim(),
    currency: String(v.currency ?? '').trim().toUpperCase()
  }
}

export function pickApiKeyRoundRobin(keys: string[], index: number): string {
  if (keys.length === 0) return ''
  return keys[index % keys.length]
}

export type DistillExperienceInput = {
  apiKey: string
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
}

export type DistilledRuleResult = {
  company: string
  aliases: string[]
  rule: string
  purpose_short_rule: string
  explanation: string
}

export async function distillExperienceRule(opts: DistillExperienceInput): Promise<DistilledRuleResult> {
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
  )}:generateContent?key=${encodeURIComponent(opts.apiKey)}`

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
