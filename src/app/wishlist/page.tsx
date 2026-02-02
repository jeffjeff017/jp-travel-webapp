'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  getSupabaseWishlistItems, 
  saveSupabaseWishlistItem, 
  updateSupabaseWishlistItem, 
  deleteSupabaseWishlistItem,
  type WishlistItemDB 
} from '@/lib/supabase'
import { getSettings, getSettingsAsync, type SiteSettings } from '@/lib/settings'
import { canEdit, getCurrentUser, isAdmin as checkIsAdmin, logout } from '@/lib/auth'
import SakuraCanvas from '@/components/SakuraCanvas'

// Main categories
const CATEGORIES = [
  { id: 'all', name: '全部', icon: '✨', color: 'from-gray-400 to-gray-600' },
  { id: 'cafe', name: 'Cafe', icon: '☕', color: 'from-amber-400 to-orange-500' },
  { id: 'food', name: '餐廳', icon: '🍽️', color: 'from-red-400 to-pink-500', hasSubTabs: true },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: 'from-purple-400 to-indigo-500' },
  { id: 'park', name: 'Park', icon: '🌳', color: 'from-green-400 to-emerald-500' },
]

// Sub-tabs for food category
const FOOD_SUBTABS = [
  { id: 'restaurant', name: '餐廳', icon: '🍽️' },
  { id: 'bakery', name: '麵包店', icon: '🥐' },
]

type WishlistItem = {
  id: number | string
  name: string
  note?: string
  imageUrl?: string
  link?: string
  category: string
  addedAt: string
  addedToDay?: number
  addedTime?: string
  isFavorite?: boolean
}

type Wishlist = {
  [key: string]: WishlistItem[]
}

const STORAGE_KEY = 'japan_travel_wishlist'
const CACHE_KEY = 'japan_travel_wishlist_cache_time'
const CACHE_DURATION = 5 * 60 * 1000

// Convert from Supabase format to local format
function fromSupabaseFormat(db: WishlistItemDB): WishlistItem {
  return {
    id: db.id,
    name: db.name,
    note: db.note || undefined,
    imageUrl: db.image_url || undefined,
    link: db.link || undefined,
    category: db.category,
    addedAt: db.created_at,
    addedToDay: db.added_to_trip?.day,
    addedTime: db.added_to_trip?.time,
    isFavorite: db.is_favorite,
  }
}

// Convert from local format to Supabase format
function toSupabaseFormat(item: Omit<WishlistItem, 'id' | 'addedAt'>): Omit<WishlistItemDB, 'id' | 'created_at'> {
  return {
    category: item.category,
    name: item.name,
    note: item.note || null,
    image_url: item.imageUrl || null,
    map_link: null,
    link: item.link || null,
    added_to_trip: item.addedToDay ? { day: item.addedToDay, time: item.addedTime || '12:00' } : null,
    is_favorite: item.isFavorite || false,
  }
}

export default function WishlistPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('all')
  const [activeFoodSubTab, setActiveFoodSubTab] = useState('restaurant')
  const [wishlist, setWishlist] = useState<Wishlist>({
    cafe: [],
    restaurant: [],
    bakery: [],
    shopping: [],
    park: [],
    threads: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [isSakuraMode, setIsSakuraMode] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showTravelNotice, setShowTravelNotice] = useState(false)
  
  // Add/Edit form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [newItemNote, setNewItemNote] = useState('')
  const [newItemImage, setNewItemImage] = useState('')
  const [newItemUrl, setNewItemUrl] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('cafe')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedItemPopup, setSelectedItemPopup] = useState<WishlistItem | null>(null)
  
  useEffect(() => {
    setIsAdmin(checkIsAdmin())
    
    // Load sakura mode from localStorage
    const savedSakuraMode = localStorage.getItem('sakura_mode')
    if (savedSakuraMode === 'true') {
      setIsSakuraMode(true)
    }
    
    // Load settings
    const loadSettings = async () => {
      const cachedSettings = getSettings()
      setSettings(cachedSettings)
      const freshSettings = await getSettingsAsync()
      if (freshSettings) {
        setSettings(freshSettings)
      }
    }
    loadSettings()
  }, [])
  
  // Group items by category
  const groupByCategory = useCallback((items: WishlistItem[]): Wishlist => {
    const grouped: Wishlist = {
      cafe: [],
      restaurant: [],
      bakery: [],
      shopping: [],
      park: [],
      threads: [],
    }
    items.forEach(item => {
      if (grouped[item.category]) {
        grouped[item.category].push(item)
      }
    })
    return grouped
  }, [])
  
  // Load wishlist
  useEffect(() => {
    const loadWishlist = async () => {
      setIsLoading(true)
      
      // Check cache first
      const cacheTime = localStorage.getItem(CACHE_KEY)
      const saved = localStorage.getItem(STORAGE_KEY)
      
      if (cacheTime && saved && Date.now() - parseInt(cacheTime) < CACHE_DURATION) {
        try {
          const parsed = JSON.parse(saved)
          setWishlist({
            cafe: parsed.cafe || [],
            restaurant: parsed.restaurant || [],
            bakery: parsed.bakery || [],
            shopping: parsed.shopping || [],
            park: parsed.park || [],
            threads: parsed.threads || [],
          })
          setIsLoading(false)
          return
        } catch (e) {
          console.error('Failed to parse cached wishlist:', e)
        }
      }
      
      // Load from Supabase
      try {
        const dbItems = await getSupabaseWishlistItems()
        if (dbItems.length > 0) {
          const items = dbItems.map(fromSupabaseFormat)
          const grouped = groupByCategory(items)
          setWishlist(grouped)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(grouped))
          localStorage.setItem(CACHE_KEY, Date.now().toString())
        } else if (saved) {
          const parsed = JSON.parse(saved)
          setWishlist({
            cafe: parsed.cafe || [],
            restaurant: parsed.restaurant || [],
            bakery: parsed.bakery || [],
            shopping: parsed.shopping || [],
            park: parsed.park || [],
            threads: parsed.threads || [],
          })
        }
      } catch (err) {
        console.error('Error loading wishlist:', err)
        if (saved) {
          const parsed = JSON.parse(saved)
          setWishlist({
            cafe: parsed.cafe || [],
            restaurant: parsed.restaurant || [],
            bakery: parsed.bakery || [],
            shopping: parsed.shopping || [],
            park: parsed.park || [],
            threads: parsed.threads || [],
          })
        }
      }
      
      setIsLoading(false)
    }
    
    loadWishlist()
  }, [groupByCategory])
  
  // Get filtered items based on active tab
  const getFilteredItems = () => {
    if (activeTab === 'all') {
      return Object.values(wishlist).flat()
    }
    if (activeTab === 'food') {
      return wishlist[activeFoodSubTab] || []
    }
    return wishlist[activeTab] || []
  }
  
  // Get current category for adding
  const getCurrentCategory = () => {
    if (activeTab === 'all') return 'cafe'
    if (activeTab === 'food') return activeFoodSubTab
    return activeTab
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
  
  // Handle add item
  const handleAddItem = async () => {
    if (!newItemName.trim()) return
    
    setIsSubmitting(true)
    
    try {
      const category = newItemCategory
      const newItem = {
        category,
        name: newItemName.trim(),
        note: newItemNote.trim() || undefined,
        imageUrl: newItemImage || undefined,
        link: newItemUrl.trim() || undefined,
        isFavorite: false,
      }
      
      const { data: dbItem, error } = await saveSupabaseWishlistItem(toSupabaseFormat(newItem))
      
      if (dbItem && !error) {
        const item = fromSupabaseFormat(dbItem)
        const newWishlist = { ...wishlist }
        if (!newWishlist[category]) newWishlist[category] = []
        newWishlist[category] = [...newWishlist[category], item]
        setWishlist(newWishlist)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newWishlist))
        localStorage.setItem(CACHE_KEY, Date.now().toString())
      }
      
      // Reset form
      setNewItemName('')
      setNewItemNote('')
      setNewItemImage('')
      setNewItemUrl('')
      setNewItemCategory('cafe')
      setShowAddForm(false)
    } catch (err) {
      console.error('Failed to add item:', err)
      alert('新增失敗')
    }
    
    setIsSubmitting(false)
  }
  
  // Handle delete item
  const handleDeleteItem = async (item: WishlistItem) => {
    if (!confirm('確定要刪除此項目嗎？')) return
    
    try {
      await deleteSupabaseWishlistItem(Number(item.id))
      
      const newWishlist = { ...wishlist }
      newWishlist[item.category] = newWishlist[item.category].filter(i => i.id !== item.id)
      setWishlist(newWishlist)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newWishlist))
    } catch (err) {
      console.error('Failed to delete item:', err)
    }
  }
  
  // Handle toggle favorite
  const handleToggleFavorite = async (item: WishlistItem) => {
    try {
      const updated = await updateSupabaseWishlistItem(Number(item.id), {
        is_favorite: !item.isFavorite
      })
      
      if (updated) {
        const newWishlist = { ...wishlist }
        const idx = newWishlist[item.category].findIndex(i => i.id === item.id)
        if (idx !== -1) {
          newWishlist[item.category][idx] = { ...newWishlist[item.category][idx], isFavorite: !item.isFavorite }
          setWishlist(newWishlist)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newWishlist))
        }
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err)
    }
  }
  
  const filteredItems = getFilteredItems()
  const foodCount = (wishlist.restaurant?.length || 0) + (wishlist.bakery?.length || 0)
  
  return (
    <main className={`min-h-screen bg-gray-50 pb-24 ${!isSakuraMode ? 'clean-mode' : ''}`}>
      <SakuraCanvas enabled={isSakuraMode} />
      
      {/* Header - Airbnb style */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-800">心願清單</h1>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-sakura-500 hover:bg-sakura-600 text-white rounded-full text-sm font-medium transition-colors"
            >
              <span>+</span>
              <span>新增</span>
            </button>
          </div>
          
          {/* Category Tabs - Airbnb style */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                  activeTab === cat.id
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                <span>{cat.icon}</span>
                <span className="text-sm font-medium">{cat.name}</span>
                {cat.id !== 'all' && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === cat.id ? 'bg-white/20' : 'bg-gray-100'
                  }`}>
                    {cat.id === 'food' ? foodCount : (wishlist[cat.id]?.length || 0)}
                  </span>
                )}
              </button>
            ))}
          </div>
          
          {/* Food Sub-tabs */}
          {activeTab === 'food' && (
            <div className="flex gap-2 mt-3">
              {FOOD_SUBTABS.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setActiveFoodSubTab(sub.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
                    activeFoodSubTab === sub.id
                      ? 'bg-sakura-100 text-sakura-700 border border-sakura-200'
                      : 'bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100'
                  }`}
                >
                  <span>{sub.icon}</span>
                  <span>{sub.name}</span>
                  <span className="text-xs text-gray-400">
                    ({wishlist[sub.id]?.length || 0})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      
      {/* Content - Airbnb grid */}
      <div className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-sakura-300 border-t-sakura-600 rounded-full animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">💝</div>
            <p className="text-gray-500 mb-4">還沒有收藏項目</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-2 bg-sakura-500 hover:bg-sakura-600 text-white rounded-full text-sm font-medium transition-colors"
            >
              新增第一個心願
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow group cursor-pointer"
                onClick={() => setSelectedItemPopup(item)}
              >
                {/* Image */}
                <div className="relative aspect-[4/3] bg-gray-100">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                      <span className="text-4xl opacity-50">
                        {CATEGORIES.find(c => c.id === item.category || (c.id === 'food' && ['restaurant', 'bakery'].includes(item.category)))?.icon || '📌'}
                      </span>
                    </div>
                  )}
                  
                  {/* Favorite button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleFavorite(item)
                    }}
                    className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-full shadow-sm hover:scale-110 transition-transform"
                  >
                    {item.isFavorite ? '❤️' : '🤍'}
                  </button>
                  
                  {/* Added to trip badge */}
                  {item.addedToDay && (
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-green-500 text-white text-xs font-medium rounded-full">
                      Day {item.addedToDay}
                    </div>
                  )}
                </div>
                
                {/* Content */}
                <div className="p-3">
                  <h3 className="font-medium text-gray-800 truncate">{item.name}</h3>
                  {item.note && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.note}</p>
                  )}
                  
                  {/* Actions */}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
                    <span className="text-xs text-gray-400">
                      {CATEGORIES.find(c => c.id === item.category || (c.id === 'food' && ['restaurant', 'bakery'].includes(item.category)))?.name || item.category}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteItem(item)
                      }}
                      className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      
      {/* Add Form Modal */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center"
            onClick={() => setShowAddForm(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-800">新增心願</h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Category Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">分類</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none bg-white"
                  >
                    <option value="cafe">☕ Cafe</option>
                    <option value="restaurant">🍽️ 餐廳</option>
                    <option value="bakery">🥐 麵包店</option>
                    <option value="shopping">🛍️ Shopping</option>
                    <option value="park">🌳 Park</option>
                    <option value="threads">🔗 Threads</option>
                  </select>
                </div>
                
                {/* Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">圖片</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  {newItemImage ? (
                    <div className="relative w-full h-32 rounded-xl overflow-hidden">
                      <img src={newItemImage} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setNewItemImage('')}
                        className="absolute top-2 right-2 w-6 h-6 bg-black/50 text-white rounded-full text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-24 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-sakura-300 hover:text-sakura-500 transition-colors flex flex-col items-center justify-center"
                    >
                      <span className="text-2xl mb-1">📷</span>
                      <span className="text-sm">上傳圖片</span>
                    </button>
                  )}
                </div>
                
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名稱 *</label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none"
                    placeholder="輸入名稱..."
                  />
                </div>
                
                {/* Note */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
                  <textarea
                    value={newItemNote}
                    onChange={(e) => setNewItemNote(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none resize-none"
                    placeholder="輸入備註..."
                    rows={2}
                  />
                </div>
                
                {/* URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">網址</label>
                  <input
                    type="url"
                    value={newItemUrl}
                    onChange={(e) => setNewItemUrl(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none"
                    placeholder="https://..."
                  />
                </div>
              </div>
              
              {/* Submit */}
              <button
                onClick={handleAddItem}
                disabled={!newItemName.trim() || isSubmitting}
                className="w-full mt-6 py-3 bg-sakura-500 hover:bg-sakura-600 disabled:bg-gray-300 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    處理中...
                  </>
                ) : (
                  '新增'
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Travel Notice Popup */}
      <AnimatePresence>
        {showTravelNotice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center"
            onClick={() => setShowTravelNotice(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-2xl max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">旅遊須知</h3>
                <button
                  onClick={() => setShowTravelNotice(false)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)]">
                {settings?.travelEssentials && settings.travelEssentials.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                      <span>🎒</span>
                      <span>旅遊必備</span>
                    </h4>
                    <div className="space-y-2">
                      {settings.travelEssentials.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                          <span>{item.icon}</span>
                          <span className="text-sm text-gray-700">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {settings?.travelPreparations && settings.travelPreparations.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                      <span>📝</span>
                      <span>出發前準備</span>
                    </h4>
                    <div className="space-y-2">
                      {settings.travelPreparations.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                          <span>{item.icon}</span>
                          <span className="text-sm text-gray-700">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(!settings?.travelEssentials?.length && !settings?.travelPreparations?.length) && (
                  <p className="text-gray-500 text-center py-8">暫無旅遊須知</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Item Detail Popup */}
      <AnimatePresence>
        {selectedItemPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center"
            onClick={() => setSelectedItemPopup(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Image */}
              {selectedItemPopup.imageUrl && (
                <div className="relative aspect-video bg-gray-100">
                  <img
                    src={selectedItemPopup.imageUrl}
                    alt={selectedItemPopup.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => setSelectedItemPopup(null)}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-black/50 text-white rounded-full"
                  >
                    ✕
                  </button>
                </div>
              )}
              
              {/* Content */}
              <div className="p-6">
                {!selectedItemPopup.imageUrl && (
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => setSelectedItemPopup(null)}
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                    >
                      ✕
                    </button>
                  </div>
                )}
                
                {/* Category badge */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                    {CATEGORIES.find(c => c.id === selectedItemPopup.category || (c.id === 'food' && ['restaurant', 'bakery'].includes(selectedItemPopup.category)))?.icon}{' '}
                    {selectedItemPopup.category === 'restaurant' ? '餐廳' : 
                     selectedItemPopup.category === 'bakery' ? '麵包店' :
                     CATEGORIES.find(c => c.id === selectedItemPopup.category)?.name || selectedItemPopup.category}
                  </span>
                  {selectedItemPopup.isFavorite && (
                    <span className="text-red-500">❤️ 已收藏</span>
                  )}
                </div>
                
                {/* Title */}
                <h2 className="text-xl font-semibold text-gray-800 mb-2">{selectedItemPopup.name}</h2>
                
                {/* Note */}
                {selectedItemPopup.note && (
                  <p className="text-gray-600 mb-4">{selectedItemPopup.note}</p>
                )}
                
                {/* URL */}
                {selectedItemPopup.link && (
                  <a
                    href={selectedItemPopup.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-500 hover:text-blue-600 mb-4"
                  >
                    <span>🔗</span>
                    <span className="underline truncate">{selectedItemPopup.link}</span>
                  </a>
                )}
                
                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      handleToggleFavorite(selectedItemPopup)
                      setSelectedItemPopup({ ...selectedItemPopup, isFavorite: !selectedItemPopup.isFavorite })
                    }}
                    className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                      selectedItemPopup.isFavorite 
                        ? 'bg-red-50 text-red-500' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {selectedItemPopup.isFavorite ? '❤️ 取消收藏' : '🤍 收藏'}
                  </button>
                  <button
                    onClick={() => {
                      handleDeleteItem(selectedItemPopup)
                      setSelectedItemPopup(null)
                    }}
                    className="px-6 py-3 bg-red-50 text-red-500 rounded-xl font-medium hover:bg-red-100 transition-colors"
                  >
                    刪除
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Mobile: Airbnb-style Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {/* 行程 Tab */}
          <Link
            href="/main"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-sakura-500 transition-colors"
          >
            <span className="text-xl mb-0.5">📋</span>
            <span className="text-[10px] font-medium">行程</span>
          </Link>
          
          {/* 心願清單 Tab - Active */}
          <button className="flex flex-col items-center justify-center flex-1 h-full text-sakura-500">
            <span className="text-xl mb-0.5">💖</span>
            <span className="text-[10px] font-medium">心願清單</span>
          </button>
          
          {/* Chiikawa Tab */}
          <button
            onClick={() => {
              const newValue = !isSakuraMode
              setIsSakuraMode(newValue)
              if (typeof window !== 'undefined') {
                localStorage.setItem('sakura_mode', String(newValue))
              }
            }}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              isSakuraMode ? 'text-pink-500' : 'text-gray-400'
            }`}
          >
            <span className="text-xl mb-0.5">{isSakuraMode ? '🌸' : '🔘'}</span>
            <span className="text-[10px] font-medium">{isSakuraMode ? '摸摸Chiikawa' : '點擊'}</span>
          </button>
          
          {/* 旅遊須知 Tab */}
          <button
            onClick={() => setShowTravelNotice(true)}
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-sakura-500 transition-colors"
          >
            <span className="text-xl mb-0.5">📖</span>
            <span className="text-[10px] font-medium">旅遊須知</span>
          </button>
          
          {/* 個人資料 Tab */}
          <Link
            href="/panel"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-sakura-500 transition-colors"
          >
            <span className="text-xl mb-0.5">👤</span>
            <span className="text-[10px] font-medium">個人資料</span>
          </Link>
        </div>
      </nav>
    </main>
  )
}
