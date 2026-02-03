// Site settings with Supabase sync
import { getSupabaseSiteSettings, saveSupabaseSiteSettings, type SiteSettingsDB, type DestinationDB, getSupabaseDestinations, DEFAULT_DESTINATIONS } from './supabase'

const SETTINGS_KEY = 'site_settings'
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
  
  return result
}

// Get settings from localStorage cache
function getLocalSettings(): SiteSettings {
  if (typeof window === 'undefined') return defaultSettings
  
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) }
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
  
  const localSettings = getLocalSettings()
  
  try {
    const dbSettings = await getSupabaseSiteSettings()
    
    if (dbSettings) {
      const settings = fromSupabaseFormat(dbSettings)
      // If Supabase has real data, merge with local (prefer Supabase but keep local defaults)
      if (settings) {
        // Only update if Supabase data is more complete (has trips and daySchedules)
        const supabaseHasData = settings.daySchedules && settings.daySchedules.length > 0
        const localHasData = localSettings.daySchedules && localSettings.daySchedules.length > 0
        
        // If both have data, prefer the one with more totalDays (more complete data)
        // If only one has data, use that one
        if (supabaseHasData && (!localHasData || settings.totalDays >= localSettings.totalDays)) {
          saveLocalSettings(settings)
          return settings
        }
      }
    }
  } catch (err) {
    console.error('Error fetching settings from Supabase:', err)
  }
  
  // Fallback to local settings (more conservative - don't lose local data)
  return localSettings
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
        saveLocalSettings(settings)
        return settings
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
