import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getRole } from '@/lib/role'
import NuevoVehiculo from './NuevoVehiculo'

export default async function Page() {
  const role = await getRole()
  if (!role) redirect('/admin/login')
  if (role !== 'admin') redirect('/')   // el perfil Consulta no puede crear ni editar vehículos
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-400">Cargando...</div>}>
      <NuevoVehiculo />
    </Suspense>
  )
}