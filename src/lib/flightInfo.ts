/** 個人資料「航班資料」一筆紀錄（列表採圖1 機票卡版面） */
export type FlightRecord = {
  id: string
  flightNumber: string
  fareClass: string
  fareTag: string
  depTime: string
  depCode: string
  depDate: string
  depAirportName: string
  depTerminal: string
  arrTime: string
  arrCode: string
  arrDate: string
  arrAirportName: string
  arrTerminal: string
  /** 圖1：航空公司名稱 */
  airlineName?: string
  /** 圖1：航空公司 Logo URL（圓形頭像） */
  airlineLogoUrl?: string
  /** 圖1：機型，如 Airbus A350-900 */
  aircraftModel?: string
  /** 圖1：飛行時長（留空則依起降日期時間推算） */
  durationDisplay?: string
  /** 圖1：出發城市括號內文字，如 Hong Kong、香港 */
  depCity?: string
  /** 圖1：抵達城市 */
  arrCity?: string
  /** 圖1：底部經停說明，如 直飛、Nonstop */
  stopsLabel?: string
  /** 圖1：價格顯示，如 $1435、HKD 3200 */
  priceDisplay?: string
  /** 圖1：折扣標籤，如 -15%（空白則不顯示） */
  discountLabel?: string
}

/** 預設航班 UO848（香港 → 成田，2026-05-16） */
export const DEFAULT_FLIGHT_UO848: FlightRecord = {
  id: 'uo848-20260516',
  flightNumber: 'UO848',
  fareClass: 'U',
  fareTag: '隨心飛',
  depTime: '09:15',
  depCode: 'HKG',
  depDate: '2026-05-16',
  depAirportName: '香港國際機場',
  depTerminal: '客運大樓 1',
  arrTime: '14:45',
  arrCode: 'NRT',
  arrDate: '2026-05-16',
  arrAirportName: '成田國際機場',
  arrTerminal: '客運大樓 2',
  airlineName: 'HK Express',
  depCity: '香港',
  arrCity: '東京',
  stopsLabel: '直飛',
}

/** 預設回程 CX527（成田 → 香港，2026-05-22） */
export const DEFAULT_FLIGHT_CX527_RETURN: FlightRecord = {
  id: 'cx527-20260522',
  flightNumber: 'CX527',
  fareClass: 'Economy',
  fareTag: '經濟艙',
  depTime: '14:50',
  depCode: 'NRT',
  depDate: '2026-05-22',
  depAirportName: 'Tokyo Narita International',
  depTerminal: 'Terminal 2',
  arrTime: '18:50',
  arrCode: 'HKG',
  arrDate: '2026-05-22',
  arrAirportName: 'Hong Kong International',
  arrTerminal: 'Terminal 1',
  airlineName: 'Cathay Pacific',
  depCity: '東京',
  arrCity: '香港',
  stopsLabel: '直飛',
}

/** 首次同步／空列表時寫入的預設航班（去程 + 回程） */
export const DEFAULT_SEED_FLIGHTS: FlightRecord[] = [
  DEFAULT_FLIGHT_UO848,
  DEFAULT_FLIGHT_CX527_RETURN,
]

/** 圖1 底部：日期 + 星期（簡）+ 經停 */
export function formatFlightFooterLine(isoDate: string, stops?: string): string {
  const raw = isoDate?.trim()
  if (!raw) return stops?.trim() || ''
  const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`)
  if (Number.isNaN(d.getTime())) return stops?.trim() || ''
  const datePart = d.toLocaleDateString('zh-TW', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
  const stopPart = stops?.trim() || '直飛'
  return `${datePart} · ${stopPart}`
}

/** 依出發／抵達日期與時間推算 "13h 45m" */
export function computeFlightDurationLabel(
  depDate: string,
  depTime: string,
  arrDate: string,
  arrTime: string
): string | null {
  if (!depDate?.trim() || !depTime?.trim() || !arrDate?.trim() || !arrTime?.trim()) return null
  const dep = new Date(`${depDate}T${depTime}:00`)
  const arr = new Date(`${arrDate}T${arrTime}:00`)
  if (Number.isNaN(dep.getTime()) || Number.isNaN(arr.getTime())) return null
  let ms = arr.getTime() - dep.getTime()
  if (ms < 0) ms += 86400000
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h < 0 || (h === 0 && m <= 0)) return null
  return `${h}h ${m}m`
}

export function airportCodeCityLine(code: string, city?: string): string {
  const c = code?.trim()
  const cityT = city?.trim()
  if (!c && !cityT) return '—'
  if (cityT) return `${c} (${cityT})`
  return c || '—'
}

export function emptyFlightForm(): Omit<FlightRecord, 'id'> {
  return {
    flightNumber: '',
    fareClass: '',
    fareTag: '',
    depTime: '',
    depCode: '',
    depDate: '',
    depAirportName: '',
    depTerminal: '',
    arrTime: '',
    arrCode: '',
    arrDate: '',
    arrAirportName: '',
    arrTerminal: '',
    airlineName: '',
    airlineLogoUrl: '',
    aircraftModel: '',
    durationDisplay: '',
    depCity: '',
    arrCity: '',
    stopsLabel: '',
    priceDisplay: '',
    discountLabel: '',
  }
}

export function flightRecordFromForm(
  form: Omit<FlightRecord, 'id'>,
  id?: string
): FlightRecord {
  return {
    id:
      id ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `f-${Date.now()}`),
    ...form,
  }
}
