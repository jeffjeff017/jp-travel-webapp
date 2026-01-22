'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import 'react-quill/dist/quill.snow.css'

const ReactQuill = dynamic(() => import('react-quill'), {
  ssr: false,
  loading: () => (
    <div className="h-40 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-sakura-300 border-t-sakura-600 rounded-full animate-spin" />
    </div>
  ),
})

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const modules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ],
  }), [])

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'list', 'bullet',
    'link'
  ]

  return (
    <div className="rich-text-editor">
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        className="bg-white rounded-lg"
      />
      <style jsx global>{`
        .rich-text-editor .ql-container {
          min-height: 150px;
          font-size: 14px;
          border-bottom-left-radius: 0.5rem;
          border-bottom-right-radius: 0.5rem;
        }
        .rich-text-editor .ql-toolbar {
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
          background: #f9fafb;
        }
        .rich-text-editor .ql-editor {
          min-height: 120px;
        }
        .rich-text-editor .ql-editor.ql-blank::before {
          color: #9ca3af;
          font-style: normal;
        }
        .rich-text-editor .ql-toolbar.ql-snow {
          border-color: #e5e7eb;
        }
        .rich-text-editor .ql-container.ql-snow {
          border-color: #e5e7eb;
        }
        .rich-text-editor .ql-snow .ql-picker {
          color: #374151;
        }
        .rich-text-editor .ql-snow .ql-stroke {
          stroke: #6b7280;
        }
        .rich-text-editor .ql-snow .ql-fill {
          fill: #6b7280;
        }
        .rich-text-editor .ql-snow button:hover .ql-stroke,
        .rich-text-editor .ql-snow .ql-picker-label:hover .ql-stroke {
          stroke: #ec4899;
        }
        .rich-text-editor .ql-snow button:hover .ql-fill,
        .rich-text-editor .ql-snow .ql-picker-label:hover .ql-fill {
          fill: #ec4899;
        }
        .rich-text-editor .ql-snow button.ql-active .ql-stroke {
          stroke: #ec4899;
        }
        .rich-text-editor .ql-snow button.ql-active .ql-fill {
          fill: #ec4899;
        }
      `}</style>
    </div>
  )
}
