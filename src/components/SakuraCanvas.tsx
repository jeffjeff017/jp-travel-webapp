'use client'

import { useEffect, useRef } from 'react'

interface SakuraCanvasProps {
  enabled?: boolean
}

export default function SakuraCanvas({ enabled = true }: SakuraCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sakuraInstanceRef = useRef<any>(null)

  useEffect(() => {
    if (!enabled) {
      // Clean up if disabled
      if (sakuraInstanceRef.current) {
        sakuraInstanceRef.current.stop(true)
        sakuraInstanceRef.current = null
      }
      return
    }

    // Only run on client
    if (typeof window === 'undefined') return

    let mounted = true

    const initSakura = async () => {
      try {
        // Import sakura-js
        const SakuraModule = await import('sakura-js')
        const Sakura = SakuraModule.default || SakuraModule
        
        if (!mounted) return

        // Initialize Sakura on the body
        sakuraInstanceRef.current = new Sakura('body', {
          colors: [
            {
              gradientColorStart: 'rgba(255, 183, 197, 0.9)',
              gradientColorEnd: 'rgba(255, 197, 208, 0.9)',
              gradientColorDegree: 120,
            },
            {
              gradientColorStart: 'rgba(255, 212, 220, 0.9)',
              gradientColorEnd: 'rgba(255, 230, 235, 0.9)',
              gradientColorDegree: 120,
            },
            {
              gradientColorStart: 'rgba(255, 245, 247, 0.9)',
              gradientColorEnd: 'rgba(255, 220, 230, 0.9)',
              gradientColorDegree: 120,
            },
          ],
          fallSpeed: 1,
          maxSize: 12,
          minSize: 6,
          delay: 400,
        })
      } catch (error) {
        console.error('Failed to initialize Sakura:', error)
      }
    }

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initSakura, 100)

    return () => {
      mounted = false
      clearTimeout(timer)
      if (sakuraInstanceRef.current) {
        try {
          sakuraInstanceRef.current.stop(true)
        } catch (e) {
          // Ignore cleanup errors
        }
        sakuraInstanceRef.current = null
      }
    }
  }, [enabled])

  return null
}
