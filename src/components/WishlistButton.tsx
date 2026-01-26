'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

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
  imageUrl?: string
  addedAt: string
  addedToDay?: number // If added to a trip, which day
  addedTime?: string // Time for the trip
}

type Wishlist = {
  [key: string]: WishlistItem[]
}

interface WishlistButtonProps {
  totalDays?: number
  onAddToTrip?: (item: WishlistItem, day: number, time: string, category: string) => void
  onNavigateToDay?: (day: number) => void
}

const STORAGE_KEY = 'japan_travel_wishlist'

export default function WishlistButton({ 
  totalDays = 7, 
  onAddToTrip,
  onNavigateToDay 
}: WishlistButtonProps) {
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
  const [newItemImage, setNewItemImage] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null)
  const [showAddToTrip, setShowAddToTrip] = useState<string | null>(null) // item id
  const [selectedDay, setSelectedDay] = useState(1)
  const [selectedTime, setSelectedTime] = useState('12:00')
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      setNewItemImage(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Add or update item
  const saveItem = () => {
    if (!newItemName.trim()) return
    
    if (editingItem) {
      // Update existing item
      const newWishlist = {
        ...wishlist,
        [activeTab]: wishlist[activeTab].map(item => 
          item.id === editingItem.id 
            ? { 
                ...item, 
                name: newItemName.trim(), 
                note: newItemNote.trim() || undefined,
                imageUrl: newItemImage || item.imageUrl
              }
            : item
        ),
      }
      saveWishlist(newWishlist)
    } else {
      // Add new item
      const newItem: WishlistItem = {
        id: Date.now().toString(),
        name: newItemName.trim(),
        note: newItemNote.trim() || undefined,
        imageUrl: newItemImage || undefined,
        addedAt: new Date().toISOString(),
      }
      
      const newWishlist = {
        ...wishlist,
        [activeTab]: [...wishlist[activeTab], newItem],
      }
      saveWishlist(newWishlist)
    }
    
    resetForm()
  }

  // Reset form
  const resetForm = () => {
    setNewItemName('')
    setNewItemNote('')
    setNewItemImage('')
    setIsAdding(false)
    setEditingItem(null)
  }

  // Edit item
  const startEdit = (item: WishlistItem) => {
    setEditingItem(item)
    setNewItemName(item.name)
    setNewItemNote(item.note || '')
    setNewItemImage(item.imageUrl || '')
    setIsAdding(true)
  }

  // Remove item from wishlist
  const removeItem = (itemId: string) => {
    const newWishlist = {
      ...wishlist,
      [activeTab]: wishlist[activeTab].filter(item => item.id !== itemId),
    }
    saveWishlist(newWishlist)
  }

  // Open Google Maps for item
  const openInGoogleMaps = (name: string) => {
    const query = encodeURIComponent(name + ' Japan')
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank')
  }

  // Add item to trip
  const handleAddToTrip = (item: WishlistItem) => {
    // Update item with day and time
    const newWishlist = {
      ...wishlist,
      [activeTab]: wishlist[activeTab].map(i => 
        i.id === item.id 
          ? { ...i, addedToDay: selectedDay, addedTime: selectedTime }
          : i
      ),
    }
    saveWishlist(newWishlist)
    
    // Callback to parent to actually create the trip
    if (onAddToTrip) {
      onAddToTrip({ ...item, addedToDay: selectedDay, addedTime: selectedTime }, selectedDay, selectedTime, activeTab)
    }
    
    setShowAddToTrip(null)
  }

  // Navigate to day
  const handleNavigateToDay = (day: number) => {
    if (onNavigateToDay) {
      onNavigateToDay(day)
      setIsOpen(false)
    }
  }

  // Get total count
  const totalCount = Object.values(wishlist).reduce((sum, items) => sum + items.length, 0)

  return (
    <>
      {/* Floating Button - positioned above DailyPopup */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-32 right-4 md:bottom-36 md:right-6 z-40 w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full shadow-lg flex items-center justify-center text-white hover:scale-110 transition-transform"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="心願清單"
      >
        <span className="text-xl md:text-2xl">💝</span>
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </motion.button>

      {/* Wishlist Modal - Centered */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsOpen(false); resetForm(); setShowAddToTrip(null); }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            
            {/* Modal - Always centered */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl w-[90vw] max-w-md max-h-[85vh] overflow-hidden"
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
                    onClick={() => { setIsOpen(false); resetForm(); setShowAddToTrip(null); }}
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
                        resetForm()
                        setShowAddToTrip(null)
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
              <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 160px)' }}>
                {/* Add/Edit Form */}
                {isAdding ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 bg-pink-50 rounded-xl border-2 border-dashed border-pink-200 mb-4"
                  >
                    <h4 className="text-sm font-medium text-pink-600 mb-3">
                      {editingItem ? '編輯項目' : '新增項目'}
                    </h4>
                    
                    {/* Image Upload */}
                    <div className="mb-3">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      {newItemImage ? (
                        <div className="relative w-full h-24 rounded-lg overflow-hidden">
                          <img 
                            src={newItemImage} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => setNewItemImage('')}
                            className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full text-xs flex items-center justify-center"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full py-3 border border-dashed border-pink-300 rounded-lg text-pink-400 text-sm hover:bg-pink-100 transition-colors"
                        >
                          📷 上載圖片 (選填)
                        </button>
                      )}
                    </div>
                    
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
                        onClick={resetForm}
                        className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={saveItem}
                        disabled={!newItemName.trim()}
                        className="flex-1 py-2 bg-pink-500 hover:bg-pink-600 disabled:bg-pink-300 text-white rounded-lg text-sm transition-colors"
                      >
                        {editingItem ? '更新' : '新增'}
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <button
                    onClick={() => setIsAdding(true)}
                    className="w-full mb-4 py-2 border-2 border-dashed border-pink-200 rounded-xl text-pink-500 hover:border-pink-400 hover:bg-pink-50 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <span>+</span>
                    <span>新增項目</span>
                  </button>
                )}
                
                {/* Items List */}
                {wishlist[activeTab].length === 0 && !isAdding ? (
                  <div className="text-center py-8">
                    <span className="text-4xl block mb-2">
                      {CATEGORIES.find(c => c.id === activeTab)?.icon}
                    </span>
                    <p className="text-gray-400 text-sm">還沒有收藏任何項目</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {wishlist[activeTab].map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-gray-50 rounded-xl overflow-hidden"
                      >
                        <div className="flex items-start gap-3 p-3">
                          {/* Image or Icon */}
                          {item.imageUrl ? (
                            <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                              <img 
                                src={item.imageUrl} 
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <span className="text-2xl w-14 h-14 flex items-center justify-center bg-white rounded-lg">
                              {CATEGORIES.find(c => c.id === activeTab)?.icon}
                            </span>
                          )}
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="font-medium text-gray-800">{item.name}</p>
                              {item.addedToDay && (
                                <span className="text-yellow-500">⭐</span>
                              )}
                            </div>
                            {item.note && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.note}</p>
                            )}
                            {item.addedToDay && (
                              <button
                                onClick={() => handleNavigateToDay(item.addedToDay!)}
                                className="text-xs text-pink-500 mt-1 hover:underline"
                              >
                                📅 Day {item.addedToDay} {item.addedTime && `@ ${item.addedTime}`}
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex border-t border-gray-100">
                          <button
                            onClick={() => openInGoogleMaps(item.name)}
                            className="flex-1 py-2 text-xs text-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1"
                          >
                            🗺️ 地圖
                          </button>
                          <button
                            onClick={() => startEdit(item)}
                            className="flex-1 py-2 text-xs text-gray-500 hover:bg-gray-100 transition-colors flex items-center justify-center gap-1 border-l border-gray-100"
                          >
                            ✏️ 編輯
                          </button>
                          {!item.addedToDay ? (
                            <button
                              onClick={() => setShowAddToTrip(showAddToTrip === item.id ? null : item.id)}
                              className="flex-1 py-2 text-xs text-pink-500 hover:bg-pink-50 transition-colors flex items-center justify-center gap-1 border-l border-gray-100"
                            >
                              ⭐ 加入行程
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                // Remove from trip
                                const newWishlist = {
                                  ...wishlist,
                                  [activeTab]: wishlist[activeTab].map(i => 
                                    i.id === item.id 
                                      ? { ...i, addedToDay: undefined, addedTime: undefined }
                                      : i
                                  ),
                                }
                                saveWishlist(newWishlist)
                              }}
                              className="flex-1 py-2 text-xs text-orange-500 hover:bg-orange-50 transition-colors flex items-center justify-center gap-1 border-l border-gray-100"
                            >
                              ↩️ 取消行程
                            </button>
                          )}
                          <button
                            onClick={() => removeItem(item.id)}
                            className="flex-1 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-1 border-l border-gray-100"
                          >
                            🗑️
                          </button>
                        </div>
                        
                        {/* Add to Trip Panel */}
                        <AnimatePresence>
                          {showAddToTrip === item.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-3 bg-pink-50 border-t border-pink-100">
                                <p className="text-xs text-pink-600 mb-2 font-medium">選擇日期和時間：</p>
                                <div className="flex gap-2">
                                  <select
                                    value={selectedDay}
                                    onChange={(e) => setSelectedDay(parseInt(e.target.value))}
                                    className="flex-1 px-2 py-1.5 text-sm border border-pink-200 rounded-lg focus:outline-none focus:border-pink-400"
                                  >
                                    {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => (
                                      <option key={day} value={day}>Day {day}</option>
                                    ))}
                                  </select>
                                  <input
                                    type="time"
                                    value={selectedTime}
                                    onChange={(e) => setSelectedTime(e.target.value)}
                                    className="px-2 py-1.5 text-sm border border-pink-200 rounded-lg focus:outline-none focus:border-pink-400"
                                  />
                                </div>
                                <button
                                  onClick={() => handleAddToTrip(item)}
                                  className="w-full mt-2 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm transition-colors"
                                >
                                  ⭐ 確認加入 Day {selectedDay}
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
