'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { getTrips, type Trip } from '@/lib/supabase'
import { getSettings, type SiteSettings } from '@/lib/settings'
import SakuraCanvas from '@/components/SakuraCanvas'
import UsagiWidget from '@/components/UsagiWidget'
import DailyPopup from '@/components/DailyPopup'
import ModeToggle from '@/components/ModeToggle'
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

export default function MainPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSakuraMode, setIsSakuraMode] = useState(false) // Default OFF
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null)
  const { t } = useLanguage()

  useEffect(() => {
    // Load settings
    setSettings(getSettings())

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

  const toggleSakuraMode = () => {
    setIsSakuraMode(!isSakuraMode)
  }

  const handleTripClick = (tripId: number) => {
    setSelectedTripId(tripId)
  }

  return (
    <main className={`min-h-screen relative ${!isSakuraMode ? 'clean-mode' : ''}`}>
      {/* Sakura Animation - Only when toggled ON */}
      <SakuraCanvas enabled={isSakuraMode} />

      {/* Mode Toggle */}
      <ModeToggle isSakuraMode={isSakuraMode} onToggle={toggleSakuraMode} />

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
        {/* Sidebar - Trip List */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full md:w-80 lg:w-96 bg-white/90 backdrop-blur-sm border-r border-sakura-100 overflow-y-auto"
        >
          <div className="p-4">
            <h2 className="text-lg font-medium text-gray-800 mb-4 flex items-center gap-2">
              <span>📍</span> {t.main.destinations}
            </h2>

            {/* Home Location Card */}
            {settings?.homeLocation && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedTripId(-1)} // -1 for home
                className={`mb-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedTripId === -1 
                    ? 'border-blue-400 bg-blue-50' 
                    : 'border-blue-200 bg-gradient-to-r from-blue-50 to-white hover:border-blue-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🏠</span>
                  <h3 className="font-medium text-gray-800">{settings.homeLocation.name}</h3>
                </div>
                <p className="text-sm text-gray-500 ml-7">{settings.homeLocation.address}</p>
                <p className="text-xs text-blue-500 ml-7 mt-1">點擊查看位置及路線</p>
              </motion.div>
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
            ) : trips.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-4xl mb-4 block">🗾</span>
                <p className="text-gray-500">{t.main.noTrips}</p>
                <p className="text-sm text-gray-400 mt-2">
                  {t.main.addFromAdmin}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {trips.map((trip, index) => (
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
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-gray-800">
                            {trip.title}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {trip.location}
                          </p>
                        </div>
                        <span className="text-xs text-sakura-500 bg-sakura-50 px-2 py-1 rounded-full">
                          {new Date(trip.date).toLocaleDateString('zh-TW', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <div 
                        className="text-sm text-gray-600 mt-2 line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: trip.description || '' }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.aside>

        {/* Map */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex-1 relative"
        >
          <GoogleMapComponent 
            trips={trips} 
            homeLocation={settings?.homeLocation}
            selectedTripId={selectedTripId}
            onTripSelect={setSelectedTripId}
          />
        </motion.div>
      </div>

      {/* Usagi Widget - Bottom Left */}
      {isSakuraMode && <UsagiWidget />}

      {/* Daily Popup - Bottom Right */}
      <DailyPopup />
    </main>
  )
}
