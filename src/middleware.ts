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

  // Landing page (/) - always accessible, but redirect to main if already logged in
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/main', request.url))
    }
    return NextResponse.next()
  }

  // Login page - always accessible, but redirect to main if already logged in
  if (pathname === '/login') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/main', request.url))
    }
    return NextResponse.next()
  }

  // Protect /panel routes - admin only
  if (pathname.startsWith('/panel')) {
    if (!isAdmin) {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  // Protect /main - require any authentication
  if (pathname === '/main') {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Protect /wishlist - require any authentication
  if (pathname === '/wishlist') {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/main', '/panel/:path*', '/login', '/wishlist'],
}
