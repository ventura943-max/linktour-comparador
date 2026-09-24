// lib/role.ts
// Lectura del rol de la sesión desde componentes de servidor.
// Si hay sesión pero no hay cookie de rol (sesiones anteriores a los perfiles), se considera admin.
import { cookies } from 'next/headers'

export type Role = 'admin' | 'viewer'

export async function getRole(): Promise<Role | null> {
  const cookieStore = await cookies()
  if (!cookieStore.get('admin_session')) return null
  const r = cookieStore.get('liux_role')?.value
  return r === 'viewer' ? 'viewer' : 'admin'
}