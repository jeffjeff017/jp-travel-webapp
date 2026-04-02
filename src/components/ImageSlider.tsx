'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ImageSliderProps {
  images: string[]
  className?: string
  autoPlay?: boolean
  interval?: number
  showCounter?: boolean // Show prominent counter badge (Airbnb style)
  hideArrows?: boolean // Hide navigation arrows (useful for card view on mobile)
  largeArrows?: boolean // Larger, always-visible arrows for popup/detail view
  priority?: boolean // True for above-fold images — enables eager loading
}

export default function ImageSlider({
  images,
  className = '',
  autoPlay = true,
  interval = 6000, // Default 6 seconds
  showCounter = false,
  hideArrows = false,
  largeArrows = false,
  priority = false,
}: ImageSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  // Auto play
  useEffect(() => {
    if (!autoPlay || images.length <= 1) return

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length)
    }, interval)

    return () => clearInterval(timer)
  }, [autoPlay, interval, images.length])

  const goToNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }

  const goToPrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const goToIndex = (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    setCurrentIndex(index)
  }

  if (images.length === 0) return null

  // Single image - no slider needed
  if (images.length === 1) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <img
          src={images[0]}
          alt="Trip"
          className="w-full h-full object-cover"
          loading={priority ? 'eager' : 'lazy'}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
        {/* Counter badge for single image */}
        {showCounter && (
          <div className="absolute bottom-4 right-4 bg-black/70 text-white text-sm font-medium px-3 py-1.5 rounded-lg">
            1 / 1
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden group ${className}`}>
      {/* Images - Use fade transition for stability */}
      <div className="relative w-full h-full">
        {images.map((img, index) => (
          <AnimatePresence key={index}>
            {index === currentIndex && (
              <motion.img
                src={img}
                alt={`Slide ${index + 1}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
                className="absolute inset-0 w-full h-full object-cover"
                loading={index === 0 ? (priority ? 'eager' : 'lazy') : 'lazy'}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f3f4f6" width="100" height="100"/><text x="50%" y="50%" fill="%239ca3af" font-size="12" text-anchor="middle" dy=".3em">Error</text></svg>'
                }}
              />
            )}
          </AnimatePresence>
        ))}
        {/* Placeholder to maintain size */}
        <img
          src={images[0]}
          alt=""
          className="w-full h-full object-cover invisible"
          aria-hidden="true"
          loading="lazy"
        />
      </div>

      {/* Navigation Arrows */}
      {!hideArrows && (
        <>
          <button
            onClick={goToPrev}
            className={`absolute top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/65 active:bg-black/80 text-white rounded-full flex items-center justify-center transition-all ${
              largeArrows
                ? 'left-3 w-10 h-10 text-2xl opacity-80 hover:opacity-100 shadow-lg'
                : 'left-1 w-6 h-6 text-xs opacity-0 group-hover:opacity-100'
            }`}
          >
            ‹
          </button>
          <button
            onClick={goToNext}
            className={`absolute top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/65 active:bg-black/80 text-white rounded-full flex items-center justify-center transition-all ${
              largeArrows
                ? 'right-3 w-10 h-10 text-2xl opacity-80 hover:opacity-100 shadow-lg'
                : 'right-1 w-6 h-6 text-xs opacity-0 group-hover:opacity-100'
            }`}
          >
            ›
          </button>
        </>
      )}

      {/* Dots Indicator */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
        {images.map((_, index) => (
          <button
            key={index}
            onClick={(e) => goToIndex(e, index)}
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              index === currentIndex
                ? 'bg-white w-3'
                : 'bg-white/50 hover:bg-white/80'
            }`}
          />
        ))}
      </div>

      {/* Image Counter - Prominent style when showCounter is true */}
      {showCounter ? (
        <div className="absolute bottom-4 right-4 bg-black/70 text-white text-sm font-medium px-3 py-1.5 rounded-lg">
          {currentIndex + 1} / {images.length}
        </div>
      ) : (
        <div className="absolute top-1 right-1 bg-black/40 text-white text-[10px] px-1.5 py-0.5 rounded">
          {currentIndex + 1}/{images.length}
        </div>
      )}
    </div>
  )
}
