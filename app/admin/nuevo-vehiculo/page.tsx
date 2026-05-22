import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import NuevoVehiculo from './NuevoVehiculo'

export default async function Page() {
  const cookieStore = await cookies()
  if (!cookieStore.get('admin_session')) redirect('/admin/login')
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-400">Cargando...</div>}>
      <NuevoVehiculo />
    </Suspense>
  )
}