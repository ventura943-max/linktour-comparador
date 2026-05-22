import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/admin/login', '/api/auth']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = request.cookies.get('admin_session')

  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  if (!session) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.webp).*)'],
}