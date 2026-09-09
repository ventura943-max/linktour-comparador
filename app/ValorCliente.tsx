'use client'
import { useState, useEffect, useMemo, Fragment } from 'react'
import { supabase } from '@/lib/supabase'
import { Lang } from '@/lib/i18n'
import {
  parsePrice, fmtEur, fmtPct,
  exportarValorClienteExcel, exportarValorClientePDF, VCExportData,
} from '@/lib/exportValorCliente'

// ============ CONSTANTES ============
const AUTONOMIA_FEATURE_NAME = 'Driving Mileage under WMTC mode (km)'
const SEGMENT_FEATURE_NAME = 'Segment'

function getName(item: any, lang: Lang) {
  if (lang === 'es' && item.name_es) return item.name_es
  if (lang === 'it' && item.name_it) return item.name_it
  return item.name
}

// ============ TIPOS ============
// Un "ejercicio" es una comparativa guardada: referencia + competidores + filas
// visibles + precios + ajustes. Todo se guarda en una fila de valor_cliente_ejercicios.
type Ejercicio = {
  id?: string
  nombre: string
  tipo: string
  reference_model_id: string
  competitor_ids: string[]
  feature_ids: string[] | null                 // null = todas las características
  precio_km: number
  precios: Record<string, number>              // MSRP editado por model_id
  ajustes: Record<string, Record<string, number>> // competitor_id -> feature_id -> €
  notas: string
}

const EJERCICIO_VACIO: Ejercicio = {
  nombre: '', tipo: '', reference_model_id: '', competitor_ids: [], feature_ids: null,
  precio_km: 16, precios: {}, ajustes: {}, notas: '',
}

// ============ INPUT NUMÉRICO ============
// No controlado + key por valor: permite escribir "-", "1.5", etc. sin que React
// reinicie el campo a mitad de escritura. Se confirma al salir del campo o con Enter.
function NumInput({ value, onCommit, className, step = 50, placeholder = '0' }:
  { value: number; onCommit: (n: number) => void; className?: string; step?: number; placeholder?: string }) {
  return (
    <input
      key={value}
      type="number"
      step={step}
      defaultValue={value === 0 ? '' : value}
      placeholder={placeholder}
      onBlur={e => { const n = parseFloat(e.target.value); const nv = isNaN(n) ? 0 : n; if (nv !== value) onCommit(nv) }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      className={className}
    />
  )
}

// ============ COMPONENTE ============
export default function ValorCliente({ models, categories, features, values, lang }: any) {
  const [ejercicios, setEjercicios] = useState<any[]>([])
  const [ej, setEj] = useState<Ejercicio>(EJERCICIO_VACIO)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [segment, setSegment] = useState('')
  const [showRows, setShowRows] = useState(false)
  const [defaults, setDefaults] = useState<Record<string, number>>({})
  const [addCompOpen, setAddCompOpen] = useState(false)

  // ---------- Datos base ----------
  const segmentFeat = features.find((f: any) => f.name === SEGMENT_FEATURE_NAME)
  const autonomiaFeat = features.find((f: any) => f.name === AUTONOMIA_FEATURE_NAME)

  function getVal(featId: string, modelId: string): string {
    const v = values.find((v: any) => v.feature_id === featId && v.model_id === modelId)
    return v && v.value !== null && v.value !== undefined ? String(v.value) : ''
  }
  const segments: string[] = segmentFeat
    ? Array.from(new Set<string>(values.filter((v: any) => v.feature_id === segmentFeat.id && v.value).map((v: any) => String(v.value)))).sort()
    : []
  const modelsInSegment = segment && segmentFeat
    ? models.filter((m: any) => values.find((v: any) => v.feature_id === segmentFeat.id && v.model_id === m.id && v.value === segment))
    : models

  const refModel = models.find((m: any) => m.id === ej.reference_model_id)
  const compModels = ej.competitor_ids.map((id: string) => models.find((m: any) => m.id === id)).filter(Boolean)
  const disponibles = modelsInSegment.filter((m: any) => m.id !== ej.reference_model_id && !ej.competitor_ids.includes(m.id))

  // ---------- Carga inicial ----------
  useEffect(() => { loadEjercicios(true); loadDefaults() }, [])

  // Aviso al cerrar/recargar con cambios sin guardar
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  async function loadEjercicios(selectLatest = false) {
    const { data } = await supabase.from('valor_cliente_ejercicios').select('*').order('updated_at', { ascending: false })
    setEjercicios(data || [])
    // Por defecto se abre el último ejercicio guardado
    if (selectLatest && data && data.length > 0) cargar(data[0])
  }
  async function loadDefaults() {
    const { data } = await supabase.from('valor_cliente_items').select('*')
    const map: Record<string, number> = {}
    ;(data || []).forEach((d: any) => { if (d.valor_default) map[d.feature_id] = d.valor_default })
    setDefaults(map)
  }
  function cargar(row: any) {
    setEj({
      id: row.id, nombre: row.nombre || '', tipo: row.tipo || '',
      reference_model_id: row.reference_model_id || '', competitor_ids: row.competitor_ids || [],
      feature_ids: row.feature_ids ?? null, precio_km: row.precio_km ?? 16,
      precios: row.precios || {}, ajustes: row.ajustes || {}, notas: row.notas || '',
    })
    setDirty(false)
  }
  function toast(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }
  function upd(patch: Partial<Ejercicio>) { setEj(prev => ({ ...prev, ...patch })); setDirty(true) }

  // ---------- Cálculos ----------
  const msrpOf = (m: any): number => ej.precios[m.id] !== undefined ? ej.precios[m.id] : parsePrice(m.price)

  const isVisible = (f: any) => ej.feature_ids === null || ej.feature_ids.includes(f.id)

  // Filas visibles, agrupadas por categoría en orden
  const filas = useMemo(() => {
    return categories.flatMap((cat: any) =>
      features
        .filter((f: any) => f.category_id === cat.id && isVisible(f))
        .map((f: any, i: number) => ({ ...f, catName: getName(cat, lang), catId: cat.id, isFirst: i === 0 }))
    )
  }, [categories, features, ej.feature_ids, lang])

  function ajusteDe(compId: string, f: any): number {
    if (autonomiaFeat && f.id === autonomiaFeat.id && refModel) {
      const k1 = parseFloat(getVal(f.id, refModel.id)); const k2 = parseFloat(getVal(f.id, compId))
      if (isNaN(k1) || isNaN(k2)) return 0
      return Math.round((k1 - k2) * ej.precio_km)
    }
    return ej.ajustes[compId]?.[f.id] ?? 0
  }
  function setAjuste(compId: string, featId: string, valor: number) {
    const comp = { ...(ej.ajustes[compId] || {}) }
    if (valor === 0) delete comp[featId]; else comp[featId] = valor
    upd({ ajustes: { ...ej.ajustes, [compId]: comp } })
  }

  const resumen = useMemo(() => {
    if (!refModel) return []
    const msrpRef = msrpOf(refModel)
    return compModels.map((c: any) => {
      const msrp = msrpOf(c)
      const total = filas.reduce((s: number, f: any) => s + ajusteDe(c.id, f), 0)
      const precioAjustado = msrp + total
      return {
        model: c, msrp, total, precioAjustado,
        difMsrp: msrp - msrpRef, difMsrpPct: msrpRef ? (msrp - msrpRef) / msrpRef : 0,
        difAjustada: precioAjustado - msrpRef, difAjustadaPct: msrpRef ? (precioAjustado - msrpRef) / msrpRef : 0,
      }
    })
  }, [refModel, compModels, filas, ej.ajustes, ej.precios, ej.precio_km])

  // Sugerencia automática de ajustes a partir de los valores por defecto por característica
  const isBool = (v: string) => ['yes', 'no', 'sí', 'si'].includes(v.toLowerCase().trim())
  const isYes = (v: string) => ['yes', 'sí', 'si'].includes(v.toLowerCase().trim())
  const isNum = (v: string) => v.trim() !== '' && !isNaN(parseFloat(v.trim()))
  function sugerirAjustes(compId: string): Record<string, number> {
    const out: Record<string, number> = {}
    if (!refModel) return out
    features.forEach((f: any) => {
      if (autonomiaFeat && f.id === autonomiaFeat.id) return
      const mag = defaults[f.id] || 0; if (!mag) return
      const v1 = getVal(f.id, refModel.id), v2 = getVal(f.id, compId)
      let sign = 0
      if (isBool(v1) && isBool(v2)) sign = isYes(v1) && !isYes(v2) ? 1 : !isYes(v1) && isYes(v2) ? -1 : 0
      else if (isNum(v1) && isNum(v2)) { const a = parseFloat(v1), b = parseFloat(v2); sign = a > b ? 1 : a < b ? -1 : 0 }
      if (sign) out[f.id] = sign * mag
    })
    return out
  }

  // ---------- Acciones sobre competidores ----------
  function addCompetidor(id: string) {
    const ajustes = { ...ej.ajustes }
    if (!ajustes[id]) ajustes[id] = sugerirAjustes(id)
    upd({ competitor_ids: [...ej.competitor_ids, id], ajustes })
    setAddCompOpen(false)
  }
  function removeCompetidor(id: string) {
    upd({ competitor_ids: ej.competitor_ids.filter(x => x !== id) })
  }
  function moveCompetidor(idx: number, dir: -1 | 1) {
    const t = idx + dir; if (t < 0 || t >= ej.competitor_ids.length) return
    const arr = [...ej.competitor_ids]; [arr[idx], arr[t]] = [arr[t], arr[idx]]
    upd({ competitor_ids: arr })
  }
  function setReferencia(id: string) {
    upd({ reference_model_id: id, competitor_ids: ej.competitor_ids.filter(x => x !== id) })
  }

  // ---------- Filas visibles ----------
  function toggleFeature(fid: string) {
    const all = features.map((f: any) => f.id)
    const cur = ej.feature_ids === null ? all : ej.feature_ids
    const next = cur.includes(fid) ? cur.filter((x: string) => x !== fid) : [...cur, fid]
    upd({ feature_ids: next.length === all.length ? null : next })
  }
  function toggleCategoria(catId: string, on: boolean) {
    const all = features.map((f: any) => f.id)
    const cur = new Set<string>(ej.feature_ids === null ? all : ej.feature_ids)
    features.filter((f: any) => f.category_id === catId).forEach((f: any) => on ? cur.add(f.id) : cur.delete(f.id))
    upd({ feature_ids: cur.size === all.length ? null : Array.from(cur) })
  }
  function presetFilas(kind: 'todas' | 'ninguna' | 'conDatos' | 'conAjuste') {
    if (kind === 'todas') return upd({ feature_ids: null })
    if (kind === 'ninguna') return upd({ feature_ids: [] })
    const ids = features.filter((f: any) => {
      if (kind === 'conDatos') return [refModel, ...compModels].some((m: any) => m && getVal(f.id, m.id).trim() !== '')
      return compModels.some((c: any) => ajusteDe(c.id, f) !== 0)
    }).map((f: any) => f.id)
    upd({ feature_ids: ids })
  }
  const hiddenWithValue = useMemo(() => {
    if (ej.feature_ids === null) return 0
    return features.filter((f: any) => !isVisible(f) && compModels.some((c: any) => (ej.ajustes[c.id]?.[f.id] ?? 0) !== 0)).length
  }, [ej.feature_ids, ej.ajustes, compModels, features])

  // ---------- Ejercicios: guardar / nuevo / duplicar / eliminar ----------
  async function guardar() {
    if (!ej.nombre.trim()) { toast('Pon un nombre al ejercicio antes de guardar'); return }
    if (!ej.reference_model_id) { toast('Selecciona un vehículo de referencia'); return }
    setSaving(true)
    const row: any = {
      nombre: ej.nombre.trim(), tipo: ej.tipo.trim() || null,
      reference_model_id: ej.reference_model_id, competitor_ids: ej.competitor_ids,
      feature_ids: ej.feature_ids, precio_km: ej.precio_km, precios: ej.precios, ajustes: ej.ajustes,
      notas: ej.notas || null, updated_at: new Date().toISOString(),
    }
    try {
      if (ej.id) {
        const { error } = await supabase.from('valor_cliente_ejercicios').update(row).eq('id', ej.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('valor_cliente_ejercicios').insert(row).select().single()
        if (error) throw error
        setEj(prev => ({ ...prev, id: data.id }))
      }
      setDirty(false)
      await loadEjercicios(false)
      toast('Ejercicio guardado ✓')
    } catch (e: any) { toast('Error al guardar: ' + (e.message || '')) }
    setSaving(false)
  }
  function nuevo() {
    if (dirty && !confirm('Hay cambios sin guardar. ¿Descartarlos y crear un ejercicio nuevo?')) return
    setEj({ ...EJERCICIO_VACIO, tipo: ej.tipo }); setDirty(false)
  }
  function duplicar() {
    setEj(prev => ({ ...prev, id: undefined, nombre: prev.nombre ? `${prev.nombre} (copia)` : '' })); setDirty(true)
    toast('Copia creada: ponle nombre y guarda')
  }
  async function eliminar() {
    if (!ej.id) return
    if (!confirm(`¿Eliminar el ejercicio "${ej.nombre}"? Esta acción no se puede deshacer.`)) return
    await supabase.from('valor_cliente_ejercicios').delete().eq('id', ej.id)
    setEj({ ...EJERCICIO_VACIO }); setDirty(false)
    await loadEjercicios(false)
    toast('Ejercicio eliminado')
  }
  function seleccionarEjercicio(id: string) {
    if (!id) return
    if (dirty && !confirm('Hay cambios sin guardar. ¿Descartarlos y abrir otro ejercicio?')) return
    const row = ejercicios.find(e => e.id === id); if (row) cargar(row)
  }
  const tipos = Array.from(new Set(ejercicios.map(e => e.tipo).filter(Boolean))).sort() as string[]

  // ---------- Exportación ----------
  function buildExport(): VCExportData | null {
    if (!refModel) return null
    const segOf = (m: any) => segmentFeat ? getVal(segmentFeat.id, m.id) : ''
    const base = (m: any) => ({ id: m.id, marca: m.brand, modelo: m.name, version: m.version || '', segmento: segOf(m), msrp: msrpOf(m) })
    return {
      titulo: ej.nombre || 'Valor Cliente',
      tipo: ej.tipo,
      fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
      precioKm: ej.precio_km,
      ref: base(refModel),
      comps: resumen.map((r: any) => ({ ...base(r.model), totalAjustes: r.total, precioAjustado: r.precioAjustado, difMsrp: r.difMsrp, difMsrpPct: r.difMsrpPct, difAjustada: r.difAjustada, difAjustadaPct: r.difAjustadaPct })),
      filas: filas.map((f: any) => ({
        categoria: f.catName, caracteristica: getName(f, lang),
        esAutonomia: !!autonomiaFeat && f.id === autonomiaFeat.id,
        refVal: displayVal(getVal(f.id, refModel.id)),
        comps: compModels.map((c: any) => ({ val: displayVal(getVal(f.id, c.id)), ajuste: ajusteDe(c.id, f) })),
      })),
    }
  }
  function exportExcel() { const d = buildExport(); if (d) exportarValorClienteExcel(d) }
  function exportPDF() { const d = buildExport(); if (d) exportarValorClientePDF(d) }

  // ---------- Presentación ----------
  const displayVal = (v: string) => { const lo = v.toLowerCase().trim(); if (lo === 'yes') return '✓'; if (lo === 'no') return '✗'; return v || '—' }
  const valCls = (v: string) => { const lo = v.toLowerCase().trim(); if (lo === 'yes') return 'text-emerald-700 font-black'; if (lo === 'no') return 'text-red-600 font-black'; if (!v || lo === 'n/a') return 'text-slate-300'; return 'text-slate-700' }
  const ajCls = (n: number) => n > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : n < 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200 text-slate-400'
  const signCls = (n: number) => n > 0 ? 'text-emerald-600' : n < 0 ? 'text-red-600' : 'text-slate-400'

  const ic = "border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
  const btn = "px-3 py-2 text-xs font-bold rounded-lg border transition whitespace-nowrap"
  const btnGhost = `${btn} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`
  const btnDark = `${btn} border-[#081224] bg-[#081224] text-white hover:bg-[#162040] disabled:opacity-50`

  const listo = !!refModel && compModels.length > 0

  return (
    <div>
      {msg && <div className="fixed top-4 right-4 bg-[#081224] text-white px-5 py-3 rounded-full text-sm font-bold shadow-lg z-50">{msg}</div>}

      {/* CABECERA */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Valor Cliente</h1>
          <p className="text-slate-500 text-sm">Cuánto costaría cada competidor si tuviera el equipamiento del vehículo de referencia</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel} disabled={!listo} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-full transition disabled:opacity-40">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>Excel
          </button>
          <button onClick={exportPDF} disabled={!listo} className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-full transition disabled:opacity-40">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>PDF
          </button>
        </div>
      </div>

      {/* EJERCICIOS GUARDADOS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-4">
            <label className="block text-xs font-bold text-slate-500 mb-1">Ejercicio guardado</label>
            <select className={`${ic} w-full`} value={ej.id || ''} onChange={e => seleccionarEjercicio(e.target.value)}>
              <option value="">{ejercicios.length ? 'Abrir un ejercicio…' : 'Aún no hay ejercicios guardados'}</option>
              {tipos.map(t => (
                <optgroup key={t} label={t}>
                  {ejercicios.filter(e => e.tipo === t).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </optgroup>
              ))}
              {ejercicios.filter(e => !e.tipo).length > 0 && (
                <optgroup label="Sin tipo">
                  {ejercicios.filter(e => !e.tipo).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </optgroup>
              )}
            </select>
          </div>
          <div className="lg:col-span-3">
            <label className="block text-xs font-bold text-slate-500 mb-1">Nombre</label>
            <input className={`${ic} w-full`} value={ej.nombre} onChange={e => upd({ nombre: e.target.value })} placeholder="ej. BIG v1.0 vs segmento L7e" />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1">Tipo de comparativa</label>
            <input className={`${ic} w-full`} list="vc-tipos" value={ej.tipo} onChange={e => upd({ tipo: e.target.value })} placeholder="ej. Comité, Comercial…" />
            <datalist id="vc-tipos">{tipos.map(t => <option key={t} value={t} />)}</datalist>
          </div>
          <div className="lg:col-span-3 flex gap-2 justify-end flex-wrap">
            <button onClick={nuevo} className={btnGhost}>Nuevo</button>
            <button onClick={duplicar} disabled={!ej.reference_model_id} className={`${btnGhost} disabled:opacity-40`}>Duplicar</button>
            {ej.id && <button onClick={eliminar} className={`${btn} border-red-100 bg-white text-red-500 hover:bg-red-50`}>Eliminar</button>}
            <button onClick={guardar} disabled={saving} className={`${btnDark} relative`}>
              {saving ? 'Guardando…' : 'Guardar'}
              {dirty && !saving && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white" title="Cambios sin guardar" />}
            </button>
          </div>
        </div>
        {dirty && <p className="text-[11px] text-amber-600 mt-2">Hay cambios sin guardar.</p>}
      </div>

      {/* CONFIGURACIÓN: SEGMENTO, REFERENCIA, COMPETIDORES */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs font-bold text-slate-500 mr-1">Segmento</span>
          <button onClick={() => setSegment('')} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${!segment ? 'bg-[#081224] text-white border-[#081224]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>Todos</button>
          {segments.map(seg => <button key={seg} onClick={() => setSegment(seg)} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${segment === seg ? 'bg-[#081224] text-white border-[#081224]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>{seg}</button>)}
          <span className="text-[11px] text-slate-400 ml-1">Filtra los vehículos que puedes elegir</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Referencia */}
          <div className="lg:col-span-1">
            <label className="block text-xs font-bold text-blue-700 mb-1">Vehículo de referencia</label>
            <select value={ej.reference_model_id} onChange={e => setReferencia(e.target.value)}
              className="w-full border-2 border-blue-200 bg-blue-50 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-blue-400">
              <option value="">Selecciona…</option>
              {modelsInSegment.map((m: any) => <option key={m.id} value={m.id}>{m.brand} {m.name} {m.version}</option>)}
            </select>
            {refModel && (
              <div className="mt-3 flex items-center gap-3 border border-blue-100 rounded-xl p-3 bg-blue-50/40">
                <div className="w-16 h-11 bg-white rounded-lg overflow-hidden shrink-0 flex items-center justify-center border border-blue-100">
                  {refModel.img_url ? <img src={refModel.img_url} className="max-w-full max-h-full object-contain" /> : <span className="text-[10px] text-slate-400">—</span>}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-black text-blue-600 uppercase tracking-wider truncate">{refModel.brand}</div>
                  <div className="font-black text-sm truncate">{refModel.name} {refModel.version}</div>
                  <div className="text-xs text-slate-500">MSRP {fmtEur(msrpOf(refModel))}</div>
                </div>
              </div>
            )}
          </div>

          {/* Competidores */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-600">Competidores <span className="text-slate-400 font-normal">({compModels.length})</span></label>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">€/km autonomía</span>
                <NumInput value={ej.precio_km} step={1} onCommit={n => upd({ precio_km: n })} className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center outline-none focus:border-blue-400" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[44px]">
              {compModels.map((c: any, idx: number) => (
                <div key={c.id} className="flex items-center gap-1.5 border border-slate-200 bg-slate-50 rounded-xl pl-2 pr-1 py-1">
                  <div className="w-9 h-7 bg-white rounded-md overflow-hidden flex items-center justify-center border border-slate-100">
                    {c.img_url ? <img src={c.img_url} className="max-w-full max-h-full object-contain" /> : <span className="text-[9px] text-slate-300">—</span>}
                  </div>
                  <div className="leading-tight">
                    <div className="text-[9px] font-black text-slate-500 uppercase">{c.brand}</div>
                    <div className="text-xs font-bold text-slate-800">{c.name} {c.version}</div>
                  </div>
                  <div className="flex flex-col ml-1">
                    <button onClick={() => moveCompetidor(idx, -1)} disabled={idx === 0} className="text-slate-300 hover:text-slate-700 disabled:opacity-20 text-[9px] leading-none px-1">◀</button>
                    <button onClick={() => moveCompetidor(idx, 1)} disabled={idx === compModels.length - 1} className="text-slate-300 hover:text-slate-700 disabled:opacity-20 text-[9px] leading-none px-1">▶</button>
                  </div>
                  <button onClick={() => removeCompetidor(c.id)} className="w-5 h-5 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-500 text-xs font-bold flex items-center justify-center">✕</button>
                </div>
              ))}
              <div className="relative">
                <button onClick={() => setAddCompOpen(v => !v)} disabled={!refModel || disponibles.length === 0}
                  className="h-full min-h-[44px] px-4 border-2 border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition disabled:opacity-40">
                  + Añadir competidor
                </button>
                {addCompOpen && (
                  <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-30 max-h-72 overflow-y-auto">
                    {disponibles.map((m: any) => (
                      <button key={m.id} onClick={() => addCompetidor(m.id)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-left border-b border-slate-50">
                        <div className="w-10 h-7 bg-slate-50 rounded-md overflow-hidden flex items-center justify-center">{m.img_url ? <img src={m.img_url} className="max-w-full max-h-full object-contain" /> : <span className="text-[9px] text-slate-300">—</span>}</div>
                        <div><div className="text-[9px] font-bold text-blue-600 uppercase">{m.brand}</div><div className="text-sm font-bold text-slate-800">{m.name} {m.version}</div></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {!refModel && <p className="text-[11px] text-slate-400 mt-2">Elige primero el vehículo de referencia.</p>}
          </div>
        </div>
      </div>

      {/* RESUMEN EJECUTIVO */}
      {listo && (
        <div className="overflow-x-auto pb-1 mb-4 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 w-48 shrink-0">
              <div className="text-[10px] font-black text-blue-600 uppercase tracking-wider">{refModel.brand} · referencia</div>
              <div className="font-black text-base mb-2">{refModel.name} {refModel.version}</div>
              <div className="text-[11px] text-slate-500">MSRP</div>
              <div className="text-xl font-black text-blue-900">{fmtEur(msrpOf(refModel))}</div>
            </div>
            {resumen.map((r: any) => (
              <div key={r.model.id} className="bg-white border border-slate-200 rounded-2xl p-4 w-52 shrink-0 shadow-sm">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{r.model.brand}</div>
                <div className="font-black text-base mb-2 truncate">{r.model.name} {r.model.version}</div>
                <div className="flex justify-between text-[11px] text-slate-500"><span>MSRP</span><span className="font-bold text-slate-700">{fmtEur(r.msrp)}</span></div>
                <div className="flex justify-between text-[11px] text-slate-500"><span>Ajustes</span><span className={`font-bold ${signCls(r.total)}`}>{fmtEur(r.total, true)}</span></div>
                <div className="border-t border-slate-100 mt-2 pt-2">
                  <div className="text-[11px] text-slate-500">Precio ajustado</div>
                  <div className="text-xl font-black text-slate-900">{fmtEur(r.precioAjustado)}</div>
                  <div className={`text-xs font-black ${signCls(r.difAjustada)}`}>{fmtEur(r.difAjustada, true)} · {fmtPct(r.difAjustadaPct)} vs referencia</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TABLA */}
      {listo ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-black text-slate-500 uppercase tracking-wider">Ficha de equipamiento</span>
              <span className="text-slate-400">{filas.length} filas</span>
              {hiddenWithValue > 0 && <span className="text-amber-600">{hiddenWithValue} con ajuste ocultas (no suman)</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 hidden md:inline">Ajuste <span className="text-emerald-600 font-bold">+</span> la referencia tiene algo que el competidor no · <span className="text-red-600 font-bold">−</span> el competidor tiene algo que la referencia no</span>
              <button onClick={() => setShowRows(true)} className={btnGhost}>Filas visibles</button>
            </div>
          </div>

          <div className="overflow-auto max-h-[72vh]">
            <table className="border-collapse text-xs" style={{ minWidth: `${290 + 120 + compModels.length * 230}px` }}>
              <colgroup>
                <col style={{ width: 90 }} /><col style={{ width: 200 }} /><col style={{ width: 120 }} />
                {compModels.map((c: any) => <Fragment key={c.id}><col key={c.id + 'v'} style={{ width: 120 }} /><col key={c.id + 'a'} style={{ width: 110 }} /></Fragment>)}
              </colgroup>
              <thead className="sticky top-0 z-20">
                <tr>
                  <th colSpan={2} className="bg-[#081224] sticky left-0 z-30"></th>
                  <th className="bg-blue-800 text-blue-100 text-center py-1.5 text-[8px] font-black tracking-widest uppercase border border-blue-900">{refModel.brand}</th>
                  {compModels.map((c: any) => <th key={c.id} colSpan={2} className="bg-[#0d1e3a] text-[#7aa4cc] text-center py-1.5 text-[8px] font-black tracking-widest uppercase border border-[#1a2f4a]">{c.brand}</th>)}
                </tr>
                <tr>
                  <th className="bg-[#081224] text-white text-left px-2 py-2 font-black uppercase text-[8px] sticky left-0 z-30">Cat.</th>
                  <th className="bg-[#081224] text-white text-left px-2 py-2 font-black uppercase text-[8px] sticky left-[90px] z-30">Característica</th>
                  <th className="bg-blue-700 text-white text-center px-1 py-2 font-black text-[9px] border border-blue-900">
                    <div>{refModel.name} {refModel.version}</div><div className="text-[7px] text-blue-200 font-bold">referencia</div>
                  </th>
                  {compModels.map((c: any) => (
                    <Fragment key={c.id}>
                      <th key={c.id + 'v'} className="bg-[#1c3050] text-white text-center px-1 py-2 font-black text-[9px] border border-[#1a2f4a]">{c.name} {c.version}</th>
                      <th key={c.id + 'a'} className="bg-[#1c3050] text-[#a8c4e8] text-center px-1 py-2 font-black text-[8px] border border-[#1a2f4a]">
                        Ajuste €
                        <button title="Sugerir ajustes desde los valores por defecto" onClick={() => { if (confirm(`¿Sustituir los ajustes de ${c.brand} ${c.name} por la sugerencia automática?`)) upd({ ajustes: { ...ej.ajustes, [c.id]: sugerirAjustes(c.id) } }) }}
                          className="ml-1 text-[8px] text-[#7aa4cc] hover:text-white">⟳</button>
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* MSRP */}
                <tr className="bg-slate-50">
                  <td className="border border-slate-100 px-2 py-2 text-[9px] font-bold text-slate-500 sticky left-0 bg-slate-50 z-10">Precio</td>
                  <td className="border border-slate-100 px-2 py-2 text-[10px] font-bold text-slate-700 sticky left-[90px] bg-slate-50 z-10">MSRP (€)</td>
                  <td className="border border-slate-100 px-1 py-1 text-center bg-blue-50/60">
                    <NumInput value={msrpOf(refModel)} step={10} onCommit={n => upd({ precios: { ...ej.precios, [refModel.id]: n } })} className="w-24 text-center font-black text-xs rounded-lg px-2 py-1 border border-blue-200 bg-white text-blue-900 outline-none focus:border-blue-400" />
                  </td>
                  {compModels.map((c: any) => (
                    <Fragment key={c.id}>
                      <td key={c.id + 'v'} className="border border-slate-100 px-1 py-1 text-center">
                        <NumInput value={msrpOf(c)} step={10} onCommit={n => upd({ precios: { ...ej.precios, [c.id]: n } })} className="w-24 text-center font-black text-xs rounded-lg px-2 py-1 border border-slate-200 bg-white text-slate-800 outline-none focus:border-blue-400" />
                      </td>
                      <td key={c.id + 'a'} className="border border-slate-100"></td>
                    </Fragment>
                  ))}
                </tr>
                <tr className="bg-slate-50">
                  <td className="border border-slate-100 sticky left-0 bg-slate-50 z-10"></td>
                  <td className="border border-slate-100 px-2 py-1.5 text-[10px] text-slate-500 sticky left-[90px] bg-slate-50 z-10">Diferencia MSRP vs referencia</td>
                  <td className="border border-slate-100 bg-blue-50/60"></td>
                  {resumen.map((r: any) => (
                    <Fragment key={r.model.id}>
                      <td key={r.model.id + 'v'} className={`border border-slate-100 px-2 py-1.5 text-center font-bold ${signCls(r.difMsrp)}`}>{fmtEur(r.difMsrp, true)}</td>
                      <td key={r.model.id + 'a'} className={`border border-slate-100 px-2 py-1.5 text-center font-bold ${signCls(r.difMsrp)}`}>{fmtPct(r.difMsrpPct)}</td>
                    </Fragment>
                  ))}
                </tr>

                {/* CARACTERÍSTICAS */}
                {filas.map((f: any) => {
                  const isAut = !!autonomiaFeat && f.id === autonomiaFeat.id
                  const refV = getVal(f.id, refModel.id)
                  const allEqual = compModels.every((c: any) => getVal(f.id, c.id).trim().toLowerCase() === refV.trim().toLowerCase())
                  const anyAdj = compModels.some((c: any) => ajusteDe(c.id, f) !== 0)
                  const dim = allEqual && !anyAdj && !isAut
                  return (
                    <tr key={f.id} className={`${f.isFirst ? 'border-t-2 border-slate-300' : ''} ${dim ? 'opacity-45' : ''}`}>
                      <td className="border border-slate-100 px-2 py-1.5 text-[9px] font-bold text-slate-500 bg-slate-50 sticky left-0 z-10 whitespace-nowrap overflow-hidden text-ellipsis">{f.isFirst ? f.catName : ''}</td>
                      <td className="border border-slate-100 px-2 py-1.5 text-[10px] text-slate-700 sticky left-[90px] bg-white z-10 whitespace-nowrap overflow-hidden text-ellipsis" title={getName(f, lang)}>
                        {getName(f, lang)}{isAut && <span className="text-[8px] text-slate-400 ml-1">×{ej.precio_km} €/km</span>}
                      </td>
                      <td className={`border border-slate-100 px-2 py-1.5 text-center bg-blue-50/60 ${valCls(refV)}`} title={refV}>{displayVal(refV)}</td>
                      {compModels.map((c: any) => {
                        const v = getVal(f.id, c.id); const a = ajusteDe(c.id, f)
                        return (
                          <Fragment key={c.id}>
                            <td key={c.id + 'v'} className={`border border-slate-100 px-2 py-1.5 text-center ${valCls(v)}`} title={v}>{displayVal(v)}</td>
                            <td key={c.id + 'a'} className="border border-slate-100 px-1 py-1 text-center">
                              {isAut ? (
                                <span className={`inline-block w-24 text-right font-bold text-xs rounded-lg px-2 py-1 border ${ajCls(a)}`} title={`(${parseFloat(refV) || 0} − ${parseFloat(v) || 0}) × ${ej.precio_km}`}>{a !== 0 ? fmtEur(a, true) : '—'}</span>
                              ) : (
                                <NumInput value={a} onCommit={n => setAjuste(c.id, f.id, n)} className={`w-24 text-right font-bold text-xs rounded-lg px-2 py-1 border outline-none focus:border-blue-400 ${ajCls(a)}`} />
                              )}
                            </td>
                          </Fragment>
                        )
                      })}
                    </tr>
                  )
                })}

                {/* RESULTADO */}
                <tr className="bg-amber-50 border-t-2 border-amber-200">
                  <td className="border border-amber-100 px-2 py-2 text-[9px] font-black text-amber-700 uppercase sticky left-0 bg-amber-50 z-10">Resultado</td>
                  <td className="border border-amber-100 px-2 py-2 text-[10px] font-bold text-slate-700 sticky left-[90px] bg-amber-50 z-10">Total ajustes equipamiento</td>
                  <td className="border border-amber-100 bg-blue-50/60"></td>
                  {resumen.map((r: any) => (
                    <Fragment key={r.model.id}>
                      <td key={r.model.id + 'v'} className="border border-amber-100"></td>
                      <td key={r.model.id + 'a'} className={`border border-amber-100 px-2 py-2 text-right font-black ${signCls(r.total)}`}>{fmtEur(r.total, true)}</td>
                    </Fragment>
                  ))}
                </tr>
                <tr className="bg-amber-50">
                  <td className="border border-amber-100 sticky left-0 bg-amber-50 z-10"></td>
                  <td className="border border-amber-100 px-2 py-2 text-[10px] font-bold text-slate-700 sticky left-[90px] bg-amber-50 z-10">Precio ajustado (€)</td>
                  <td className="border border-amber-100 px-2 py-2 text-center font-black text-blue-900 bg-blue-50/60">{fmtEur(msrpOf(refModel))}</td>
                  {resumen.map((r: any) => (
                    <Fragment key={r.model.id}>
                      <td key={r.model.id + 'v'} className="border border-amber-100 px-2 py-2 text-center font-black text-sm text-slate-900">{fmtEur(r.precioAjustado)}</td>
                      <td key={r.model.id + 'a'} className="border border-amber-100"></td>
                    </Fragment>
                  ))}
                </tr>
                <tr className="bg-amber-50">
                  <td className="border border-amber-100 sticky left-0 bg-amber-50 z-10"></td>
                  <td className="border border-amber-100 px-2 py-2 text-[10px] font-bold text-slate-700 sticky left-[90px] bg-amber-50 z-10">Diferencia ajustada vs referencia</td>
                  <td className="border border-amber-100 bg-blue-50/60"></td>
                  {resumen.map((r: any) => (
                    <Fragment key={r.model.id}>
                      <td key={r.model.id + 'v'} className={`border border-amber-100 px-2 py-2 text-center font-black ${signCls(r.difAjustada)}`}>{fmtEur(r.difAjustada, true)}</td>
                      <td key={r.model.id + 'a'} className={`border border-amber-100 px-2 py-2 text-center font-black ${signCls(r.difAjustada)}`}>{fmtPct(r.difAjustadaPct)}</td>
                    </Fragment>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
          <div className="text-5xl mb-4">⚖️</div>
          <div className="font-bold text-base mb-1">Elige un vehículo de referencia y añade competidores</div>
          <div className="text-sm">O abre un ejercicio guardado desde el desplegable superior</div>
        </div>
      )}

      {/* NOTAS */}
      {listo && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
          <label className="block text-xs font-bold text-slate-500 mb-1">Notas del ejercicio</label>
          <textarea rows={2} value={ej.notas} onChange={e => upd({ notas: e.target.value })} placeholder="Hipótesis, fuentes de precios estimados, comentarios para el comité…"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" />
        </div>
      )}

      {/* MODAL FILAS VISIBLES */}
      {showRows && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowRows(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <div className="font-black text-base">Filas visibles</div>
                <div className="text-xs text-slate-400">Elige qué características entran en este ejercicio. Las ocultas no suman en el total.</div>
              </div>
              <button onClick={() => setShowRows(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="px-6 py-3 border-b border-slate-100 flex gap-2 flex-wrap">
              <button onClick={() => presetFilas('todas')} className={btnGhost}>Todas</button>
              <button onClick={() => presetFilas('ninguna')} className={btnGhost}>Ninguna</button>
              <button onClick={() => presetFilas('conDatos')} className={btnGhost}>Solo con datos</button>
              <button onClick={() => presetFilas('conAjuste')} className={btnGhost}>Solo con ajuste</button>
            </div>
            <div className="overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              {categories.map((cat: any) => {
                const fs = features.filter((f: any) => f.category_id === cat.id); if (!fs.length) return null
                const nOn = fs.filter(isVisible).length
                return (
                  <div key={cat.id}>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-2">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-wider">{getName(cat, lang)} <span className="text-slate-300 font-normal">{nOn}/{fs.length}</span></span>
                      <div className="flex gap-1">
                        <button onClick={() => toggleCategoria(cat.id, true)} className="text-[10px] text-blue-600 hover:underline">todas</button>
                        <span className="text-slate-200">·</span>
                        <button onClick={() => toggleCategoria(cat.id, false)} className="text-[10px] text-slate-500 hover:underline">ninguna</button>
                      </div>
                    </div>
                    {fs.map((f: any) => (
                      <label key={f.id} className="flex items-center gap-2 py-1 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 rounded px-1">
                        <input type="checkbox" checked={isVisible(f)} onChange={() => toggleFeature(f.id)} />
                        <span className="truncate">{getName(f, lang)}</span>
                      </label>
                    ))}
                  </div>
                )
              })}
            </div>
            <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
              <button onClick={() => setShowRows(false)} className={btnDark}>Listo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}