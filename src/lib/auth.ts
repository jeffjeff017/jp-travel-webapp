import Cookies from 'js-cookie'

const AUTH_COOKIE_NAME = 'admin_auth_token'
const USER_COOKIE_NAME = 'user_info'
const USERS_STORAGE_KEY = 'japan_travel_users'

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

// Get users from localStorage or use defaults
export function getUsers(): User[] {
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

// Save users to localStorage
export function saveUsers(users: User[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))
}

// Add or update user
export function updateUser(user: User): void {
  const users = getUsers()
  const existingIndex = users.findIndex(u => u.username === user.username)
  
  if (existingIndex >= 0) {
    users[existingIndex] = user
  } else {
    users.push(user)
  }
  
  saveUsers(users)
}

// Delete user (cannot delete admin)
export function deleteUser(username: string): boolean {
  if (username === 'admin') return false
  
  const users = getUsers()
  const filtered = users.filter(u => u.username !== username)
  saveUsers(filtered)
  return true
}

// Login function - returns user info if successful
export function login(username: string, password: string): User | null {
  const users = getUsers()
  const user = users.find(u => u.username === username && u.password === password)
  
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

// Get user by username
export function getUserByUsername(username: string): User | undefined {
  const users = getUsers()
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
