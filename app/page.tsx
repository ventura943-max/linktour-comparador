export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/fetchAll'
import ComparadorClient from './ComparadorClient'

export default async function Home() {
  // feature_values es la única tabla que crece sin límite (modelos × características)
  // y supera las 1.000 filas que Supabase devuelve por consulta: se carga por páginas.
  const [{ data: models }, { data: categories }, { data: features }, values] = await Promise.all([
    supabase.from('models').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('features').select('*').order('sort_order'),
    fetchAll('feature_values', ['feature_id', 'model_id']),
  ])

  return (
    <ComparadorClient
      models={models || []}
      categories={categories || []}
      features={features || []}
      values={values || []}
    />
  )
}