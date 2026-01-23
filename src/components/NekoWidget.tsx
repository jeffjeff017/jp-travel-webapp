'use client'

import { useEffect, useRef } from 'react'

interface NekoWidgetProps {
  enabled?: boolean
}

export default function NekoWidget({ enabled = true }: NekoWidgetProps) {
  const nekoRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<number>(0)
  const idleTimeRef = useRef<number>(0)
  const idleAnimationRef = useRef<string | null>(null)
  const idleAnimationFrameRef = useRef<number>(0)
  const nekoPosXRef = useRef<number>(32)
  const nekoPosYRef = useRef<number>(32)
  const mousePosXRef = useRef<number>(0)
  const mousePosYRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const spriteSets: Record<string, number[][]> = {
      idle: [[-3, -3]],
      alert: [[-7, -3]],
      scratchSelf: [
        [-5, 0],
        [-6, 0],
        [-7, 0],
      ],
      scratchWallN: [
        [0, 0],
        [0, -1],
      ],
      scratchWallS: [
        [-7, -1],
        [-6, -2],
      ],
      scratchWallE: [
        [-2, -2],
        [-2, -3],
      ],
      scratchWallW: [
        [-4, 0],
        [-4, -1],
      ],
      tired: [[-3, -2]],
      sleeping: [
        [-2, 0],
        [-2, -1],
      ],
      N: [
        [-1, -2],
        [-1, -3],
      ],
      NE: [
        [0, -2],
        [0, -3],
      ],
      E: [
        [-3, 0],
        [-3, -1],
      ],
      SE: [
        [-5, -1],
        [-5, -2],
      ],
      S: [
        [-6, -3],
        [-7, -2],
      ],
      SW: [
        [-5, -3],
        [-6, -1],
      ],
      W: [
        [-4, -2],
        [-4, -3],
      ],
      NW: [
        [-1, 0],
        [-1, -1],
      ],
    }

    const nekoSpeed = 10
    let nekoEl: HTMLDivElement
    let animationId: number

    function create() {
      nekoEl = document.createElement('div')
      nekoEl.id = 'oneko'
      nekoEl.style.width = '32px'
      nekoEl.style.height = '32px'
      nekoEl.style.position = 'fixed'
      nekoEl.style.pointerEvents = 'none'
      // Use CDN for the oneko.gif
      nekoEl.style.backgroundImage = `url('https://raw.githubusercontent.com/adryd325/oneko.js/main/oneko.gif')`
      nekoEl.style.imageRendering = 'pixelated'
      nekoEl.style.zIndex = '9999'
      nekoEl.style.left = `${nekoPosXRef.current - 16}px`
      nekoEl.style.top = `${nekoPosYRef.current - 16}px`
      
      document.body.appendChild(nekoEl)
      nekoRef.current = nekoEl
      
      document.addEventListener('mousemove', onMouseMove)
      animationId = window.requestAnimationFrame(onAnimationFrame)
    }

    function onMouseMove(event: MouseEvent) {
      mousePosXRef.current = event.clientX
      mousePosYRef.current = event.clientY
    }

    function setSprite(name: string, frame: number) {
      if (!nekoRef.current) return
      const sprite = spriteSets[name][frame % spriteSets[name].length]
      nekoRef.current.style.backgroundPosition = `${sprite[0] * 32}px ${sprite[1] * 32}px`
    }

    function resetIdleAnimation() {
      idleAnimationRef.current = null
      idleAnimationFrameRef.current = 0
    }

    function idle() {
      idleTimeRef.current += 1

      // Yawn/Tired
      if (idleTimeRef.current > 10 && Math.floor(Math.random() * 200) === 0 && idleAnimationRef.current === null) {
        idleAnimationRef.current = 'tired'
      }

      // Fall asleep
      if (idleTimeRef.current > 30 && idleAnimationRef.current === null) {
        idleAnimationRef.current = 'sleeping'
      }

      switch (idleAnimationRef.current) {
        case 'tired':
          setSprite('tired', 0)
          if (idleAnimationFrameRef.current > 5) {
            resetIdleAnimation()
          }
          break
        case 'sleeping':
          if (idleAnimationFrameRef.current < 8) {
            setSprite('tired', 0)
          } else {
            setSprite('sleeping', Math.floor(idleAnimationFrameRef.current / 4))
          }
          break
        default:
          setSprite('idle', 0)
          break
      }
      idleAnimationFrameRef.current += 1
    }

    function onAnimationFrame() {
      if (!nekoRef.current) return
      
      frameRef.current += 1

      const diffX = nekoPosXRef.current - mousePosXRef.current
      const diffY = nekoPosYRef.current - mousePosYRef.current
      const distance = Math.sqrt(diffX ** 2 + diffY ** 2)

      if (distance < nekoSpeed || distance < 48) {
        idle()
        animationId = window.requestAnimationFrame(onAnimationFrame)
        return
      }

      idleAnimationRef.current = null
      idleAnimationFrameRef.current = 0
      idleTimeRef.current = 0

      let direction = ''
      direction += diffY / distance > 0.5 ? 'N' : ''
      direction += diffY / distance < -0.5 ? 'S' : ''
      direction += diffX / distance > 0.5 ? 'W' : ''
      direction += diffX / distance < -0.5 ? 'E' : ''

      if (direction) {
        setSprite(direction, frameRef.current)
      }

      nekoPosXRef.current -= (diffX / distance) * nekoSpeed
      nekoPosYRef.current -= (diffY / distance) * nekoSpeed

      nekoPosXRef.current = Math.min(Math.max(16, nekoPosXRef.current), window.innerWidth - 16)
      nekoPosYRef.current = Math.min(Math.max(16, nekoPosYRef.current), window.innerHeight - 16)

      nekoRef.current.style.left = `${nekoPosXRef.current - 16}px`
      nekoRef.current.style.top = `${nekoPosYRef.current - 16}px`

      animationId = window.requestAnimationFrame(onAnimationFrame)
    }

    create()

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      if (animationId) {
        window.cancelAnimationFrame(animationId)
      }
      if (nekoRef.current) {
        nekoRef.current.remove()
        nekoRef.current = null
      }
    }
  }, [enabled])

  return null
}
