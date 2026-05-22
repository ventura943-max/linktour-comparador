'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

export default function ImportarExcel() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [preview, setPreview] = useState<any[]>([])
  const [rows, setRows] = useState<any[]>([])

  function toast(t: string) { setMsg(t); setTimeout(() => setMsg(''), 4000) }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
      setRows(json)
      setPreview((json as any[]).slice(0, 3))
    }
    reader.readAsArrayBuffer(file)
  }

  async function doImport() {
    if (!rows.length) { toast('No hay datos para importar'); return }
    setLoading(true)

    const { data: categories } = await supabase.from('categories').select('*')
    const { data: features } = await supabase.from('features').select('*')

    let imported = 0
    let errors = 0

    for (const row of rows as any[]) {
      try {
        const modelData = {
          brand: row['Brand'] || row['Marca'] || '',
          name: row['Model'] || row['Modelo'] || '',
          version: row['Version'] || row['Versión'] || '',
          price: row['Price'] || row['Precio'] || '',
          img_url: row['Image'] || row['Imagen'] || '',
          is_active: true,
          sort_order: 0,
        }
        if (!modelData.brand || !modelData.name) { errors++; continue }

        const { data: saved } = await supabase
          .from('models').insert(modelData).select().single()

        if (!saved) { errors++; continue }

        const valueUpserts: any[] = []
        for (const feat of (features || [])) {
          const cat = (categories || []).find(c => c.id === feat.category_id)
          const colName = feat.name
          const colWithCat = `${cat?.name} - ${feat.name}`
          const val = row[colName] || row[colWithCat] || ''
          if (val !== '') {
            valueUpserts.push({ feature_id: feat.id, model_id: saved.id, value: String(val) })
          }
        }
        if (valueUpserts.length > 0) {
          await supabase.from('feature_values').upsert(valueUpserts, { onConflict: 'feature_id,model_id' })
        }
        imported++
      } catch { errors++ }
    }

    toast(`Importados: ${imported} vehículos${errors > 0 ? ` · Errores: ${errors}` : ''}`)
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
          <h2 className="font-black text-base mb-2 text-slate-700 uppercase tracking-wider">Formato del Excel</h2>
          <p className="text-sm text-slate-500 mb-4">El archivo Excel debe tener estas columnas en la primera fila:</p>
          <div className="bg-slate-50 rounded-xl p-4 text-xs font-mono text-slate-600 space-y-1">
            <div><span className="font-bold text-blue-600">Brand</span> · <span className="font-bold text-blue-600">Model</span> · <span className="font-bold text-blue-600">Version</span> · <span className="font-bold text-blue-600">Price</span> · <span className="font-bold text-blue-600">Image</span></div>
            <div className="text-slate-400 mt-2">Luego una columna por cada característica con el mismo nombre exacto:</div>
            <div>Driving Mileage under WMTC mode (km) · Battery capacity (kWh) · Maximum speed (km/h) · ...</div>
          </div>
          <a href="#" onClick={downloadTemplate} className="inline-block mt-4 text-sm text-blue-600 font-bold hover:underline">⬇ Descargar plantilla Excel</a>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-black text-base mb-4 text-slate-700 uppercase tracking-wider">Subir archivo</h2>
          <input type="file" accept=".xlsx,.xls" onChange={handleFile}
            className="w-full border-2 border-dashed border-slate-200 rounded-xl p-8 text-sm text-slate-500 cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition" />
        </div>

        {preview.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-black text-base mb-4 text-slate-700 uppercase tracking-wider">Vista previa ({rows.length} filas)</h2>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {Object.keys(preview[0]).slice(0,6).map(k => (
                      <th key={k} className="text-left p-2 font-bold text-slate-500 uppercase">{k}</th>
                    ))}
                    {Object.keys(preview[0]).length > 6 && <th className="text-left p-2 text-slate-400">+{Object.keys(preview[0]).length - 6} más</th>}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      {Object.values(r).slice(0,6).map((v: any, j) => (
                        <td key={j} className="p-2 text-slate-600">{String(v).slice(0,30)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={doImport} disabled={loading}
              className="mt-4 w-full bg-[#081224] text-white font-bold py-4 rounded-2xl hover:bg-[#162040] disabled:opacity-50 text-sm">
              {loading ? 'Importando...' : `✓ Importar ${rows.length} vehículos`}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  async function downloadTemplate() {
    const { data: features } = await supabase.from('features').select('*')
    const headers = ['Brand','Model','Version','Price','Image', ...(features||[]).map(f => f.name)]
    const ws = XLSX.utils.aoa_to_sheet([headers, headers.map(() => '')])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Vehículos')
    XLSX.writeFile(wb, 'plantilla_liux.xlsx')
  }
}