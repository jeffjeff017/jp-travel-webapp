/**
 * Safe localStorage wrapper that handles QuotaExceededError gracefully.
 * When quota is exceeded, it tries to clear old caches before retrying.
 * If still failing, it silently ignores the error since primary data is in Supabase.
 *
 * IMPORTANT: Never include primary data keys in CLEARABLE_KEYS.
 * `japan_travel_wishlist` is a local fallback (not cache) and must NOT be cleared here.
 */

const CLEARABLE_KEYS = [
  'admin_trash_bin',          // Admin trash bin — backed up in Supabase before deletion
  'travel_info_cache',        // Pure cache, safe to clear
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
