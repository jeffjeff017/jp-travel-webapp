import type { SiteSettings } from '@/lib/settings'

type DayLabelSettings = Pick<SiteSettings, 'daySchedules' | 'tripStartDate'> | null | undefined

/** 取得該日行程標題（後台 daySchedules.theme），改名後會隨 settings 更新 */
export function getDayScheduleTheme(dayNumber: number, settings: DayLabelSettings): string | undefined {
  const t = settings?.daySchedules?.find(d => d.dayNumber === dayNumber)?.theme?.trim()
  return t || undefined
}

/** 下拉選單選項：Day N · 標題 (M/D 週X) */
export function formatTripDaySelectOption(dayNumber: number, settings: DayLabelSettings): string {
  const theme = getDayScheduleTheme(dayNumber, settings)
  let datePart = ''
  if (settings?.tripStartDate) {
    const start = new Date(settings.tripStartDate)
    const t = new Date(start)
    t.setDate(start.getDate() + dayNumber - 1)
    datePart = `(${t.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' })})`
  }
  const base = `Day ${dayNumber}`
  if (theme) return `${base} · ${theme} ${datePart}`.trim()
  return `${base} ${datePart}`.trim()
}

/** 已加入行程條列：Day N · 標題（不含日期括號，較適合窄版） */
export function formatTripDayAttachedSummary(dayNumber: number, settings: DayLabelSettings): string {
  const theme = getDayScheduleTheme(dayNumber, settings)
  if (theme) return `Day ${dayNumber} · ${theme}`
  return `Day ${dayNumber}`
}

/** 清單卡片／縮圖用：只顯示 Day N，不帶行程標題 */
export function formatTripDayListBadge(dayNumber: number): string {
  return `Day ${dayNumber}`
}
