import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AUTH_COOKIE_NAME = 'admin_auth_token'
const ADMIN_TOKEN = 'japan_travel_admin_authenticated_2024'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value
  
  // Check if user is authenticated (any valid token)
  const isAuthenticated = authToken && authToken.startsWith('japan_travel_')
  
  // Check if user is admin
  const isAdmin = authToken === ADMIN_TOKEN

  // Allow access to login page always
  if (pathname === '/login') {
    // If already logged in, redirect to main
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/main', request.url))
    }
    return NextResponse.next()
  }

  // Protect /admin routes - admin only
  if (pathname.startsWith('/admin')) {
    if (!isAdmin) {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  // Root page always redirects to login (if not authenticated) or main (if authenticated)
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/main', request.url))
    } else {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Protect /main - require any authentication
  if (pathname === '/main') {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/main', '/admin/:path*', '/login'],
}
