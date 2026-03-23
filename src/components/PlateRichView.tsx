'use client'

import { useId } from 'react'
import { PlateView, usePlateViewEditor } from 'platejs/react'
import { BasicBlocksPlugin, BasicMarksPlugin } from '@platejs/basic-nodes/react'
import {
  isLikelyPlateJsonString,
  parsePlateValueJson,
  extractPlainTextFromPlateJson,
} from '@/lib/plateRich'

const plugins = [BasicBlocksPlugin, BasicMarksPlugin]

/** 與編輯器內文區一致：足夠內距 + 段落／標記樣式 */
const bodyClass =
  [
    'px-4 py-4 sm:px-5 sm:py-4',
    'text-sm text-gray-800 leading-relaxed max-w-none',
    '[&_p]:m-0 [&_p]:min-h-[1.5em] [&_p+p]:mt-3',
    '[&_strong]:font-bold [&_b]:font-bold',
    '[&_em]:italic [&_u]:underline [&_s]:line-through',
    '[&_code]:font-mono [&_code]:text-[0.8125rem] [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded',
    '[&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-2 [&_h1]:first:mt-0',
    '[&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:first:mt-0',
    '[&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1',
    '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
    '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
    '[&_li]:my-0.5',
    '[&_blockquote]:border-l-4 [&_blockquote]:border-gray-200 [&_blockquote]:pl-3 [&_blockquote]:my-2',
    '[&_hr]:my-4 [&_hr]:border-gray-200',
  ].join(' ')

type Props = {
  json: string | null | undefined
  className?: string
}

/**
 * 唯讀顯示：Plate JSON 用 PlateView；純文字舊資料則直接顯示。
 */
export default function PlateRichView({ json, className = '' }: Props) {
  const viewId = useId()
  const trimmed = (json ?? '').trim()
  const isPlate = trimmed.length > 0 && isLikelyPlateJsonString(trimmed)
  const hasText = trimmed.length > 0 && extractPlainTextFromPlateJson(trimmed) !== ''

  const editor = usePlateViewEditor(
    {
      id: `plate-view-${viewId}`,
      plugins,
      value: parsePlateValueJson(isPlate ? trimmed : null),
      enabled: isPlate && hasText,
    },
    [trimmed, isPlate, hasText, viewId]
  )

  if (!trimmed) return null

  if (!isPlate) {
    return (
      <div className={`${bodyClass} whitespace-pre-wrap ${className}`}>{trimmed}</div>
    )
  }

  if (!hasText) return null
  if (!editor) return null

  return (
    <div className={`${bodyClass} ${className}`}>
      <PlateView editor={editor} />
    </div>
  )
}
