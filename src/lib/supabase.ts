import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Trip = {
  id: number
  title: string
  date: string
  info: string
  location: string
  lat: number
  lng: number
  created_at?: string
  updated_at?: string
}

export async function getTrips(): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('date', { ascending: false })

  if (error) {
    console.error('Error fetching trips:', error)
    return []
  }

  return data || []
}

export async function createTrip(trip: Omit<Trip, 'id' | 'created_at' | 'updated_at'>): Promise<Trip | null> {
  const { data, error } = await supabase
    .from('trips')
    .insert([trip])
    .select()
    .single()

  if (error) {
    console.error('Error creating trip:', error)
    return null
  }

  return data
}

export async function updateTrip(id: number, trip: Partial<Trip>): Promise<Trip | null> {
  const { data, error } = await supabase
    .from('trips')
    .update({ ...trip, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating trip:', error)
    return null
  }

  return data
}

export async function deleteTrip(id: number): Promise<boolean> {
  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting trip:', error)
    return false
  }

  return true
}
