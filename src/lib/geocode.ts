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
