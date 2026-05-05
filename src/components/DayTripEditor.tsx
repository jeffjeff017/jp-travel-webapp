'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateTrip } from '@/lib/supabase'
import { queryKeys } from '@/hooks/useQueries'
import { saveSettingsAsync } from '@/lib/settings'
import type { Trip } from '@/lib/supabase'

interface DaySchedule {
  dayNumber: number
  theme: string
  imageUrl?: string
}

interface DayTripEditorProps {
  totalDays: number
  tripStartDate: string
  daySchedules: DaySchedule[]
  trips: Trip[]
  onDaySchedulesChange: (schedules: DaySchedule[]) => void
  onTripsChange: (trips: Trip[]) => void
}

function getDateForDay(tripStartDate: string, dayNumber: number): string {
  if (!tripStartDate) return ''
  const startDate = new Date(tripStartDate)
  const targetDate = new Date(startDate)
  targetDate.setDate(startDate.getDate() + dayNumber - 1)
  return targetDate.toISOString().split('T')[0]
}

function getDayFromDate(tripStartDate: string, dateStr: string): number {
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

export default function DayTripEditor({
  totalDays,
  tripStartDate,
  daySchedules,
  trips,
  onDaySchedulesChange,
  onTripsChange,
}: DayTripEditorProps) {
  const queryClient = useQueryClient()
  const [draggingDay, setDraggingDay] = useState<number | null>(null)
  const [dragOverDay, setDragOverDay] = useState<number | null>(null)
  const [draggingTripId, setDraggingTripId] = useState<number | null>(null)
  const [dragOverTripId, setDragOverTripId] = useState<number | null>(null)
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]))

  // Get trips for a specific day number
  const getTripsForDay = (dayNum: number) => {
    const targetDate = getDateForDay(tripStartDate, dayNum)
    return trips
      .filter(t => new Date(t.date).toISOString().split('T')[0] === targetDate)
      .sort((a, b) => {
        if (!a.time_start && !b.time_start) return (a.created_at || '').localeCompare(b.created_at || '')
        if (!a.time_start) return 1
        if (!b.time_start) return -1
        return a.time_start.localeCompare(b.time_start)
      })
  }

  // Swap two days: exchange their dayNumbers in daySchedules AND swap all trip dates
  const handleDaySwap = async (dayA: number, dayB: number) => {
    if (dayA === dayB) return
    const dateA = getDateForDay(tripStartDate, dayA)
    const dateB = getDateForDay(tripStartDate, dayB)

    // Swap daySchedules entries
    const newSchedules = daySchedules.map(d => {
      if (d.dayNumber === dayA) return { ...d, dayNumber: dayB }
      if (d.dayNumber === dayB) return { ...d, dayNumber: dayA }
      return d
    })
    onDaySchedulesChange(newSchedules)
    await saveSettingsAsync({ daySchedules: newSchedules })

    // Swap trips between days
    const tripsA = trips.filter(t => new Date(t.date).toISOString().split('T')[0] === dateA)
    const tripsB = trips.filter(t => new Date(t.date).toISOString().split('T')[0] === dateB)

    const updatedTrips = [...trips]
    for (const trip of tripsA) {
      await updateTrip(trip.id, { date: dateB })
      const idx = updatedTrips.findIndex(t => t.id === trip.id)
      if (idx !== -1) updatedTrips[idx] = { ...updatedTrips[idx], date: dateB }
    }
    for (const trip of tripsB) {
      await updateTrip(trip.id, { date: dateA })
      const idx = updatedTrips.findIndex(t => t.id === trip.id)
      if (idx !== -1) updatedTrips[idx] = { ...updatedTrips[idx], date: dateA }
    }
    onTripsChange(updatedTrips)
    await queryClient.invalidateQueries({ queryKey: queryKeys.trips })
  }

  // Swap two trips within or across days
  const handleTripSwap = async (tripA: Trip, tripB: Trip) => {
    if (tripA.id === tripB.id) return
    // Swap their dates
    const dateA = tripA.date
    const dateB = tripB.date

    await updateTrip(tripA.id, { date: dateB })
    await updateTrip(tripB.id, { date: dateA })

    const updatedTrips = trips.map(t => {
      if (t.id === tripA.id) return { ...t, date: dateB }
      if (t.id === tripB.id) return { ...t, date: dateA }
      return t
    })
    onTripsChange(updatedTrips)
    await queryClient.invalidateQueries({ queryKey: queryKeys.trips })
  }

  const toggleExpand = (day: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  return (
    <div className="space-y-1.5">
      {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
        const schedule = daySchedules.find(d => d.dayNumber === day)
        const dayTrips = getTripsForDay(day)
        const isExpanded = expandedDays.has(day)
        const dateStr = getDateForDay(tripStartDate, day)

        return (
          <div
            key={day}
            draggable
            onDragStart={(e) => {
              setDraggingDay(day)
              e.dataTransfer.setData('type', 'day')
              e.dataTransfer.setData('day', day.toString())
              e.currentTarget.classList.add('opacity-50')
            }}
            onDragEnd={(e) => {
              setDraggingDay(null)
              setDragOverDay(null)
              e.currentTarget.classList.remove('opacity-50')
            }}
            onDragOver={(e) => {
              e.preventDefault()
              if (draggingDay !== day) setDragOverDay(day)
            }}
            onDragLeave={() => setDragOverDay(null)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOverDay(null)
              const type = e.dataTransfer.getData('type')
              if (type === 'day') {
                const fromDay = parseInt(e.dataTransfer.getData('day'))
                if (fromDay !== day) void handleDaySwap(fromDay, day)
              }
              setDraggingDay(null)
            }}
            className={`rounded-xl border transition-all ${
              dragOverDay === day && draggingDay !== day
                ? 'border-sakura-400 ring-2 ring-sakura-200 bg-sakura-50'
                : 'border-gray-100 bg-white hover:border-gray-200'
            }`}
          >
            {/* Day Header */}
            <div
              className="flex items-center gap-2 px-3 py-2.5 cursor-grab active:cursor-grabbing"
              onClick={() => toggleExpand(day)}
            >
              {/* Drag Handle */}
              <span className="text-gray-300 hover:text-gray-400 shrink-0 cursor-grab">⠿</span>

              {/* Date Badge */}
              <span className="shrink-0 text-xs font-medium bg-sakura-100 text-sakura-600 px-2 py-0.5 rounded-full">
                {formatDate(dateStr)}
              </span>

              {/* Day Number + Theme */}
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-gray-800 text-sm">Day {day}</span>
                {schedule?.theme && schedule.theme !== `Day ${day}` && (
                  <span className="ml-2 text-xs text-sakura-500 truncate">· {schedule.theme}</span>
                )}
              </div>

              {/* Trip Count */}
              <span className="text-xs text-gray-400 shrink-0">
                {dayTrips.length} 項
              </span>

              {/* Expand/Collapse */}
              <span className={`text-gray-400 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </div>

            {/* Expanded Trip List */}
            {isExpanded && (
              <div className="px-3 pb-2 space-y-1">
                {dayTrips.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">尚無行程</p>
                ) : (
                  dayTrips.map(trip => {
                    const isDragOverTrip = dragOverTripId === trip.id && draggingTripId !== trip.id
                    return (
                      <div
                        key={trip.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggingTripId(trip.id)
                          e.dataTransfer.setData('type', 'trip')
                          e.dataTransfer.setData('tripId', trip.id.toString())
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
                          const type = e.dataTransfer.getData('type')
                          if (type === 'trip') {
                            const tripIdA = parseInt(e.dataTransfer.getData('tripId'))
                            const tripB = trips.find(t => t.id === tripIdA)
                            if (tripB && tripB.id !== trip.id) void handleTripSwap(tripB, trip)
                          }
                          setDraggingTripId(null)
                        }}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                          isDragOverTrip
                            ? 'border-sakura-400 bg-sakura-50'
                            : 'border-transparent hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-gray-300 text-xs shrink-0">⠿</span>
                        <span className="text-xs text-sakura-400 shrink-0 w-8">
                          {trip.time_start || '--:--'}
                        </span>
                        <span className="text-sm text-gray-700 truncate flex-1">
                          {trip.title}
                        </span>
                        <span className="text-xs text-gray-400 shrink-0 truncate max-w-[80px]">
                          {trip.location}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
