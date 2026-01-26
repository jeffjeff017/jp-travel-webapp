// Site settings stored in localStorage
const SETTINGS_KEY = 'site_settings'

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

export function getSettings(): SiteSettings {
  if (typeof window === 'undefined') return defaultSettings
  
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) }
    }
  } catch (e) {
    console.error('Error reading settings:', e)
  }
  
  return defaultSettings
}

export function saveSettings(settings: Partial<SiteSettings>): void {
  if (typeof window === 'undefined') return
  
  try {
    const current = getSettings()
    const updated = { ...current, ...settings }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated))
  } catch (e) {
    console.error('Error saving settings:', e)
  }
}
