/**
 * 主頁「旅行錢包」浮動捷徑：localStorage 未設定時預設為開啟（開啟）。
 * 開啟時個人資料頁隱藏旅行錢包方塊；若設為關閉則恢復個人資料內入口。
 */
export const TRAVEL_WALLET_HOME_BUBBLE_LS = 'travel_wallet_home_bubble'

export function isTravelWalletHomeBubbleEnabled(): boolean {
  if (typeof window === 'undefined') return true
  const v = localStorage.getItem(TRAVEL_WALLET_HOME_BUBBLE_LS)
  if (v === null || v === '') return true
  return v === '1' || v === 'true'
}

/** 個人資料頁是否顯示「旅行錢包」卡片／按鈕 */
export function shouldShowTravelWalletProfileTile(): boolean {
  return !isTravelWalletHomeBubbleEnabled()
}

export const OPEN_TRAVEL_WALLET_QUERY = 'openTravelWallet'
