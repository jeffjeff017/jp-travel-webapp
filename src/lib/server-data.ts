/**
 * Server-side data fetching layer for React Server Components.
 * Only contains read-only fetch functions — safe for SSR / RSC.
 * Import from Server Components or Route Handlers only.
 */
import { createClient } from '@supabase/supabase-js'
import type { WishlistItemDB, ChecklistStateDB } from './supabase'

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.')
  return createClient(url, key, { auth: { persistSession: false } })
}

// ============================================
// Wishlist Items
// ============================================
export async function fetchWishlistItems(): Promise<WishlistItemDB[]> {
  try {
    const sb = getServerSupabase()
    const { data, error } = await sb
      .from('wishlist_items')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.warn('[RSC] fetchWishlistItems:', error.message)
      return []
    }
    return data ?? []
  } catch (err) {
    console.warn('[RSC] fetchWishlistItems exception:', err)
    return []
  }
}

// ============================================
// Checklist States
// ============================================
export async function fetchChecklistStates(): Promise<ChecklistStateDB[]> {
  try {
    const sb = getServerSupabase()
    const { data, error } = await sb.from('checklist_states').select('*')
    if (error) {
      console.warn('[RSC] fetchChecklistStates:', error.message)
      return []
    }
    return data ?? []
  } catch (err) {
    console.warn('[RSC] fetchChecklistStates exception:', err)
    return []
  }
}
