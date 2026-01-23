'use client'

import { useState, useRef } from 'react'

interface MediaUploadProps {
  value: string
  onChange: (url: string) => void
  label?: string
  placeholder?: string
  className?: string
}

export default function MediaUpload({
  value,
  onChange,
  label,
  placeholder = '選擇圖片或輸入網址',
  className = ''
}: MediaUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Convert file to base64 data URL (for local storage/preview)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('請選擇圖片檔案')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('圖片大小不能超過 5MB')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      // Convert to base64 for local storage
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result as string
        onChange(base64)
        setIsUploading(false)
      }
      reader.onerror = () => {
        setError('讀取檔案失敗')
        setIsUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      setError('上傳失敗')
      setIsUploading(false)
    }
  }

  const handleUrlChange = (url: string) => {
    onChange(url)
    setError(null)
  }

  const handleRemove = () => {
    onChange('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}

      {/* Preview */}
      {value && (
        <div className="relative mb-3 inline-block">
          <img
            src={value}
            alt="Preview"
            className="max-h-32 rounded-lg object-cover border border-gray-200"
            onError={() => setError('圖片載入失敗')}
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-sm hover:bg-red-600 transition-colors flex items-center justify-center"
          >
            ×
          </button>
        </div>
      )}

      {/* Upload Options */}
      <div className="space-y-2">
        {/* File Input */}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id={`media-upload-${label}`}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex-1 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-sakura-400 hover:text-sakura-600 transition-colors flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-300 border-t-sakura-500 rounded-full animate-spin" />
                上傳中...
              </>
            ) : (
              <>
                <span>📁</span>
                選擇檔案
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            title="輸入網址"
          >
            🔗
          </button>
        </div>

        {/* URL Input (toggleable) */}
        {showUrlInput && (
          <input
            type="url"
            value={value.startsWith('data:') ? '' : value}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none text-sm"
          />
        )}

        {/* Error Message */}
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}

        {/* Help Text */}
        <p className="text-xs text-gray-400">
          支援 JPG, PNG, GIF, WebP（最大 5MB）
        </p>
      </div>
    </div>
  )
}
