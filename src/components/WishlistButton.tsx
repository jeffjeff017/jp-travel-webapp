'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Wishlist categories with icons
const CATEGORIES = [
  { id: 'cafe', name: 'Cafe', icon: '☕', color: 'from-amber-400 to-orange-500' },
  { id: 'restaurant', name: '餐廳', icon: '🍽️', color: 'from-red-400 to-pink-500' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: 'from-purple-400 to-indigo-500' },
  { id: 'park', name: 'Park', icon: '🌳', color: 'from-green-400 to-emerald-500' },
]

type WishlistItem = {
  id: string
  name: string
  note?: string
  addedAt: string
}

type Wishlist = {
  [key: string]: WishlistItem[]
}

const STORAGE_KEY = 'japan_travel_wishlist'

export default function WishlistButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('cafe')
  const [wishlist, setWishlist] = useState<Wishlist>({
    cafe: [],
    restaurant: [],
    shopping: [],
    park: [],
  })
  const [newItemName, setNewItemName] = useState('')
  const [newItemNote, setNewItemNote] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  // Load wishlist from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        setWishlist(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to parse wishlist:', e)
      }
    }
  }, [])

  // Save wishlist to localStorage
  const saveWishlist = (newWishlist: Wishlist) => {
    setWishlist(newWishlist)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newWishlist))
  }

  // Add item to wishlist
  const addItem = () => {
    if (!newItemName.trim()) return
    
    const newItem: WishlistItem = {
      id: Date.now().toString(),
      name: newItemName.trim(),
      note: newItemNote.trim() || undefined,
      addedAt: new Date().toISOString(),
    }
    
    const newWishlist = {
      ...wishlist,
      [activeTab]: [...wishlist[activeTab], newItem],
    }
    
    saveWishlist(newWishlist)
    setNewItemName('')
    setNewItemNote('')
    setIsAdding(false)
  }

  // Remove item from wishlist
  const removeItem = (itemId: string) => {
    const newWishlist = {
      ...wishlist,
      [activeTab]: wishlist[activeTab].filter(item => item.id !== itemId),
    }
    saveWishlist(newWishlist)
  }

  // Get total count
  const totalCount = Object.values(wishlist).reduce((sum, items) => sum + items.length, 0)

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-40 w-14 h-14 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full shadow-lg flex items-center justify-center text-white hover:scale-110 transition-transform"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="心願清單"
      >
        <span className="text-2xl">💝</span>
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </motion.button>

      {/* Wishlist Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
            />
            
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.9 }}
              className="fixed bottom-0 left-0 right-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-50 bg-white rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[80vh] md:max-h-[70vh] md:w-full md:max-w-md overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-pink-400 to-rose-500 text-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">💝</span>
                    <h2 className="text-lg font-bold">心願清單</h2>
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                      {totalCount} 項
                    </span>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  >
                    ✕
                  </button>
                </div>
                
                {/* Category Tabs */}
                <div className="flex gap-1 mt-4">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setActiveTab(cat.id)
                        setIsAdding(false)
                      }}
                      className={`flex-1 py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                        activeTab === cat.id
                          ? 'bg-white text-pink-600'
                          : 'bg-white/20 hover:bg-white/30'
                      }`}
                    >
                      <span className="text-base block">{cat.icon}</span>
                      <span className="block mt-0.5">{cat.name}</span>
                      {wishlist[cat.id].length > 0 && (
                        <span className={`text-[10px] ${activeTab === cat.id ? 'text-pink-400' : 'text-white/70'}`}>
                          ({wishlist[cat.id].length})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Content */}
              <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 180px)' }}>
                {/* Items List */}
                {wishlist[activeTab].length === 0 && !isAdding ? (
                  <div className="text-center py-8">
                    <span className="text-4xl block mb-2">
                      {CATEGORIES.find(c => c.id === activeTab)?.icon}
                    </span>
                    <p className="text-gray-400 text-sm">還沒有收藏任何項目</p>
                    <button
                      onClick={() => setIsAdding(true)}
                      className="mt-4 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm transition-colors"
                    >
                      + 新增第一個
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {wishlist[activeTab].map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl group"
                      >
                        <span className="text-lg">
                          {CATEGORIES.find(c => c.id === activeTab)?.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800">{item.name}</p>
                          {item.note && (
                            <p className="text-xs text-gray-500 mt-0.5">{item.note}</p>
                          )}
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-500 text-xs flex items-center justify-center transition-all"
                        >
                          ✕
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
                
                {/* Add Form */}
                {isAdding ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 p-4 bg-pink-50 rounded-xl border-2 border-dashed border-pink-200"
                  >
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="名稱 (必填)"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 outline-none text-sm"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={newItemNote}
                      onChange={(e) => setNewItemNote(e.target.value)}
                      placeholder="備註 (選填)"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 outline-none text-sm mt-2"
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => {
                          setIsAdding(false)
                          setNewItemName('')
                          setNewItemNote('')
                        }}
                        className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={addItem}
                        disabled={!newItemName.trim()}
                        className="flex-1 py-2 bg-pink-500 hover:bg-pink-600 disabled:bg-pink-300 text-white rounded-lg text-sm transition-colors"
                      >
                        新增
                      </button>
                    </div>
                  </motion.div>
                ) : wishlist[activeTab].length > 0 && (
                  <button
                    onClick={() => setIsAdding(true)}
                    className="w-full mt-4 py-3 border-2 border-dashed border-pink-200 rounded-xl text-pink-500 hover:border-pink-400 hover:bg-pink-50 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <span>+</span>
                    <span>新增項目</span>
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
