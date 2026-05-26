'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { translations, Lang, T } from '@/lib/i18n'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

const IconComparador = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></svg>
const IconModelos = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 17H5a2 2 0 01-2-2V7l3-4h12l3 4v8a2 2 0 01-2 2z"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/></svg>
const IconCategorias = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
const IconAnalisis = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
const IconValor = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
const IconConfig = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
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

function getName(item: any, lang: Lang) {
  if (lang === 'es' && item.name_es) return item.name_es
  if (lang === 'it' && item.name_it) return item.name_it
  return item.name
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Sidebar({ active, setActive, collapsed, setCollapsed, mobileOpen, setMobileOpen, lang, setLang, t }: any) {
  const items = [
    { id: 'comparador', label: t.comparador, icon: <IconComparador /> },
    { id: 'modelos', label: t.modelos, icon: <IconModelos /> },
    { id: 'categorias', label: t.categorias, icon: <IconCategorias /> },
    { id: 'analisis', label: t.analisis, icon: <IconAnalisis /> },
    { id: 'valor', label: 'Valor Cliente', icon: <IconValor /> },
    { id: 'config', label: 'Configuración', icon: <IconConfig /> },
  ]
  const w = collapsed ? 'w-16' : 'w-56'
  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed top-0 left-0 h-full ${w} bg-[#071225] z-30 flex flex-col transition-all duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
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
        <div className={`border-t border-white/10 py-3 px-2 ${collapsed ? 'flex flex-col items-center gap-1' : 'flex items-center justify-center gap-1'}`}>
          {LANGS.map(l => (
            <button key={l.code} onClick={() => setLang(l.code)} title={l.label}
              className={`flex items-center gap-1 rounded-lg px-2 py-1.5 transition text-sm
                ${lang === l.code ? 'bg-white/20 text-white' : 'text-slate-500 hover:bg-white/10 hover:text-white'}`}>
              <span>{l.flag}</span>
              {!collapsed && <span className="text-xs font-bold">{l.label}</span>}
            </button>
          ))}
        </div>
        <div className="border-t border-white/10 py-3 px-2">
          <button onClick={async () => { await fetch('/api/auth', { method: 'DELETE' }); window.location.href = '/admin/login' }}
            title={collapsed ? t.cerrarSesion : ''}
            className={`w-full flex items-center gap-3 text-slate-500 hover:text-red-400 transition rounded-xl py-2 ${collapsed ? 'justify-center px-0' : 'px-3'}`}>
            <IconLogout />
            {!collapsed && <span className="text-xs">{t.cerrarSesion}</span>}
          </button>
        </div>
      </aside>
    </>
  )
}

function Comparador({ models, categories, features, values, t, lang, cardFields }: any) {
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

  const activeCardFields = cardFields.filter((f: any) => f.enabled).sort((a: any, b: any) => a.order - b.order)

  const filteredFeatures = categories.flatMap((cat: any) => {
    const feats = features.filter((f: any) => {
      if (f.category_id !== cat.id) return false
      if (activeCat !== 'all' && cat.id !== activeCat) return false
      const fname = getName(f, lang).toLowerCase()
      const cname = getName(cat, lang).toLowerCase()
      if (search && !fname.includes(search.toLowerCase()) && !cname.includes(search.toLowerCase())) return false
      return true
    })
    return feats.map((f: any, fi: number) => ({ ...f, catName: getName(cat, lang), catId: cat.id, isFirst: fi === 0 }))
  })

  function exportComparador() {
    const aoa: any[][] = []
    aoa.push(['', '', ...selectedModels.map((m: any) => m.brand.toUpperCase())])
    aoa.push(['', '', ...selectedModels.map((m: any) => m.name.toUpperCase())])
    aoa.push([t.cat.toUpperCase(), t.caracteristica.toUpperCase(), ...selectedModels.map((m: any) => m.version || m.name)])
    filteredFeatures.forEach((feat: any) => {
      aoa.push([
        feat.isFirst ? feat.catName : '',
        getName(feat, lang),
        ...selectedModels.map((m: any) => {
          const v = val(feat.id, m.id)
          const lo = v.toLowerCase().trim()
          if (lo === 'yes') return 'Sí'
          if (lo === 'no') return 'No'
          return v
        })
      ])
    })
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 20 }, { wch: 35 }, ...selectedModels.map(() => ({ wch: 22 }))]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Comparativa')
    const fecha = new Date().toLocaleDateString('es-ES').replace(/\//g, '-')
    const nombres = selectedModels.map((m: any) => m.version || m.name).join('_')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true })
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `comparativa-${nombres}-${fecha}.xlsx`)
  }

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
              {activeCardFields.map((field: any) => (
                <div key={field.feature_name} className="flex justify-between border-t border-slate-100 pt-1 gap-1">
                  <span className="text-[9px] text-slate-500 truncate">{field.label}</span>
                  <span className="text-[9px] font-black text-slate-900 shrink-0">{specVal(field.feature_name, m.id)}</span>
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
          <button onClick={exportComparador} title="Descargar Excel"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-full transition whitespace-nowrap">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Excel
          </button>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap mb-4">
        {[{ id: 'all', name: t.todo }, ...categories.map((c: any) => ({ ...c, name: getName(c, lang) }))].map((c: any) => (
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
              {selectedModels.map((m: any) => (
                <th key={m.id} className="bg-[#0d1e3a] text-[#7aa4cc] text-center py-1.5 text-[8px] font-black tracking-widest uppercase border border-[#1a2f4a]">{m.brand}</th>
              ))}
            </tr>
            <tr>
              <th colSpan={2} className="bg-[#081224]"></th>
              {selectedModels.map((m: any) => (
                <th key={m.id} className="bg-[#14243a] text-[#a8c4e8] text-center py-1.5 text-[8px] font-black tracking-wider uppercase border border-[#1a2f4a]">{m.name}</th>
              ))}
            </tr>
            <tr>
              <th className="bg-[#081224] text-white text-left px-2 py-2 font-black uppercase text-[8px]">{t.cat}</th>
              <th className="bg-[#081224] text-white text-left px-2 py-2 font-black uppercase text-[8px]">{t.caracteristica}</th>
              {selectedModels.map((m: any) => (
                <th key={m.id} className="bg-[#1c3050] text-white text-center px-1 py-2 font-black text-[8px] border border-[#1a2f4a]">{m.version || m.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredFeatures.map((feat: any) => (
              <tr key={feat.id} className={feat.isFirst ? 'border-t-2 border-slate-300' : ''}>
                <td className="border border-slate-100 px-1 py-1.5 text-[9px] font-bold text-slate-500 bg-slate-50 overflow-hidden text-ellipsis whitespace-nowrap">{feat.isFirst ? feat.catName : ''}</td>
                <td className="border border-slate-100 px-1 py-1.5 text-[9px] text-slate-700 overflow-hidden text-ellipsis whitespace-nowrap" title={getName(feat, lang)}>{getName(feat, lang)}</td>
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
  const [versions, setVersions] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [tab, setTab] = useState('cats')
  const [catForm, setCatForm] = useState({ name: '', sort_order: 0 })
  const [editCatId, setEditCatId] = useState<string | null>(null)
  const [featForm, setFeatForm] = useState({ name: '', category_id: '', type: 'boolean', sort_order: 0 })
  const [editFeatId, setEditFeatId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [uploadNote, setUploadNote] = useState('')
  const [viewVersion, setViewVersion] = useState<any | null>(null)
  const [compareA, setCompareA] = useState<string>('')
  const [compareB, setCompareB] = useState<string>('')
  const [showCompare, setShowCompare] = useState(false)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => { loadAll() }, [])
  async function loadAll() {
    const [c, f, v] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('features').select('*').order('sort_order'),
      supabase.from('excel_versions').select('*').order('created_at', { ascending: false })
    ])
    setCategories(c.data || [])
    setFeatures(f.data || [])
    setVersions(v.data || [])
  }
  function toast(m: string) { setMsg(m); setTimeout(() => setMsg(''), 4000) }
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
  function exportExcel() {
    const sortedCats = [...categories].sort((a, b) => a.sort_order - b.sort_order)
    const rows: any[] = []
    sortedCats.forEach(cat => {
      features.filter(f => f.category_id === cat.id).sort((a, b) => a.sort_order - b.sort_order).forEach(f => {
        rows.push({
          'Categoría (EN)': cat.name, 'Categoría (ES)': cat.name_es || '', 'Categoría (IT)': cat.name_it || '',
          'Característica (EN)': f.name, 'Característica (ES)': f.name_es || '', 'Característica (IT)': f.name_it || '',
          'Tipo': f.type, 'Orden': f.sort_order,
        })
      })
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 12 }, { wch: 8 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Características')
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' }), 'caracteristicas-liux.xlsx')
  }
  async function importExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
        const snapshot = features.map(f => { const cat = categories.find(c => c.id === f.category_id); return { category: cat?.name || '', feature: f.name, type: f.type, name_es: f.name_es, name_it: f.name_it } })
        let added = 0
        for (const row of rows) {
          const catNameEN = String(row['Categoría (EN)'] || '').trim()
          const featNameEN = String(row['Característica (EN)'] || '').trim()
          if (!catNameEN || !featNameEN) continue
          if (features.find(f => f.name.toLowerCase() === featNameEN.toLowerCase())) continue
          const cat = categories.find(c => c.name.toLowerCase() === catNameEN.toLowerCase())
          if (!cat) continue
          await supabase.from('features').insert({ name: featNameEN, name_es: String(row['Característica (ES)'] || '').trim() || null, name_it: String(row['Característica (IT)'] || '').trim() || null, category_id: cat.id, type: String(row['Tipo'] || 'text').trim(), sort_order: parseInt(row['Orden'] || '0') })
          added++
        }
        await supabase.from('excel_versions').insert({ filename: file.name, snapshot, changes_added: added, notes: uploadNote || null })
        toast(`✓ ${added} características nuevas añadidas`)
        setUploadNote(''); await loadAll()
      } catch { toast('Error al procesar el archivo') }
      setImporting(false)
    }
    reader.readAsArrayBuffer(file); e.target.value = ''
  }
  async function restoreVersion(version: any) {
    if (!confirm(`¿Restaurar al estado del ${formatDate(version.created_at)}?`)) return
    setRestoring(true)
    try {
      await supabase.from('features').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      for (const item of version.snapshot) {
        const cat = categories.find((c: any) => c.name === item.category)
        if (!cat) continue
        await supabase.from('features').insert({ name: item.feature, type: item.type, name_es: item.name_es || null, name_it: item.name_it || null, category_id: cat.id, sort_order: 0 })
      }
      toast('✓ Versión restaurada'); await loadAll()
    } catch { toast('Error al restaurar') }
    setRestoring(false)
  }
  function getDiff(vA: any, vB: any) {
    const namesA = new Set((vA.snapshot || []).map((x: any) => x.feature))
    const namesB = new Set((vB.snapshot || []).map((x: any) => x.feature))
    return { added: (vB.snapshot || []).filter((x: any) => !namesA.has(x.feature)), removed: (vA.snapshot || []).filter((x: any) => !namesB.has(x.feature)), kept: (vA.snapshot || []).filter((x: any) => namesB.has(x.feature)) }
  }
  const ic = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
  const lc = "block text-xs font-bold text-slate-500 uppercase mb-1"
  const vA = versions.find(v => v.id === compareA)
  const vB = versions.find(v => v.id === compareB)
  const diff = vA && vB ? getDiff(vA, vB) : null

  return (
    <div>
      {msg && <div className="fixed top-4 right-4 bg-[#081224] text-white px-5 py-3 rounded-full text-sm font-bold shadow-lg z-50">{msg}</div>}
      {viewVersion && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div><div className="font-black text-base">Versión del {formatDate(viewVersion.created_at)}</div><div className="text-xs text-slate-400">{viewVersion.filename} · {viewVersion.snapshot?.length || 0} características</div></div>
              <button onClick={() => setViewVersion(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="overflow-y-auto p-6">
              {categories.map((cat: any) => { const items = (viewVersion.snapshot || []).filter((x: any) => x.category === cat.name); if (!items.length) return null; return (<div key={cat.id} className="mb-4"><div className="text-xs font-black text-slate-400 uppercase tracking-wider py-1 border-b border-slate-100 mb-2">{cat.name}</div>{items.map((x: any, i: number) => <div key={i} className="text-sm text-slate-700 py-1 border-b border-slate-50">{x.feature}</div>)}</div>) })}
            </div>
          </div>
        </div>
      )}
      {showCompare && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><div className="font-black text-base">Comparar versiones</div><button onClick={() => setShowCompare(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button></div>
            <div className="p-6 border-b border-slate-100"><div className="grid grid-cols-2 gap-4"><div><label className={lc}>Versión A (base)</label><select className={ic} value={compareA} onChange={e => setCompareA(e.target.value)}><option value="">Selecciona...</option>{versions.map(v => <option key={v.id} value={v.id}>{formatDate(v.created_at)} — {v.filename}</option>)}</select></div><div><label className={lc}>Versión B (nueva)</label><select className={ic} value={compareB} onChange={e => setCompareB(e.target.value)}><option value="">Selecciona...</option>{versions.filter(v => v.id !== compareA).map(v => <option key={v.id} value={v.id}>{formatDate(v.created_at)} — {v.filename}</option>)}</select></div></div></div>
            {diff && (<div className="overflow-y-auto p-6 space-y-4">{diff.added.length > 0 && <div><div className="text-xs font-black text-emerald-600 uppercase tracking-wider mb-2">✓ Añadidas en B ({diff.added.length})</div>{diff.added.map((x: any, i: number) => <div key={i} className="text-sm text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg mb-1">{x.category} → {x.feature}</div>)}</div>}{diff.removed.length > 0 && <div><div className="text-xs font-black text-red-500 uppercase tracking-wider mb-2">✗ Eliminadas en B ({diff.removed.length})</div>{diff.removed.map((x: any, i: number) => <div key={i} className="text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-lg mb-1">{x.category} → {x.feature}</div>)}</div>}{diff.added.length === 0 && diff.removed.length === 0 && <div className="text-center text-slate-400 py-6">Las dos versiones son idénticas</div>}<div className="text-xs text-slate-400">{diff.kept.length} características sin cambios</div></div>)}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="text-2xl font-black tracking-tight mb-1">{t.categoriasTitle}</h1><p className="text-slate-500 text-sm">{t.categoriasSubtitle}</p></div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportExcel} className="px-4 py-2 border border-slate-300 bg-white text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50">⬇ Exportar Excel</button>
          <button onClick={() => setShowCompare(true)} className="px-4 py-2 border border-slate-300 bg-white text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50">🔀 Comparar versiones</button>
          <label className={`px-4 py-2 bg-[#081224] text-white text-sm font-bold rounded-lg hover:bg-[#162040] cursor-pointer ${importing ? 'opacity-50' : ''}`}>
            ⬆ {importing ? 'Importando...' : 'Importar Excel'}
            <input type="file" accept=".xlsx,.xls" onChange={importExcel} className="hidden" disabled={importing} />
          </label>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-100 px-4 py-3 mb-4 flex items-center gap-3">
        <span className="text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Nota (opcional)</span>
        <input className="flex-1 text-sm outline-none text-slate-600" placeholder="Ej: Añadidas características de conectividad v2..." value={uploadNote} onChange={e => setUploadNote(e.target.value)} />
      </div>
      <div className="flex gap-2 mb-6">
        {[['cats', t.categoriasTitle], ['feats', t.caracteristicas], ['history', '📋 Historial']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-5 py-2 text-sm font-bold rounded-lg border transition ${tab === id ? 'bg-[#081224] text-white border-[#081224]' : 'bg-white text-slate-600 border-slate-200'}`}>{label}</button>
        ))}
      </div>
      {tab === 'cats' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-black text-base mb-4">{editCatId ? t.editarCategoria : t.añadirCategoria}</h2>
            <div className="mb-3"><label className={lc}>{t.nombre}</label><input className={ic} value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} /></div>
            <div className="mb-4"><label className={lc}>{t.orden}</label><input type="number" className={ic} value={catForm.sort_order} onChange={e => setCatForm({ ...catForm, sort_order: parseInt(e.target.value) })} /></div>
            <div className="flex gap-2">{editCatId && <button onClick={() => { setEditCatId(null); setCatForm({ name: '', sort_order: 0 }) }} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-500">{t.cancelar}</button>}<button onClick={saveCat} className="px-6 py-2 bg-[#081224] text-white text-sm font-bold rounded-lg">{editCatId ? t.actualizar : t.añadir}</button></div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-black text-base mb-4">{t.categoriasTitle} ({categories.length})</h2>
            <div className="space-y-2">
              {[...categories].sort((a, b) => a.sort_order - b.sort_order).map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50">
                  <div><div className="font-bold text-sm">{c.name}</div><div className="text-xs text-slate-400">{c.name_es && <span className="mr-2">ES: {c.name_es}</span>}{t.orden}: {c.sort_order}</div></div>
                  <div className="flex gap-2"><button onClick={() => { setEditCatId(c.id); setCatForm(c) }} className="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-100">✏</button><button onClick={() => deleteCat(c.id)} className="px-3 py-1 text-xs border border-red-100 text-red-500 rounded-lg hover:bg-red-50">🗑</button></div>
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
            <div className="mb-3"><label className={lc}>{t.categoria}</label><select className={ic} value={featForm.category_id} onChange={e => setFeatForm({ ...featForm, category_id: e.target.value })}><option value="">{t.selecciona}</option>{[...categories].sort((a, b) => a.sort_order - b.sort_order).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="mb-3"><label className={lc}>{t.tipo}</label><select className={ic} value={featForm.type} onChange={e => setFeatForm({ ...featForm, type: e.target.value })}><option value="boolean">{t.siNo}</option><option value="text">{t.texto}</option><option value="numeric">{t.numerico}</option></select></div>
            <div className="mb-4"><label className={lc}>{t.orden}</label><input type="number" className={ic} value={featForm.sort_order} onChange={e => setFeatForm({ ...featForm, sort_order: parseInt(e.target.value) })} /></div>
            <div className="flex gap-2">{editFeatId && <button onClick={() => { setEditFeatId(null); setFeatForm({ name: '', category_id: '', type: 'boolean', sort_order: 0 }) }} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-500">{t.cancelar}</button>}<button onClick={saveFeat} className="px-6 py-2 bg-[#081224] text-white text-sm font-bold rounded-lg">{editFeatId ? t.actualizar : t.añadir}</button></div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm overflow-y-auto max-h-[600px]">
            <h2 className="font-black text-base mb-4">{t.caracteristicas} ({features.length})</h2>
            {[...categories].sort((a, b) => a.sort_order - b.sort_order).map(cat => {
              const catFeats = [...features.filter(f => f.category_id === cat.id)].sort((a, b) => a.sort_order - b.sort_order)
              if (!catFeats.length) return null
              return (<div key={cat.id} className="mb-3"><div className="text-xs font-black text-slate-400 uppercase tracking-wider py-2 border-b border-slate-100">{cat.name}</div>{catFeats.map(f => (<div key={f.id} className="flex items-center justify-between py-2 px-1 hover:bg-slate-50 rounded-lg"><div><div className="text-sm font-medium">{f.name}</div><div className="text-xs text-slate-400">{f.type}</div></div><div className="flex gap-2"><button onClick={() => { setEditFeatId(f.id); setFeatForm(f) }} className="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-100">✏</button><button onClick={() => deleteFeat(f.id)} className="px-3 py-1 text-xs border border-red-100 text-red-500 rounded-lg hover:bg-red-50">🗑</button></div></div>))}</div>)
            })}
          </div>
        </div>
      )}
      {tab === 'history' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between"><span className="text-xs font-black text-slate-500 uppercase tracking-wider">Historial de versiones</span><span className="text-xs text-slate-400">{versions.length} versiones</span></div>
          {versions.length === 0 && <div className="text-center py-12 text-slate-400"><div className="text-4xl mb-3">📋</div><div className="font-bold">Sin versiones todavía</div></div>}
          <div className="divide-y divide-slate-50">
            {versions.map((v, idx) => (
              <div key={v.id} className="px-5 py-4 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${idx === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{idx === 0 ? '✓' : versions.length - idx}</div>
                    <div>
                      <div className="font-bold text-sm flex items-center gap-2">{formatDate(v.created_at)}{idx === 0 && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black">ACTUAL</span>}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{v.filename}</div>
                      {v.notes && <div className="text-xs text-slate-600 mt-1 bg-slate-50 px-2 py-1 rounded-lg">{v.notes}</div>}
                      <div className="flex gap-3 mt-1"><span className="text-xs text-emerald-600">+{v.changes_added} añadidas</span><span className="text-xs text-slate-400">{v.snapshot?.length || 0} total</span></div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setViewVersion(v)} className="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-100">👁 Ver</button>
                    {idx !== 0 && <button onClick={() => restoreVersion(v)} disabled={restoring} className="px-3 py-1 text-xs border border-amber-200 text-amber-600 rounded-lg hover:bg-amber-50 disabled:opacity-50">↩ Restaurar</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Analisis({ models, categories, features, values, t, lang }: any) {
  const [segment, setSegment] = useState('')
  const [model1Id, setModel1Id] = useState('')
  const [model2Id, setModel2Id] = useState('')
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState('')
  const [error, setError] = useState('')

  const segmentFeat = features.find((f: any) => f.name === 'Segment')
  const segments: string[] = segmentFeat ? Array.from(new Set<string>(values.filter((v: any) => v.feature_id === segmentFeat.id && v.value).map((v: any) => String(v.value)))).sort() : []
  const modelsInSegment = segment && segmentFeat ? models.filter((m: any) => values.find((v: any) => v.feature_id === segmentFeat.id && v.model_id === m.id && v.value === segment)) : models
  const model1 = modelsInSegment.find((m: any) => m.id === model1Id)
  const model2 = modelsInSegment.find((m: any) => m.id === model2Id)
  useEffect(() => { setModel1Id(''); setModel2Id(''); setAnalysis(''); setError('') }, [segment])

  async function generate() {
    if (!model1 || !model2) return
    setLoading(true); setAnalysis(''); setError('')
    try {
      const res = await fetch('/api/analisis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model1, model2, features, values, categories, lang }) })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAnalysis(data.analysis)
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  function renderMarkdown(text: string) {
    return text
      .replace(/^## (.+)$/gm, '<h2 class="text-lg font-black text-slate-800 mt-6 mb-2 pb-1 border-b border-slate-200">$1</h2>')
      .replace(/^### (.+)$/gm, '<h3 class="text-sm font-black text-blue-600 uppercase tracking-wider mt-4 mb-1">$1</h3>')
      .replace(/^- (.+)$/gm, '<li class="text-sm text-slate-700 ml-4 mb-1">• $1</li>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^(?!<[h|l])(.+)$/gm, '<p class="text-sm text-slate-700 mb-2">$1</p>')
  }

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight mb-1">{t.analisis}</h1>
      <p className="text-slate-500 text-sm mb-6">Selecciona un segmento y dos vehículos para generar un análisis comparativo con IA</p>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6 shadow-sm">
        <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Segmento</label>
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => setSegment('')} className={`px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition ${!segment ? 'bg-[#081224] text-white border-[#081224]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>Todos</button>
          {segments.map(seg => <button key={seg} onClick={() => setSegment(seg)} className={`px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition ${segment === seg ? 'bg-[#081224] text-white border-[#081224]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>{seg}</button>)}
        </div>
        {segment && <p className="text-xs text-slate-400 mt-2">{modelsInSegment.length} vehículos en el segmento {segment}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[{ label: 'Vehículo 1', value: model1Id, set: setModel1Id, other: model2Id }, { label: 'Vehículo 2', value: model2Id, set: setModel2Id, other: model1Id }].map(({ label, value, set, other }) => (
          <div key={label}><label className="block text-xs font-bold text-slate-500 uppercase mb-2">{label}</label><select value={value} onChange={e => set(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 bg-white"><option value="">Selecciona un vehículo...</option>{modelsInSegment.filter((m: any) => m.id !== other).map((m: any) => <option key={m.id} value={m.id}>{m.brand} {m.name} {m.version}</option>)}</select></div>
        ))}
      </div>
      {model1 && model2 && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[model1, model2].map((m: any) => (
            <div key={m.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4 shadow-sm">
              <div className="w-20 h-14 bg-slate-50 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">{m.img_url ? <img src={m.img_url} className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-slate-400">Sin img</span>}</div>
              <div><div className="text-xs font-bold text-blue-600 uppercase">{m.brand}</div><div className="font-black text-base">{m.name} {m.version}</div><div className="text-xs text-slate-400">{m.price}</div></div>
            </div>
          ))}
        </div>
      )}
      <button onClick={generate} disabled={!model1 || !model2 || loading} className="w-full bg-[#081224] text-white font-bold py-4 rounded-2xl hover:bg-[#162040] disabled:opacity-40 text-sm mb-6 flex items-center justify-center gap-2">
        {loading ? (<><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>Generando análisis...</>) : '✦ Generar análisis con IA'}
      </button>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>}
      {analysis && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Análisis generado por IA</span></div>
            <button onClick={() => navigator.clipboard.writeText(analysis)} className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg px-3 py-1">📋 Copiar</button>
          </div>
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(analysis) }} />
        </div>
      )}
    </div>
  )
}

function ValorCliente({ models, categories, features, values, lang }: any) {
  const [segment, setSegment] = useState('')
  const [model1Id, setModel1Id] = useState('')
  const [model2Id, setModel2Id] = useState('')
  const [valorItems, setValorItems] = useState<Record<string, number>>({})
  // signoItems: 1 = positivo (LIUX mejor), -1 = negativo (competidor mejor), 0 = auto
  const [signoItems, setSignoItems] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [analysis, setAnalysis] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const segmentFeat = features.find((f: any) => f.name === 'Segment')
  const segments: string[] = segmentFeat ? Array.from(new Set<string>(values.filter((v: any) => v.feature_id === segmentFeat.id && v.value).map((v: any) => String(v.value)))).sort() : []
  const modelsInSegment = segment && segmentFeat ? models.filter((m: any) => values.find((v: any) => v.feature_id === segmentFeat.id && v.model_id === m.id && v.value === segment)) : models
  const model1 = modelsInSegment.find((m: any) => m.id === model1Id)
  const model2 = modelsInSegment.find((m: any) => m.id === model2Id)

  useEffect(() => { setModel1Id(''); setModel2Id(''); setAnalysis(''); setError('') }, [segment])

  useEffect(() => {
    async function loadValorItems() {
      const { data } = await supabase.from('valor_cliente_items').select('*')
      if (data) {
        const map: Record<string, number> = {}
        data.forEach((d: any) => { map[d.feature_id] = d.valor_default })
        setValorItems(map)
      }
    }
    loadValorItems()
  }, [])

  function toast(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  function getVal(featId: string, modelId: string) {
    const v = values.find((v: any) => v.feature_id === featId && v.model_id === modelId)
    return v ? v.value : '—'
  }

  // Detecta si el sistema puede calcular el signo automáticamente
  function canAutoSign(feat: any): boolean {
    if (!model1 || !model2) return false
    const v1 = getVal(feat.id, model1.id).toLowerCase().trim()
    const v2 = getVal(feat.id, model2.id).toLowerCase().trim()
    const isBoolean = (v: string) => v === 'yes' || v === 'no' || v === 'sí' || v === 'si'
    if (isBoolean(v1) || isBoolean(v2)) return true
    const n1 = parseFloat(v1)
    const n2 = parseFloat(v2)
    if (!isNaN(n1) && !isNaN(n2)) return true
    return false
  }

  function calcAjuste(feat: any): number {
    if (!model1 || !model2) return 0
    const v1 = getVal(feat.id, model1.id).toLowerCase().trim()
    const v2 = getVal(feat.id, model2.id).toLowerCase().trim()
    const valor = valorItems[feat.id] || 0
    if (valor === 0) return 0

    // Si el usuario ha especificado el signo manualmente
    const signoManual = signoItems[feat.id]
    if (signoManual !== undefined && signoManual !== 0) {
      return signoManual * valor
    }

    // Auto para booleanos
    const v1Yes = v1 === 'yes' || v1 === 'sí' || v1 === 'si'
    const v2Yes = v2 === 'yes' || v2 === 'sí' || v2 === 'si'
    if (v1Yes && !v2Yes) return +valor
    if (!v1Yes && v2Yes) return -valor

    // Auto para numéricos
    const n1 = parseFloat(getVal(feat.id, model1.id))
    const n2 = parseFloat(getVal(feat.id, model2.id))
    if (!isNaN(n1) && !isNaN(n2)) {
      if (n1 > n2) return +valor
      if (n1 < n2) return -valor
    }

    return 0
  }

  const diffRows = model1 && model2 ? categories.flatMap((cat: any) => {
    const feats = features.filter((f: any) => f.category_id === cat.id)
    const diffs = feats.filter((f: any) => {
      const v1 = getVal(f.id, model1.id)
      const v2 = getVal(f.id, model2.id)
      if (v1 === v2) return false
      if (v1 === '—' && v2 === '—') return false
      return true
    })
    return diffs.map((f: any, fi: number) => ({ ...f, catName: getName(cat, lang), isFirst: fi === 0 }))
  }) : []

  const precioBase = parseFloat(model1?.price?.replace(/[^0-9.]/g, '') || '0')
  const ajusteTotal = diffRows.reduce((sum: number, feat: any) => sum + calcAjuste(feat), 0)
  const precioEstimado = precioBase - ajusteTotal

  async function saveValorItems() {
    setSaving(true)
    const upserts = Object.entries(valorItems).map(([feature_id, valor_default]) => ({ feature_id, valor_default }))
    for (const u of upserts) {
      await supabase.from('valor_cliente_items').upsert(u, { onConflict: 'feature_id' })
    }
    toast('Valores guardados ✓')
    setSaving(false)
  }

  async function generateAnalysis() {
    if (!model1 || !model2) return
    setLoading(true); setAnalysis(''); setError('')
    try {
      const ajustes = diffRows.map((feat: any) => ({
        caracteristica: feat.name,
        valor_m1: getVal(feat.id, model1.id),
        valor_m2: getVal(feat.id, model2.id),
        ajuste: calcAjuste(feat)
      })).filter((a: any) => a.ajuste !== 0)

      const res = await fetch('/api/valor-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model1, model2, ajustes, precioBase, ajusteTotal, precioEstimado, lang })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAnalysis(data.analysis)
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  function renderMarkdown(text: string) {
    return text
      .replace(/^## (.+)$/gm, '<h2 class="text-lg font-black text-slate-800 mt-6 mb-2 pb-1 border-b border-slate-200">$1</h2>')
      .replace(/^### (.+)$/gm, '<h3 class="text-sm font-black text-blue-600 uppercase tracking-wider mt-4 mb-1">$1</h3>')
      .replace(/^- (.+)$/gm, '<li class="text-sm text-slate-700 ml-4 mb-1">• $1</li>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^(?!<[h|l])(.+)$/gm, '<p class="text-sm text-slate-700 mb-2">$1</p>')
  }

  return (
    <div>
      {msg && <div className="fixed top-4 right-4 bg-[#081224] text-white px-5 py-3 rounded-full text-sm font-bold shadow-lg z-50">{msg}</div>}
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Valor Cliente</h1>
          <p className="text-slate-500 text-sm">Estima el precio justo de mercado del competidor en base al valor del equipamiento</p>
        </div>
        {model1 && model2 && (
          <button onClick={saveValorItems} disabled={saving}
            className="px-4 py-2 bg-[#081224] text-white text-sm font-bold rounded-lg hover:bg-[#162040] disabled:opacity-50">
            {saving ? 'Guardando...' : '💾 Guardar valores'}
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6 shadow-sm mt-6">
        <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Segmento</label>
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => setSegment('')} className={`px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition ${!segment ? 'bg-[#081224] text-white border-[#081224]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>Todos</button>
          {segments.map(seg => <button key={seg} onClick={() => setSegment(seg)} className={`px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition ${segment === seg ? 'bg-[#081224] text-white border-[#081224]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>{seg}</button>)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[
          { label: 'Vehículo propio (LIUX)', value: model1Id, set: setModel1Id, other: model2Id, color: 'border-blue-200 bg-blue-50' },
          { label: 'Vehículo competidor', value: model2Id, set: setModel2Id, other: model1Id, color: 'border-amber-200 bg-amber-50' }
        ].map(({ label, value, set, other, color }) => (
          <div key={label}>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{label}</label>
            <select value={value} onChange={e => set(e.target.value)} className={`w-full border-2 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 ${color}`}>
              <option value="">Selecciona un vehículo...</option>
              {modelsInSegment.filter((m: any) => m.id !== other).map((m: any) => <option key={m.id} value={m.id}>{m.brand} {m.name} {m.version}</option>)}
            </select>
          </div>
        ))}
      </div>

      {model1 && model2 && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[
            { model: model1, label: 'LIUX', color: 'border-blue-200' },
            { model: model2, label: 'Competidor', color: 'border-amber-200' }
          ].map(({ model, label, color }) => (
            <div key={model.id} className={`bg-white rounded-2xl border-2 ${color} p-4 flex items-center gap-4 shadow-sm`}>
              <div className="w-20 h-14 bg-slate-50 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                {model.img_url ? <img src={model.img_url} className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-slate-400">Sin img</span>}
              </div>
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase">{label}</div>
                <div className="text-xs font-bold text-blue-600 uppercase">{model.brand}</div>
                <div className="font-black text-base">{model.name} {model.version}</div>
                <div className="text-xs text-slate-500 font-bold">{model.price ? `${model.price}€` : 'Precio no definido'}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {model1 && model2 && (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-x-auto mb-4">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Diferencias de equipamiento</span>
              <span className="text-xs text-slate-400">{diffRows.length} puntos diferenciales</span>
            </div>
            <table className="w-full border-collapse text-xs">
              <colgroup>
                <col style={{ width: '80px' }} />
                <col style={{ width: '180px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '140px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="bg-[#081224] text-white text-left px-3 py-2 font-black uppercase text-[8px]">Cat.</th>
                  <th className="bg-[#081224] text-white text-left px-3 py-2 font-black uppercase text-[8px]">Característica</th>
                  <th className="bg-blue-900 text-blue-200 text-center px-2 py-2 font-black text-[8px]">{model1.brand} {model1.version}</th>
                  <th className="bg-amber-900 text-amber-200 text-center px-2 py-2 font-black text-[8px]">{model2.brand} {model2.version}</th>
                  <th className="bg-[#081224] text-white text-center px-2 py-2 font-black uppercase text-[8px]">Valor (€)</th>
                </tr>
              </thead>
              <tbody>
                {diffRows.map((feat: any) => {
                  const v1 = getVal(feat.id, model1.id)
                  const v2 = getVal(feat.id, model2.id)
                  const ajuste = calcAjuste(feat)
                  const autoSign = canAutoSign(feat)
                  const signoManual = signoItems[feat.id]
                  const display = (v: string) => { const lo = v.toLowerCase().trim(); if (lo === 'yes') return '✓'; if (lo === 'no') return '✗'; return v }
                  const cls = (v: string) => { const lo = v.toLowerCase().trim(); if (lo === 'yes') return 'text-emerald-700 bg-emerald-50 font-black'; if (lo === 'no') return 'text-red-600 bg-red-50 font-black'; if (lo === 'n/a') return 'text-slate-400'; return '' }
                  return (
                    <tr key={feat.id} className={feat.isFirst ? 'border-t-2 border-slate-200' : ''}>
                      <td className="border border-slate-100 px-2 py-2 text-[9px] font-bold text-slate-500 bg-slate-50">{feat.isFirst ? feat.catName : ''}</td>
                      <td className="border border-slate-100 px-2 py-2 text-[9px] text-slate-700">{getName(feat, lang)}</td>
                      <td className={`border border-slate-100 px-2 py-2 text-center text-[9px] ${cls(v1)}`}>{display(v1)}</td>
                      <td className={`border border-slate-100 px-2 py-2 text-center text-[9px] ${cls(v2)}`}>{display(v2)}</td>
                      <td className="border border-slate-100 px-2 py-1.5">
                        <div className="flex items-center justify-center gap-1">
                          {/* Selector de signo — solo aparece cuando no se puede calcular automáticamente */}
                          {!autoSign && (
                            <div className="flex rounded-lg overflow-hidden border border-slate-200 text-[9px] font-black">
                              <button
                                onClick={() => setSignoItems(prev => ({ ...prev, [feat.id]: signoManual === 1 ? 0 : 1 }))}
                                className={`px-1.5 py-1 transition ${signoManual === 1 ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 hover:bg-emerald-50'}`}
                                title="LIUX es mejor en esta característica">+</button>
                              <button
                                onClick={() => setSignoItems(prev => ({ ...prev, [feat.id]: signoManual === -1 ? 0 : -1 }))}
                                className={`px-1.5 py-1 transition border-l border-slate-200 ${signoManual === -1 ? 'bg-red-500 text-white' : 'bg-white text-slate-400 hover:bg-red-50'}`}
                                title="Competidor es mejor en esta característica">−</button>
                            </div>
                          )}
                          <input
                            type="number"
                            value={valorItems[feat.id] ?? 0}
                            onChange={e => setValorItems(prev => ({ ...prev, [feat.id]: parseFloat(e.target.value) || 0 }))}
                            className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center outline-none focus:border-blue-400"
                          />
                          {ajuste !== 0 && (
                            <span className={`text-[9px] font-black whitespace-nowrap ${ajuste > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {ajuste > 0 ? '+' : ''}{ajuste}€
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
            <h3 className="font-black text-base mb-4 text-slate-700 uppercase tracking-wider">Resumen Valor Cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <div className="text-xs font-black text-blue-600 uppercase mb-1">Precio base {model1.brand} {model1.version}</div>
                <div className="text-2xl font-black text-blue-900">{precioBase ? `${precioBase.toLocaleString('es-ES')}€` : 'No definido'}</div>
              </div>
              <div className={`border rounded-xl p-4 text-center ${ajusteTotal >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <div className={`text-xs font-black uppercase mb-1 ${ajusteTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Ajuste neto</div>
                <div className={`text-2xl font-black ${ajusteTotal >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>
                  {ajusteTotal >= 0 ? '+' : ''}{ajusteTotal.toLocaleString('es-ES')}€
                </div>
                <div className="text-[10px] text-slate-500 mt-1">{ajusteTotal >= 0 ? 'LIUX aporta más valor' : 'Competidor aporta más valor'}</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <div className="text-xs font-black text-amber-600 uppercase mb-1">Precio justo estimado {model2.brand} {model2.version}</div>
                <div className="text-2xl font-black text-amber-900">{precioEstimado ? `${precioEstimado.toLocaleString('es-ES')}€` : '—'}</div>
              </div>
            </div>
            {precioBase > 0 && (
              <div className={`rounded-xl px-4 py-3 text-sm font-medium ${ajusteTotal >= 0 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                {ajusteTotal >= 0
                  ? `✓ El ${model1.brand} ${model1.version} a ${precioBase.toLocaleString('es-ES')}€ ofrece ${ajusteTotal.toLocaleString('es-ES')}€ más de valor que el ${model2.brand} ${model2.version}. Para ser equivalente, el competidor debería costar ${precioEstimado.toLocaleString('es-ES')}€.`
                  : `⚠ El ${model2.brand} ${model2.version} aporta ${Math.abs(ajusteTotal).toLocaleString('es-ES')}€ más de valor que el ${model1.brand} ${model1.version}. Para ser equivalente, el competidor debería costar ${precioEstimado.toLocaleString('es-ES')}€.`
                }
              </div>
            )}
          </div>

          <button onClick={generateAnalysis} disabled={loading || diffRows.length === 0}
            className="w-full bg-[#081224] text-white font-bold py-4 rounded-2xl hover:bg-[#162040] disabled:opacity-40 text-sm mb-6 flex items-center justify-center gap-2">
            {loading ? (<><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>Generando análisis...</>) : '✦ Generar argumento comercial con IA'}
          </button>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>}

          {analysis && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Argumento comercial generado por IA</span></div>
                <button onClick={() => navigator.clipboard.writeText(analysis)} className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg px-3 py-1">📋 Copiar</button>
              </div>
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(analysis) }} />
            </div>
          )}
        </>
      )}

      {(!model1 || !model2) && (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-4">⚖️</div>
          <div className="font-bold text-base mb-1">Selecciona dos vehículos para comenzar</div>
          <div className="text-sm">El módulo calculará el precio justo de mercado del competidor</div>
        </div>
      )}
    </div>
  )
}

function Configuracion({ features }: { features: any[] }) {
  const [fields, setFields] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newField, setNewField] = useState({ feature_name: '', label: '' })
  const dragIdx = useRef<number | null>(null)

  useEffect(() => { loadFields() }, [])
  async function loadFields() {
    const { data } = await supabase.from('settings').select('*').eq('id', 'card_fields').single()
    if (data) setFields(data.value)
  }
  function toast(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000) }
  async function save(updated: any[]) {
    await supabase.from('settings').upsert({ id: 'card_fields', value: updated })
    setFields(updated); toast('Guardado ✓')
  }
  function toggleField(idx: number) { save(fields.map((f, i) => i === idx ? { ...f, enabled: !f.enabled } : f)) }
  function updateLabel(idx: number, label: string) { setFields(fields.map((f, i) => i === idx ? { ...f, label } : f)) }
  function saveLabel() { save(fields) }
  function removeField(idx: number) { save(fields.filter((_, i) => i !== idx)) }
  function addField() {
    if (!newField.feature_name || !newField.label) return
    save([...fields, { ...newField, enabled: true, order: fields.length + 1 }])
    setNewField({ feature_name: '', label: '' }); setShowAdd(false)
  }
  function onDragStart(idx: number) { dragIdx.current = idx }
  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === idx) return
    const updated = [...fields]
    const [moved] = updated.splice(dragIdx.current, 1)
    updated.splice(idx, 0, moved)
    dragIdx.current = idx
    setFields(updated.map((f, i) => ({ ...f, order: i + 1 })))
  }
  function onDragEnd() { save(fields); dragIdx.current = null }
  const ic = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
  return (
    <div>
      {msg && <div className="fixed top-4 right-4 bg-[#081224] text-white px-5 py-3 rounded-full text-sm font-bold shadow-lg z-50">{msg}</div>}
      <h1 className="text-2xl font-black tracking-tight mb-1">Configuración</h1>
      <p className="text-slate-500 text-sm mb-6">Personaliza los campos que se muestran en las tarjetas del comparador</p>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Campos de las tarjetas</span>
          <span className="text-xs text-slate-400">Arrastra para reordenar</span>
        </div>
        <div className="divide-y divide-slate-50">
          {fields.map((field, idx) => (
            <div key={idx} draggable onDragStart={() => onDragStart(idx)} onDragOver={e => onDragOver(e, idx)} onDragEnd={onDragEnd}
              className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-grab active:cursor-grabbing">
              <div className="text-slate-300 text-lg select-none">⠿</div>
              <div className="w-5 text-xs font-bold text-slate-300">{idx + 1}</div>
              <input className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400" value={field.label} onChange={e => updateLabel(idx, e.target.value)} onBlur={saveLabel} />
              <div className="text-xs text-slate-400 truncate max-w-[200px] hidden md:block">{field.feature_name}</div>
              <button onClick={() => toggleField(idx)} className={`px-3 py-1 text-xs font-bold rounded-full transition ${field.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{field.enabled ? 'Visible' : 'Oculto'}</button>
              <button onClick={() => removeField(idx)} className="text-slate-300 hover:text-red-400 transition text-sm">🗑</button>
            </div>
          ))}
        </div>
      </div>
      {showAdd ? (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4">
          <h3 className="font-black text-sm mb-4 text-slate-700 uppercase tracking-wider">Añadir campo</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Característica</label><select className={ic} value={newField.feature_name} onChange={e => setNewField({ ...newField, feature_name: e.target.value })}><option value="">Selecciona...</option>{features.filter(f => !fields.find(cf => cf.feature_name === f.name)).map(f => <option key={f.id} value={f.name}>{f.name}</option>)}</select></div>
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Etiqueta corta</label><input className={ic} value={newField.label} onChange={e => setNewField({ ...newField, label: e.target.value })} placeholder="ej. Autonomía" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-500">Cancelar</button>
            <button onClick={addField} disabled={!newField.feature_name || !newField.label} className="px-6 py-2 bg-[#081224] text-white text-sm font-bold rounded-lg disabled:opacity-40">Añadir</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="w-full border-2 border-dashed border-slate-200 rounded-2xl py-4 text-sm font-bold text-slate-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition">+ Añadir campo</button>
      )}
    </div>
  )
}

export default function ComparadorClient({ models, categories, features, values }: any) {
  const [active, setActive] = useState('comparador')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [lang, setLang] = useState<Lang>('es')
  const [cardFields, setCardFields] = useState<any[]>([
    { feature_name: 'Driving Mileage under WMTC mode (km)', label: 'Autonomía WMTC', enabled: true, order: 1 },
    { feature_name: 'Maximum speed (km/h)', label: 'Vel. máxima', enabled: true, order: 2 },
    { feature_name: 'Battery capacity (kWh)', label: 'Batería', enabled: true, order: 3 },
    { feature_name: 'Motor peak power (kW)', label: 'Potencia pico', enabled: true, order: 4 },
    { feature_name: 'Motor torque (Nm)', label: 'Torque', enabled: true, order: 5 },
    { feature_name: 'AC charging time 0-100% (h)', label: 'Carga 0-100%', enabled: true, order: 6 },
  ])

  useEffect(() => {
    supabase.from('settings').select('*').eq('id', 'card_fields').single().then(({ data }) => { if (data) setCardFields(data.value) })
  }, [])
  useEffect(() => {
    if (active === 'comparador') supabase.from('settings').select('*').eq('id', 'card_fields').single().then(({ data }) => { if (data) setCardFields(data.value) })
  }, [active])

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
          {active === 'comparador' && <Comparador models={models} categories={categories} features={features} values={values} t={t} lang={lang} cardFields={cardFields} />}
          {active === 'modelos' && <Modelos t={t} />}
          {active === 'categorias' && <Categorias t={t} />}
          {active === 'analisis' && <Analisis models={models} categories={categories} features={features} values={values} t={t} lang={lang} />}
          {active === 'valor' && <ValorCliente models={models} categories={categories} features={features} values={values} lang={lang} />}
          {active === 'config' && <Configuracion features={features} />}
        </main>
      </div>
    </div>
  )
}