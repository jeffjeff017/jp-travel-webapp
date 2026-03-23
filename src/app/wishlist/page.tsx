'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  saveSupabaseWishlistItem, 
  updateSupabaseWishlistItem, 
  deleteSupabaseWishlistItem,
  saveSupabaseChecklistState,
  createTrip,
  syncTripsFromWishlistItem,
  removeWishlistItemFromItinerary,
  type WishlistItemDB 
} from '@/lib/supabase'
import { geocodePlaceName } from '@/lib/geocode'
import { useQueryClient } from '@tanstack/react-query'
import { useWishlistItems, useChecklistStates, queryKeys } from '@/hooks/useQueries'
import { getSettings, getSettingsAsync, type SiteSettings } from '@/lib/settings'
import { canEdit, getCurrentUser, isAdmin as checkIsAdmin, isAuthenticated, logout, getUsers, getUsersAsync, getAuthToken, getLoggedInUsername, type User } from '@/lib/auth'
import SakuraCanvas from '@/components/SakuraCanvas'
import ChiikawaPet from '@/components/ChiikawaPet'
import MultiMediaUpload from '@/components/MultiMediaUpload'
import ImageSlider from '@/components/ImageSlider'
import { safeSetItem } from '@/lib/safeStorage'

// Tokyo district areas
// Grouped district structure (parent → children)
const TOKYO_DISTRICTS = [
  {
    id: 'east', label: '東東京', en: 'East Tokyo', icon: '🏮',
    areas: [
      { id: 'asakusa',          zh: '浅草',     en: 'Asakusa' },
      { id: 'ueno',             zh: '上野',     en: 'Ueno' },
      { id: 'akihabara',        zh: '秋葉原',   en: 'Akihabara' },
      { id: 'yanaka',           zh: '谷根千',   en: 'Yanaka' },
      { id: 'kuramae',          zh: '蔵前',     en: 'Kuramae' },
      { id: 'kiyosumishirakawa',zh: '清澄白河', en: 'Kiyosumi-Shirakawa' },
      { id: 'ryogoku',          zh: '両国',     en: 'Ryogoku' },
      { id: 'kinshicho',        zh: '錦糸町',   en: 'Kinshicho' },
      { id: 'kitasenju',        zh: '北千住',   en: 'Kita-Senju' },
    ],
  },
  {
    id: 'shibuya_area', label: '渋谷エリア', en: 'Shibuya Area', icon: '🛍️',
    areas: [
      { id: 'shibuya',          zh: '渋谷',     en: 'Shibuya' },
      { id: 'harajuku',         zh: '原宿',     en: 'Harajuku' },
      { id: 'omotesando',       zh: '表参道',   en: 'Omotesando' },
      { id: 'aoyama',           zh: '青山',     en: 'Aoyama' },
      { id: 'ebisu',            zh: '恵比寿',   en: 'Ebisu' },
      { id: 'daikanyama',       zh: '代官山',   en: 'Daikanyama' },
      { id: 'nakameguro',       zh: '中目黒',   en: 'Nakameguro' },
    ],
  },
  {
    id: 'shinjuku_area', label: '新宿エリア', en: 'Shinjuku Area', icon: '🌃',
    areas: [
      { id: 'shinjuku',         zh: '新宿',     en: 'Shinjuku' },
      { id: 'shimokitazawa',    zh: '下北沢',   en: 'Shimokitazawa' },
      { id: 'sangenjaya',       zh: '三軒茶屋', en: 'Sangenjaya' },
      { id: 'jiyugaoka',        zh: '自由が丘', en: 'Jiyugaoka' },
      { id: 'futakotamagawa',   zh: '二子玉川', en: 'Futakotamagawa' },
    ],
  },
  {
    id: 'central', label: '都心', en: 'Central Tokyo', icon: '🏙️',
    areas: [
      { id: 'ginza',            zh: '銀座',     en: 'Ginza' },
      { id: 'tsukiji',          zh: '築地',     en: 'Tsukiji' },
      { id: 'shimbashi',        zh: '新橋',     en: 'Shimbashi' },
      { id: 'nihonbashi',       zh: '日本橋',   en: 'Nihonbashi' },
      { id: 'yurakucho',        zh: '有楽町',   en: 'Yurakucho' },
      { id: 'marunouchi',       zh: '丸の内',   en: 'Marunouchi' },
      { id: 'otemachi',         zh: '大手町',   en: 'Otemachi' },
    ],
  },
  {
    id: 'minato', label: '港区', en: 'Minato', icon: '🌆',
    areas: [
      { id: 'roppongi',         zh: '六本木',   en: 'Roppongi' },
      { id: 'akasaka',          zh: '赤坂',     en: 'Akasaka' },
      { id: 'azabujuban',       zh: '麻布十番', en: 'Azabu-Juban' },
      { id: 'hiro',             zh: '広尾',     en: 'Hiro' },
    ],
  },
  {
    id: 'north', label: '北エリア', en: 'North Area', icon: '🎓',
    areas: [
      { id: 'ikebukuro',        zh: '池袋',     en: 'Ikebukuro' },
      { id: 'kagurazaka',       zh: '神楽坂',   en: 'Kagurazaka' },
      { id: 'iidabashi',        zh: '飯田橋',   en: 'Iidabashi' },
      { id: 'jimbocho',         zh: '神保町',   en: 'Jimbocho' },
      { id: 'ochanomizu',       zh: '御茶ノ水', en: 'Ochanomizu' },
    ],
  },
  {
    id: 'west', label: '西エリア', en: 'West Area', icon: '🌿',
    areas: [
      { id: 'kichijoji',        zh: '吉祥寺',   en: 'Kichijoji' },
      { id: 'koenji',           zh: '高円寺',   en: 'Koenji' },
      { id: 'ogikubo',          zh: '荻窪',     en: 'Ogikubo' },
    ],
  },
  {
    id: 'bay', label: '湾岸', en: 'Bay Area', icon: '🌊',
    areas: [
      { id: 'toyosu',           zh: '豊洲',     en: 'Toyosu' },
      { id: 'odaiba',           zh: '台場',     en: 'Odaiba' },
      { id: 'shinagawa',        zh: '品川',     en: 'Shinagawa' },
    ],
  },
  {
    id: 'suburbs', label: '郊外', en: 'Suburbs', icon: '🌸',
    areas: [
      { id: 'machida',          zh: '町田',     en: 'Machida' },
      { id: 'tachikawa',        zh: '立川',     en: 'Tachikawa' },
    ],
  },
]

// Flat list derived from grouped structure (backwards compatible IDs)
const TOKYO_AREAS = TOKYO_DISTRICTS.flatMap(d => d.areas)

// Main categories
const CATEGORIES = [
  { id: 'all', name: '全部', icon: '✨', color: 'from-gray-400 to-gray-600' },
  { id: 'cafe', name: 'Cafe', icon: '☕', color: 'from-amber-400 to-orange-500' },
  { id: 'restaurant', name: '餐廳', icon: '🍽️', color: 'from-red-400 to-pink-500' },
  { id: 'bakery', name: '麵包店', icon: '🥐', color: 'from-yellow-400 to-amber-500' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: 'from-purple-400 to-indigo-500' },
  { id: 'park', name: 'Park', icon: '🌳', color: 'from-green-400 to-emerald-500' },
  { id: 'threads', name: 'Threads', icon: '🔗', color: 'from-gray-600 to-gray-800' },
]

type WishlistItem = {
  id: number | string
  name: string
  note?: string
  imageUrl?: string
  link?: string
  category: string
  area?: string
  addedAt: string
  addedToDay?: number
  addedTime?: string
  /** @deprecated Use favoritedBy. Kept for backward compat during migration. */
  isFavorite?: boolean
  /** Per-user likes: usernames who liked. Each user's like is independent. */
  favoritedBy?: string[]
  addedBy?: { username: string; displayName: string; avatarUrl?: string }
}

type Wishlist = {
  [key: string]: WishlistItem[]
}

const STORAGE_KEY = 'japan_travel_wishlist'
const CACHE_KEY = 'japan_travel_wishlist_cache_time'
const CACHE_DURATION = 5 * 60 * 1000


// Strip base64 image data from wishlist before caching to save localStorage space
function stripImagesForCache(wishlist: Wishlist): Wishlist {
  const stripImg = (url: string | undefined): string | undefined => {
    if (!url) return undefined
    if (url.startsWith('data:')) return undefined
    return url
  }
  const stripped: Wishlist = {}
  for (const [key, items] of Object.entries(wishlist)) {
    stripped[key] = items.map(item => {
      const imgs = parseWishlistImages(item.imageUrl)
      const kept = imgs.filter(u => !u.startsWith('data:'))
      return {
        ...item,
        imageUrl: kept.length > 0 ? (kept.length === 1 ? kept[0] : JSON.stringify(kept)) : undefined,
      }
    })
  }
  return stripped
}

// Helper function for Google Maps URL
const getGoogleMapsUrl = (placeName: string) => {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName + ' Japan')}`
}

// Parse images from image_url (handles JSON array or legacy single string)
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

// Check if a link is a Google Maps URL
const isGoogleMapsLink = (link?: string) => {
  if (!link) return false
  return link.includes('google.com/maps') || link.includes('maps.google')
}

// Check if an item is a threads item (should not show Google Maps link)
const isThreadsCategory = (category: string) => category === 'threads'

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
    area: db.map_link || undefined,
    addedAt: db.created_at,
    addedToDay: db.added_to_trip?.day,
    addedTime: db.added_to_trip?.time,
    isFavorite: favoritedBy.length > 0 || db.is_favorite,
    favoritedBy,
    addedBy: db.added_by ? {
      username: db.added_by.username,
      displayName: db.added_by.display_name,
      avatarUrl: db.added_by.avatar_url,
    } : undefined,
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
    map_link: item.area || null,
    link: item.link || null,
    added_to_trip: item.addedToDay ? { day: item.addedToDay, time: item.addedTime || '12:00' } : null,
    added_by: item.addedBy ? {
      username: item.addedBy.username,
      display_name: item.addedBy.displayName,
      avatar_url: item.addedBy.avatarUrl,
    } : null,
    is_favorite: favoritedBy.length > 0,
    favorited_by: favoritedBy,
  }
}

// SVG heart icons — avoid emoji layout shifts on iOS
function HeartFilled({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  )
}

function HeartOutline({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

export default function WishlistPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: wishlistDbItems, isLoading: isWishlistLoading } = useWishlistItems()
  const { data: checklistData } = useChecklistStates()
  const [activeTab, setActiveTab] = useState('all')
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
  
  
  // Add/Edit form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [newItemNote, setNewItemNote] = useState('')
  const [newItemImages, setNewItemImages] = useState<string[]>([])
  const [newItemUrl, setNewItemUrl] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('cafe')
  const [newItemArea, setNewItemArea] = useState('')
  const [areaDropdownOpen, setAreaDropdownOpen] = useState(false)
  const [areaSearch, setAreaSearch] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const areaDropdownRef = useRef<HTMLDivElement>(null)
  const [selectedItemPopup, setSelectedItemPopup] = useState<WishlistItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeAreaFilter, setActiveAreaFilter] = useState('')
  const [showAddToTripForm, setShowAddToTripForm] = useState(false)
  const [addToTripDay, setAddToTripDay] = useState(1)
  const [addToTripTimeStart, setAddToTripTimeStart] = useState('')
  const [addToTripTimeEnd, setAddToTripTimeEnd] = useState('')
  const [addToTripSubmitting, setAddToTripSubmitting] = useState(false)
  const [addToTripSuccess, setAddToTripSuccess] = useState(false)
  const [removeFromItinerarySubmitting, setRemoveFromItinerarySubmitting] = useState(false)
  const [popupMoreMenuOpen, setPopupMoreMenuOpen] = useState(false)
  const [displayCount, setDisplayCount] = useState(12)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const isLoadingMoreRef = useRef(false)
  /** Admin only: multi-select duplicates for batch delete */
  const [bulkSelectMode, setBulkSelectMode] = useState(false)
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<number>>(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(12)
  }, [activeTab, activeAreaFilter, searchQuery])

  // Exit bulk mode clears selection
  useEffect(() => {
    if (!bulkSelectMode) setBulkSelectedIds(new Set())
  }, [bulkSelectMode])

  // Close area dropdown on outside click
  useEffect(() => {
    if (!areaDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (areaDropdownRef.current && !areaDropdownRef.current.contains(e.target as Node)) {
        setAreaDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [areaDropdownOpen])

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
          let fallbackUser: User | undefined
          const isAdm = checkIsAdmin()
          
          if (isAdm) {
            fallbackUser = freshUsers.find(u => u.role === 'admin')
          } else {
            // Parse username from auth token: japan_travel_user_{username}_2024
            const token = getAuthToken()
            if (token) {
              const match = token.match(/^japan_travel_user_(.+)_2024$/)
              if (match) {
                const tokenUsername = match[1]
                fallbackUser = freshUsers.find(u => u.username === tokenUsername)
              }
            }
            if (!fallbackUser) {
              fallbackUser = freshUsers.find(u => u.role === 'user') || freshUsers[0]
            }
          }
          
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

  // Sync checklist states from TanStack Query
  useEffect(() => {
    if (checklistData && checklistData.length > 0) {
      const checkedMap: Record<string, { username: string; displayName: string; avatarUrl?: string }[]> = {}
      checklistData.forEach(s => {
        const checkedBy = Array.isArray(s.checked_by) ? s.checked_by : []
        checkedMap[s.id] = checkedBy.map(u => ({
          username: u.username,
          displayName: u.displayName || u.username,
          avatarUrl: u.avatarUrl,
        }))
      })
      setCheckedItems(checkedMap)
      safeSetItem('travel_notice_checked', JSON.stringify(checkedMap))
    } else if (!checklistData || checklistData.length === 0) {
      const saved = localStorage.getItem('travel_notice_checked')
      if (saved) {
        try { setCheckedItems(JSON.parse(saved)) } catch {}
      }
    }
  }, [checklistData])
  
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
      safeSetItem('travel_notice_checked', JSON.stringify(newCheckedItems))
      
      // Sync to Supabase and invalidate query cache on success
      saveSupabaseChecklistState({
        id: itemKey,
        checked_by: newUsers,
        updated_at: new Date().toISOString(),
      }).then(result => {
        if (result.success) {
          queryClient.invalidateQueries({ queryKey: queryKeys.checklistStates })
        }
      }).catch(err => {
        console.error('Failed to save checklist state:', err)
      })
      
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
  
  // Sync wishlist data from TanStack Query
  useEffect(() => {
    if (wishlistDbItems && wishlistDbItems.length > 0) {
      // Backfill: update items without added_by in Supabase
      const user = currentUser || getCurrentUser()
      
      const itemsWithoutAddedBy = wishlistDbItems.filter(db => !db.added_by)
      if (user && itemsWithoutAddedBy.length > 0) {
        const addedByData = {
          username: user.username,
          display_name: (user as any).displayName || (user as any).display_name || user.username,
          avatar_url: (user as any).avatarUrl || (user as any).avatar_url || undefined,
        }
        // Fire-and-forget: update all items missing added_by
        for (const db of itemsWithoutAddedBy) {
          updateSupabaseWishlistItem(db.id, { added_by: addedByData }).catch(() => {})
        }
      }
      
      const items = wishlistDbItems.map(fromSupabaseFormat)
      const grouped = groupByCategory(items)
      setWishlist(grouped)
      safeSetItem(STORAGE_KEY, JSON.stringify(stripImagesForCache(grouped)))
      safeSetItem(CACHE_KEY, Date.now().toString())
    }
    
    if (!isWishlistLoading) {
      setIsLoading(false)
    }
  }, [wishlistDbItems, isWishlistLoading, groupByCategory, currentUser])
  
  // Get filtered items based on active tab and search query
  const getFilteredItems = () => {
    let items: WishlistItem[] = []
    
    if (activeTab === 'all') {
      items = Object.values(wishlist).flat()
    } else {
      items = wishlist[activeTab] || []
    }
    
    // Apply area filter (exact area match)
    if (activeAreaFilter) {
      items = items.filter(item => item.area === activeAreaFilter)
    }

    // Apply search filter if there's a query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      items = items.filter(item => {
        if (item.name.toLowerCase().includes(query)) return true
        if (item.note && item.note.toLowerCase().includes(query)) return true
        if (item.area) {
          const areaData = TOKYO_AREAS.find(a => a.id === item.area)
          if (areaData) {
            if (areaData.zh.includes(query)) return true
            if (areaData.en.toLowerCase().includes(query)) return true
          }
        }
        return false
      })
    }
    
    // Sort by current user's favorites first
    const currentUsername = (currentUser || getCurrentUser())?.username
    items = [...items].sort((a, b) => {
      const aLiked = (a.favoritedBy || []).includes(currentUsername || '')
      const bLiked = (b.favoritedBy || []).includes(currentUsername || '')
      if (aLiked && !bLiked) return -1
      if (!aLiked && bLiked) return 1
      return 0
    })
    
    return items
  }
  
  // Individual areas that have at least one item under the current tab (ignoring area/search filters)
  // Read directly from wishlistDbItems (raw TanStack Query data) to avoid stale wishlist state
  const availableAreas = useMemo(() => {
    if (!wishlistDbItems || wishlistDbItems.length === 0) return []
    const relevantDbItems = activeTab === 'all'
      ? wishlistDbItems
      : wishlistDbItems.filter(db => db.category === activeTab)
    const usedAreaIds = new Set(
      relevantDbItems.map(db => db.map_link).filter(Boolean) as string[]
    )
    return TOKYO_AREAS.filter(a => usedAreaIds.has(a.id))
  }, [wishlistDbItems, activeTab])

  // Reset area filter when the selected area has no items in the new tab
  useEffect(() => {
    if (activeAreaFilter) {
      const stillValid = availableAreas.some(a => a.id === activeAreaFilter)
      if (!stillValid) setActiveAreaFilter('')
    }
  }, [availableAreas, activeAreaFilter])

  // Sync selectedItemPopup when wishlist changes (e.g. after toggleFavorite from popup)
  useEffect(() => {
    if (!selectedItemPopup) return
    const liveItem = Object.values(wishlist).flat().find(i => String(i.id) === String(selectedItemPopup.id))
    if (!liveItem) return
    if (
      liveItem.favoritedBy !== selectedItemPopup.favoritedBy ||
      liveItem.isFavorite !== selectedItemPopup.isFavorite
    ) {
      setSelectedItemPopup(prev => prev ? { ...prev, favoritedBy: liveItem.favoritedBy, isFavorite: liveItem.isFavorite } : null)
    }
  }, [wishlist, selectedItemPopup?.id])

  // Get current category for adding
  const getCurrentCategory = () => {
    if (activeTab === 'all') return 'cafe'
    return activeTab
  }
  
  
  // Handle add item
  const handleAddItem = async () => {
    if (!newItemName.trim()) return
    
    setIsSubmitting(true)
    
    try {
      const category = newItemCategory
      const user = currentUser || getCurrentUser()
      const imageUrlValue = newItemImages.length > 0 ? JSON.stringify(newItemImages) : undefined
      const newItem: Omit<WishlistItem, 'id' | 'addedAt'> = {
        category,
        name: newItemName.trim(),
        note: newItemNote.trim() || undefined,
        imageUrl: imageUrlValue,
        link: newItemUrl.trim() || undefined,
        area: newItemArea || undefined,
        favoritedBy: [], // Only show bubble when user presses like — not when adding
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
        // Invalidate TanStack Query to refetch fresh data
        await queryClient.invalidateQueries({ queryKey: queryKeys.wishlistItems })
      }
      
      // Reset form
      setNewItemName('')
      setNewItemNote('')
      setNewItemImages([])
      setNewItemUrl('')
      setNewItemCategory('cafe')
      setNewItemArea('')
      setAreaSearch('')
      setShowAddForm(false)
    } catch (err: any) {
      console.error('Failed to add item:', err)
      alert(`新增失敗：${err.message || '未知錯誤'}`)
    }
    
    setIsSubmitting(false)
  }
  
  /** Move one wishlist item to admin trash + delete from Supabase (no confirm) */
  const deleteWishlistItemCore = async (item: WishlistItem) => {
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
    safeSetItem('admin_trash_bin', JSON.stringify(trashData))
    await deleteSupabaseWishlistItem(Number(item.id))
  }

  const findWishlistItemByNumericId = (id: number): WishlistItem | undefined => {
    for (const items of Object.values(wishlist)) {
      const found = items.find(i => Number(i.id) === id)
      if (found) return found
    }
    return undefined
  }

  // Handle delete item (move to trash)
  const handleDeleteItem = async (item: WishlistItem) => {
    if (!confirm('確定要將此項目移至垃圾桶嗎？')) return

    try {
      await deleteWishlistItemCore(item)
      setSelectedItemPopup(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.wishlistItems })
    } catch (err) {
      console.error('Failed to delete item:', err)
      alert('刪除失敗')
    }
  }

  /** Admin: delete all selected items (current filter list) */
  const handleBulkDeleteSelected = async () => {
    if (!isAdmin || bulkSelectedIds.size === 0) return
    const count = bulkSelectedIds.size
    if (!confirm(`確定將已選的 ${count} 個心願移至垃圾桶並從資料庫刪除？此操作無法復原（請至後台垃圾桶確認）。`)) return

    setBulkDeleting(true)
    try {
      const ids = Array.from(bulkSelectedIds)
      let failed = 0
      for (const id of ids) {
        const item = findWishlistItemByNumericId(id)
        if (!item) {
          failed++
          continue
        }
        try {
          await deleteWishlistItemCore(item)
        } catch (e) {
          console.error('Bulk delete item failed:', id, e)
          failed++
        }
      }
      setBulkSelectedIds(new Set())
      setBulkSelectMode(false)
      setSelectedItemPopup(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.wishlistItems })
      if (failed > 0) {
        alert(`已處理刪除；其中有 ${failed} 筆失敗（可能已不存在或 ID 無效）。`)
      }
    } catch (err) {
      console.error('Bulk delete failed:', err)
      alert('批次刪除時發生錯誤')
    } finally {
      setBulkDeleting(false)
    }
  }

  const toggleBulkSelectId = (id: number) => {
    setBulkSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllFilteredIds = () => {
    const next = new Set<number>()
    for (const item of getFilteredItems()) {
      const n = Number(item.id)
      if (!Number.isNaN(n)) next.add(n)
    }
    setBulkSelectedIds(next)
  }
  
  // Handle add wishlist item to itinerary (create trip) or 更改 day (update only)
  const handleAddToTripSubmit = async () => {
    if (!selectedItemPopup) return
    setAddToTripSubmitting(true)
    const isChange = !!selectedItemPopup.addedToDay
    try {
      if (!isChange) {
        const content = selectedItemPopup.note
          ? `${selectedItemPopup.name}（${selectedItemPopup.note}）`
          : selectedItemPopup.name
        const scheduleItem = {
          id: `add-${Date.now()}`,
          content,
          time_start: addToTripTimeStart || undefined,
          time_end: addToTripTimeEnd || undefined,
        }
        let dateStr = new Date().toISOString().split('T')[0]
        if (settings?.tripStartDate && settings?.totalDays) {
          const start = new Date(settings.tripStartDate)
          const target = new Date(start)
          target.setDate(start.getDate() + addToTripDay - 1)
          dateStr = target.toISOString().split('T')[0]
        }
        // Use wishlist name for map positioning (geocode) and display
        const coords = await geocodePlaceName(selectedItemPopup.name)
        const lat = coords?.lat ?? 35.6762
        const lng = coords?.lng ?? 139.6503
        const wishlistImages = parseWishlistImages(selectedItemPopup.imageUrl)
        const imageUrlForTrip = wishlistImages.length > 0 ? JSON.stringify(wishlistImages) : undefined
        const { data, error } = await createTrip({
          title: selectedItemPopup.name,
          date: dateStr,
          time_start: addToTripTimeStart || undefined,
          time_end: addToTripTimeEnd || undefined,
          description: JSON.stringify([scheduleItem]),
          location: selectedItemPopup.name,
          lat,
          lng,
          image_url: imageUrlForTrip,
          wishlist_item_id: Number(selectedItemPopup.id),
        })
        if (!data) {
          alert(error || '新增失敗')
          return
        }
        await queryClient.invalidateQueries({ queryKey: queryKeys.trips })
      }
      // Update wishlist item with added_to_trip (both new add and 更改)
      await updateSupabaseWishlistItem(Number(selectedItemPopup.id), {
        added_to_trip: { day: addToTripDay, time: addToTripTimeStart || addToTripTimeEnd || '12:00' },
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.wishlistItems })
      // Optimistically update popup & local wishlist so button shows "已新增" immediately
      const updatedItem = { ...selectedItemPopup, addedToDay: addToTripDay, addedTime: addToTripTimeStart || addToTripTimeEnd || '12:00' }
      setSelectedItemPopup(updatedItem)
      setWishlist(prev => {
        const cat = selectedItemPopup.category
        const items = prev[cat] || []
        const idx = items.findIndex(i => String(i.id) === String(selectedItemPopup.id))
        if (idx < 0) return prev
        const next = [...items]
        next[idx] = updatedItem
        return { ...prev, [cat]: next }
      })
      setAddToTripSuccess(true)
      setTimeout(() => {
        setShowAddToTripForm(false)
        setAddToTripSuccess(false)
        setAddToTripTimeStart('')
        setAddToTripTimeEnd('')
        setAddToTripDay(1)
      }, 800)
    } catch (err: any) {
      alert(err.message || '發生錯誤')
    } finally {
      setAddToTripSubmitting(false)
    }
  }

  // Handle remove wishlist item from itinerary
  const handleRemoveFromItinerary = async () => {
    if (!selectedItemPopup) return
    if (!confirm('確定要從行程中移除此心願嗎？')) return
    setRemoveFromItinerarySubmitting(true)
    try {
      const res = await removeWishlistItemFromItinerary(Number(selectedItemPopup.id), {
        name: selectedItemPopup.name,
        addedToDay: selectedItemPopup.addedToDay,
      })
      if (!res.success) {
        alert(res.error || '移除失敗')
        return
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.trips })
      await queryClient.invalidateQueries({ queryKey: queryKeys.wishlistItems })
      window.location.reload()
    } catch (err: any) {
      alert(err?.message || '移除時發生錯誤')
    } finally {
      setRemoveFromItinerarySubmitting(false)
    }
  }

  // Handle edit item from popup - open the add form pre-filled
  const handleEditItemFromPopup = (item: WishlistItem) => {
    setEditingItem(item)
    setNewItemName(item.name)
    setNewItemNote(item.note || '')
    setNewItemImages(parseWishlistImages(item.imageUrl))
    setNewItemUrl(item.link || '')
    setNewItemCategory(item.category)
    setNewItemArea(item.area || '')
    setAreaSearch('')
    setSelectedItemPopup(null)
    setShowAddForm(true)
  }
  
  // Handle save edited item
  const handleSaveEdit = async () => {
    if (!editingItem || !newItemName.trim()) return
    
    setIsSubmitting(true)
    
    try {
      const imageUrlValue = newItemImages.length > 0 ? JSON.stringify(newItemImages) : null
      const { error } = await updateSupabaseWishlistItem(Number(editingItem.id), {
        name: newItemName.trim(),
        note: newItemNote.trim() || null,
        image_url: imageUrlValue,
        link: newItemUrl.trim() || null,
        category: newItemCategory,
        map_link: newItemArea || null,
      })
      
      if (error) {
        alert(`更新失敗：${error}`)
        setIsSubmitting(false)
        return
      }
      
      // Sync name/note/images to linked trips (行程明細)
      const imageUrlForSync = newItemImages.length > 0 ? JSON.stringify(newItemImages) : null
      const { updated } = await syncTripsFromWishlistItem(
        Number(editingItem.id),
        newItemName.trim(),
        newItemNote.trim() || '',
        imageUrlForSync
      )
      if (updated > 0) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.trips })
      }
      
      // Reset form and refresh via TanStack Query
      setEditingItem(null)
      setNewItemName('')
      setNewItemNote('')
      setNewItemImages([])
      setNewItemUrl('')
      setNewItemCategory('cafe')
      setNewItemArea('')
      setAreaSearch('')
      setShowAddForm(false)
      await queryClient.invalidateQueries({ queryKey: queryKeys.wishlistItems })
    } catch (err: any) {
      console.error('Failed to update item:', err)
      alert(`更新失敗：${err.message || '未知錯誤'}`)
    }
    
    setIsSubmitting(false)
  }
  
  // Handle toggle favorite (per-user: add/remove from favoritedBy, does not affect others)
  const handleToggleFavorite = async (item: WishlistItem) => {
    const currentUsername = (currentUser || getCurrentUser())?.username
    if (!currentUsername) return
    const favoritedBy = item.favoritedBy || []
    const isLiked = favoritedBy.includes(currentUsername)
    const newFavoritedBy = isLiked
      ? favoritedBy.filter(u => u !== currentUsername)
      : [...favoritedBy, currentUsername]
    try {
      const { data, error } = await updateSupabaseWishlistItem(Number(item.id), {
        favorited_by: newFavoritedBy,
        is_favorite: newFavoritedBy.length > 0,
      })
      if (error) {
        console.error('Failed to save like:', error)
        if (error.includes('favorited_by') || error.includes('column')) {
          alert('請先在 Supabase 執行 migration 新增 favorited_by 欄位。請在 SQL Editor 執行：\nALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS favorited_by jsonb DEFAULT \'[]\'::jsonb;')
        }
        return
      }
      if (data) {
        const newWishlist = { ...wishlist }
        const idx = newWishlist[item.category].findIndex(i => i.id === item.id)
        if (idx !== -1) {
          newWishlist[item.category][idx] = {
            ...newWishlist[item.category][idx],
            favoritedBy: newFavoritedBy,
            isFavorite: newFavoritedBy.length > 0,
          }
          setWishlist(newWishlist)
          safeSetItem(STORAGE_KEY, JSON.stringify(stripImagesForCache(newWishlist)))
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.wishlistItems })
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err)
    }
  }
  
  const filteredItems = getFilteredItems()
  const displayedItems = filteredItems.slice(0, displayCount)
  const hasMore = displayedItems.length < filteredItems.length

  // IntersectionObserver: load more when sentinel is visible
  useEffect(() => {
    if (!hasMore) return
    const el = loadMoreRef.current
    if (!el) return
    const ob = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || isLoadingMoreRef.current) return
        isLoadingMoreRef.current = true
        setIsLoadingMore(true)
        setDisplayCount((prev) => Math.min(prev + 12, filteredItems.length))
        setTimeout(() => {
          isLoadingMoreRef.current = false
          setIsLoadingMore(false)
        }, 300)
      },
      { rootMargin: '100px', threshold: 0 }
    )
    ob.observe(el)
    return () => ob.disconnect()
  }, [filteredItems, hasMore])

  return (
    <main className={`bg-gray-50 ${isAdmin && bulkSelectMode ? 'pb-40' : 'pb-20'} ${!isSakuraMode ? 'clean-mode' : ''}`}>
      <SakuraCanvas enabled={isSakuraMode} />
      
      {/* Header - Airbnb style */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h1 className="text-xl font-semibold text-gray-800 flex items-center gap-2 min-w-0">
              <img src="/images/gonggu card_1-04-nobg.png" alt="" className="w-7 h-7 object-contain shrink-0" />
              <span className="truncate">心願清單</span>
            </h1>
            <div className="flex items-center gap-2 shrink-0">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setBulkSelectMode(v => !v)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors border ${
                    bulkSelectMode
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {bulkSelectMode ? '取消多選' : '多選'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-sakura-500 hover:bg-sakura-600 text-white rounded-full text-xs sm:text-sm font-medium transition-colors"
              >
                <span>+</span>
                <span className="hidden sm:inline">新增</span>
              </button>
            </div>
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
          {/* -mx-4 breaks out of parent px-4 so tabs reach both screen edges */}
          <div className="-mx-4 overflow-x-auto">
            <div className="flex gap-2 px-4 pr-4">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`flex-1 min-w-max flex items-center justify-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
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
                    {wishlist[cat.id]?.length || 0}
                  </span>
                )}
              </button>
            ))}
            </div>
          </div>

        </div>
      </header>
      
      {/* Content - Airbnb grid */}
      <div className="container mx-auto px-4 py-6">

        {/* Area filter — shown whenever any items in the current tab have an area tagged */}
        {availableAreas.length >= 1 && (
          <div className="-mx-4 overflow-x-auto mb-4">
            <div className="flex gap-2 px-4 pr-4 items-center">
              {/* "全部" clear chip — shown only when a filter is active */}
              {activeAreaFilter && (
                <button
                  onClick={() => setActiveAreaFilter('')}
                  className="flex-shrink-0 flex items-center gap-1 pl-2 pr-3 py-1.5 rounded-full text-xs font-medium bg-gray-900 text-white whitespace-nowrap transition-all"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  全部
                </button>
              )}
              {availableAreas.map(area => {
                const isActive = activeAreaFilter === area.id
                const relevantDbItems = wishlistDbItems
                  ? (activeTab === 'all' ? wishlistDbItems : wishlistDbItems.filter(db => db.category === activeTab))
                  : []
                const count = relevantDbItems.filter(db => db.map_link === area.id).length
                return (
                  <button
                    key={area.id}
                    onClick={() => setActiveAreaFilter(isActive ? '' : area.id)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-gray-900 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    <span>{area.zh}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

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
          <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {displayedItems.map((item) => {
              const numericId = Number(item.id)
              const isBulkSelected = !Number.isNaN(numericId) && bulkSelectedIds.has(numericId)
              return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow group select-none ${
                  isAdmin && bulkSelectMode ? 'cursor-pointer ring-offset-2' : 'cursor-pointer'
                } ${isBulkSelected ? 'ring-2 ring-sakura-500 ring-offset-2' : ''}`}
                style={{ touchAction: 'manipulation' }}
                onClick={() => {
                  if (isAdmin && bulkSelectMode) {
                    if (!Number.isNaN(numericId)) toggleBulkSelectId(numericId)
                    return
                  }
                  setSelectedItemPopup(item)
                }}
                role="button"
                tabIndex={0}
              >
                {/* Image */}
                <div className="relative aspect-[4/3] bg-gray-100">
                  {isAdmin && bulkSelectMode && (
                    <div
                      className="absolute top-2 left-2 z-20 w-7 h-7 rounded-lg border-2 border-white shadow-md flex items-center justify-center bg-white/95"
                      aria-hidden
                    >
                      <span
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          isBulkSelected ? 'bg-sakura-500 border-sakura-500 text-white' : 'border-gray-400 bg-white'
                        }`}
                      >
                        {isBulkSelected ? '✓' : ''}
                      </span>
                    </div>
                  )}
                  {(() => {
                    const imgs = parseWishlistImages(item.imageUrl)
                    const src = imgs[0]
                    return src ? (
                    <img
                      src={src}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                      <span className="text-4xl opacity-50">
                        {CATEGORIES.find(c => c.id === item.category)?.icon || '📌'}
                      </span>
                    </div>
                  )
                  })()}
                  
                  {/* Top-left: trip day badge */}
                  {item.addedToDay && (
                    <div
                      className={`absolute top-2 px-2 py-1 bg-green-500 text-white text-xs font-medium rounded-full z-10 ${
                        isAdmin && bulkSelectMode ? 'left-10' : 'left-2'
                      }`}
                    >
                      Day {item.addedToDay}
                    </div>
                  )}

                  {/* Top-right: area badge */}
                  {item.area && (() => {
                    const areaData = TOKYO_AREAS.find(a => a.id === item.area)
                    return areaData ? (
                      <div className="absolute top-2 right-2 px-2 py-0.5 bg-indigo-500/80 backdrop-blur-sm text-white text-[10px] font-medium rounded-full leading-snug" style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>
                        {areaData.zh}
                      </div>
                    ) : null
                  })()}
                  
                  {/* Like bubble - bottom left (avatar + 已讚好 + ❤️) */}
                  {(item.favoritedBy || []).length > 0 && (() => {
                    const favoritedBy = (item.favoritedBy || []) as string[]
                    const loggedInUsername = (currentUser || getCurrentUser())?.username ?? getLoggedInUsername()
                    const isCurrentUserLiked = favoritedBy.includes(loggedInUsername || '')
                    const otherUsername = favoritedBy.find(u => u !== loggedInUsername)
                    const otherAvatar = otherUsername ? getUserAvatar(otherUsername, item.addedBy?.username === otherUsername ? item.addedBy.avatarUrl : users.find(u => u.username === otherUsername)?.avatarUrl) : undefined
                    const currentUserAvatar = loggedInUsername ? getUserAvatar(loggedInUsername, currentUser?.avatarUrl ?? users.find(u => u.username === loggedInUsername)?.avatarUrl) : undefined
                    const avatars = isCurrentUserLiked && otherUsername
                      ? [currentUserAvatar, otherAvatar]
                      : (isCurrentUserLiked ? [currentUserAvatar] : [otherAvatar])
                    return (
                      <div className="absolute bottom-2 left-2 pointer-events-none">
                        <div className="bg-black/75 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1.5">
                          <div className="flex -space-x-1">
                            {avatars.map((url, i) => url ? (
                              <img key={i} src={url} alt="" className="w-4 h-4 rounded-full object-cover border border-black/75" />
                            ) : (
                              <div key={i} className="w-4 h-4 rounded-full bg-white/30 border border-black/75" />
                            ))}
                          </div>
                          <span>已讚好 ❤️</span>
                        </div>
                      </div>
                    )
                  })()}
                  {/* Favorite indicator - bottom right (current user's like) */}
                  {(item.favoritedBy || []).includes((currentUser || getCurrentUser())?.username || '') && (
                    <div className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full shadow-sm">
                      <HeartFilled className="w-4 h-4 text-rose-500" />
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
                      {CATEGORIES.find(c => c.id === item.category)?.name || item.category}
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
            )})}
          </div>
          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-8">
              {isLoadingMore ? (
                <span className="text-sm text-gray-500">載入中...</span>
              ) : (
                <span className="text-sm text-gray-400">向下捲動載入更多</span>
              )}
            </div>
          )}
          </>
        )}
      </div>

      {/* Admin: bulk delete action bar */}
      {isAdmin && bulkSelectMode && (
        <div className="fixed bottom-16 left-0 right-0 z-[60] border-t border-gray-200 bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-700">
              已選 <span className="font-semibold text-sakura-600">{bulkSelectedIds.size}</span> 項
              <span className="text-gray-400 text-xs ml-2 hidden sm:inline">（點卡片可勾選／取消）</span>
            </p>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <button
                type="button"
                disabled={bulkDeleting || filteredItems.length === 0}
                onClick={selectAllFilteredIds}
                className="px-3 py-2 text-xs sm:text-sm font-medium rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                全選篩選結果
              </button>
              <button
                type="button"
                disabled={bulkDeleting || bulkSelectedIds.size === 0}
                onClick={() => setBulkSelectedIds(new Set())}
                className="px-3 py-2 text-xs sm:text-sm font-medium rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                清除選取
              </button>
              <button
                type="button"
                disabled={bulkDeleting || bulkSelectedIds.size === 0}
                onClick={() => void handleBulkDeleteSelected()}
                className="px-4 py-2 text-xs sm:text-sm font-medium rounded-full bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkDeleting ? '刪除中…' : `刪除已選 (${bulkSelectedIds.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
      
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
                  
                  {/* Area Selector */}
                  <div className="relative" ref={areaDropdownRef}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">地區</label>
                    <button
                      type="button"
                      onClick={() => { setAreaDropdownOpen(v => !v); setAreaSearch('') }}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none bg-white text-left flex items-center justify-between"
                    >
                      <span className={newItemArea ? 'text-gray-800' : 'text-gray-400'}>
                        {newItemArea
                          ? (() => { const a = TOKYO_AREAS.find(x => x.id === newItemArea); return a ? `${a.zh} ${a.en}` : newItemArea })()
                          : '選擇地區（可略）'}
                      </span>
                      <span className="text-gray-400 text-xs ml-2">{areaDropdownOpen ? '▲' : '▼'}</span>
                    </button>
                    {areaDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                        {/* Search input */}
                        <div className="p-2 border-b border-gray-100">
                          <input
                            type="text"
                            value={areaSearch}
                            onChange={(e) => setAreaSearch(e.target.value)}
                            placeholder="搜尋地區... / Search area..."
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-sakura-400"
                            autoFocus
                          />
                        </div>
                        {/* Option list — grouped by district */}
                        <div className="max-h-60 overflow-y-auto">
                          <button
                            type="button"
                            onClick={() => { setNewItemArea(''); setAreaDropdownOpen(false); setAreaSearch('') }}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-50"
                          >
                            — 不選擇
                          </button>
                          {(() => {
                            const q = areaSearch.toLowerCase()
                            const hasResults = TOKYO_DISTRICTS.some(d =>
                              d.areas.some(a => !q || a.zh.includes(q) || a.en.toLowerCase().includes(q))
                            )
                            if (!hasResults) {
                              return <div className="px-4 py-3 text-sm text-gray-400 text-center">沒有結果</div>
                            }
                            return TOKYO_DISTRICTS.map(district => {
                              const filtered = district.areas.filter(a =>
                                !q || a.zh.includes(q) || a.en.toLowerCase().includes(q)
                              )
                              if (filtered.length === 0) return null
                              return (
                                <div key={district.id}>
                                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 bg-gray-50 flex items-center gap-1 sticky top-0">
                                    <span>{district.icon}</span>
                                    <span>{district.label}</span>
                                    <span className="text-gray-300">·</span>
                                    <span className="font-normal">{district.en}</span>
                                  </div>
                                  {filtered.map(a => (
                                    <button
                                      key={a.id}
                                      type="button"
                                      onClick={() => { setNewItemArea(a.id); setAreaDropdownOpen(false); setAreaSearch('') }}
                                      className={`w-full text-left px-5 py-2.5 text-sm hover:bg-sakura-50 flex items-center justify-between transition-colors ${newItemArea === a.id ? 'bg-sakura-50 text-sakura-700 font-medium' : 'text-gray-700'}`}
                                    >
                                      <span>{a.zh}</span>
                                      <span className="text-gray-400 text-xs">{a.en}</span>
                                    </button>
                                  ))}
                                </div>
                              )
                            })
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Image - max 5 */}
                  <MultiMediaUpload
                    value={newItemImages}
                    onChange={setNewItemImages}
                    label="圖片"
                    maxImages={5}
                    className="mb-4"
                  />
                  
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
                        const allUsersChecked = users.length > 0 && itemCheckedUsers.length >= users.length
                        return (
                          <div 
                            key={idx} 
                            className={`flex items-center justify-between gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                              allUsersChecked
                                ? 'bg-emerald-50/60 text-emerald-400'
                                : anyoneChecked 
                                  ? 'bg-green-50 text-green-600' 
                                  : 'text-gray-600 hover:bg-gray-50'
                            }`}
                            onClick={() => toggleCheckItem(itemKey)}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span className={`flex-shrink-0 ${allUsersChecked ? 'opacity-50' : ''}`}>{item.icon}</span>
                              <span className={`truncate text-sm ${allUsersChecked ? 'line-through opacity-60' : ''}`}>{item.text}</span>
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
                              {/* All users checked badge */}
                              {allUsersChecked && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                                  ✅
                                </span>
                              )}
                              {/* Checkbox - hidden when all users checked */}
                              {!allUsersChecked && (
                                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all text-xs ${
                                  isChecked 
                                    ? 'bg-green-500 border-green-500 text-white' 
                                    : anyoneChecked
                                      ? 'bg-green-200 border-green-300 text-green-600'
                                      : 'border-gray-300'
                                }`}>
                                  {anyoneChecked && '✓'}
                                </span>
                              )}
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
                        const allUsersChecked = users.length > 0 && itemCheckedUsers.length >= users.length
                        return (
                          <div 
                            key={idx} 
                            className={`flex items-center justify-between gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                              allUsersChecked
                                ? 'bg-emerald-50/60 text-emerald-400'
                                : anyoneChecked 
                                  ? 'bg-green-50 text-green-600' 
                                  : 'text-gray-600 hover:bg-gray-50'
                            }`}
                            onClick={() => toggleCheckItem(itemKey)}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span className={`flex-shrink-0 ${allUsersChecked ? 'opacity-50' : ''}`}>{item.icon}</span>
                              <span className={`truncate text-sm ${allUsersChecked ? 'line-through opacity-60' : ''}`}>{item.text}</span>
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
                              {/* All users checked badge */}
                              {allUsersChecked && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                                  ✅
                                </span>
                              )}
                              {/* Checkbox - hidden when all users checked */}
                              {!allUsersChecked && (
                                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all text-xs ${
                                  isChecked 
                                    ? 'bg-green-500 border-green-500 text-white' 
                                    : anyoneChecked
                                      ? 'bg-green-200 border-green-300 text-green-600'
                                      : 'border-gray-300'
                                }`}>
                                  {anyoneChecked && '✓'}
                                </span>
                              )}
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
            onClick={() => { setSelectedItemPopup(null); setShowAddToTripForm(false); setPopupMoreMenuOpen(false) }}
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
              {/* Image - slider when multiple */}
              {(() => {
                const images = parseWishlistImages(selectedItemPopup.imageUrl)
                if (images.length === 0) return null
                return (
                <div className="relative aspect-video bg-gray-100">
                  {images.length === 1 ? (
                    <img
                      src={images[0]}
                      alt={selectedItemPopup.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageSlider
                      images={images}
                      className="w-full h-full"
                      autoPlay={true}
                      interval={5000}
                      hideArrows={false}
                      largeArrows={true}
                    />
                  )}
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    {/* More menu (Edit/Delete) - only for canEdit users */}
                    {canEdit() && (
                      <div className="relative">
                        <button
                          onClick={() => setPopupMoreMenuOpen(v => !v)}
                          className="w-8 h-8 flex items-center justify-center bg-black/50 text-white rounded-full hover:bg-black/70"
                        >
                          ⋯
                        </button>
                        {popupMoreMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setPopupMoreMenuOpen(false)} />
                            <div className="absolute right-0 top-10 z-20 py-1 bg-white rounded-lg shadow-lg border border-gray-100 min-w-[120px]">
                              <button
                                onClick={() => { setPopupMoreMenuOpen(false); handleEditItemFromPopup(selectedItemPopup); setSelectedItemPopup(null) }}
                                className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                              >
                                ✏️ 編輯
                              </button>
                              <button
                                onClick={() => { setPopupMoreMenuOpen(false); handleDeleteItem(selectedItemPopup) }}
                                className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
                              >
                                🗑️ 刪除
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => { setSelectedItemPopup(null); setShowAddToTripForm(false); setPopupMoreMenuOpen(false) }}
                      className="w-8 h-8 flex items-center justify-center bg-black/50 text-white rounded-full"
                    >
                      ✕
                    </button>
                  </div>
                  {/* Bottom left: Like bubble — only show when someone has pressed the like button (favoritedBy) */}
                  {(() => {
                    const currentUserInfo = getCurrentUser()
                    const loggedInUsername = currentUserInfo?.username ?? getLoggedInUsername()
                    const addedBy = selectedItemPopup.addedBy
                    const liveItem = Object.values(wishlist).flat().find(i => String(i.id) === String(selectedItemPopup.id))
                    const favoritedBy = (liveItem?.favoritedBy ?? selectedItemPopup.favoritedBy ?? []) as string[]
                    const isCurrentUserLiked = favoritedBy.includes(loggedInUsername || '')
                    const currentUserAvatar = loggedInUsername ? getUserAvatar(loggedInUsername, currentUserInfo?.avatarUrl ?? users.find(u => u.username === loggedInUsername)?.avatarUrl) : undefined
                    if (favoritedBy.length === 0) return null
                    const otherUsername = favoritedBy.find(u => u !== loggedInUsername)
                    const otherDisplayName = otherUsername ? getUserDisplayName(otherUsername, addedBy?.username === otherUsername ? addedBy.displayName : users.find(u => u.username === otherUsername)?.displayName) : ''
                    const otherAvatar = otherUsername ? getUserAvatar(otherUsername, addedBy?.username === otherUsername ? addedBy.avatarUrl : users.find(u => u.username === otherUsername)?.avatarUrl) : undefined
                    const text = isCurrentUserLiked
                      ? (otherUsername ? `你 和 ${otherDisplayName} 也對此讚好` : '你 對此讚好')
                      : `${otherDisplayName} 對此讚好`
                    const avatars = isCurrentUserLiked && otherUsername
                      ? [currentUserAvatar, otherAvatar]
                      : (isCurrentUserLiked ? [currentUserAvatar] : [otherAvatar])
                    return (
                      <motion.div
                        className="absolute bottom-3 left-3 pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                      >
                        <div className="bg-black/75 text-white text-xs px-3 py-2 rounded-full backdrop-blur-sm shadow-lg flex items-center gap-2">
                          <div className="flex -space-x-1.5">
                            {avatars.map((url, i) => url ? (
                              <img key={i} src={url} alt="" className="w-5 h-5 rounded-full object-cover border-2 border-black/75" />
                            ) : (
                              <div key={i} className="w-5 h-5 rounded-full bg-white/30 border-2 border-black/75" />
                            ))}
                          </div>
                          <span>{text} ❤️</span>
                        </div>
                      </motion.div>
                    )
                  })()}
                  {/* Bottom right: Favorite button (per-user) */}
                  <div className="absolute bottom-3 right-3">
                    <motion.button
                      onClick={() => {
                        const un = (getCurrentUser() || currentUser)?.username ?? getLoggedInUsername()
                        if (!un) return
                        handleToggleFavorite(selectedItemPopup)
                      }}
                      whileTap={{ scale: 0.85 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      className="w-10 h-10 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:scale-110 transition-transform"
                    >
                      <motion.span
                        key={(selectedItemPopup.favoritedBy || []).includes((getCurrentUser() || currentUser)?.username ?? '') ? 'filled' : 'outline'}
                        initial={{ scale: 1.4 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      >
                        {(selectedItemPopup.favoritedBy || []).includes((getCurrentUser() || currentUser)?.username ?? '')
                          ? <HeartFilled className="w-5 h-5 text-rose-500" />
                          : <HeartOutline className="w-5 h-5 text-gray-400" />}
                      </motion.span>
                    </motion.button>
                  </div>
                </div>
                )
              })()}
              
              {/* Content */}
              <div className="p-6">
                {!parseWishlistImages(selectedItemPopup.imageUrl).length && (
                  <div className="flex items-center justify-between gap-2 mb-2">
                    {/* Bottom left: Like bubble — only show when someone has pressed the like button (favoritedBy) */}
                    {(() => {
                      const currentUserInfo = getCurrentUser()
                      const loggedInUsername = currentUserInfo?.username ?? getLoggedInUsername()
                      const addedBy = selectedItemPopup.addedBy
                      const liveItem = Object.values(wishlist).flat().find(i => String(i.id) === String(selectedItemPopup.id))
                      const favoritedBy = (liveItem?.favoritedBy ?? selectedItemPopup.favoritedBy ?? []) as string[]
                      const isCurrentUserLiked = favoritedBy.includes(loggedInUsername || '')
                      const currentUserAvatar = loggedInUsername ? getUserAvatar(loggedInUsername, currentUserInfo?.avatarUrl ?? users.find(u => u.username === loggedInUsername)?.avatarUrl) : undefined
                      if (favoritedBy.length === 0) return <div />
                      const otherUsername = favoritedBy.find(u => u !== loggedInUsername)
                      const otherDisplayName = otherUsername ? getUserDisplayName(otherUsername, addedBy?.username === otherUsername ? addedBy.displayName : users.find(u => u.username === otherUsername)?.displayName) : ''
                      const otherAvatar = otherUsername ? getUserAvatar(otherUsername, addedBy?.username === otherUsername ? addedBy.avatarUrl : users.find(u => u.username === otherUsername)?.avatarUrl) : undefined
                      const text = isCurrentUserLiked
                        ? (otherUsername ? `你 和 ${otherDisplayName} 也對此讚好` : '你 對此讚好')
                        : `${otherDisplayName} 對此讚好`
                      const avatars = isCurrentUserLiked && otherUsername
                        ? [currentUserAvatar, otherAvatar]
                        : (isCurrentUserLiked ? [currentUserAvatar] : [otherAvatar])
                      return (
                        <motion.div
                          className="bg-black/75 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3, ease: 'easeOut' }}
                        >
                          <div className="flex -space-x-1.5">
                            {avatars.map((url, i) => url ? (
                              <img key={i} src={url} alt="" className="w-5 h-5 rounded-full object-cover border-2 border-black/75" />
                            ) : (
                              <div key={i} className="w-5 h-5 rounded-full bg-white/30 border-2 border-black/75" />
                            ))}
                          </div>
                          <span>{text} ❤️</span>
                        </motion.div>
                      )
                    })()}
                    <div className="flex items-center gap-2">
                    {canEdit() && (
                      <div className="relative">
                        <button
                          onClick={() => setPopupMoreMenuOpen(v => !v)}
                          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                        >
                          ⋯
                        </button>
                        {popupMoreMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setPopupMoreMenuOpen(false)} />
                            <div className="absolute right-0 top-10 z-20 py-1 bg-white rounded-lg shadow-lg border border-gray-100 min-w-[120px]">
                              <button
                                onClick={() => { setPopupMoreMenuOpen(false); handleEditItemFromPopup(selectedItemPopup); setSelectedItemPopup(null) }}
                                className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                              >
                                ✏️ 編輯
                              </button>
                              <button
                                onClick={() => { setPopupMoreMenuOpen(false); handleDeleteItem(selectedItemPopup) }}
                                className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
                              >
                                🗑️ 刪除
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    <motion.button
                      onClick={() => {
                        const un = (getCurrentUser() || currentUser)?.username ?? getLoggedInUsername()
                        if (!un) return
                        handleToggleFavorite(selectedItemPopup)
                      }}
                      whileTap={{ scale: 0.85 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      className="w-8 h-8 flex items-center justify-center hover:scale-110 transition-transform"
                    >
                      <motion.span
                        key={(selectedItemPopup.favoritedBy || []).includes((getCurrentUser() || currentUser)?.username ?? '') ? 'filled' : 'outline'}
                        initial={{ scale: 1.4 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      >
                        {(selectedItemPopup.favoritedBy || []).includes((getCurrentUser() || currentUser)?.username ?? '')
                          ? <HeartFilled className="w-5 h-5 text-rose-500" />
                          : <HeartOutline className="w-5 h-5 text-gray-400" />}
                      </motion.span>
                    </motion.button>
                    <button
                      onClick={() => { setSelectedItemPopup(null); setShowAddToTripForm(false); setPopupMoreMenuOpen(false) }}
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                    >
                      ✕
                    </button>
                    </div>
                  </div>
                )}
                
                {/* Category + Area badges */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                    {CATEGORIES.find(c => c.id === selectedItemPopup.category)?.icon}{' '}
                    {CATEGORIES.find(c => c.id === selectedItemPopup.category)?.name || selectedItemPopup.category}
                  </span>
                  {selectedItemPopup.area && (() => {
                    const areaData = TOKYO_AREAS.find(a => a.id === selectedItemPopup.area)
                    return areaData ? (
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-full">
                        📍 {areaData.zh} · {areaData.en}
                      </span>
                    ) : null
                  })()}
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
                
                {/* Add to Itinerary - inline form, button, or "already added" info */}
                {showAddToTripForm ? (
                  <div className="p-4 bg-sakura-50 rounded-xl border border-sakura-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-sakura-700">📋 新增至行程</span>
                      <button
                        onClick={() => { setShowAddToTripForm(false); setAddToTripTimeStart(''); setAddToTripTimeEnd(''); setAddToTripDay(1) }}
                        className="text-gray-400 hover:text-gray-600 text-lg"
                      >
                        ✕
                      </button>
                    </div>
                    {addToTripSuccess ? (
                      <div className="py-6 text-center text-sakura-600 font-medium">✓ 已加入行程！</div>
                    ) : (
                      <>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">日期</label>
                            <select
                              value={addToTripDay}
                              onChange={(e) => setAddToTripDay(Number(e.target.value))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-sakura-400 focus:ring-1 focus:ring-sakura-100 outline-none"
                            >
                              {Array.from({ length: Math.max(1, settings?.totalDays || 7) }, (_, i) => i + 1).map(d => (
                                <option key={d} value={d}>
                                  Day {d} {settings?.tripStartDate && (() => {
                                    const start = new Date(settings.tripStartDate)
                                    const t = new Date(start)
                                    t.setDate(start.getDate() + d - 1)
                                    return `(${t.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })})`
                                  })()}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="block text-xs text-gray-500 mb-1">開始時段</label>
                              <input
                                type="time"
                                value={addToTripTimeStart}
                                onChange={(e) => setAddToTripTimeStart(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-sakura-400 outline-none"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs text-gray-500 mb-1">結束時段</label>
                              <input
                                type="time"
                                value={addToTripTimeEnd}
                                onChange={(e) => setAddToTripTimeEnd(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-sakura-400 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => { setShowAddToTripForm(false); setAddToTripTimeStart(''); setAddToTripTimeEnd(''); setAddToTripDay(1) }}
                            className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium"
                          >
                            取消
                          </button>
                          <button
                            onClick={handleAddToTripSubmit}
                            disabled={addToTripSubmitting}
                            className="flex-1 py-2.5 bg-sakura-500 hover:bg-sakura-600 disabled:bg-sakura-300 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2"
                          >
                            {addToTripSubmitting ? (
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : null}
                            確認加入
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : selectedItemPopup.addedToDay ? (
                  <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/main?day=${selectedItemPopup.addedToDay}`}
                        onClick={() => { setSelectedItemPopup(null); setShowAddToTripForm(false) }}
                        className="flex-1 flex items-center gap-2 text-green-700 hover:text-green-800 font-medium min-w-0"
                      >
                        <span>📋</span>
                        <span className="truncate">已新增至 Day {selectedItemPopup.addedToDay}</span>
                        {selectedItemPopup.addedTime && (
                          <span className="text-green-600 text-sm font-normal shrink-0">
                            {selectedItemPopup.addedTime}
                          </span>
                        )}
                      </Link>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setShowAddToTripForm(true)
                            setAddToTripDay(selectedItemPopup.addedToDay ?? 1)
                            setAddToTripTimeStart(selectedItemPopup.addedTime || '')
                            setAddToTripTimeEnd('')
                          }}
                          className="text-green-600 hover:text-green-700 text-sm px-2 py-1 underline"
                        >
                          更改
                        </button>
                        <span className="text-green-300">|</span>
                        <button
                          onClick={handleRemoveFromItinerary}
                          disabled={removeFromItinerarySubmitting}
                          className="text-red-600 hover:text-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm px-2 py-1 underline flex items-center gap-1"
                        >
                          {removeFromItinerarySubmitting ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-600 rounded-full animate-spin" />
                              移除中...
                            </>
                          ) : (
                            '移除'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setShowAddToTripForm(true); setAddToTripDay(1); setAddToTripTimeStart(''); setAddToTripTimeEnd('') }}
                    className="w-full py-3 bg-sakura-500 hover:bg-sakura-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <span>📋</span>
                    <span>新增至行程</span>
                  </button>
                )}
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
        <div className="flex items-stretch justify-around h-16 px-2">
          {/* 行程 Tab */}
          <Link
            href="/main"
            className="flex flex-col items-center justify-center flex-1 min-w-0 h-full text-gray-400 hover:text-sakura-500 transition-colors touch-manipulation"
          >
            <span className="text-xl mb-0.5">📋</span>
            <span className="text-[10px] font-medium">行程</span>
          </Link>
          
          {/* 心願清單 Tab - Active */}
          <button type="button" className="flex flex-col items-center justify-center flex-1 min-w-0 h-full text-sakura-500 touch-manipulation">
            <span className="text-xl mb-0.5">💖</span>
            <span className="text-[10px] font-medium">心願清單</span>
          </button>
          
          {/* 旅遊須知 Tab */}
          <button
            type="button"
            onClick={() => setShowTravelNotice(true)}
            className="flex flex-col items-center justify-center flex-1 min-w-0 h-full text-gray-400 hover:text-sakura-500 transition-colors touch-manipulation"
          >
            <span className="text-xl mb-0.5">📖</span>
            <span className="text-[10px] font-medium">旅遊須知</span>
          </button>
          
          {/* 個人資料 Tab */}
          <Link
            href="/panel"
            className="flex flex-col items-center justify-center flex-1 min-w-0 h-full text-gray-400 hover:text-sakura-500 transition-colors touch-manipulation"
          >
            <span className="text-xl mb-0.5">👤</span>
            <span className="text-[10px] font-medium">個人資料</span>
          </Link>
        </div>
      </nav>
    </main>
  )
}
