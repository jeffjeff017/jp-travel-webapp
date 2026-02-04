'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import SakuraCanvas from '@/components/SakuraCanvas'
import ChiikawaPet from '@/components/ChiikawaPet'
import { logout, canAccessAdmin, isAdmin, isAuthenticated, getCurrentUser, getUsers, getUsersAsync, updateUser, updateUserAsync, deleteUser, deleteUserAsync, type User, type UserRole } from '@/lib/auth'
import {
  getTrips,
  createTrip,
  updateTrip,
  deleteTrip,
  type Trip,
  type DestinationDB,
  DEFAULT_DESTINATIONS,
  saveSupabaseDestination,
  deleteSupabaseDestination,
  getSupabaseWishlistItems,
  updateSupabaseWishlistItem,
  deleteSupabaseWishlistItem,
  type WishlistItemDB,
  // Wallet/Expense
  type ExpenseDB,
  type ExpenseCategory,
  type WalletSettingsDB,
  EXPENSE_CATEGORIES,
  USER_COLORS,
  getSupabaseExpenses,
  createSupabaseExpense,
  updateSupabaseExpense,
  deleteSupabaseExpense,
  getSupabaseWalletSettings,
  saveSupabaseWalletSettings,
} from '@/lib/supabase'
import { 
  getSettings, 
  getSettingsAsync, 
  saveSettings, 
  saveSettingsAsync, 
  type SiteSettings, 
  type TravelNoticeItem, 
  defaultTravelEssentials, 
  defaultTravelPreparations,
  getCurrentDestination,
  setCurrentDestination,
  getDestinations,
  getDestinationsAsync,
} from '@/lib/settings'
import { useLanguage } from '@/lib/i18n'
import LanguageSwitch from '@/components/LanguageSwitch'
import MediaUpload from '@/components/MediaUpload'
import MultiMediaUpload from '@/components/MultiMediaUpload'

const PlacePicker = dynamic(() => import('@/components/PlacePicker'), {
  ssr: false,
  loading: () => (
    <div className="p-4 text-center">
      <div className="w-8 h-8 border-4 border-sakura-300 border-t-sakura-600 rounded-full animate-spin mx-auto" />
    </div>
  ),
})

// Schedule item type
type ScheduleItem = {
  id: string
  time_start: string
  time_end: string
  content: string
}

type FormData = {
  title: string
  date: string
  location: string
  lat: number
  lng: number
  images: string[]
  scheduleItems: ScheduleItem[]
}

const createEmptyScheduleItem = (): ScheduleItem => ({
  id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
  time_start: '',
  time_end: '',
  content: ''
})

const initialFormData: FormData = {
  title: '',
  date: '',
  location: '',
  lat: 35.6762,
  lng: 139.6503,
  images: [],
  scheduleItems: [createEmptyScheduleItem()]
}

// Helper to parse images from image_url field
const parseImages = (imageUrl: string | undefined): string[] => {
  if (!imageUrl) return []
  try {
    const parsed = JSON.parse(imageUrl)
    if (Array.isArray(parsed)) return parsed
  } catch {
    if (imageUrl.trim()) return [imageUrl]
  }
  return []
}

// Helper to parse schedule items from description field
const parseScheduleItems = (description: string | undefined): ScheduleItem[] => {
  if (!description) return [createEmptyScheduleItem()]
  try {
    const parsed = JSON.parse(description)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: any) => ({
        id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
        time_start: item.time_start || '',
        time_end: item.time_end || '',
        content: item.content || ''
      }))
    }
  } catch {
    // Legacy: plain text - convert to single item
    return [{
      id: Date.now().toString(),
      time_start: '',
      time_end: '',
      content: description
    }]
  }
  return [createEmptyScheduleItem()]
}

export default function AdminPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showPlacePicker, setShowPlacePicker] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null)
  const [settingsForm, setSettingsForm] = useState({ 
    title: '',
    tripStartDate: '',
    totalDays: 3,
    daySchedules: [] as { dayNumber: number; theme: string; imageUrl?: string }[],
    homeLocationImageUrl: ''
  })
  // User management state
  const [showUserManagement, setShowUserManagement] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userForm, setUserForm] = useState({ username: '', password: '', displayName: '', role: 'user' as UserRole, avatarUrl: '' })
  // Travel notice state
  const [showTravelNotice, setShowTravelNotice] = useState(false)
  const [showTravelNoticePopup, setShowTravelNoticePopup] = useState(false) // Mobile read-only popup
  const [travelEssentials, setTravelEssentials] = useState<TravelNoticeItem[]>([])
  // Checklist state for travel notice
  const [checkedItems, setCheckedItems] = useState<Record<string, { username: string; displayName: string; avatarUrl?: string }[]>>({})
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string; displayName: string; avatarUrl?: string } | null>(null)
  const [travelPreparations, setTravelPreparations] = useState<TravelNoticeItem[]>([])
  const [newItemText, setNewItemText] = useState('')
  const [newItemIcon, setNewItemIcon] = useState('📌')
  const [editingNoticeType, setEditingNoticeType] = useState<'essentials' | 'preparations'>('essentials')
  // reCAPTCHA state
  const [recaptchaEnabled, setRecaptchaEnabled] = useState(false)
  // Destination state
  const [currentDestinationId, setCurrentDestinationId] = useState<string>('japan')
  const [destinations, setDestinations] = useState<DestinationDB[]>([])
  const [showDestinationModal, setShowDestinationModal] = useState(false)
  const [editingDestination, setEditingDestination] = useState<DestinationDB | null>(null)
  const [destinationForm, setDestinationForm] = useState({
    id: '',
    name: '',
    name_en: '',
    flag: '',
    primaryHex: '#F472B6',
    emoji: '',
  })
  // Trash bin state
  const [showTrashBin, setShowTrashBin] = useState(false)
  // Expanded days state for trip grouping
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set())
  // Wishlist management state
  const [showWishlistManagement, setShowWishlistManagement] = useState(false)
  const [wishlistItems, setWishlistItems] = useState<WishlistItemDB[]>([])
  const [editingWishlistItem, setEditingWishlistItem] = useState<WishlistItemDB | null>(null)
  const [wishlistSearchQuery, setWishlistSearchQuery] = useState('')
  // Chiikawa widget dialogue state
  const [showChiikawaEdit, setShowChiikawaEdit] = useState(false)
  const [chiikawaMessages, setChiikawaMessages] = useState<{
    chiikawa: string[]
    hachiware: string[]
    usagi: string[]
  }>({
    chiikawa: ['呀哈！ヤハ！', '噗嚕嚕嚕嚕！プルルルル！', '嗚拉！ウラ！', '哈？ハァ？'],
    hachiware: ['チャリメラ〜 查露麵拉～', 'わははは！おかしいね！哇哈哈哈！太有趣了吧！'],
    usagi: ['ウンッ！嗯！', 'ワッ！ワッ！哇！哇！'],
  })
  const [newChiikawaMessage, setNewChiikawaMessage] = useState('')
  const [editingCharacter, setEditingCharacter] = useState<'chiikawa' | 'hachiware' | 'usagi'>('chiikawa')
  // Sakura mode state (synced with localStorage)
  const [isSakuraMode, setIsSakuraMode] = useState(false)
  const [isAdminUser, setIsAdminUser] = useState(false)
  // Travel Wallet state
  const [showWallet, setShowWallet] = useState(false)
  const [walletTab, setWalletTab] = useState<'personal' | 'shared'>('shared')
  const [personalExpenses, setPersonalExpenses] = useState<ExpenseDB[]>([])
  const [sharedExpenses, setSharedExpenses] = useState<ExpenseDB[]>([])
  const [walletSettings, setWalletSettings] = useState<WalletSettingsDB | null>(null)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseDB | null>(null)
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    category: 'food' as ExpenseCategory,
    note: '',
  })
  const [budgetForm, setBudgetForm] = useState({ amount: '' })
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [trashItems, setTrashItems] = useState<{
    trips: Trip[]
    users: User[]
    destinations: DestinationDB[]
  }>({ trips: [], users: [], destinations: [] })
  const [trashTab, setTrashTab] = useState<'trips' | 'users' | 'destinations'>('trips')
  const router = useRouter()
  const { t } = useLanguage()
  
  // Load trash from localStorage
  useEffect(() => {
    const savedTrash = localStorage.getItem('admin_trash_bin')
    if (savedTrash) {
      try {
        setTrashItems(JSON.parse(savedTrash))
      } catch (e) {
        console.error('Failed to parse trash:', e)
      }
    }
    // Load sakura mode from localStorage
    const savedSakuraMode = localStorage.getItem('sakura_mode')
    if (savedSakuraMode === 'true') {
      setIsSakuraMode(true)
    }
    // Check if user is admin
    setIsAdminUser(isAdmin())
    // Load current user
    setCurrentUser(getCurrentUser())
    // Load checked travel notice items from localStorage
    const savedCheckedItems = localStorage.getItem('travel_notice_checked')
    if (savedCheckedItems) {
      try {
        setCheckedItems(JSON.parse(savedCheckedItems))
      } catch (e) {
        console.error('Failed to parse checked items:', e)
      }
    }
  }, [])
  
  // Generate random avatar URL based on username
  const getRandomAvatar = (username: string) => {
    return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(username)}&backgroundColor=ffdfbf,ffd5dc,d1d4f9,c0aede`
  }
  
  // Toggle travel notice item check
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
        // User already checked, remove them
        newUsers = currentUsers.filter(u => u.username !== currentUser.username)
      } else {
        // User not checked, add them
        newUsers = [...currentUsers, user]
      }
      
      const newCheckedItems = { ...prev, [itemKey]: newUsers }
      localStorage.setItem('travel_notice_checked', JSON.stringify(newCheckedItems))
      return newCheckedItems
    })
  }
  
  // Check if current user has checked an item
  const isItemCheckedByUser = (itemKey: string) => {
    if (!currentUser) return false
    const users = checkedItems[itemKey] || []
    return users.some(u => u.username === currentUser.username)
  }
  
  // Save trash to localStorage
  const saveTrash = (newTrash: typeof trashItems) => {
    setTrashItems(newTrash)
    localStorage.setItem('admin_trash_bin', JSON.stringify(newTrash))
  }

  // Get current destination theme color
  const currentDestination = destinations.find(d => d.id === currentDestinationId) || destinations[0]
  const themeColor = currentDestination?.theme?.primaryHex || '#F472B6'

  useEffect(() => {
    const initAdmin = async () => {
      // Small delay to ensure cookies are loaded
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Allow any authenticated user to access profile page
      if (!isAuthenticated()) {
        window.location.href = '/login'
        return
      }
      
      fetchTrips()
      
      // Load destinations
      const currentDest = getCurrentDestination()
      setCurrentDestinationId(currentDest)
      
      try {
        const freshDestinations = await getDestinationsAsync()
        setDestinations(freshDestinations)
      } catch (err) {
        console.warn('Failed to fetch destinations, using defaults:', err)
        setDestinations(DEFAULT_DESTINATIONS.map(d => ({
          ...d,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })))
      }
      
      // Load site settings (try Supabase, fallback to local)
      let settings = getSettings() // Use local cache first
      try {
        const freshSettings = await getSettingsAsync()
        if (freshSettings) {
          settings = freshSettings
        }
      } catch (err) {
        console.warn('Failed to fetch settings from Supabase, using local:', err)
      }
      
      setSiteSettings(settings)
      setSettingsForm({ 
        title: settings.title,
        tripStartDate: settings.tripStartDate || new Date().toISOString().split('T')[0],
        totalDays: settings.totalDays || 3,
        daySchedules: settings.daySchedules || [],
        homeLocationImageUrl: settings.homeLocation?.imageUrl || ''
      })
      setRecaptchaEnabled(settings.recaptchaEnabled || false)
      // Load chiikawa messages with defaults
      const defaultMessages = {
        chiikawa: ['呀哈！ヤハ！', '噗嚕嚕嚕嚕！プルルルル！', '嗚拉！ウラ！', '哈？ハァ？'],
        hachiware: ['チャリメラ〜 查露麵拉～', 'わははは！おかしいね！哇哈哈哈！太有趣了吧！'],
        usagi: ['ウンッ！嗯！', 'ワッ！ワッ！哇！哇！'],
      }
      if (settings.chiikawaMessages) {
        setChiikawaMessages({
          chiikawa: settings.chiikawaMessages.chiikawa || defaultMessages.chiikawa,
          hachiware: settings.chiikawaMessages.hachiware || defaultMessages.hachiware,
          usagi: settings.chiikawaMessages.usagi || defaultMessages.usagi,
        })
      }
    }
    
    initAdmin()
  }, [])

  const fetchTrips = async () => {
    setIsLoading(true)
    try {
      const data = await getTrips()
      setTrips(data)
    } catch (err) {
      setMessage({ type: 'error', text: '載入行程失敗' })
    } finally {
      setIsLoading(false)
    }
  }

  const loadWishlistItems = async () => {
    try {
      const items = await getSupabaseWishlistItems()
      setWishlistItems(items)
    } catch (err) {
      console.error('Failed to load wishlist items:', err)
    }
  }

  const handleDeleteWishlistItem = async (item: WishlistItemDB) => {
    if (!confirm(`確定要刪除「${item.name}」嗎？`)) return
    try {
      await deleteSupabaseWishlistItem(item.id)
      setWishlistItems(prev => prev.filter(i => i.id !== item.id))
      setMessage({ type: 'success', text: '已刪除收藏項目' })
    } catch (err) {
      setMessage({ type: 'error', text: '刪除失敗' })
    }
  }

  const handleUpdateWishlistItem = async (item: WishlistItemDB, updates: Partial<WishlistItemDB>) => {
    try {
      await updateSupabaseWishlistItem(item.id, updates)
      setWishlistItems(prev => prev.map(i => i.id === item.id ? { ...i, ...updates } : i))
      setEditingWishlistItem(null)
      setMessage({ type: 'success', text: '已更新收藏項目' })
    } catch (err) {
      setMessage({ type: 'error', text: '更新失敗' })
    }
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setEditingTrip(null)
    setShowForm(false)
    setShowPlacePicker(false)
  }

  const handlePlaceSelect = (place: { location: string; lat: number; lng: number }) => {
    setFormData((prev) => ({
      ...prev,
      location: place.location,
      lat: place.lat,
      lng: place.lng,
    }))
    setShowPlacePicker(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    try {
      // Filter out empty schedule items and convert to JSON
      const validScheduleItems = formData.scheduleItems.filter(item => 
        item.content.trim() || item.time_start || item.time_end
      )
      const descriptionJson = JSON.stringify(validScheduleItems)
      
      // Get first schedule item's time for sorting purposes
      const firstItem = validScheduleItems[0]
      
      const tripData = {
        title: formData.title,
        date: formData.date,
        description: descriptionJson,
        location: formData.location,
        lat: formData.lat,
        lng: formData.lng,
        image_url: formData.images.length > 0 ? JSON.stringify(formData.images) : undefined,
        time_start: firstItem?.time_start || undefined,
        time_end: firstItem?.time_end || undefined,
      }

      if (editingTrip) {
        const { data, error } = await updateTrip(editingTrip.id, tripData)
        if (data) {
          setMessage({ type: 'success', text: '行程更新成功！' })
          await fetchTrips()
          resetForm()
        } else {
          setMessage({ type: 'error', text: error || '更新行程失敗' })
        }
      } else {
        const { data, error } = await createTrip(tripData)
        if (data) {
          setMessage({ type: 'success', text: '行程建立成功！' })
          await fetchTrips()
          resetForm()
        } else {
          setMessage({ type: 'error', text: error || '建立行程失敗' })
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '發生錯誤' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (trip: Trip) => {
    setEditingTrip(trip)
    setFormData({
      title: trip.title,
      date: trip.date,
      location: trip.location,
      lat: trip.lat,
      lng: trip.lng,
      images: parseImages(trip.image_url),
      scheduleItems: parseScheduleItems(trip.description),
    })
    setShowForm(true)
  }

  const addScheduleItem = () => {
    setFormData(prev => ({
      ...prev,
      scheduleItems: [...prev.scheduleItems, createEmptyScheduleItem()]
    }))
  }

  const removeScheduleItem = (id: string) => {
    setFormData(prev => ({
      ...prev,
      scheduleItems: prev.scheduleItems.filter(item => item.id !== id)
    }))
  }

  const updateScheduleItem = (id: string, field: keyof ScheduleItem, value: string) => {
    setFormData(prev => ({
      ...prev,
      scheduleItems: prev.scheduleItems.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    }))
  }

  const handleDelete = async (id: number) => {
    if (!confirm('確定要將此行程移至垃圾桶嗎？')) return

    try {
      // Find the trip to move to trash
      const tripToDelete = trips.find(t => t.id === id)
      if (tripToDelete) {
        // Move to trash
        const newTrash = {
          ...trashItems,
          trips: [...trashItems.trips, { ...tripToDelete, deletedAt: new Date().toISOString() }]
        }
        saveTrash(newTrash)
      }
      
      const { success, error } = await deleteTrip(id)
      if (success) {
        setMessage({ type: 'success', text: '行程已移至垃圾桶！' })
        await fetchTrips()
      } else {
        setMessage({ type: 'error', text: error || '刪除行程失敗' })
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '發生錯誤' })
    }
  }
  
  // Permanently delete from trash
  const handlePermanentDelete = (type: 'trips' | 'users' | 'destinations', id: number | string) => {
    if (!confirm('確定要永久刪除此項目嗎？此操作無法復原！')) return
    
    const newTrash = { ...trashItems }
    if (type === 'trips') {
      newTrash.trips = newTrash.trips.filter(t => t.id !== id)
    } else if (type === 'users') {
      newTrash.users = newTrash.users.filter(u => u.username !== id)
    } else if (type === 'destinations') {
      newTrash.destinations = newTrash.destinations.filter(d => d.id !== id)
    }
    saveTrash(newTrash)
    setMessage({ type: 'success', text: '項目已永久刪除！' })
  }
  
  // Clear all trash
  const handleClearTrash = () => {
    if (!confirm('確定要清空垃圾桶嗎？所有項目將被永久刪除！')) return
    saveTrash({ trips: [], users: [], destinations: [] })
    setMessage({ type: 'success', text: '垃圾桶已清空！' })
  }

  // Handle destination switch
  const handleDestinationSwitch = (destId: string) => {
    setCurrentDestinationId(destId)
    setCurrentDestination(destId)
    setMessage({ type: 'success', text: `已切換至 ${destinations.find(d => d.id === destId)?.name || destId}` })
  }

  // Handle save destination
  const handleSaveDestination = async () => {
    if (!destinationForm.id || !destinationForm.name) {
      setMessage({ type: 'error', text: '請填寫所有必填欄位' })
      return
    }

    const gradient = getGradientFromHex(destinationForm.primaryHex)
    const newDestination: Omit<DestinationDB, 'created_at' | 'updated_at'> = {
      id: destinationForm.id.toLowerCase().replace(/\s+/g, '-'),
      name: destinationForm.name,
      name_en: destinationForm.name_en || destinationForm.name,
      flag: destinationForm.flag || '🌍',
      theme: {
        primary: destinationForm.id.toLowerCase(),
        primaryHex: destinationForm.primaryHex,
        secondary: 'gray',
        secondaryHex: adjustColor(destinationForm.primaryHex, -20),
        accent: 'gray',
        accentHex: adjustColor(destinationForm.primaryHex, -40),
        gradient,
        emoji: destinationForm.emoji || '✈️',
      },
      is_active: true,
      sort_order: destinations.length + 1,
    }

    const { data, error } = await saveSupabaseDestination(newDestination)
    if (error) {
      setMessage({ type: 'error', text: error })
    } else {
      const freshDestinations = await getDestinationsAsync()
      setDestinations(freshDestinations)
      setMessage({ type: 'success', text: editingDestination ? '目的地已更新！' : '目的地已新增！' })
      setShowDestinationModal(false)
      setEditingDestination(null)
      setDestinationForm({ id: '', name: '', name_en: '', flag: '', primaryHex: '#F472B6', emoji: '' })
    }
  }

  // Helper to generate gradient from hex color
  const getGradientFromHex = (hex: string): string => {
    return `from-[${hex}] to-[${adjustColor(hex, -30)}]`
  }

  // Helper to adjust color brightness
  const adjustColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace('#', ''), 16)
    const amt = Math.round(2.55 * percent)
    const R = Math.max(0, Math.min(255, (num >> 16) + amt))
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt))
    const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt))
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`
  }

  const handleSaveSettings = async () => {
    // Ensure daySchedules has entries for all days
    const daySchedules = Array.from({ length: settingsForm.totalDays }, (_, i) => {
      const existing = settingsForm.daySchedules.find(d => d.dayNumber === i + 1)
      return existing || { dayNumber: i + 1, theme: `Day ${i + 1}` }
    })
    
    // Update home location with image
    const updatedHomeLocation = {
      ...siteSettings!.homeLocation,
      imageUrl: settingsForm.homeLocationImageUrl || undefined
    }
    
    const settingsToSave = {
      title: settingsForm.title,
      tripStartDate: settingsForm.tripStartDate,
      totalDays: settingsForm.totalDays,
      daySchedules,
      homeLocation: updatedHomeLocation
    }
    
    // Save to both localStorage and Supabase
    await saveSettingsAsync(settingsToSave)
    
    setSiteSettings({ 
      ...siteSettings!, 
      ...settingsToSave
    })
    setMessage({ type: 'success', text: '設定已儲存！' })
    setShowSettings(false)
  }

  const updateDayTheme = (dayNumber: number, theme: string) => {
    setSettingsForm(prev => {
      const daySchedules = [...prev.daySchedules]
      const index = daySchedules.findIndex(d => d.dayNumber === dayNumber)
      if (index >= 0) {
        daySchedules[index] = { ...daySchedules[index], theme }
      } else {
        daySchedules.push({ dayNumber, theme })
      }
      return { ...prev, daySchedules }
    })
  }

  const updateDayImage = (dayNumber: number, imageUrl: string) => {
    setSettingsForm(prev => {
      const daySchedules = [...prev.daySchedules]
      const index = daySchedules.findIndex(d => d.dayNumber === dayNumber)
      if (index >= 0) {
        daySchedules[index] = { ...daySchedules[index], imageUrl }
      } else {
        daySchedules.push({ dayNumber, theme: `Day ${dayNumber}`, imageUrl })
      }
      return { ...prev, daySchedules }
    })
  }

  return (
    <main className={`min-h-screen bg-gray-50 pb-20 md:pb-0 ${!isSakuraMode ? 'clean-mode' : ''}`}>
      {/* Sakura Effect */}
      <SakuraCanvas enabled={isSakuraMode} />
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 md:gap-3">
            <span className="hidden md:inline text-xl md:text-2xl">⚙️</span>
            <h1 className="text-lg md:text-xl font-medium text-gray-800">
              <span className="md:hidden">個人資料</span>
              <span className="hidden md:inline">{t.admin.dashboard}</span>
            </h1>
          </div>
          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-4">
            <LanguageSwitch />
            <a
              href="/main"
              className="text-sm text-gray-500 hover:text-gray-700 whitespace-nowrap"
            >
              {t.admin.viewSite} →
            </a>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap"
            >
              {t.admin.logout}
            </button>
          </div>
          {/* Mobile: Language switch only for admin */}
          {isAdminUser && (
            <div className="md:hidden">
              <LanguageSwitch />
            </div>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Message */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`mb-6 px-4 py-3 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}
            >
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-8">
          
          {/* Mobile Logout Card - Full row */}
          <div className="md:hidden col-span-2 bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
                  <span className="text-xl">🚪</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">登出帳號</h3>
                  <p className="text-xs text-gray-500">退出目前登入的帳號</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors font-medium"
              >
                登出
              </button>
            </div>
          </div>

          {/* Mobile Travel Wallet Card - Full row */}
          <div 
            className="md:hidden col-span-2 bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={async () => {
              // Load wallet data
              const user = getCurrentUser()
              if (user) {
                const [personal, shared, settings] = await Promise.all([
                  getSupabaseExpenses('personal', user.username),
                  getSupabaseExpenses('shared'),
                  getSupabaseWalletSettings(),
                ])
                setPersonalExpenses(personal)
                setSharedExpenses(shared)
                setWalletSettings(settings)
                if (settings) {
                  setBudgetForm({ amount: settings.shared_budget.toString() })
                }
              }
              setShowWallet(true)
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <span className="text-xl">💰</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">旅行錢包</h3>
                  <p className="text-xs text-gray-500">記錄旅程的洗費</p>
                </div>
              </div>
              <div className="text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          {/* Mobile Admin Cards Row - Wishlist Management + Chiikawa Dialogue (Admin only) */}
          {isAdminUser && (
            <>
              {/* Wishlist Management Card */}
              <div 
                className="md:hidden col-span-1 bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => {
                  loadWishlistItems()
                  setShowWishlistManagement(true)
                }}
              >
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center">
                    <span className="text-xl">💝</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">心願清單管理</h3>
                    <p className="text-xs text-gray-500">編輯或刪除項目</p>
                  </div>
                </div>
              </div>
              
              {/* Chiikawa Dialogue Edit Card */}
              <div 
                className="md:hidden col-span-1 bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setShowChiikawaEdit(true)}
              >
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-300 to-pink-400 flex items-center justify-center">
                    <span className="text-xl">🐹</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">Chiikawa 對白</h3>
                    <p className="text-xs text-gray-500">編輯小精靈對話</p>
                  </div>
                </div>
              </div>
            </>
          )}
          
          {/* Non-admin Mobile - Trip Management Card - Full row */}
          {!isAdminUser && (
            <a 
              href="/main"
              className="md:hidden col-span-2 bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sakura-400 to-sakura-600 flex items-center justify-center">
                    <span className="text-xl">📋</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">行程管理</h3>
                    <p className="text-xs text-gray-500">查看及編輯旅行行程</p>
                  </div>
                </div>
                <span className="text-gray-400">→</span>
              </div>
            </a>
          )}

          {/* Admin Only Content Below */}
          {isAdminUser && (
            <>
          {/* Destination Switcher - Large Card (Full row on all screens) */}
          <div 
            className="col-span-2 lg:col-span-2 bg-gradient-to-br rounded-2xl p-4 md:p-6 text-white relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${themeColor} 0%, ${adjustColor(themeColor, -30)} 100%)` }}
          >
            <div className="absolute top-0 right-0 text-[120px] opacity-20 -mr-4 -mt-4">
              {currentDestination?.theme?.emoji || '✈️'}
            </div>
            <div className="relative z-10">
              <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                <span>🌏</span> 旅行目的地
              </h3>
              <p className="text-white/80 text-sm mb-4">
                選擇目的地以切換主題顏色和行程資料
              </p>
              
              {/* Destination Switch - Select on mobile, Buttons on desktop */}
              {/* Mobile Select */}
              <div className="md:hidden mb-4">
                <select
                  value={currentDestinationId}
                  onChange={(e) => handleDestinationSwitch(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl font-medium bg-white text-gray-800 shadow-lg outline-none cursor-pointer"
                >
                  {destinations.filter(d => d.is_active).map((dest) => (
                    <option key={dest.id} value={dest.id}>
                      {dest.flag} {dest.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Desktop Buttons */}
              <div className="hidden md:flex flex-wrap gap-2 mb-4">
                {destinations.filter(d => d.is_active).map((dest) => (
                  <button
                    key={dest.id}
                    onClick={() => handleDestinationSwitch(dest.id)}
                    className={`px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2 ${
                      currentDestinationId === dest.id
                        ? 'bg-white text-gray-800 shadow-lg scale-105'
                        : 'bg-white/20 hover:bg-white/30 text-white'
                    }`}
                  >
                    <span>{dest.flag}</span>
                    <span>{dest.name}</span>
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setShowDestinationModal(true)}
                className="text-sm text-white/70 hover:text-white underline"
              >
                管理目的地 →
              </button>
            </div>
          </div>

          {/* Site Settings Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center mb-3">
                  <span className="text-xl">🎨</span>
                </div>
                <h3 className="font-semibold text-gray-800 mb-1">網站設定</h3>
                <p className="text-xs text-gray-500">
                  {siteSettings?.title || '日本旅遊'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {siteSettings?.tripStartDate 
                    ? `${new Date(siteSettings.tripStartDate).toLocaleDateString('zh-TW')} 起`
                    : '未設定'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="mt-4 w-full py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
            >
              編輯設定
            </button>
          </div>

          {/* User Management Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mb-3">
                  <span className="text-xl">👥</span>
                </div>
                <h3 className="font-semibold text-gray-800 mb-1">用戶管理</h3>
                <p className="text-xs text-gray-500">
                  管理可登入的用戶帳號
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {users.length > 0 ? `${users.length} 位用戶` : '載入中...'}
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                const freshUsers = await getUsersAsync()
                setUsers(freshUsers)
                setShowUserManagement(true)
              }}
              className="mt-4 w-full py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
            >
              管理用戶
            </button>
          </div>

          {/* Travel Notice Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mb-3">
                  <span className="text-xl">📋</span>
                </div>
                <h3 className="font-semibold text-gray-800 mb-1">旅遊須知</h3>
                <p className="text-xs text-gray-500">
                  管理旅遊須知清單項目
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  必備物品、出發前準備
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                let settings = getSettings()
                try {
                  const freshSettings = await getSettingsAsync()
                  if (freshSettings) settings = freshSettings
                } catch (err) {
                  console.warn('Failed to fetch settings:', err)
                }
                setTravelEssentials(settings.travelEssentials || defaultTravelEssentials)
                setTravelPreparations(settings.travelPreparations || defaultTravelPreparations)
                setShowTravelNotice(true)
              }}
              className="mt-4 w-full py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
            >
              編輯項目
            </button>
          </div>

          {/* Travel Wallet Card - Desktop only (mobile has full row above) */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-3">
                  <span className="text-xl">💰</span>
                </div>
                <h3 className="font-semibold text-gray-800 mb-1">旅行錢包</h3>
                <p className="text-xs text-gray-500">
                  記錄旅程的洗費
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  個人 / 共同支出
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                // Load wallet data
                const user = getCurrentUser()
                if (user) {
                  const [personal, shared, settings] = await Promise.all([
                    getSupabaseExpenses('personal', user.username),
                    getSupabaseExpenses('shared'),
                    getSupabaseWalletSettings(),
                  ])
                  setPersonalExpenses(personal)
                  setSharedExpenses(shared)
                  setWalletSettings(settings)
                  if (settings) {
                    setBudgetForm({ amount: settings.shared_budget.toString() })
                  }
                }
                setShowWallet(true)
              }}
              className="mt-4 w-full py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
            >
              開啟錢包
            </button>
          </div>

          {/* Quick Stats Card - Hidden for now */}
          {/* <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center mb-3">
                  <span className="text-xl">📊</span>
                </div>
                <h3 className="font-semibold text-gray-800 mb-1">行程統計</h3>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-800">{trips.length}</p>
                    <p className="text-xs text-gray-500">總行程</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-800">{siteSettings?.totalDays || 0}</p>
                    <p className="text-xs text-gray-500">天數</p>
                  </div>
                </div>
              </div>
            </div>
          </div> */}

          {/* Trash Bin Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center mb-3">
                  <span className="text-xl">🗑️</span>
                </div>
                <h3 className="font-semibold text-gray-800 mb-1">垃圾桶</h3>
                <p className="text-xs text-gray-500">
                  已刪除的項目
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {trashItems.trips.length + trashItems.users.length + trashItems.destinations.length} 個項目
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowTrashBin(true)}
              className="mt-4 w-full py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
            >
              查看垃圾桶
            </button>
          </div>
            </>
          )}
          {/* End of Admin Only Content */}

        </div>

        {/* Action Bar - Admin Only */}
        {isAdminUser && (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-gray-800">
              {t.admin.manageTrips} ({trips.length})
            </h2>
            {/* Desktop only: Add trip button */}
            <button
              onClick={() => {
                resetForm()
                setShowForm(true)
              }}
              className="hidden md:flex px-4 py-2 text-white rounded-lg font-medium transition-colors items-center gap-2"
              style={{ backgroundColor: themeColor }}
            >
              <span>+</span> {t.admin.addTrip}
            </button>
          </div>
        )}

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowSettings(false)
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              >
                <div className="p-6 border-b border-gray-100">
                  <h3 className="text-lg font-medium text-gray-800">網站設定</h3>
                </div>
                <div className="p-6 space-y-6">
                  {/* Site Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      網站標題
                    </label>
                    <input
                      type="text"
                      value={settingsForm.title}
                      onChange={(e) => setSettingsForm({ ...settingsForm, title: e.target.value })}
                      placeholder="例如：日本旅遊"
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none"
                    />
                  </div>

                  {/* Home Location Image */}
                  <div className="border-t border-gray-100 pt-6">
                    <h4 className="text-sm font-medium text-gray-800 mb-4 flex items-center gap-2">
                      🏠 住所設定
                    </h4>
                    <MediaUpload
                      label="住所圖片"
                      value={settingsForm.homeLocationImageUrl}
                      onChange={(url) => setSettingsForm({ ...settingsForm, homeLocationImageUrl: url })}
                    />
                  </div>

                  {/* Trip Schedule Section */}
                  <div className="border-t border-gray-100 pt-6">
                    <h4 className="text-sm font-medium text-gray-800 mb-4 flex items-center gap-2">
                      📅 行程日期設定
                    </h4>
                    
                    {/* Start Date */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        行程開始日期
                      </label>
                      <input
                        type="date"
                        value={settingsForm.tripStartDate}
                        onChange={(e) => setSettingsForm({ ...settingsForm, tripStartDate: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none"
                      />
                    </div>

                    {/* Total Days */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        總天數
                      </label>
                      <select
                        value={settingsForm.totalDays}
                        onChange={(e) => setSettingsForm({ ...settingsForm, totalDays: Number(e.target.value) })}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none"
                      >
                        {Array.from({ length: 14 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n} 天</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        超過 7 天時，主頁 Tab 將以滑動方式顯示
                      </p>
                    </div>

                  </div>

                  {/* reCAPTCHA Toggle */}
                  <div className="border-t border-gray-100 pt-6">
                    <h4 className="text-sm font-medium text-gray-800 mb-4 flex items-center gap-2">
                      🔒 安全設定
                    </h4>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-700">reCAPTCHA 驗證</p>
                        <p className="text-xs text-gray-500">登入頁面顯示人機驗證</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const newValue = !recaptchaEnabled
                          setRecaptchaEnabled(newValue)
                          await saveSettingsAsync({ recaptchaEnabled: newValue })
                          setMessage({ type: 'success', text: `reCAPTCHA 已${newValue ? '啟用' : '關閉'}！` })
                        }}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          recaptchaEnabled ? 'bg-blue-500' : 'bg-gray-300'
                        }`}
                      >
                        <span 
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            recaptchaEnabled ? 'left-7' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowSettings(false)}
                      className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSettings}
                      className="flex-1 py-2 bg-sakura-500 hover:bg-sakura-600 text-white rounded-lg font-medium transition-colors"
                    >
                      儲存設定
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User Management Modal */}
        <AnimatePresence>
          {showUserManagement && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowUserManagement(false)
                  setEditingUser(null)
                  setUserForm({ username: '', password: '', displayName: '', role: 'user', avatarUrl: '' })
                }
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              >
                <div className="p-6 border-b border-gray-100">
                  <h3 className="text-lg font-medium text-gray-800">👥 用戶管理</h3>
                </div>
                <div className="p-6">
                  {/* User List */}
                  <div className="space-y-3 mb-6">
                    {users.map(user => (
                      <div key={user.username} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          {user.avatarUrl ? (
                            <img 
                              src={user.avatarUrl} 
                              alt={user.displayName}
                              className="w-10 h-10 rounded-full object-cover border-2 border-white shadow"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sakura-300 to-sakura-500 flex items-center justify-center text-white font-medium shadow">
                              {user.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800">{user.displayName}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                user.role === 'admin' 
                                  ? 'bg-purple-100 text-purple-600' 
                                  : 'bg-blue-100 text-blue-600'
                              }`}>
                                {user.role === 'admin' ? '管理員' : '用戶'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              帳號：{user.username} / 密碼：{user.password}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingUser(user)
                              setUserForm({
                                username: user.username,
                                password: user.password,
                                displayName: user.displayName,
                                role: user.role,
                                avatarUrl: user.avatarUrl || ''
                              })
                            }}
                            className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors"
                          >
                            編輯
                          </button>
                          {user.username !== 'admin' && (
                            <button
                              onClick={async () => {
                                if (confirm(`確定要將用戶 ${user.displayName} 移至垃圾桶嗎？`)) {
                                  // Move to trash
                                  const newTrash = {
                                    ...trashItems,
                                    users: [...trashItems.users, { ...user, deletedAt: new Date().toISOString() }]
                                  }
                                  saveTrash(newTrash)
                                  
                                  await deleteUserAsync(user.username)
                                  const freshUsers = await getUsersAsync()
                                  setUsers(freshUsers)
                                  setMessage({ type: 'success', text: '用戶已移至垃圾桶！' })
                                }
                              }}
                              className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                            >
                              刪除
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Add/Edit User Form */}
                  <div className="border-t border-gray-100 pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      {editingUser ? '編輯用戶' : '新增用戶'}
                    </h4>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={userForm.displayName}
                        onChange={(e) => setUserForm({ ...userForm, displayName: e.target.value })}
                        placeholder="顯示名稱"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none"
                      />
                      <input
                        type="text"
                        value={userForm.username}
                        onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                        placeholder="帳號"
                        disabled={editingUser?.username === 'admin'}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none disabled:bg-gray-100"
                      />
                      <input
                        type="text"
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        placeholder="密碼"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none"
                      />
                      <select
                        value={userForm.role}
                        onChange={(e) => setUserForm({ ...userForm, role: e.target.value as UserRole })}
                        disabled={editingUser?.username === 'admin'}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none disabled:bg-gray-100"
                      >
                        <option value="user">用戶（可編輯行程、心願清單）</option>
                        <option value="admin">管理員（可存取後台）</option>
                      </select>
                      
                      {/* Avatar Upload */}
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">頭像圖片</label>
                        <div className="flex items-center gap-3">
                          {userForm.avatarUrl ? (
                            <img 
                              src={userForm.avatarUrl} 
                              alt="Avatar preview"
                              className="w-12 h-12 rounded-full object-cover border-2 border-sakura-200"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                              無頭像
                            </div>
                          )}
                          <div className="flex-1">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  const reader = new FileReader()
                                  reader.onloadend = () => {
                                    setUserForm({ ...userForm, avatarUrl: reader.result as string })
                                  }
                                  reader.readAsDataURL(file)
                                }
                              }}
                              className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-sakura-50 file:text-sakura-600 hover:file:bg-sakura-100"
                            />
                            {userForm.avatarUrl && (
                              <button
                                type="button"
                                onClick={() => setUserForm({ ...userForm, avatarUrl: '' })}
                                className="text-xs text-red-500 hover:text-red-600 mt-1"
                              >
                                移除頭像
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      {editingUser && (
                        <button
                          onClick={() => {
                            setEditingUser(null)
                            setUserForm({ username: '', password: '', displayName: '', role: 'user', avatarUrl: '' })
                          }}
                          className="flex-1 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          取消
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (!userForm.username || !userForm.password || !userForm.displayName) {
                            alert('請填寫所有欄位')
                            return
                          }
                          await updateUserAsync({
                            username: userForm.username,
                            password: userForm.password,
                            displayName: userForm.displayName,
                            role: userForm.role,
                            avatarUrl: userForm.avatarUrl || undefined
                          })
                          const freshUsers = await getUsersAsync()
                          setUsers(freshUsers)
                          setEditingUser(null)
                          setUserForm({ username: '', password: '', displayName: '', role: 'user', avatarUrl: '' })
                          setMessage({ type: 'success', text: editingUser ? '用戶已更新！' : '用戶已新增！' })
                        }}
                        className="flex-1 py-2 text-sm bg-sakura-500 hover:bg-sakura-600 text-white rounded-lg transition-colors"
                      >
                        {editingUser ? '更新' : '新增'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Close Button */}
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setShowUserManagement(false)
                        setEditingUser(null)
                        setUserForm({ username: '', password: '', displayName: '', role: 'user', avatarUrl: '' })
                      }}
                      className="w-full py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      關閉
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Travel Notice Modal */}
        <AnimatePresence>
          {showTravelNotice && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowTravelNotice(false)
                  setNewItemText('')
                  setNewItemIcon('📌')
                }
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              >
                <div className="p-4 sm:p-6 border-b border-gray-100">
                  <h3 className="text-base sm:text-lg font-medium text-gray-800">📋 旅遊須知設定</h3>
                </div>
                <div className="p-4 sm:p-6">
                  {/* Category Tabs */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setEditingNoticeType('essentials')}
                      className={`flex-1 py-2 px-2 sm:px-3 text-xs sm:text-sm rounded-lg transition-colors ${
                        editingNoticeType === 'essentials'
                          ? 'bg-sakura-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      🎒 <span className="hidden sm:inline">必備物品</span><span className="sm:hidden">必備</span> ({travelEssentials.length})
                    </button>
                    <button
                      onClick={() => setEditingNoticeType('preparations')}
                      className={`flex-1 py-2 px-2 sm:px-3 text-xs sm:text-sm rounded-lg transition-colors ${
                        editingNoticeType === 'preparations'
                          ? 'bg-sakura-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      📝 <span className="hidden sm:inline">出發前準備</span><span className="sm:hidden">準備</span> ({travelPreparations.length})
                    </button>
                  </div>

                  {/* Items List */}
                  <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto">
                    {(editingNoticeType === 'essentials' ? travelEssentials : travelPreparations).map((item, index) => (
                      <div key={item.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <span className="text-lg">{item.icon}</span>
                        <span className="flex-1 text-sm text-gray-700">{item.text}</span>
                        <button
                          onClick={() => {
                            if (editingNoticeType === 'essentials') {
                              setTravelEssentials(travelEssentials.filter((_, i) => i !== index))
                            } else {
                              setTravelPreparations(travelPreparations.filter((_, i) => i !== index))
                            }
                          }}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                    {(editingNoticeType === 'essentials' ? travelEssentials : travelPreparations).length === 0 && (
                      <p className="text-center text-gray-400 text-sm py-4">尚無項目</p>
                    )}
                  </div>

                  {/* Add New Item */}
                  <div className="border-t border-gray-100 pt-4">
                    <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">新增項目</h4>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex gap-2">
                        <select
                          value={newItemIcon}
                          onChange={(e) => setNewItemIcon(e.target.value)}
                          className="w-14 sm:w-16 px-1 sm:px-2 py-2 text-base sm:text-lg border border-gray-200 rounded-lg focus:border-sakura-400 outline-none"
                        >
                        <option value="📌">📌</option>
                        <option value="🛂">🛂</option>
                        <option value="💴">💴</option>
                        <option value="📱">📱</option>
                        <option value="🔌">🔌</option>
                        <option value="💊">💊</option>
                        <option value="🧳">🧳</option>
                        <option value="🚃">🚃</option>
                        <option value="🏨">🏨</option>
                        <option value="📋">📋</option>
                        <option value="🌡️">🌡️</option>
                        <option value="✈️">✈️</option>
                        <option value="🎫">🎫</option>
                        <option value="📷">📷</option>
                        <option value="👕">👕</option>
                        <option value="🧴">🧴</option>
                        <option value="🔋">🔋</option>
                        <option value="💳">💳</option>
                        <option value="🗺️">🗺️</option>
                        <option value="☂️">☂️</option>
                      </select>
                      <input
                        type="text"
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        placeholder="輸入項目內容"
                        className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newItemText.trim()) {
                            const newItem: TravelNoticeItem = {
                              id: Date.now().toString(),
                              icon: newItemIcon,
                              text: newItemText.trim()
                            }
                            if (editingNoticeType === 'essentials') {
                              setTravelEssentials([...travelEssentials, newItem])
                            } else {
                              setTravelPreparations([...travelPreparations, newItem])
                            }
                            setNewItemText('')
                            setNewItemIcon('📌')
                          }
                        }}
                      />
                      </div>
                      <button
                        onClick={() => {
                          if (!newItemText.trim()) return
                          const newItem: TravelNoticeItem = {
                            id: Date.now().toString(),
                            icon: newItemIcon,
                            text: newItemText.trim()
                          }
                          if (editingNoticeType === 'essentials') {
                            setTravelEssentials([...travelEssentials, newItem])
                          } else {
                            setTravelPreparations([...travelPreparations, newItem])
                          }
                          setNewItemText('')
                          setNewItemIcon('📌')
                        }}
                        disabled={!newItemText.trim()}
                        className="w-full sm:w-auto px-4 py-2 text-sm bg-sakura-500 hover:bg-sakura-600 disabled:bg-sakura-300 text-white rounded-lg transition-colors"
                      >
                        新增
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-6 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setShowTravelNotice(false)
                        setNewItemText('')
                        setNewItemIcon('📌')
                      }}
                      className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={async () => {
                        // Save to settings (both localStorage and Supabase)
                        await saveSettingsAsync({
                          travelEssentials,
                          travelPreparations
                        })
                        setMessage({ type: 'success', text: '旅遊須知已儲存！' })
                        setShowTravelNotice(false)
                        setNewItemText('')
                        setNewItemIcon('📌')
                      }}
                      className="flex-1 py-2 bg-sakura-500 hover:bg-sakura-600 text-white rounded-lg font-medium transition-colors"
                    >
                      儲存
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Destination Management Modal */}
        <AnimatePresence>
          {showDestinationModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowDestinationModal(false)
                  setEditingDestination(null)
                  setDestinationForm({ id: '', name: '', name_en: '', flag: '', primaryHex: '#F472B6', emoji: '' })
                }
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              >
                <div className="p-6 border-b border-gray-100">
                  <h3 className="text-lg font-medium text-gray-800">🌏 目的地管理</h3>
                </div>
                <div className="p-6">
                  {/* Destinations List */}
                  <div className="space-y-3 mb-6">
                    {destinations.map((dest) => (
                      <div 
                        key={dest.id} 
                        className="flex items-center justify-between p-3 rounded-xl border border-gray-200"
                        style={{ 
                          background: currentDestinationId === dest.id 
                            ? `linear-gradient(135deg, ${dest.theme.primaryHex}15 0%, ${dest.theme.primaryHex}05 100%)`
                            : 'white'
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg"
                            style={{ backgroundColor: dest.theme.primaryHex }}
                          >
                            {dest.flag}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800">{dest.name}</span>
                              <span className="text-xs text-gray-400">{dest.name_en}</span>
                              {currentDestinationId === dest.id && (
                                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded-full">
                                  目前使用
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div 
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: dest.theme.primaryHex }}
                              />
                              <span className="text-xs text-gray-500">{dest.theme.primaryHex}</span>
                              <span className="text-sm">{dest.theme.emoji}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingDestination(dest)
                              setDestinationForm({
                                id: dest.id,
                                name: dest.name,
                                name_en: dest.name_en,
                                flag: dest.flag,
                                primaryHex: dest.theme.primaryHex,
                                emoji: dest.theme.emoji,
                              })
                            }}
                            className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors"
                          >
                            編輯
                          </button>
                          {dest.id !== 'japan' && (
                            <button
                              onClick={async () => {
                                if (confirm(`確定要將 ${dest.name} 移至垃圾桶嗎？`)) {
                                  // Move to trash
                                  const newTrash = {
                                    ...trashItems,
                                    destinations: [...trashItems.destinations, { ...dest, deletedAt: new Date().toISOString() }]
                                  }
                                  saveTrash(newTrash)
                                  
                                  const { success, error } = await deleteSupabaseDestination(dest.id)
                                  if (error) {
                                    setMessage({ type: 'error', text: error })
                                  } else {
                                    const freshDestinations = await getDestinationsAsync()
                                    setDestinations(freshDestinations)
                                    if (currentDestinationId === dest.id) {
                                      handleDestinationSwitch('japan')
                                    }
                                    setMessage({ type: 'success', text: '目的地已移至垃圾桶！' })
                                  }
                                }
                              }}
                              className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                            >
                              刪除
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add/Edit Destination Form */}
                  <div className="border-t border-gray-100 pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      {editingDestination ? '編輯目的地' : '新增目的地'}
                    </h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={destinationForm.name}
                          onChange={(e) => setDestinationForm({ ...destinationForm, name: e.target.value })}
                          placeholder="名稱（中文）"
                          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-sakura-400 outline-none"
                        />
                        <input
                          type="text"
                          value={destinationForm.name_en}
                          onChange={(e) => setDestinationForm({ ...destinationForm, name_en: e.target.value })}
                          placeholder="名稱（英文）"
                          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-sakura-400 outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={destinationForm.id}
                          onChange={(e) => setDestinationForm({ ...destinationForm, id: e.target.value })}
                          placeholder="ID"
                          disabled={!!editingDestination}
                          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-sakura-400 outline-none disabled:bg-gray-100"
                        />
                        <input
                          type="text"
                          value={destinationForm.flag}
                          onChange={(e) => setDestinationForm({ ...destinationForm, flag: e.target.value })}
                          placeholder="國旗"
                          className="px-3 py-2 border border-gray-200 rounded-lg focus:border-sakura-400 outline-none text-center text-xl"
                        />
                        <input
                          type="text"
                          value={destinationForm.emoji}
                          onChange={(e) => setDestinationForm({ ...destinationForm, emoji: e.target.value })}
                          placeholder="主題圖示"
                          className="px-3 py-2 border border-gray-200 rounded-lg focus:border-sakura-400 outline-none text-center text-xl"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-600">主題色：</label>
                        <input
                          type="color"
                          value={destinationForm.primaryHex}
                          onChange={(e) => setDestinationForm({ ...destinationForm, primaryHex: e.target.value })}
                          className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={destinationForm.primaryHex}
                          onChange={(e) => setDestinationForm({ ...destinationForm, primaryHex: e.target.value })}
                          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-sakura-400 outline-none"
                        />
                        <div 
                          className="w-20 h-10 rounded-lg"
                          style={{ background: `linear-gradient(135deg, ${destinationForm.primaryHex} 0%, ${adjustColor(destinationForm.primaryHex, -30)} 100%)` }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      {editingDestination && (
                        <button
                          onClick={() => {
                            setEditingDestination(null)
                            setDestinationForm({ id: '', name: '', name_en: '', flag: '', primaryHex: '#F472B6', emoji: '' })
                          }}
                          className="flex-1 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          取消
                        </button>
                      )}
                      <button
                        onClick={handleSaveDestination}
                        className="flex-1 py-2 text-sm text-white rounded-lg transition-colors"
                        style={{ backgroundColor: destinationForm.primaryHex || themeColor }}
                      >
                        {editingDestination ? '更新' : '新增'}
                      </button>
                    </div>
                  </div>

                  {/* Close Button */}
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setShowDestinationModal(false)
                        setEditingDestination(null)
                        setDestinationForm({ id: '', name: '', name_en: '', flag: '', primaryHex: '#F472B6', emoji: '' })
                      }}
                      className="w-full py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      關閉
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Travel Wallet Modal */}
        <AnimatePresence>
          {showWallet && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowWallet(false)
                  setShowExpenseForm(false)
                  setEditingExpense(null)
                  setExpenseForm({ amount: '', category: 'food', note: '' })
                }
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-800">💰 旅行錢包</h3>
                    <button
                      onClick={() => {
                        setShowWallet(false)
                        setShowExpenseForm(false)
                        setEditingExpense(null)
                      }}
                      className="text-gray-400 hover:text-gray-600 text-xl"
                    >
                      ×
                    </button>
                  </div>
                  
                  {/* Tabs */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setWalletTab('shared')}
                      className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-xl transition-colors ${
                        walletTab === 'shared'
                          ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      👥 共同支出
                    </button>
                    <button
                      onClick={() => setWalletTab('personal')}
                      className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-xl transition-colors ${
                        walletTab === 'personal'
                          ? 'bg-gradient-to-r from-blue-400 to-blue-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      👤 個人支出
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                  {/* Shared Tab */}
                  {walletTab === 'shared' && (
                    <div className="space-y-4">
                      {/* Budget Summary */}
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">預算</span>
                          <button
                            onClick={() => setShowBudgetForm(!showBudgetForm)}
                            className="text-xs text-amber-600 hover:underline"
                          >
                            {showBudgetForm ? '取消' : '設定'}
                          </button>
                        </div>
                        
                        {showBudgetForm ? (
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={budgetForm.amount}
                              onChange={(e) => setBudgetForm({ amount: e.target.value })}
                              placeholder="輸入預算金額"
                              className="flex-1 px-3 py-2 text-sm border border-amber-200 rounded-lg focus:border-amber-400 outline-none"
                            />
                            <button
                              onClick={async () => {
                                const amount = parseFloat(budgetForm.amount) || 0
                                await saveSupabaseWalletSettings({ shared_budget: amount, currency: 'JPY' })
                                setWalletSettings(prev => prev ? { ...prev, shared_budget: amount } : { id: 1, shared_budget: amount, currency: 'JPY', updated_at: new Date().toISOString() })
                                setShowBudgetForm(false)
                                setMessage({ type: 'success', text: '預算已更新！' })
                              }}
                              className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
                            >
                              儲存
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="text-2xl font-bold text-gray-800">
                              ¥{(walletSettings?.shared_budget || 0).toLocaleString()}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-sm text-gray-500">已使用</span>
                              <span className="text-sm font-medium text-orange-600">
                                ¥{sharedExpenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                              </span>
                            </div>
                            {(() => {
                              const remaining = (walletSettings?.shared_budget || 0) - sharedExpenses.reduce((sum, e) => sum + e.amount, 0)
                              return (
                                <div className={`text-lg font-bold mt-1 ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  餘額: ¥{remaining.toLocaleString()}
                                </div>
                              )
                            })()}
                          </>
                        )}
                      </div>

                      {/* Expense List */}
                      <div className="space-y-2">
                        {sharedExpenses.length === 0 ? (
                          <p className="text-center text-gray-400 text-sm py-8">尚無共同支出記錄</p>
                        ) : (
                          sharedExpenses.map((expense, index) => {
                            const userColor = USER_COLORS[index % USER_COLORS.length]
                            const category = EXPENSE_CATEGORIES.find(c => c.id === expense.category)
                            return (
                              <div
                                key={expense.id}
                                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm"
                                style={{ borderLeftColor: userColor, borderLeftWidth: '3px' }}
                              >
                                {/* Avatar */}
                                {expense.avatar_url ? (
                                  <img src={expense.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                  <div 
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                                    style={{ backgroundColor: userColor }}
                                  >
                                    {expense.display_name.charAt(0)}
                                  </div>
                                )}
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">{category?.icon}</span>
                                    <span className="text-sm font-medium text-gray-800 truncate">
                                      {expense.note || category?.label}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-400">
                                    {expense.display_name} · {new Date(expense.created_at).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                                
                                <div className="text-right">
                                  <p className="font-semibold text-red-600">-¥{expense.amount.toLocaleString()}</p>
                                </div>
                                
                                {/* Edit/Delete for own expenses or admin */}
                                {(currentUser?.username === expense.username || isAdminUser) && (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => {
                                        setEditingExpense(expense)
                                        setExpenseForm({
                                          amount: expense.amount.toString(),
                                          category: expense.category,
                                          note: expense.note || '',
                                        })
                                        setShowExpenseForm(true)
                                      }}
                                      className="p-1.5 text-xs text-blue-500 hover:bg-blue-50 rounded"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (confirm('確定要刪除此支出？')) {
                                          await deleteSupabaseExpense(expense.id)
                                          const fresh = await getSupabaseExpenses('shared')
                                          setSharedExpenses(fresh)
                                        }
                                      }}
                                      className="p-1.5 text-xs text-red-500 hover:bg-red-50 rounded"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* Personal Tab */}
                  {walletTab === 'personal' && (
                    <div className="space-y-4">
                      {/* Personal Summary */}
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                        <span className="text-sm text-gray-600">我的總支出</span>
                        <div className="text-2xl font-bold text-gray-800 mt-1">
                          ¥{personalExpenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {personalExpenses.length} 筆記錄
                        </p>
                      </div>

                      {/* Personal Expense List */}
                      <div className="space-y-2">
                        {personalExpenses.length === 0 ? (
                          <p className="text-center text-gray-400 text-sm py-8">尚無個人支出記錄</p>
                        ) : (
                          personalExpenses.map((expense) => {
                            const category = EXPENSE_CATEGORIES.find(c => c.id === expense.category)
                            return (
                              <div
                                key={expense.id}
                                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm"
                              >
                                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-lg">
                                  {category?.icon}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-800 truncate">
                                    {expense.note || category?.label}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {new Date(expense.created_at).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                                
                                <div className="text-right">
                                  <p className="font-semibold text-red-600">-¥{expense.amount.toLocaleString()}</p>
                                </div>
                                
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingExpense(expense)
                                      setExpenseForm({
                                        amount: expense.amount.toString(),
                                        category: expense.category,
                                        note: expense.note || '',
                                      })
                                      setShowExpenseForm(true)
                                    }}
                                    className="p-1.5 text-xs text-blue-500 hover:bg-blue-50 rounded"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (confirm('確定要刪除此支出？')) {
                                        await deleteSupabaseExpense(expense.id)
                                        const fresh = await getSupabaseExpenses('personal', currentUser?.username)
                                        setPersonalExpenses(fresh)
                                      }
                                    }}
                                    className="p-1.5 text-xs text-red-500 hover:bg-red-50 rounded"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Add Expense Form (Full Screen Modal for Mobile) */}
                <AnimatePresence>
                  {showExpenseForm && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center"
                      onClick={(e) => {
                        if (e.target === e.currentTarget) {
                          setShowExpenseForm(false)
                          setEditingExpense(null)
                          setExpenseForm({ amount: '', category: 'food', note: '' })
                        }
                      }}
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 100 }}
                        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
                          <h4 className="font-medium text-gray-800 text-lg">
                            {editingExpense ? '編輯支出' : '新增支出'}
                          </h4>
                          <button
                            onClick={() => {
                              setShowExpenseForm(false)
                              setEditingExpense(null)
                              setExpenseForm({ amount: '', category: 'food', note: '' })
                            }}
                            className="text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                        
                        <div className="p-5 space-y-4">
                          {/* Amount */}
                          <div>
                            <label className="block text-sm text-gray-600 mb-2">金額 (JPY)</label>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={expenseForm.amount}
                              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                              placeholder="0"
                              className="w-full px-4 py-4 text-xl font-semibold border border-gray-200 rounded-xl focus:border-amber-400 outline-none"
                              autoFocus
                            />
                          </div>
                          
                          {/* Category */}
                          <div>
                            <label className="block text-sm text-gray-600 mb-2">類別</label>
                            <div className="grid grid-cols-3 gap-2">
                              {EXPENSE_CATEGORIES.map((cat) => (
                                <button
                                  key={cat.id}
                                  onClick={() => setExpenseForm({ ...expenseForm, category: cat.id })}
                                  className={`py-3 px-3 text-sm rounded-xl border transition-colors flex items-center justify-center gap-1 ${
                                    expenseForm.category === cat.id
                                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                                      : 'border-gray-200 hover:border-gray-300'
                                  }`}
                                >
                                  <span>{cat.icon}</span>
                                  <span>{cat.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          {/* Note */}
                          <div>
                            <label className="block text-sm text-gray-600 mb-2">備註（選填）</label>
                            <input
                              type="text"
                              value={expenseForm.note}
                              onChange={(e) => setExpenseForm({ ...expenseForm, note: e.target.value })}
                              placeholder="例如：午餐拉麵"
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-amber-400 outline-none"
                            />
                          </div>
                          
                          {/* Submit */}
                          <button
                            onClick={async () => {
                              if (!expenseForm.amount) return
                              
                              const user = getCurrentUser()
                              if (!user) return
                              
                              if (editingExpense) {
                                // Update existing
                                await updateSupabaseExpense(editingExpense.id, {
                                  amount: parseFloat(expenseForm.amount),
                                  category: expenseForm.category,
                                  note: expenseForm.note || null,
                                })
                              } else {
                                // Create new
                                await createSupabaseExpense({
                                  type: walletTab,
                                  username: user.username,
                                  display_name: user.displayName,
                                  avatar_url: user.avatarUrl || null,
                                  amount: parseFloat(expenseForm.amount),
                                  category: expenseForm.category,
                                  note: expenseForm.note || null,
                                })
                              }
                              
                              // Refresh data
                              if (walletTab === 'shared') {
                                const fresh = await getSupabaseExpenses('shared')
                                setSharedExpenses(fresh)
                              } else {
                                const fresh = await getSupabaseExpenses('personal', user.username)
                                setPersonalExpenses(fresh)
                              }
                              
                              setShowExpenseForm(false)
                              setEditingExpense(null)
                              setExpenseForm({ amount: '', category: 'food', note: '' })
                              setMessage({ type: 'success', text: editingExpense ? '支出已更新！' : '支出已新增！' })
                            }}
                            className="w-full py-4 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-medium rounded-xl transition-colors text-lg"
                          >
                            {editingExpense ? '更新' : '新增'}
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Footer - Add Button */}
                {!showExpenseForm && (
                  <div className="p-4 border-t border-gray-100">
                    <button
                      onClick={() => setShowExpenseForm(true)}
                      className="w-full py-3 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="text-lg">+</span>
                      <span>新增{walletTab === 'shared' ? '共同' : '個人'}支出</span>
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trash Bin Modal */}
        <AnimatePresence>
          {showTrashBin && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowTrashBin(false)
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              >
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-800">🗑️ 垃圾桶</h3>
                    {(trashItems.trips.length + trashItems.users.length + trashItems.destinations.length) > 0 && (
                      <button
                        onClick={handleClearTrash}
                        className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                      >
                        清空垃圾桶
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-6">
                  {/* Category Tabs */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setTrashTab('trips')}
                      className={`flex-1 py-2 px-3 text-sm rounded-lg transition-colors ${
                        trashTab === 'trips'
                          ? 'bg-gray-800 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      🗓️ 行程 ({trashItems.trips.length})
                    </button>
                    <button
                      onClick={() => setTrashTab('users')}
                      className={`flex-1 py-2 px-3 text-sm rounded-lg transition-colors ${
                        trashTab === 'users'
                          ? 'bg-gray-800 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      👥 用戶 ({trashItems.users.length})
                    </button>
                    <button
                      onClick={() => setTrashTab('destinations')}
                      className={`flex-1 py-2 px-3 text-sm rounded-lg transition-colors ${
                        trashTab === 'destinations'
                          ? 'bg-gray-800 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      🌏 目的地 ({trashItems.destinations.length})
                    </button>
                  </div>

                  {/* Trash Items List */}
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {trashTab === 'trips' && (
                      trashItems.trips.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-8">沒有已刪除的行程</p>
                      ) : (
                        trashItems.trips.map((trip) => (
                          <div key={trip.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-800 truncate">{trip.title}</p>
                              <p className="text-xs text-gray-500">
                                📅 {new Date(trip.date).toLocaleDateString('zh-TW')} · 📍 {trip.location}
                              </p>
                            </div>
                            <button
                              onClick={() => handlePermanentDelete('trips', trip.id)}
                              className="ml-2 px-3 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex-shrink-0"
                            >
                              永久刪除
                            </button>
                          </div>
                        ))
                      )
                    )}
                    
                    {trashTab === 'users' && (
                      trashItems.users.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-8">沒有已刪除的用戶</p>
                      ) : (
                        trashItems.users.map((user) => (
                          <div key={user.username} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              {user.avatarUrl ? (
                                <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs">
                                  {user.displayName.charAt(0)}
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-gray-800">{user.displayName}</p>
                                <p className="text-xs text-gray-500">@{user.username}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handlePermanentDelete('users', user.username)}
                              className="px-3 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                            >
                              永久刪除
                            </button>
                          </div>
                        ))
                      )
                    )}
                    
                    {trashTab === 'destinations' && (
                      trashItems.destinations.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-8">沒有已刪除的目的地</p>
                      ) : (
                        trashItems.destinations.map((dest) => (
                          <div key={dest.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                                style={{ backgroundColor: dest.theme.primaryHex }}
                              >
                                {dest.flag}
                              </div>
                              <div>
                                <p className="font-medium text-gray-800">{dest.name}</p>
                                <p className="text-xs text-gray-500">{dest.name_en}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handlePermanentDelete('destinations', dest.id)}
                              className="px-3 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                            >
                              永久刪除
                            </button>
                          </div>
                        ))
                      )
                    )}
                  </div>

                  {/* Note */}
                  <p className="text-xs text-gray-400 mt-4 text-center">
                    ⚠️ 垃圾桶中的項目在永久刪除前不會真正從資料庫移除
                  </p>

                  {/* Close Button */}
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => setShowTrashBin(false)}
                      className="w-full py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      關閉
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form Modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) resetForm()
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              >
                <div className="p-6 border-b border-gray-100">
                  <h3 className="text-lg font-medium text-gray-800">
                    {editingTrip ? t.admin.editTrip : t.admin.addTrip}
                  </h3>
                </div>

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
                  <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t.admin.title} *
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t.admin.date} *
                      </label>
                      <input
                        type="date"
                        name="date"
                        value={formData.date}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none"
                        required
                      />
                    </div>

                    {/* Location with Place Picker */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t.admin.location} *
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
                          className="px-4 py-2 bg-sakura-100 hover:bg-sakura-200 text-sakura-700 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <span>📍</span> 選擇地點
                        </button>
                      </div>
                      {formData.location && (
                        <p className="text-xs text-gray-500 mt-1">
                          座標：{formData.lat.toFixed(4)}, {formData.lng.toFixed(4)}
                        </p>
                      )}
                    </div>

                    {/* Multi-Image Upload */}
                    <MultiMediaUpload
                      label="行程圖片（選填）"
                      value={formData.images}
                      onChange={(images) => setFormData(prev => ({ ...prev, images }))}
                      maxImages={5}
                    />

                    {/* Schedule Items */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        行程明細 *
                      </label>
                      <div className="space-y-3">
                        {formData.scheduleItems.map((item, index) => (
                          <div key={item.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                              <input
                                type="time"
                                value={item.time_start}
                                onChange={(e) => updateScheduleItem(item.id, 'time_start', e.target.value)}
                                className="px-2 py-1 text-sm rounded border border-gray-200 focus:border-sakura-400 outline-none"
                                placeholder="開始"
                              />
                              <span className="text-gray-400">至</span>
                              <input
                                type="time"
                                value={item.time_end}
                                onChange={(e) => updateScheduleItem(item.id, 'time_end', e.target.value)}
                                className="px-2 py-1 text-sm rounded border border-gray-200 focus:border-sakura-400 outline-none"
                                placeholder="結束"
                              />
                              {formData.scheduleItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeScheduleItem(item.id)}
                                  className="ml-auto text-red-500 hover:text-red-600 text-sm"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                            <input
                              type="text"
                              value={item.content}
                              onChange={(e) => updateScheduleItem(item.id, 'content', e.target.value)}
                              placeholder="輸入行程內容..."
                              className="w-full px-3 py-2 text-sm rounded border border-gray-200 focus:border-sakura-400 outline-none"
                            />
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addScheduleItem}
                          className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 hover:border-sakura-400 hover:text-sakura-600 rounded-lg transition-colors text-sm"
                        >
                          + 新增項目
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={resetForm}
                        className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {t.admin.cancel}
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
                          t.admin.update
                        ) : (
                          t.admin.create
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trips List - Grouped by Day */}
        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <div className="flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-sakura-300 border-t-sakura-600 rounded-full animate-spin" />
            </div>
          </div>
        ) : trips.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <span className="text-4xl mb-4 block">🗾</span>
            <p className="text-gray-500">{t.admin.noTripsYet}</p>
            <p className="text-sm text-gray-400 mt-2">
              {t.admin.clickToCreate}
            </p>
          </div>
        ) : (() => {
          // Helper to calculate day number
          const getDayNumber = (trip: Trip) => {
            if (!siteSettings?.tripStartDate || !trip.date) return null
            const startDate = new Date(siteSettings.tripStartDate)
            const tripDate = new Date(trip.date)
            startDate.setHours(0, 0, 0, 0)
            tripDate.setHours(0, 0, 0, 0)
            const diffTime = tripDate.getTime() - startDate.getTime()
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
            return diffDays + 1
          }
          
          // Group trips by day number
          const tripsByDay = new Map<number | null, Trip[]>()
          const sortedTrips = [...trips].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          
          sortedTrips.forEach(trip => {
            const dayNum = getDayNumber(trip)
            if (!tripsByDay.has(dayNum)) {
              tripsByDay.set(dayNum, [])
            }
            tripsByDay.get(dayNum)!.push(trip)
          })
          
          // Sort day keys
          const sortedDays = Array.from(tripsByDay.keys()).sort((a, b) => {
            if (a === null) return 1
            if (b === null) return -1
            return a - b
          })
          
          return (
            <div className="space-y-4">
              {sortedDays.map(dayNum => {
                const dayTrips = tripsByDay.get(dayNum) || []
                const isMultiple = dayTrips.length > 1
                const isExpanded = expandedDays.has(dayNum || 0)
                const firstTrip = dayTrips[0]
                const firstImage = parseImages(firstTrip.image_url)[0]
                
                // Mobile: Collapsible for multiple trips per day
                if (isMultiple) {
                  return (
                    <div key={dayNum || 'no-day'} className="md:hidden">
                      {/* Collapsed Day Card */}
                      <button
                        onClick={() => {
                          const newSet = new Set(expandedDays)
                          if (isExpanded) {
                            newSet.delete(dayNum || 0)
                          } else {
                            newSet.add(dayNum || 0)
                          }
                          setExpandedDays(newSet)
                        }}
                        className="w-full bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-200"
                      >
                        <div className="flex items-center p-4 gap-4">
                          {/* Day Badge */}
                          <div 
                            className="w-14 h-14 rounded-xl flex flex-col items-center justify-center text-white flex-shrink-0"
                            style={{ backgroundColor: themeColor }}
                          >
                            <span className="text-[10px] font-medium opacity-80">Day</span>
                            <span className="text-xl font-bold">{dayNum}</span>
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1 text-left">
                            <p className="text-sm font-semibold text-gray-800">
                              {dayTrips.length} 個行程
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(firstTrip.date).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}
                            </p>
                          </div>
                          
                          {/* Expand Icon */}
                          <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                            ▼
                          </span>
                        </div>
                      </button>
                      
                      {/* Expanded Trips */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-2 space-y-2 pl-4">
                              {dayTrips.map(trip => {
                                const tripImages = parseImages(trip.image_url)
                                const img = tripImages[0]
                                return (
                                  <div key={trip.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                                    <div className="flex items-center gap-3 p-3">
                                      {img && (
                                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                                          <img src={img} alt={trip.title} className="w-full h-full object-cover" />
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{trip.title}</p>
                                        <p className="text-xs text-gray-400 truncate">📍 {trip.location}</p>
                                      </div>
                                    </div>
                                    <div className="flex border-t border-gray-100">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleEdit(trip) }}
                                        className="flex-1 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                                      >
                                        編輯
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(trip.id) }}
                                        className="flex-1 py-2 text-xs font-medium text-red-500 hover:bg-red-50 border-l border-gray-100"
                                      >
                                        刪除
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                }
                
                // Single trip or Desktop: Show normally
                return dayTrips.map(trip => {
                  const tripImages = parseImages(trip.image_url)
                  const img = tripImages[0]
                  const dayNumber = getDayNumber(trip)
                  
                  return (
                    <div 
                      key={trip.id} 
                      className={`bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-200 ${isMultiple ? 'hidden md:block' : ''}`}
                    >
                      <div className="flex flex-col sm:flex-row">
                        {img && (
                          <div className="sm:w-40 sm:h-32 h-40 flex-shrink-0 relative sm:m-3 sm:rounded-xl overflow-hidden">
                            <img src={img} alt={trip.title} className="w-full h-full object-cover" />
                            {tripImages.length > 1 && (
                              <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                                +{tripImages.length - 1}
                              </span>
                            )}
                            {dayNumber !== null && dayNumber > 0 && (
                              <span 
                                className="absolute top-2 left-2 px-2 py-1 text-xs font-bold text-white rounded-lg"
                                style={{ backgroundColor: themeColor }}
                              >
                                Day {dayNumber}
                              </span>
                            )}
                          </div>
                        )}
                        
                        <div className="flex-1 p-4 flex flex-col justify-between">
                          <div>
                            <h3 className="text-base font-semibold text-gray-800 mb-1 line-clamp-1">{trip.title}</h3>
                            <p className="text-sm text-gray-500 mb-1">
                              {new Date(trip.date).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            <p className="text-sm text-gray-400 line-clamp-1">📍 {trip.location}</p>
                          </div>
                          <div className="hidden sm:flex items-center gap-2 mt-3">
                            <button
                              onClick={() => handleEdit(trip)}
                              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                              編輯
                            </button>
                            <button
                              onClick={() => handleDelete(trip.id)}
                              className="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              刪除
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="sm:hidden flex border-t border-gray-100">
                        <button
                          onClick={() => handleEdit(trip)}
                          className="flex-1 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          編輯
                        </button>
                        <button
                          onClick={() => handleDelete(trip.id)}
                          className="flex-1 py-3 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors border-l border-gray-100"
                        >
                          刪除
                        </button>
                      </div>
                    </div>
                  )
                })
              })}
            </div>
          )
        })()}
      </div>
      
      {/* Chiikawa Pet - only show on mobile when sakura mode is on */}
      <div className="md:hidden">
        <ChiikawaPet enabled={isSakuraMode} />
      </div>
      
      {/* Mobile: Airbnb-style Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {/* 行程 Tab */}
          <a
            href="/main"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-sakura-500 transition-colors"
          >
            <span className="text-xl mb-0.5">📋</span>
            <span className="text-[10px] font-medium">行程</span>
          </a>
          
          {/* 心願清單 Tab */}
          <a
            href="/wishlist"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-sakura-500 transition-colors"
          >
            <span className="text-xl mb-0.5">💖</span>
            <span className="text-[10px] font-medium">心願清單</span>
          </a>
          
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
            onClick={async () => {
              // Load fresh travel notice data
              let settings = getSettings()
              try {
                const freshSettings = await getSettingsAsync()
                if (freshSettings) settings = freshSettings
              } catch (err) {
                console.warn('Failed to fetch settings:', err)
              }
              setTravelEssentials(settings.travelEssentials || defaultTravelEssentials)
              setTravelPreparations(settings.travelPreparations || defaultTravelPreparations)
              setShowTravelNoticePopup(true)
            }}
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-sakura-500 transition-colors"
          >
            <span className="text-xl mb-0.5">📖</span>
            <span className="text-[10px] font-medium">旅遊須知</span>
          </button>
          
          {/* 個人資料 Tab - Active */}
          <button
            className="flex flex-col items-center justify-center flex-1 h-full text-sakura-500"
          >
            <span className="text-xl mb-0.5">👤</span>
            <span className="text-[10px] font-medium">個人資料</span>
          </button>
        </div>
      </nav>
      
      {/* Mobile: Wishlist Management Popup */}
      <AnimatePresence>
        {showWishlistManagement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/50 z-[60]"
            onClick={() => {
              setShowWishlistManagement(false)
              setEditingWishlistItem(null)
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
                <h3 className="font-medium text-gray-800 flex items-center gap-2">
                  <span>💝</span>
                  <span>心願清單管理</span>
                </h3>
                <button
                  onClick={() => {
                    setShowWishlistManagement(false)
                    setEditingWishlistItem(null)
                  }}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  ✕
                </button>
              </div>
              
              {/* Search */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                  <input
                    type="text"
                    value={wishlistSearchQuery}
                    onChange={(e) => setWishlistSearchQuery(e.target.value)}
                    placeholder="搜尋名稱..."
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sakura-400"
                  />
                </div>
              </div>
              
              {/* Wishlist Items */}
              <div className="overflow-y-auto h-[calc(85vh-130px)] p-4">
                {wishlistItems.length === 0 ? (
                  <div className="text-center py-12">
                    <span className="text-5xl mb-4 block">💝</span>
                    <p className="text-gray-500">暫無收藏項目</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {wishlistItems
                      .filter(item => !wishlistSearchQuery || item.name.toLowerCase().includes(wishlistSearchQuery.toLowerCase()))
                      .sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0))
                      .map((item) => (
                        <div key={item.id} className="bg-gray-50 rounded-xl p-3">
                          {editingWishlistItem?.id === item.id ? (
                            // Edit mode
                            <div className="space-y-3">
                              <input
                                type="text"
                                value={editingWishlistItem.name}
                                onChange={(e) => setEditingWishlistItem({ ...editingWishlistItem, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-sakura-400"
                                placeholder="名稱"
                              />
                              <textarea
                                value={editingWishlistItem.note || ''}
                                onChange={(e) => setEditingWishlistItem({ ...editingWishlistItem, note: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-sakura-400 resize-none"
                                placeholder="備註"
                                rows={2}
                              />
                              <input
                                type="url"
                                value={editingWishlistItem.link || ''}
                                onChange={(e) => setEditingWishlistItem({ ...editingWishlistItem, link: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-sakura-400"
                                placeholder="連結 (選填)"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEditingWishlistItem(null)}
                                  className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm"
                                >
                                  取消
                                </button>
                                <button
                                  onClick={() => handleUpdateWishlistItem(item, {
                                    name: editingWishlistItem.name,
                                    note: editingWishlistItem.note,
                                    link: editingWishlistItem.link,
                                  })}
                                  className="flex-1 py-2 bg-sakura-500 text-white rounded-lg text-sm"
                                >
                                  儲存
                                </button>
                              </div>
                            </div>
                          ) : (
                            // View mode
                            <div className="flex items-start gap-3">
                              {/* Image */}
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                                  <span className="text-2xl">
                                    {item.category === 'cafe' ? '☕' :
                                     item.category === 'restaurant' ? '🍽️' :
                                     item.category === 'bakery' ? '🥐' :
                                     item.category === 'shopping' ? '🛍️' :
                                     item.category === 'park' ? '🌳' :
                                     item.category === 'threads' ? '🔗' : '📌'}
                                  </span>
                                </div>
                              )}
                              
                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <h4 className="font-medium text-gray-800 text-sm truncate">{item.name}</h4>
                                  {item.is_favorite && <span className="text-red-500">❤️</span>}
                                </div>
                                {item.note && (
                                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.note}</p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                  {item.category === 'cafe' ? 'Cafe' :
                                   item.category === 'restaurant' ? '餐廳' :
                                   item.category === 'bakery' ? '麵包店' :
                                   item.category === 'shopping' ? 'Shopping' :
                                   item.category === 'park' ? 'Park' :
                                   item.category === 'threads' ? 'Threads' : item.category}
                                </p>
                              </div>
                              
                              {/* Actions */}
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  onClick={() => setEditingWishlistItem(item)}
                                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleDeleteWishlistItem(item)}
                                  className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Mobile: Travel Notice Popup (Read-only) */}
      <AnimatePresence>
        {showTravelNoticePopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/50 z-[60]"
            onClick={() => setShowTravelNoticePopup(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 h-[70vh] bg-white rounded-t-3xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Popup Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h3 className="font-medium text-gray-800">📖 旅遊須知</h3>
                <button
                  onClick={() => setShowTravelNoticePopup(false)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  ✕
                </button>
              </div>
              
              {/* Travel Notice Content - Checklist Style */}
              <div className="overflow-y-auto h-[calc(70vh-60px)]">
                {/* Travel Essentials */}
                {travelEssentials && travelEssentials.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-700 px-4 py-3 flex items-center gap-2 bg-gray-50">
                      <span>🎒</span>
                      <span>旅遊必備</span>
                    </h4>
                    <div className="divide-y divide-gray-100">
                      {travelEssentials.map((item, idx) => {
                        const itemKey = `essential_${item.icon}_${item.text}`
                        const isChecked = isItemCheckedByUser(itemKey)
                        const checkedUsers = checkedItems[itemKey] || []
                        return (
                          <div 
                            key={idx} 
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => toggleCheckItem(itemKey)}
                          >
                            {/* Checkbox */}
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              isChecked 
                                ? 'bg-green-500 border-green-500 text-white' 
                                : 'border-gray-300'
                            }`}>
                              {isChecked && <span className="text-xs">✓</span>}
                            </div>
                            <span className="text-lg">{item.icon}</span>
                            <span className={`text-sm flex-1 ${isChecked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                              {item.text}
                            </span>
                            {/* Checked users avatars */}
                            {checkedUsers.length > 0 && (
                              <div className="flex -space-x-2">
                                {checkedUsers.slice(0, 3).map((user, i) => (
                                  <img 
                                    key={i}
                                    src={user.avatarUrl || getRandomAvatar(user.username)} 
                                    alt={user.displayName}
                                    className="w-6 h-6 rounded-full border-2 border-white object-cover bg-gray-100"
                                    title={user.displayName}
                                  />
                                ))}
                                {checkedUsers.length > 3 && (
                                  <div className="w-6 h-6 rounded-full bg-gray-300 text-gray-600 text-xs flex items-center justify-center border-2 border-white">
                                    +{checkedUsers.length - 3}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                
                {/* Travel Preparations */}
                {travelPreparations && travelPreparations.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-700 px-4 py-3 flex items-center gap-2 bg-gray-50">
                      <span>📝</span>
                      <span>出發前準備</span>
                    </h4>
                    <div className="divide-y divide-gray-100">
                      {travelPreparations.map((item, idx) => {
                        const itemKey = `prep_${item.icon}_${item.text}`
                        const isChecked = isItemCheckedByUser(itemKey)
                        const checkedUsers = checkedItems[itemKey] || []
                        return (
                          <div 
                            key={idx} 
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => toggleCheckItem(itemKey)}
                          >
                            {/* Checkbox */}
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              isChecked 
                                ? 'bg-green-500 border-green-500 text-white' 
                                : 'border-gray-300'
                            }`}>
                              {isChecked && <span className="text-xs">✓</span>}
                            </div>
                            <span className="text-lg">{item.icon}</span>
                            <span className={`text-sm flex-1 ${isChecked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                              {item.text}
                            </span>
                            {/* Checked users avatars */}
                            {checkedUsers.length > 0 && (
                              <div className="flex -space-x-2">
                                {checkedUsers.slice(0, 3).map((user, i) => (
                                  <img 
                                    key={i}
                                    src={user.avatarUrl || getRandomAvatar(user.username)} 
                                    alt={user.displayName}
                                    className="w-6 h-6 rounded-full border-2 border-white object-cover bg-gray-100"
                                    title={user.displayName}
                                  />
                                ))}
                                {checkedUsers.length > 3 && (
                                  <div className="w-6 h-6 rounded-full bg-gray-300 text-gray-600 text-xs flex items-center justify-center border-2 border-white">
                                    +{checkedUsers.length - 3}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                
                {/* Empty State */}
                {(!travelEssentials?.length && !travelPreparations?.length) && (
                  <div className="text-center py-12">
                    <span className="text-5xl mb-4 block">📖</span>
                    <p className="text-gray-500">暫無旅遊須知</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Mobile: Chiikawa Dialogue Edit Popup (Admin only) */}
      <AnimatePresence>
        {showChiikawaEdit && isAdminUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/50 z-[60]"
            onClick={() => setShowChiikawaEdit(false)}
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
                <h3 className="font-medium text-gray-800">🐹 Chiikawa 對白設定</h3>
                <button
                  onClick={() => setShowChiikawaEdit(false)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  ✕
                </button>
              </div>
              
              {/* Character Tabs */}
              <div className="flex border-b border-gray-100">
                <button
                  onClick={() => setEditingCharacter('chiikawa')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    editingCharacter === 'chiikawa' 
                      ? 'text-sakura-600 border-b-2 border-sakura-500 bg-sakura-50' 
                      : 'text-gray-500'
                  }`}
                >
                  <span className="block text-xl mb-1">🐹</span>
                  ちいかわ
                </button>
                <button
                  onClick={() => setEditingCharacter('hachiware')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    editingCharacter === 'hachiware' 
                      ? 'text-sakura-600 border-b-2 border-sakura-500 bg-sakura-50' 
                      : 'text-gray-500'
                  }`}
                >
                  <span className="block text-xl mb-1">🐱</span>
                  八ちゃん
                </button>
                <button
                  onClick={() => setEditingCharacter('usagi')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    editingCharacter === 'usagi' 
                      ? 'text-sakura-600 border-b-2 border-sakura-500 bg-sakura-50' 
                      : 'text-gray-500'
                  }`}
                >
                  <span className="block text-xl mb-1">🐰</span>
                  うさぎ
                </button>
              </div>
              
              {/* Dialogue Edit Content */}
              <div className="overflow-y-auto h-[calc(85vh-220px)] p-4">
                {/* Add new message */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newChiikawaMessage}
                    onChange={(e) => setNewChiikawaMessage(e.target.value)}
                    placeholder="輸入新對白..."
                    className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sakura-400"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newChiikawaMessage.trim()) {
                        setChiikawaMessages(prev => ({
                          ...prev,
                          [editingCharacter]: [...prev[editingCharacter], newChiikawaMessage.trim()]
                        }))
                        setNewChiikawaMessage('')
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newChiikawaMessage.trim()) {
                        setChiikawaMessages(prev => ({
                          ...prev,
                          [editingCharacter]: [...prev[editingCharacter], newChiikawaMessage.trim()]
                        }))
                        setNewChiikawaMessage('')
                      }
                    }}
                    disabled={!newChiikawaMessage.trim()}
                    className="px-4 py-2.5 bg-sakura-500 hover:bg-sakura-600 disabled:bg-gray-300 text-white rounded-xl text-sm font-medium transition-colors"
                  >
                    新增
                  </button>
                </div>
                
                {/* Message list for current character */}
                <div className="space-y-2">
                  {chiikawaMessages[editingCharacter].map((msg, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl"
                    >
                      <span className="text-lg">💬</span>
                      <span className="flex-1 text-sm text-gray-700">{msg}</span>
                      <button
                        onClick={() => {
                          setChiikawaMessages(prev => ({
                            ...prev,
                            [editingCharacter]: prev[editingCharacter].filter((_, i) => i !== idx)
                          }))
                        }}
                        className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                  
                  {chiikawaMessages[editingCharacter].length === 0 && (
                    <div className="text-center py-8">
                      <span className="text-4xl mb-2 block">
                        {editingCharacter === 'chiikawa' ? '🐹' : editingCharacter === 'hachiware' ? '🐱' : '🐰'}
                      </span>
                      <p className="text-sm text-gray-400">尚未設定對白</p>
                      <p className="text-xs text-gray-400 mt-1">請新增對白</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Save Button */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
                <button
                  onClick={async () => {
                    // Save to settings
                    const settings = getSettings()
                    const updatedSettings = { ...settings, chiikawaMessages }
                    saveSettings(updatedSettings)
                    await saveSettingsAsync({ chiikawaMessages })
                    setMessage({ type: 'success', text: 'Chiikawa 對白已儲存' })
                    setShowChiikawaEdit(false)
                  }}
                  className="w-full py-3 bg-sakura-500 hover:bg-sakura-600 text-white rounded-xl font-medium transition-colors"
                >
                  儲存設定
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
