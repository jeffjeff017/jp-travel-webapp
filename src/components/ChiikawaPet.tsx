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
  '/images/usagi.png',
]

// Character key mapping - maps image file to character key for settings
// NOTE: Image files are named incorrectly but we fix it via mapping:
// - chiikawa-pet.png actually contains USAGI (rabbit with pink ears)
// - usagi.png actually contains CHIIKAWA (small round creature)
// - hachiware-pet.png correctly contains Hachiware (cat)
const CHARACTER_KEYS: Record<string, 'chiikawa' | 'hachiware' | 'usagi'> = {
  '/images/chiikawa-pet.png': 'usagi',     // This file contains Usagi (rabbit) → maps to 兔兔 dialogues
  '/images/hachiware-pet.png': 'hachiware', // Maps to "小八" tab in settings
  '/images/usagi.png': 'chiikawa',         // This file contains Chiikawa → maps to Chii dialogues
}

// Default character-specific messages - keyed by CHARACTER TYPE, not image path
const DEFAULT_MESSAGES_BY_CHARACTER: Record<string, string[]> = {
  'usagi': [
    '呀哈！ヤハ！',
    '噗嚕嚕嚕嚕！プルルルル！',
    '嗚拉！ウラ！',
    '哈？ハァ？',
  ],
  'hachiware': [
    'チャリメラ〜 查露麵拉～',
    'わははは！おかしいね！哇哈哈哈！太有趣了吧！',
  ],
  'chiikawa': [
    'ウンッ！嗯！',
    'ワッ！ワッ！哇！哇！',
  ],
}

// Type for custom messages per character
type CustomMessages = {
  chiikawa?: string[]
  hachiware?: string[]
  usagi?: string[]
}

export default function ChiikawaPet({ enabled = true }: ChiikawaPetProps) {
  const [isClicked, setIsClicked] = useState(false)
  const [speechMessage, setSpeechMessage] = useState('')
  const [isHappyBounce, setIsHappyBounce] = useState(false)
  const [characterImage, setCharacterImage] = useState(CHARACTER_IMAGES[0])
  const [customMessages, setCustomMessages] = useState<CustomMessages | null>(null)

  // Select random character on mount
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * CHARACTER_IMAGES.length)
    setCharacterImage(CHARACTER_IMAGES[randomIndex])
  }, [])
  
  // Load custom messages from settings - reload when enabled changes or on storage change
  useEffect(() => {
    const loadMessages = () => {
      try {
        const settingsStr = localStorage.getItem('site_settings')
        if (settingsStr) {
          const settings = JSON.parse(settingsStr)
          if (settings.chiikawaMessages) {
            setCustomMessages(settings.chiikawaMessages)
          }
        }
      } catch (e) {
        console.error('Failed to load chiikawa messages:', e)
      }
    }
    
    // Load on mount and when enabled
    loadMessages()
    
    // Listen for storage changes (when settings are updated in another tab or same page)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'site_settings') {
        loadMessages()
      }
    }
    
    // Also listen for custom event when settings are saved in same page
    const handleSettingsUpdate = () => {
      loadMessages()
    }
    
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('settingsUpdated', handleSettingsUpdate)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('settingsUpdated', handleSettingsUpdate)
    }
  }, [enabled])

  // Random speech message on click - use custom messages if available for this character
  const getRandomMessage = useCallback(() => {
    const characterKey = CHARACTER_KEYS[characterImage]
    
    // Check if custom messages exist for this specific character
    if (customMessages && characterKey && customMessages[characterKey] && customMessages[characterKey]!.length > 0) {
      const messages = customMessages[characterKey]!
      return messages[Math.floor(Math.random() * messages.length)]
    }
    
    // Otherwise fall back to default messages for this character (keyed by character type)
    const messages = DEFAULT_MESSAGES_BY_CHARACTER[characterKey] || DEFAULT_MESSAGES_BY_CHARACTER['chiikawa']
    return messages[Math.floor(Math.random() * messages.length)]
  }, [characterImage, customMessages])

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
