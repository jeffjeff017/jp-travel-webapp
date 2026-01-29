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

  // Select random character on mount
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * CHARACTER_IMAGES.length)
    setCharacterImage(CHARACTER_IMAGES[randomIndex])
  }, [])

  // Random speech message on click based on current character
  const getRandomMessage = useCallback(() => {
    const messages = MESSAGES_BY_CHARACTER[characterImage] || MESSAGES_BY_CHARACTER['/images/chiikawa-pet.png']
    return messages[Math.floor(Math.random() * messages.length)]
  }, [characterImage])

  // Handle click interaction
  const handleClick = useCallback(() => {
    if (isClicked) return // Prevent spam clicking
    
    setIsClicked(true)
    setSpeechMessage(getRandomMessage())
    
    // Reset after 2 seconds
    setTimeout(() => {
      setIsClicked(false)
      setSpeechMessage('')
    }, 2000)
  }, [isClicked, getRandomMessage])

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

  // Speech bubble animation - pop from top
  const speechBubbleVariants = {
    initial: { 
      opacity: 0, 
      scale: 0.5, 
      y: 10,
    },
    animate: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 15,
      },
    },
    exit: { 
      opacity: 0, 
      scale: 0.5, 
      y: 10,
      transition: {
        duration: 0.2,
      },
    },
  }

  return (
    <div 
      className="fixed bottom-20 right-4 md:bottom-6 md:left-6 md:right-auto z-50 cursor-pointer select-none w-14 h-14 md:w-20 md:h-20 flex flex-col items-center justify-center"
      onClick={handleClick}
    >
      {/* Chiikawa Character with floating animation - bubble moves together */}
      <motion.div
        variants={floatingVariants}
        animate="animate"
        className="relative w-full h-full flex items-center justify-center"
      >
        {/* Speech Bubble - Inside floating wrapper so it animates together */}
        <AnimatePresence>
          {isClicked && speechMessage && (
            <motion.div
              variants={speechBubbleVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute right-full mr-1 md:right-auto md:bottom-full md:mb-2 md:mr-0 z-[100] md:left-1/2 md:-translate-x-1/2 top-[calc(50%-5px)] -translate-y-1/2 md:top-auto md:translate-y-0"
            >
              <div className="bg-white px-2 py-1 md:px-3 md:py-2 rounded-lg md:rounded-xl shadow-lg border border-pink-200 md:border-2 whitespace-nowrap relative">
                <span className="text-[10px] md:text-xs font-bold text-pink-500">
                  {speechMessage}
                </span>
                {/* Arrow - right side on mobile, bottom on desktop */}
                <div className="hidden md:block absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white" />
                <div className="md:hidden absolute top-1/2 -translate-y-1/2 -right-1.5 w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-white" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-10 md:w-14 h-1.5 md:h-2 bg-black/20 rounded-full blur-sm"
      />

    </div>
  )
}
