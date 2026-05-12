'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { updateTrip, deleteTrip, type Trip } from '@/lib/supabase'
import { queryKeys } from '@/hooks/useQueries'
import ImageSlider from '@/components/ImageSlider'
import PlateRichView from '@/components/PlateRichView'
import { isPlateJsonEffectivelyEmpty } from '@/lib/plateRich'

type DayScheduleEntry = { dayNumber: number; theme: string; imageUrl?: string }

type Props = {
  open: boolean
  onClose: () => void
  trips: Trip[]
  totalDays: number
  tripStartDate: string
  daySchedules: DayScheduleEntry[]
  themeColor: string
  onUpdateDaySchedules?: (schedules: DayScheduleEntry[]) => void
}

function parseImages(imageUrl: string | undefined): string[] {
  if (!imageUrl) return []
  try {
    const parsed = JSON.parse(imageUrl)
    if (Array.isArray(parsed)) return parsed.filter((s: unknown) => typeof s === 'string' && s.trim())
  } catch {
    if (imageUrl.trim()) return [imageUrl]
  }
  return []
}

type ScheduleItem = {
  id: string
  time_start: string
  time_end: string
  content: string
}

function parseScheduleItems(description: string | undefined | null): ScheduleItem[] {
  if (!description) return []
  try {
    const parsed = JSON.parse(description)
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && 'content' in parsed[0]) {
      return parsed as ScheduleItem[]
    }
  } catch {
    // Not JSON, treat as plain text
  }
  return []
}

function getDateForDay(tripStartDate: string, dayNumber: number): string {
  if (!tripStartDate) return ''
  const startDate = new Date(tripStartDate)
  const targetDate = new Date(startDate)
  targetDate.setDate(startDate.getDate() + dayNumber - 1)
  return targetDate.toISOString().split('T')[0]
}

function getDayNumFromDate(tripStartDate: string, dateStr: string): number {
  if (!tripStartDate || !dateStr) return 1
  const start = new Date(tripStartDate)
  const target = new Date(dateStr)
  const diff = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return diff + 1
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

type ViewMode = 'list' | 'detail' | 'edit'

export default function ItineraryManagerModal({
  open,
  onClose,
  trips,
  totalDays,
  tripStartDate,
  daySchedules,
  themeColor,
  onUpdateDaySchedules,
}: Props) {
  const queryClient = useQueryClient()
  const [selectedDay, setSelectedDay] = useState<number>(1)
  const [tabScrollLeft, setTabScrollLeft] = useState(0)
  const tabContainerRef = useRef<any>(null)
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [localTrips, setLocalTrips] = useState<Trip[]>(trips)

  // ── Trip Order Popup (day-level reordering) ───────────────────────────────
  const [tripOrderPopupOpen, setTripOrderPopupOpen] = useState(false)
  const [tripOrderDay, setTripOrderDay] = useState<number>(1)
  const [tripOrderList, setTripOrderList] = useState<Trip[]>([])
  const [tripOrderSaving, setTripOrderSaving] = useState(false)

  const handleOpenTripOrderPopup = (day: number, tripsForDay: Trip[]) => {
    setTripOrderDay(day)
    setTripOrderList([...tripsForDay])
    setTripOrderPopupOpen(true)
  }

  const handleSaveTripOrder = async () => {
    setTripOrderSaving(true)
    try {
      // Build updated trips immediately for local state
      const updatedTrips = localTrips.map(t => {
        const ordered = tripOrderList.find((ot, idx) => ot.id === t.id)
        if (ordered) {
          const newIdx = tripOrderList.findIndex((ot, idx) => ot.id === t.id)
          return { ...t, sort_order: newIdx + 1 }
        }
        return t
      })

      const updates: Promise<unknown>[] = []
      tripOrderList.forEach((trip, idx) => {
        updates.push(
          updateTrip(trip.id, { sort_order: idx + 1 })
        )
      })
      await Promise.all(updates)

      // Update local state immediately
      setLocalTrips(updatedTrips)
      await queryClient.invalidateQueries({ queryKey: queryKeys.trips })
      setTripOrderPopupOpen(false)
    } finally {
      setTripOrderSaving(false)
    }
  }

  // ── Day Order Popup (bottom sheet) ─────────────────────────────────────────
  const [dayOrderPopupOpen, setDayOrderPopupOpen] = useState(false)
  const [dayList, setDayList] = useState<number[]>([])
  const [dayOrderSaving, setDayOrderSaving] = useState(false)

  const handleOpenDayOrderPopup = () => {
    const ordered = Array.from({ length: totalDays }, (_, i) => i + 1)
    setDayList(ordered)
    setDayOrderPopupOpen(true)
  }

  const handleSaveDayOrder = async () => {
    setDayOrderSaving(true)
    try {
      // Update localTrips dates first for immediate UI feedback
      const updatedTrips = localTrips.map(t => {
        const currentDayNum = getDayNumFromDate(tripStartDate, t.date)
        const newDayNum = dayList.indexOf(currentDayNum) + 1
        if (newDayNum !== currentDayNum) {
          return { ...t, date: getDateForDay(tripStartDate, newDayNum) }
        }
        return t
      })
      setLocalTrips(updatedTrips)

      // If day order changed, switch to the new position of the current day
      const currentDayIdx = dayList.indexOf(selectedDay)
      if (currentDayIdx !== -1 && currentDayIdx !== selectedDay - 1) {
        setSelectedDay(currentDayIdx + 1)
      }

      const updates: Promise<unknown>[] = []
      for (let i = 0; i < dayList.length; i++) {
        const day = dayList[i]
        const currentDate = getDateForDay(tripStartDate, day)
        const newDate = getDateForDay(tripStartDate, i + 1)
        if (currentDate !== newDate) {
          const tripsOnDay = localTrips.filter(t => {
            const td = new Date(t.date).toISOString().split('T')[0]
            return td === currentDate
          })
          tripsOnDay.forEach(t => {
            updates.push(updateTrip(t.id, { date: newDate }))
          })
        }
      }
      if (onUpdateDaySchedules) {
        const newSchedules = daySchedules.map(s => {
          const newDayNumber = dayList.indexOf(s.dayNumber) + 1
          return { ...s, dayNumber: newDayNumber }
        })
        await onUpdateDaySchedules(newSchedules)
      }
      await Promise.all(updates)
      await queryClient.invalidateQueries({ queryKey: queryKeys.trips })
      setDayOrderPopupOpen(false)
    } finally {
      setDayOrderSaving(false)
    }
  }

  // Sync local trips when props change
  useEffect(() => {
    setLocalTrips(trips)
  }, [trips])

  // Get trips for a specific day
  const getTripsForDay = useCallback((dayNum: number) => {
    const targetDate = getDateForDay(tripStartDate, dayNum)
    return localTrips
      .filter(t => new Date(t.date).toISOString().split('T')[0] === targetDate)
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity)
        if (!a.time_start && !b.time_start) return (a.created_at || '').localeCompare(b.created_at || '')
        if (!a.time_start) return 1
        if (!b.time_start) return -1
        return a.time_start.localeCompare(b.time_start)
      })
  }, [localTrips, tripStartDate])

  const dayTrips = getTripsForDay(selectedDay)

  // Delete a trip
  const handleDeleteTrip = async (tripId: number) => {
    if (!confirm('確定要刪除此行程嗎？')) return
    const { success } = await deleteTrip(tripId)
    if (success) {
      setLocalTrips(prev => prev.filter(t => t.id !== tripId))
      await queryClient.invalidateQueries({ queryKey: queryKeys.trips })
      if (selectedTrip?.id === tripId) {
        setSelectedTrip(null)
        setViewMode('list')
      }
    }
  }

  // Update trip inline
  const handleUpdateTrip = async (tripId: number, updates: Partial<Trip>) => {
    const { data } = await updateTrip(tripId, updates)
    if (data) {
      setLocalTrips(prev => prev.map(t => t.id === tripId ? { ...t, ...updates } : t))
      if (selectedTrip?.id === tripId) {
        setSelectedTrip(prev => prev ? { ...prev, ...updates } : null)
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.trips })
    }
  }

  const handleBack = () => {
    setViewMode('list')
    setSelectedTrip(null)
  }

  const handleOpenDetail = (trip: Trip) => {
    setSelectedTrip(trip)
    setViewMode('detail')
  }

  const handleOpenEdit = (trip: Trip) => {
    setSelectedTrip(trip)
    setViewMode('edit')
  }

  const scrollTabs = (direction: 'left' | 'right') => {
    const el = tabContainerRef.current
    if (!el) return
    const scrollAmount = el.offsetWidth * 0.6
    el.scrollBy({ left: direction === 'right' ? scrollAmount : -scrollAmount, behavior: 'smooth' })
    setTabScrollLeft(el.scrollLeft)
  }

  const handleTabScroll = () => {
    const el = tabContainerRef.current
    if (!el) return
    setTabScrollLeft(el.scrollLeft)
  }


  const canScrollLeft = tabScrollLeft > 5
  const maxDaysToShow = 3
  const canScrollRight = totalDays > maxDaysToShow

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            if (viewMode !== 'list') handleBack()
            else onClose()
          }
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[min(90dvh,calc(100dvh-5.5rem-env(safe-area-inset-bottom,0px)))] sm:max-h-[85vh] flex flex-col min-h-0 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {viewMode === 'list' ? (
            <>
              {/* Header */}
              <div
                className="flex items-center justify-between px-5 py-4 flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}cc 100%)` }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  <h2 className="text-white font-semibold text-lg">行程管理</h2>
                  <span className="text-white/70 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                    {localTrips.length} 項
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenDayOrderPopup}
                    className="flex items-center gap-1 text-sm font-medium text-white/90 hover:text-white py-1.5 px-3 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    ↕ 排序
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                    aria-label="關閉"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Day Tabs */}
              <div className="flex-shrink-0 border-b border-gray-100 relative">
                {/* Left scroll arrow */}
                {canScrollLeft && (
                  <button
                    type="button"
                    onClick={() => scrollTabs('left')}
                    className="absolute left-0 top-0 bottom-0 z-10 w-8 flex items-center justify-center bg-gradient-to-r from-white to-transparent text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="上一個"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}

                {/* Right scroll arrow */}
                {canScrollRight && (
                  <button
                    type="button"
                    onClick={() => scrollTabs('right')}
                    className="absolute right-0 top-0 bottom-0 z-10 w-8 flex items-center justify-center bg-gradient-to-l from-white to-transparent text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="下一個"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}

                {/* Tabs */}
                <div
                  ref={tabContainerRef}
                  onScroll={handleTabScroll}
                  className="flex overflow-x-auto scrollbar-hide px-2"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
                    const count = getTripsForDay(day).length
                    const schedule = daySchedules.find(d => d.dayNumber === day)
                    const dateStr = getDateForDay(tripStartDate, day)
                    const isActive = selectedDay === day

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSelectedDay(day)}
                        style={{ minWidth: '25%', maxWidth: '25%' }}
                        className={`flex flex-col items-center gap-0.5 px-2 py-3 border-b-2 transition-all shrink-0 ${
                          isActive
                            ? 'border-sakura-500'
                            : 'border-transparent hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                            isActive
                              ? 'bg-sakura-500 text-white'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {formatDate(dateStr)}
                          </span>
                        </div>
                        <span className={`text-xs font-semibold ${
                          isActive ? 'text-sakura-600' : 'text-gray-400'
                        }`}>
                          Day {day}
                        </span>
                        {schedule?.theme && schedule.theme !== `Day ${day}` && (
                          <span className="text-[10px] text-gray-400 truncate max-w-[80px]">{schedule.theme}</span>
                        )}
                        {count > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            isActive ? 'bg-sakura-100 text-sakura-600' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Trip List */}
              <div className="flex-1 min-h-0 overflow-y-auto modal-scroll overscroll-contain">
                {dayTrips.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <span className="text-5xl mb-4">📭</span>
                    <p className="text-sm font-medium">Day {selectedDay} 尚無行程</p>
                    <p className="text-xs mt-1">可到行程頁新增行程</p>
                  </div>
                ) : (
                  <>
                    {/* Trip List Header */}
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                      <span className="text-xs text-gray-400">{dayTrips.length} 項行程</span>
                      <button
                        type="button"
                        onClick={() => handleOpenTripOrderPopup(selectedDay, dayTrips)}
                        className="flex items-center gap-1 text-xs font-medium text-sakura-500 hover:text-sakura-600 px-2 py-1 rounded-lg hover:bg-sakura-50 transition-colors"
                      >
                        ↕ 排序
                      </button>
                    </div>
                    <div className="px-4 space-y-3 pb-4">
                      {dayTrips.map((trip, index) => {
                        const images = parseImages(trip.image_url)
                        return (
                          <div
                            key={trip.id}
                            className="bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm overflow-hidden transition-all"
                          >
                            {/* Trip Header Row */}
                            <div className="flex items-center gap-3 p-3">
                              {/* Order Number */}
                              <span className="text-xs font-medium text-gray-400 w-5 text-center shrink-0">{index + 1}</span>

                              {/* Image Thumb */}
                              {images.length > 0 ? (
                                <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                                  <img
                                    src={images[0]}
                                    alt={trip.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-2xl opacity-30">🗾</span>
                                </div>
                              )}

                              {/* Content */}
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <p className="text-sm font-medium text-gray-800 truncate">{trip.title}</p>
                                <div className="flex items-center gap-2">
                                  {trip.time_start && (
                                    <span className="text-xs text-sakura-500 font-medium">
                                      {trip.time_start}{trip.time_end ? ` - ${trip.time_end}` : ''}
                                    </span>
                                  )}
                                </div>
                                {trip.location && (
                                  <p className="text-xs text-gray-400 truncate">📍 {trip.location}</p>
                                )}
                                {(() => {
                                  const items = parseScheduleItems(trip.description)
                                  if (items.length === 0) return null
                                  return (
                                    <p className="text-xs text-gray-400 truncate">
                                      {items.map(item => item.content).join(' · ')}
                                    </p>
                                  )
                                })()}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenDetail(trip)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                                  title="查看詳情"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(trip)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-sakura-500 hover:bg-sakura-50 transition-colors"
                                  title="編輯行程"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </>
          ) : viewMode === 'detail' && selectedTrip ? (
            <TripDetailView
              trip={selectedTrip}
              onBack={handleBack}
              onClose={onClose}
              onEdit={() => setViewMode('edit')}
              onDelete={() => void handleDeleteTrip(selectedTrip.id)}
              totalDays={totalDays}
              tripStartDate={tripStartDate}
              themeColor={themeColor}
            />
          ) : viewMode === 'edit' && selectedTrip ? (
            <TripEditView
              trip={selectedTrip}
              onBack={handleBack}
              onSave={async (updates) => {
                await handleUpdateTrip(selectedTrip.id, updates)
                setViewMode('list')
              }}
              totalDays={totalDays}
              tripStartDate={tripStartDate}
              themeColor={themeColor}
            />
          ) : null}

          {/* Day Order Popup */}
          <DayOrderPopup
            open={dayOrderPopupOpen}
            onClose={() => setDayOrderPopupOpen(false)}
            dayList={dayList}
            setDayList={setDayList}
            tripStartDate={tripStartDate}
            themeColor={themeColor}
            daySchedules={daySchedules}
            onSave={handleSaveDayOrder}
            saving={dayOrderSaving}
          />

          {/* Trip Order Popup */}
          <TripOrderPopup
            open={tripOrderPopupOpen}
            onClose={() => setTripOrderPopupOpen(false)}
            day={tripOrderDay}
            tripList={tripOrderList}
            setTripList={setTripOrderList}
            themeColor={themeColor}
            onSave={handleSaveTripOrder}
            saving={tripOrderSaving}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Trip Detail View ──────────────────────────────────────────────────────

function TripDetailView({
  trip,
  onBack,
  onClose,
  onEdit,
  onDelete,
  totalDays,
  tripStartDate,
  themeColor,
}: {
  trip: Trip
  onBack: () => void
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  totalDays: number
  tripStartDate: string
  themeColor: string
}) {
  const images = parseImages(trip.image_url)

  const getDayNum = (dateStr: string) => {
    if (!tripStartDate) return 1
    const start = new Date(tripStartDate)
    const target = new Date(dateStr)
    const diff = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return diff + 1
  }

  const dayNum = getDayNum(trip.date)

  return (
    <>
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-gray-100 flex-shrink-0" style={{ backgroundColor: themeColor }}>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-medium text-white/90 hover:text-white py-1.5 px-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          ← 返回
        </button>
        <span className="text-sm font-medium text-white truncate flex-1 text-center">行程詳情</span>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          aria-label="關閉"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain modal-scroll">
        {images.length > 0 && (
          <div className="relative bg-gray-100" style={{ aspectRatio: '16/9' }}>
            <ImageSlider images={images} className="w-full h-full" autoPlay interval={4000} hideArrows={false} />
          </div>
        )}

        <div className="p-5 space-y-4">
          {/* Day Badge */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: themeColor }}>
              Day {dayNum}
            </span>
            {trip.time_start && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-sakura-50 text-sakura-600">
                {trip.time_start}{trip.time_end ? ` - ${trip.time_end}` : ''}
              </span>
            )}
          </div>

          <h2 className="text-xl font-semibold text-gray-800">{trip.title}</h2>

          {trip.location && (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <span>📍</span>
              <span>{trip.location}</span>
            </div>
          )}

          {trip.description && trip.description.trim() && (
            <div className="prose prose-sm max-w-none p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div dangerouslySetInnerHTML={{ __html: trip.description }} />
            </div>
          )}

          {trip.trip_notes_rich && !isPlateJsonEffectivelyEmpty(trip.trip_notes_rich) && (
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-gray-600">行程備註</h3>
              <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                <PlateRichView json={trip.trip_notes_rich} />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onEdit}
              className="flex-1 py-2.5 text-sm font-medium text-white rounded-xl transition-colors flex items-center justify-center gap-2"
              style={{ backgroundColor: themeColor }}
            >
              ✏️ 編輯行程
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="px-4 py-2.5 text-sm font-medium text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Trip Edit View ────────────────────────────────────────────────────────

function TripEditView({
  trip,
  onBack,
  onSave,
  totalDays,
  tripStartDate,
  themeColor,
}: {
  trip: Trip
  onBack: () => void
  onSave: (updates: Partial<Trip>) => void
  totalDays: number
  tripStartDate: string
  themeColor: string
}) {
  const [title, setTitle] = useState(trip.title)
  const [date, setDate] = useState(trip.date)
  const [timeStart, setTimeStart] = useState(trip.time_start || '')
  const [timeEnd, setTimeEnd] = useState(trip.time_end || '')
  const [location, setLocation] = useState(trip.location)
  const [description, setDescription] = useState(trip.description || '')
  const [saving, setSaving] = useState(false)

  const getDayNum = (dateStr: string) => {
    if (!tripStartDate) return 1
    const start = new Date(tripStartDate)
    const target = new Date(dateStr)
    const diff = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return diff + 1
  }

  const currentDay = getDayNum(trip.date)

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    await onSave({
      title: title.trim(),
      date,
      time_start: timeStart || undefined,
      time_end: timeEnd || undefined,
      location,
      description,
    })
    setSaving(false)
  }

  // Day selector
  const handleDayChange = (newDayNum: number) => {
    const newDate = getDateForDay(tripStartDate, newDayNum)
    setDate(newDate)
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-gray-100 flex-shrink-0" style={{ backgroundColor: themeColor }}>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-medium text-white/90 hover:text-white py-1.5 px-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          ← 返回
        </button>
        <span className="text-sm font-medium text-white truncate flex-1 text-center">編輯行程</span>
        <button
          type="button"
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          aria-label="取消"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain modal-scroll p-5 space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">標題 *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none text-sm"
            placeholder="行程標題"
            required
          />
        </div>

        {/* Day selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">天數</label>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => (
              <button
                key={day}
                type="button"
                onClick={() => handleDayChange(day)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  getDayNum(date) === day
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                style={getDayNum(date) === day ? { backgroundColor: themeColor } : {}}
              >
                Day {day}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">日期 *</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none text-sm"
            required
          />
        </div>

        {/* Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">開始時間</label>
            <input
              type="time"
              value={timeStart}
              onChange={e => setTimeStart(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">結束時間</label>
            <input
              type="time"
              value={timeEnd}
              onChange={e => setTimeEnd(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none text-sm"
            />
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">地點</label>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none text-sm"
            placeholder="地點名稱"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">行程明細</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={5}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none text-sm resize-none"
            placeholder="行程說明..."
          />
        </div>

        {/* Save Button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="w-full py-3 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-50"
          style={{ backgroundColor: themeColor }}
        >
          {saving ? '儲存中...' : '💾 儲存變更'}
        </button>
      </div>
    </>
  )
}

// ── Day Order Popup (bottom sheet) ─────────────────────────────────────────

function DayOrderPopup({
  open,
  onClose,
  dayList,
  setDayList,
  tripStartDate,
  themeColor,
  daySchedules,
  onSave,
  saving,
}: {
  open: boolean
  onClose: () => void
  dayList: number[]
  setDayList: React.Dispatch<React.SetStateAction<number[]>>
  tripStartDate: string
  themeColor: string
  daySchedules: DayScheduleEntry[]
  onSave: () => void
  saving: boolean
}) {
  const moveUp = (idx: number) => {
    if (idx === 0) return
    setDayList(prev => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  const moveDown = (idx: number) => {
    setDayList(prev => {
      if (idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[80] flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="bg-white rounded-t-3xl shadow-2xl w-full max-w-md max-h-[70dvh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 rounded-t-3xl flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}cc 100%)` }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">↕</span>
              <h3 className="text-white font-semibold text-base">調整天數順序</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              aria-label="關閉"
            >
              ✕
            </button>
          </div>

          {/* Instruction */}
          <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
            <p className="text-xs text-gray-400 text-center">
              使用上下箭頭調整順序，完成後按下「確認」
            </p>
          </div>

          {/* Day List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
            {dayList.map((day, displayOrder) => {
              const schedule = daySchedules.find(d => d.dayNumber === day)
              const dateStr = getDateForDay(tripStartDate, day)

              return (
                <div
                  key={day}
                  className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-all"
                >
                  {/* Position Badge */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: themeColor }}
                  >
                    {displayOrder + 1}
                  </div>

                  {/* Day Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">Day {day}</span>
                      {schedule?.theme && schedule.theme !== `Day ${day}` && (
                        <span className="text-xs text-gray-400 truncate">{schedule.theme}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(dateStr)}</span>
                  </div>

                  {/* Trip count dot */}
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: themeColor }}
                  />

                  {/* Move Up Button */}
                  <button
                    type="button"
                    onClick={() => moveUp(displayOrder)}
                    disabled={displayOrder === 0}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-sakura-500 hover:bg-sakura-50 transition-colors disabled:opacity-25 disabled:cursor-not-allowed shrink-0"
                    aria-label="往上移動"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>

                  {/* Move Down Button */}
                  <button
                    type="button"
                    onClick={() => moveDown(displayOrder)}
                    disabled={displayOrder === dayList.length - 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-sakura-500 hover:bg-sakura-50 transition-colors disabled:opacity-25 disabled:cursor-not-allowed shrink-0"
                    aria-label="往下移動"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>

          {/* Footer Actions */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-3 text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="flex-1 py-3 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-50"
              style={{ backgroundColor: themeColor }}
            >
              {saving ? '儲存中...' : '確認'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Trip Order Popup (day-level reordering) ─────────────────────────────────

function TripOrderPopup({
  open,
  onClose,
  day,
  tripList,
  setTripList,
  themeColor,
  onSave,
  saving,
}: {
  open: boolean
  onClose: () => void
  day: number
  tripList: Trip[]
  setTripList: React.Dispatch<React.SetStateAction<Trip[]>>
  themeColor: string
  onSave: () => void
  saving: boolean
}) {
  const moveUp = (idx: number) => {
    if (idx === 0) return
    setTripList(prev => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  const moveDown = (idx: number) => {
    setTripList(prev => {
      if (idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[80] flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="bg-white rounded-t-3xl shadow-2xl w-full max-w-md max-h-[70dvh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 rounded-t-3xl flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}cc 100%)` }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">↕</span>
              <h3 className="text-white font-semibold text-base">Day {day} 行程排序</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              aria-label="關閉"
            >
              ✕
            </button>
          </div>

          {/* Instruction */}
          <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
            <p className="text-xs text-gray-400 text-center">
              使用上下箭頭調整順序，完成後按下「確認」
            </p>
          </div>

          {/* Trip List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
            {tripList.map((trip, idx) => {
              const images = parseImages(trip.image_url)

              return (
                <div
                  key={trip.id}
                  className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-all"
                >
                  {/* Order Badge */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: themeColor }}
                  >
                    {idx + 1}
                  </div>

                  {/* Image Thumb */}
                  {images.length > 0 ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                      <img src={images[0]} alt={trip.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg opacity-30">🗾</span>
                    </div>
                  )}

                  {/* Trip Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{trip.title}</p>
                    {trip.time_start && (
                      <p className="text-xs text-sakura-500 truncate">
                        {trip.time_start}{trip.time_end ? ` - ${trip.time_end}` : ''}
                      </p>
                    )}
                    {trip.location && (
                      <p className="text-xs text-gray-400 truncate">📍 {trip.location}</p>
                    )}
                  </div>

                  {/* Move Up Button */}
                  <button
                    type="button"
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-sakura-500 hover:bg-sakura-50 transition-colors disabled:opacity-25 disabled:cursor-not-allowed shrink-0"
                    aria-label="往上移動"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>

                  {/* Move Down Button */}
                  <button
                    type="button"
                    onClick={() => moveDown(idx)}
                    disabled={idx === tripList.length - 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-sakura-500 hover:bg-sakura-50 transition-colors disabled:opacity-25 disabled:cursor-not-allowed shrink-0"
                    aria-label="往下移動"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>

          {/* Footer Actions */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-3 text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="flex-1 py-3 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-50"
              style={{ backgroundColor: themeColor }}
            >
              {saving ? '儲存中...' : '確認'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
