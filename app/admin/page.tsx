import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AdminPanel from './AdminPanel'

export default async function AdminPage() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')
  if (!session) redirect('/admin/login')
  return <AdminPanel />
}