export const revalidate = 0
import { supabase } from '@/lib/supabase'
import ComparadorClient from './ComparadorClient'

export default async function Home() {
  const [{ data: models }, { data: categories }, { data: features }, { data: values }] = await Promise.all([
    supabase.from('models').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('features').select('*').order('sort_order'),
    supabase.from('feature_values').select('*'),
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