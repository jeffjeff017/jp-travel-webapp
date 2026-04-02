/**
 * Server Component — prefetches wishlist + checklist data on the server
 * before the page is sent to the browser.
 *
 * This eliminates the client-side loading gap where the page would render
 * empty and then wait for Supabase to respond before showing content.
 *
 * Auth (login check) still happens client-side — localStorage tokens cannot
 * be read server-side. WishlistClient handles all interactive auth state.
 */
import { Suspense } from 'react'
import WishlistClient from './WishlistClient'
import { fetchWishlistItems, fetchChecklistStates } from '@/lib/server-data'

// ============================================
// Loading skeleton — shown while RSC data loads
// ============================================
function WishlistSkeleton() {
  return (
    <div className="min-h-screen bg-sakura-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-sakura-200 border-t-sakura-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">載入美食清單中...</p>
      </div>
    </div>
  )
}

// ============================================
// Server-side data fetch
// ============================================
async function WishlistData() {
  // Both fetches run in parallel on the server — no client round-trip needed.
  const [wishlistItems, checklistStates] = await Promise.all([
    fetchWishlistItems(),
    fetchChecklistStates(),
  ])

  return (
    <WishlistClient
      prefetchedWishlistItems={wishlistItems}
      prefetchedChecklistStates={checklistStates}
    />
  )
}

// ============================================
// Page — RSC + Suspense wrapper
// ============================================
export default async function WishlistPage() {
  return (
    <Suspense fallback={<WishlistSkeleton />}>
      <WishlistData />
    </Suspense>
  )
}
