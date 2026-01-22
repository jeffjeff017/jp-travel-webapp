'use client'

import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/i18n'

interface ModeToggleProps {
  isCleanMode: boolean
  onToggle: () => void
}

export default function ModeToggle({ isCleanMode, onToggle }: ModeToggleProps) {
  const { t } = useLanguage()

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-sakura-100"
    >
      <span className="text-sm font-medium text-gray-600">
        {isCleanMode ? `🔵 ${t.main.normalMode}` : `🌸 ${t.main.sakuraMode}`}
      </span>
      
      <button
        onClick={onToggle}
        className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
          isCleanMode ? 'bg-gray-300' : 'bg-sakura-400'
        }`}
      >
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md ${
            isCleanMode ? 'left-1' : 'left-8'
          }`}
        />
      </button>
    </motion.div>
  )
}
