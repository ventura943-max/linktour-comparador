'use client'
import { useState, useRef, useEffect } from 'react'

export default function ComparadorClient({ models, categories, features, values }: any) {
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>(models.slice(0, 3).map((m: any) => m.id))
  const [showPicker, setShowPicker] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  const selectedModels = models.filter((m: any) => selectedIds.includes(m.id))
  const availableModels = models.filter((m: any) => !selectedIds.includes(m.id))

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function addModel(id: string) {
    setSelectedIds([...selectedIds, id])
    setShowPicker(false)
  }

  function removeModel(id: string) {
    if (selectedIds.length <= 1) return
    setSelectedIds(selectedIds.filter(x => x !== id))
  }

  function val(featId: string, modelId: string) {
    const v = values.find((v: any) => v.feature_id === featId && v.model_id === modelId)
    return v ? v.value : '—'
  }

  function specVal(featName: string, modelId: string) {
    const f = features.find((f: any) => f.name === featName)
    if (!f) return '—'
    return val(f.id, modelId)
  }

  const groups: Record<string, any[]> = {}
  selectedModels.forEach((m: any) => {
    const key = m.brand + ' ' + m.name
    if (!groups[key]) groups[key] = []
    groups[key].push(m)
  })

  const specRows = [
    ['Range WMTC', 'Driving Mileage under WMTC mode (km)'],
    ['Max speed', 'Maximum speed (km/h)'],
    ['Battery', 'Battery capacity (kWh)'],
    ['Peak power', 'Motor peak power (kW)'],
    ['Torque', 'Motor torque (Nm)'],
    ['Charge 0-100%', 'AC charging time 0-100% (h)'],
  ]

  const filteredFeatures = categories.flatMap((cat: any) => {
    const feats = features.filter((f: any) => {
      if (f.category_id !== cat.id) return false
      if (activeCat !== 'all' && cat.id !== activeCat) return false
      if (search && !f.name.toLowerCase().includes(search.toLowerCase()) && !cat.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    return feats.map((f: any, fi: number) => ({ ...f, catName: cat.name, catId: cat.id, isFirst: fi === 0 }))
  })

  return (
    <main className="min-h-screen bg-[#f3f6fa] overflow-x-hidden">

      {/* HEADER */}
      <header className="bg-[#071225] text-white px-4 md:px-8 flex items-center justify-between sticky top-0 z-20 shadow-lg h-14">
        <div>
          <div className="font-black text-lg tracking-widest leading-none">LIUX</div>
          <div className="text-[8px] tracking-[.3em] text-slate-400 leading-none mt-0.5">LINKTOUR</div>
        </div>
        {/* Desktop nav */}
        <nav className="hidden md:flex gap-1">
          {['Comparador','Modelos','Ficha completa'].map(n => (
            <a key={n} href={`#${n.toLowerCase().replace(' ','-')}`}
              className="text-slate-300 hover:text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-white/10 transition">{n}</a>
          ))}
          <a href="/admin" className="text-slate-400 hover:text-white text-lg px-3 py-2 rounded-lg hover:bg-white/10 transition">⚙</a>
        </nav>
        {/* Mobile nav */}
        <div className="flex md:hidden items-center gap-2">
          <a href="/admin" className="text-slate-400 text-lg px-2">⚙</a>
          <button onClick={() => setMenuOpen(!menuOpen)} className="text-slate-300 px-2 text-xl">☰</button>
        </div>
      </header>

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div className="md:hidden bg-[#071225] border-t border-white/10 px-4 py-2 flex flex-col gap-1 z-10">
          {['Comparador','Modelos','Ficha completa'].map(n => (
            <a key={n} href={`#${n.toLowerCase().replace(' ','-')}`} onClick={() => setMenuOpen(false)}
              className="text-slate-300 text-sm font-bold py-2 border-b border-white/5">{n}</a>
          ))}
        </div>
      )}

      {/* TITLE */}
      <section id="comparador" className="px-4 md:px-6 pt-6 pb-4 text-center">
        <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1">Comparador de Modelos</h1>
        <p className="text-slate-500 text-sm">Comparativa técnica y comercial</p>
      </section>

      {/* CARDS */}
      <section id="modelos" className="px-4 md:px-6 pb-6">
        <div className="overflow-x-auto pb-2 -mx-4 px-4">
          <div className="flex gap-3 items-stretch" style={{ minWidth: 'max-content' }}>
            {selectedModels.map((m: any) => (
              <div key={m.id} className="bg-white rounded-2xl border border-slate-200 p-3 shadow-md w-40 md:w-44 shrink-0 relative group">
                <button onClick={() => removeModel(m.id)}
                  className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-500 text-xs font-bold opacity-0 group-hover:opacity-100 transition flex items-center justify-center z-10">✕</button>
                <div className="text-[8px] font-black tracking-widest text-blue-600 uppercase">{m.brand} {m.name}</div>
                <div className="font-black text-base tracking-tight mb-2">{m.version || m.name}</div>
                <div className="h-20 flex items-center justify-center overflow-hidden mb-2 bg-slate-50 rounded-xl">
                  {m.img_url
                    ? <img src={m.img_url} alt={m.name} className="max-h-20 max-w-full object-contain" />
                    : <span className="text-xs text-slate-400">Sin imagen</span>
                  }
                </div>
                {specRows.map(([label, featName]) => (
                  <div key={label} className="flex justify-between border-t border-slate-100 pt-1 gap-1">
                    <span className="text-[9px] text-slate-500 truncate">{label}</span>
                    <span className="text-[9px] font-black text-slate-900 shrink-0">{specVal(featName, m.id)}</span>
                  </div>
                ))}
              </div>
            ))}

            {availableModels.length > 0 && (
              <div className="relative shrink-0" ref={pickerRef}>
                <button onClick={() => setShowPicker(!showPicker)}
                  className="w-32 md:w-40 h-full min-h-[260px] border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition cursor-pointer bg-white">
                  <div className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center text-xl font-light">+</div>
                  <div className="text-xs font-bold text-center px-2">Añadir modelo</div>
                </button>
                {showPicker && (
                  <div className="absolute top-0 left-0 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 z-20 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <div className="text-xs font-black text-slate-500 uppercase tracking-wider">Selecciona un modelo</div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {availableModels.map((m: any) => (
                        <button key={m.id} onClick={() => addModel(m.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left border-b border-slate-50">
                          <div className="w-10 h-7 bg-slate-50 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                            {m.img_url ? <img src={m.img_url} className="max-w-full max-h-full object-contain" /> : <span className="text-[9px] text-slate-400">—</span>}
                          </div>
                          <div>
                            <div className="text-[8px] font-bold text-blue-600 uppercase">{m.brand}</div>
                            <div className="text-sm font-bold text-slate-800">{m.version || m.name}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* TABLE */}
      <section id="ficha-completa" className="px-4 md:px-6 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 gap-2">
          <h2 className="text-xl md:text-2xl font-black tracking-tight">Ficha completa</h2>
          <div className="flex items-center gap-2">
            <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
              className="border border-slate-200 rounded-full px-3 py-2 text-sm outline-none focus:border-blue-400 flex-1 md:min-w-[200px]" />
            <span className="text-xs text-slate-400 whitespace-nowrap">{filteredFeatures.length} espec.</span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mb-4 overflow-x-auto pb-1">
          {[{ id: 'all', name: 'Todo' }, ...categories].map((c: any) => (
            <button key={c.id} onClick={() => setActiveCat(c.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer whitespace-nowrap ${activeCat === c.id ? 'bg-[#081224] text-white border-[#081224]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
              {c.name}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-x-auto">
          <table className="border-collapse text-xs" style={{ tableLayout: 'fixed', width: `${180 + selectedModels.length * 90}px`, minWidth: '100%' }}>
            <colgroup>
              <col style={{ width: '70px' }} />
              <col style={{ width: '110px' }} />
              {selectedModels.map((m: any) => <col key={m.id} style={{ width: '90px' }} />)}
            </colgroup>
            <thead>
              <tr>
                <th colSpan={2} className="bg-[#081224]"></th>
                {Object.entries(groups).map(([key, ms]: any) => (
                  <th key={key} colSpan={ms.length} className="bg-[#14243a] text-[#a8c4e8] text-center py-2 text-[9px] font-black tracking-wider uppercase border border-[#1a2f4a]">{key}</th>
                ))}
              </tr>
              <tr>
                <th className="bg-[#081224] text-white text-left px-2 py-2 font-black uppercase text-[8px] tracking-wider">Cat.</th>
                <th className="bg-[#081224] text-white text-left px-2 py-2 font-black uppercase text-[8px] tracking-wider">Característica</th>
                {selectedModels.map((m: any) => (
                  <th key={m.id} className="bg-[#081224] text-white text-center px-1 py-2 font-black text-[8px]">{m.version || m.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredFeatures.map((feat: any) => (
                <tr key={feat.id} className={feat.isFirst ? 'border-t-2 border-slate-300' : ''}>
                  <td className="border border-slate-100 px-1 py-1.5 text-[9px] font-bold text-slate-500 bg-slate-50 overflow-hidden text-ellipsis whitespace-nowrap">{feat.isFirst ? feat.catName : ''}</td>
                  <td className="border border-slate-100 px-1 py-1.5 text-[9px] text-slate-700 overflow-hidden text-ellipsis whitespace-nowrap" title={feat.name}>{feat.name}</td>
                  {selectedModels.map((m: any) => {
                    const v = val(feat.id, m.id)
                    const lo = v.toLowerCase().trim()
                    const cls = lo === 'yes' ? 'text-emerald-700 bg-emerald-50 font-black' : lo === 'no' ? 'text-red-600 bg-red-50 font-black' : lo === 'n/a' ? 'text-slate-400' : ''
                    const display = lo === 'yes' ? '✓' : lo === 'no' ? '✗' : v
                    return <td key={m.id} className={`border border-slate-100 px-1 py-1.5 text-center text-[9px] overflow-hidden text-ellipsis whitespace-nowrap ${cls}`} title={v}>{display}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}