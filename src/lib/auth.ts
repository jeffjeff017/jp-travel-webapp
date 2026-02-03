import Cookies from 'js-cookie'
import { getSupabaseUsers, saveSupabaseUser, deleteSupabaseUser, type UserDB } from './supabase'

const AUTH_COOKIE_NAME = 'admin_auth_token'
const USER_COOKIE_NAME = 'user_info'
const USERS_STORAGE_KEY = 'japan_travel_users'
const USERS_CACHE_KEY = 'japan_travel_users_cache_time'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes cache

// User roles
export type UserRole = 'admin' | 'user'

export type User = {
  username: string
  password: string
  role: UserRole
  displayName: string
  avatarUrl?: string
}

// Default users
const DEFAULT_USERS: User[] = [
  { username: 'admin', password: 'admin', role: 'admin', displayName: 'Admin', avatarUrl: '' },
  { username: 'girl', password: 'girl', role: 'user', displayName: 'Girl', avatarUrl: '' },
]

// Convert from Supabase format to local format
function fromSupabaseFormat(db: UserDB): User {
  return {
    username: db.username,
    password: db.password,
    role: db.role as UserRole,
    displayName: db.display_name || db.username,
    avatarUrl: db.avatar_url || '',
  }
}

// Convert from local format to Supabase format
function toSupabaseFormat(user: User): Omit<UserDB, 'id' | 'created_at'> {
  return {
    username: user.username,
    password: user.password,
    role: user.role,
    display_name: user.displayName,
    avatar_url: user.avatarUrl || null,
  }
}

// Get users from localStorage cache
function getLocalUsers(): User[] {
  if (typeof window === 'undefined') return DEFAULT_USERS
  
  const saved = localStorage.getItem(USERS_STORAGE_KEY)
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      return DEFAULT_USERS
    }
  }
  
  // Initialize with default users
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS))
  return DEFAULT_USERS
}

// Save users to localStorage cache
function saveLocalUsers(users: User[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))
  localStorage.setItem(USERS_CACHE_KEY, Date.now().toString())
}

// Check if cache is still valid
function isCacheValid(): boolean {
  if (typeof window === 'undefined') return false
  
  const cacheTime = localStorage.getItem(USERS_CACHE_KEY)
  if (!cacheTime) return false
  
  return Date.now() - parseInt(cacheTime) < CACHE_DURATION
}

// Synchronous get - returns cached users (for backwards compatibility)
export function getUsers(): User[] {
  return getLocalUsers()
}

// Async get - fetches from Supabase and updates cache
export async function getUsersAsync(): Promise<User[]> {
  // If cache is valid, return local users
  if (isCacheValid()) {
    return getLocalUsers()
  }
  
  try {
    const dbUsers = await getSupabaseUsers()
    
    if (dbUsers.length > 0) {
      const users = dbUsers.map(fromSupabaseFormat)
      saveLocalUsers(users)
      return users
    }
  } catch (err) {
    console.error('Error fetching users from Supabase:', err)
  }
  
  // Fallback to local users
  return getLocalUsers()
}

// Synchronous save - saves to localStorage only (for backwards compatibility)
export function saveUsers(users: User[]): void {
  if (typeof window === 'undefined') return
  saveLocalUsers(users)
}

// Add or update user (synchronous - localStorage only)
export function updateUser(user: User): void {
  const users = getLocalUsers()
  const existingIndex = users.findIndex(u => u.username === user.username)
  
  if (existingIndex >= 0) {
    users[existingIndex] = user
  } else {
    users.push(user)
  }
  
  saveLocalUsers(users)
}

// Add or update user (async - syncs with Supabase)
export async function updateUserAsync(user: User): Promise<{ success: boolean; error: string | null }> {
  // Update local cache first (optimistic update)
  updateUser(user)
  
  // Then sync to Supabase
  try {
    const dbFormat = toSupabaseFormat(user)
    const result = await saveSupabaseUser(dbFormat)
    
    if (result.error) {
      console.error('Failed to sync user to Supabase:', result.error)
      return { success: false, error: result.error }
    }
    
    return { success: true, error: null }
  } catch (err: any) {
    console.error('Error saving user to Supabase:', err)
    return { success: false, error: err.message || '儲存用戶時發生錯誤' }
  }
}

// Delete user (synchronous - localStorage only)
export function deleteUser(username: string): boolean {
  if (username === 'admin') return false
  
  const users = getLocalUsers()
  const filtered = users.filter(u => u.username !== username)
  saveLocalUsers(filtered)
  return true
}

// Delete user (async - syncs with Supabase)
export async function deleteUserAsync(username: string): Promise<{ success: boolean; error: string | null }> {
  if (username === 'admin') {
    return { success: false, error: '無法刪除管理員帳號' }
  }
  
  // Delete from local cache first
  deleteUser(username)
  
  // Then delete from Supabase
  try {
    const result = await deleteSupabaseUser(username)
    return result
  } catch (err: any) {
    console.error('Error deleting user from Supabase:', err)
    return { success: false, error: err.message || '刪除用戶時發生錯誤' }
  }
}

// Login function - returns user info if successful
// Username and password comparison is case-insensitive
export function login(username: string, password: string): User | null {
  const users = getLocalUsers()
  const user = users.find(u => 
    u.username.toLowerCase() === username.toLowerCase() && 
    u.password.toLowerCase() === password.toLowerCase()
  )
  
  if (user) {
    // Generate token based on role
    const token = user.role === 'admin' 
      ? 'japan_travel_admin_authenticated_2024'
      : `japan_travel_user_${user.username}_2024`
    
    Cookies.set(AUTH_COOKIE_NAME, token, { 
      expires: 1, // 1 day
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    })
    
    // Store user info
    Cookies.set(USER_COOKIE_NAME, JSON.stringify({ 
      username: user.username, 
      role: user.role,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl || ''
    }), { 
      expires: 1,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    })
    
    return user
  }
  
  return null
}

// Async login - fetches fresh user data from Supabase first
export async function loginAsync(username: string, password: string): Promise<User | null> {
  // Fetch fresh users from Supabase
  await getUsersAsync()
  
  // Then do regular login
  return login(username, password)
}

export function logout(): void {
  Cookies.remove(AUTH_COOKIE_NAME)
  Cookies.remove(USER_COOKIE_NAME)
}

// Check if any user is authenticated
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  const token = Cookies.get(AUTH_COOKIE_NAME)
  return !!token && token.startsWith('japan_travel_')
}

// Check if current user is admin
export function isAdmin(): boolean {
  if (typeof window === 'undefined') return false
  const token = Cookies.get(AUTH_COOKIE_NAME)
  return token === 'japan_travel_admin_authenticated_2024'
}

// Get current user info
export function getCurrentUser(): { username: string; role: UserRole; displayName: string; avatarUrl?: string } | null {
  if (typeof window === 'undefined') return null
  
  const userInfo = Cookies.get(USER_COOKIE_NAME)
  if (userInfo) {
    try {
      return JSON.parse(userInfo)
    } catch {
      return null
    }
  }
  return null
}

// Get user by username (synchronous)
export function getUserByUsername(username: string): User | undefined {
  const users = getLocalUsers()
  return users.find(u => u.username === username)
}

// Get user by username (async)
export async function getUserByUsernameAsync(username: string): Promise<User | undefined> {
  const users = await getUsersAsync()
  return users.find(u => u.username === username)
}

// Check if user can edit (both admin and regular users can edit)
export function canEdit(): boolean {
  return isAuthenticated()
}

// Check if user can access admin page (only admin)
export function canAccessAdmin(): boolean {
  return isAdmin()
}

export function getAuthToken(): string | undefined {
  return Cookies.get(AUTH_COOKIE_NAME)
}

export const AUTH_TOKEN_VALUE = 'japan_travel_admin_authenticated_2024'

// Force refresh users from Supabase
export async function refreshUsers(): Promise<User[]> {
  try {
    const dbUsers = await getSupabaseUsers()
    
    if (dbUsers.length > 0) {
      const users = dbUsers.map(fromSupabaseFormat)
      saveLocalUsers(users)
      return users
    }
  } catch (err) {
    console.error('Error refreshing users from Supabase:', err)
  }
  
  return getLocalUsers()
}

// Migrate localStorage users to Supabase (call once)
export async function migrateUsersToSupabase(): Promise<void> {
  const localUsers = getLocalUsers()
  
  // Check if Supabase has any data
  const dbUsers = await getSupabaseUsers()
  
  // If Supabase has fewer users than local, migrate
  if (dbUsers.length < localUsers.length) {
    console.log('Migrating users to Supabase...')
    for (const user of localUsers) {
      await saveSupabaseUser(toSupabaseFormat(user))
    }
  }
}
