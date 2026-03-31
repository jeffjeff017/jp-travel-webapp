// Site settings with Supabase sync
import { getSupabaseSiteSettings, saveSupabaseSiteSettings, type SiteSettingsDB, type DestinationDB, getSupabaseDestinations, DEFAULT_DESTINATIONS } from './supabase'
import { DEFAULT_FLIGHT_CX527_RETURN, DEFAULT_SEED_FLIGHTS, type FlightRecord } from './flightInfo'

const SETTINGS_KEY = 'site_settings'
/** 使用者曾透過儲存明確清空航班列表時設為 1，之後不再自動寫入預設航班 */
const FLIGHT_LIST_USER_EMPTIED_KEY = 'site_settings_flight_list_user_emptied'
const SETTINGS_CACHE_KEY = 'site_settings_cache_time'
const DESTINATION_KEY = 'current_destination'
const DESTINATIONS_CACHE_KEY = 'destinations_cache'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes cache

export interface DaySchedule {
  dayNumber: number
  theme: string
  imageUrl?: string
}

export interface TravelNoticeItem {
  id: string
  icon: string
  text: string
}

export interface SiteSettings {
  title: string
  homeLocation: {
    name: string
    address: string
    lat: number
    lng: number
    imageUrl?: string
  }
  tripStartDate: string // ISO date string
  totalDays: number // 1-7 days
  daySchedules: DaySchedule[]
  // Travel notice items (editable by admin)
  travelEssentials?: TravelNoticeItem[]
  travelPreparations?: TravelNoticeItem[]
  // reCAPTCHA setting
  recaptchaEnabled?: boolean
  // Chiikawa widget custom messages per character (editable by admin)
  chiikawaMessages?: {
    chiikawa?: string[]
    hachiware?: string[]
    usagi?: string[]
  }
  // Sakura mode enabled — synced to Supabase; admin toggles via site settings (default: true)
  sakuraModeEnabled?: boolean
  /** 個人資料「航班資料」列表（與 site_settings.flights 同步） */
  flights?: FlightRecord[]
  /** 各 Day 的 ❤️❤️ 累計（管理員於行程頁 😈 新增） */
  dayHeartCounts?: Record<number, number>
}

// Default travel notice items
export const defaultTravelEssentials: TravelNoticeItem[] = [
  { id: 'passport', icon: '🛂', text: '護照及簽證文件' },
  { id: 'money', icon: '💴', text: '日圓現金及信用卡' },
  { id: 'sim', icon: '📱', text: 'SIM卡或WiFi蛋' },
  { id: 'adapter', icon: '🔌', text: '日本規格轉換插頭' },
  { id: 'medicine', icon: '💊', text: '常備藥物' },
  { id: 'luggage', icon: '🧳', text: '輕便行李箱' },
]

export const defaultTravelPreparations: TravelNoticeItem[] = [
  { id: 'jrpass', icon: '🚃', text: '購買JR Pass或交通卡' },
  { id: 'hotel', icon: '🏨', text: '確認酒店預訂' },
  { id: 'map', icon: '📋', text: '下載離線地圖' },
  { id: 'weather', icon: '🌡️', text: '查看天氣預報' },
]

/** 解析 site_settings.day_heart_counts / localStorage */
export function parseDayHeartCounts(raw: unknown): Record<number, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<number, number> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const day = parseInt(k, 10)
    const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : parseInt(String(v), 10)
    if (!Number.isFinite(day) || day < 1 || day > 99) continue
    if (!Number.isFinite(n) || n < 0) continue
    out[day] = Math.min(n, 99999)
  }
  return out
}

export function getTotalDayHeartCounts(counts: Record<number, number> | undefined): number {
  if (!counts) return 0
  return Object.values(counts).reduce((s, n) => s + (typeof n === 'number' ? n : 0), 0)
}

const defaultSettings: SiteSettings = {
  title: '日本旅遊',
  homeLocation: {
    name: '我的住所',
    address: '4-chōme-18-6 Kamezawa, Sumida City, 東京都 130-0014, 日本',
    lat: 35.6969,
    lng: 139.8144,
  },
  tripStartDate: new Date().toISOString().split('T')[0],
  totalDays: 3,
  daySchedules: [
    { dayNumber: 1, theme: 'Day 1' },
    { dayNumber: 2, theme: 'Day 2' },
    { dayNumber: 3, theme: 'Day 3' },
  ],
  travelEssentials: defaultTravelEssentials,
  travelPreparations: defaultTravelPreparations,
  sakuraModeEnabled: true,
  flights: [...DEFAULT_SEED_FLIGHTS],
}

// Convert from Supabase format to local format
// Returns null if Supabase data is empty/default (so we can fallback to localStorage)
function fromSupabaseFormat(db: SiteSettingsDB): SiteSettings | null {
  // If Supabase has no real data (just default insert), return null to use localStorage instead
  if (!db.home_location && !db.day_schedules && !db.trip_start_date) {
    return null
  }
  
  return {
    title: db.title || defaultSettings.title,
    homeLocation: db.home_location || defaultSettings.homeLocation,
    tripStartDate: db.trip_start_date || defaultSettings.tripStartDate,
    totalDays: db.total_days || defaultSettings.totalDays,
    daySchedules: db.day_schedules || defaultSettings.daySchedules,
    travelEssentials: db.travel_essentials || defaultTravelEssentials,
    travelPreparations: db.travel_preparations || defaultTravelPreparations,
    recaptchaEnabled: db.recaptcha_enabled || false,
    chiikawaMessages: db.chiikawa_messages || undefined,
    sakuraModeEnabled: db.sakura_mode_enabled ?? true,
    flights: Array.isArray(db.flights) ? db.flights : [],
    dayHeartCounts: parseDayHeartCounts(db.day_heart_counts),
  }
}

// Convert from local format to Supabase format
function toSupabaseFormat(settings: Partial<SiteSettings>): Partial<Omit<SiteSettingsDB, 'id' | 'updated_at'>> {
  const result: Partial<Omit<SiteSettingsDB, 'id' | 'updated_at'>> = {}
  
  if (settings.title !== undefined) result.title = settings.title
  if (settings.homeLocation !== undefined) result.home_location = settings.homeLocation
  if (settings.tripStartDate !== undefined) result.trip_start_date = settings.tripStartDate
  if (settings.totalDays !== undefined) result.total_days = settings.totalDays
  if (settings.daySchedules !== undefined) result.day_schedules = settings.daySchedules
  if (settings.travelEssentials !== undefined) result.travel_essentials = settings.travelEssentials
  if (settings.travelPreparations !== undefined) result.travel_preparations = settings.travelPreparations
  if (settings.recaptchaEnabled !== undefined) result.recaptcha_enabled = settings.recaptchaEnabled
  if (settings.chiikawaMessages !== undefined) result.chiikawa_messages = settings.chiikawaMessages
  if (settings.sakuraModeEnabled !== undefined) result.sakura_mode_enabled = settings.sakuraModeEnabled
  if (settings.flights !== undefined) result.flights = settings.flights
  if (settings.dayHeartCounts !== undefined) {
    const o: Record<string, number> = {}
    for (const [k, v] of Object.entries(settings.dayHeartCounts)) {
      const n = typeof v === 'number' ? v : 0
      o[String(k)] = n
    }
    result.day_heart_counts = o
  }

  return result
}

/** Supabase 航班為空時寫入預設去程+回程；僅有舊版單筆 UO848 時補上回程 CX527 */
async function ensureDefaultFlightSeeded(settings: SiteSettings): Promise<SiteSettings> {
  let flights = Array.isArray(settings.flights) ? settings.flights : []

  if (flights.length === 0) {
    if (typeof window !== 'undefined' && localStorage.getItem(FLIGHT_LIST_USER_EMPTIED_KEY)) {
      return { ...settings, flights: [] }
    }
    const seeded = { ...settings, flights: [...DEFAULT_SEED_FLIGHTS] }
    if (typeof window !== 'undefined') {
      await saveSupabaseSiteSettings({ flights: seeded.flights })
    }
    return seeded
  }

  const hasOutboundSeed = flights.some((f) => f.id === 'uo848-20260516')
  const hasReturnSeed = flights.some((f) => f.id === 'cx527-20260522')
  if (hasOutboundSeed && !hasReturnSeed) {
    const upgraded = { ...settings, flights: [...flights, DEFAULT_FLIGHT_CX527_RETURN] }
    if (typeof window !== 'undefined') {
      await saveSupabaseSiteSettings({ flights: upgraded.flights })
    }
    return upgraded
  }

  return settings
}

// Get settings from localStorage cache
function getLocalSettings(): SiteSettings {
  if (typeof window === 'undefined') return defaultSettings

  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    const merged: SiteSettings = stored
      ? { ...defaultSettings, ...JSON.parse(stored) }
      : { ...defaultSettings }

    const flights = Array.isArray(merged.flights)
      ? merged.flights
      : defaultSettings.flights

    return {
      ...merged,
      flights,
      dayHeartCounts: parseDayHeartCounts(merged.dayHeartCounts),
    }
  } catch (e) {
    console.error('Error reading settings from localStorage:', e)
  }

  return defaultSettings
}

// Save settings to localStorage cache
function saveLocalSettings(settings: SiteSettings): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    localStorage.setItem(SETTINGS_CACHE_KEY, Date.now().toString())
    
    // Dispatch custom event to notify components of settings update
    window.dispatchEvent(new CustomEvent('settingsUpdated'))
  } catch (e) {
    console.error('Error saving settings to localStorage:', e)
  }
}

// Check if cache is still valid
function isCacheValid(): boolean {
  if (typeof window === 'undefined') return false
  
  const cacheTime = localStorage.getItem(SETTINGS_CACHE_KEY)
  if (!cacheTime) return false
  
  return Date.now() - parseInt(cacheTime) < CACHE_DURATION
}

// Synchronous get - returns cached settings (for backwards compatibility)
export function getSettings(): SiteSettings {
  return getLocalSettings()
}

// Async get - fetches from Supabase and updates cache
export async function getSettingsAsync(): Promise<SiteSettings> {
  // If cache is valid, return local settings
  if (isCacheValid()) {
    return getLocalSettings()
  }
  
  try {
    const dbSettings = await getSupabaseSiteSettings()
    
    if (dbSettings) {
      const settings = fromSupabaseFormat(dbSettings)
      if (settings) {
        const final = await ensureDefaultFlightSeeded(settings)
        saveLocalSettings(final)
        return final
      }
    }
  } catch (err) {
    console.error('Error fetching settings from Supabase:', err)
  }
  
  // Fallback to local settings when Supabase is unreachable
  return getLocalSettings()
}

// Synchronous save - saves to localStorage only (for backwards compatibility)
export function saveSettings(settings: Partial<SiteSettings>): void {
  if (typeof window === 'undefined') return
  
  const current = getLocalSettings()
  const updated = { ...current, ...settings }
  saveLocalSettings(updated)
}

// Async save - saves to both localStorage and Supabase
export async function saveSettingsAsync(settings: Partial<SiteSettings>): Promise<{ success: boolean; error: string | null }> {
  // Save to localStorage first (optimistic update)
  const current = getLocalSettings()
  const updated = { ...current, ...settings }
  if (
    typeof window !== 'undefined' &&
    settings.flights !== undefined &&
    Array.isArray(settings.flights)
  ) {
    if (settings.flights.length === 0) {
      localStorage.setItem(FLIGHT_LIST_USER_EMPTIED_KEY, '1')
    } else {
      localStorage.removeItem(FLIGHT_LIST_USER_EMPTIED_KEY)
    }
  }
  saveLocalSettings(updated)
  
  // Then sync to Supabase
  try {
    const dbFormat = toSupabaseFormat(settings)
    const result = await saveSupabaseSiteSettings(dbFormat)
    
    if (!result.success) {
      console.error('Failed to sync settings to Supabase:', result.error)
    }
    
    return result
  } catch (err: any) {
    console.error('Error saving settings to Supabase:', err)
    return { success: false, error: err.message || '儲存設定時發生錯誤' }
  }
}

// Force refresh settings from Supabase
export async function refreshSettings(): Promise<SiteSettings> {
  try {
    const dbSettings = await getSupabaseSiteSettings()
    
    if (dbSettings) {
      const settings = fromSupabaseFormat(dbSettings)
      if (settings) {
        const final = await ensureDefaultFlightSeeded(settings)
        saveLocalSettings(final)
        return final
      }
    }
  } catch (err) {
    console.error('Error refreshing settings from Supabase:', err)
  }
  
  return getLocalSettings()
}

// Migrate localStorage data to Supabase (call once)
export async function migrateSettingsToSupabase(): Promise<void> {
  const localSettings = getLocalSettings()
  
  // Check if Supabase has any data
  const dbSettings = await getSupabaseSiteSettings()
  
  // If Supabase is empty or has default values, migrate local data
  if (!dbSettings || !dbSettings.home_location) {
    console.log('Migrating settings to Supabase...')
    await saveSupabaseSiteSettings(toSupabaseFormat(localSettings))
  }
}

// ============================================
// Destination Management
// ============================================

// Get current destination from localStorage
export function getCurrentDestination(): string {
  if (typeof window === 'undefined') return 'japan'
  
  try {
    return localStorage.getItem(DESTINATION_KEY) || 'japan'
  } catch (e) {
    console.error('Error reading current destination:', e)
    return 'japan'
  }
}

// Set current destination
export function setCurrentDestination(destinationId: string): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(DESTINATION_KEY, destinationId)
  } catch (e) {
    console.error('Error saving current destination:', e)
  }
}

// Get all destinations (cached)
export function getDestinations(): DestinationDB[] {
  if (typeof window === 'undefined') {
    return DEFAULT_DESTINATIONS.map(d => ({
      ...d,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
  }
  
  try {
    const cached = localStorage.getItem(DESTINATIONS_CACHE_KEY)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch (e) {
    console.error('Error reading destinations cache:', e)
  }
  
  return DEFAULT_DESTINATIONS.map(d => ({
    ...d,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))
}

// Get destinations async (fetch from Supabase)
export async function getDestinationsAsync(): Promise<DestinationDB[]> {
  try {
    const destinations = await getSupabaseDestinations()
    
    // Cache the results
    if (typeof window !== 'undefined') {
      localStorage.setItem(DESTINATIONS_CACHE_KEY, JSON.stringify(destinations))
    }
    
    return destinations
  } catch (err) {
    console.error('Error fetching destinations:', err)
    return getDestinations()
  }
}

// Get destination by ID
export function getDestinationById(id: string): DestinationDB | undefined {
  const destinations = getDestinations()
  return destinations.find(d => d.id === id)
}

// Get current destination data
export function getCurrentDestinationData(): DestinationDB {
  const currentId = getCurrentDestination()
  const destination = getDestinationById(currentId)
  
  if (!destination) {
    // Return Japan as default
    const japan = DEFAULT_DESTINATIONS.find(d => d.id === 'japan')!
    return {
      ...japan,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }
  
  return destination
}

// Export destination type for use in components
export type { DestinationDB } from './supabase'
