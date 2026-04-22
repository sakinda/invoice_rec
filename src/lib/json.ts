export function extractJsonObject(text: string): string {
  const t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fence?.[1]) return fence[1].trim()

  const start = t.indexOf('{')
  if (start < 0) return t
  let depth = 0
  for (let i = start; i < t.length; i++) {
    const c = t[i]
    if (c === '{') depth++
    if (c === '}') {
      depth--
      if (depth === 0) return t.slice(start, i + 1).trim()
    }
  }
  return t.slice(start).trim()
}

export function safeJsonParse<T>(text: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    const s = extractJsonObject(text)
    return { ok: true, value: JSON.parse(s) as T }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
