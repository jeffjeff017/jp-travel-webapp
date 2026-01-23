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

// Speech bubble messages (randomly selected on click)
const SPEECH_MESSAGES = [
  '呀哈！ヤハ！',
  '噗嚕嚕嚕嚕！プルルルル！',
  '嗚拉！ウラ！',
  '哈？ハァ？',
]

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

  // Random speech message on click
  const getRandomMessage = useCallback(() => {
    return SPEECH_MESSAGES[Math.floor(Math.random() * SPEECH_MESSAGES.length)]
  }, [])

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

  // Speech bubble animation
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
      y: -10,
      transition: {
        duration: 0.2,
      },
    },
  }

  // Check if current character is usagi (only usagi can speak)
  const isUsagi = characterImage === '/images/chiikawa-pet.png'

  return (
    <div 
      className="fixed bottom-20 right-4 md:bottom-6 md:left-6 md:right-auto z-50 cursor-pointer select-none"
      onClick={handleClick}
    >
      {/* Speech Bubble - above character, only for usagi */}
      <AnimatePresence>
        {isClicked && speechMessage && isUsagi && (
          <motion.div
            variants={speechBubbleVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap z-10"
          >
            <div className="relative bg-white px-3 py-1.5 rounded-xl shadow-lg border-2 border-pink-200">
              <span className="text-xs font-bold text-pink-500 text-center block">
                {speechMessage}
              </span>
              {/* Speech bubble tail - pointing down */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 
                border-l-[6px] border-l-transparent 
                border-r-[6px] border-r-transparent 
                border-t-[8px] border-t-white
                drop-shadow-sm" 
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chiikawa Character */}
      <motion.div
        variants={floatingVariants}
        animate="animate"
        className="relative"
      >
          <motion.div
            variants={isHappyBounce ? happyBounceVariants : clickVariants}
            initial="initial"
            animate={isHappyBounce ? 'bounce' : isClicked ? 'clicked' : 'initial'}
            className="relative"
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
            <div className="relative w-16 h-16 md:w-20 md:h-20">
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

        {/* Subtle shadow underneath */}
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
      </motion.div>
    </div>
  )
}
