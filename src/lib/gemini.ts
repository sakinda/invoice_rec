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
