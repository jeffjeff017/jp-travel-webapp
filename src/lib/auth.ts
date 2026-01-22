import Cookies from 'js-cookie'

const AUTH_COOKIE_NAME = 'admin_auth_token'
const AUTH_TOKEN = 'japan_travel_admin_authenticated_2024'

export function login(username: string, password: string): boolean {
  if (username === 'admin' && password === 'admin') {
    Cookies.set(AUTH_COOKIE_NAME, AUTH_TOKEN, { 
      expires: 1, // 1 day
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    })
    return true
  }
  return false
}

export function logout(): void {
  Cookies.remove(AUTH_COOKIE_NAME)
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return Cookies.get(AUTH_COOKIE_NAME) === AUTH_TOKEN
}

export function getAuthToken(): string | undefined {
  return Cookies.get(AUTH_COOKIE_NAME)
}

export const AUTH_TOKEN_VALUE = AUTH_TOKEN
