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

    function create() {
      nekoEl = document.createElement('div')
      nekoEl.id = 'oneko'
      nekoEl.style.width = '32px'
      nekoEl.style.height = '32px'
      nekoEl.style.position = 'fixed'
      nekoEl.style.pointerEvents = 'none'
      nekoEl.style.backgroundImage = `url('data:image/gif;base64,R0lGODlhgACAAPcAAAAAAAAAMwAAZgAAmQAAzAAA/wArAAArMwArZgArmQArzAAr/wBVAABVMwBVZgBVmQBVzABV/wCAAACAMwCAZgCAmQCAzACA/wCqAACqMwCqZgCqmQCqzACq/wDVAADVMwDVZgDVmQDVzADV/wD/AAD/MwD/ZgD/mQD/zAD//zMAADMAMzMAZjMAmTMAzDMA/zMrADMrMzMrZjMrmTMrzDMr/zNVADNVMzNVZjNVmTNVzDNV/zOAADOAMzOAZjOAmTOAzDOA/zOqADOqMzOqZjOqmTOqzDOq/zPVADPVMzPVZjPVmTPVzDPV/zP/ADP/MzP/ZjP/mTP/zDP//2YAAGYAM2YAZmYAmWYAzGYA/2YrAGYrM2YrZmYrmWYrzGYr/2ZVAGZVM2ZVZmZVmWZVzGZV/2aAAGaAM2aAZmaAmWaAzGaA/2aqAGaqM2aqZmaqmWaqzGaq/2bVAGbVM2bVZmbVmWbVzGbV/2b/AGb/M2b/Zmb/mWb/zGb//5kAAJkAM5kAZpkAmZkAzJkA/5krAJkrM5krZpkrmZkrzJkr/5lVAJlVM5lVZplVmZlVzJlV/5mAAJmAM5mAZpmAmZmAzJmA/5mqAJmqM5mqZpmqmZmqzJmq/5nVAJnVM5nVZpnVmZnVzJnV/5n/AJn/M5n/Zpn/mZn/zJn//8wAAMwAM8wAZswAmcwAzMwA/8wrAMwrM8wrZswrmcwrzMwr/8xVAMxVM8xVZsxVmcxVzMxV/8yAAMyAM8yAZsyAmcyAzMyA/8yqAMyqM8yqZsyqmcyqzMyq/8zVAMzVM8zVZszVmczVzMzV/8z/AMz/M8z/Zsz/mcz/zMz///8AAP8AM/8AZv8Amf8AzP8A//8rAP8rM/8rZv8rmf8rzP8r//9VAP9VM/9VZv9Vmf9VzP9V//+AAP+AM/+AZv+Amf+AzP+A//+qAP+qM/+qZv+qmf+qzP+q///VAP/VM//VZv/Vmf/VzP/V////AP//M///Zv//mf//zP///wAAAAAAAAAAAAAAACH5BAEAAPwALAAAAACAAIAAAAj/APcJHEiwoMGDCBMqXMiwocOHECNKnEixosWLGDNq3Mixo8ePIEOKHEmypMmTKFOqXMmypcuXMGPKnEmzps2bOHPq3Mmzp8+fQIMKHUq0qNGjSJMqXcq0qdOnUKNKnUq1qtWrWLNq3cq1q9evYMOKHUu2rNmzaNOqXcu2rdu3cOPKnUu3rt27ePPq3cu3r9+/gAMLHky4sOHDiBMrXsy4sePHkCNLnky5suXLmDNr3sy5s+fPoEOLHk26tOnTqFOrXs26tevXsGPLnk27tu3buHPr3s27t+/fwIMLH068uPHjyJMrX868ufPn0KNLn069uvXr2LNr3869u/fv4MOL/x9Pvrz58+jTq1/Pvr379/Djy59Pv779+/jz69/Pv7///wAGKOCABBZo4IEIJqjgggw26OCDEEYo4YQUVmjhhRhmqOGGHHbo4YcghijiiCSWaOKJKKao4oostujiizDGKOOMNNZo44teleXQjq3NUJ0ASEZ3gXVIRocdktUpeR0S2GHJpJdghjkdfbq10lAtPNVSCJdHGvnlmGAy+V2RYm5nppdgqslmi2g+R56c3bm5JppucokmnXOSCSebctq5p5p+kvflmITuOSicgx7K5p54Npqomn0aGumckWrKaKWYaupon5l22qmnlYYqqaighirqpKaWiiqppZa6Kqipllqnq/+xynrqrKnOquusvNa6q6y92vrrsLEeO6ywuxbL67LKFsussM0Oeyy01kL7bLXVPotts8JWi+243H6LbbjneltuuummKy67766r7rnu1vvtueyui+68+Lqrrr/t7ovvv/oGPC/B/fJ7ML4EH3xwwQk3LPDCCQe8cMINV1xxwhk3fPHDG3cMsccbS7yxyB6HPDLIHXOccsckl5xyyyG7rHLKJadsc8opuyxzzDfPPLPNONNs88o0B40zzDvv7HLPQBP9c9BD+6xz0kknnfTQTgPd9NBQJ0110043TXXVT1edNdZUb8011l9rrTXYXouN9thkmz022l+nffbZZqfN9tn/Xbd9ttpt1w0323vnPXfgcg/O999//0143oj3zXjhgh++OOJ/G8544of/nTjklSse+eWRU6655ptzfrnmmpPOOeehj/755KBzXjrqqnu+OuqqsxvWtGw9W9Yr3wJbOOz0yu6uu7HLvjvwsQc/++3DI4/87sULH3zxvvv+e/LMLw/99NE/f3313z8vvfPSPy9++dlHD/723WefvffZZx+++97rj0AtvrBA0P6+F8D4BbCA5VOeAJ2XP/YR0H8RFB/+FCjA/XkvghREIP4QqMEMDpCDFzwg+jz4QQeGcITnMwEwTIDCYapwhcDcHgkXKEIUyvCFFzyhCWG4whimEIYs/+whCmt4wxTS8IQ07GEHX8jCIvrwiEScIROJeEQh/vCJPlxiDptYRSduEYhfFCIYwzhGLZaxila8YhO3SEY0zvGNbHSjEuMYRzouMY53xKMdywjILP6RkGy0oyGHuMdCMnKOVxRkJg1pyTzqcYtxJCInz+jITaKRj2scpBsriUk2WpKSlnRjKDM5yU5O0pONROUq71jKPL4ylFJ8JSxjCUdZUrKWiJTlLGWJy1XyspWw9GUnZSlLY9aSmKh0JjOZqctl+tKZvIwmMZcpzWlSM5rWnGYmjWlNbqaTmJbUIzeDOU5xprOcz5ymL7FJTE8+k5PtFKcv5YlNeWZTns08J/9AzSlPdxbUnPlUpzzRWU991rOeuwwoL2t5TWM+lKEOhahDJUpRiUpUoj8EIkIxulCNLpSjE/0oRUHqUJCKdKQaFSlHJzrSgELUpAMVKUlBqlGTcvSlJkUpS1HqUZu+NKc9LepL9+lOif5ypiNlalOdutOkSvWgRA1qVZ061KlGdapRLWpUs1rUrcI0p1d1Kj+5utWuWpWsYQXrWNEKTKH+VK1chSpbjzpXo4J1rVOdq1fRatew3vWseb1rYN061bJmla9YtapLg7rYvDbWsJEV7GABO1bEElaxjFXsYflK2cQ29rOgFW1o/Rpa0p6WtKoVLWhZ69rGbva0sv9dbWzzClvQxja2gH3ta32L2tyK1ra6Be5uOdva3YaWt8V1LHCFK9sJLje5G2Uuc5Gb3I9C17nRVe50qUtd61pXut29Lne5G97wbjcEvqBueKMr3vKa97zsJS96ydtd+IqXveudL37rK9/28ne//bXvf/trXv0OmMD5BS+CDdxfBht4wv5F8IATPGAHJ5jCDa7whA/s4Ao/2MER1nCFP6xhDl94wyL+cIk9zGERl5i/KD4xinFsYg+jmMYrxjGJdWziGZs4xzFO8Y5pHGMhr/jHIR6yjmv8YyKrGMhDJnKPk6xjHPv4yEH+8Y+RrOQl7xjJGYaylneMZSsDeckf1nL/lbNs4htvucxX/jKYyexlKm9ZzWjOcpnJTOYyk5nMa5bzm+Ps5jrPWc5qTjOb7xxlO8t5z3imM6DxDOg775nQhR40nwNN6ETbmdGFfrSbF71oSUcazHxu9KMnHWdJa7rSlcZ0pjF96EyTGtOWLrWoU03qU5fa1a1OdarjbOpQv/rUsS71qWu96lznGte3xrWuhQ1rYe962MTONbCHTWxg63rZxp51spH97Gcrm9nVPnayn93taR972doeNq2PDW5g/5rcy+62s8H97XB329znRne4403veSs73eH+NrLbve9zp1vc5hY3wO+9bnRXm9/+/rfAAU7wghv84Aj/N7jC493whSd84g8ft8LXjXBzO1vfEv+3v/e98IB73OMVz/jEM37xjH+84h8necw7bvGH3zvjGoc5x2NecomnvOYzZ7nJZ47zkev85zlPOcwjbvKZ2/zkPL/50IUO9J/7HORFh3rPXU70ni/d6FDXutOjLvSrv5zqV686z7MO9aff/OpSR3rXx77zo0d960sXu9bbfvayt/3taTd715Ou9rnnPex7j3vRl473u/8d8HYnvMr1vva71/3rRTd85CFP+cc/vvKUj/zjO794xyP+8ZuPfN43T3rSb97xqB996xePedG33u6v773rZU/61qN+9b8/velnT/vd9x74uLc98s2efOXvnvbPV771oQ9+59ce+Mrf/u+pD33r/9ce+8aXfvGZX3vqx5/71b++7b2P/PFLPvXXB373xc/+9G/+/L8nv/3R3/7zw//8++f/7P3ve+kHf+sXgNR3fuDnfgL4fwRIf/q3f/lnfwf4f/R3fwlYgAFogNOXgBFIgQyYgAFIgRKYgAgogRXYgBsIgBqIgB4IgiAIgh/IgSKYgBj4gSYYgiTIgSFIgyRogjuYgzmYgjvogjH4gzf4gjs4hEMog0E4gzwogyEohETIhET4g0c4hU74g1A4hU74hFRIhU2IhVm4hFPIhWBohWFIhmLYhUqohFoohly4hmzohWjYhmv4g3A4g3NIh0e4h0koh3voh3n4h3sIiD7oh30oiHI4hnDoh4BYh4c4h4EYiInYh4TIiIz4iJB4iJAoiYloiYqYiJQoiZh4iZXYiZ64iJvIipn4iZwoip9IiqE4ip14iqNoiqNoipj4iqxYi6VYirN4i7Z4i7YYi7qoi6zIi7jYi7u4jLrojLX4i7sYjMmYjMpojMlojMy4jMzYjNHojKuIjNIojc/IjND4jdGojdoojdoYjtxIjuDYjdq4jdnYjea4jeDIjuPIjuzojvAIj/FYjwAZkAI5kARZkAZ5kAiZkAq5kAzZkA75kBAZkRIpkCoQEAAh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')`
      nekoEl.style.imageRendering = 'pixelated'
      nekoEl.style.zIndex = '9999'
      nekoEl.style.left = `${nekoPosXRef.current - 16}px`
      nekoEl.style.top = `${nekoPosYRef.current - 16}px`
      
      document.body.appendChild(nekoEl)
      nekoRef.current = nekoEl
      
      document.addEventListener('mousemove', onMouseMove)
      window.requestAnimationFrame(onAnimationFrame)
    }

    function onMouseMove(event: MouseEvent) {
      mousePosXRef.current = event.clientX
      mousePosYRef.current = event.clientY
    }

    function setSprite(name: string, frame: number) {
      const sprite = spriteSets[name][frame % spriteSets[name].length]
      nekoRef.current!.style.backgroundPosition = `${sprite[0] * 32}px ${sprite[1] * 32}px`
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
        return window.requestAnimationFrame(onAnimationFrame)
      }

      idleAnimationRef.current = null
      idleAnimationFrameRef.current = 0
      idleTimeRef.current = 0

      let direction = ''
      direction += diffY / distance > 0.5 ? 'N' : ''
      direction += diffY / distance < -0.5 ? 'S' : ''
      direction += diffX / distance > 0.5 ? 'W' : ''
      direction += diffX / distance < -0.5 ? 'E' : ''

      setSprite(direction, frameRef.current)

      nekoPosXRef.current -= (diffX / distance) * nekoSpeed
      nekoPosYRef.current -= (diffY / distance) * nekoSpeed

      nekoPosXRef.current = Math.min(Math.max(16, nekoPosXRef.current), window.innerWidth - 16)
      nekoPosYRef.current = Math.min(Math.max(16, nekoPosYRef.current), window.innerHeight - 16)

      nekoRef.current.style.left = `${nekoPosXRef.current - 16}px`
      nekoRef.current.style.top = `${nekoPosYRef.current - 16}px`

      window.requestAnimationFrame(onAnimationFrame)
    }

    create()

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      if (nekoRef.current) {
        nekoRef.current.remove()
        nekoRef.current = null
      }
    }
  }, [enabled])

  return null
}
