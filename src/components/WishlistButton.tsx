'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import MultiMediaUpload from '@/components/MultiMediaUpload'
import { 
  getSupabaseWishlistItems, 
  saveSupabaseWishlistItem, 
  updateSupabaseWishlistItem, 
  deleteSupabaseWishlistItem,
  type WishlistItemDB 
} from '@/lib/supabase'
import { getSettings, getSettingsAsync, type DaySchedule } from '@/lib/settings'
import { formatTripDaySelectOption, formatTripDayAttachedSummary } from '@/lib/tripDayLabels'
import { getCurrentUser } from '@/lib/auth'

// Main categories (tabs)
const CATEGORIES = [
  { id: 'cafe', name: 'Cafe', icon: '☕', color: 'from-amber-400 to-orange-500' },
  { id: 'food', name: '餐廳', icon: '🍽️', color: 'from-red-400 to-pink-500', hasSubTabs: true },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: 'from-purple-400 to-indigo-500' },
  { id: 'park', name: 'Park', icon: '🌳', color: 'from-green-400 to-emerald-500' },
  { id: 'threads', name: 'Threads', icon: '/images/threads-logo.png', isImage: true, color: 'from-gray-600 to-gray-800', linkOnly: true },
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
  link?: string // For Threads links
  category: string
  addedAt: string
  addedToDay?: number
  addedTime?: string
  isFavorite?: boolean
  favoritedBy?: string[] // Per-user likes
}

type Wishlist = {
  [key: string]: WishlistItem[]
}

interface WishlistButtonProps {
  totalDays?: number
  onAddToTrip?: (item: WishlistItem, day: number, time: string, category: string) => void
  onNavigateToDay?: (day: number) => void
  isOpen?: boolean // Controlled open state (for mobile bottom nav)
  onOpenChange?: (open: boolean) => void // Callback when open state changes
}

function parseWishlistImages(imageUrl: string | undefined): string[] {
  if (!imageUrl) return []
  try {
    const parsed = JSON.parse(imageUrl)
    if (Array.isArray(parsed)) return parsed.filter((s: unknown) => typeof s === 'string' && s.trim())
  } catch {
    if (imageUrl.trim()) return [imageUrl]
  }
  return []
}

const STORAGE_KEY = 'japan_travel_wishlist'
const CACHE_KEY = 'japan_travel_wishlist_cache_time'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Parse favorited_by safely — only non-empty usernames count as real likes.
// Handles null, undefined, non-array, JSON string, and invalid entries like "" or null.
function parseFavoritedBy(raw: unknown): string[] {
  let arr: unknown[] = []
  if (Array.isArray(raw)) {
    arr = raw
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      arr = Array.isArray(parsed) ? parsed : []
    } catch {
      arr = []
    }
  }
  return arr.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
}

// Convert from Supabase format to local format
function fromSupabaseFormat(db: WishlistItemDB): WishlistItem {
  const favoritedBy = parseFavoritedBy(db.favorited_by)
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
    isFavorite: favoritedBy.length > 0 || db.is_favorite,
    favoritedBy,
  }
}

// Convert from local format to Supabase format
function toSupabaseFormat(item: Omit<WishlistItem, 'id' | 'addedAt'>): Omit<WishlistItemDB, 'id' | 'created_at'> {
  const favoritedBy = item.favoritedBy || []
  return {
    category: item.category,
    name: item.name,
    note: item.note || null,
    image_url: item.imageUrl || null,
    map_link: null,
    link: item.link || null,
    added_to_trip: item.addedToDay ? { day: item.addedToDay, time: item.addedTime || '12:00' } : null,
    added_by: null,
    is_favorite: favoritedBy.length > 0,
    favorited_by: favoritedBy,
  }
}

export default function WishlistButton({ 
  totalDays = 7, 
  onAddToTrip,
  onNavigateToDay,
  isOpen: controlledIsOpen,
  onOpenChange
}: WishlistButtonProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  
  // Use controlled or uncontrolled state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen
  const setIsOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open)
    } else {
      setInternalIsOpen(open)
    }
  }
  const [activeTab, setActiveTab] = useState('cafe')
  const [activeFoodSubTab, setActiveFoodSubTab] = useState('restaurant') // Sub-tab for food category
  const [wishlist, setWishlist] = useState<Wishlist>({
    cafe: [],
    restaurant: [],
    bakery: [],
    shopping: [],
    park: [],
    threads: [],
  })
  const [searchQuery, setSearchQuery] = useState('')
  
  // Get the actual category ID for data storage
  const getActiveCategoryId = () => {
    if (activeTab === 'food') {
      return activeFoodSubTab // 'restaurant' or 'bakery'
    }
    return activeTab
  }
  
  // Get count for food tab (sum of restaurant + bakery)
  const getFoodCount = () => {
    return (wishlist.restaurant?.length || 0) + (wishlist.bakery?.length || 0)
  }
  
  // Get filtered items based on search query
  const getFilteredItems = (items: WishlistItem[]) => {
    if (!searchQuery.trim()) return items
    const query = searchQuery.toLowerCase().trim()
    return items.filter(item => 
      item.name.toLowerCase().includes(query) ||
      (item.note && item.note.toLowerCase().includes(query))
    )
  }
  const [newItemName, setNewItemName] = useState('')
  const [newItemNote, setNewItemNote] = useState('')
  const [newItemImages, setNewItemImages] = useState<string[]>([])
  const [newItemLink, setNewItemLink] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null)
  const [showAddToTrip, setShowAddToTrip] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState(1)
  const [selectedTime, setSelectedTime] = useState('12:00')
  const [isLoading, setIsLoading] = useState(true)
  const [tripStartDate, setTripStartDate] = useState<string>('')
  const [daySchedules, setDaySchedules] = useState<DaySchedule[]>([])

  // Disable background scrolling when popup is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Get settings to retrieve trip start date
  useEffect(() => {
    const loadTripStartDate = async () => {
      // First load from cache for immediate display
      const cachedSettings = getSettings()
      setTripStartDate(cachedSettings.tripStartDate || '')
      setDaySchedules(cachedSettings.daySchedules || [])
      
      // Then fetch latest from Supabase
      const freshSettings = await getSettingsAsync()
      if (freshSettings.tripStartDate) {
        setTripStartDate(freshSettings.tripStartDate)
      }
      setDaySchedules(freshSettings.daySchedules || [])
    }
    loadTripStartDate()
  }, [])

  // Refresh trip start date when panel is opened
  useEffect(() => {
    if (isOpen) {
      const refreshTripStartDate = async () => {
        const freshSettings = await getSettingsAsync()
        if (freshSettings.tripStartDate) {
          setTripStartDate(freshSettings.tripStartDate)
        }
        setDaySchedules(freshSettings.daySchedules || [])
      }
      refreshTripStartDate()
    }
  }, [isOpen])

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

  // Load wishlist from Supabase
  useEffect(() => {
    const loadWishlist = async () => {
      setIsLoading(true)
      
      // Check cache first
      const cacheTime = localStorage.getItem(CACHE_KEY)
      const saved = localStorage.getItem(STORAGE_KEY)
      
      if (cacheTime && saved && Date.now() - parseInt(cacheTime) < CACHE_DURATION) {
        try {
          const parsed = JSON.parse(saved)
          const merged = {
            cafe: parsed.cafe || [],
            restaurant: parsed.restaurant || [],
            bakery: parsed.bakery || [],
            shopping: parsed.shopping || [],
            park: parsed.park || [],
            threads: parsed.threads || [],
          }
          setWishlist(merged)
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
          // Save to cache
          localStorage.setItem(STORAGE_KEY, JSON.stringify(grouped))
          localStorage.setItem(CACHE_KEY, Date.now().toString())
        } else {
          // Try loading from local storage if Supabase is empty
          if (saved) {
            try {
              const parsed = JSON.parse(saved)
              const merged = {
                cafe: parsed.cafe || [],
                restaurant: parsed.restaurant || [],
                bakery: parsed.bakery || [],
                shopping: parsed.shopping || [],
                park: parsed.park || [],
                threads: parsed.threads || [],
              }
              setWishlist(merged)
              // Migrate local data to Supabase
              migrateToSupabase(merged)
            } catch (e) {
              console.error('Failed to parse wishlist:', e)
            }
          }
        }
      } catch (err) {
        console.error('Error loading wishlist from Supabase:', err)
        // Fallback to localStorage
        if (saved) {
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
          } catch (e) {
            console.error('Failed to parse wishlist:', e)
          }
        }
      }
      
      setIsLoading(false)
    }
    
    loadWishlist()
  }, [groupByCategory])

  // Migrate local data to Supabase
  const migrateToSupabase = async (localWishlist: Wishlist) => {
    console.log('Migrating wishlist to Supabase...')
    for (const [category, items] of Object.entries(localWishlist)) {
      for (const item of items) {
        await saveSupabaseWishlistItem(toSupabaseFormat({ ...item, category }))
      }
    }
  }

  // Save wishlist to localStorage (cache) and Supabase
  const saveWishlist = useCallback((newWishlist: Wishlist) => {
    setWishlist(newWishlist)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newWishlist))
    localStorage.setItem(CACHE_KEY, Date.now().toString())
  }, [])

  // Check if current category is link-only (threads)
  const isLinkOnlyCategory = CATEGORIES.find(c => c.id === activeTab)?.linkOnly

  // Add or update item
  const saveItem = async () => {
    // For threads, require link; for others, require name
    if (isLinkOnlyCategory) {
      if (!newItemLink.trim()) return
    } else {
      if (!newItemName.trim()) return
    }
    
    const catId = getActiveCategoryId()
    
    if (editingItem) {
      // Update existing item
      const updatedItem = {
        ...editingItem,
        name: isLinkOnlyCategory 
          ? (newItemName.trim() || newItemLink.trim()) // Use title if provided, else link
          : newItemName.trim(), 
        note: newItemNote.trim() || undefined,
        imageUrl: newItemImages.length > 0 ? JSON.stringify(newItemImages) : editingItem.imageUrl,
        link: newItemLink.trim() || undefined
      }
      
      const newWishlist = {
        ...wishlist,
        [catId]: wishlist[catId].map(item => 
          item.id === editingItem.id ? updatedItem : item
        ),
      }
      saveWishlist(newWishlist)
      
      // Sync to Supabase
      if (typeof editingItem.id === 'number') {
        await updateSupabaseWishlistItem(editingItem.id, {
          name: updatedItem.name,
          note: updatedItem.note || null,
          image_url: updatedItem.imageUrl || null,
          link: updatedItem.link || null,
        })
      }
    } else {
      // Create new item - first save to Supabase to get the ID
      const user = getCurrentUser()
      const newItemData = {
        category: catId,
        name: isLinkOnlyCategory 
          ? (newItemName.trim() || newItemLink.trim())
          : newItemName.trim(),
        note: newItemNote.trim() || undefined,
        imageUrl: newItemImages.length > 0 ? JSON.stringify(newItemImages) : undefined,
        link: newItemLink.trim() || undefined,
        favoritedBy: [], // Only show bubble when user presses like — not when adding
        isFavorite: false,
      }
      
      const result = await saveSupabaseWishlistItem(toSupabaseFormat(newItemData))
      
      const newItem: WishlistItem = {
        id: result.data?.id || Date.now(),
        ...newItemData,
        addedAt: new Date().toISOString(),
      }
      
      const newWishlist = {
        ...wishlist,
        [catId]: [...wishlist[catId], newItem],
      }
      saveWishlist(newWishlist)
    }
    
    resetForm()
  }

  // Reset form
  const resetForm = () => {
    setNewItemName('')
    setNewItemNote('')
    setNewItemImages([])
    setNewItemLink('')
    setIsAdding(false)
    setEditingItem(null)
  }

  // Edit item
  const startEdit = (item: WishlistItem) => {
    setEditingItem(item)
    // For threads: if name equals link, it means no title was set
    const isThreadsCategory = item.category === 'threads'
    setNewItemName(isThreadsCategory && item.name === item.link ? '' : item.name)
    setNewItemNote(item.note || '')
    setNewItemImages(parseWishlistImages(item.imageUrl))
    setNewItemLink(item.link || '')
    setIsAdding(true)
  }

  // Remove item
  const removeItem = async (itemId: number | string) => {
    const catId = getActiveCategoryId()
    const newWishlist = {
      ...wishlist,
      [catId]: wishlist[catId].filter(item => item.id !== itemId),
    }
    saveWishlist(newWishlist)
    
    // Sync to Supabase
    if (typeof itemId === 'number') {
      await deleteSupabaseWishlistItem(itemId)
    }
  }

  // Toggle favorite (per-user: add/remove from favoritedBy)
  const toggleFavorite = async (itemId: number | string) => {
    const catId = getActiveCategoryId()
    const item = wishlist[catId].find(i => i.id === itemId)
    if (!item) return
    const currentUsername = getCurrentUser()?.username
    if (!currentUsername) return
    const favoritedBy = item.favoritedBy || []
    const isLiked = favoritedBy.includes(currentUsername)
    const newFavoritedBy = isLiked
      ? favoritedBy.filter(u => u !== currentUsername)
      : [...favoritedBy, currentUsername]
    const newFavorite = newFavoritedBy.length > 0
    if (typeof itemId === 'number') {
      const { data, error } = await updateSupabaseWishlistItem(itemId, { favorited_by: newFavoritedBy, is_favorite: newFavorite })
      if (error) {
        console.error('Failed to save like:', error)
        return
      }
    }
    const newWishlist = {
      ...wishlist,
      [catId]: wishlist[catId].map(i =>
        i.id === itemId ? { ...i, favoritedBy: newFavoritedBy, isFavorite: newFavorite } : i
      ),
    }
    saveWishlist(newWishlist)
  }

  // Get sorted items (current user's favorites first)
  const getSortedItems = (items: WishlistItem[]) => {
    const currentUsername = getCurrentUser()?.username || ''
    return [...items].sort((a, b) => {
      const aLiked = (a.favoritedBy || []).includes(currentUsername)
      const bLiked = (b.favoritedBy || []).includes(currentUsername)
      if (aLiked && !bLiked) return -1
      if (!aLiked && bLiked) return 1
      return 0
    })
  }

  // Get Google Maps URL
  const getGoogleMapsUrl = (name: string) => {
    const query = encodeURIComponent(name + ' Japan')
    return `https://www.google.com/maps/search/?api=1&query=${query}`
  }

  // Add item to trip
  const handleAddToTrip = async (item: WishlistItem) => {
    const catId = getActiveCategoryId()
    const newWishlist = {
      ...wishlist,
      [catId]: wishlist[catId].map(i => 
        i.id === item.id 
          ? { ...i, addedToDay: selectedDay, addedTime: selectedTime }
          : i
      ),
    }
    saveWishlist(newWishlist)
    
    // Sync to Supabase
    if (typeof item.id === 'number') {
      await updateSupabaseWishlistItem(item.id, {
        added_to_trip: { day: selectedDay, time: selectedTime }
      })
    }
    
    if (onAddToTrip) {
      onAddToTrip({ ...item, addedToDay: selectedDay, addedTime: selectedTime }, selectedDay, selectedTime, catId)
    }
    
    setShowAddToTrip(null)
  }
  
  // Remove item from trip
  const handleRemoveFromTrip = async (item: WishlistItem) => {
    const catId = getActiveCategoryId()
    const newWishlist = {
      ...wishlist,
      [catId]: wishlist[catId].map(i => 
        i.id === item.id 
          ? { ...i, addedToDay: undefined, addedTime: undefined }
          : i
      ),
    }
    saveWishlist(newWishlist)
    
    // Sync to Supabase
    if (typeof item.id === 'number') {
      await updateSupabaseWishlistItem(item.id, {
        added_to_trip: null
      })
    }
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
      {/* Floating Button - Hidden on mobile (uses bottom nav), shown on desktop */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="hidden md:flex fixed bottom-[88px] right-6 z-30 bg-gradient-to-r from-pink-400 to-rose-500 text-white shadow-lg hover:from-pink-500 hover:to-rose-600 transition-all items-center justify-center gap-2 p-4 rounded-2xl"
        title="心願清單"
      >
        <span className="text-xl">💝</span>
        <span className="font-medium text-sm">心願清單</span>
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
            
            {/* Modal - Truly centered */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
            >
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden">
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
                  
                  {/* Category Tabs - Scrollable on mobile */}
                  <div className="flex gap-1 mt-4 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                    {CATEGORIES.map(cat => {
                      // Get count - special handling for food (restaurant + bakery)
                      const count = cat.id === 'food' 
                        ? getFoodCount()
                        : (wishlist[cat.id]?.length || 0)
                      
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setActiveTab(cat.id)
                            resetForm()
                            setShowAddToTrip(null)
                          }}
                          className={`flex-1 min-w-[60px] py-2 px-1 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${
                            activeTab === cat.id
                              ? 'bg-white text-pink-600'
                              : 'bg-white/20 hover:bg-white/30'
                          }`}
                        >
                          {cat.isImage ? (
                            <span className="flex justify-center">
                              <Image
                                src={cat.icon}
                                alt={cat.name}
                                width={20}
                                height={20}
                                className="object-contain md:w-6 md:h-6"
                              />
                            </span>
                          ) : (
                            <span className="text-sm md:text-base block">{cat.icon}</span>
                          )}
                          <span className="block mt-0.5 text-[10px] md:text-xs truncate">
                            {cat.name}
                            {count > 0 && (
                              <span className={`ml-0.5 ${activeTab === cat.id ? 'text-pink-400' : 'text-white/70'}`}>
                                ({count})
                              </span>
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  
                  {/* Food Sub-tabs (餐廳 / 麵包店) */}
                  {activeTab === 'food' && (
                    <div className="flex gap-1 mt-2">
                      {FOOD_SUBTABS.map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => {
                            setActiveFoodSubTab(sub.id)
                            resetForm()
                            setShowAddToTrip(null)
                          }}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                            activeFoodSubTab === sub.id
                              ? 'bg-white/90 text-pink-600 shadow-sm'
                              : 'bg-white/30 hover:bg-white/50 text-white'
                          }`}
                        >
                          <span className="mr-1">{sub.icon}</span>
                          <span className="hidden sm:inline">{sub.name}</span>
                          <span className="sm:hidden">{sub.name.slice(0, 2)}</span>
                          {(wishlist[sub.id]?.length || 0) > 0 && (
                            <span className={`ml-1 ${activeFoodSubTab === sub.id ? 'text-pink-400' : 'text-white/80'}`}>
                              ({wishlist[sub.id]?.length || 0})
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Search Field */}
                <div className="px-4 py-2 border-b border-gray-100">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜尋名稱或地區..."
                      className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 210px)' }}>
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
                      
                      {/* Different form for Threads (link-only) vs other categories */}
                      {isLinkOnlyCategory ? (
                        <>
                          {/* Threads - Title + Link form */}
                          <input
                            type="text"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            placeholder="標題（選填）"
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 outline-none text-sm mb-2"
                            autoFocus
                          />
                          <input
                            type="url"
                            value={newItemLink}
                            onChange={(e) => setNewItemLink(e.target.value)}
                            placeholder="貼上 Threads 鏈結 (必填)"
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 outline-none text-sm"
                          />
                          <p className="text-xs text-gray-400 mt-1">
                            例如：https://www.threads.net/@user/post/xxx
                          </p>
                        </>
                      ) : (
                        <>
                          {/* Regular form with image, name, note - max 5 images */}
                          <div className="mb-3">
                            <MultiMediaUpload
                              value={newItemImages}
                              onChange={setNewItemImages}
                              label="圖片"
                              maxImages={5}
                            />
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
                          <input
                            type="url"
                            value={newItemLink}
                            onChange={(e) => setNewItemLink(e.target.value)}
                            placeholder="連結 (選填) - 例如：Instagram, 食記等"
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 outline-none text-sm mt-2"
                          />
                        </>
                      )}
                      
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={resetForm}
                          className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                        >
                          取消
                        </button>
                        <button
                          onClick={saveItem}
                          disabled={isLinkOnlyCategory ? !newItemLink.trim() : !newItemName.trim()}
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
                  {(() => {
                    const currentItems = getFilteredItems(wishlist[getActiveCategoryId()] || [])
                    const hasNoItems = wishlist[getActiveCategoryId()]?.length === 0
                    const hasNoFilteredItems = currentItems.length === 0 && searchQuery.trim()
                    
                    if (hasNoItems && !isAdding) {
                      return (
                        <div className="text-center py-8">
                          {activeTab === 'threads' ? (
                            <span className="flex justify-center mb-2">
                              <Image
                                src="/images/threads-logo.png"
                                alt="Threads"
                                width={48}
                                height={48}
                                className="object-contain"
                              />
                            </span>
                          ) : (
                            <span className="text-4xl block mb-2">
                              {activeTab === 'food' 
                                ? FOOD_SUBTABS.find(s => s.id === activeFoodSubTab)?.icon
                                : CATEGORIES.find(c => c.id === activeTab)?.icon}
                            </span>
                          )}
                          <p className="text-gray-400 text-sm">還沒有收藏任何項目</p>
                        </div>
                      )
                    }
                    
                    if (hasNoFilteredItems) {
                      return (
                        <div className="text-center py-8">
                          <span className="text-4xl block mb-2">🔍</span>
                          <p className="text-gray-400 text-sm">找不到符合「{searchQuery}」的項目</p>
                        </div>
                      )
                    }
                    
                    return (
                    <div className="space-y-3">
                      {getSortedItems(currentItems).map((item, index) => {
                        const isThreadsItem = activeTab === 'threads'
                        
                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="bg-gray-50 rounded-xl overflow-hidden"
                          >
                            <div className="flex items-start gap-3 p-3">
                              {/* Image or Icon */}
                              {isThreadsItem ? (
                                <span className="w-14 h-14 flex items-center justify-center bg-white rounded-lg flex-shrink-0 p-2">
                                  <Image
                                    src="/images/threads-logo.png"
                                    alt="Threads"
                                    width={40}
                                    height={40}
                                    className="object-contain"
                                  />
                                </span>
                              ) : (() => {
                                const imgs = parseWishlistImages(item.imageUrl)
                                const src = imgs[0]
                                return src ? (
                                  <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                                    <img 
                                      src={src} 
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : null
                              })() ?? (
                                <span className="text-2xl w-14 h-14 flex items-center justify-center bg-white rounded-lg flex-shrink-0">
                                  {activeTab === 'food'
                                    ? FOOD_SUBTABS.find(s => s.id === activeFoodSubTab)?.icon
                                    : CATEGORIES.find(c => c.id === activeTab)?.icon}
                                </span>
                              )}
                              
                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                {isThreadsItem ? (
                                  <>
                                    {/* Threads - show title (if set) and link */}
                                    {item.name && item.name !== item.link && (
                                      <p className="font-medium text-gray-800 truncate">{item.name}</p>
                                    )}
                                    <a
                                      href={item.link || item.name}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-blue-600 hover:text-blue-700 hover:underline block truncate"
                                      title={item.link || item.name}
                                    >
                                      {item.link || item.name}
                                    </a>
                                    <p className="text-xs text-gray-400 mt-1">
                                      {new Date(item.addedAt).toLocaleDateString('zh-TW')} 新增
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    {/* Regular item */}
                                    <div className="flex items-center gap-1">
                                      <p className="font-medium text-gray-800">{item.name}</p>
                                      {item.addedToDay && (
                                        <span className="text-yellow-500">⭐</span>
                                      )}
                                    </div>
                                    {item.note && (
                                      <p className="text-xs text-gray-500 mt-0.5">{item.note}</p>
                                    )}
                                    {/* Link - Google Maps or custom link */}
                                    {item.link && !item.link.includes('google.com/maps') && !item.link.includes('maps.google') ? (
                                      <a
                                        href={item.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 mt-1"
                                      >
                                        🔗 點擊連結轉跳
                                      </a>
                                    ) : (
                                      <a
                                        href={item.link && (item.link.includes('google.com/maps') || item.link.includes('maps.google')) ? item.link : getGoogleMapsUrl(item.name)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 mt-1"
                                      >
                                        🗺️ 在 Google Maps 查看
                                      </a>
                                    )}
                                    {item.addedToDay && (
                                      <button
                                        onClick={() => handleNavigateToDay(item.addedToDay!)}
                                        className="block text-xs text-pink-500 mt-1 hover:underline"
                                      >
                                        📅 {formatTripDayAttachedSummary(item.addedToDay, { tripStartDate, daySchedules })}{item.addedTime ? ` @ ${item.addedTime}` : ''}
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                              
                              {/* Heart Button - Right side (per-user like) */}
                              {(() => {
                                const isLiked = (item.favoritedBy || []).includes(getCurrentUser()?.username || '')
                                return (
                                  <button
                                    onClick={() => toggleFavorite(item.id)}
                                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                      isLiked ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-400'
                                    }`}
                                    title={isLiked ? '取消置頂' : '置頂'}
                                  >
                                    {isLiked ? '❤️' : '🤍'}
                                  </button>
                                )
                              })()}
                            </div>
                            
                            {/* Actions - Different for threads (no add to trip) */}
                            <div className="flex border-t border-gray-100">
                              <button
                                onClick={() => startEdit(item)}
                                className="flex-1 py-2 text-xs text-gray-500 hover:bg-gray-100 transition-colors flex items-center justify-center gap-1"
                              >
                                ✏️ 編輯
                              </button>
                              {/* Only show add to trip for non-threads items */}
                              {!isThreadsItem && (
                                !item.addedToDay ? (
                                  <button
                                    onClick={() => setShowAddToTrip(showAddToTrip === String(item.id) ? null : String(item.id))}
                                    className="flex-1 py-2 text-xs text-pink-500 hover:bg-pink-50 transition-colors flex items-center justify-center gap-1 border-l border-gray-100"
                                  >
                                    ⭐ 加入行程
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleRemoveFromTrip(item)}
                                    className="flex-1 py-2 text-xs text-orange-500 hover:bg-orange-50 transition-colors flex items-center justify-center gap-1 border-l border-gray-100"
                                  >
                                    ↩️ 取消行程
                                  </button>
                                )
                              )}
                              <button
                                onClick={() => removeItem(item.id)}
                                className="flex-1 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-1 border-l border-gray-100"
                              >
                                🗑️ 刪除
                              </button>
                            </div>
                            
                            {/* Add to Trip Panel - Only for non-threads items */}
                            {!isThreadsItem && (
                              <AnimatePresence>
                                {showAddToTrip === String(item.id) && (
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
                                            <option key={day} value={day}>
                                              {formatTripDaySelectOption(day, { tripStartDate, daySchedules })}
                                            </option>
                                          ))}
                                        </select>
                                        <input
                                          type="time"
                                          value={selectedTime}
                                          onChange={(e) => setSelectedTime(e.target.value)}
                                          className="px-2 py-1.5 text-sm border border-pink-200 rounded-lg focus:outline-none focus:border-pink-400"
                                        />
                                      </div>
                                      <div className="flex gap-2 mt-2">
                                        <button
                                          onClick={() => setShowAddToTrip(null)}
                                          className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm transition-colors"
                                        >
                                          取消
                                        </button>
                                        <button
                                          onClick={() => handleAddToTrip(item)}
                                          className="flex-1 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm transition-colors"
                                        >
                                          ⭐ 確認加入
                                        </button>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            )}
                          </motion.div>
                        )
                      })}
                    </div>
                    )
                  })()}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
