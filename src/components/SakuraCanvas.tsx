'use client'

import { useEffect, useRef } from 'react'

interface SakuraCanvasProps {
  enabled?: boolean
}

interface Petal {
  x: number
  y: number
  size: number
  speedX: number
  speedY: number
  rotation: number
  rotationSpeed: number
  opacity: number
  color: string
}

export default function SakuraCanvas({ enabled = true }: SakuraCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const petalsRef = useRef<Petal[]>([])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      // Clean up
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = 0
      }
      petalsRef.current = []
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Petal colors (pink shades)
    const colors = [
      'rgba(255, 183, 197, 0.9)',
      'rgba(255, 197, 208, 0.9)',
      'rgba(255, 212, 220, 0.9)',
      'rgba(255, 230, 235, 0.9)',
      'rgba(255, 182, 193, 0.85)',
      'rgba(255, 192, 203, 0.9)',
    ]

    // Create initial petals - fewer and slower on mobile
    const isMobile = window.innerWidth < 768
    const maxPetals = isMobile ? 20 : 50
    const speedMultiplier = isMobile ? 0.4 : 1
    
    const createPetal = (): Petal => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      size: Math.random() * 10 + 8,
      speedX: (Math.random() * 1.5 - 0.75) * speedMultiplier,
      speedY: (Math.random() * 1 + 0.5) * speedMultiplier,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.02 * speedMultiplier,
      opacity: Math.random() * 0.4 + 0.6,
      color: colors[Math.floor(Math.random() * colors.length)],
    })

    // Initialize petals
    petalsRef.current = Array.from({ length: maxPetals }, createPetal)

    // Draw a single petal (sakura flower shape)
    const drawPetal = (petal: Petal) => {
      ctx.save()
      ctx.translate(petal.x, petal.y)
      ctx.rotate(petal.rotation)
      ctx.globalAlpha = petal.opacity
      
      // Draw sakura petal shape
      ctx.beginPath()
      ctx.fillStyle = petal.color
      
      // Create petal shape using bezier curves
      const size = petal.size
      ctx.moveTo(0, 0)
      ctx.bezierCurveTo(
        size * 0.5, -size * 0.3,
        size, -size * 0.2,
        size, 0
      )
      ctx.bezierCurveTo(
        size, size * 0.2,
        size * 0.5, size * 0.3,
        0, 0
      )
      ctx.fill()

      // Add subtle highlight
      ctx.beginPath()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.ellipse(size * 0.3, 0, size * 0.15, size * 0.08, 0, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.restore()
    }

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      petalsRef.current.forEach((petal, index) => {
        // Update position
        petal.x += petal.speedX + Math.sin(petal.y * 0.01) * 0.3
        petal.y += petal.speedY
        petal.rotation += petal.rotationSpeed

        // Reset petal when it goes off screen
        if (petal.y > canvas.height + 20) {
          petalsRef.current[index] = createPetal()
          petalsRef.current[index].y = -20
        }
        if (petal.x > canvas.width + 20) {
          petal.x = -20
        }
        if (petal.x < -20) {
          petal.x = canvas.width + 20
        }

        drawPetal(petal)
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    // Start animation
    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = 0
      }
      petalsRef.current = []
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[1]"
      style={{ 
        width: '100vw', 
        height: '100vh',
      }}
    />
  )
}
