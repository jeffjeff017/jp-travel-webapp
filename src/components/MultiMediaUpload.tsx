'use client'

import { useState, useRef } from 'react'

interface MultiMediaUploadProps {
  value: string[] // Array of image URLs
  onChange: (urls: string[]) => void
  label?: string
  maxImages?: number
  className?: string
}

export default function MultiMediaUpload({
  value = [],
  onChange,
  label,
  maxImages = 5,
  className = ''
}: MultiMediaUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInputValue, setUrlInputValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Convert file to base64 data URL
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const remainingSlots = maxImages - value.length
    if (remainingSlots <= 0) {
      setError(`最多只能上傳 ${maxImages} 張圖片`)
      return
    }

    setIsUploading(true)
    setError(null)

    const filesToProcess = Array.from(files).slice(0, remainingSlots)
    const newImages: string[] = []

    for (const file of filesToProcess) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        continue
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('部分圖片大小超過 5MB，已略過')
        continue
      }

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (event) => resolve(event.target?.result as string)
          reader.onerror = () => reject(new Error('Failed to read file'))
          reader.readAsDataURL(file)
        })
        newImages.push(base64)
      } catch (err) {
        console.error('Error reading file:', err)
      }
    }

    if (newImages.length > 0) {
      onChange([...value, ...newImages])
    }

    setIsUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleAddUrl = () => {
    if (!urlInputValue.trim()) return
    if (value.length >= maxImages) {
      setError(`最多只能上傳 ${maxImages} 張圖片`)
      return
    }
    onChange([...value, urlInputValue.trim()])
    setUrlInputValue('')
    setShowUrlInput(false)
    setError(null)
  }

  const handleRemove = (index: number) => {
    const newImages = value.filter((_, i) => i !== index)
    onChange(newImages)
  }

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          <span className="text-gray-400 font-normal ml-2">
            ({value.length}/{maxImages})
          </span>
        </label>
      )}

      {/* Image Previews - Grid */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {value.map((img, index) => (
            <div key={index} className="relative group">
              <img
                src={img}
                alt={`Image ${index + 1}`}
                className="w-20 h-20 rounded-lg object-cover border border-gray-200"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%23f3f4f6" width="80" height="80"/><text x="50%" y="50%" fill="%239ca3af" font-size="10" text-anchor="middle" dy=".3em">Error</text></svg>'
                }}
              />
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
              >
                ×
              </button>
              <span className="absolute bottom-0.5 left-0.5 text-[10px] bg-black/50 text-white px-1 rounded">
                {index + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Upload Options */}
      {value.length < maxImages && (
        <div className="space-y-2">
          {/* File Input */}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id={`multi-media-upload-${label}`}
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
                  選擇圖片
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
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInputValue}
                onChange={(e) => setUrlInputValue(e.target.value)}
                placeholder="輸入圖片網址..."
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none text-sm"
                onKeyPress={(e) => e.key === 'Enter' && handleAddUrl()}
              />
              <button
                type="button"
                onClick={handleAddUrl}
                className="px-3 py-2 bg-sakura-500 text-white rounded-lg text-sm hover:bg-sakura-600 transition-colors"
              >
                新增
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          {/* Help Text */}
          <p className="text-xs text-gray-400">
            支援 JPG, PNG, GIF, WebP（每張最大 5MB）
          </p>
        </div>
      )}
    </div>
  )
}
