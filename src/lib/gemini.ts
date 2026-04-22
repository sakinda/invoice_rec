import type { GeminiModelId, InvoiceExtract } from './types'
import { safeJsonParse } from './json'

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
    throw new Error(`Gemini API 请求失败: ${resp.status} ${resp.statusText} ${t}`.trim())
  }

  const json = (await resp.json()) as any
  const text =
    json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join('\n') ??
    json?.candidates?.[0]?.content?.parts?.[0]?.text ??
    ''

  const parsed = safeJsonParse<InvoiceExtract>(text)
  if (!parsed.ok) throw new Error(`解析 JSON 失败: ${parsed.error}`)

  const v = parsed.value
  return {
    company_name: String(v.company_name ?? '').trim().replace(/\s+/g, ' '),
    date: String(v.date ?? '').trim(),
    invoice_no: String(v.invoice_no ?? '').trim(),
    purpose: String(v.purpose ?? '').trim().replace(/\s+/g, ' '),
    tva: String(v.tva ?? '').trim(),
    total_amount: String(v.total_amount ?? '').trim(),
    currency: String(v.currency ?? '').trim().toUpperCase()
  }
}

export function pickApiKeyRoundRobin(keys: string[], index: number): string {
  if (keys.length === 0) return ''
  return keys[index % keys.length]
}
