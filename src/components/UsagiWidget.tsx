'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

export default function UsagiWidget() {
  const [isBouncing, setIsBouncing] = useState(false)
  const [clickCount, setClickCount] = useState(0)
  const [showEmoji, setShowEmoji] = useState(false)

  const handleClick = () => {
    setIsBouncing(true)
    setClickCount((prev) => prev + 1)
    setShowEmoji(true)

    setTimeout(() => setIsBouncing(false), 600)
    setTimeout(() => setShowEmoji(false), 1000)
  }

  // Only heart-related emojis
  const heartEmojis = ['❤️', '💕', '💖', '💗', '💓', '💞', '💘', '💝', '🩷', '🤍', '🩵', '💜']
  const currentEmoji = heartEmojis[clickCount % heartEmojis.length]

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <AnimatePresence>
        {showEmoji && (
          <motion.div
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: 1, y: -30, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.5 }}
            className="absolute -top-8 left-1/2 -translate-x-1/2 text-2xl pointer-events-none"
          >
            {currentEmoji}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        onClick={handleClick}
        animate={
          isBouncing
            ? {
                y: [0, -20, 0, -10, 0],
                rotate: [0, -5, 5, -3, 0],
              }
            : { y: [0, -5, 0] }
        }
        transition={
          isBouncing
            ? { duration: 0.6, ease: 'easeOut' }
            : { duration: 2, repeat: Infinity, ease: 'easeInOut' }
        }
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="cursor-pointer select-none"
      >
        <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl shadow-lg border-2 border-sakura-200 p-1 overflow-hidden hover:border-sakura-400 transition-colors">
          <Image
            src="/images/usagi.png"
            alt="Usagi"
            width={80}
            height={80}
            className="w-full h-full object-contain"
          />
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-xs text-center mt-1 text-sakura-600 font-medium"
      >
        點我！
      </motion.p>
    </div>
  )
}
