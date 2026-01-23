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
