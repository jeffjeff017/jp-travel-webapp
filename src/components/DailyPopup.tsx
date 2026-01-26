'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { getCurrentUser, getUserByUsername } from '@/lib/auth'
import { getSettings, defaultTravelEssentials, defaultTravelPreparations, type TravelNoticeItem } from '@/lib/settings'
import { getSupabaseChecklistStates, saveSupabaseChecklistState, type ChecklistStateDB } from '@/lib/supabase'

const POPUP_STORAGE_KEY = 'travel_notice_last_shown'
const CHECKLIST_STORAGE_KEY = 'travel_checklist_items_v4'
const CHECKLIST_CACHE_KEY = 'travel_checklist_cache_time'
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

type CheckedBy = {
  username: string
  avatarUrl?: string
}

type ChecklistItem = {
  id: string
  icon: string
  text: string
  checkedBy: CheckedBy[] // Array of users who checked this item
}

export default function DailyPopup() {
  const [isVisible, setIsVisible] = useState(false)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [essentialsCount, setEssentialsCount] = useState(6)
  const [currentUser, setCurrentUser] = useState<{ username: string; avatarUrl?: string } | null>(null)

  // Load current user
  useEffect(() => {
    const user = getCurrentUser()
    if (user) {
      // Get latest avatar from users list
      const fullUser = getUserByUsername(user.username)
      setCurrentUser({
        username: user.username,
        avatarUrl: fullUser?.avatarUrl || user.avatarUrl
      })
    }
  }, [])

  // Load checklist from settings and Supabase
  useEffect(() => {
    const loadChecklist = async () => {
      const settings = getSettings()
      const essentials = settings.travelEssentials || defaultTravelEssentials
      const preparations = settings.travelPreparations || defaultTravelPreparations
      
      // Combine essentials and preparations
      const allItems: Omit<ChecklistItem, 'checkedBy'>[] = [
        ...essentials,
        ...preparations,
      ]
      
      setEssentialsCount(essentials.length)
      
      // Check cache first
      const cacheTime = localStorage.getItem(CHECKLIST_CACHE_KEY)
      const saved = localStorage.getItem(CHECKLIST_STORAGE_KEY)
      
      if (cacheTime && saved && Date.now() - parseInt(cacheTime) < CACHE_DURATION) {
        try {
          const savedItems = JSON.parse(saved) as ChecklistItem[]
          const merged = allItems.map(item => {
            const savedItem = savedItems.find(s => s.id === item.id)
            return { ...item, checkedBy: savedItem?.checkedBy || [] }
          })
          setChecklist(merged)
          return
        } catch {
          // Continue to load from Supabase
        }
      }
      
      // Load from Supabase
      try {
        const dbStates = await getSupabaseChecklistStates()
        
        if (dbStates.length > 0) {
          // Create a map of id -> checkedBy
          const statesMap = new Map<string, CheckedBy[]>()
          dbStates.forEach(state => {
            statesMap.set(state.id, state.checked_by || [])
          })
          
          const merged = allItems.map(item => ({
            ...item,
            checkedBy: statesMap.get(item.id) || []
          }))
          
          setChecklist(merged)
          // Save to cache
          localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(merged))
          localStorage.setItem(CHECKLIST_CACHE_KEY, Date.now().toString())
        } else {
          // No data in Supabase, use localStorage or defaults
          if (saved) {
            try {
              const savedItems = JSON.parse(saved) as ChecklistItem[]
              const merged = allItems.map(item => {
                const savedItem = savedItems.find(s => s.id === item.id)
                return { ...item, checkedBy: savedItem?.checkedBy || [] }
              })
              setChecklist(merged)
              // Migrate to Supabase
              migrateToSupabase(merged)
            } catch {
              setChecklist(allItems.map(item => ({ ...item, checkedBy: [] })))
            }
          } else {
            setChecklist(allItems.map(item => ({ ...item, checkedBy: [] })))
          }
        }
      } catch (err) {
        console.error('Error loading checklist from Supabase:', err)
        // Fallback to localStorage
        if (saved) {
          try {
            const savedItems = JSON.parse(saved) as ChecklistItem[]
            const merged = allItems.map(item => {
              const savedItem = savedItems.find(s => s.id === item.id)
              return { ...item, checkedBy: savedItem?.checkedBy || [] }
            })
            setChecklist(merged)
          } catch {
            setChecklist(allItems.map(item => ({ ...item, checkedBy: [] })))
          }
        } else {
          setChecklist(allItems.map(item => ({ ...item, checkedBy: [] })))
        }
      }
    }
    
    loadChecklist()
  }, [])
  
  // Migrate local checklist to Supabase
  const migrateToSupabase = async (items: ChecklistItem[]) => {
    console.log('Migrating checklist to Supabase...')
    for (const item of items) {
      if (item.checkedBy.length > 0) {
        await saveSupabaseChecklistState({
          id: item.id,
          checked_by: item.checkedBy,
          updated_at: new Date().toISOString()
        })
      }
    }
  }

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

  // Toggle item checked status for current user
  const toggleItem = async (id: string) => {
    if (!currentUser) return // Must be logged in to check

    let newCheckedBy: CheckedBy[] = []
    
    const newChecklist = checklist.map(item => {
      if (item.id === id) {
        const userIndex = item.checkedBy.findIndex(u => u.username === currentUser.username)
        if (userIndex >= 0) {
          // User already checked - remove
          newCheckedBy = item.checkedBy.filter(u => u.username !== currentUser.username)
        } else {
          // User hasn't checked - add
          newCheckedBy = [...item.checkedBy, { username: currentUser.username, avatarUrl: currentUser.avatarUrl }]
        }
        return { ...item, checkedBy: newCheckedBy }
      }
      return item
    })
    
    setChecklist(newChecklist)
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(newChecklist))
    localStorage.setItem(CHECKLIST_CACHE_KEY, Date.now().toString())
    
    // Sync to Supabase
    try {
      await saveSupabaseChecklistState({
        id,
        checked_by: newCheckedBy,
        updated_at: new Date().toISOString()
      })
    } catch (err) {
      console.error('Error saving checklist state to Supabase:', err)
    }
  }

  // Check if current user has checked an item
  const isCheckedByCurrentUser = (item: ChecklistItem): boolean => {
    if (!currentUser) return false
    return item.checkedBy.some(u => u.username === currentUser.username)
  }

  // Get avatar for a user (refresh from users list)
  const getAvatarForUser = (checkedBy: CheckedBy): string | undefined => {
    const user = getUserByUsername(checkedBy.username)
    return user?.avatarUrl || checkedBy.avatarUrl
  }

  const handleClose = () => {
    setIsVisible(false)
  }

  const handleOpen = () => {
    setIsVisible(true)
  }

  // Calculate counts - use dynamic essentialsCount from settings
  const essentialsItems = checklist.slice(0, essentialsCount)
  const preparationItems = checklist.slice(essentialsCount)
  const essentialsChecked = essentialsItems.filter(i => i.checkedBy.length > 0).length
  const preparationChecked = preparationItems.filter(i => i.checkedBy.length > 0).length
  const totalChecked = checklist.filter(i => i.checkedBy.length > 0).length
  const totalItems = checklist.length

  // Render checklist item
  const renderItem = (item: ChecklistItem) => {
    const isChecked = item.checkedBy.length > 0
    const checkedByMe = isCheckedByCurrentUser(item)

    return (
      <li 
        key={item.id} 
        onClick={() => toggleItem(item.id)}
        className={`flex items-center justify-between gap-1.5 sm:gap-2 text-xs sm:text-sm p-1.5 sm:p-2 rounded-lg cursor-pointer transition-all ${
          isChecked 
            ? 'bg-green-50 text-green-600' 
            : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        <span className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="flex-shrink-0">{item.icon}</span>
          <span className="truncate">{item.text}</span>
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Show avatars of users who checked - limit to 2 on mobile */}
          {item.checkedBy.length > 0 && (
            <div className="flex -space-x-1 mr-0.5 sm:mr-1">
              {item.checkedBy.slice(0, 3).map((user, idx) => {
                const avatarUrl = getAvatarForUser(user)
                return avatarUrl ? (
                  <div 
                    key={user.username} 
                    className="w-4 h-4 sm:w-5 sm:h-5 rounded-full overflow-hidden border border-white shadow-sm"
                    style={{ zIndex: item.checkedBy.length - idx }}
                  >
                    <Image
                      src={avatarUrl}
                      alt={user.username}
                      width={20}
                      height={20}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div 
                    key={user.username}
                    className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-green-200 border border-white shadow-sm flex items-center justify-center text-[6px] sm:text-[8px] text-green-700 font-medium"
                    style={{ zIndex: item.checkedBy.length - idx }}
                  >
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                )
              })}
              {item.checkedBy.length > 3 && (
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gray-200 border border-white shadow-sm flex items-center justify-center text-[6px] sm:text-[8px] text-gray-600 font-medium">
                  +{item.checkedBy.length - 3}
                </div>
              )}
            </div>
          )}
          {/* Checkbox */}
          <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center transition-all text-[10px] sm:text-xs ${
            checkedByMe 
              ? 'bg-green-500 border-green-500 text-white' 
              : isChecked
                ? 'bg-green-200 border-green-300 text-green-600'
                : 'border-gray-300'
          }`}>
            {isChecked && '✓'}
          </span>
        </div>
      </li>
    )
  }

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
                {/* Login hint if not logged in */}
                {!currentUser && (
                  <div className="mb-3 p-2 bg-amber-50 text-amber-700 text-xs rounded-lg">
                    💡 登入後可標記已完成項目
                  </div>
                )}

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
                    {essentialsItems.map(renderItem)}
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
                    {preparationItems.map(renderItem)}
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
