// lib/fetchAll.ts
// Supabase devuelve como máximo 1.000 filas por consulta (límite silencioso).
// Esta utilidad pide la tabla completa en bloques de 1.000 hasta agotarla.
//
// Uso:  const values = await fetchAll('feature_values', ['feature_id', 'model_id'])
//
// El orden es obligatorio para que la paginación sea estable (si la BD devolviera
// las filas en orden distinto entre páginas, podrían repetirse o perderse filas).

import { supabase } from './supabase'

export async function fetchAll<T = any>(table: string, orderBy: string[] = ['id']): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  let from = 0
  while (true) {
    let q: any = supabase.from(table).select('*')
    for (const col of orderBy) q = q.order(col)
    const { data, error } = await q.range(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data || []) as T[]
    all.push(...rows)
    if (rows.length < PAGE) break
    from += PAGE
  }
  return all
}