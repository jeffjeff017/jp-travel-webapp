'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { logout, isAuthenticated } from '@/lib/auth'
import {
  getTrips,
  createTrip,
  updateTrip,
  deleteTrip,
  type Trip,
} from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'
import LanguageSwitch from '@/components/LanguageSwitch'

// Dynamic import for PlacePicker (client-only)
const PlacePicker = dynamic(() => import('@/components/PlacePicker'), {
  ssr: false,
  loading: () => (
    <div className="p-4 text-center">
      <div className="w-8 h-8 border-4 border-sakura-300 border-t-sakura-600 rounded-full animate-spin mx-auto" />
    </div>
  ),
})

type FormData = {
  title: string
  date: string
  info: string
  location: string
  lat: number
  lng: number
}

const initialFormData: FormData = {
  title: '',
  date: '',
  info: '',
  location: '',
  lat: 35.6762,
  lng: 139.6503,
}

export default function AdminPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showPlacePicker, setShowPlacePicker] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const router = useRouter()
  const { t } = useLanguage()

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchTrips()
  }, [router])

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
      const tripData = {
        title: formData.title,
        date: formData.date,
        info: formData.info,
        location: formData.location,
        lat: formData.lat,
        lng: formData.lng,
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
      info: trip.info,
      location: trip.location,
      lat: trip.lat,
      lng: trip.lng,
    })
    setShowForm(true)
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

                    {/* Description - HTML Textarea */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t.admin.description} *
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        支援 HTML 格式：&lt;a href=&quot;...&quot;&gt;連結&lt;/a&gt;、&lt;ul&gt;&lt;li&gt;列表&lt;/li&gt;&lt;/ul&gt;、&lt;b&gt;粗體&lt;/b&gt; 等
                      </p>
                      <textarea
                        name="info"
                        value={formData.info}
                        onChange={handleInputChange}
                        rows={6}
                        placeholder="輸入描述內容，支援 HTML 格式..."
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none resize-none font-mono text-sm"
                        required
                      />
                      {/* Preview */}
                      {formData.info && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">預覽：</p>
                          <div
                            className="text-sm text-gray-700 prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: formData.info }}
                          />
                        </div>
                      )}
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
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t.admin.title}
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t.admin.location}
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t.admin.date}
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {trips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-800">
                          {trip.title}
                        </div>
                        <div 
                          className="text-sm text-gray-500 truncate max-w-xs"
                          dangerouslySetInnerHTML={{ __html: trip.info.substring(0, 100) }}
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {trip.location}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(trip.date).toLocaleDateString('zh-TW')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(trip)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(trip.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
