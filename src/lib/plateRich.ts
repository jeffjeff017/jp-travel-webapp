import type { Descendant, Value } from '@platejs/slate'

/** 預設空段落，與 Plate 初始值一致 */
export const EMPTY_PLATE_JSON = JSON.stringify([
  { type: 'p', children: [{ text: '' }] },
] as Value)

export function isLikelyPlateJsonString(s: string): boolean {
  const t = s.trim()
  if (!t.startsWith('[')) return false
  try {
    const v = JSON.parse(t) as unknown
    return (
      Array.isArray(v) &&
      v.length > 0 &&
      typeof v[0] === 'object' &&
      v[0] !== null &&
      'type' in (v[0] as object)
    )
  } catch {
    return false
  }
}

/** 將儲存的字串還原為 Slate 節點；若非 Plate JSON（舊備註純文字）則包成一段落 */
export function parsePlateValueJson(s: string | null | undefined): Value {
  const empty: Value = [{ type: 'p', children: [{ text: '' }] }] as Value
  if (!s?.trim()) return empty
  if (isLikelyPlateJsonString(s)) {
    try {
      const v = JSON.parse(s) as Value
      if (Array.isArray(v) && v.length > 0) return v
    } catch {
      /* fallthrough */
    }
    return empty
  }
  return [{ type: 'p', children: [{ text: s }] }] as Value
}

function walkPlainText(nodes: Descendant[]): string {
  let out = ''
  for (const n of nodes) {
    if ('text' in n && typeof (n as { text?: string }).text === 'string') {
      out += (n as { text: string }).text
    }
    if ('children' in n && Array.isArray((n as { children?: Descendant[] }).children)) {
      out += walkPlainText((n as { children: Descendant[] }).children)
    }
  }
  return out.replace(/\s+/g, ' ').trim()
}

/** 搜尋、同步行程、列表摘要用 */
export function extractPlainTextFromPlateJson(s: string): string {
  if (!s.trim()) return ''
  if (!isLikelyPlateJsonString(s)) return s.trim()
  try {
    const nodes = JSON.parse(s) as Descendant[]
    if (!Array.isArray(nodes)) return ''
    return walkPlainText(nodes as Descendant[])
  } catch {
    return s.trim()
  }
}

export function isPlateJsonEffectivelyEmpty(s: string | null | undefined): boolean {
  if (!s?.trim()) return true
  return extractPlainTextFromPlateJson(s) === ''
}
