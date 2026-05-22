'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

export default function ImportarExcel() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [preview, setPreview] = useState<string[]>([])
  const [parsed, setParsed] = useState<any>(null)

  function toast(t: string) { setMsg(t); setTimeout(() => setMsg(''), 5000) }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

      // Row 0 = headers: Category, Feature, then vehicle names
      // Row 1 = subheaders: blank, blank, then version names
      // Row 2+ = data rows

      const headerRow = rows[0] as string[]
      const versionRow = rows[1] as string[]

      // Build vehicle list from header row (cols 2+)
      const vehicles: { brand: string, name: string, version: string, colIndex: number }[] = []
      let currentBrand = ''
      for (let c = 2; c < headerRow.length; c++) {
        if (headerRow[c] && String(headerRow[c]).trim() !== '') {
          currentBrand = String(headerRow[c]).trim()
        }
        const version = versionRow[c] ? String(versionRow[c]).trim() : ''
        // Parse brand and model from header like "LINKTOUR ALUMI" or "LIUX BIG"
        const parts = currentBrand.split(' ')
        const brand = parts[0] || currentBrand
        const name = parts.slice(1).join(' ') || currentBrand
        vehicles.push({ brand, name, version, colIndex: c })
      }

      // Build feature rows (row 2+)
      const featureRows: { category: string, feature: string, values: Record<number, string> }[] = []
      let currentCat = ''
      for (let r = 2; r < rows.length; r++) {
        const row = rows[r]
        if (!row || row.every((c: any) => !c)) continue
        if (row[0] && String(row[0]).trim()) currentCat = String(row[0]).trim()
        const feat = String(row[1] || '').trim()
        if (!feat) continue
        const values: Record<number, string> = {}
        for (const v of vehicles) {
          values[v.colIndex] = String(row[v.colIndex] || '').trim()
        }
        featureRows.push({ category: currentCat, feature: feat, values })
      }

      setParsed({ vehicles, featureRows })
      setPreview(vehicles.map(v => `${v.brand} ${v.name} ${v.version}`.trim()))
    }
    reader.readAsArrayBuffer(file)
  }

  async function doImport() {
    if (!parsed) { toast('No hay datos para importar'); return }
    setLoading(true)

    const { vehicles, featureRows } = parsed

    // Load categories and features from DB
    const { data: dbCats } = await supabase.from('categories').select('*')
    const { data: dbFeats } = await supabase.from('features').select('*')

    let imported = 0
    let errors = 0

    for (const v of vehicles) {
      try {
        // Create model
        const { data: saved } = await supabase.from('models').insert({
          brand: v.brand,
          name: v.name,
          version: v.version,
          is_active: true,
          sort_order: 0,
        }).select().single()

        if (!saved) { errors++; continue }

        // Match feature values
        const upserts: any[] = []
        for (const fr of featureRows) {
          const dbFeat = dbFeats?.find(f => {
            const dbCat = dbCats?.find(c => c.id === f.category_id)
            return f.name.toLowerCase().trim() === fr.feature.toLowerCase().trim() &&
              dbCat?.name.toLowerCase().trim() === fr.category.toLowerCase().trim()
          })
          if (!dbFeat) continue
          const val = fr.values[v.colIndex]
          if (val !== '') {
            upserts.push({ feature_id: dbFeat.id, model_id: saved.id, value: val })
          }
        }

        if (upserts.length > 0) {
          await supabase.from('feature_values').upsert(upserts, { onConflict: 'feature_id,model_id' })
        }
        imported++
      } catch { errors++ }
    }

    toast(`Importados: ${imported} vehículos${errors > 0 ? ` · Errores: ${errors}` : ' ✓'}`)
    setLoading(false)
    if (imported > 0) setTimeout(() => router.push('/admin'), 2000)
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {msg && <div className="fixed top-4 right-4 bg-[#081224] text-white px-5 py-3 rounded-full text-sm font-bold shadow-lg z-50">{msg}</div>}

      <header className="bg-[#071225] text-white px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <div className="font-black text-xl tracking-widest">LIUX</div>
          <div className="text-[9px] tracking-[.3em] text-slate-400">IMPORTAR EXCEL</div>
        </div>
        <button onClick={() => router.push('/admin')} className="text-sm text-slate-300 hover:text-white px-4 py-2 rounded-lg hover:bg-white/10">← Volver</button>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-6">

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-black text-base mb-2 text-slate-700 uppercase tracking-wider">Formato esperado</h2>
          <p className="text-sm text-slate-500 mb-3">El archivo debe tener este formato — el mismo que tu Excel actual:</p>
          <div className="bg-slate-50 rounded-xl p-4 text-xs font-mono text-slate-600 space-y-1">
            <div>Fila 1: <span className="text-blue-600">Category · Feature · MARCA MODELO · MARCA MODELO · ...</span></div>
            <div>Fila 2: <span className="text-blue-600">— · — · Versión · Versión · ...</span></div>
            <div>Fila 3+: <span className="text-slate-400">datos de cada característica por vehículo</span></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-black text-base mb-4 text-slate-700 uppercase tracking-wider">Subir archivo</h2>
          <label className="block w-full border-2 border-dashed border-slate-200 rounded-xl p-10 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition">
            <div className="text-3xl mb-2">📊</div>
            <div className="text-sm font-bold text-slate-600">Haz clic para seleccionar el Excel</div>
            <div className="text-xs text-slate-400 mt-1">.xlsx o .xls</div>
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
          </label>
        </div>

        {preview.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-black text-base mb-4 text-slate-700 uppercase tracking-wider">Vehículos detectados ({preview.length})</h2>
            <div className="space-y-2 mb-6">
              {preview.map((v, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl">
                  <div className="w-6 h-6 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">{i+1}</div>
                  <div className="text-sm font-medium">{v}</div>
                </div>
              ))}
            </div>
            <button onClick={doImport} disabled={loading}
              className="w-full bg-[#081224] text-white font-bold py-4 rounded-2xl hover:bg-[#162040] disabled:opacity-50 text-sm">
              {loading ? 'Importando...' : `✓ Importar ${preview.length} vehículos`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}