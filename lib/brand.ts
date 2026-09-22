// lib/brand.ts
// La marca puede llevar un prefijo de mercado entre corchetes: "[IT] LINKTOUR".
// Aquí se interpreta para agrupar y etiquetar sin modificar los datos guardados.

export const MARKET_LABELS: Record<string, string> = {
  IT: 'Italia', ES: 'España', FR: 'Francia', DE: 'Alemania', PT: 'Portugal',
  NL: 'Países Bajos', BE: 'Bélgica', UK: 'Reino Unido', GB: 'Reino Unido', CH: 'Suiza', AT: 'Austria',
}

export function parseBrand(raw: string | null | undefined): { brand: string; market: string; marketLabel: string } {
  const s = (raw || '').trim()
  const m = /^\[([A-Za-z]{2,3})\]\s*(.+)$/.exec(s)
  if (!m) return { brand: s, market: '', marketLabel: '' }
  const code = m[1].toUpperCase()
  return { brand: m[2].trim(), market: code, marketLabel: MARKET_LABELS[code] || code }
}

// Orden de catálogo: marca (sin prefijo) → modelo → versión
export function compareModels(a: any, b: any): number {
  const ba = parseBrand(a.brand).brand.toLowerCase(), bb = parseBrand(b.brand).brand.toLowerCase()
  if (ba !== bb) return ba.localeCompare(bb, 'es')
  const na = (a.name || '').toLowerCase(), nb = (b.name || '').toLowerCase()
  if (na !== nb) return na.localeCompare(nb, 'es')
  return (a.version || '').toLowerCase().localeCompare((b.version || '').toLowerCase(), 'es', { numeric: true })
}