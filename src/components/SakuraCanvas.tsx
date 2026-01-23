'use client'

import { useEffect, useRef } from 'react'

interface SakuraCanvasProps {
  enabled?: boolean
}

export default function SakuraCanvas({ enabled = true }: SakuraCanvasProps) {
  const sakuraRef = useRef<any>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const initSakura = async () => {
      if (enabled && !initialized.current) {
        try {
          // Dynamically import sakura-js
          const Sakura = (await import('sakura-js')).default
          
          // Initialize with custom options
          sakuraRef.current = new Sakura('body', {
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
            maxSize: 14,
            minSize: 8,
            delay: 300,
          })
          initialized.current = true
        } catch (error) {
          console.error('Failed to initialize Sakura:', error)
        }
      } else if (!enabled && sakuraRef.current) {
        try {
          sakuraRef.current.stop(true)
          sakuraRef.current = null
          initialized.current = false
        } catch (error) {
          console.error('Failed to stop Sakura:', error)
        }
      }
    }

    initSakura()

    return () => {
      if (sakuraRef.current) {
        try {
          sakuraRef.current.stop(true)
          sakuraRef.current = null
          initialized.current = false
        } catch (error) {
          console.error('Failed to cleanup Sakura:', error)
        }
      }
    }
  }, [enabled])

  // This component doesn't render anything - sakura-js handles the DOM
  return null
}
