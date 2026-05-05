'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { updateTrip, deleteTrip, type Trip } from '@/lib/supabase'
import { queryKeys } from '@/hooks/useQueries'
import ImageSlider from '@/components/ImageSlider'
import PlateRichView from '@/components/PlateRichView'
import { isPlateJsonEffectivelyEmpty } from '@/lib/plateRich'

type Props = {
  open: boolean
  onClose: () => void
  trips: Trip[]
  totalDays: number
  tripStartDate: string
  daySchedules: Array<{ dayNumber: number; theme: string; imageUrl?: string }>
  themeColor: string
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

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

function getDateForDay(tripStartDate: string, dayNumber: number): string {
  if (!tripStartDate) return ''
  const startDate = new Date(tripStartDate)
  const targetDate = new Date(startDate)
  targetDate.setDate(startDate.getDate() + dayNumber - 1)
  return targetDate.toISOString().split('T')[0]
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
}: Props) {
  const queryClient = useQueryClient()
  const [selectedDay, setSelectedDay] = useState<number>(1)
  const [tabScrollLeft, setTabScrollLeft] = useState(0)
  const tabContainerRef = useRef<any>(null)
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [draggingTripId, setDraggingTripId] = useState<number | null>(null)
  const [dragOverTripId, setDragOverTripId] = useState<number | null>(null)
  const [localTrips, setLocalTrips] = useState<Trip[]>(trips)

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
        if (!a.time_start && !b.time_start) return (a.created_at || '').localeCompare(b.created_at || '')
        if (!a.time_start) return 1
        if (!b.time_start) return -1
        return a.time_start.localeCompare(b.time_start)
      })
  }, [localTrips, tripStartDate])

  const dayTrips = getTripsForDay(selectedDay)

  // Swap two trips (reorder within same day)
  const handleTripReorder = async (tripA: Trip, tripB: Trip) => {
    if (tripA.id === tripB.id) return
    // For simplicity, swap their dates (if same day) or just swap order
    const dateA = tripA.date
    const dateB = tripB.date

    await updateTrip(tripA.id, { date: dateB })
    await updateTrip(tripB.id, { date: dateA })

    const updated = localTrips.map(t => {
      if (t.id === tripA.id) return { ...t, date: dateB }
      if (t.id === tripB.id) return { ...t, date: dateA }
      return t
    })
    setLocalTrips(updated)
    await queryClient.invalidateQueries({ queryKey: queryKeys.trips })
  }

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
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                  aria-label="關閉"
                >
                  ✕
                </button>
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
                            isActive ? 'bg-sakura-500 text-white' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {formatDate(dateStr)}
                          </span>
                        </div>
                        <span className={`text-xs font-semibold ${isActive ? 'text-sakura-600' : 'text-gray-400'}`}>
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
                  <div className="p-4 space-y-3">
                    {dayTrips.map((trip, index) => {
                      const images = parseImages(trip.image_url)
                      const isDragOver = dragOverTripId === trip.id && draggingTripId !== trip.id
                      return (
                        <div
                          key={trip.id}
                          draggable
                          onDragStart={(e) => {
                            setDraggingTripId(trip.id)
                            e.dataTransfer.setData('tripId', trip.id.toString())
                            e.dataTransfer.setData('sourceDay', selectedDay.toString())
                            e.currentTarget.classList.add('opacity-50')
                          }}
                          onDragEnd={(e) => {
                            setDraggingTripId(null)
                            setDragOverTripId(null)
                            e.currentTarget.classList.remove('opacity-50')
                          }}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (draggingTripId !== trip.id) setDragOverTripId(trip.id)
                          }}
                          onDragLeave={() => setDragOverTripId(null)}
                          onDrop={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setDragOverTripId(null)
                            const tripIdA = parseInt(e.dataTransfer.getData('tripId'))
                            const sourceDay = parseInt(e.dataTransfer.getData('sourceDay'))
                            const tripA = localTrips.find(t => t.id === tripIdA)
                            if (!tripA) return
                            if (sourceDay === selectedDay && tripA.id !== trip.id) {
                              void handleTripReorder(tripA, trip)
                            }
                            setDraggingTripId(null)
                          }}
                          className={`bg-white rounded-xl border overflow-hidden transition-all ${
                            isDragOver
                              ? 'border-sakura-400 ring-2 ring-sakura-200 shadow-lg scale-[1.02]'
                              : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
                          }`}
                        >
                          {/* Trip Header Row */}
                          <div className="flex items-center gap-3 p-3">
                            {/* Drag Handle */}
                            <span className="text-gray-300 cursor-grab active:cursor-grabbing shrink-0 select-none">⠿</span>

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
                              {/* Line 1: Title */}
                              <p className="text-sm font-medium text-gray-800 truncate">{trip.title}</p>
                              {/* Line 2: Time */}
                              <div className="flex items-center gap-2">
                                {trip.time_start && (
                                  <span className="text-xs text-sakura-500 font-medium">
                                    {trip.time_start}{trip.time_end ? ` - ${trip.time_end}` : ''}
                                  </span>
                                )}
                              </div>
                              {/* Line 3: Location */}
                              {trip.location && (
                                <p className="text-xs text-gray-400 truncate">📍 {trip.location}</p>
                              )}
                              {/* Line 4: Schedule items */}
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
                    }                    )}
                  </div>
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
