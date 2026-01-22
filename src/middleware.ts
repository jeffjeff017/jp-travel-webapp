import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AUTH_COOKIE_NAME = 'admin_auth_token'
const AUTH_TOKEN = 'japan_travel_admin_authenticated_2024'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect /admin routes (not /login)
  if (pathname.startsWith('/admin')) {
    const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value

    if (authToken !== AUTH_TOKEN) {
      // Redirect to login page
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
