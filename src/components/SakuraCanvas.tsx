'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Petal {
  id: number
  x: number
  delay: number
  duration: number
  size: number
  rotation: number
  swayAmount: number
  type: number // Different petal shapes
}

interface SakuraCanvasProps {
  enabled?: boolean
}

export default function SakuraCanvas({ enabled = true }: SakuraCanvasProps) {
  const [petals, setPetals] = useState<Petal[]>([])
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Reduced petal count - 70% less on mobile, fewer overall
  const petalCount = useMemo(() => {
    const baseCount = 12 // Reduced from 30 to 12
    return isMobile ? Math.floor(baseCount * 0.3) : baseCount
  }, [isMobile])

  const generatePetals = useCallback(() => {
    const newPetals: Petal[] = []
    for (let i = 0; i < petalCount; i++) {
      newPetals.push({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 15, // More spread out delays
        duration: 15 + Math.random() * 10, // Slower: 15-25 seconds (was 8-14)
        size: 20 + Math.random() * 20, // Slightly larger: 20-40px
        rotation: Math.random() * 360,
        swayAmount: 20 + Math.random() * 30, // Gentler sway
        type: Math.floor(Math.random() * 3), // 3 different petal types
      })
    }
    return newPetals
  }, [petalCount])

  useEffect(() => {
    if (enabled) {
      setPetals(generatePetals())
    } else {
      setPetals([])
    }
  }, [enabled, generatePetals])

  if (!enabled) return null

  // More realistic petal SVG paths
  const getPetalPath = (type: number) => {
    switch (type) {
      case 0:
        // Classic 5-petal sakura shape
        return (
          <g>
            <ellipse cx="20" cy="12" rx="6" ry="10" fill="url(#petalGrad)" transform="rotate(0 20 20)" />
            <ellipse cx="20" cy="12" rx="6" ry="10" fill="url(#petalGrad)" transform="rotate(72 20 20)" />
            <ellipse cx="20" cy="12" rx="6" ry="10" fill="url(#petalGrad)" transform="rotate(144 20 20)" />
            <ellipse cx="20" cy="12" rx="6" ry="10" fill="url(#petalGrad)" transform="rotate(216 20 20)" />
            <ellipse cx="20" cy="12" rx="6" ry="10" fill="url(#petalGrad)" transform="rotate(288 20 20)" />
            <circle cx="20" cy="20" r="4" fill="#FFE4E8" />
            <circle cx="20" cy="20" r="2" fill="#FFCDD5" />
          </g>
        )
      case 1:
        // Single falling petal
        return (
          <g>
            <path
              d="M20 5 Q30 15 25 30 Q20 35 15 30 Q10 15 20 5"
              fill="url(#petalGrad)"
            />
            <path
              d="M18 12 Q20 20 18 25"
              stroke="#FFCDD5"
              strokeWidth="0.5"
              fill="none"
              opacity="0.5"
            />
          </g>
        )
      case 2:
      default:
        // Rounded petal
        return (
          <g>
            <ellipse cx="20" cy="20" rx="12" ry="16" fill="url(#petalGrad)" />
            <ellipse cx="18" cy="16" rx="4" ry="6" fill="#FFF5F7" opacity="0.6" />
            <path
              d="M20 8 Q20 20 20 32"
              stroke="#FFCDD5"
              strokeWidth="0.3"
              fill="none"
              opacity="0.4"
            />
          </g>
        )
    }
  }

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      <AnimatePresence>
        {petals.map((petal) => (
          <motion.div
            key={petal.id}
            className="absolute sakura-petal"
            initial={{
              x: `${petal.x}vw`,
              y: -50,
              rotate: petal.rotation,
              opacity: 0,
            }}
            animate={{
              y: '110vh',
              x: [
                `${petal.x}vw`,
                `${petal.x + petal.swayAmount / 4}vw`,
                `${petal.x - petal.swayAmount / 4}vw`,
                `${petal.x + petal.swayAmount / 5}vw`,
                `${petal.x}vw`,
              ],
              rotate: [petal.rotation, petal.rotation + 90, petal.rotation + 180, petal.rotation + 270, petal.rotation + 360],
              opacity: [0, 0.9, 0.9, 0.9, 0],
            }}
            transition={{
              duration: petal.duration,
              delay: petal.delay,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{
              width: petal.size,
              height: petal.size,
            }}
          >
            <svg viewBox="0 0 40 40" className="w-full h-full drop-shadow-sm">
              <defs>
                <radialGradient id="petalGrad" cx="30%" cy="30%">
                  <stop offset="0%" stopColor="#FFF5F7" />
                  <stop offset="40%" stopColor="#FFD4DC" />
                  <stop offset="100%" stopColor="#FFB6C4" />
                </radialGradient>
              </defs>
              {getPetalPath(petal.type)}
            </svg>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
