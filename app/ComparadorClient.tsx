'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ── ICONS ────────────────────────────────────────────────────────────────────
const IconComparador = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></svg>
const IconModelos = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 17H5a2 2 0 01-2-2V7l3-4h12l3 4v8a2 2 0 01-2 2z"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/></svg>
const IconCategorias = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
const IconAnalisis = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>

// ── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ active, setActive, mobileOpen, setMobileOpen }: any) {
  const items = [
    { id: 'comparador', label: 'Comparador', icon: <IconComparador /> },
    { id: 'modelos', label: 'Modelos', icon: <IconModelos /> },
    { id: 'categorias', label: 'Categorías', icon: <IconCategorias /> },
    { id: 'analisis', label: 'Análisis comparativo', icon: <IconAnalisis /> },
  ]
  return (
    <>
      {/* Overlay móvil */}
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed top-0 left-0 h-full w-56 bg-[#071225] z-30 flex flex-col transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="px-5 py-5 border-b border-white/10">
          <div className="font-black text-xl tracking-widest text-white leading-none">LIUX</div>
          <div className="text-[8px] tracking-[.3em] text-slate-400 mt-0.5">COMPARADOR</div>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-1">
          {items.map(item => (
            <button key={item.id} onClick={() => { setActive(item.id); setMobileOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition text-left
                ${active === item.id ? 'bg-white/15 text-white' : 'text-slate-400 hover:bg-white/8 hover:text-white'}`}>
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <button onClick={async () => { await fetch('/api/auth', { method: 'DELETE' }); window.location.href = '/admin/login' }}
            className="w-full text-xs text-slate-500 hover:text-red-400 transition text-left px-3 py-2">
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}

// ── COMPARADOR ───────────────────────────────────────────────────────────────
function Comparador({ models, categories, features, values }: any) {
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>(models.slice(0, 3).map((m: any) => m.id))
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  const selectedModels = models.filter((m: any) => selectedIds.includes(m.id))
  const availableModels = models.filter((m: any) => !selectedIds.includes(m.id))

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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
    <div>
      <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1">Comparador de Modelos</h1>
      <p className="text-slate-500 text-sm mb-6">Comparativa técnica y comercial</p>

      {/* CARDS */}
      <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 mb-8">
        <div className="flex gap-3 items-stretch" style={{ minWidth: 'max-content' }}>
          {selectedModels.map((m: any) => (
            <div key={m.id} className="bg-white rounded-2xl border border-slate-200 p-3 shadow-md w-40 shrink-0 relative group">
              <button onClick={() => selectedIds.length > 1 && setSelectedIds(selectedIds.filter(x => x !== m.id))}
                className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-500 text-xs font-bold opacity-0 group-hover:opacity-100 transition flex items-center justify-center z-10">✕</button>
              <div className="text-[8px] font-black tracking-widest text-blue-600 uppercase">{m.brand} {m.name}</div>
              <div className="font-black text-base tracking-tight mb-2">{m.version || m.name}</div>
              <div className="h-20 flex items-center justify-center overflow-hidden mb-2 bg-slate-50 rounded-xl">
                {m.img_url ? <img src={m.img_url} alt={m.name} className="max-h-20 max-w-full object-contain" /> : <span className="text-xs text-slate-400">Sin imagen</span>}
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
                className="w-36 h-full min-h-[260px] border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition cursor-pointer bg-white">
                <div className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center text-xl">+</div>
                <div className="text-xs font-bold text-center px-2">Añadir modelo</div>
              </button>
              {showPicker && (
                <div className="absolute top-0 left-0 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 z-20 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 text-xs font-black text-slate-500 uppercase tracking-wider">Selecciona un modelo</div>
                  <div className="max-h-64 overflow-y-auto">
                    {availableModels.map((m: any) => (
                      <button key={m.id} onClick={() => { setSelectedIds([...selectedIds, m.id]); setShowPicker(false) }}
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

      {/* FILTERS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 gap-2">
        <h2 className="text-xl font-black tracking-tight">Ficha completa</h2>
        <div className="flex items-center gap-2">
          <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
            className="border border-slate-200 rounded-full px-3 py-2 text-sm outline-none focus:border-blue-400 flex-1 md:min-w-[200px]" />
          <span className="text-xs text-slate-400 whitespace-nowrap">{filteredFeatures.length} espec.</span>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap mb-4">
        {[{ id: 'all', name: 'Todo' }, ...categories].map((c: any) => (
          <button key={c.id} onClick={() => setActiveCat(c.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap ${activeCat === c.id ? 'bg-[#081224] text-white border-[#081224]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
            {c.name}
          </button>
        ))}
      </div>

      {/* TABLE */}
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
              <th className="bg-[#081224] text-white text-left px-2 py-2 font-black uppercase text-[8px]">Cat.</th>
              <th className="bg-[#081224] text-white text-left px-2 py-2 font-black uppercase text-[8px]">Característica</th>
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
    </div>
  )
}

// ── MODELOS ──────────────────────────────────────────────────────────────────
function Modelos() {
  const [models, setModels] = useState<any[]>([])
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('models').select('*').order('sort_order')
    setModels(data || [])
  }

  function toast(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  async function deleteModel(id: string) {
    if (!confirm('¿Eliminar este modelo?')) return
    await supabase.from('models').delete().eq('id', id)
    toast('Eliminado ✓'); load()
  }

  return (
    <div>
      {msg && <div className="fixed top-4 right-4 bg-[#081224] text-white px-5 py-3 rounded-full text-sm font-bold shadow-lg z-50">{msg}</div>}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Modelos</h1>
          <p className="text-slate-500 text-sm">Gestiona los vehículos del comparador</p>
        </div>
        <div className="flex gap-2">
          <a href="/admin/importar" className="px-4 py-2 border border-slate-300 bg-white text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50">⬆ Importar Excel</a>
          <a href="/admin/nuevo-vehiculo" className="px-4 py-2 bg-[#081224] text-white text-sm font-bold rounded-lg hover:bg-[#162040]">+ Nuevo vehículo</a>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="space-y-0 divide-y divide-slate-50">
          {models.map((m, idx) => (
            <div key={m.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
              <div className="flex items-center gap-4">
                <div className="w-5 text-xs font-bold text-slate-300">{idx + 1}</div>
                {m.img_url
                  ? <img src={m.img_url} className="w-16 h-10 object-contain rounded-lg bg-slate-50 border border-slate-100" />
                  : <div className="w-16 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-400">Sin img</div>
                }
                <div>
                  <div className="text-xs font-bold text-blue-600 uppercase">{m.brand}</div>
                  <div className="font-bold text-sm">{m.name} {m.version && <span className="text-slate-400 font-normal">{m.version}</span>}</div>
                  <div className="text-xs text-slate-400">{m.price}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${m.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  {m.is_active ? 'Visible' : 'Oculto'}
                </span>
                <a href={`/admin/nuevo-vehiculo?id=${m.id}`} className="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-100">✏ Editar</a>
                <button onClick={() => deleteModel(m.id)} className="px-3 py-1 text-xs border border-red-100 text-red-500 rounded-lg hover:bg-red-50">🗑</button>
              </div>
            </div>
          ))}
          {models.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-3">🚗</div>
              <div className="font-bold">Sin vehículos todavía</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── CATEGORÍAS ───────────────────────────────────────────────────────────────
function Categorias() {
  const [categories, setCategories] = useState<any[]>([])
  const [features, setFeatures] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [tab, setTab] = useState('cats')

  const [catForm, setCatForm] = useState({ name: '', sort_order: 0 })
  const [editCatId, setEditCatId] = useState<string | null>(null)
  const [featForm, setFeatForm] = useState({ name: '', category_id: '', type: 'boolean', sort_order: 0 })
  const [editFeatId, setEditFeatId] = useState<string | null>(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [c, f] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('features').select('*').order('sort_order'),
    ])
    setCategories(c.data || [])
    setFeatures(f.data || [])
  }

  function toast(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  async function saveCat() {
    if (!catForm.name) { toast('Nombre obligatorio'); return }
    if (editCatId) {
      await supabase.from('categories').update(catForm).eq('id', editCatId)
    } else {
      await supabase.from('categories').insert(catForm)
    }
    toast('Guardado ✓'); setCatForm({ name: '', sort_order: 0 }); setEditCatId(null); loadAll()
  }

  async function deleteCat(id: string) {
    if (!confirm('¿Eliminar categoría y sus características?')) return
    await supabase.from('categories').delete().eq('id', id)
    toast('Eliminado ✓'); loadAll()
  }

  async function saveFeat() {
    if (!featForm.name || !featForm.category_id) { toast('Nombre y categoría obligatorios'); return }
    if (editFeatId) {
      await supabase.from('features').update(featForm).eq('id', editFeatId)
    } else {
      await supabase.from('features').insert(featForm)
    }
    toast('Guardado ✓'); setFeatForm({ name: '', category_id: '', type: 'boolean', sort_order: 0 }); setEditFeatId(null); loadAll()
  }

  async function deleteFeat(id: string) {
    if (!confirm('¿Eliminar esta característica?')) return
    await supabase.from('features').delete().eq('id', id)
    toast('Eliminado ✓'); loadAll()
  }

  const ic = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
  const lc = "block text-xs font-bold text-slate-500 uppercase mb-1"

  return (
    <div>
      {msg && <div className="fixed top-4 right-4 bg-[#081224] text-white px-5 py-3 rounded-full text-sm font-bold shadow-lg z-50">{msg}</div>}
      <h1 className="text-2xl font-black tracking-tight mb-1">Categorías</h1>
      <p className="text-slate-500 text-sm mb-6">Gestiona categorías y características del comparador</p>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('cats')} className={`px-5 py-2 text-sm font-bold rounded-lg border transition ${tab === 'cats' ? 'bg-[#081224] text-white border-[#081224]' : 'bg-white text-slate-600 border-slate-200'}`}>Categorías</button>
        <button onClick={() => setTab('feats')} className={`px-5 py-2 text-sm font-bold rounded-lg border transition ${tab === 'feats' ? 'bg-[#081224] text-white border-[#081224]' : 'bg-white text-slate-600 border-slate-200'}`}>Características</button>
      </div>

      {tab === 'cats' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-black text-base mb-4">{editCatId ? 'Editar' : 'Añadir categoría'}</h2>
            <div className="mb-3"><label className={lc}>Nombre</label><input className={ic} value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} /></div>
            <div className="mb-4"><label className={lc}>Orden</label><input type="number" className={ic} value={catForm.sort_order} onChange={e => setCatForm({ ...catForm, sort_order: parseInt(e.target.value) })} /></div>
            <div className="flex gap-2">
              {editCatId && <button onClick={() => { setEditCatId(null); setCatForm({ name: '', sort_order: 0 }) }} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-500">Cancelar</button>}
              <button onClick={saveCat} className="px-6 py-2 bg-[#081224] text-white text-sm font-bold rounded-lg">{editCatId ? 'Actualizar' : 'Añadir'}</button>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-black text-base mb-4">Categorías ({categories.length})</h2>
            <div className="space-y-2">
              {categories.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50">
                  <div><div className="font-bold text-sm">{c.name}</div><div className="text-xs text-slate-400">Orden: {c.sort_order}</div></div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditCatId(c.id); setCatForm(c) }} className="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-100">✏</button>
                    <button onClick={() => deleteCat(c.id)} className="px-3 py-1 text-xs border border-red-100 text-red-500 rounded-lg hover:bg-red-50">🗑</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'feats' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-black text-base mb-4">{editFeatId ? 'Editar' : 'Añadir característica'}</h2>
            <div className="mb-3"><label className={lc}>Nombre</label><input className={ic} value={featForm.name} onChange={e => setFeatForm({ ...featForm, name: e.target.value })} /></div>
            <div className="mb-3">
              <label className={lc}>Categoría</label>
              <select className={ic} value={featForm.category_id} onChange={e => setFeatForm({ ...featForm, category_id: e.target.value })}>
                <option value="">Selecciona...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className={lc}>Tipo</label>
              <select className={ic} value={featForm.type} onChange={e => setFeatForm({ ...featForm, type: e.target.value })}>
                <option value="boolean">Sí / No</option>
                <option value="text">Texto</option>
                <option value="numeric">Numérico</option>
              </select>
            </div>
            <div className="mb-4"><label className={lc}>Orden</label><input type="number" className={ic} value={featForm.sort_order} onChange={e => setFeatForm({ ...featForm, sort_order: parseInt(e.target.value) })} /></div>
            <div className="flex gap-2">
              {editFeatId && <button onClick={() => { setEditFeatId(null); setFeatForm({ name: '', category_id: '', type: 'boolean', sort_order: 0 }) }} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-500">Cancelar</button>}
              <button onClick={saveFeat} className="px-6 py-2 bg-[#081224] text-white text-sm font-bold rounded-lg">{editFeatId ? 'Actualizar' : 'Añadir'}</button>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm overflow-y-auto max-h-[600px]">
            <h2 className="font-black text-base mb-4">Características ({features.length})</h2>
            {categories.map(cat => {
              const catFeats = features.filter(f => f.category_id === cat.id)
              if (!catFeats.length) return null
              return (
                <div key={cat.id} className="mb-3">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-wider py-2 border-b border-slate-100">{cat.name}</div>
                  {catFeats.map(f => (
                    <div key={f.id} className="flex items-center justify-between py-2 px-1 hover:bg-slate-50 rounded-lg">
                      <div><div className="text-sm font-medium">{f.name}</div><div className="text-xs text-slate-400">{f.type}</div></div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditFeatId(f.id); setFeatForm(f) }} className="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-100">✏</button>
                        <button onClick={() => deleteFeat(f.id)} className="px-3 py-1 text-xs border border-red-100 text-red-500 rounded-lg hover:bg-red-50">🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function ComparadorClient({ models, categories, features, values }: any) {
  const [active, setActive] = useState('comparador')
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-[#f3f6fa]">
      <Sidebar active={active} setActive={setActive} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 md:ml-56 min-h-screen flex flex-col">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center justify-between bg-[#071225] text-white px-4 h-14 sticky top-0 z-10">
          <button onClick={() => setMobileOpen(true)} className="text-xl text-slate-300">☰</button>
          <div className="font-black text-lg tracking-widest">LIUX</div>
          <div className="w-8" />
        </div>

        <main className="flex-1 p-4 md:p-8">
          {active === 'comparador' && <Comparador models={models} categories={categories} features={features} values={values} />}
          {active === 'modelos' && <Modelos />}
          {active === 'categorias' && <Categorias />}
          {active === 'analisis' && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="text-6xl mb-4">📊</div>
              <h1 className="text-2xl font-black tracking-tight mb-2">Análisis comparativo</h1>
              <div className="inline-block bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-full text-sm font-bold">En construcción</div>
              <p className="text-slate-400 text-sm mt-3">Próximamente disponible</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}