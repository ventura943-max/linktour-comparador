import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export async function uploadImage(file: File, modelId: string): Promise<string | null> {
  const ext = file.name.split('.').pop()
  const path = `${modelId}.${ext}`
  const { error } = await supabase.storage.from('vehicles').upload(path, file, { upsert: true })
  if (error) return null
  const { data } = supabase.storage.from('vehicles').getPublicUrl(path)
  return data.publicUrl
}