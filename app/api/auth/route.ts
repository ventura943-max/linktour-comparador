import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Dos perfiles: admin (edita todo) y consulta (solo lectura: comparar, filtrar, ordenar, exportar).
// Credenciales en variables de entorno (Vercel → Settings → Environment Variables).
const ADMIN_USER = process.env.ADMIN_USER || 'admin'
const ADMIN_PASS = process.env.ADMIN_PASS || 'liux2024'
const VIEWER_USER = process.env.VIEWER_USER || 'consulta'
const VIEWER_PASS = process.env.VIEWER_PASS || 'liux-consulta'

export type Role = 'admin' | 'viewer'

const SESSION_MAX_AGE = 60 * 60 * 8 // 8 horas

export async function POST(req: NextRequest) {
  const { user, pass } = await req.json()

  let role: Role | null = null
  if (user === ADMIN_USER && pass === ADMIN_PASS) role = 'admin'
  else if (user === VIEWER_USER && pass === VIEWER_PASS) role = 'viewer'

  if (!role) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

  const cookieStore = await cookies()
  // admin_session = "hay sesión" (la usa el middleware para proteger la app); liux_role = qué puede hacer
  cookieStore.set('admin_session', 'true', { httpOnly: true, sameSite: 'lax', maxAge: SESSION_MAX_AGE })
  cookieStore.set('liux_role', role, { httpOnly: true, sameSite: 'lax', maxAge: SESSION_MAX_AGE })
  return NextResponse.json({ ok: true, role })
}

// Devuelve el rol de la sesión actual (lo usan las páginas para saber qué mostrar)
export async function GET() {
  const cookieStore = await cookies()
  if (!cookieStore.get('admin_session')) return NextResponse.json({ role: null }, { status: 401 })
  const role = (cookieStore.get('liux_role')?.value as Role) || 'admin'
  return NextResponse.json({ role })
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('admin_session')
  cookieStore.delete('liux_role')
  return NextResponse.json({ ok: true })
}