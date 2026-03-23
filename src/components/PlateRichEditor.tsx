'use client'

import { usePlateEditor, Plate, PlateContent } from 'platejs/react'
import {
  BasicBlocksPlugin,
  BasicMarksPlugin,
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
} from '@platejs/basic-nodes/react'
import type { PlateEditor } from 'platejs/react'
import { parsePlateValueJson } from '@/lib/plateRich'

const plugins = [BasicBlocksPlugin, BasicMarksPlugin] as const

function MarkToolbar({ editor }: { editor: PlateEditor }) {
  const btn =
    'px-2 py-1 text-xs font-medium rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
  return (
    <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-gray-100 bg-gray-50">
      <button
        type="button"
        className={`${btn} font-bold`}
        onClick={() => editor.getTransforms(BoldPlugin).bold.toggle()}
      >
        B
      </button>
      <button
        type="button"
        className={`${btn} italic`}
        onClick={() => editor.getTransforms(ItalicPlugin).italic.toggle()}
      >
        I
      </button>
      <button
        type="button"
        className={`${btn} underline`}
        onClick={() => editor.getTransforms(UnderlinePlugin).underline.toggle()}
      >
        U
      </button>
      <button
        type="button"
        className={`${btn} line-through`}
        onClick={() => editor.getTransforms(StrikethroughPlugin).strikethrough.toggle()}
      >
        S
      </button>
    </div>
  )
}

type Props = {
  /** JSON.stringify(Plate Value) */
  value: string
  onChange: (json: string) => void
  /** 用於 React key，換表單實例時重掛編輯器 */
  instanceKey: string
  placeholder?: string
  className?: string
  minHeight?: string
  label?: string
}

export default function PlateRichEditor({
  value,
  onChange,
  instanceKey,
  placeholder = '輸入內容…',
  className = '',
  minHeight = '140px',
  label,
}: Props) {
  // 必須把 instanceKey 放進 deps：Plate 內部 useMemo 不會追蹤 options.value，
  // 否則 dynamic 延遲掛載或初值稍晚對齊時，編輯器會一直停在空文件。
  const editor = usePlateEditor(
    {
      id: `plate-edit-${instanceKey}`,
      plugins: [...plugins],
      value: parsePlateValueJson(value),
    },
    [instanceKey]
  )

  return (
    <div className={className}>
      {label ? (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      ) : null}
      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white focus-within:ring-2 focus-within:ring-sakura-100 focus-within:border-sakura-400">
        <Plate
          editor={editor}
          onValueChange={({ value: v }) => {
            onChange(JSON.stringify(v))
          }}
        >
          <MarkToolbar editor={editor} />
          <PlateContent
            placeholder={placeholder}
            className="px-4 py-4 sm:px-5 sm:py-4 text-sm text-gray-800 leading-relaxed outline-none max-w-none [&_p+p]:mt-3 [&_[data-slate-placeholder]]:text-gray-400 [&_[data-slate-placeholder]]:opacity-100"
            style={{ minHeight }}
          />
        </Plate>
      </div>
    </div>
  )
}
