'use client'

import { useCallback, useState } from 'react'

/** PREAS 錦糸町 — 入住須知 PDF */
export const PREAS_STAY_NOTICE_URL =
  'https://m2mcheckin-instructions-prod.s3.amazonaws.com/bGlzdGluZy00NTQy.pdf'

/** m2m 線上驗證頁 */
export const PREAS_CHECKIN_URL =
  'https://guest-mobile.checkin.m2msystems.cloud/online/authenticate-code'

export const PREAS_CHECKIN_CODE = 'HMHT95WZN3'

const NOTICE_LABEL = '入住須知 : PREAS錦糸町'
const GUIDE_LABEL = '入住指南 : PREAS錦糸町'

type Variant = 'modal' | 'map'

type Props = {
  variant: Variant
}

/**
 * 入住須知（PDF）與入住指南（開啟驗證頁並複製驗證碼）。
 * 用於地圖 popup（modal）與地圖資訊視窗（map）；主畫面住所卡片不顯示此區塊。
 */
export default function HomeStayLinks({ variant }: Props) {
  const [tip, setTip] = useState<string | null>(null)

  const showTip = useCallback((m: string) => {
    setTip(m)
    window.setTimeout(() => setTip(null), 3200)
  }, [])

  const onCheckInClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      try {
        await navigator.clipboard.writeText(PREAS_CHECKIN_CODE)
        showTip('驗證碼已複製，請在新分頁欄位貼上（長按或 Ctrl+V）')
      } catch {
        showTip(`若無法複製，請手動輸入：${PREAS_CHECKIN_CODE}`)
      }
      window.open(PREAS_CHECKIN_URL, '_blank', 'noopener,noreferrer')
    },
    [showTip]
  )

  const isModal = variant === 'modal'

  const rowBase =
    'flex items-center gap-2 w-full text-left rounded-lg transition-colors border-0 bg-transparent cursor-pointer font-sans'

  const rowModal = `${rowBase} text-sm font-medium text-sakura-600 hover:text-sakura-700 hover:bg-sakura-50/90 px-2 py-2.5 -mx-2`
  const rowCompact = `${rowBase} text-xs text-sakura-600 hover:text-sakura-700 py-1`

  const rowClass = isModal ? rowModal : rowCompact

  const wrapClass = isModal
    ? 'mt-3 pt-3 border-t border-gray-100 space-y-0.5'
    : 'mt-2 space-y-0.5'

  const tipClass = isModal
    ? 'text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2'
    : 'text-[11px] text-amber-900 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5 mt-1.5'

  return (
    <div className={wrapClass} onClick={(e) => e.stopPropagation()}>
      <a
        href={PREAS_STAY_NOTICE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={rowClass}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-base shrink-0 leading-none" aria-hidden>
          📄
        </span>
        <span className="min-w-0 flex-1">{NOTICE_LABEL}</span>
        <span className="text-gray-400 shrink-0 text-xs" aria-hidden>
          ↗
        </span>
      </a>
      <button type="button" className={rowClass} onClick={onCheckInClick}>
        <span className="text-base shrink-0 leading-none" aria-hidden>
          🔑
        </span>
        <span className="min-w-0 flex-1">{GUIDE_LABEL}</span>
        <span className="text-gray-400 shrink-0 text-xs" aria-hidden>
          ↗
        </span>
      </button>
      {tip ? <p className={tipClass}>{tip}</p> : null}
    </div>
  )
}
