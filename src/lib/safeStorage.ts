/**
 * Safe localStorage wrapper that handles QuotaExceededError gracefully.
 * When quota is exceeded, it tries to clear old caches before retrying.
 * If still failing, it silently ignores the error since primary data is in Supabase.
 */

const CLEARABLE_KEYS = [
  'japan_travel_wishlist',
  'japan_travel_wishlist_cache_time',
  'admin_trash_bin',
]

export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (e) {
    console.warn(`localStorage quota exceeded for key "${key}", clearing caches...`)
    try {
      // Clear large cache entries to free up space
      for (const clearKey of CLEARABLE_KEYS) {
        if (clearKey !== key) {
          localStorage.removeItem(clearKey)
        }
      }
      localStorage.setItem(key, value)
      return true
    } catch {
      console.warn('localStorage still full after cleanup, skipping cache write')
      return false
    }
  }
}
