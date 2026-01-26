import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Trip = {
  id: number
  title: string
  date: string
  time_start?: string // Start time (HH:mm)
  time_end?: string // End time (HH:mm)
  description: string // HTML content
  location: string
  lat: number
  lng: number
  image_url?: string // Optional image URL
  created_at?: string
  updated_at?: string
}

// Alias for backwards compatibility
export type TripWithInfo = Trip & { info: string }

export async function getTrips(): Promise<Trip[]> {
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('date', { ascending: false })

    if (error) {
      console.error('Error fetching trips:', error.message)
      return []
    }

    return data || []
  } catch (err) {
    console.error('Supabase connection error:', err)
    return []
  }
}

export async function createTrip(trip: Omit<Trip, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: Trip | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('trips')
      .insert([{
        title: trip.title,
        date: trip.date,
        time_start: trip.time_start || null,
        time_end: trip.time_end || null,
        description: trip.description,
        location: trip.location,
        lat: trip.lat,
        lng: trip.lng,
        image_url: trip.image_url || null,
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating trip:', error)
      return { data: null, error: error.message }
    }

    return { data, error: null }
  } catch (err: any) {
    console.error('Create trip error:', err)
    return { data: null, error: err.message || '建立行程時發生錯誤' }
  }
}

export async function updateTrip(id: number, trip: Partial<Trip>): Promise<{ data: Trip | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('trips')
      .update({ ...trip, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating trip:', error)
      return { data: null, error: error.message }
    }

    return { data, error: null }
  } catch (err: any) {
    console.error('Update trip error:', err)
    return { data: null, error: err.message || '更新行程時發生錯誤' }
  }
}

export async function deleteTrip(id: number): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('trips')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting trip:', error)
      return { success: false, error: error.message }
    }

    return { success: true, error: null }
  } catch (err: any) {
    console.error('Delete trip error:', err)
    return { success: false, error: err.message || '刪除行程時發生錯誤' }
  }
}

// ============================================
// Site Settings
// ============================================

export type DaySchedule = {
  dayNumber: number
  theme: string
  imageUrl?: string
}

export type TravelNoticeItem = {
  id: string
  icon: string
  text: string
}

export type SiteSettingsDB = {
  id: number
  title: string
  home_location: {
    name: string
    address: string
    lat: number
    lng: number
    imageUrl?: string
  } | null
  trip_start_date: string | null
  total_days: number
  day_schedules: DaySchedule[] | null
  travel_essentials: TravelNoticeItem[] | null
  travel_preparations: TravelNoticeItem[] | null
  updated_at: string
}

export async function getSupabaseSiteSettings(): Promise<SiteSettingsDB | null> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle() // Use maybeSingle instead of single to avoid error when no rows

    if (error) {
      // Don't log error for missing table (expected when not set up)
      if (!error.message.includes('does not exist')) {
        console.error('Error fetching site settings:', error.message)
      }
      return null
    }

    return data
  } catch (err) {
    console.error('Supabase site settings error:', err)
    return null
  }
}

export async function saveSupabaseSiteSettings(settings: Partial<Omit<SiteSettingsDB, 'id' | 'updated_at'>>): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('site_settings')
      .upsert({
        id: 1,
        ...settings,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error saving site settings:', error)
      return { success: false, error: error.message }
    }

    return { success: true, error: null }
  } catch (err: any) {
    console.error('Save site settings error:', err)
    return { success: false, error: err.message || '儲存設定時發生錯誤' }
  }
}

// ============================================
// Users
// ============================================

export type UserDB = {
  id: number
  username: string
  password: string
  role: 'admin' | 'user'
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

export async function getSupabaseUsers(): Promise<UserDB[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('id', { ascending: true })

    if (error) {
      // Don't log error for missing table (expected when not set up)
      if (!error.message.includes('does not exist')) {
        console.error('Error fetching users:', error.message)
      }
      return []
    }

    return data || []
  } catch (err) {
    console.error('Supabase users error:', err)
    return []
  }
}

export async function saveSupabaseUser(user: Omit<UserDB, 'id' | 'created_at'>): Promise<{ data: UserDB | null; error: string | null }> {
  try {
    // Check if user exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', user.username)
      .single()

    if (existing) {
      // Update existing user
      const { data, error } = await supabase
        .from('users')
        .update({
          password: user.password,
          role: user.role,
          display_name: user.display_name,
          avatar_url: user.avatar_url
        })
        .eq('username', user.username)
        .select()
        .single()

      if (error) {
        console.error('Error updating user:', error)
        return { data: null, error: error.message }
      }

      return { data, error: null }
    } else {
      // Insert new user
      const { data, error } = await supabase
        .from('users')
        .insert([user])
        .select()
        .single()

      if (error) {
        console.error('Error creating user:', error)
        return { data: null, error: error.message }
      }

      return { data, error: null }
    }
  } catch (err: any) {
    console.error('Save user error:', err)
    return { data: null, error: err.message || '儲存用戶時發生錯誤' }
  }
}

export async function deleteSupabaseUser(username: string): Promise<{ success: boolean; error: string | null }> {
  if (username === 'admin') {
    return { success: false, error: '無法刪除管理員帳號' }
  }

  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('username', username)

    if (error) {
      console.error('Error deleting user:', error)
      return { success: false, error: error.message }
    }

    return { success: true, error: null }
  } catch (err: any) {
    console.error('Delete user error:', err)
    return { success: false, error: err.message || '刪除用戶時發生錯誤' }
  }
}

// ============================================
// Wishlist Items
// ============================================

export type WishlistItemDB = {
  id: number
  category: string
  name: string
  note: string | null
  image_url: string | null
  map_link: string | null
  link: string | null
  added_to_trip: { day: number; time: string } | null
  is_favorite: boolean
  created_at: string
}

export async function getSupabaseWishlistItems(): Promise<WishlistItemDB[]> {
  try {
    const { data, error } = await supabase
      .from('wishlist_items')
      .select('*')
      .order('is_favorite', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      // Don't log error for missing table (expected when not set up)
      if (!error.message.includes('does not exist')) {
        console.error('Error fetching wishlist items:', error.message)
      }
      return []
    }

    return data || []
  } catch (err) {
    console.error('Supabase wishlist error:', err)
    return []
  }
}

export async function saveSupabaseWishlistItem(item: Omit<WishlistItemDB, 'id' | 'created_at'>): Promise<{ data: WishlistItemDB | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('wishlist_items')
      .insert([item])
      .select()
      .single()

    if (error) {
      console.error('Error creating wishlist item:', error)
      return { data: null, error: error.message }
    }

    return { data, error: null }
  } catch (err: any) {
    console.error('Save wishlist item error:', err)
    return { data: null, error: err.message || '儲存心願清單項目時發生錯誤' }
  }
}

export async function updateSupabaseWishlistItem(id: number, item: Partial<Omit<WishlistItemDB, 'id' | 'created_at'>>): Promise<{ data: WishlistItemDB | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('wishlist_items')
      .update(item)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating wishlist item:', error)
      return { data: null, error: error.message }
    }

    return { data, error: null }
  } catch (err: any) {
    console.error('Update wishlist item error:', err)
    return { data: null, error: err.message || '更新心願清單項目時發生錯誤' }
  }
}

export async function deleteSupabaseWishlistItem(id: number): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('wishlist_items')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting wishlist item:', error)
      return { success: false, error: error.message }
    }

    return { success: true, error: null }
  } catch (err: any) {
    console.error('Delete wishlist item error:', err)
    return { success: false, error: err.message || '刪除心願清單項目時發生錯誤' }
  }
}

// ============================================
// Checklist States
// ============================================

export type ChecklistStateDB = {
  id: string
  checked_by: { username: string; avatarUrl?: string }[]
  updated_at: string
}

export async function getSupabaseChecklistStates(): Promise<ChecklistStateDB[]> {
  try {
    const { data, error } = await supabase
      .from('checklist_states')
      .select('*')

    if (error) {
      // Don't log error for missing table (expected when not set up)
      if (!error.message.includes('does not exist')) {
        console.error('Error fetching checklist states:', error.message)
      }
      return []
    }

    return data || []
  } catch (err) {
    console.error('Supabase checklist states error:', err)
    return []
  }
}

export async function saveSupabaseChecklistState(state: ChecklistStateDB): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('checklist_states')
      .upsert({
        id: state.id,
        checked_by: state.checked_by,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error saving checklist state:', error)
      return { success: false, error: error.message }
    }

    return { success: true, error: null }
  } catch (err: any) {
    console.error('Save checklist state error:', err)
    return { success: false, error: err.message || '儲存勾選狀態時發生錯誤' }
  }
}
