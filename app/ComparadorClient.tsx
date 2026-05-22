'use client'
import { useState } from 'react'

export default function ComparadorClient({ models, categories, features, values }: any) {
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>(models.map((m: any) => m.id))

  const selectedModels = models.filter((m: any) => selectedIds.includes(m.id))

  function toggleModel(id: string) {
    if (selectedIds.includes(id)) {
      if (selectedIds.length <= 1) return // keep at least 1
      setSelectedIds(selectedIds.filter(x => x !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
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
    <main className="min-h-screen bg-[#f3f6fa]">
      <header className="bg-[#071225] text-white px-8 flex items-center justify-between sticky top-0 z-10 shadow-lg h-16">
        <div>
          <div className="font-black text-xl tracking-widest leading-none">LIUX</div>
          <div className="text-[9px] tracking-[.3em] text-slate-400 leading-none mt-1">LINKTOUR</div>
        </div>
        <nav className="flex gap-1">
          {['Comparador','Modelos','Ficha completa'].map(n => (
            <a key={n} href={`#${n.toLowerCase().replace(' ','-')}`}
              className="text-slate-300 hover:text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-white/10 transition">{n}</a>
          ))}
          <a href="/admin" className="text-slate-400 hover:text-white text-lg px-3 py-2 rounded-lg hover:bg-white/10 transition">⚙</a>
        </nav>
      </header>

      {/* MODEL SELECTOR */}
      <section id="comparador" className="px-6 pt-6 pb-2">
        <h1 className="text-3xl font-black tracking-tight text-center mb-1">Comparador de Modelos</h1>
        <p className="text-slate-500 text-sm text-center mb-5">Selecciona los modelos que quieres comparar</p>
        <div className="flex gap-3 flex-wrap justify-center mb-2">
          {models.map((m: any) => {
            const active = selectedIds.includes(m.id)
            return (
              <button key={m.id} onClick={() => toggleModel(m.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border-2 transition ${active ? 'border-[#081224] bg-[#081224] text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400'}`}>
                {m.img_url && <img src={m.img_url} className="w-6 h-4 object-contain" />}
                <span className="text-xs opacity-70">{m.brand}</span>
                <span>{m.version || m.name}</span>
                {active ? <span className="text-xs">✓</span> : <span className="text-xs opacity-40">+</span>}
              </button>
            )
          })}
        </div>
        <p className="text-center text-xs text-slate-400 mb-4">{selectedIds.length} de {models.length} modelos seleccionados</p>
      </section>

      {/* CARDS */}
      <section id="modelos" className="px-6 pb-6">
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
            {selectedModels.map((m: any) => (
              <div key={m.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-md w-44 shrink-0">
                <div className="text-[9px] font-black tracking-widest text-blue-600 uppercase mb-0">{m.brand} {m.name}</div>
                <div className="font-black text-lg tracking-tight mb-2">{m.version || m.name}</div>
                <div className="h-24 flex items-center justify-center overflow-hidden mb-2 bg-slate-50 rounded-xl">
                  {m.img_url
                    ? <img src={m.img_url} alt={m.name} className="max-h-24 max-w-full object-contain" />
                    : <span className="text-xs text-slate-400">Sin imagen</span>
                  }
                </div>
                {specRows.map(([label, featName]) => (
                  <div key={label} className="flex justify-between border-t border-slate-100 pt-1 gap-1">
                    <span className="text-[10px] text-slate-500">{label}</span>
                    <span className="text-[10px] font-black text-slate-900">{specVal(featName, m.id)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TABLE */}
      <section id="ficha-completa" className="px-6 pb-10">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h2 className="text-2xl font-black tracking-tight">Ficha completa</h2>
          <div className="flex items-center gap-3">
            <input type="text" placeholder="Buscar especificación..." value={search} onChange={e => setSearch(e.target.value)}
              className="border border-slate-200 rounded-full px-4 py-2 text-sm outline-none focus:border-blue-400 min-w-[220px]" />
            <span className="text-sm text-slate-400 whitespace-nowrap">{filteredFeatures.length} especificaciones</span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mb-4">
          {[{ id: 'all', name: 'Todo' }, ...categories].map((c: any) => (
            <button key={c.id} onClick={() => setActiveCat(c.id)}
              className={`px-4 py-2 rounded-full text-xs font-bold border transition cursor-pointer ${activeCat === c.id ? 'bg-[#081224] text-white border-[#081224]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
              {c.name}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-x-auto">
          <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '90px' }} />
              <col style={{ width: '180px' }} />
              {selectedModels.map((m: any) => <col key={m.id} style={{ width: '100px' }} />)}
            </colgroup>
            <thead>
              <tr>
                <th colSpan={2} className="bg-[#081224]"></th>
                {Object.entries(groups).map(([key, ms]: any) => (
                  <th key={key} colSpan={ms.length} className="bg-[#14243a] text-[#a8c4e8] text-center py-2 text-[10px] font-black tracking-wider uppercase border border-[#1a2f4a]">{key}</th>
                ))}
              </tr>
              <tr>
                <th className="bg-[#081224] text-white text-left px-2 py-3 font-black uppercase text-[9px] tracking-wider">Cat.</th>
                <th className="bg-[#081224] text-white text-left px-2 py-3 font-black uppercase text-[9px] tracking-wider">Característica</th>
                {selectedModels.map((m: any) => (
                  <th key={m.id} className="bg-[#081224] text-white text-center px-1 py-3 font-black text-[9px]">{m.version || m.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredFeatures.map((feat: any) => (
                <tr key={feat.id} className={feat.isFirst ? 'border-t-2 border-slate-300' : ''}>
                  <td className="border border-slate-100 px-2 py-2 text-[10px] font-bold text-slate-500 bg-slate-50 overflow-hidden text-ellipsis whitespace-nowrap">{feat.isFirst ? feat.catName : ''}</td>
                  <td className="border border-slate-100 px-2 py-2 text-[10px] text-slate-700 overflow-hidden text-ellipsis whitespace-nowrap" title={feat.name}>{feat.name}</td>
                  {selectedModels.map((m: any) => {
                    const v = val(feat.id, m.id)
                    const lo = v.toLowerCase().trim()
                    const cls = lo === 'yes' ? 'text-emerald-700 bg-emerald-50 font-black' : lo === 'no' ? 'text-red-600 bg-red-50 font-black' : lo === 'n/a' ? 'text-slate-400' : ''
                    const display = lo === 'yes' ? '✓' : lo === 'no' ? '✗' : v
                    return <td key={m.id} className={`border border-slate-100 px-1 py-2 text-center text-[10px] overflow-hidden text-ellipsis whitespace-nowrap ${cls}`} title={v}>{display}</td>
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