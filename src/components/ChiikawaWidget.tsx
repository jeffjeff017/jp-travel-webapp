'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ChiikawaWidget() {
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

  const emojis = ['✨', '💖', '🌸', '⭐', '💫', '🎀']
  const currentEmoji = emojis[clickCount % emojis.length]

  return (
    <div className="fixed bottom-4 right-4 z-40">
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
        <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl shadow-lg border-2 border-sakura-200 p-2 overflow-hidden hover:border-sakura-400 transition-colors">
          {/* Pixel Art Style Chiikawa */}
          <svg viewBox="0 0 32 32" className="w-full h-full">
            {/* Body */}
            <ellipse cx="16" cy="20" rx="10" ry="8" fill="#FFF8E7" />
            {/* Head */}
            <ellipse cx="16" cy="12" rx="9" ry="8" fill="#FFF8E7" />
            {/* Left ear */}
            <ellipse cx="9" cy="6" rx="3" ry="4" fill="#FFF8E7" />
            <ellipse cx="9" cy="5" rx="1.5" ry="2" fill="#FFB6C1" />
            {/* Right ear */}
            <ellipse cx="23" cy="6" rx="3" ry="4" fill="#FFF8E7" />
            <ellipse cx="23" cy="5" rx="1.5" ry="2" fill="#FFB6C1" />
            {/* Left eye */}
            <circle cx="12" cy="12" r="1.5" fill="#333" />
            {/* Right eye */}
            <circle cx="20" cy="12" r="1.5" fill="#333" />
            {/* Cheeks */}
            <ellipse cx="8" cy="14" rx="2" ry="1.5" fill="#FFB6C1" opacity="0.6" />
            <ellipse cx="24" cy="14" rx="2" ry="1.5" fill="#FFB6C1" opacity="0.6" />
            {/* Mouth */}
            <path
              d={isBouncing ? "M14 16 Q16 18 18 16" : "M14 16 Q16 17 18 16"}
              stroke="#333"
              strokeWidth="0.8"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-xs text-center mt-1 text-sakura-600 font-medium"
      >
        Click me!
      </motion.p>
    </div>
  )
}
