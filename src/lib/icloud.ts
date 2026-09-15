import type { CompanyPreferenceRule } from './types'
import { parseImportRules } from './storage'

export const ICLOUD_DEFAULT_FILENAME = 'invoice_skills_icloud.json'

export type ICloudStatus = {
  available: boolean
  fileExists: boolean
  updatedAt: number | null
  path?: string
  error?: string
}

export async function checkICloudStatus(): Promise<ICloudStatus> {
  try {
    const res = await fetch('/api/icloud-status')
    if (!res.ok) {
      return { available: false, fileExists: false, updatedAt: null }
    }
    const data = await res.json()
    return {
      available: Boolean(data.available),
      fileExists: Boolean(data.fileExists),
      updatedAt: data.updatedAt ? Number(data.updatedAt) : null,
      path: data.path
    }
  } catch (err: any) {
    return { available: false, fileExists: false, updatedAt: null, error: err?.message }
  }
}

export async function fetchICloudRulesJson(): Promise<{
  success: boolean
  exists: boolean
  content?: string
  updatedAt?: number
  error?: string
}> {
  try {
    const res = await fetch('/api/icloud-rules')
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      return { success: false, exists: false, error: `请求失败 (${res.status}): ${txt}` }
    }
    const data = await res.json()
    if (!data.success) {
      return { success: false, exists: false, error: data.error || '读取 iCloud 失败' }
    }
    if (!data.exists) {
      return { success: true, exists: false }
    }
    return {
      success: true,
      exists: true,
      content: data.content,
      updatedAt: data.updatedAt
    }
  } catch (err: any) {
    return { success: false, exists: false, error: err?.message || '无法连接到服务' }
  }
}

/**
 * 智能防覆盖合并：将本地规则与 iCloud 原有内容进行并集合并
 */
function mergeRulesWithoutOverwrite(
  localRules: CompanyPreferenceRule[],
  remoteRules: CompanyPreferenceRule[]
): CompanyPreferenceRule[] {
  const result = [...localRules]

  for (const remote of remoteRules) {
    const lowerRemote = remote.company.trim().toLowerCase()
    const idx = result.findIndex(
      loc =>
        loc.company.trim().toLowerCase() === lowerRemote ||
        loc.aliases?.some(a => a.trim().toLowerCase() === lowerRemote)
    )

    if (idx < 0) {
      // 本地完全没有该条目，保留远程条目（增量补充）
      result.push(remote)
    } else {
      // 双方都有：若远程更新时间晚于本地，且内容不同，做字段融合
      const local = result[idx]
      const combinedAliases = Array.from(
        new Set([...(local.aliases || []), ...(remote.aliases || [])])
      )
      const isRemoteNewer = (remote.updatedAt || 0) > (local.updatedAt || 0)

      result[idx] = {
        id: local.id,
        company: isRemoteNewer ? remote.company : local.company,
        aliases: combinedAliases,
        rule: isRemoteNewer && remote.rule ? remote.rule : local.rule,
        purpose_short_rule: isRemoteNewer
          ? remote.purpose_short_rule || local.purpose_short_rule
          : local.purpose_short_rule || remote.purpose_short_rule,
        examples: [
          ...(local.examples || []),
          ...(remote.examples || [])
        ].slice(-5),
        enabled: local.enabled,
        updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0) || Date.now()
      }
    }
  }

  return result
}

export async function backupToICloud(
  currentRules: CompanyPreferenceRule[]
): Promise<{
  success: boolean
  count: number
  viaDirect: boolean
  updatedAt: number
  error?: string
}> {
  // 1. 尝试通过本地 API 检查远端是否存在旧数据，进行防旧盖新合并
  let rulesToSave = currentRules
  let viaDirect = false

  try {
    const remoteResp = await fetchICloudRulesJson()
    if (remoteResp.success && remoteResp.exists && remoteResp.content) {
      const parsedRemote = parseImportRules(remoteResp.content)
      if (parsedRemote.success && parsedRemote.rules.length > 0) {
        rulesToSave = mergeRulesWithoutOverwrite(currentRules, parsedRemote.rules)
      }
    }
  } catch {
    // 忽略远端探测错误，继续保存
  }

  const payload = JSON.stringify(
    {
      version: 1,
      source: 'invoice_rec_ai',
      exportDate: new Date().toISOString(),
      updatedAt: Date.now(),
      rules: rulesToSave
    },
    null,
    2
  )

  // 2. 优先调用后端直接写入指定 iCloud MultiPlatform 路径
  try {
    const postRes = await fetch('/api/icloud-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    })

    if (postRes.ok) {
      const resData = await postRes.json()
      if (resData.success) {
        viaDirect = true
        return {
          success: true,
          count: rulesToSave.length,
          viaDirect: true,
          updatedAt: resData.updatedAt || Date.now()
        }
      }
    }
  } catch {
    // 若未能直连服务端（例如纯客户端离线），使用文件下载降级
  }

  // 3. 降级方案：触发文件下载，指定文件名 invoice_skills_icloud.json
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = ICLOUD_DEFAULT_FILENAME
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)

  return {
    success: true,
    count: rulesToSave.length,
    viaDirect: false,
    updatedAt: Date.now()
  }
}

