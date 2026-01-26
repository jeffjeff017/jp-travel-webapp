'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const POPUP_STORAGE_KEY = 'travel_notice_last_shown'
const CHECKLIST_STORAGE_KEY = 'travel_checklist_items'
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

type ChecklistItem = {
  id: string
  icon: string
  text: string
  checked: boolean
}

export default function DailyPopup() {
  const [isVisible, setIsVisible] = useState(false)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])

  // Initialize checklist
  const defaultItems: Omit<ChecklistItem, 'checked'>[] = [
    // 必備物品
    { id: 'passport', icon: '🛂', text: '護照及簽證文件' },
    { id: 'money', icon: '💴', text: '日圓現金及信用卡' },
    { id: 'sim', icon: '📱', text: 'SIM卡或WiFi蛋' },
    { id: 'adapter', icon: '🔌', text: '日本規格轉換插頭' },
    { id: 'medicine', icon: '💊', text: '常備藥物' },
    { id: 'luggage', icon: '🧳', text: '輕便行李箱' },
    // 出發前準備
    { id: 'jrpass', icon: '🚃', text: '購買JR Pass或交通卡' },
    { id: 'hotel', icon: '🏨', text: '確認酒店預訂' },
    { id: 'map', icon: '📋', text: '下載離線地圖' },
    { id: 'weather', icon: '🌡️', text: '查看天氣預報' },
  ]

  // Load checklist from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(CHECKLIST_STORAGE_KEY)
    if (saved) {
      try {
        const savedItems = JSON.parse(saved) as ChecklistItem[]
        // Merge with default items to handle new items
        const merged = defaultItems.map(item => {
          const savedItem = savedItems.find(s => s.id === item.id)
          return { ...item, checked: savedItem?.checked || false }
        })
        setChecklist(merged)
      } catch {
        setChecklist(defaultItems.map(item => ({ ...item, checked: false })))
      }
    } else {
      setChecklist(defaultItems.map(item => ({ ...item, checked: false })))
    }
  }, [])

  // Auto-show popup
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

  // Toggle item checked status
  const toggleItem = (id: string) => {
    const newChecklist = checklist.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    )
    setChecklist(newChecklist)
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(newChecklist))
  }

  const handleClose = () => {
    setIsVisible(false)
  }

  const handleOpen = () => {
    setIsVisible(true)
  }

  // Calculate counts
  const essentialsItems = checklist.slice(0, 6)
  const preparationItems = checklist.slice(6)
  const essentialsChecked = essentialsItems.filter(i => i.checked).length
  const preparationChecked = preparationItems.filter(i => i.checked).length
  const totalChecked = checklist.filter(i => i.checked).length
  const totalItems = checklist.length

  return (
    <>
      {/* Floating button - Bottom Right */}
      <AnimatePresence>
        {!isVisible && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleOpen}
            className="fixed bottom-6 right-6 z-30 bg-sakura-500 text-white p-4 rounded-2xl shadow-lg hover:bg-sakura-600 transition-colors flex items-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium text-sm">旅遊須知</span>
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
            className="fixed bottom-6 right-6 z-50 w-80 max-w-[calc(100vw-3rem)]"
          >
            <div className="bg-white rounded-2xl shadow-xl border border-sakura-100 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-sakura-400 to-sakura-500 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🌸</span>
                  <h3 className="text-white font-medium">旅遊須知</h3>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full text-white">
                    {totalChecked}/{totalItems}
                  </span>
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
                  <h4 className="font-medium text-gray-800 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span>🎒</span> 必備物品
                    </span>
                    <span className="text-xs text-sakura-500 bg-sakura-50 px-2 py-0.5 rounded-full">
                      {essentialsChecked}/{essentialsItems.length}
                    </span>
                  </h4>
                  <ul className="space-y-1">
                    {essentialsItems.map((item) => (
                      <li 
                        key={item.id} 
                        onClick={() => toggleItem(item.id)}
                        className={`flex items-center justify-between gap-2 text-sm p-2 rounded-lg cursor-pointer transition-all ${
                          item.checked 
                            ? 'bg-green-50 text-green-700' 
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>{item.icon}</span>
                          <span className={item.checked ? 'line-through' : ''}>{item.text}</span>
                        </span>
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          item.checked 
                            ? 'bg-green-500 border-green-500 text-white' 
                            : 'border-gray-300'
                        }`}>
                          {item.checked && '✓'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 出發前準備 */}
                <div className="mb-4">
                  <h4 className="font-medium text-gray-800 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span>📝</span> 出發前準備
                    </span>
                    <span className="text-xs text-sakura-500 bg-sakura-50 px-2 py-0.5 rounded-full">
                      {preparationChecked}/{preparationItems.length}
                    </span>
                  </h4>
                  <ul className="space-y-1">
                    {preparationItems.map((item) => (
                      <li 
                        key={item.id} 
                        onClick={() => toggleItem(item.id)}
                        className={`flex items-center justify-between gap-2 text-sm p-2 rounded-lg cursor-pointer transition-all ${
                          item.checked 
                            ? 'bg-green-50 text-green-700' 
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>{item.icon}</span>
                          <span className={item.checked ? 'line-through' : ''}>{item.text}</span>
                        </span>
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          item.checked 
                            ? 'bg-green-500 border-green-500 text-white' 
                            : 'border-gray-300'
                        }`}>
                          {item.checked && '✓'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Progress */}
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span>準備進度</span>
                    <span className={totalChecked === totalItems ? 'text-green-500 font-medium' : ''}>
                      {Math.round((totalChecked / totalItems) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-sakura-400 to-green-400 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(totalChecked / totalItems) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  {totalChecked === totalItems && (
                    <p className="text-xs text-green-500 mt-2 text-center">🎉 準備完成！旅途愉快！</p>
                  )}
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
