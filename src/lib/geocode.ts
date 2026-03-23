const reverseGeocodeZhCache = new Map<string, string>()

/**
 * 以座標取得繁中地址（Google Geocoding，language=zh-TW）。
 * 失敗時回傳 null；結果以座標四捨五入快取，減少重複請求。
 */
export async function reverseGeocodeZhTW(lat: number, lng: number): Promise<string | null> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key || typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null
  }
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`
  const hit = reverseGeocodeZhCache.get(cacheKey)
  if (hit) return hit
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=zh-TW&key=${key}`
    )
    const data = await res.json()
    if (data.status === 'OK' && data.results?.length > 0) {
      const formatted = data.results[0].formatted_address as string
      if (formatted) {
        reverseGeocodeZhCache.set(cacheKey, formatted)
        return formatted
      }
    }
  } catch {
    // fall through
  }
  return null
}

/** Geocode a place name to lat/lng using Google Geocoding API. Adds " Japan" for better accuracy. */
export async function geocodePlaceName(placeName: string): Promise<{ lat: number; lng: number } | null> {
  if (!placeName?.trim()) return null
  try {
    const query = placeName.trim().endsWith('Japan') ? placeName.trim() : `${placeName.trim()} Japan`
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    )
    const data = await res.json()
    if (data.status === 'OK' && data.results?.length > 0) {
      const { lat, lng } = data.results[0].geometry.location
      return { lat, lng }
    }
  } catch {
    // fall through
  }
  return null
}
