'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { logout, canAccessAdmin, getUsers, updateUser, deleteUser, type User, type UserRole } from '@/lib/auth'
import {
  getTrips,
  createTrip,
  updateTrip,
  deleteTrip,
  type Trip,
} from '@/lib/supabase'
import { getSettings, saveSettings, type SiteSettings } from '@/lib/settings'
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
  const router = useRouter()
  const { t } = useLanguage()

  useEffect(() => {
    const initAdmin = async () => {
      // Small delay to ensure cookies are loaded
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (!canAccessAdmin()) {
        window.location.href = '/login'
        return
      }
      
      fetchTrips()
      
      // Load site settings
      const settings = getSettings()
      setSiteSettings(settings)
      setSettingsForm({ 
        title: settings.title,
        tripStartDate: settings.tripStartDate || new Date().toISOString().split('T')[0],
        totalDays: settings.totalDays || 3,
        daySchedules: settings.daySchedules || [],
        homeLocationImageUrl: settings.homeLocation?.imageUrl || ''
      })
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
    if (!confirm(t.admin.confirmDelete)) return

    try {
      const { success, error } = await deleteTrip(id)
      if (success) {
        setMessage({ type: 'success', text: '行程已刪除！' })
        await fetchTrips()
      } else {
        setMessage({ type: 'error', text: error || '刪除行程失敗' })
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '發生錯誤' })
    }
  }

  const handleSaveSettings = () => {
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
    
    saveSettings({ 
      title: settingsForm.title,
      tripStartDate: settingsForm.tripStartDate,
      totalDays: settingsForm.totalDays,
      daySchedules,
      homeLocation: updatedHomeLocation
    })
    setSiteSettings({ 
      ...siteSettings!, 
      title: settingsForm.title,
      tripStartDate: settingsForm.tripStartDate,
      totalDays: settingsForm.totalDays,
      daySchedules,
      homeLocation: updatedHomeLocation
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
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚙️</span>
            <h1 className="text-xl font-medium text-gray-800">{t.admin.dashboard}</h1>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitch />
            <a
              href="/main"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {t.admin.viewSite} →
            </a>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            >
              {t.admin.logout}
            </button>
          </div>
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

        {/* Site Settings Card */}
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium text-gray-800 flex items-center gap-2">
                <span>🎨</span> 網站設定
              </h3>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-gray-500">
                  標題：<span className="font-medium text-gray-700">{siteSettings?.title || '日本旅遊'}</span>
                </p>
                <p className="text-sm text-gray-500">
                  行程：<span className="font-medium text-gray-700">
                    {siteSettings?.tripStartDate 
                      ? `${new Date(siteSettings.tripStartDate).toLocaleDateString('zh-TW')} 起，共 ${siteSettings.totalDays || 3} 天`
                      : '未設定'
                    }
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              編輯設定
            </button>
          </div>
        </div>

        {/* User Management Card */}
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium text-gray-800 flex items-center gap-2">
                <span>👥</span> 用戶管理
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                管理可登入的用戶帳號
              </p>
            </div>
            <button
              onClick={() => {
                setUsers(getUsers())
                setShowUserManagement(true)
              }}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              管理用戶
            </button>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-gray-800">
            {t.admin.manageTrips} ({trips.length})
          </h2>
          <button
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
            className="px-4 py-2 bg-sakura-500 hover:bg-sakura-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span>+</span> {t.admin.addTrip}
          </button>
        </div>

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

                    {/* Day Themes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        每日主題 ({settingsForm.totalDays} 天)
                      </label>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {Array.from({ length: settingsForm.totalDays }, (_, i) => i + 1).map(day => {
                          const schedule = settingsForm.daySchedules.find(d => d.dayNumber === day)
                          const startDate = new Date(settingsForm.tripStartDate)
                          const dayDate = new Date(startDate)
                          dayDate.setDate(startDate.getDate() + day - 1)
                          const dateStr = dayDate.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
                          
                          return (
                            <div key={day} className="p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium text-sakura-600">Day {day}</span>
                                <span className="text-xs text-gray-500">({dateStr})</span>
                              </div>
                              <input
                                type="text"
                                value={schedule?.theme || ''}
                                onChange={(e) => updateDayTheme(day, e.target.value)}
                                placeholder={`Day ${day} 主題`}
                                className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none mb-2"
                              />
                              <MediaUpload
                                value={schedule?.imageUrl || ''}
                                onChange={(url) => updateDayImage(day, url)}
                                placeholder="選擇圖片"
                              />
                            </div>
                          )
                        })}
                      </div>
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
                              onClick={() => {
                                if (confirm(`確定要刪除用戶 ${user.displayName} 嗎？`)) {
                                  deleteUser(user.username)
                                  setUsers(getUsers())
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
                        onClick={() => {
                          if (!userForm.username || !userForm.password || !userForm.displayName) {
                            alert('請填寫所有欄位')
                            return
                          }
                          updateUser({
                            username: userForm.username,
                            password: userForm.password,
                            displayName: userForm.displayName,
                            role: userForm.role,
                            avatarUrl: userForm.avatarUrl || undefined
                          })
                          setUsers(getUsers())
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

        {/* Trips Table */}
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
        ) : (
          <div className="grid gap-4">
            {trips.map((trip) => {
              // Parse images
              const tripImages = parseImages(trip.image_url)
              const firstImage = tripImages[0]
              
              // Parse schedule items
              const scheduleItems = parseScheduleItems(trip.description)
              
              // Calculate day number
              const getDayNumber = () => {
                if (!siteSettings?.tripStartDate || !trip.date) return null
                const startDate = new Date(siteSettings.tripStartDate)
                const tripDate = new Date(trip.date)
                startDate.setHours(0, 0, 0, 0)
                tripDate.setHours(0, 0, 0, 0)
                const diffTime = tripDate.getTime() - startDate.getTime()
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
                return diffDays + 1
              }
              const dayNumber = getDayNumber()
              
              return (
                <div 
                  key={trip.id} 
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col md:flex-row">
                    {/* Image */}
                    {firstImage && (
                      <div className="w-full md:w-48 h-32 md:h-auto flex-shrink-0 relative">
                        <img 
                          src={firstImage} 
                          alt={trip.title}
                          className="w-full h-full object-cover"
                        />
                        {tripImages.length > 1 && (
                          <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                            +{tripImages.length - 1}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Content */}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Title & Date & Day */}
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className="text-lg font-semibold text-gray-800">
                              {trip.title}
                            </h3>
                            {dayNumber !== null && dayNumber > 0 && (
                              <span className="px-2 py-1 text-xs font-bold text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-full whitespace-nowrap">
                                Day {dayNumber}
                              </span>
                            )}
                            <span className="px-2 py-1 text-xs font-medium text-sakura-600 bg-sakura-50 rounded-full whitespace-nowrap">
                              📅 {new Date(trip.date).toLocaleDateString('zh-TW')}
                            </span>
                          </div>
                          
                          {/* Location */}
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                            <span>📍</span>
                            <span className="truncate">{trip.location}</span>
                          </div>
                          
                          {/* Coordinates */}
                          <div className="text-xs text-gray-400 mb-2">
                            座標：{trip.lat?.toFixed(4)}, {trip.lng?.toFixed(4)}
                          </div>
                          
                          {/* Schedule Items */}
                          {scheduleItems.length > 0 && scheduleItems[0].content && (
                            <div className="text-sm text-gray-600 space-y-1">
                              {scheduleItems.slice(0, 2).map((item, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                  {item.time_start && (
                                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                      {item.time_start}
                                    </span>
                                  )}
                                  <span className="line-clamp-1">{item.content}</span>
                                </div>
                              ))}
                              {scheduleItems.length > 2 && (
                                <span className="text-xs text-gray-400">
                                  +{scheduleItems.length - 2} 項目
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => handleEdit(trip)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="編輯"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(trip.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="刪除"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
