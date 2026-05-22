import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const ADMIN_USER = process.env.ADMIN_USER || 'admin'
const ADMIN_PASS = process.env.ADMIN_PASS || 'liux2024'

export async function POST(req: NextRequest) {
  const { user, pass } = await req.json()

  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    const cookieStore = await cookies()
    cookieStore.set('admin_session', 'true', {
      httpOnly: true,
      maxAge: 60 * 60 * 8
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('admin_session')
  return NextResponse.json({ ok: true })
}