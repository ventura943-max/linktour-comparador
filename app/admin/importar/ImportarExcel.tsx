'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

const IconComparador = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></svg>
const IconModelos = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 17H5a2 2 0 01-2-2V7l3-4h12l3 4v8a2 2 0 01-2 2z"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/></svg>
const IconCategorias = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
const IconAnalisis = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
const IconLogout = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>

function Sidebar() {
  const items = [
    { href: '/', label: 'Comparador', icon: <IconComparador /> },
    { href: '/?m=modelos', label: 'Modelos', icon: <IconModelos />, active: true },
    { href: '/?m=categorias', label: 'Categorías', icon: <IconCategorias /> },
    { href: '/?m=analisis', label: 'Análisis comparativo', icon: <IconAnalisis /> },
  ]
  return (
    <aside className="fixed top-0 left-0 h-full w-56 bg-[#071225] z-30 flex flex-col">
      <div className="px-5 py-4 border-b border-white/10 h-14 flex items-center">
        <div>
          <div className="font-black text-lg tracking-widest text-white leading-none">LIUX</div>
          <div className="text-[8px] tracking-[.3em] text-slate-400 mt-0.5">COMPARADOR</div>
        </div>
      </div>
      <nav className="flex-1 py-4 px-2 space-y-1">
        {items.map(item => (
          <a key={item.href} href={item.href}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition
              ${item.active ? 'bg-white/15 text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>
            {item.icon}
            {item.label}
          </a>
        ))}
      </nav>
      <div className="border-t border-white/10 py-3 px-2">
        <button onClick={async () => { await fetch('/api/auth', { method: 'DELETE' }); window.location.href = '/admin/login' }}
          className="w-full flex items-center gap-3 px-3 text-slate-500 hover:text-red-400 transition rounded-xl py-2">
          <IconLogout />
          <span className="text-xs">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}

export default function ImportarExcel() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [preview, setPreview] = useState<any[]>([])
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
      const merges = ws['!merges'] || []
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      const row0 = [...(rows[0] as string[])]
      for (const m of merges) {
        if (m.s.r === 0) {
          const val = row0[m.s.c]
          for (let c = m.s.c; c <= m.e.c; c++) row0[c] = val
        }
      }
      const row1 = rows[1] as string[]
      const vehicles: { brand: string, model: string, version: string, colIndex: number }[] = []
      for (let c = 2; c < row0.length; c++) {
        const group = String(row0[c] || '').trim()
        const version = String(row1[c] || '').trim()
        if (!group || !version) continue
        const parts = group.split(' ')
        vehicles.push({ brand: parts[0] || '', model: parts.slice(1).join(' ') || '', version, colIndex: c })
      }
      const featureRows: { category: string, feature: string, values: Record<number, string> }[] = []
      let currentCat = ''
      for (let r = 2; r < rows.length; r++) {
        const row = rows[r]
        if (!row || row.every((c: any) => !c)) continue
        if (row[0] && String(row[0]).trim()) currentCat = String(row[0]).trim()
        const feat = String(row[1] || '').trim()
        if (!feat) continue
        const values: Record<number, string> = {}
        for (const v of vehicles) values[v.colIndex] = String(row[v.colIndex] || '').trim()
        featureRows.push({ category: currentCat, feature: feat, values })
      }
      setParsed({ vehicles, featureRows })
      setPreview(vehicles)
    }
    reader.readAsArrayBuffer(file)
  }

  async function doImport() {
    if (!parsed) { toast('No hay datos para importar'); return }
    setLoading(true)
    const { vehicles, featureRows } = parsed
    const { data: dbCats } = await supabase.from('categories').select('*')
    const { data: dbFeats } = await supabase.from('features').select('*')
    let imported = 0, errors = 0
    for (const v of vehicles) {
      try {
        const { data: saved } = await supabase.from('models').insert({
          brand: v.brand, name: v.model, version: v.version, is_active: true, sort_order: 0,
        }).select().single()
        if (!saved) { errors++; continue }
        const upserts: any[] = []
        for (const fr of featureRows) {
          const dbFeat = dbFeats?.find(f => {
            const dbCat = dbCats?.find(c => c.id === f.category_id)
            return f.name.toLowerCase().trim() === fr.feature.toLowerCase().trim() &&
              dbCat?.name.toLowerCase().trim() === fr.category.toLowerCase().trim()
          })
          if (!dbFeat) continue
          const val = fr.values[v.colIndex]
          if (val !== '') upserts.push({ feature_id: dbFeat.id, model_id: saved.id, value: String(val) })
        }
        if (upserts.length > 0) await supabase.from('feature_values').upsert(upserts, { onConflict: 'feature_id,model_id' })
        imported++
      } catch { errors++ }
    }
    toast(`Importados: ${imported} vehículos${errors > 0 ? ` · Errores: ${errors}` : ' ✓'}`)
    setLoading(false)
    if (imported > 0) setTimeout(() => router.push('/'), 2000)
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1 ml-56">
        {msg && <div className="fixed top-4 right-4 bg-[#081224] text-white px-5 py-3 rounded-full text-sm font-bold shadow-lg z-50">{msg}</div>}

        <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
          <div>
            <h1 className="font-black text-lg">Importar Excel</h1>
            <p className="text-xs text-slate-400">Importa vehículos desde un archivo Excel</p>
          </div>
          <button onClick={() => router.push('/')} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">← Volver</button>
        </div>

        <div className="max-w-3xl mx-auto p-6 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-black text-base mb-2 text-slate-700 uppercase tracking-wider">Formato esperado</h2>
            <div className="bg-slate-50 rounded-xl p-4 text-xs font-mono text-slate-600 space-y-1">
              <div>Fila 1: <span className="text-blue-600">Category · Feature · [MARCA MODELO combinado] · [MARCA MODELO2]</span></div>
              <div>Fila 2: <span className="text-blue-600">— · — · Versión1 · Versión2 · Versión3</span></div>
              <div>Fila 3+: <span className="text-slate-400">datos</span></div>
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
                {preview.map((v: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl">
                    <div className="w-6 h-6 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">{i+1}</div>
                    <div>
                      <span className="text-xs font-bold text-blue-600 uppercase mr-2">{v.brand}</span>
                      <span className="text-sm font-bold">{v.model}</span>
                      <span className="text-sm text-slate-400 ml-1">{v.version}</span>
                    </div>
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
    </div>
  )
}