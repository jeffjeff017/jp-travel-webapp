'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

interface ChiikawaPetProps {
  enabled?: boolean
}

// Array of character images (randomly selected on load)
const CHARACTER_IMAGES = [
  '/images/chiikawa-pet.png',
  '/images/hachiware-pet.png',
  '/images/chii-pet.png',
]

// Character-specific messages
const MESSAGES_BY_CHARACTER: Record<string, string[]> = {
  '/images/chii-pet.png': [
    'ウンッ！嗯！',
    'ワッ！ワッ！哇！哇！',
  ],
  '/images/hachiware-pet.png': [
    'チャリメラ〜 查露麵拉～',
    'わははは！おかしいね！哇哈哈哈！太有趣了吧！',
  ],
  '/images/chiikawa-pet.png': [
    '呀哈！ヤハ！',
    '噗嚕嚕嚕嚕！プルルルル！',
    '嗚拉！ウラ！',
    '哈？ハァ？',
  ],
}

export default function ChiikawaPet({ enabled = true }: ChiikawaPetProps) {
  const [isClicked, setIsClicked] = useState(false)
  const [speechMessage, setSpeechMessage] = useState('')
  const [isHappyBounce, setIsHappyBounce] = useState(false)
  const [characterImage, setCharacterImage] = useState(CHARACTER_IMAGES[0])
  const [hasEverClicked, setHasEverClicked] = useState(false)

  // Select random character on mount and check if user has clicked before
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * CHARACTER_IMAGES.length)
    setCharacterImage(CHARACTER_IMAGES[randomIndex])
    
    // Check localStorage to see if user has clicked before
    const clicked = localStorage.getItem('chiikawa_clicked')
    if (clicked) {
      setHasEverClicked(true)
    }
  }, [])

  // Random speech message on click based on current character
  const getRandomMessage = useCallback(() => {
    const messages = MESSAGES_BY_CHARACTER[characterImage] || MESSAGES_BY_CHARACTER['/images/chiikawa-pet.png']
    return messages[Math.floor(Math.random() * messages.length)]
  }, [characterImage])

  // Handle click interaction
  const handleClick = useCallback(() => {
    if (isClicked) return // Prevent spam clicking
    
    // Mark as clicked (hide hint permanently)
    if (!hasEverClicked) {
      setHasEverClicked(true)
      localStorage.setItem('chiikawa_clicked', 'true')
    }
    
    setIsClicked(true)
    setSpeechMessage(getRandomMessage())
    
    // Reset after 2 seconds
    setTimeout(() => {
      setIsClicked(false)
      setSpeechMessage('')
    }, 2000)
  }, [isClicked, hasEverClicked, getRandomMessage])

  // Happy bounce effect every 10 seconds
  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(() => {
      setIsHappyBounce(true)
      setTimeout(() => setIsHappyBounce(false), 600)
    }, 10000)

    return () => clearInterval(interval)
  }, [enabled])

  if (!enabled) return null

  // Floating animation variants
  const floatingVariants = {
    animate: {
      y: [0, -8, 0, -4, 0],
      rotate: [-2, 2, -1, 1, -2],
      transition: {
        y: {
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        },
        rotate: {
          duration: 5,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      },
    },
  }

  // Happy bounce animation
  const happyBounceVariants = {
    initial: { scale: 1 },
    bounce: {
      scale: [1, 1.15, 0.95, 1.1, 1],
      y: [0, -15, 0, -8, 0],
      transition: {
        duration: 0.6,
        ease: 'easeOut',
      },
    },
  }

  // Click pop animation
  const clickVariants = {
    initial: { scale: 1 },
    clicked: {
      scale: [1, 1.3, 1.1],
      transition: {
        duration: 0.3,
        ease: 'easeOut',
      },
    },
  }

  // Speech bubble animation - appears from the left (since bubble is on the right)
  const speechBubbleVariants = {
    initial: { 
      opacity: 0, 
      scale: 0.5, 
      x: -10,
    },
    animate: { 
      opacity: 1, 
      scale: 1, 
      x: 0,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 15,
      },
    },
    exit: { 
      opacity: 0, 
      scale: 0.5, 
      x: 10,
      transition: {
        duration: 0.2,
      },
    },
  }

  return (
    <div 
      className="fixed bottom-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:bottom-6 md:left-6 z-50 cursor-pointer select-none w-16 h-16 md:w-20 md:h-20 flex flex-col items-center justify-center"
      onClick={handleClick}
    >
      {/* Speech Bubble - positioned above on mobile, right side on desktop */}
      <AnimatePresence>
        {isClicked && speechMessage && (
          <>
            {/* Mobile: Above the character */}
            <motion.div
              variants={speechBubbleVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="md:hidden absolute z-10 -top-10 left-1/2 -translate-x-1/2"
            >
              <div className="relative bg-white px-3 py-2 rounded-xl shadow-lg border-2 border-pink-200">
                <span className="text-xs font-bold text-pink-500 whitespace-nowrap">
                  {speechMessage}
                </span>
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 
                  border-l-[6px] border-l-transparent 
                  border-r-[6px] border-r-transparent 
                  border-t-[8px] border-t-white" 
                />
              </div>
            </motion.div>
            
            {/* Desktop: Right side of character */}
            <motion.div
              variants={speechBubbleVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="hidden md:block absolute z-10 top-1/2 -translate-y-1/2"
              style={{ left: 'calc(100% + 8px)' }}
            >
              <div className="relative bg-white px-2 py-3 rounded-xl shadow-lg border-2 border-pink-200">
                <span 
                  className="text-xs font-bold text-pink-500"
                  style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                >
                  {speechMessage}
                </span>
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 
                  border-t-[6px] border-t-transparent 
                  border-b-[6px] border-b-transparent 
                  border-r-[8px] border-r-white" 
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Chiikawa Character */}
      <motion.div
        variants={floatingVariants}
        animate="animate"
        className="relative w-full h-full flex items-center justify-center"
      >
        <motion.div
          variants={isHappyBounce ? happyBounceVariants : clickVariants}
          initial="initial"
          animate={isHappyBounce ? 'bounce' : isClicked ? 'clicked' : 'initial'}
          className="relative w-full h-full flex items-center justify-center"
        >
            {/* Glow effect on click */}
            <AnimatePresence>
              {isClicked && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1.2 }}
                  exit={{ opacity: 0, scale: 1.4 }}
                  className="absolute inset-0 rounded-full bg-pink-300/30 blur-xl"
                />
              )}
            </AnimatePresence>

            {/* Character Image */}
            <div className="relative w-full h-full">
              <Image
                src={characterImage}
                alt="Chiikawa"
                fill
                className="object-contain drop-shadow-lg"
                priority
                unoptimized
              />
            </div>

          {/* Sparkles on happy bounce */}
          <AnimatePresence>
            {isHappyBounce && (
              <>
                <motion.span
                  initial={{ opacity: 0, scale: 0, x: -10, y: -10 }}
                  animate={{ opacity: 1, scale: 1, x: -20, y: -25 }}
                  exit={{ opacity: 0, scale: 0 }}
                  className="absolute top-0 left-0 text-yellow-400 text-lg"
                >
                  ✦
                </motion.span>
                <motion.span
                  initial={{ opacity: 0, scale: 0, x: 10, y: -10 }}
                  animate={{ opacity: 1, scale: 1, x: 25, y: -20 }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ delay: 0.1 }}
                  className="absolute top-0 right-0 text-pink-400 text-sm"
                >
                  ✦
                </motion.span>
                <motion.span
                  initial={{ opacity: 0, scale: 0, x: 15, y: 5 }}
                  animate={{ opacity: 1, scale: 1, x: 30, y: 0 }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ delay: 0.15 }}
                  className="absolute top-1/2 right-0 text-yellow-300 text-xs"
                >
                  ✦
                </motion.span>
              </>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* Subtle shadow underneath - remains on ground */}
      <motion.div
        animate={{
          scale: [1, 0.9, 1, 0.95, 1],
          opacity: [0.3, 0.2, 0.3, 0.25, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 md:w-14 h-2 bg-black/20 rounded-full blur-sm"
      />

      {/* Click Hint - Only show if never clicked before */}
      <AnimatePresence>
        {!hasEverClicked && !isClicked && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 5 }}
            animate={{ 
              opacity: 1, 
              scale: [1, 1.05, 1],
              y: 0,
            }}
            exit={{ opacity: 0, scale: 0.8, y: 5 }}
            transition={{
              opacity: { duration: 0.3 },
              scale: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap"
          >
            <div className="px-2 py-1 bg-pink-500 text-white text-[10px] rounded-full shadow-lg flex items-center gap-1">
              <span>👆</span>
              <span>點擊</span>
            </div>
            {/* Arrow pointing down */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-0 h-0 
              border-l-[5px] border-l-transparent 
              border-r-[5px] border-r-transparent 
              border-t-[6px] border-t-pink-500"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
