'use client'

import { useEffect, useState } from 'react'
import { reverseGeocodeZhTW } from '@/lib/geocode'

type Props = {
  tripId: number
  lat: number
  lng: number
  /** 英文或原始地址，作為立即顯示與 API 失敗時後備 */
  fallback: string
}

/**
 * 行程列表用：以座標向 Google 取繁中地址；單行省略。無 API 或失敗時顯示 fallback。
 */
export default function TripListingAddress({ tripId, lat, lng, fallback }: Props) {
  const [text, setText] = useState(fallback)

  useEffect(() => {
    setText(fallback)
  }, [tripId, fallback])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const zh = await reverseGeocodeZhTW(lat, lng)
      if (!cancelled && zh) setText(zh)
    })()
    return () => {
      cancelled = true
    }
  }, [tripId, lat, lng])

  return (
    <p className="text-xs text-gray-600 flex-1 min-w-0 leading-snug truncate" title={text}>
      {text}
    </p>
  )
}
