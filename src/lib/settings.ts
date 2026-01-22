// Site settings stored in localStorage
const SETTINGS_KEY = 'site_settings'

export interface SiteSettings {
  title: string
  homeLocation: {
    name: string
    address: string
    lat: number
    lng: number
  }
}

const defaultSettings: SiteSettings = {
  title: '日本旅遊',
  homeLocation: {
    name: '我的住所',
    address: '4-chōme-18-6 Kamezawa, Sumida City, 東京都 130-0014, 日本',
    lat: 35.6969,
    lng: 139.8144,
  },
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
