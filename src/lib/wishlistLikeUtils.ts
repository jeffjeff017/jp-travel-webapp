import type { WishlistItemDB } from '@/lib/supabase'

/** Parse favorited_by from DB (jsonb array or JSON string). */
export function parseFavoritedBy(raw: unknown): string[] {
  let arr: unknown[] = []
  if (Array.isArray(raw)) {
    arr = raw
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      arr = Array.isArray(parsed) ? parsed : []
    } catch {
      arr = []
    }
  }
  return arr.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
}

/** Case-insensitive username match (aligned with login / like checks). */
export function normalizedEquals(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * Whether this row counts as "liked" for the user in 已讚好 / heart UI.
 * Includes legacy rows that only had is_favorite with empty favorited_by.
 * Usernames are compared case-insensitively (matches login() behavior).
 */
export function isWishlistDbItemLikedByUser(db: WishlistItemDB, username: string | null | undefined): boolean {
  if (!username?.trim()) return false
  const favs = parseFavoritedBy(db.favorited_by)
  if (favs.some(u => normalizedEquals(u, username))) return true
  if (db.is_favorite && favs.length === 0) return true
  return false
}

type LocalLike = { favoritedBy?: string[]; isFavorite?: boolean }

export function isWishlistLocalItemLikedByUser(item: LocalLike, username: string | null | undefined): boolean {
  if (!username?.trim()) return false
  const favs = item.favoritedBy || []
  if (favs.some(u => normalizedEquals(u, username))) return true
  if (item.isFavorite && favs.length === 0) return true
  return false
}

/** Any "like" signal for showing the 已讚好 bubble (per-user list or legacy global flag). */
export function wishlistLocalItemHasLikeSignal(item: LocalLike): boolean {
  return (item.favoritedBy || []).length > 0 || Boolean(item.isFavorite)
}
