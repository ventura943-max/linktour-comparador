'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { translations, Lang, T } from '@/lib/i18n'

const IconComparador = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></svg>
const IconModelos = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 17H5a2 2 0 01-2-2V7l3-4h12l3 4v8a2 2 0 01-2 2z"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/></svg>
const IconCategorias = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
const IconAnalisis = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
const IconLogout = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
const IconChevron = ({ collapsed }: { collapsed: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }}>
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)

const LANGS: { code: Lang, flag: string, label: string }[] = [
  { code: 'es', flag: '🇪🇸', label: 'ES' },
  { code: 'en', flag: '🇬🇧', label: 'EN' },
  { code: 'it', flag: '🇮🇹', label: 'IT' },
]

function Sidebar({ active, setActive, collapsed, setCollapsed, mobileOpen, setMobileOpen, lang, setLang, t }: any) {
  const items = [
    { id: 'comparador', label: t.comparador, icon: <IconComparador /> },
    { id: 'modelos', label: t.modelos, icon: <IconModelos /> },
    { id: 'categorias', label: t.categorias, icon: <IconCategorias /> },
    { id: 'analisis', label: t.analisis, icon: <IconAnalisis /> },
  ]

  const w = collapsed ? 'w-16' : 'w-56'

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed top-0 left-0 h-full ${w} bg-[#071225] z-30 flex flex-col transition-all duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>

        <div className={`flex items-center border-b border-white/10 h-14 ${collapsed ? 'justify-center px-0' : 'px-5 justify-between'}`}>
          {!collapsed && (
            <div>
              <div className="font-black text-lg tracking-widest text-white leading-none">LIUX</div>
              <div className="text-[8px] tracking-[.3em] text-slate-400 mt-0.5">{t.appName}</div>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)}
            className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-white/10 hidden md:flex items-center justify-center">
            <IconChevron collapsed={collapsed} />
          </button>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1">
          {items.map(item => (
            <button key={item.id} onClick={() => { setActive(item.id); setMobileOpen(false) }}
              title={collapsed ? item.label : ''}
              className={`w-full flex items-center gap-3 rounded-xl text-sm font-bold transition text-left
                ${collapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5'}
                ${active === item.id ? 'bg-white/15 text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* LANGUAGE FLAGS */}
        <div className={`border-t border-white/10 py-3 px-2 ${collapsed ? 'flex flex-col items-center gap-1' : 'flex items-center justify-center gap-1'}`}>
          {LANGS.map(l => (
            <button key={l.code} onClick={() => setLang(l.code)}
              title={l.label}
              className={`flex items-center gap-1 rounded-lg px-2 py-1.5 transition text-sm
                ${lang === l.code ? 'bg-white/20 text-white' : 'text-slate-500 hover:bg-white/10 hover:text-white'}`}>
              <span>{l.flag}</span>
              {!collapsed && <span className="text-xs font-bold">{l.label}</span>}
            </button>
          ))}
        </div>

        {/* LOGOUT */}
        <div className="border-t border-white/10 py-3 px-2">
          <button onClick={async () => { await fetch('/api/auth', { method: 'DELETE' }); window.location.href = '/admin/login' }}
            title={collapsed ? t.cerrarSesion : ''}
            className={`w-full flex items-center gap-3 text-slate-500 hover:text-red-400 transition rounded-xl py-2
              ${collapsed ? 'justify-center px-0' : 'px-3'}`}>
            <IconLogout />
            {!collapsed && <span className="text-xs">{t.cerrarSesion}</span>}
          </button>
        </div>
      </aside>
    </>
  )
}

function Comparador({ models, categories, features, values, t }: any) {
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
    [t.rangeWmtc, 'Driving Mileage under WMTC mode (km)'],
    [t.maxSpeed, 'Maximum speed (km/h)'],
    [t.battery, 'Battery capacity (kWh)'],
    [t.peakPower, 'Motor peak power (kW)'],
    [t.torque, 'Motor torque (Nm)'],
    [t.charge, 'AC charging time 0-100% (h)'],
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
      <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1">{t.comparadorTitle}</h1>
      <p className="text-slate-500 text-sm mb-6">{t.comparadorSubtitle}</p>

      <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 mb-8">
        <div className="flex gap-3 items-stretch" style={{ minWidth: 'max-content' }}>
          {selectedModels.map((m: any) => (
            <div key={m.id} className="bg-white rounded-2xl border border-slate-200 p-3 shadow-md w-40 shrink-0 relative group">
              <button onClick={() => selectedIds.length > 1 && setSelectedIds(selectedIds.filter(x => x !== m.id))}
                className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-500 text-xs font-bold opacity-0 group-hover:opacity-100 transition flex items-center justify-center z-10">✕</button>
              <div className="text-[8px] font-black tracking-widest text-blue-600 uppercase">{m.brand} {m.name}</div>
              <div className="font-black text-base tracking-tight mb-2">{m.version || m.name}</div>
              <div className="h-20 flex items-center justify-center overflow-hidden mb-2 bg-slate-50 rounded-xl">
                {m.img_url ? <img src={m.img_url} alt={m.name} className="max-h-20 max-w-full object-contain" /> : <span className="text-xs text-slate-400">{t.sinImagen}</span>}
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
                <div className="text-xs font-bold text-center px-2">{t.añadirModelo}</div>
              </button>
              {showPicker && (
                <div className="absolute top-0 left-0 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 z-20 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 text-xs font-black text-slate-500 uppercase tracking-wider">{t.seleccionaModelo}</div>
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

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 gap-2">
        <h2 className="text-xl font-black tracking-tight">{t.fichaCompleta}</h2>
        <div className="flex items-center gap-2">
          <input type="text" placeholder={t.buscar} value={search} onChange={e => setSearch(e.target.value)}
            className="border border-slate-200 rounded-full px-3 py-2 text-sm outline-none focus:border-blue-400 flex-1 md:min-w-[200px]" />
          <span className="text-xs text-slate-400 whitespace-nowrap">{filteredFeatures.length} {t.espec}</span>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap mb-4">
        {[{ id: 'all', name: t.todo }, ...categories].map((c: any) => (
          <button key={c.id} onClick={() => setActiveCat(c.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap ${activeCat === c.id ? 'bg-[#081224] text-white border-[#081224]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-x-auto">
        <table className="border-collapse text-xs" style={{ tableLayout: 'fixed', width: `${180 + selectedModels.length * 90}px`, minWidth: '100%' }}>
          <colgroup>
            <col style={{ width: '70px' }} /><col style={{ width: '110px' }} />
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
              <th className="bg-[#081224] text-white text-left px-2 py-2 font-black uppercase text-[8px]">{t.cat}</th>
              <th className="bg-[#081224] text-white text-left px-2 py-2 font-black uppercase text-[8px]">{t.caracteristica}</th>
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

function Modelos({ t }: { t: T }) {
  const [models, setModels] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  useEffect(() => { load() }, [])
  async function load() {
    const { data } = await supabase.from('models').select('*').order('sort_order')
    setModels(data || [])
  }
  function toast(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000) }
  async function deleteModel(id: string) {
    if (!confirm(t.eliminarModelo)) return
    await supabase.from('models').delete().eq('id', id)
    toast(t.eliminado); load()
  }
  return (
    <div>
      {msg && <div className="fixed top-4 right-4 bg-[#081224] text-white px-5 py-3 rounded-full text-sm font-bold shadow-lg z-50">{msg}</div>}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{t.modelosTitle}</h1>
          <p className="text-slate-500 text-sm">{t.modelosSubtitle}</p>
        </div>
        <div className="flex gap-2">
          <a href="/admin/importar" className="px-4 py-2 border border-slate-300 bg-white text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50">{t.importarExcel}</a>
          <a href="/admin/nuevo-vehiculo" className="px-4 py-2 bg-[#081224] text-white text-sm font-bold rounded-lg hover:bg-[#162040]">{t.nuevoVehiculo}</a>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="divide-y divide-slate-50">
          {models.map((m, idx) => (
            <div key={m.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
              <div className="flex items-center gap-4">
                <div className="w-5 text-xs font-bold text-slate-300">{idx + 1}</div>
                {m.img_url ? <img src={m.img_url} className="w-16 h-10 object-contain rounded-lg bg-slate-50 border border-slate-100" /> : <div className="w-16 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-400">{t.sinImagen}</div>}
                <div>
                  <div className="text-xs font-bold text-blue-600 uppercase">{m.brand}</div>
                  <div className="font-bold text-sm">{m.name} {m.version && <span className="text-slate-400 font-normal">{m.version}</span>}</div>
                  <div className="text-xs text-slate-400">{m.price}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${m.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{m.is_active ? t.visible : t.oculto}</span>
                <a href={`/admin/nuevo-vehiculo?id=${m.id}`} className="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-100">{t.editar}</a>
                <button onClick={() => deleteModel(m.id)} className="px-3 py-1 text-xs border border-red-100 text-red-500 rounded-lg hover:bg-red-50">{t.eliminar}</button>
              </div>
            </div>
          ))}
          {models.length === 0 && <div className="text-center py-12 text-slate-400"><div className="text-4xl mb-3">🚗</div><div className="font-bold">{t.sinVehiculos}</div></div>}
        </div>
      </div>
    </div>
  )
}

function Categorias({ t }: { t: T }) {
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
    const [c, f] = await Promise.all([supabase.from('categories').select('*').order('sort_order'), supabase.from('features').select('*').order('sort_order')])
    setCategories(c.data || []); setFeatures(f.data || [])
  }
  function toast(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  async function saveCat() {
    if (!catForm.name) { toast(t.nombreObligatorio); return }
    if (editCatId) await supabase.from('categories').update(catForm).eq('id', editCatId)
    else await supabase.from('categories').insert(catForm)
    toast(t.guardado); setCatForm({ name: '', sort_order: 0 }); setEditCatId(null); loadAll()
  }
  async function deleteCat(id: string) {
    if (!confirm(t.eliminarCategoria)) return
    await supabase.from('categories').delete().eq('id', id)
    toast(t.eliminado); loadAll()
  }
  async function saveFeat() {
    if (!featForm.name || !featForm.category_id) { toast(t.nombreCatObligatorio); return }
    if (editFeatId) await supabase.from('features').update(featForm).eq('id', editFeatId)
    else await supabase.from('features').insert(featForm)
    toast(t.guardado); setFeatForm({ name: '', category_id: '', type: 'boolean', sort_order: 0 }); setEditFeatId(null); loadAll()
  }
  async function deleteFeat(id: string) {
    if (!confirm(t.eliminarCaracteristica)) return
    await supabase.from('features').delete().eq('id', id)
    toast(t.eliminado); loadAll()
  }

  const ic = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
  const lc = "block text-xs font-bold text-slate-500 uppercase mb-1"

  return (
    <div>
      {msg && <div className="fixed top-4 right-4 bg-[#081224] text-white px-5 py-3 rounded-full text-sm font-bold shadow-lg z-50">{msg}</div>}
      <h1 className="text-2xl font-black tracking-tight mb-1">{t.categoriasTitle}</h1>
      <p className="text-slate-500 text-sm mb-6">{t.categoriasSubtitle}</p>
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('cats')} className={`px-5 py-2 text-sm font-bold rounded-lg border transition ${tab === 'cats' ? 'bg-[#081224] text-white border-[#081224]' : 'bg-white text-slate-600 border-slate-200'}`}>{t.categoriasTitle}</button>
        <button onClick={() => setTab('feats')} className={`px-5 py-2 text-sm font-bold rounded-lg border transition ${tab === 'feats' ? 'bg-[#081224] text-white border-[#081224]' : 'bg-white text-slate-600 border-slate-200'}`}>{t.caracteristicas}</button>
      </div>
      {tab === 'cats' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-black text-base mb-4">{editCatId ? t.editarCategoria : t.añadirCategoria}</h2>
            <div className="mb-3"><label className={lc}>{t.nombre}</label><input className={ic} value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} /></div>
            <div className="mb-4"><label className={lc}>{t.orden}</label><input type="number" className={ic} value={catForm.sort_order} onChange={e => setCatForm({ ...catForm, sort_order: parseInt(e.target.value) })} /></div>
            <div className="flex gap-2">
              {editCatId && <button onClick={() => { setEditCatId(null); setCatForm({ name: '', sort_order: 0 }) }} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-500">{t.cancelar}</button>}
              <button onClick={saveCat} className="px-6 py-2 bg-[#081224] text-white text-sm font-bold rounded-lg">{editCatId ? t.actualizar : t.añadir}</button>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-black text-base mb-4">{t.categoriasTitle} ({categories.length})</h2>
            <div className="space-y-2">
              {categories.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50">
                  <div><div className="font-bold text-sm">{c.name}</div><div className="text-xs text-slate-400">{t.orden}: {c.sort_order}</div></div>
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
            <h2 className="font-black text-base mb-4">{editFeatId ? t.editarCaracteristica : t.añadirCaracteristica}</h2>
            <div className="mb-3"><label className={lc}>{t.nombre}</label><input className={ic} value={featForm.name} onChange={e => setFeatForm({ ...featForm, name: e.target.value })} /></div>
            <div className="mb-3">
              <label className={lc}>{t.categoria}</label>
              <select className={ic} value={featForm.category_id} onChange={e => setFeatForm({ ...featForm, category_id: e.target.value })}>
                <option value="">{t.selecciona}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className={lc}>{t.tipo}</label>
              <select className={ic} value={featForm.type} onChange={e => setFeatForm({ ...featForm, type: e.target.value })}>
                <option value="boolean">{t.siNo}</option>
                <option value="text">{t.texto}</option>
                <option value="numeric">{t.numerico}</option>
              </select>
            </div>
            <div className="mb-4"><label className={lc}>{t.orden}</label><input type="number" className={ic} value={featForm.sort_order} onChange={e => setFeatForm({ ...featForm, sort_order: parseInt(e.target.value) })} /></div>
            <div className="flex gap-2">
              {editFeatId && <button onClick={() => { setEditFeatId(null); setFeatForm({ name: '', category_id: '', type: 'boolean', sort_order: 0 }) }} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-500">{t.cancelar}</button>}
              <button onClick={saveFeat} className="px-6 py-2 bg-[#081224] text-white text-sm font-bold rounded-lg">{editFeatId ? t.actualizar : t.añadir}</button>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm overflow-y-auto max-h-[600px]">
            <h2 className="font-black text-base mb-4">{t.caracteristicas} ({features.length})</h2>
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

export default function ComparadorClient({ models, categories, features, values }: any) {
  const [active, setActive] = useState('comparador')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [lang, setLang] = useState<Lang>('es')

  const t = translations[lang]
  const ml = collapsed ? 'md:ml-16' : 'md:ml-56'

  return (
    <div className="flex min-h-screen bg-[#f3f6fa]">
      <Sidebar active={active} setActive={setActive} collapsed={collapsed} setCollapsed={setCollapsed}
        mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} lang={lang} setLang={setLang} t={t} />
      <div className={`flex-1 ${ml} min-h-screen flex flex-col transition-all duration-200`}>
        <div className="md:hidden flex items-center justify-between bg-[#071225] text-white px-4 h-14 sticky top-0 z-10">
          <button onClick={() => setMobileOpen(true)} className="text-xl text-slate-300">☰</button>
          <div className="font-black text-lg tracking-widest">LIUX</div>
          <div className="w-8" />
        </div>
        <main className="flex-1 p-4 md:p-8">
          {active === 'comparador' && <Comparador models={models} categories={categories} features={features} values={values} t={t} />}
          {active === 'modelos' && <Modelos t={t} />}
          {active === 'categorias' && <Categorias t={t} />}
          {active === 'analisis' && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="text-6xl mb-4">📊</div>
              <h1 className="text-2xl font-black tracking-tight mb-2">{t.analisis}</h1>
              <div className="inline-block bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-full text-sm font-bold">{t.enConstruccion}</div>
              <p className="text-slate-400 text-sm mt-3">{t.proximamente}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}