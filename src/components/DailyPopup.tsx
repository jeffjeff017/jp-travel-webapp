'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const POPUP_STORAGE_KEY = 'travel_notice_last_shown'
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

export default function DailyPopup() {
  const [isVisible, setIsVisible] = useState(false)
  const [isManuallyOpened, setIsManuallyOpened] = useState(false)

  useEffect(() => {
    const lastShown = localStorage.getItem(POPUP_STORAGE_KEY)
    const now = Date.now()

    if (!lastShown || now - parseInt(lastShown) > TWENTY_FOUR_HOURS) {
      const timer = setTimeout(() => {
        setIsVisible(true)
        localStorage.setItem(POPUP_STORAGE_KEY, now.toString())
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    setIsManuallyOpened(false)
  }

  const handleOpen = () => {
    setIsVisible(true)
    setIsManuallyOpened(true)
  }

  const travelItems = [
    { icon: '🛂', text: '護照及簽證文件' },
    { icon: '💴', text: '日圓現金及信用卡' },
    { icon: '📱', text: 'SIM卡或WiFi蛋' },
    { icon: '🔌', text: '日本規格轉換插頭' },
    { icon: '💊', text: '常備藥物' },
    { icon: '🧳', text: '輕便行李箱' },
  ]

  const preparations = [
    { icon: '🚃', text: '購買JR Pass或交通卡' },
    { icon: '🏨', text: '確認酒店預訂' },
    { icon: '📋', text: '下載離線地圖' },
    { icon: '🌡️', text: '查看天氣預報' },
  ]

  return (
    <>
      {/* Floating button to reopen popup */}
      <AnimatePresence>
        {!isVisible && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleOpen}
            className="fixed bottom-24 right-4 z-30 bg-sakura-500 text-white p-3 rounded-full shadow-lg hover:bg-sakura-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Popup */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-4 z-50 w-80 max-w-[calc(100vw-2rem)]"
          >
            <div className="bg-white rounded-2xl shadow-xl border border-sakura-100 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-sakura-400 to-sakura-500 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🌸</span>
                  <h3 className="text-white font-medium">旅遊須知</h3>
                </div>
                <button
                  onClick={handleClose}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-4 max-h-80 overflow-y-auto">
                {/* 必備物品 */}
                <div className="mb-4">
                  <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                    <span>🎒</span> 必備物品
                  </h4>
                  <ul className="space-y-1.5">
                    {travelItems.map((item, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                        <span>{item.icon}</span>
                        <span>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 出發前準備 */}
                <div className="mb-4">
                  <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                    <span>📝</span> 出發前準備
                  </h4>
                  <ul className="space-y-1.5">
                    {preparations.map((item, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                        <span>{item.icon}</span>
                        <span>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>此提示每24小時顯示一次</span>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="px-4 pb-4">
                <button
                  onClick={handleClose}
                  className="w-full py-2 bg-sakura-500 hover:bg-sakura-600 text-white rounded-lg font-medium transition-colors"
                >
                  知道了！
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
