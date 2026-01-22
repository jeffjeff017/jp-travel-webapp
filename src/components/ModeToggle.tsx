'use client'

import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/i18n'

interface ModeToggleProps {
  isSakuraMode: boolean
  onToggle: () => void
}

export default function ModeToggle({ isSakuraMode, onToggle }: ModeToggleProps) {
  const { t } = useLanguage()

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-20 right-4 z-50 flex items-center gap-3 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-sakura-100"
    >
      <span className="text-sm font-medium text-gray-600">
        {isSakuraMode ? `🌸 ${t.main.sakuraMode}` : `🔵 ${t.main.normalMode}`}
      </span>
      
      <button
        onClick={onToggle}
        className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
          isSakuraMode ? 'bg-sakura-400' : 'bg-gray-300'
        }`}
      >
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md ${
            isSakuraMode ? 'left-8' : 'left-1'
          }`}
        />
      </button>
    </motion.div>
  )
}
