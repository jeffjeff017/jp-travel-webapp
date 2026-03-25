'use client'

import { useMemo, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { useWishlistItems, queryKeys } from '@/hooks/useQueries'
import { getCurrentUser, getLoggedInUsername, getUsers } from '@/lib/auth'
import { updateSupabaseWishlistItem, type WishlistItemDB } from '@/lib/supabase'
import {
  isWishlistDbItemLikedByUser,
  parseFavoritedBy,
  isWishlistLocalItemLikedByUser,
} from '@/lib/wishlistLikeUtils'
import { TOKYO_AREAS } from '@/lib/tokyoDistricts'
import { formatTripDayListBadge } from '@/lib/tripDayLabels'
import { isPlateJsonEffectivelyEmpty } from '@/lib/plateRich'
import ImageSlider from '@/components/ImageSlider'
import PlateRichView from '@/components/PlateRichView'

function parseWishlistImages(imageUrl: string | null | undefined): string[] {
  if (!imageUrl) return []
  try {
    const parsed = JSON.parse(imageUrl)
    if (Array.isArray(parsed)) return parsed.filter((s: unknown) => typeof s === 'string' && s.trim())
  } catch {
    if (imageUrl.trim()) return [imageUrl]
  }
  return []
}

function getGoogleMapsUrl(placeName: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName + ' Japan')}`
}

function isGoogleMapsLink(link?: string | null) {
  if (!link) return false
  return link.includes('google.com/maps') || link.includes('maps.google')
}

function isThreadsCategory(category: string) {
  return category === 'threads'
}

function normUser(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

const WISHLIST_CATEGORY_UI: Record<string, { icon: string; name: string }> = {
  cafe: { icon: '☕', name: 'Cafe' },
  restaurant: { icon: '🍽️', name: '餐廳' },
  bakery: { icon: '🥐', name: '麵包店' },
  shopping: { icon: '🛍️', name: 'Shopping' },
  park: { icon: '🌳', name: 'Park' },
  threads: { icon: '🔗', name: 'Threads' },
}

function HeartFilled({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  )
}

function HeartOutline({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

type Props = {
  open: boolean
  onClose: () => void
}

export default function MyLikedFoodModal({ open, onClose }: Props) {
  const queryClient = useQueryClient()
  const { data: wishlistDbItems = [], isLoading, refetch } = useWishlistItems()
  const [detailItem, setDetailItem] = useState<WishlistItemDB | null>(null)

  useEffect(() => {
    if (open) void refetch()
  }, [open, refetch])

  useEffect(() => {
    if (!open) setDetailItem(null)
  }, [open])

  const sortedItems = useMemo(() => {
    const u = getCurrentUser()?.username ?? getLoggedInUsername() ?? undefined
    if (!u?.trim() || !wishlistDbItems.length) return []
    const filtered = wishlistDbItems.filter(db => isWishlistDbItemLikedByUser(db, u))
    return [...filtered].sort((a, b) => {
      const aDay = a.added_to_trip?.day
      const bDay = b.added_to_trip?.day
      const aTrip = aDay != null && aDay !== undefined
      const bTrip = bDay != null && bDay !== undefined
      if (aTrip && !bTrip) return -1
      if (!aTrip && bTrip) return 1
      if (aTrip && bTrip) return (Number(aDay) || 0) - (Number(bDay) || 0)
      return 0
    })
  }, [wishlistDbItems])

  const handleBackdropClick = () => {
    if (detailItem) setDetailItem(null)
    else onClose()
  }

  const toggleDetailFavorite = useCallback(async () => {
    if (!detailItem) return
    const currentUsername = getCurrentUser()?.username ?? getLoggedInUsername()
    if (!currentUsername?.trim()) return

    const favoritedBy = parseFavoritedBy(detailItem.favorited_by)
    const inArray = favoritedBy.some(x => normUser(x, currentUsername))
    const localLike = {
      favoritedBy,
      isFavorite: favoritedBy.length > 0 || detailItem.is_favorite,
    }
    const isLiked = isWishlistLocalItemLikedByUser(localLike, currentUsername)
    const newFavoritedBy = isLiked
      ? inArray
        ? favoritedBy.filter(x => !normUser(x, currentUsername))
        : []
      : [...favoritedBy, currentUsername]

    try {
      const { error } = await updateSupabaseWishlistItem(detailItem.id, {
        favorited_by: newFavoritedBy,
        is_favorite: newFavoritedBy.length > 0,
      })
      if (error) {
        console.error('Failed to save like:', error)
        return
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.wishlistItems })
      await refetch()

      const updated: WishlistItemDB = {
        ...detailItem,
        favorited_by: newFavoritedBy,
        is_favorite: newFavoritedBy.length > 0,
      }
      const stillLiked = isWishlistDbItemLikedByUser(updated, currentUsername)
      if (!stillLiked) setDetailItem(null)
      else setDetailItem(updated)
    } catch (e) {
      console.error(e)
    }
  }, [detailItem, queryClient, refetch])

  const loggedInUsername = getCurrentUser()?.username ?? getLoggedInUsername() ?? ''

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-[65] flex items-center justify-center p-4"
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] sm:max-h-[80vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {detailItem ? (
              <LikedFoodDetailPanel
                item={detailItem}
                loggedInUsername={loggedInUsername}
                onBack={() => setDetailItem(null)}
                onClose={onClose}
                onToggleFavorite={toggleDetailFavorite}
              />
            ) : (
              <>
                <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <span>💝</span>
                    <span>已讚好</span>
                  </h3>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    aria-label="關閉"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {isLoading ? (
                    <div className="flex justify-center py-16">
                      <div className="w-8 h-8 border-4 border-sakura-300 border-t-sakura-600 rounded-full animate-spin" />
                    </div>
                  ) : sortedItems.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-4xl mb-3">💝</p>
                      <p>還沒有讚好的美食</p>
                      <p className="text-sm text-gray-400 mt-2">可到美食清單頁按 ❤️ 收藏</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {sortedItems.map(item => (
                        <LikedFoodCard key={item.id} item={item} onOpen={() => setDetailItem(item)} />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function LikedFoodCard({
  item,
  onOpen,
}: {
  item: WishlistItemDB
  onOpen: () => void
}) {
  const imgs = parseWishlistImages(item.image_url)
  const src = imgs[0]
  const day = item.added_to_trip?.day

  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:border-sakura-200 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sakura-400"
    >
      <div className="relative aspect-[4/3] bg-gray-100 pointer-events-none">
        {src ? (
          <img src={src} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl opacity-40">🍽️</div>
        )}
        {day != null && (
          <div className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-green-500 text-white text-[10px] font-medium rounded-full">
            Day {day}
          </div>
        )}
      </div>
      <div className="p-2 pointer-events-none">
        <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">{item.name}</p>
      </div>
    </button>
  )
}

function LikedFoodDetailPanel({
  item,
  loggedInUsername,
  onBack,
  onClose,
  onToggleFavorite,
}: {
  item: WishlistItemDB
  loggedInUsername: string
  onBack: () => void
  onClose: () => void
  onToggleFavorite: () => void
}) {
  const images = parseWishlistImages(item.image_url)
  const areaData = item.map_link ? TOKYO_AREAS.find(a => a.id === item.map_link) : undefined
  const catUi = WISHLIST_CATEGORY_UI[item.category] || { icon: '📌', name: item.category }
  const users = getUsers()

  const localLike = {
    favoritedBy: parseFavoritedBy(item.favorited_by),
    isFavorite: parseFavoritedBy(item.favorited_by).length > 0 || item.is_favorite,
  }
  const heartFilled = isWishlistLocalItemLikedByUser(localLike, loggedInUsername)

  const addedBy = item.added_by
  const adderAvatar =
    addedBy &&
    (addedBy.avatar_url ||
      users.find(u => normUser(u.username, addedBy.username))?.avatarUrl ||
      '')
  const adderDisplay = addedBy?.display_name || addedBy?.username || ''

  return (
    <>
      <div className="flex items-center justify-between gap-2 p-4 border-b border-gray-100 flex-shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-medium text-sakura-600 hover:text-sakura-700 py-1.5 px-2 -ml-2 rounded-lg hover:bg-sakura-50 transition-colors"
        >
          ← 返回
        </button>
        <span className="text-sm font-medium text-gray-500 truncate flex-1 text-center">美食詳情</span>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors shrink-0"
          aria-label="關閉"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {images.length > 0 && (
          <div className="relative aspect-video bg-gray-100">
            {images.length === 1 ? (
              <img src={images[0]} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <ImageSlider
                images={images}
                className="w-full h-full"
                autoPlay
                interval={5000}
                hideArrows={false}
                largeArrows
              />
            )}
            <div className="absolute bottom-3 right-3">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  onToggleFavorite()
                }}
                className="w-10 h-10 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:scale-105 transition-transform"
              >
                {heartFilled ? (
                  <HeartFilled className="w-5 h-5 text-rose-500" />
                ) : (
                  <HeartOutline className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>
        )}

        <div className="p-6">
          {images.length === 0 && (
            <div className="flex justify-end mb-3">
              <button
                type="button"
                onClick={onToggleFavorite}
                className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50"
              >
                {heartFilled ? (
                  <HeartFilled className="w-5 h-5 text-rose-500" />
                ) : (
                  <HeartOutline className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
              {catUi.icon} {catUi.name}
            </span>
            {areaData && (
              <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-full">
                📍 {areaData.zh} · {areaData.en}
              </span>
            )}
          </div>

          <h2 className="text-xl font-semibold text-gray-800 mb-2">{item.name}</h2>

          {item.note && !isPlateJsonEffectivelyEmpty(item.note) && (
            <div className="text-gray-600 mb-4 rounded-xl border border-gray-100 p-3 bg-gray-50/50">
              <PlateRichView json={item.note} />
            </div>
          )}

          {!isThreadsCategory(item.category) && (
            <div className="mb-4">
              {item.link && !isGoogleMapsLink(item.link) ? (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-500 hover:text-blue-600"
                >
                  <span>🔗</span>
                  <span>點擊連結轉跳</span>
                </a>
              ) : (
                <a
                  href={item.link && isGoogleMapsLink(item.link) ? item.link : getGoogleMapsUrl(item.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-500 hover:text-blue-600"
                >
                  <span>🗺️</span>
                  <span>在 Google Maps 查看</span>
                </a>
              )}
            </div>
          )}

          {isThreadsCategory(item.category) && item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-500 hover:text-blue-600 mb-4 break-all"
            >
              <span>🔗</span>
              <span className="underline">{item.link}</span>
            </a>
          )}

          {addedBy && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-xl">
              {adderAvatar ? (
                <img src={adderAvatar} alt="" className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-sakura-400 flex items-center justify-center text-white text-xs font-medium">
                  {adderDisplay.charAt(0)}
                </div>
              )}
              <span className="text-sm text-gray-500">
                由 <span className="font-medium text-gray-700">{adderDisplay}</span> 新增
              </span>
            </div>
          )}

          {item.added_to_trip?.day != null && (
            <div className="p-4 bg-green-50 rounded-xl border border-green-200">
              <Link
                href={`/main?day=${item.added_to_trip.day}`}
                onClick={onClose}
                className="flex items-center gap-2 text-green-700 hover:text-green-800 font-medium"
              >
                <span>📅</span>
                <span>已新增至 {formatTripDayListBadge(item.added_to_trip.day)}</span>
                {item.added_to_trip.time ? (
                  <span className="text-green-600 font-normal">@ {item.added_to_trip.time}</span>
                ) : null}
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
