'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  saveSupabaseWishlistItem, 
  updateSupabaseWishlistItem, 
  deleteSupabaseWishlistItem,
  saveSupabaseChecklistState,
  type WishlistItemDB 
} from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { useWishlistItems, useChecklistStates, queryKeys } from '@/hooks/useQueries'
import { getSettings, getSettingsAsync, type SiteSettings } from '@/lib/settings'
import { canEdit, getCurrentUser, isAdmin as checkIsAdmin, isAuthenticated, logout, getUsers, getUsersAsync, type User } from '@/lib/auth'
import SakuraCanvas from '@/components/SakuraCanvas'
import ChiikawaPet from '@/components/ChiikawaPet'

// Main categories
const CATEGORIES = [
  { id: 'all', name: '全部', icon: '✨', color: 'from-gray-400 to-gray-600' },
  { id: 'cafe', name: 'Cafe', icon: '☕', color: 'from-amber-400 to-orange-500' },
  { id: 'food', name: '餐廳', icon: '🍽️', color: 'from-red-400 to-pink-500', hasSubTabs: true },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: 'from-purple-400 to-indigo-500' },
  { id: 'park', name: 'Park', icon: '🌳', color: 'from-green-400 to-emerald-500' },
  { id: 'threads', name: 'Threads', icon: '🔗', color: 'from-gray-600 to-gray-800' },
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
  addedBy?: { username: string; displayName: string; avatarUrl?: string }
}

type Wishlist = {
  [key: string]: WishlistItem[]
}

const STORAGE_KEY = 'japan_travel_wishlist'
const CACHE_KEY = 'japan_travel_wishlist_cache_time'
const CACHE_DURATION = 5 * 60 * 1000

// Helper function for Google Maps URL
const getGoogleMapsUrl = (placeName: string) => {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName + ' Japan')}`
}

// Check if a link is a Google Maps URL
const isGoogleMapsLink = (link?: string) => {
  if (!link) return false
  return link.includes('google.com/maps') || link.includes('maps.google')
}

// Check if an item is a threads item (should not show Google Maps link)
const isThreadsCategory = (category: string) => category === 'threads'

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
    addedBy: db.added_by ? {
      username: db.added_by.username,
      displayName: db.added_by.display_name,
      avatarUrl: db.added_by.avatar_url,
    } : undefined,
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
    added_by: item.addedBy ? {
      username: item.addedBy.username,
      display_name: item.addedBy.displayName,
      avatar_url: item.addedBy.avatarUrl,
    } : null,
    is_favorite: item.isFavorite || false,
  }
}

export default function WishlistPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: wishlistDbItems, isLoading: isWishlistLoading } = useWishlistItems()
  const { data: checklistData } = useChecklistStates()
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
  // Checklist state for travel notice
  const [checkedItems, setCheckedItems] = useState<Record<string, { username: string; displayName: string; avatarUrl?: string }[]>>({})
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string; displayName: string; avatarUrl?: string } | null>(null)
  // Users state (for avatar display)
  const [users, setUsers] = useState<User[]>([])
  
  // Popup "對此讚好" animation state
  const [showPopupLikeAnim, setShowPopupLikeAnim] = useState(false)
  
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
  const [searchQuery, setSearchQuery] = useState('')

  // Disable background scrolling when any popup/modal is active
  useEffect(() => {
    const anyPopupOpen = showTravelNotice || showAddForm || !!selectedItemPopup
    if (anyPopupOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showTravelNotice, showAddForm, selectedItemPopup])
  
  useEffect(() => {
    setIsAdmin(checkIsAdmin())
    setCurrentUser(getCurrentUser())
    // Load users for avatar display
    setUsers(getUsers())
    
    // Load sakura mode from localStorage
    const savedSakuraMode = localStorage.getItem('sakura_mode')
    if (savedSakuraMode === 'true') {
      setIsSakuraMode(true)
    }
    
    // Load settings + fresh users (checklist states are managed by TanStack Query)
    const init = async () => {
      const cachedSettings = getSettings()
      setSettings(cachedSettings)
      const freshSettings = await getSettingsAsync()
      if (freshSettings) {
        setSettings(freshSettings)
      }
      
      // Load fresh users and reconstruct currentUser if cookie is missing
      try {
        const freshUsers = await getUsersAsync()
        setUsers(freshUsers)
        
        if (!getCurrentUser() && isAuthenticated() && freshUsers.length > 0) {
          const adminUser = freshUsers.find(u => u.role === 'admin')
          const fallbackUser = adminUser || freshUsers[0]
          if (fallbackUser) {
            setCurrentUser({
              username: fallbackUser.username,
              role: fallbackUser.role,
              displayName: fallbackUser.displayName,
              avatarUrl: fallbackUser.avatarUrl
            })
          }
        }
      } catch (err) {
        console.warn('Failed to fetch users:', err)
      }
    }
    init()
  }, [])
  
  // Get user's current avatar from users list (most up-to-date)
  // Returns undefined if no avatar, so UI can show initials fallback
  const getUserAvatar = (username: string, fallbackAvatarUrl?: string): string | undefined => {
    const user = users.find(u => u.username === username)
    return user?.avatarUrl || fallbackAvatarUrl || undefined
  }

  // Get user's current display name from users list (most up-to-date)
  // Falls back to stored displayName, then username
  const getUserDisplayName = (username: string, fallbackDisplayName?: string): string => {
    const user = users.find(u => u.username === username)
    return user?.displayName || fallbackDisplayName || username
  }
  
  // Toggle travel notice item check (synced to Supabase)
  const toggleCheckItem = (itemKey: string) => {
    if (!currentUser) return
    
    const user = { 
      username: currentUser.username, 
      displayName: currentUser.displayName,
      avatarUrl: currentUser.avatarUrl 
    }
    
    setCheckedItems(prev => {
      const currentUsers = prev[itemKey] || []
      const userIndex = currentUsers.findIndex(u => u.username === currentUser.username)
      
      let newUsers: typeof currentUsers
      if (userIndex >= 0) {
        newUsers = currentUsers.filter(u => u.username !== currentUser.username)
      } else {
        newUsers = [...currentUsers, user]
      }
      
      const newCheckedItems = { ...prev, [itemKey]: newUsers }
      localStorage.setItem('travel_notice_checked', JSON.stringify(newCheckedItems))
      
      // Sync to Supabase
      saveSupabaseChecklistState({
        id: itemKey,
        checked_by: newUsers,
        updated_at: new Date().toISOString(),
      }).catch(() => {})
      
      return newCheckedItems
    })
  }
  
  // Check if current user has checked an item
  const isItemCheckedByUser = (itemKey: string) => {
    if (!currentUser) return false
    const users = checkedItems[itemKey] || []
    return users.some(u => u.username === currentUser.username)
  }
  
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
  
  // Load wishlist - always fetch fresh data from Supabase
  useEffect(() => {
    const loadWishlist = async () => {
      setIsLoading(true)
      
      try {
        const dbItems = await getSupabaseWishlistItems()
        if (dbItems.length > 0) {
          // Backfill: update items without added_by in Supabase
          const user = currentUser || getCurrentUser()
          let freshUsers: User[] = []
          if (!user) {
            try {
              freshUsers = await getUsersAsync()
            } catch { /* ignore */ }
          }
          const fallbackUser = user || (() => {
            const admin = freshUsers.find(u => u.role === 'admin')
            return admin || freshUsers[0] || null
          })()
          
          const itemsWithoutAddedBy = dbItems.filter(db => !db.added_by)
          if (fallbackUser && itemsWithoutAddedBy.length > 0) {
            const addedByData = {
              username: fallbackUser.username,
              display_name: (fallbackUser as any).displayName || (fallbackUser as any).display_name || fallbackUser.username,
              avatar_url: (fallbackUser as any).avatarUrl || (fallbackUser as any).avatar_url || undefined,
            }
            // Fire-and-forget: update all items missing added_by
            for (const db of itemsWithoutAddedBy) {
              updateSupabaseWishlistItem(db.id, { added_by: addedByData }).catch(() => {})
              db.added_by = addedByData
            }
          }
          
          const items = dbItems.map(fromSupabaseFormat)
          const grouped = groupByCategory(items)
          setWishlist(grouped)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(grouped))
          localStorage.setItem(CACHE_KEY, Date.now().toString())
        }
      } catch (err) {
        console.error('Error loading wishlist:', err)
        // Fallback to cache only if Supabase fails
        const saved = localStorage.getItem(STORAGE_KEY)
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
            console.error('Failed to parse cached wishlist:', e)
          }
        }
      }
      
      setIsLoading(false)
    }
    
    loadWishlist()
  }, [groupByCategory, currentUser])
  
  // Get filtered items based on active tab and search query
  const getFilteredItems = () => {
    let items: WishlistItem[] = []
    
    if (activeTab === 'all') {
      items = Object.values(wishlist).flat()
    } else if (activeTab === 'food') {
      items = wishlist[activeFoodSubTab] || []
    } else {
      items = wishlist[activeTab] || []
    }
    
    // Apply search filter if there's a query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      items = items.filter(item => 
        item.name.toLowerCase().includes(query) ||
        (item.note && item.note.toLowerCase().includes(query))
      )
    }
    
    // Sort by favorite (favorites first)
    items = [...items].sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1
      if (!a.isFavorite && b.isFavorite) return 1
      return 0
    })
    
    return items
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
      const user = currentUser || getCurrentUser()
      const newItem: Omit<WishlistItem, 'id' | 'addedAt'> = {
        category,
        name: newItemName.trim(),
        note: newItemNote.trim() || undefined,
        imageUrl: newItemImage || undefined,
        link: newItemUrl.trim() || undefined,
        isFavorite: false,
        addedBy: user ? {
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        } : undefined,
      }
      
      const { data: dbItem, error } = await saveSupabaseWishlistItem(toSupabaseFormat(newItem))
      
      if (error) {
        alert(`新增失敗：${error}`)
        setIsSubmitting(false)
        return
      }
      
      if (dbItem) {
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
    } catch (err: any) {
      console.error('Failed to add item:', err)
      alert(`新增失敗：${err.message || '未知錯誤'}`)
    }
    
    setIsSubmitting(false)
  }
  
  // Handle delete item (move to trash)
  const handleDeleteItem = async (item: WishlistItem) => {
    if (!confirm('確定要將此項目移至垃圾桶嗎？')) return
    
    try {
      // Move to trash in localStorage
      const savedTrash = localStorage.getItem('admin_trash_bin')
      const trashData = savedTrash ? JSON.parse(savedTrash) : { trips: [], users: [], destinations: [], wishlist: [] }
      const trashWishlistItem: WishlistItemDB = {
        id: Number(item.id),
        category: item.category,
        name: item.name,
        note: item.note || null,
        image_url: item.imageUrl || null,
        map_link: null,
        link: item.link || null,
        added_to_trip: item.addedToDay ? { day: item.addedToDay, time: item.addedTime || '' } : null,
        added_by: item.addedBy ? { username: item.addedBy.username, display_name: item.addedBy.displayName, avatar_url: item.addedBy.avatarUrl } : null,
        is_favorite: item.isFavorite || false,
        created_at: item.addedAt,
      }
      trashData.wishlist = [...(trashData.wishlist || []), { ...trashWishlistItem, deletedAt: new Date().toISOString() }]
      localStorage.setItem('admin_trash_bin', JSON.stringify(trashData))
      
      await deleteSupabaseWishlistItem(Number(item.id))
      setSelectedItemPopup(null)
      // Refresh page to get fresh data
      window.location.reload()
    } catch (err) {
      console.error('Failed to delete item:', err)
      alert('刪除失敗')
    }
  }
  
  // Handle edit item from popup - open the add form pre-filled
  const handleEditItemFromPopup = (item: WishlistItem) => {
    setEditingItem(item)
    setNewItemName(item.name)
    setNewItemNote(item.note || '')
    setNewItemImage(item.imageUrl || '')
    setNewItemUrl(item.link || '')
    setNewItemCategory(item.category)
    setSelectedItemPopup(null)
    setShowAddForm(true)
  }
  
  // Handle save edited item
  const handleSaveEdit = async () => {
    if (!editingItem || !newItemName.trim()) return
    
    setIsSubmitting(true)
    
    try {
      const { error } = await updateSupabaseWishlistItem(Number(editingItem.id), {
        name: newItemName.trim(),
        note: newItemNote.trim() || null,
        image_url: newItemImage || null,
        link: newItemUrl.trim() || null,
        category: newItemCategory,
      })
      
      if (error) {
        alert(`更新失敗：${error}`)
        setIsSubmitting(false)
        return
      }
      
      // Reset form and refresh
      setEditingItem(null)
      setNewItemName('')
      setNewItemNote('')
      setNewItemImage('')
      setNewItemUrl('')
      setNewItemCategory('cafe')
      setShowAddForm(false)
      window.location.reload()
    } catch (err: any) {
      console.error('Failed to update item:', err)
      alert(`更新失敗：${err.message || '未知錯誤'}`)
    }
    
    setIsSubmitting(false)
  }
  
  // Handle toggle favorite
  const handleToggleFavorite = async (item: WishlistItem) => {
    const willBeFavorite = !item.isFavorite
    
    try {
      const updated = await updateSupabaseWishlistItem(Number(item.id), {
        is_favorite: willBeFavorite
      })
      
      if (updated) {
        const newWishlist = { ...wishlist }
        const idx = newWishlist[item.category].findIndex(i => i.id === item.id)
        if (idx !== -1) {
          newWishlist[item.category][idx] = { ...newWishlist[item.category][idx], isFavorite: willBeFavorite }
          setWishlist(newWishlist)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newWishlist))
        }
        
        // Show animation in popup when favoriting
        if (willBeFavorite) {
          setShowPopupLikeAnim(true)
          setTimeout(() => setShowPopupLikeAnim(false), 2500)
        }
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err)
    }
  }
  
  const filteredItems = getFilteredItems()
  const foodCount = (wishlist.restaurant?.length || 0) + (wishlist.bakery?.length || 0)
  
  return (
    <main className={`bg-gray-50 pb-20 ${!isSakuraMode ? 'clean-mode' : ''}`}>
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
          
          {/* Search Field */}
          <div className="relative mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋名稱或地區..."
              className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
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
                className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow group cursor-pointer select-none"
                style={{ touchAction: 'manipulation' }}
                onClick={() => {
                  setSelectedItemPopup(item)
                  // Show "對此讚好" animation if item is favorited
                  if (item.isFavorite) {
                    setShowPopupLikeAnim(true)
                    setTimeout(() => setShowPopupLikeAnim(false), 2500)
                  } else {
                    setShowPopupLikeAnim(false)
                  }
                }}
                role="button"
                tabIndex={0}
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
                  
                  {/* Added to trip badge */}
                  {item.addedToDay && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-green-500 text-white text-xs font-medium rounded-full">
                      Day {item.addedToDay}
                    </div>
                  )}
                  
                  {/* Favorite indicator - bottom right */}
                  {item.isFavorite && (
                    <div className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full shadow-sm">
                      ❤️
                    </div>
                  )}
                </div>
                
                {/* Content */}
                <div className="p-3">
                  <h3 className="font-medium text-gray-800 truncate">{item.name}</h3>
                  {item.note && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.note}</p>
                  )}
                  
                  {/* Link - Google Maps or custom link (not for threads) */}
                  {!isThreadsCategory(item.category) && (
                    <div className="mt-2">
                      {item.link && !isGoogleMapsLink(item.link) ? (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                        >
                          🔗 點擊連結轉跳
                        </a>
                      ) : (
                        <a
                          href={item.link && isGoogleMapsLink(item.link) ? item.link : getGoogleMapsUrl(item.name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                        >
                          🗺️ 在 Google Maps 查看
                        </a>
                      )}
                    </div>
                  )}
                  
                  {/* Category + Added by */}
                  <div className="mt-3 pt-2 border-t border-gray-50 flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {CATEGORIES.find(c => c.id === item.category || (c.id === 'food' && ['restaurant', 'bakery'].includes(item.category)))?.name || item.category}
                    </span>
                    {item.addedBy && (() => {
                      const avatarUrl = getUserAvatar(item.addedBy.username, item.addedBy.avatarUrl)
                      const displayName = getUserDisplayName(item.addedBy.username, item.addedBy.displayName)
                      return (
                        <div className="flex items-center gap-1 ml-2">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-sakura-400 flex items-center justify-center text-white text-[8px] font-medium">
                              {displayName.charAt(0)}
                            </div>
                          )}
                          <span className="text-[10px] text-gray-400 truncate max-w-[60px]">
                            {displayName}
                          </span>
                        </div>
                      )
                    })()}
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
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => { setShowAddForm(false); setEditingItem(null) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-white rounded-2xl max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Fixed Header */}
              <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-100 flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-800">{editingItem ? '編輯心願' : '新增心願'}</h3>
                <button
                  onClick={() => { setShowAddForm(false); setEditingItem(null) }}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                >
                  ✕
                </button>
              </div>
              
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
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
              </div>
              
              {/* Fixed Footer */}
              <div className="p-4 md:p-6 border-t border-gray-100 flex-shrink-0 bg-white rounded-b-2xl">
                <button
                  onClick={editingItem ? handleSaveEdit : handleAddItem}
                  disabled={!newItemName.trim() || isSubmitting}
                  className="w-full py-3 bg-sakura-500 hover:bg-sakura-600 disabled:bg-gray-300 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      處理中...
                    </>
                  ) : (
                    editingItem ? '更新' : '新增'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Travel Notice Popup - Checklist Style */}
      <AnimatePresence>
        {showTravelNotice && (() => {
          // Calculate counts for travel notice
          const essentialsTotal = settings?.travelEssentials?.length || 0
          const preparationsTotal = settings?.travelPreparations?.length || 0
          const totalItems = essentialsTotal + preparationsTotal
          
          const essentialsCheckedCount = settings?.travelEssentials?.filter(item => {
            const itemKey = `essential_${item.icon}_${item.text}`
            return (checkedItems[itemKey] || []).length > 0
          }).length || 0
          
          const preparationsCheckedCount = settings?.travelPreparations?.filter(item => {
            const itemKey = `prep_${item.icon}_${item.text}`
            return (checkedItems[itemKey] || []).length > 0
          }).length || 0
          
          const totalChecked = essentialsCheckedCount + preparationsCheckedCount
          const allCompleted = totalItems > 0 && totalChecked === totalItems
          
          return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/50 z-[60]"
            onClick={() => setShowTravelNotice(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 h-[75vh] bg-white rounded-t-3xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Popup Header - Pink gradient style */}
              <div className="bg-gradient-to-r from-sakura-400 to-sakura-500 px-4 py-3 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🌸</span>
                  <h3 className="text-white font-medium">旅遊須知</h3>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full text-white">
                    {totalChecked}/{totalItems}
                  </span>
                </div>
                <button
                  onClick={() => setShowTravelNotice(false)}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              {/* Travel Notice Content - Checklist Style */}
              <div className="overflow-y-auto flex-1 p-4">
                {/* All Completed Celebration */}
                {allCompleted && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200"
                  >
                    <div className="text-center">
                      <span className="text-4xl block mb-2">🎉</span>
                      <p className="text-green-700 font-medium">準備完成！</p>
                      <p className="text-green-600 text-sm mt-1">旅途愉快！Have a nice trip!</p>
                    </div>
                  </motion.div>
                )}
                
                {/* Travel Essentials */}
                {settings?.travelEssentials && settings.travelEssentials.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-700 px-2 py-2 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span>🎒</span>
                        <span>必備物品</span>
                      </span>
                      <span className="text-xs text-sakura-500 bg-sakura-50 px-2 py-0.5 rounded-full">
                        {essentialsCheckedCount}/{essentialsTotal}
                      </span>
                    </h4>
                    <div className="space-y-1">
                      {settings.travelEssentials.map((item, idx) => {
                        const itemKey = `essential_${item.icon}_${item.text}`
                        const isChecked = isItemCheckedByUser(itemKey)
                        const itemCheckedUsers = checkedItems[itemKey] || []
                        const anyoneChecked = itemCheckedUsers.length > 0
                        return (
                          <div 
                            key={idx} 
                            className={`flex items-center justify-between gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                              anyoneChecked 
                                ? 'bg-green-50 text-green-600' 
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                            onClick={() => toggleCheckItem(itemKey)}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="flex-shrink-0">{item.icon}</span>
                              <span className="truncate text-sm">{item.text}</span>
                            </span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {/* Checked users avatars */}
                              {itemCheckedUsers.length > 0 && (
                                <div className="flex -space-x-1 mr-0.5">
                                  {itemCheckedUsers.slice(0, 3).map((user, i) => {
                                    const userObj = users.find(u => u.username === user.username)
                                    const avatarUrl = userObj?.avatarUrl || user.avatarUrl
                                    return avatarUrl ? (
                                      <img 
                                        key={i}
                                        src={avatarUrl} 
                                        alt={user.displayName}
                                        className="w-5 h-5 rounded-full border border-white object-cover shadow-sm"
                                        style={{ zIndex: itemCheckedUsers.length - i }}
                                        title={user.displayName}
                                      />
                                    ) : (
                                      <div 
                                        key={i}
                                        className="w-5 h-5 rounded-full bg-green-200 border border-white shadow-sm flex items-center justify-center text-[8px] text-green-700 font-medium"
                                        style={{ zIndex: itemCheckedUsers.length - i }}
                                        title={user.displayName}
                                      >
                                        {user.displayName?.charAt(0).toUpperCase() || user.username.charAt(0).toUpperCase()}
                                      </div>
                                    )
                                  })}
                                  {itemCheckedUsers.length > 3 && (
                                    <div className="w-5 h-5 rounded-full bg-gray-200 border border-white shadow-sm flex items-center justify-center text-[8px] text-gray-600 font-medium">
                                      +{itemCheckedUsers.length - 3}
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* Checkbox */}
                              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all text-xs ${
                                isChecked 
                                  ? 'bg-green-500 border-green-500 text-white' 
                                  : anyoneChecked
                                    ? 'bg-green-200 border-green-300 text-green-600'
                                    : 'border-gray-300'
                              }`}>
                                {anyoneChecked && '✓'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                
                {/* Travel Preparations */}
                {settings?.travelPreparations && settings.travelPreparations.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-700 px-2 py-2 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span>📝</span>
                        <span>出發前準備</span>
                      </span>
                      <span className="text-xs text-sakura-500 bg-sakura-50 px-2 py-0.5 rounded-full">
                        {preparationsCheckedCount}/{preparationsTotal}
                      </span>
                    </h4>
                    <div className="space-y-1">
                      {settings.travelPreparations.map((item, idx) => {
                        const itemKey = `prep_${item.icon}_${item.text}`
                        const isChecked = isItemCheckedByUser(itemKey)
                        const itemCheckedUsers = checkedItems[itemKey] || []
                        const anyoneChecked = itemCheckedUsers.length > 0
                        return (
                          <div 
                            key={idx} 
                            className={`flex items-center justify-between gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                              anyoneChecked 
                                ? 'bg-green-50 text-green-600' 
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                            onClick={() => toggleCheckItem(itemKey)}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="flex-shrink-0">{item.icon}</span>
                              <span className="truncate text-sm">{item.text}</span>
                            </span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {/* Checked users avatars */}
                              {itemCheckedUsers.length > 0 && (
                                <div className="flex -space-x-1 mr-0.5">
                                  {itemCheckedUsers.slice(0, 3).map((user, i) => {
                                    const userObj = users.find(u => u.username === user.username)
                                    const avatarUrl = userObj?.avatarUrl || user.avatarUrl
                                    return avatarUrl ? (
                                      <img 
                                        key={i}
                                        src={avatarUrl} 
                                        alt={user.displayName}
                                        className="w-5 h-5 rounded-full border border-white object-cover shadow-sm"
                                        style={{ zIndex: itemCheckedUsers.length - i }}
                                        title={user.displayName}
                                      />
                                    ) : (
                                      <div 
                                        key={i}
                                        className="w-5 h-5 rounded-full bg-green-200 border border-white shadow-sm flex items-center justify-center text-[8px] text-green-700 font-medium"
                                        style={{ zIndex: itemCheckedUsers.length - i }}
                                        title={user.displayName}
                                      >
                                        {user.displayName?.charAt(0).toUpperCase() || user.username.charAt(0).toUpperCase()}
                                      </div>
                                    )
                                  })}
                                  {itemCheckedUsers.length > 3 && (
                                    <div className="w-5 h-5 rounded-full bg-gray-200 border border-white shadow-sm flex items-center justify-center text-[8px] text-gray-600 font-medium">
                                      +{itemCheckedUsers.length - 3}
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* Checkbox */}
                              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all text-xs ${
                                isChecked 
                                  ? 'bg-green-500 border-green-500 text-white' 
                                  : anyoneChecked
                                    ? 'bg-green-200 border-green-300 text-green-600'
                                    : 'border-gray-300'
                              }`}>
                                {anyoneChecked && '✓'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                
                {/* Empty State */}
                {(!settings?.travelEssentials?.length && !settings?.travelPreparations?.length) && (
                  <div className="text-center py-12">
                    <span className="text-5xl mb-4 block">📖</span>
                    <p className="text-gray-500">暫無旅遊須知</p>
                  </div>
                )}
              </div>
              
              {/* Action Button */}
              <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t border-gray-100 bg-white">
                <button
                  onClick={() => setShowTravelNotice(false)}
                  className="w-full py-3 bg-sakura-500 hover:bg-sakura-600 text-white rounded-xl font-medium transition-colors"
                >
                  知道了！
                </button>
              </div>
            </motion.div>
          </motion.div>
        )})()}
      </AnimatePresence>
      
      {/* Item Detail Popup */}
      <AnimatePresence>
        {selectedItemPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overscroll-none"
            style={{ touchAction: 'none' }}
            onClick={() => setSelectedItemPopup(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-white rounded-2xl overflow-hidden max-h-[85vh] overflow-y-auto overscroll-contain"
              style={{ WebkitOverflowScrolling: 'touch' }}
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
                  {/* Bottom right: Like bubble + heart button */}
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    {/* Instagram-like "對此讚好" animation - left of heart */}
                    <AnimatePresence>
                      {showPopupLikeAnim && (() => {
                        const user = currentUser || getCurrentUser()
                        const displayName = user ? getUserDisplayName(user.username, user.displayName) : '你'
                        return (
                          <motion.div
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.35 }}
                            className="whitespace-nowrap pointer-events-none"
                          >
                            <div className="bg-black/75 text-white text-xs px-3 py-2 rounded-full backdrop-blur-sm shadow-lg">
                              <span className="font-medium">{displayName}</span> 對此讚好 ❤️
                            </div>
                          </motion.div>
                        )
                      })()}
                    </AnimatePresence>
                    {/* Favorite button */}
                    <button
                      onClick={() => {
                        handleToggleFavorite(selectedItemPopup)
                        setSelectedItemPopup({ ...selectedItemPopup, isFavorite: !selectedItemPopup.isFavorite })
                      }}
                      className="w-10 h-10 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:scale-110 transition-transform"
                    >
                      <span className="text-lg">{selectedItemPopup.isFavorite ? '❤️' : '🤍'}</span>
                    </button>
                  </div>
                </div>
              )}
              
              {/* Content */}
              <div className="p-6">
                {!selectedItemPopup.imageUrl && (
                  <div className="flex items-center justify-end gap-2 mb-2">
                    {/* Instagram-like "對此讚好" animation (no-image) - left of heart */}
                    <AnimatePresence>
                      {showPopupLikeAnim ? (() => {
                        const user = currentUser || getCurrentUser()
                        const displayName = user ? getUserDisplayName(user.username, user.displayName) : '你'
                        return (
                          <motion.div
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.35 }}
                            className="whitespace-nowrap pointer-events-none"
                          >
                            <div className="bg-black/75 text-white text-xs px-3 py-1.5 rounded-full">
                              <span className="font-medium">{displayName}</span> 對此讚好 ❤️
                            </div>
                          </motion.div>
                        )
                      })() : null}
                    </AnimatePresence>
                    <button
                      onClick={() => {
                        handleToggleFavorite(selectedItemPopup)
                        setSelectedItemPopup({ ...selectedItemPopup, isFavorite: !selectedItemPopup.isFavorite })
                      }}
                      className="w-8 h-8 flex items-center justify-center hover:scale-110 transition-transform"
                    >
                      {selectedItemPopup.isFavorite ? '❤️' : '🤍'}
                    </button>
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
                </div>
                
                {/* Title */}
                <h2 className="text-xl font-semibold text-gray-800 mb-2">{selectedItemPopup.name}</h2>
                
                {/* Note */}
                {selectedItemPopup.note && (
                  <p className="text-gray-600 mb-4">{selectedItemPopup.note}</p>
                )}
                
                {/* Link - Google Maps or custom link (not for threads) */}
                {!isThreadsCategory(selectedItemPopup.category) && (
                  <div className="mb-4">
                    {selectedItemPopup.link && !isGoogleMapsLink(selectedItemPopup.link) ? (
                      <a
                        href={selectedItemPopup.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-500 hover:text-blue-600"
                      >
                        <span>🔗</span>
                        <span>點擊連結轉跳</span>
                      </a>
                    ) : (
                      <a
                        href={selectedItemPopup.link && isGoogleMapsLink(selectedItemPopup.link) ? selectedItemPopup.link : getGoogleMapsUrl(selectedItemPopup.name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-500 hover:text-blue-600"
                      >
                        <span>🗺️</span>
                        <span>在 Google Maps 查看</span>
                      </a>
                    )}
                  </div>
                )}
                
                {/* Threads link */}
                {isThreadsCategory(selectedItemPopup.category) && selectedItemPopup.link && (
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
                
                {/* Added by user info */}
                {selectedItemPopup.addedBy && (
                  <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-xl">
                    {(() => {
                      const avatarUrl = getUserAvatar(selectedItemPopup.addedBy.username, selectedItemPopup.addedBy.avatarUrl)
                      const displayName = getUserDisplayName(selectedItemPopup.addedBy.username, selectedItemPopup.addedBy.displayName)
                      return (
                        <>
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-sakura-400 flex items-center justify-center text-white text-xs font-medium">
                              {displayName.charAt(0)}
                            </div>
                          )}
                          <span className="text-sm text-gray-500">
                            由 <span className="font-medium text-gray-700">{displayName}</span> 新增
                          </span>
                        </>
                      )
                    })()}
                  </div>
                )}
                
                {/* Actions: Favorite + Edit + Delete */}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => handleEditItemFromPopup(selectedItemPopup)}
                    className="flex-1 py-3 rounded-xl font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                  >
                    ✏️ 編輯
                  </button>
                  <button
                    onClick={() => handleDeleteItem(selectedItemPopup)}
                    className="flex-1 py-3 rounded-xl font-medium bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                  >
                    🗑️ 刪除
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Chiikawa Pet - only show on mobile when sakura mode is on */}
      <div className="md:hidden">
        <ChiikawaPet enabled={isSakuraMode} />
      </div>
      
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
            className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 ${
              isSakuraMode ? 'text-pink-500' : 'text-gray-400'
            }`}
          >
            <motion.span 
              className="text-xl mb-0.5"
              animate={{ 
                scale: isSakuraMode ? [1, 1.3, 1] : 1,
                rotate: isSakuraMode ? [0, 15, -15, 0] : 0
              }}
              transition={{ duration: 0.4 }}
            >
              {isSakuraMode ? '🌸' : '🔘'}
            </motion.span>
            <motion.span 
              className="text-[10px] font-medium"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              key={isSakuraMode ? 'sakura' : 'normal'}
            >
              {isSakuraMode ? '摸摸Chiikawa' : '點擊'}
            </motion.span>
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
