export const dynamic = 'force-dynamic'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import FichaModelo from './FichaModelo'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  if (!cookieStore.get('admin_session')) redirect('/admin/login')
  const { id } = await params

  const [m, c, f, v, s, cf] = await Promise.all([
    supabase.from('models').select('*').eq('id', id).single(),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('features').select('*').order('sort_order'),
    supabase.from('feature_values').select('*').eq('model_id', id),
    supabase.from('model_sources').select('*').eq('model_id', id).order('sort_order'),
    supabase.from('settings').select('*').eq('id', 'card_fields').single(),
  ])
  if (!m.data) notFound()

  return (
    <FichaModelo
      model={m.data}
      categories={c.data || []}
      features={f.data || []}
      values={v.data || []}
      sources={s.data || []}
      cardFields={cf.data?.value || []}
    />
  )
}