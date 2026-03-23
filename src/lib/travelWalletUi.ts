/**
 * 主頁「旅行錢包」浮動捷徑：localStorage 未設定時預設為開啟。
 * 個人資料頁的「旅行錢包」入口一律顯示（與主頁浮球可並存）。
 */
export const TRAVEL_WALLET_HOME_BUBBLE_LS = 'travel_wallet_home_bubble'

export function isTravelWalletHomeBubbleEnabled(): boolean {
  if (typeof window === 'undefined') return true
  const v = localStorage.getItem(TRAVEL_WALLET_HOME_BUBBLE_LS)
  if (v === null || v === '') return true
  return v === '1' || v === 'true'
}

export const OPEN_TRAVEL_WALLET_QUERY = 'openTravelWallet'
