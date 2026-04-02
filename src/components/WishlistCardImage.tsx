'use client'

import { useState } from 'react'
import Image from 'next/image'

/** Tiny gray SVG blur — instant placeholder while full image loads */
const BLUR_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVlaWdodD0iMTAwJSIgZmlsbD0iI2YzZjRmNiIvPjwvc3ZnPg=='

type Props = {
  src: string
  alt: string
  /** First row / above-the-fold — loads with high priority */
  priority?: boolean
  className?: string
}

function isDataUrl(src: string) {
  return src.startsWith('data:')
}

function isAbsoluteHttpUrl(src: string): boolean {
  try {
    const u = new URL(src)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** Hosts allowed by next.config.js remotePatterns — unknown hosts use native <img> to avoid runtime errors. */
function isNextImageHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'tenor.com' || h === 'media.tenor.com') return true
  if (h === 'lh3.googleusercontent.com' || h.endsWith('.googleusercontent.com')) return true
  if (h === 'images.unsplash.com') return true
  if (h === 'i.imgur.com' || h.endsWith('.imgur.com')) return true
  if (h === 'pbs.twimg.com') return true
  if (h.endsWith('.fbcdn.net')) return true
  if (h.endsWith('.cdninstagram.com')) return true
  if (h.endsWith('.cloudinary.com')) return true
  if (h.endsWith('.amazonaws.com')) return true
  if (h.endsWith('.supabase.co')) return true
  return false
}

/**
 * Grid card image for 美食清單: Next/Image when possible (responsive srcset + WebP/AVIF),
 * fallback to native img for data URLs or edge cases.
 */
export default function WishlistCardImage({ src, alt, priority, className }: Props) {
  const [useNative, setUseNative] = useState(false)

  if (isDataUrl(src) || useNative) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
      />
    )
  }

  if (!isAbsoluteHttpUrl(src)) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
      />
    )
  }

  let hostOk = false
  try {
    hostOk = isNextImageHost(new URL(src).hostname)
  } catch {
    hostOk = false
  }

  if (!hostOk) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
      />
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={className}
      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
      priority={!!priority}
      placeholder="blur"
      blurDataURL={BLUR_DATA_URL}
      decoding="async"
      onError={() => setUseNative(true)}
    />
  )
}
