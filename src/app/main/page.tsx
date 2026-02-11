'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { createTrip, updateTrip, saveSupabaseChecklistState, type Trip } from '@/lib/supabase'
import { useTrips, useCreateTrip, useUpdateTrip, useDeleteTrip, useChecklistStates, useWishlistItems, queryKeys } from '@/hooks/useQueries'
import { type WishlistItemDB } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { getSettings, getSettingsAsync, saveSettings, saveSettingsAsync, type SiteSettings } from '@/lib/settings'
import { canEdit, getCurrentUser, isAdmin as checkIsAdmin, getUsers, getAuthToken, type User } from '@/lib/auth'
import SakuraCanvas from '@/components/SakuraCanvas'
import ChiikawaPet from '@/components/ChiikawaPet'
import DailyPopup from '@/components/DailyPopup'
import ModeToggle from '@/components/ModeToggle'
import MultiMediaUpload from '@/components/MultiMediaUpload'
import ImageSlider from '@/components/ImageSlider'
import WishlistButton from '@/components/WishlistButton'
import { useLanguage } from '@/lib/i18n'
import { safeSetItem } from '@/lib/safeStorage'

const GoogleMapComponent = dynamic(
  () => import('@/components/GoogleMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-sakura-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-sakura-300 border-t-sakura-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">載入地圖中...</p>
        </div>
      </div>
    )
  }
)

const PlacePicker = dynamic(() => import('@/components/PlacePicker'), {
  ssr: false,
  loading: () => (
    <div className="p-4 text-center">
      <div className="w-8 h-8 border-4 border-sakura-300 border-t-sakura-600 rounded-full animate-spin mx-auto" />
    </div>
  ),
})

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
  ssr: false,
  loading: () => (
    <div className="h-40 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-sakura-300 border-t-sakura-600 rounded-full animate-spin" />
    </div>
  ),
})

// Schedule item type for point-form list
type ScheduleItem = {
  id: string
  time_start: string
  time_end: string
  content: string
}

// Form data type
type TripFormData = {
  title: string
  date: string
  location: string
  lat: number
  lng: number
  images: string[] // Array of image URLs (stored as JSON in image_url field)
}

const initialFormData: TripFormData = {
  title: '',
  date: '',
  location: '',
  lat: 35.6762,
  lng: 139.6503,
  images: [],
}

// Helper to parse images from image_url field (handles both old string and new JSON array)
const parseImages = (imageUrl: string | undefined): string[] => {
  if (!imageUrl) return []
  try {
    const parsed = JSON.parse(imageUrl)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // If not JSON, treat as single image URL
    if (imageUrl.trim()) return [imageUrl]
  }
  return []
}

const createEmptyScheduleItem = (): ScheduleItem => ({
  id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
  time_start: '',
  time_end: '',
  content: '',
})

// Mode Toggle Click Hint - Mobile only, centered above button
const ModeToggleHint = () => {
  const [show, setShow] = useState(true)
  
  useEffect(() => {
    const clicked = localStorage.getItem('mode_toggle_clicked')
    if (clicked) {
      setShow(false)
    }
  }, [])
  
  if (!show) return null
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        scale: [1, 1.05, 1],
      }}
      transition={{
        opacity: { duration: 0.3 },
        scale: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
      }}
      className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap"
    >
      <div className="px-2 py-1 bg-pink-500 text-white text-[10px] rounded-full shadow-lg flex items-center gap-1">
        <span>👇</span>
        <span>點擊</span>
      </div>
      {/* Arrow pointing down to button */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-[-1px] w-0 h-0 
        border-l-[5px] border-l-transparent 
        border-r-[5px] border-r-transparent 
        border-t-[6px] border-t-pink-500"
      />
    </motion.div>
  )
}

// Pixel Heart Icon Component
const PixelHeart = () => (
  <svg width="16" height="14" viewBox="0 0 16 14" className="inline-block">
    <rect x="2" y="0" width="2" height="2" fill="#ff6b9d"/>
    <rect x="4" y="0" width="2" height="2" fill="#ff6b9d"/>
    <rect x="8" y="0" width="2" height="2" fill="#ff6b9d"/>
    <rect x="10" y="0" width="2" height="2" fill="#ff6b9d"/>
    <rect x="0" y="2" width="2" height="2" fill="#ff6b9d"/>
    <rect x="2" y="2" width="2" height="2" fill="#ffb3c6"/>
    <rect x="4" y="2" width="2" height="2" fill="#ff6b9d"/>
    <rect x="6" y="2" width="2" height="2" fill="#ff6b9d"/>
    <rect x="8" y="2" width="2" height="2" fill="#ff6b9d"/>
    <rect x="10" y="2" width="2" height="2" fill="#ff6b9d"/>
    <rect x="12" y="2" width="2" height="2" fill="#ff6b9d"/>
    <rect x="0" y="4" width="2" height="2" fill="#ff6b9d"/>
    <rect x="2" y="4" width="2" height="2" fill="#ff6b9d"/>
    <rect x="4" y="4" width="2" height="2" fill="#ff6b9d"/>
    <rect x="6" y="4" width="2" height="2" fill="#ff6b9d"/>
    <rect x="8" y="4" width="2" height="2" fill="#ff6b9d"/>
    <rect x="10" y="4" width="2" height="2" fill="#ff6b9d"/>
    <rect x="12" y="4" width="2" height="2" fill="#ff6b9d"/>
    <rect x="2" y="6" width="2" height="2" fill="#ff6b9d"/>
    <rect x="4" y="6" width="2" height="2" fill="#ff6b9d"/>
    <rect x="6" y="6" width="2" height="2" fill="#ff6b9d"/>
    <rect x="8" y="6" width="2" height="2" fill="#ff6b9d"/>
    <rect x="10" y="6" width="2" height="2" fill="#ff6b9d"/>
    <rect x="4" y="8" width="2" height="2" fill="#ff6b9d"/>
    <rect x="6" y="8" width="2" height="2" fill="#ff6b9d"/>
    <rect x="8" y="8" width="2" height="2" fill="#ff6b9d"/>
    <rect x="6" y="10" width="2" height="2" fill="#ff6b9d"/>
  </svg>
)

// Weather icons based on day (simple simulation - can be replaced with real API)
const getWeatherIcon = (dayNum: number) => {
  const icons = ['☀️', '⛅', '🌤️', '☁️', '🌧️', '⛈️', '🌈']
  return icons[dayNum % icons.length]
}

export default function MainPage() {
  // TanStack Query hooks for data fetching
  const queryClient = useQueryClient()
  const { data: trips = [], isLoading, error: tripsError } = useTrips({ refetchInterval: 30000 })
  const { data: checklistData } = useChecklistStates()
  const { data: wishlistDbItems = [] } = useWishlistItems()
  const createTripMutation = useCreateTrip()
  const updateTripMutation = useUpdateTrip()
  const deleteTripMutation = useDeleteTrip()

  const [isSakuraMode, setIsSakuraMode] = useState(false)
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null)
  const [selectedDay, setSelectedDay] = useState<number>(1)
  const [visibleStartDay, setVisibleStartDay] = useState<number>(1)
  const { t } = useLanguage()
  
  // Trip form state
  const [showTripForm, setShowTripForm] = useState(false)
  const [showPlacePicker, setShowPlacePicker] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [formData, setFormData] = useState<TripFormData>(initialFormData)
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([createEmptyScheduleItem()])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  // Users state (for avatar display)
  const [users, setUsers] = useState<User[]>([])
  
  // Track pending new day (when adding a day, we need to also add a trip)
  const [pendingNewDay, setPendingNewDay] = useState<number | null>(null)
  
  // Track expanded trip descriptions
  const [expandedTrips, setExpandedTrips] = useState<number[]>([])
  
  // Check if user can edit (admin or regular user like "girl")
  const [isAdmin, setIsAdmin] = useState(false)
  const [isActualAdmin, setIsActualAdmin] = useState(false) // True only for admin role
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string; displayName: string; avatarUrl?: string } | null>(null)
  
  // Mobile map popup state
  const [showMapPopup, setShowMapPopup] = useState(false)
  
  // Mobile bottom nav state
  const [activeBottomTab, setActiveBottomTab] = useState<'home' | 'map' | 'wishlist' | 'info'>('home')
  const [showWishlistPopup, setShowWishlistPopup] = useState(false)
  const [showInfoPopup, setShowInfoPopup] = useState(false)
  
  // Search state
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLocation, setSearchLocation] = useState<{ lat: number; lng: number; name: string } | null>(null)
  
  // Trip detail view state (Airbnb-style)
  const [showTripDetail, setShowTripDetail] = useState(false)
  const [showTripMapEmbed, setShowTripMapEmbed] = useState(false)
  const [detailTrip, setDetailTrip] = useState<Trip | null>(null)
  
  // Wishlist detail popup state (for search results)
  const [selectedWishlistItem, setSelectedWishlistItem] = useState<WishlistItemDB | null>(null)
  
  // Travel notice checklist state
  const [checkedItems, setCheckedItems] = useState<Record<string, { username: string; displayName: string; avatarUrl?: string }[]>>({})
  
  // Disable background scrolling when any popup/modal is active
  useEffect(() => {
    const anyPopupOpen = showTripForm || showMapPopup || showWishlistPopup || showInfoPopup || showSearch || showTripDetail || !!selectedWishlistItem
    if (anyPopupOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showTripForm, showMapPopup, showWishlistPopup, showInfoPopup, showSearch, showTripDetail, selectedWishlistItem])

  useEffect(() => {
    setIsAdmin(canEdit())
    setIsActualAdmin(checkIsAdmin())
    setCurrentUser(getCurrentUser())
    // Load sakura mode from localStorage
    const savedSakuraMode = localStorage.getItem('sakura_mode')
    if (savedSakuraMode === 'true') {
      setIsSakuraMode(true)
    }
  }, [])

  // Fallback: if currentUser is null but user is authenticated, reconstruct from users list + auth token
  useEffect(() => {
    if (!currentUser && users.length > 0) {
      const isAdm = checkIsAdmin()
      let fallbackUser: User | undefined
      
      if (isAdm) {
        fallbackUser = users.find(u => u.role === 'admin')
      } else {
        const token = getAuthToken()
        if (token) {
          const match = token.match(/^japan_travel_user_(.+)_2024$/)
          if (match) {
            const tokenUsername = match[1]
            fallbackUser = users.find(u => u.username === tokenUsername)
          }
        }
        if (!fallbackUser) {
          fallbackUser = users.find(u => u.role === 'user') || users[0]
        }
      }
      
      if (fallbackUser) {
        setCurrentUser({
          username: fallbackUser.username,
          role: fallbackUser.role,
          displayName: fallbackUser.displayName,
          avatarUrl: fallbackUser.avatarUrl,
        })
      }
    }
  }, [currentUser, users])

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

  useEffect(() => {
    async function initializeData() {
      // Load settings first to avoid flickering (use cached first, then async)
      let loadedSettings = getSettings() // Use cached value first for instant display
      setSettings(loadedSettings)
      
      // Load users for avatar display
      setUsers(getUsers())
      
      // Then try to fetch fresh from Supabase (but don't block on failure)
      try {
        const freshSettings = await getSettingsAsync()
        if (freshSettings) {
          loadedSettings = freshSettings
          setSettings(loadedSettings)
        }
      } catch (err) {
        console.warn('Failed to fetch settings from Supabase, using local:', err)
      }
      
      // Auto-select current day based on trip start date
      if (loadedSettings.tripStartDate) {
        const startDate = new Date(loadedSettings.tripStartDate)
        const today = new Date()
        const diffTime = today.getTime() - startDate.getTime()
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1
        if (diffDays >= 1 && diffDays <= loadedSettings.totalDays) {
          setSelectedDay(diffDays)
        }
      }
    }

    initializeData()
  }, [])
  
  // Toggle trip description expansion
  const toggleTripExpand = (tripId: number) => {
    setExpandedTrips(prev => 
      prev.includes(tripId) 
        ? prev.filter(id => id !== tripId)
        : [...prev, tripId]
    )
  }

  // Parse schedule items from description JSON
  const parseScheduleItems = (description: string): ScheduleItem[] => {
    try {
      const parsed = JSON.parse(description)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any) => ({
          id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
          time_start: item.time_start || '',
          time_end: item.time_end || '',
          content: item.content || '',
        }))
      }
    } catch {
      // If not JSON, treat as legacy plain text/HTML
      if (description && description.trim()) {
        return [{
          id: Date.now().toString(),
          time_start: '',
          time_end: '',
          content: description.replace(/<[^>]*>/g, ''), // Strip HTML tags
        }]
      }
    }
    return [createEmptyScheduleItem()]
  }

  // Open form to add new trip
  const openAddForm = () => {
    // Set default date to selected day
    let defaultDate = ''
    if (settings?.tripStartDate) {
      const startDate = new Date(settings.tripStartDate)
      const targetDate = new Date(startDate)
      targetDate.setDate(startDate.getDate() + selectedDay - 1)
      defaultDate = targetDate.toISOString().split('T')[0]
    }
    
    setFormData({ ...initialFormData, date: defaultDate })
    setScheduleItems([createEmptyScheduleItem()])
    setEditingTrip(null)
    setShowTripForm(true)
    setFormMessage(null)
  }

  // Open form to edit existing trip
  const openEditForm = (trip: Trip, e: React.MouseEvent) => {
    e.stopPropagation()
    setFormData({
      title: trip.title,
      date: trip.date,
      location: trip.location,
      lat: trip.lat,
      lng: trip.lng,
      images: parseImages(trip.image_url),
    })
    setScheduleItems(parseScheduleItems(trip.description))
    setEditingTrip(trip)
    setShowTripForm(true)
    setFormMessage(null)
  }

  // Close form without reverting (used after successful submission)
  const closeFormSimple = () => {
    setShowTripForm(false)
    setShowPlacePicker(false)
    setEditingTrip(null)
    setFormData(initialFormData)
    setScheduleItems([createEmptyScheduleItem()])
    setFormMessage(null)
    setPendingNewDay(null)
  }

  // Close form (may revert pending new day if cancelled)
  const closeForm = () => {
    // If there's a pending new day and we're closing without submitting, cancel the new day
    if (pendingNewDay && settings) {
      const previousTotalDays = pendingNewDay - 1
      const previousDaySchedules = settings.daySchedules?.filter(d => d.dayNumber < pendingNewDay) || []
      
      const revertedSettings = {
        ...settings,
        totalDays: previousTotalDays,
        daySchedules: previousDaySchedules
      }
      
      saveSettingsAsync(revertedSettings) // Sync to Supabase
      setSettings(revertedSettings)
      setSelectedDay(Math.min(selectedDay, previousTotalDays))
      setPendingNewDay(null)
    }
    
    closeFormSimple()
  }

  // Handle place selection
  const handlePlaceSelect = (place: { location: string; lat: number; lng: number }) => {
    setFormData(prev => ({
      ...prev,
      location: place.location,
      lat: place.lat,
      lng: place.lng,
    }))
    setShowPlacePicker(false)
  }

  // Submit form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormMessage(null)

    try {
      // Filter out empty schedule items and convert to JSON
      const validScheduleItems = scheduleItems.filter(item => 
        item.content.trim() || item.time_start || item.time_end
      )
      const descriptionJson = JSON.stringify(validScheduleItems)
      
      // Get first schedule item's time for sorting purposes
      const firstItem = validScheduleItems[0]
      
      const tripData = {
        title: formData.title,
        date: formData.date,
        time_start: firstItem?.time_start || undefined,
        time_end: firstItem?.time_end || undefined,
        description: descriptionJson,
        location: formData.location,
        lat: formData.lat,
        lng: formData.lng,
        image_url: formData.images.length > 0 ? JSON.stringify(formData.images) : undefined,
      }

      if (editingTrip) {
        const result = await updateTripMutation.mutateAsync({ id: editingTrip.id, trip: tripData })
        if (result.data) {
          setFormMessage({ type: 'success', text: '行程已更新！' })
          // Use closeFormSimple to avoid reverting day settings
          setTimeout(closeFormSimple, 1000)
        } else {
          setFormMessage({ type: 'error', text: result.error || '更新失敗' })
        }
      } else {
        const result = await createTripMutation.mutateAsync(tripData)
        if (result.data) {
          setFormMessage({ type: 'success', text: '行程已新增！' })
          // Use closeFormSimple to avoid reverting day settings
          setTimeout(closeFormSimple, 1000)
        } else {
          setFormMessage({ type: 'error', text: result.error || '新增失敗' })
        }
      }
    } catch (err: any) {
      setFormMessage({ type: 'error', text: err.message || '發生錯誤' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete trip
  const handleDeleteTrip = async (tripId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('確定要刪除此行程嗎？')) return

    try {
      const result = await deleteTripMutation.mutateAsync(tripId)
      if (!result.success) {
        alert(result.error || '刪除失敗')
      }
    } catch (err: any) {
      alert(err.message || '發生錯誤')
    }
  }

  // Add a new day (and open trip form)
  const handleAddDay = () => {
    if (!settings) return
    if (settings.totalDays >= 7) {
      alert('最多只能新增 7 天')
      return
    }
    
    const newTotalDays = settings.totalDays + 1
    const newDaySchedules = [
      ...(settings.daySchedules || []),
      { dayNumber: newTotalDays, theme: `Day ${newTotalDays}` }
    ]
    
    const updatedSettings = {
      ...settings,
      totalDays: newTotalDays,
      daySchedules: newDaySchedules
    }
    
    saveSettingsAsync(updatedSettings) // Sync to Supabase
    setSettings(updatedSettings)
    
    // Switch to the new day
    setSelectedDay(newTotalDays)
    
    // Track that this is a pending new day
    setPendingNewDay(newTotalDays)
    
    // Open trip form with the new day's date
    let defaultDate = ''
    if (settings.tripStartDate) {
      const startDate = new Date(settings.tripStartDate)
      const targetDate = new Date(startDate)
      targetDate.setDate(startDate.getDate() + newTotalDays - 1)
      defaultDate = targetDate.toISOString().split('T')[0]
    }
    
    setFormData({ ...initialFormData, date: defaultDate })
    setEditingTrip(null)
    setShowTripForm(true)
    setFormMessage(null)
  }

  // Remove the last day
  const handleRemoveDay = () => {
    if (!settings || settings.totalDays <= 1) return
    
    const dayToRemove = settings.totalDays
    
    // Check if there are trips on this day
    const dayDate = getDayDate(dayToRemove)
    const tripsOnDay = trips.filter(trip => {
      const tripDate = new Date(trip.date).toISOString().split('T')[0]
      return tripDate === dayDate
    })
    
    let confirmMessage = `確定要刪除 Day ${dayToRemove} 嗎？`
    if (tripsOnDay.length > 0) {
      confirmMessage = `Day ${dayToRemove} 有 ${tripsOnDay.length} 個行程，確定要刪除此天嗎？\n（行程不會被刪除，但會被隱藏）`
    }
    
    if (!confirm(confirmMessage)) return
    
    const newTotalDays = settings.totalDays - 1
    const newDaySchedules = settings.daySchedules?.filter(d => d.dayNumber <= newTotalDays) || []
    
    const updatedSettings = {
      ...settings,
      totalDays: newTotalDays,
      daySchedules: newDaySchedules
    }
    
    saveSettingsAsync(updatedSettings) // Sync to Supabase
    setSettings(updatedSettings)
    
    // If current selected day is removed, select the last available day
    if (selectedDay > newTotalDays) {
      setSelectedDay(newTotalDays)
    }
  }

  // Handle day reorder via drag and drop
  const handleDayReorder = async (fromDay: number, toDay: number) => {
    if (!settings || fromDay === toDay) return
    
    // Get the dates for both days
    const getDateForDay = (day: number): string => {
      if (!settings.tripStartDate) return ''
      const startDate = new Date(settings.tripStartDate)
      const targetDate = new Date(startDate)
      targetDate.setDate(startDate.getDate() + day - 1)
      return targetDate.toISOString().split('T')[0]
    }
    
    const fromDate = getDateForDay(fromDay)
    const toDate = getDateForDay(toDay)
    
    // Get trips on both days
    const tripsOnFromDay = trips.filter(trip => {
      const tripDate = new Date(trip.date).toISOString().split('T')[0]
      return tripDate === fromDate
    })
    
    const tripsOnToDay = trips.filter(trip => {
      const tripDate = new Date(trip.date).toISOString().split('T')[0]
      return tripDate === toDate
    })
    
    // Update trips from fromDay to toDay's date
    for (const trip of tripsOnFromDay) {
      await updateTrip(trip.id, { date: toDate })
    }
    
    // Update trips from toDay to fromDay's date
    for (const trip of tripsOnToDay) {
      await updateTrip(trip.id, { date: fromDate })
    }
    
    // Refresh trips via TanStack Query
    await queryClient.invalidateQueries({ queryKey: queryKeys.trips })
    
    // Switch to the destination day
    setSelectedDay(toDay)
  }

  // Filter trips by selected day and sort by time
  const filteredTrips = useMemo(() => {
    if (!settings?.tripStartDate) return trips
    
    const startDate = new Date(settings.tripStartDate)
    const targetDate = new Date(startDate)
    targetDate.setDate(startDate.getDate() + selectedDay - 1)
    const targetDateStr = targetDate.toISOString().split('T')[0]
    
    const filtered = trips.filter(trip => {
      const tripDate = new Date(trip.date).toISOString().split('T')[0]
      return tripDate === targetDateStr
    })
    
    // Sort by time_start (trips without time go to the end)
    return filtered.sort((a, b) => {
      if (!a.time_start && !b.time_start) return 0
      if (!a.time_start) return 1
      if (!b.time_start) return -1
      return a.time_start.localeCompare(b.time_start)
    })
  }, [trips, settings?.tripStartDate, selectedDay])

  // Get date for a specific day
  const getDayDate = (dayNum: number) => {
    if (!settings?.tripStartDate) return ''
    const startDate = new Date(settings.tripStartDate)
    const targetDate = new Date(startDate)
    targetDate.setDate(startDate.getDate() + dayNum - 1)
    return targetDate.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
  }

  const toggleSakuraMode = () => {
    const newValue = !isSakuraMode
    setIsSakuraMode(newValue)
    if (typeof window !== 'undefined') {
      safeSetItem('sakura_mode', String(newValue))
    }
  }

  // Get user's current avatar from users list (most up-to-date)
  // Returns undefined if no avatar, so UI can show initials fallback
  const getUserAvatar = (username: string, fallbackAvatarUrl?: string): string | undefined => {
    const user = users.find(u => u.username === username)
    return user?.avatarUrl || fallbackAvatarUrl || undefined
  }

  const handleTripClick = (tripId: number) => {
    setSelectedTripId(tripId)
    // On mobile, show Airbnb-style detail view when clicking a trip
    if (window.innerWidth < 768) {
      const trip = trips.find(t => t.id === tripId)
      if (trip) {
        setDetailTrip(trip)
        setShowTripDetail(true)
      }
    }
  }

  return (
    <main className={`min-h-screen relative ${!isSakuraMode ? 'clean-mode' : ''}`}>
      {/* Sakura Animation - Only when toggled ON */}
      <SakuraCanvas enabled={isSakuraMode} />

      {/* Mode Toggle - Hidden on mobile, shown in popup */}
      <div className="hidden md:block">
        <ModeToggle isSakuraMode={isSakuraMode} onToggle={toggleSakuraMode} />
      </div>

      {/* Header - Airbnb style search */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100"
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Search Bar - Airbnb style */}
            <button
              onClick={() => setShowSearch(true)}
              className="flex-1 flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="text-lg">🔍</span>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-gray-800">搜尋地點</p>
                <p className="text-xs text-gray-400">景點、餐廳、住宿、心願清單...</p>
              </div>
            </button>
            
            {/* Desktop: Admin Control Panel Button */}
            {isActualAdmin && (
              <Link
                href="/panel"
                className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-sakura-600 hover:bg-sakura-50 rounded-full transition-colors"
              >
                <span>⚙️</span>
              </Link>
            )}
          </div>
        </div>
      </motion.header>
      
      {/* Search Overlay */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-50"
          >
            {/* Search Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowSearch(false)
                    setSearchQuery('')
                  }}
                  className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  ←
                </button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜尋地點..."
                    className="w-full px-4 py-3 bg-gray-100 rounded-full text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-sakura-200"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-gray-200 rounded-full text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Search Content */}
            <div className="p-4">
              {searchQuery ? (
                <div className="space-y-2">
                  {/* Search with Google Maps */}
                  <button
                    onClick={() => {
                      // Open map popup with search query
                      setShowSearch(false)
                      setShowMapPopup(true)
                      setActiveBottomTab('map')
                      // Store search query for map to use
                      if (typeof window !== 'undefined') {
                        safeSetItem('map_search_query', searchQuery)
                      }
                      setSearchQuery('')
                    }}
                    className="w-full flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <span className="w-10 h-10 flex items-center justify-center bg-sakura-100 text-sakura-600 rounded-full">
                      🗺️
                    </span>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-800">在地圖上搜尋「{searchQuery}」</p>
                      <p className="text-xs text-gray-500">查看位置和路線</p>
                    </div>
                    <span className="text-gray-400">→</span>
                  </button>
                  
                  {/* Search in wishlist items by title */}
                  {wishlistDbItems.filter(item => 
                    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (item.note && item.note.toLowerCase().includes(searchQuery.toLowerCase()))
                  ).map(item => (
                    <button
                      key={`wishlist-${item.id}`}
                      onClick={() => {
                        setShowSearch(false)
                        setSearchQuery('')
                        setSelectedWishlistItem(item)
                      }}
                      className="w-full flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      <span className="w-10 h-10 flex items-center justify-center bg-pink-100 text-pink-600 rounded-full">
                        {item.is_favorite ? '⭐' : '📍'}
                      </span>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.note || item.category}</p>
                      </div>
                      <span className="text-gray-400">→</span>
                    </button>
                  ))}
                  
                  {/* Search in trips */}
                  {trips.filter(trip => 
                    trip.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    trip.location.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map(trip => (
                    <button
                      key={trip.id}
                      onClick={() => {
                        setShowSearch(false)
                        setSelectedTripId(trip.id)
                        setSearchQuery('')
                        // On mobile, show trip detail; on desktop, select on map
                        if (window.innerWidth < 768) {
                          setDetailTrip(trip)
                          setShowTripDetail(true)
                        }
                      }}
                      className="w-full flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      <span className="w-10 h-10 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full">
                        📍
                      </span>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-gray-800">{trip.title}</p>
                        <p className="text-xs text-gray-500">{trip.location}</p>
                      </div>
                      <span className="text-gray-400">→</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">🔍</div>
                  <p className="text-gray-500">輸入地點名稱開始搜尋</p>
                  <p className="text-xs text-gray-400 mt-2">例如：東京塔、淺草寺、拉麵...</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="pt-[72px] md:pt-[68px] h-screen flex flex-col md:flex-row">
        {/* Sidebar - Trip List - Full height on mobile */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full h-full md:h-auto md:w-1/2 bg-white/90 backdrop-blur-sm border-r border-sakura-100 overflow-y-auto pb-24 md:pb-0"
        >
          <div className="p-4">
            {/* Home Location Card - Now at TOP with background image */}
            {settings?.homeLocation && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  const loc = settings.homeLocation
                  if (loc?.lat && loc?.lng) {
                    window.open(`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`, '_blank')
                  } else if (loc?.address) {
                    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`, '_blank')
                  }
                }}
                className={`mb-4 rounded-xl border-2 transition-all cursor-pointer overflow-hidden relative border-blue-200 hover:border-blue-300`}
              >
                {/* Background Image with Overlay */}
                {settings.homeLocation.imageUrl && (
                  <>
                    <div 
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${settings.homeLocation.imageUrl})` }}
                    />
                    <div className="absolute inset-0 bg-white/90" />
                  </>
                )}
                {/* Content */}
                <div className="relative p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🏠</span>
                    <h3 className="font-medium text-gray-800">{settings.homeLocation.name}</h3>
                  </div>
                  <p className="text-sm text-gray-500 ml-7">{settings.homeLocation.address}</p>
                  <p className="text-xs text-blue-500 ml-7 mt-1">點擊查看位置及路線</p>
                </div>
              </motion.div>
            )}

            {/* Title: 今日行程 with Pixel Heart + Add Day Button */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium text-gray-800 flex items-center gap-2">
                <PixelHeart /> 今日行程
              </h2>
              {/* Add Day Button - Admin only */}
              {isAdmin && settings && settings.totalDays < 7 && (
                <button
                  onClick={handleAddDay}
                  className="px-3 py-1.5 text-sm font-medium transition-all border-2 border-dashed border-sakura-300 rounded-lg text-sakura-400 hover:border-sakura-500 hover:text-sakura-600 hover:bg-sakura-50 flex items-center gap-1"
                  title="新增一天"
                >
                  <span>+</span>
                  <span>新增</span>
                </button>
              )}
            </div>

            {/* Day Tabs - Swipeable slider on mobile */}
            {settings && (
              <div className="relative mb-4">
                {/* Mobile: Horizontal swipeable slider */}
                <div className="md:hidden overflow-x-auto scrollbar-hide -mx-4 px-4">
                  <div className="flex gap-2 pb-1" style={{ minWidth: 'max-content' }}>
                    {Array.from({ length: settings.totalDays }, (_, i) => i + 1).map((day) => {
                      const daySchedule = settings.daySchedules?.find(d => d.dayNumber === day)
                      return (
                        <div
                          key={day}
                          onClick={() => setSelectedDay(day)}
                          className={`flex-shrink-0 w-[100px] py-2 px-3 text-sm font-medium transition-all rounded-lg cursor-pointer text-center ${
                            selectedDay === day
                              ? 'bg-sakura-500 text-white shadow-md'
                              : 'bg-sakura-50 text-sakura-600 hover:bg-sakura-100'
                          }`}
                        >
                          {/* Date + Weather Row */}
                          <div className="flex items-center justify-center gap-1 mb-0.5">
                            <span className="text-xs opacity-80 whitespace-nowrap">
                              {getDayDate(day)}
                            </span>
                            <span className="text-sm">{getWeatherIcon(day)}</span>
                          </div>
                          {/* Day Number */}
                          <div className="font-bold text-center whitespace-nowrap">Day {day}</div>
                          {/* Theme */}
                          {daySchedule?.theme && daySchedule.theme !== `Day ${day}` && (
                            <div className="text-xs mt-0.5 truncate text-center">{daySchedule.theme}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Desktop: Show all days */}
                <div className="hidden md:flex gap-1.5">
                  {Array.from({ length: Math.min(settings.totalDays, 7) }, (_, i) => i + 1).map((day) => {
                    const daySchedule = settings.daySchedules?.find(d => d.dayNumber === day)
                    return (
                      <div
                        key={day}
                        draggable={isAdmin}
                        onDragStart={(e) => {
                          if (!isAdmin) return
                          e.dataTransfer.setData('text/plain', day.toString())
                          e.currentTarget.classList.add('opacity-50')
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.classList.remove('opacity-50')
                        }}
                        onDragOver={(e) => {
                          if (!isAdmin) return
                          e.preventDefault()
                          e.currentTarget.classList.add('ring-2', 'ring-sakura-400')
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.classList.remove('ring-2', 'ring-sakura-400')
                        }}
                        onDrop={(e) => {
                          if (!isAdmin) return
                          e.preventDefault()
                          e.currentTarget.classList.remove('ring-2', 'ring-sakura-400')
                          const fromDay = parseInt(e.dataTransfer.getData('text/plain'))
                          const toDay = day
                          if (fromDay !== toDay) {
                            handleDayReorder(fromDay, toDay)
                          }
                        }}
                        onClick={() => setSelectedDay(day)}
                        className={`flex-1 py-2 px-3 text-sm font-medium transition-all border-b-2 rounded-lg relative group cursor-pointer text-center ${
                          selectedDay === day
                            ? 'bg-sakura-500 text-white border-sakura-600'
                            : 'bg-sakura-50 text-sakura-600 hover:bg-sakura-100 border-transparent'
                        } ${isAdmin ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      >
                        {/* Date + Weather Row */}
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <span className="text-xs opacity-80 whitespace-nowrap">
                            {getDayDate(day)}
                          </span>
                          <span className="text-sm">{getWeatherIcon(day)}</span>
                        </div>
                        {/* Day Number */}
                        <div className="font-bold text-center whitespace-nowrap">Day {day}</div>
                        {/* Theme */}
                        {daySchedule?.theme && daySchedule.theme !== `Day ${day}` && (
                          <div className="text-xs mt-0.5 truncate text-center max-w-[60px]">{daySchedule.theme}</div>
                        )}
                        {/* Remove button - Actual Admin only, show on last day when hovering */}
                        {isActualAdmin && day === settings.totalDays && settings.totalDays > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveDay()
                            }}
                            className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                            title="移除此天"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center py-4">
                  <div className="w-8 h-8 border-4 border-sakura-300 border-t-sakura-600 rounded-full animate-spin" />
                </div>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse rounded-xl border-2 border-sakura-100 overflow-hidden">
                    <div className="h-32 bg-sakura-100/60" />
                    <div className="p-4 space-y-3">
                      <div className="h-3 bg-sakura-100 rounded w-1/4" />
                      <div className="h-4 bg-sakura-100 rounded w-3/4" />
                      <div className="h-3 bg-sakura-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : tripsError ? (
              <div className="text-center py-8">
                <p className="text-red-500">{tripsError instanceof Error ? tripsError.message : '載入行程失敗'}</p>
              </div>
            ) : filteredTrips.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-4xl mb-4 block">🗾</span>
                <p className="text-gray-500">Day {selectedDay} 暫無行程</p>
                {isAdmin && (
                  <button
                    onClick={openAddForm}
                    className="mt-4 px-4 py-2 bg-sakura-500 hover:bg-sakura-600 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
                  >
                    <span>+</span> 新增行程
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTrips.map((trip, index) => (
                  <motion.div
                    key={trip.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => handleTripClick(trip.id)}
                    className={`rounded-xl border-2 transition-all cursor-pointer overflow-hidden ${
                      selectedTripId === trip.id
                        ? 'border-sakura-400 bg-sakura-50 shadow-md'
                        : 'border-sakura-100 bg-gradient-to-r from-sakura-50 to-white hover:border-sakura-300 hover:shadow-md'
                    }`}
                  >
                    {/* Mobile: Vertical layout / Desktop: Horizontal layout */}
                    <div className="flex flex-col md:flex-row">
                      {/* Image - Top on mobile, Right on desktop */}
                      {(() => {
                        const images = parseImages(trip.image_url)
                        if (images.length === 0) return null
                        return (
                          <div className="w-full h-32 md:w-40 md:h-32 md:order-2 flex-shrink-0 md:rounded-lg overflow-hidden md:m-3 shadow-sm">
                            <ImageSlider 
                              images={images} 
                              className="w-full h-full"
                              autoPlay={images.length > 1}
                              interval={6000}
                              hideArrows
                            />
                          </div>
                        )
                      })()}
                      
                      {/* Content */}
                      <div className="flex-1 p-4 space-y-3 md:order-1">
                        {/* Section 1: Date + Title */}
                        <div className="pb-2 border-b border-gray-100">
                          {/* Date Badge - Year/Month/Day */}
                          <span className="text-xs text-sakura-600 bg-sakura-100 px-2 py-0.5 rounded whitespace-nowrap inline-block mb-2">
                            {new Date(trip.date).toLocaleDateString('zh-TW', {
                              year: 'numeric',
                              month: 'numeric',
                              day: 'numeric',
                            })}
                          </span>
                          <h3 className="font-semibold text-lg md:text-xl text-gray-800 leading-tight">
                            {trip.title}
                          </h3>
                        </div>
                      
                        {/* Section 2: Location - Clickable to expand description */}
                        <div 
                          className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleTripExpand(trip.id)
                          }}
                        >
                          <span className="text-sakura-500">📍</span>
                          <p className="text-sm text-gray-600 truncate flex-1" style={{ maxWidth: '20em' }}>
                            {trip.location}
                          </p>
                          {trip.description && (
                            <span className={`text-gray-400 transition-transform duration-200 ${expandedTrips.includes(trip.id) ? 'rotate-180' : ''}`}>
                              ▼
                            </span>
                          )}
                        </div>
                      
                        {/* Section 3: Schedule Items - Expandable */}
                        <AnimatePresence>
                          {trip.description && expandedTrips.includes(trip.id) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="bg-white border border-gray-100 rounded-lg p-3 space-y-2">
                                {(() => {
                                  try {
                                    const items = JSON.parse(trip.description)
                                    if (Array.isArray(items)) {
                                      return items.map((item: any, idx: number) => (
                                        <div key={idx} className="flex items-start gap-2 text-sm">
                                          {(item.time_start || item.time_end) && (
                                            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded whitespace-nowrap">
                                              {item.time_start}{item.time_end ? ` - ${item.time_end}` : ''}
                                            </span>
                                          )}
                                          <span className="text-gray-600">{item.content}</span>
                                        </div>
                                      ))
                                    }
                                  } catch {
                                    // Legacy: render as HTML if not JSON
                                    return (
                                      <div 
                                        className="text-sm text-gray-500"
                                        dangerouslySetInnerHTML={{ __html: trip.description }}
                                      />
                                    )
                                  }
                                })()}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {/* Add Trip Button - Admin only, max 10 per day */}
                {isAdmin && filteredTrips.length < 10 && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={openAddForm}
                    className="w-full py-3 border-2 border-dashed border-sakura-300 rounded-xl text-sakura-500 hover:border-sakura-500 hover:bg-sakura-50 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="text-lg">+</span>
                    <span>新增行程 ({filteredTrips.length}/10)</span>
                  </motion.button>
                )}
              </div>
            )}
          </div>
        </motion.aside>

        {/* Map - Hidden on mobile, shown in popup */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="hidden md:block md:w-1/2 relative"
        >
          <GoogleMapComponent 
            trips={filteredTrips} 
            homeLocation={settings?.homeLocation}
            selectedTripId={selectedTripId}
            onTripSelect={setSelectedTripId}
          />
        </motion.div>
      </div>
      
      {/* Mobile: Airbnb-style Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {/* 行程 Tab - Active on main page */}
          <button
            onClick={() => setActiveBottomTab('home')}
            className="flex flex-col items-center justify-center flex-1 h-full text-sakura-500"
          >
            <span className="text-xl mb-0.5">📋</span>
            <span className="text-[10px] font-medium">行程</span>
          </button>
          
          {/* 心願清單 Tab */}
          <Link
            href="/wishlist"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-sakura-500 transition-colors"
          >
            <span className="text-xl mb-0.5">💖</span>
            <span className="text-[10px] font-medium">心願清單</span>
          </Link>
          
          {/* Chiikawa Tab */}
          <button
            onClick={() => {
              toggleSakuraMode()
              if (typeof window !== 'undefined') {
                safeSetItem('mode_toggle_clicked', 'true')
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
            onClick={() => {
              setActiveBottomTab('info')
              setShowInfoPopup(true)
            }}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activeBottomTab === 'info' ? 'text-sakura-500' : 'text-gray-400'
            }`}
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
      
      {/* Mobile: Map Popup */}
      <AnimatePresence>
        {showMapPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/50 z-[60]"
            onClick={() => {
              setShowMapPopup(false)
              setActiveBottomTab('home')
            }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 h-[85vh] bg-white rounded-t-3xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Popup Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h3 className="font-medium text-gray-800">地圖</h3>
                <button
                  onClick={() => {
                    setShowMapPopup(false)
                    setActiveBottomTab('home')
                  }}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  ✕
                </button>
              </div>
              
              {/* Map */}
              <div className="h-[calc(85vh-60px)]">
                <GoogleMapComponent 
                  trips={filteredTrips} 
                  homeLocation={settings?.homeLocation}
                  selectedTripId={selectedTripId}
                  onTripSelect={(id) => {
                    setSelectedTripId(id)
                    if (id === null) {
                      setShowMapPopup(false)
                      setActiveBottomTab('home')
                    }
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile: Airbnb-style Trip Detail View */}
      <AnimatePresence>
        {showTripDetail && detailTrip && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-white z-[70]"
          >
            {/* Scrollable Content */}
            <div className={`h-full overflow-y-auto ${isAdmin ? 'pb-28' : 'pb-8'}`}>
              {/* Image Section - Full Width with Overlay Buttons */}
              <div className="relative">
                {(() => {
                  const images = parseImages(detailTrip.image_url)
                  if (images.length > 0) {
                    return (
                      <div className="w-full h-[45vh] relative">
                        <ImageSlider 
                          images={images} 
                          className="w-full h-full"
                          autoPlay={false}
                          showCounter={true}
                        />
                      </div>
                    )
                  }
                  // Placeholder if no image
                  return (
                    <div className="w-full h-[30vh] bg-gradient-to-b from-sakura-100 to-sakura-50 flex items-center justify-center">
                      <span className="text-6xl">🗾</span>
                    </div>
                  )
                })()}
                
                {/* Back Button - Overlay */}
                <button
                  onClick={() => {
                    setShowTripDetail(false)
                    setDetailTrip(null)
                  }}
                  className="absolute top-4 left-4 w-9 h-9 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  ←
                </button>
                
                {/* Top Right Buttons - Show Map Popup */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <button
                    onClick={() => setShowTripMapEmbed(true)}
                    className="w-9 h-9 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    🗺️
                  </button>
                </div>
              </div>
              
              {/* Content Section */}
              <div className="px-5 py-4 space-y-4">
                {/* Date Badge */}
                <span className="inline-block text-sm text-sakura-600 bg-sakura-100 px-3 py-1 rounded-full">
                  {new Date(detailTrip.date).toLocaleDateString('zh-TW', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                </span>
                
                {/* Title */}
                <h1 className="text-2xl font-bold text-gray-800 leading-tight">
                  {detailTrip.title}
                </h1>
                
                {/* Location */}
                <div className="flex items-start gap-2 bg-gray-50 rounded-xl p-4">
                  <span className="text-xl">📍</span>
                  <div className="flex-1">
                    <p className="text-gray-700">{detailTrip.location}</p>
                    <button
                      onClick={() => setShowTripMapEmbed(true)}
                      className="text-sm text-sakura-500 mt-1 hover:underline"
                    >
                      在地圖上查看 →
                    </button>
                  </div>
                </div>
                
                {/* Divider */}
                <div className="border-t border-gray-100" />
                
                {/* Schedule Items - Always Expanded */}
                {detailTrip.description && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      <span>📋</span>
                      行程明細
                    </h3>
                    <div className="space-y-2">
                      {(() => {
                        try {
                          const items = JSON.parse(detailTrip.description)
                          if (Array.isArray(items) && items.length > 0) {
                            return items.map((item: any, idx: number) => (
                              <div 
                                key={idx} 
                                className="flex items-start gap-3 p-3 bg-white border border-gray-100 rounded-xl"
                              >
                                {(item.time_start || item.time_end) && (
                                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg whitespace-nowrap">
                                    {item.time_start}{item.time_end ? ` - ${item.time_end}` : ''}
                                  </span>
                                )}
                                <span className="text-gray-700 flex-1">{item.content}</span>
                              </div>
                            ))
                          }
                        } catch {
                          // Legacy: render as HTML if not JSON
                          return (
                            <div 
                              className="text-gray-600 bg-gray-50 rounded-xl p-4"
                              dangerouslySetInnerHTML={{ __html: detailTrip.description }}
                            />
                          )
                        }
                        return null
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Bottom Action Bar - Fixed */}
            {isAdmin && (
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 pt-3 pb-6 z-10">
                <div className="flex gap-3">
                  <button
                    onClick={(e) => {
                      setShowTripDetail(false)
                      openEditForm(detailTrip, e)
                    }}
                    className="flex-1 py-3 bg-sakura-500 hover:bg-sakura-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    ✏️ 編輯行程
                  </button>
                  <button
                    onClick={(e) => {
                      handleDeleteTrip(detailTrip.id, e)
                      setShowTripDetail(false)
                      setDetailTrip(null)
                    }}
                    className="py-3 px-4 border border-red-200 text-red-500 hover:bg-red-50 rounded-xl font-medium transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            )}
          {/* Google Maps Embed Popup - overlays on trip detail */}
          <AnimatePresence>
            {showTripMapEmbed && detailTrip && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4"
                onClick={() => setShowTripMapEmbed(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-800 truncate">📍 {detailTrip.location}</h3>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${detailTrip.lat},${detailTrip.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline whitespace-nowrap"
                      >
                        開啟 Google Maps
                      </a>
                      <button
                        onClick={() => setShowTripMapEmbed(false)}
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="aspect-[4/3]">
                    <iframe
                      src={`https://maps.google.com/maps?q=${detailTrip.lat},${detailTrip.lng}&z=16&output=embed`}
                      className="w-full h-full border-0"
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wishlist Item Detail Popup (from search) */}
      <AnimatePresence>
        {selectedWishlistItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 overscroll-none"
            style={{ touchAction: 'none' }}
            onClick={() => setSelectedWishlistItem(null)}
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
              {selectedWishlistItem.image_url && (
                <div className="relative aspect-video bg-gray-100">
                  <img
                    src={selectedWishlistItem.image_url}
                    alt={selectedWishlistItem.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => setSelectedWishlistItem(null)}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-black/50 text-white rounded-full"
                  >
                    ✕
                  </button>
                  {/* Favorite indicator */}
                  {selectedWishlistItem.is_favorite && (
                    <div className="absolute bottom-3 right-3 w-10 h-10 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full shadow-lg">
                      <span className="text-lg">❤️</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Content */}
              <div className="p-6">
                {!selectedWishlistItem.image_url && (
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => setSelectedWishlistItem(null)}
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                    >
                      ✕
                    </button>
                  </div>
                )}
                
                {/* Category badge */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                    {selectedWishlistItem.category === 'cafe' ? '☕ Cafe' :
                     selectedWishlistItem.category === 'restaurant' ? '🍽️ 餐廳' :
                     selectedWishlistItem.category === 'bakery' ? '🥐 麵包店' :
                     selectedWishlistItem.category === 'shopping' ? '🛍️ Shopping' :
                     selectedWishlistItem.category === 'park' ? '🌳 Park' :
                     selectedWishlistItem.category === 'threads' ? '🔗 Threads' :
                     selectedWishlistItem.category}
                  </span>
                </div>
                
                {/* Title */}
                <h2 className="text-xl font-semibold text-gray-800 mb-2">{selectedWishlistItem.name}</h2>
                
                {/* Note */}
                {selectedWishlistItem.note && (
                  <p className="text-gray-600 mb-4">{selectedWishlistItem.note}</p>
                )}
                
                {/* Google Maps link (not for threads) */}
                {selectedWishlistItem.category !== 'threads' && (
                  <a
                    href={selectedWishlistItem.link && (selectedWishlistItem.link.includes('google.com/maps') || selectedWishlistItem.link.includes('maps.google'))
                      ? selectedWishlistItem.link
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedWishlistItem.name + ' Japan')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-500 hover:text-blue-600 mb-4"
                  >
                    <span>🗺️</span>
                    <span>在 Google Maps 查看</span>
                  </a>
                )}
                
                {/* Custom link for threads or other links */}
                {selectedWishlistItem.link && (
                  selectedWishlistItem.category === 'threads' || 
                  !(selectedWishlistItem.link.includes('google.com/maps') || selectedWishlistItem.link.includes('maps.google'))
                ) && (
                  <a
                    href={selectedWishlistItem.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-500 hover:text-blue-600 mb-4"
                  >
                    <span>🔗</span>
                    <span className="underline truncate">{selectedWishlistItem.category === 'threads' ? selectedWishlistItem.link : '點擊連結轉跳'}</span>
                  </a>
                )}
                
                {/* Added by user info */}
                {selectedWishlistItem.added_by && (
                  <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-xl">
                    {(() => {
                      const addedByUser = users.find(u => u.username === selectedWishlistItem.added_by?.username)
                      const avatarUrl = addedByUser?.avatarUrl || selectedWishlistItem.added_by?.avatar_url
                      const displayName = addedByUser?.displayName || selectedWishlistItem.added_by?.display_name || selectedWishlistItem.added_by?.username || ''
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
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chiikawa Pet - Floating character when sakura mode is on */}
      <ChiikawaPet enabled={isSakuraMode} />

      {/* Daily Popup - Bottom Right - Hidden on mobile */}
      <div className="hidden md:block">
        <DailyPopup />
      </div>

      {/* Wishlist Button - Hidden on mobile (shown via bottom nav) */}
      <WishlistButton 
        totalDays={settings?.totalDays || 7}
        isOpen={showWishlistPopup}
        onOpenChange={(open) => {
          setShowWishlistPopup(open)
          if (!open) setActiveBottomTab('home')
        }}
        onNavigateToDay={(day) => {
          setSelectedDay(day)
          setShowWishlistPopup(false)
          setActiveBottomTab('home')
        }}
        onAddToTrip={async (item, day, time, category) => {
          // Get the date for this day
          if (!settings?.tripStartDate) return
          const startDate = new Date(settings.tripStartDate)
          const targetDate = new Date(startDate)
          targetDate.setDate(startDate.getDate() + day - 1)
          const dateStr = targetDate.toISOString().split('T')[0]
          
          // Create a new trip from wishlist item
          const categoryIcon = category === 'cafe' ? '☕' : category === 'restaurant' ? '🍽️' : category === 'shopping' ? '🛍️' : '🌳'
          const tripData = {
            title: `⭐ ${item.name}`,
            date: dateStr,
            location: item.name,
            lat: 35.6762, // Default Tokyo coordinates - will be updated when user searches
            lng: 139.6503,
            image_url: item.imageUrl ? JSON.stringify([item.imageUrl]) : undefined,
            description: JSON.stringify([{ 
              id: Date.now().toString(), 
              time_start: time, 
              time_end: '', 
              content: `${categoryIcon} ${item.note || '心願清單項目'}` 
            }]),
            time_start: time,
            time_end: undefined,
          }
          
          try {
            await createTrip(tripData)
            await queryClient.invalidateQueries({ queryKey: queryKeys.trips })
            setSelectedDay(day)
            setShowWishlistPopup(false)
            setActiveBottomTab('home')
          } catch (error) {
            console.error('Failed to create trip from wishlist:', error)
          }
        }}
      />
      
      
      {/* Mobile: Travel Notice Popup (旅遊須知) */}
      <AnimatePresence>
        {showInfoPopup && (() => {
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
            onClick={() => {
              setShowInfoPopup(false)
              setActiveBottomTab('home')
            }}
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
                  onClick={() => {
                    setShowInfoPopup(false)
                    setActiveBottomTab('home')
                  }}
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
                        const checkedUsers = checkedItems[itemKey] || []
                        const anyoneChecked = checkedUsers.length > 0
                        const allUsersChecked = users.length > 0 && checkedUsers.length >= users.length
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
                              {checkedUsers.length > 0 && (
                                <div className="flex -space-x-1 mr-0.5">
                                  {checkedUsers.slice(0, 3).map((user, i) => {
                                    const userObj = users.find(u => u.username === user.username)
                                    const avatarUrl = userObj?.avatarUrl || user.avatarUrl
                                    return avatarUrl ? (
                                      <img 
                                        key={i}
                                        src={avatarUrl} 
                                        alt={user.displayName}
                                        className="w-5 h-5 rounded-full border border-white object-cover shadow-sm"
                                        style={{ zIndex: checkedUsers.length - i }}
                                        title={user.displayName}
                                      />
                                    ) : (
                                      <div 
                                        key={i}
                                        className="w-5 h-5 rounded-full bg-green-200 border border-white shadow-sm flex items-center justify-center text-[8px] text-green-700 font-medium"
                                        style={{ zIndex: checkedUsers.length - i }}
                                        title={user.displayName}
                                      >
                                        {user.displayName?.charAt(0).toUpperCase() || user.username.charAt(0).toUpperCase()}
                                      </div>
                                    )
                                  })}
                                  {checkedUsers.length > 3 && (
                                    <div className="w-5 h-5 rounded-full bg-gray-200 border border-white shadow-sm flex items-center justify-center text-[8px] text-gray-600 font-medium">
                                      +{checkedUsers.length - 3}
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
                        const checkedUsers = checkedItems[itemKey] || []
                        const anyoneChecked = checkedUsers.length > 0
                        const allUsersChecked = users.length > 0 && checkedUsers.length >= users.length
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
                              {checkedUsers.length > 0 && (
                                <div className="flex -space-x-1 mr-0.5">
                                  {checkedUsers.slice(0, 3).map((user, i) => {
                                    const userObj = users.find(u => u.username === user.username)
                                    const avatarUrl = userObj?.avatarUrl || user.avatarUrl
                                    return avatarUrl ? (
                                      <img 
                                        key={i}
                                        src={avatarUrl} 
                                        alt={user.displayName}
                                        className="w-5 h-5 rounded-full border border-white object-cover shadow-sm"
                                        style={{ zIndex: checkedUsers.length - i }}
                                        title={user.displayName}
                                      />
                                    ) : (
                                      <div 
                                        key={i}
                                        className="w-5 h-5 rounded-full bg-green-200 border border-white shadow-sm flex items-center justify-center text-[8px] text-green-700 font-medium"
                                        style={{ zIndex: checkedUsers.length - i }}
                                        title={user.displayName}
                                      >
                                        {user.displayName?.charAt(0).toUpperCase() || user.username.charAt(0).toUpperCase()}
                                      </div>
                                    )
                                  })}
                                  {checkedUsers.length > 3 && (
                                    <div className="w-5 h-5 rounded-full bg-gray-200 border border-white shadow-sm flex items-center justify-center text-[8px] text-gray-600 font-medium">
                                      +{checkedUsers.length - 3}
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
                    <p className="text-xs text-gray-400 mt-2">可在控制台設定旅遊須知</p>
                  </div>
                )}
                
              </div>
              
              {/* Action Button */}
              <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t border-gray-100 bg-white">
                <button
                  onClick={() => {
                    setShowInfoPopup(false)
                    setActiveBottomTab('home')
                  }}
                  className="w-full py-3 bg-sakura-500 hover:bg-sakura-600 text-white rounded-xl font-medium transition-colors"
                >
                  知道了！
                </button>
              </div>
            </motion.div>
          </motion.div>
        )})()}
      </AnimatePresence>

      {/* Trip Form Modal */}
      <AnimatePresence>
        {showTripForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeForm()
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-lg max-h-[80vh] md:max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Fixed Header */}
              <div className="p-4 md:p-6 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-lg font-medium text-gray-800">
                    {editingTrip ? '編輯行程' : pendingNewDay ? `Day ${pendingNewDay} 新增行程` : '新增行程'}
                  </h3>
                  {pendingNewDay && (
                    <p className="text-xs text-sakura-500 mt-1">取消將會移除 Day {pendingNewDay}</p>
                  )}
                </div>
                <button
                  onClick={closeForm}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Form Message */}
              {formMessage && (
                <div className={`mx-4 md:mx-6 mt-4 px-4 py-2 rounded-lg text-sm flex-shrink-0 ${
                  formMessage.type === 'success' 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {formMessage.text}
                </div>
              )}

              {showPlacePicker ? (
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                  <PlacePicker
                    value={{
                      location: formData.location,
                      lat: formData.lat,
                      lng: formData.lng,
                    }}
                    onChange={handlePlaceSelect}
                    onClose={() => setShowPlacePicker(false)}
                  />
                </div>
              ) : (
                <>
                  {/* Scrollable Form Content */}
                  <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    {/* Title */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        標題 *
                      </label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none"
                        required
                      />
                    </div>

                    {/* Date */}
                    <div className="overflow-hidden">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        日期 *
                      </label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full max-w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none box-border"
                        required
                      />
                    </div>

                    {/* Location */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        地點 *
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.location}
                          readOnly
                          placeholder="點擊選擇地點..."
                          className="flex-1 px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 cursor-pointer"
                          onClick={() => setShowPlacePicker(true)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPlacePicker(true)}
                          className="px-4 py-2 bg-sakura-100 hover:bg-sakura-200 text-sakura-700 rounded-lg transition-colors"
                        >
                          📍
                        </button>
                      </div>
                    </div>

                    {/* Images */}
                    <MultiMediaUpload
                      label="圖片（選填）"
                      value={formData.images}
                      onChange={(urls) => setFormData(prev => ({ ...prev, images: urls }))}
                      maxImages={5}
                    />

                    {/* Schedule Items - Point Form List */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        行程明細
                      </label>
                      <div className="space-y-3">
                        {scheduleItems.map((item, index) => (
                          <div key={item.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-xs font-medium text-gray-500 bg-white px-2 py-0.5 rounded">
                                #{index + 1}
                              </span>
                              {/* Time Range for this item */}
                              <input
                                type="time"
                                value={item.time_start}
                                onChange={(e) => {
                                  const newItems = [...scheduleItems]
                                  newItems[index].time_start = e.target.value
                                  setScheduleItems(newItems)
                                }}
                                className="px-2 py-1 text-sm rounded border border-gray-200 focus:border-sakura-400 focus:ring-1 focus:ring-sakura-100 outline-none w-[90px]"
                                placeholder="開始"
                              />
                              <span className="text-gray-400 text-sm">至</span>
                              <input
                                type="time"
                                value={item.time_end}
                                onChange={(e) => {
                                  const newItems = [...scheduleItems]
                                  newItems[index].time_end = e.target.value
                                  setScheduleItems(newItems)
                                }}
                                className="px-2 py-1 text-sm rounded border border-gray-200 focus:border-sakura-400 focus:ring-1 focus:ring-sakura-100 outline-none w-[90px]"
                                placeholder="結束"
                              />
                              {/* Delete button (only show if more than 1 item) */}
                              {scheduleItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setScheduleItems(scheduleItems.filter((_, i) => i !== index))
                                  }}
                                  className="ml-auto text-red-400 hover:text-red-600 transition-colors p-1"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                            {/* Content */}
                            <input
                              type="text"
                              value={item.content}
                              onChange={(e) => {
                                const newItems = [...scheduleItems]
                                newItems[index].content = e.target.value
                                setScheduleItems(newItems)
                              }}
                              placeholder="輸入內容..."
                              className="w-full px-3 py-2 rounded border border-gray-200 focus:border-sakura-400 focus:ring-1 focus:ring-sakura-100 outline-none text-sm"
                            />
                          </div>
                        ))}
                        {/* Add Item Button */}
                        <button
                          type="button"
                          onClick={() => setScheduleItems([...scheduleItems, createEmptyScheduleItem()])}
                          className="w-full py-2 border-2 border-dashed border-gray-300 hover:border-sakura-400 text-gray-500 hover:text-sakura-600 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <span className="text-lg">+</span>
                          <span className="text-sm">新增項目</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Fixed Footer with Submit Buttons */}
                  <div className="p-4 md:p-6 border-t border-gray-100 flex-shrink-0 bg-white safe-area-bottom">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={closeForm}
                        className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleFormSubmit}
                        disabled={isSubmitting || !formData.location}
                        className="flex-1 py-2.5 bg-sakura-500 hover:bg-sakura-600 disabled:bg-sakura-300 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            處理中...
                          </>
                        ) : editingTrip ? (
                          '更新'
                        ) : (
                          '新增'
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Copyright */}
      <div className="fixed bottom-1 md:bottom-2 left-0 right-0 text-center pointer-events-none z-10">
        <p className="text-[10px] text-gray-400/60">
          ©RACFONG CO., LTD.
        </p>
      </div>
    </main>
  )
}
