'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { getTrips, createTrip, updateTrip, deleteTrip, type Trip } from '@/lib/supabase'
import { getSettings, saveSettings, type SiteSettings } from '@/lib/settings'
import { isAuthenticated } from '@/lib/auth'
import SakuraCanvas from '@/components/SakuraCanvas'
import ChiikawaPet from '@/components/ChiikawaPet'
import DailyPopup from '@/components/DailyPopup'
import ModeToggle from '@/components/ModeToggle'
import MediaUpload from '@/components/MediaUpload'
import { useLanguage } from '@/lib/i18n'

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

// Form data type
type TripFormData = {
  title: string
  date: string
  time_start: string
  time_end: string
  description: string
  location: string
  lat: number
  lng: number
  image_url: string
}

const initialFormData: TripFormData = {
  title: '',
  date: '',
  time_start: '',
  time_end: '',
  description: '',
  location: '',
  lat: 35.6762,
  lng: 139.6503,
  image_url: '',
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
  const [trips, setTrips] = useState<Trip[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSakuraMode, setIsSakuraMode] = useState(false) // Default OFF
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null)
  const [selectedDay, setSelectedDay] = useState<number>(1)
  const { t } = useLanguage()
  
  // Trip form state
  const [showTripForm, setShowTripForm] = useState(false)
  const [showPlacePicker, setShowPlacePicker] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [formData, setFormData] = useState<TripFormData>(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  // Inline date editing state
  const [editingDateDay, setEditingDateDay] = useState<number | null>(null)
  
  // Track pending new day (when adding a day, we need to also add a trip)
  const [pendingNewDay, setPendingNewDay] = useState<number | null>(null)
  
  // Track expanded trip descriptions
  const [expandedTrips, setExpandedTrips] = useState<number[]>([])
  
  // Check if user is admin
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Mobile map popup state
  const [showMapPopup, setShowMapPopup] = useState(false)
  
  useEffect(() => {
    setIsAdmin(isAuthenticated())
  }, [])

  useEffect(() => {
    // Load settings
    const loadedSettings = getSettings()
    setSettings(loadedSettings)
    
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

    async function fetchTrips() {
      try {
        const data = await getTrips()
        setTrips(data)
      } catch (err) {
        console.error('Failed to fetch trips:', err)
        setError('載入行程失敗')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTrips()
    const interval = setInterval(fetchTrips, 30000)
    return () => clearInterval(interval)
  }, [])

  // Fetch trips function (for refreshing after add/edit)
  const fetchTrips = async () => {
    try {
      const data = await getTrips()
      setTrips(data)
    } catch (err) {
      console.error('Failed to fetch trips:', err)
    }
  }
  
  // Toggle trip description expansion
  const toggleTripExpand = (tripId: number) => {
    setExpandedTrips(prev => 
      prev.includes(tripId) 
        ? prev.filter(id => id !== tripId)
        : [...prev, tripId]
    )
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
      time_start: trip.time_start || '',
      time_end: trip.time_end || '',
      description: trip.description,
      location: trip.location,
      lat: trip.lat,
      lng: trip.lng,
      image_url: trip.image_url || '',
    })
    setEditingTrip(trip)
    setShowTripForm(true)
    setFormMessage(null)
  }

  // Close form
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
      
      saveSettings(revertedSettings)
      setSettings(revertedSettings)
      setSelectedDay(Math.min(selectedDay, previousTotalDays))
      setPendingNewDay(null)
    }
    
    setShowTripForm(false)
    setShowPlacePicker(false)
    setEditingTrip(null)
    setFormData(initialFormData)
    setFormMessage(null)
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
      const tripData = {
        title: formData.title,
        date: formData.date,
        time_start: formData.time_start || undefined,
        time_end: formData.time_end || undefined,
        description: formData.description,
        location: formData.location,
        lat: formData.lat,
        lng: formData.lng,
        image_url: formData.image_url || undefined,
      }

      if (editingTrip) {
        const { data, error } = await updateTrip(editingTrip.id, tripData)
        if (data) {
          setFormMessage({ type: 'success', text: '行程已更新！' })
          await fetchTrips()
          // Clear pending new day before closing (so it doesn't get cancelled)
          setPendingNewDay(null)
          setTimeout(closeForm, 1000)
        } else {
          setFormMessage({ type: 'error', text: error || '更新失敗' })
        }
      } else {
        const { data, error } = await createTrip(tripData)
        if (data) {
          setFormMessage({ type: 'success', text: '行程已新增！' })
          await fetchTrips()
          // Clear pending new day before closing (so it doesn't get cancelled)
          setPendingNewDay(null)
          setTimeout(closeForm, 1000)
        } else {
          setFormMessage({ type: 'error', text: error || '新增失敗' })
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
      const { success, error } = await deleteTrip(tripId)
      if (success) {
        await fetchTrips()
      } else {
        alert(error || '刪除失敗')
      }
    } catch (err: any) {
      alert(err.message || '發生錯誤')
    }
  }

  // Add a new day (and open trip form)
  const handleAddDay = () => {
    if (!settings) return
    if (settings.totalDays >= 14) {
      alert('最多只能新增 14 天')
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
    
    saveSettings(updatedSettings)
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
    
    const newTotalDays = settings.totalDays - 1
    const newDaySchedules = settings.daySchedules?.filter(d => d.dayNumber <= newTotalDays) || []
    
    const updatedSettings = {
      ...settings,
      totalDays: newTotalDays,
      daySchedules: newDaySchedules
    }
    
    saveSettings(updatedSettings)
    setSettings(updatedSettings)
    
    // If current selected day is removed, select the last available day
    if (selectedDay > newTotalDays) {
      setSelectedDay(newTotalDays)
    }
  }

  // Handle inline date change
  const handleDateChange = (dayNum: number, newDate: string) => {
    if (!settings || !newDate) return
    
    // Calculate new start date based on which day was changed
    const selectedDate = new Date(newDate)
    const newStartDate = new Date(selectedDate)
    newStartDate.setDate(selectedDate.getDate() - (dayNum - 1))
    
    const updatedSettings = {
      ...settings,
      tripStartDate: newStartDate.toISOString().split('T')[0]
    }
    
    saveSettings(updatedSettings)
    setSettings(updatedSettings)
    setEditingDateDay(null)
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
    setIsSakuraMode(!isSakuraMode)
  }

  const handleTripClick = (tripId: number) => {
    setSelectedTripId(tripId)
    // On mobile, show map popup when clicking a trip
    if (window.innerWidth < 768) {
      setShowMapPopup(true)
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

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-sakura-100"
      >
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌸</span>
            <h1 className="text-xl font-medium text-gray-800">
              <span className="text-sakura-500">{settings?.title || '日本旅遊'}</span>
            </h1>
          </div>
          
          <nav className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {trips.length} 個{t.main.destinations.toLowerCase()}
            </span>
            {/* Admin Button */}
            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-sakura-600 hover:bg-sakura-50 rounded-lg transition-colors"
            >
              <span>⚙️</span>
              <span className="hidden sm:inline">管理</span>
            </Link>
          </nav>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="pt-16 h-screen flex flex-col md:flex-row">
        {/* Sidebar - Trip List - Full height on mobile */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full h-full md:h-auto md:w-1/2 bg-white/90 backdrop-blur-sm border-r border-sakura-100 overflow-y-auto pb-20 md:pb-0"
        >
          <div className="p-4">
            {/* Home Location Card - Now at TOP */}
            {settings?.homeLocation && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  setSelectedTripId(-1) // -1 for home
                  if (window.innerWidth < 768) {
                    setShowMapPopup(true)
                  }
                }}
                className={`mb-4 rounded-xl border-2 transition-all cursor-pointer overflow-hidden ${
                  selectedTripId === -1 
                    ? 'border-blue-400 bg-blue-50' 
                    : 'border-blue-200 bg-gradient-to-r from-blue-50 to-white hover:border-blue-300'
                }`}
              >
                <div className="flex items-center">
                  {/* Content */}
                  <div className="flex-1 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🏠</span>
                      <h3 className="font-medium text-gray-800">{settings.homeLocation.name}</h3>
                    </div>
                    <p className="text-sm text-gray-500 ml-7">{settings.homeLocation.address}</p>
                    <p className="text-xs text-blue-500 ml-7 mt-1">點擊查看位置及路線</p>
                  </div>
                  {/* Image */}
                  {settings.homeLocation.imageUrl && (
                    <div className="w-20 h-20 flex-shrink-0 mr-4">
                      <img 
                        src={settings.homeLocation.imageUrl} 
                        alt={settings.homeLocation.name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Title: 今日行程 with Pixel Heart */}
            <h2 className="text-lg font-medium text-gray-800 mb-3 flex items-center gap-2">
              <PixelHeart /> 今日行程
            </h2>

            {/* Day Tabs - Scrollable if more than 7 days */}
            {settings && (
              <div className="relative mb-4">
                {/* Scroll hint arrows */}
                {settings.totalDays > 7 && (
                  <>
                    <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
                    <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
                  </>
                )}
                <div 
                  className={`flex gap-1 ${settings.totalDays > 6 ? 'overflow-x-auto pb-2 day-tabs-scroll snap-x snap-mandatory' : ''}`}
                >
                  {/* Day Tabs */}
                  {Array.from({ length: settings.totalDays }, (_, i) => i + 1).map((day) => {
                    const daySchedule = settings.daySchedules?.find(d => d.dayNumber === day)
                    const tabCount = settings.totalDays + 1 // +1 for add button
                    const tabWidth = tabCount <= 7 
                      ? `calc((100% - ${tabCount * 4}px) / ${tabCount})` 
                      : '100px'
                    return (
                      <div
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        style={{ 
                          width: tabWidth,
                          minWidth: tabCount > 7 ? '100px' : '60px',
                          flexShrink: tabCount <= 7 ? 0 : undefined
                        }}
                        className={`py-2 px-2 text-sm font-medium transition-all border-b-2 rounded-lg snap-start relative group cursor-pointer text-center ${
                          selectedDay === day
                            ? 'bg-sakura-500 text-white border-sakura-600'
                            : 'bg-sakura-50 text-sakura-600 hover:bg-sakura-100 border-transparent'
                        }`}
                      >
                        {/* Date + Weather Row */}
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          {isAdmin && editingDateDay === day ? (
                            <input
                              type="date"
                              defaultValue={(() => {
                                if (!settings?.tripStartDate) return ''
                                const startDate = new Date(settings.tripStartDate)
                                const targetDate = new Date(startDate)
                                targetDate.setDate(startDate.getDate() + day - 1)
                                return targetDate.toISOString().split('T')[0]
                              })()}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleDateChange(day, e.target.value)}
                              onBlur={() => setEditingDateDay(null)}
                              autoFocus
                              className="w-24 text-xs px-1 py-0.5 rounded border border-white/50 bg-white/20 text-inherit outline-none"
                            />
                          ) : (
                            <span 
                              className={`text-xs opacity-80 ${isAdmin ? 'hover:opacity-100 hover:underline cursor-pointer' : ''}`}
                              onClick={(e) => {
                                if (!isAdmin) return
                                e.stopPropagation()
                                setEditingDateDay(day)
                              }}
                              title={isAdmin ? "點擊修改日期" : undefined}
                            >
                              {getDayDate(day)}
                            </span>
                          )}
                          <span>{getWeatherIcon(day)}</span>
                        </div>
                        {/* Day Number - Centered */}
                        <div className="font-bold text-center">Day {day}</div>
                        {/* Theme */}
                        {daySchedule?.theme && daySchedule.theme !== `Day ${day}` && (
                          <div className="text-xs mt-0.5 truncate text-center">{daySchedule.theme}</div>
                        )}
                        {/* Remove button - Admin only, show on last day when hovering */}
                        {isAdmin && day === settings.totalDays && settings.totalDays > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveDay()
                            }}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                            title="移除此天"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )
                  })}
                  
                  {/* Add Day Button - Admin only */}
                  {isAdmin && settings.totalDays < 14 && (
                    <button
                      onClick={handleAddDay}
                      style={{ 
                        width: settings.totalDays + 1 <= 7 
                          ? `calc((100% - ${(settings.totalDays + 1) * 4}px) / ${settings.totalDays + 1})` 
                          : '60px',
                        minWidth: '50px',
                        flexShrink: settings.totalDays + 1 <= 7 ? 0 : undefined
                      }}
                      className="py-2 px-2 text-sm font-medium transition-all border-2 border-dashed border-sakura-300 rounded-lg text-sakura-400 hover:border-sakura-500 hover:text-sakura-600 hover:bg-sakura-50 flex flex-col items-center justify-center snap-start"
                      title="新增一天"
                    >
                      <span className="text-xl">+</span>
                      <span className="text-xs">新增</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-24 bg-sakura-100 rounded-xl" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-500">{error}</p>
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
                    {/* Trip Image */}
                    {trip.image_url && (
                      <div className="h-32 w-full overflow-hidden">
                        <img 
                          src={trip.image_url} 
                          alt={trip.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4 space-y-3">
                      {/* Section 1: Title + Time/Date - Primary emphasis */}
                      <div className="pb-2 border-b border-gray-100">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-lg text-gray-800 leading-tight">
                            {trip.title}
                          </h3>
                          <div className="flex flex-col items-end gap-1">
                            {/* Time Badge */}
                            {trip.time_start && (
                              <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2.5 py-1 rounded-md whitespace-nowrap">
                                🕐 {trip.time_start}{trip.time_end ? ` - ${trip.time_end}` : ''}
                              </span>
                            )}
                            {/* Date Badge */}
                            <span className="text-xs text-sakura-600 bg-sakura-100 px-2 py-0.5 rounded whitespace-nowrap">
                              {new Date(trip.date).toLocaleDateString('zh-TW', {
                                month: 'numeric',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>
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
                      
                      {/* Section 3: Description - Expandable */}
                      <AnimatePresence>
                        {trip.description && expandedTrips.includes(trip.id) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div 
                              className="text-sm text-gray-500 bg-white border border-gray-100 rounded-lg px-3 py-2"
                              dangerouslySetInnerHTML={{ __html: trip.description }}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      {/* Actions - Admin only */}
                      {isAdmin && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={(e) => openEditForm(trip, e)}
                            className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 border border-blue-100"
                          >
                            ✏️ 編輯
                          </button>
                          <button
                            onClick={(e) => handleDeleteTrip(trip.id, e)}
                            className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 border border-red-100"
                          >
                            🗑️ 刪除
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
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
      
      {/* Mobile: Floating Map Button */}
      <div className="md:hidden fixed bottom-6 left-6 z-50 flex flex-col gap-2">
        {/* Map Toggle Button */}
        <button
          onClick={() => setShowMapPopup(true)}
          className="w-14 h-14 bg-sakura-500 hover:bg-sakura-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105"
        >
          <span className="text-2xl">🗺️</span>
        </button>
        
        {/* Mode Toggle Button */}
        <button
          onClick={toggleSakuraMode}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 ${
            isSakuraMode 
              ? 'bg-pink-400 hover:bg-pink-500' 
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <span className="text-2xl">{isSakuraMode ? '🌸' : '🔘'}</span>
        </button>
      </div>
      
      {/* Mobile: Map Popup */}
      <AnimatePresence>
        {showMapPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowMapPopup(false)}
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
                <div className="flex items-center gap-3">
                  {/* Mode Toggle in Popup */}
                  <button
                    onClick={toggleSakuraMode}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      isSakuraMode 
                        ? 'bg-pink-100 text-pink-600' 
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {isSakuraMode ? '🌸 櫻花' : '一般'}
                  </button>
                  <button
                    onClick={() => setShowMapPopup(false)}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    ✕
                  </button>
                </div>
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
                    }
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chiikawa Pet - Floating character when sakura mode is on */}
      <ChiikawaPet enabled={isSakuraMode} />

      {/* Daily Popup - Bottom Right */}
      <DailyPopup />

      {/* Trip Form Modal */}
      <AnimatePresence>
        {showTripForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeForm()
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
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
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>

              {/* Form Message */}
              {formMessage && (
                <div className={`mx-6 mt-4 px-4 py-2 rounded-lg text-sm ${
                  formMessage.type === 'success' 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {formMessage.text}
                </div>
              )}

              {showPlacePicker ? (
                <div className="p-6">
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
                <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      日期 *
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none"
                      required
                    />
                  </div>

                  {/* Time Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      時間（選填）
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={formData.time_start}
                        onChange={(e) => setFormData(prev => ({ ...prev, time_start: e.target.value }))}
                        className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none"
                        placeholder="開始時間"
                      />
                      <span className="text-gray-400">至</span>
                      <input
                        type="time"
                        value={formData.time_end}
                        onChange={(e) => setFormData(prev => ({ ...prev, time_end: e.target.value }))}
                        className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none"
                        placeholder="結束時間"
                      />
                    </div>
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

                  {/* Image */}
                  <MediaUpload
                    label="圖片（選填）"
                    value={formData.image_url}
                    onChange={(url) => setFormData(prev => ({ ...prev, image_url: url }))}
                  />

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      描述
                    </label>
                    <RichTextEditor
                      value={formData.description}
                      onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
                      placeholder="輸入描述..."
                    />
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={closeForm}
                      className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !formData.location}
                      className="flex-1 py-2 bg-sakura-500 hover:bg-sakura-600 disabled:bg-sakura-300 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
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
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
