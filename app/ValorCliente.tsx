'use client'
import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
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
  precios: Record<string, number>              // MSRP editado por model_id
  ajustes: Record<string, Record<string, number>> // SOLO correcciones manuales: competitor_id -> feature_id -> €
  notas: string
}

// Catálogo de valores cliente: cuánto vale cada característica y con qué regla se aplica.
// Se guarda en valor_cliente_items y es común a todos los ejercicios.
type Regla = 'fijo' | 'unidad' | 'texto'
type ItemCatalogo = { valor: number; regla: Regla; direccion: 'mayor' | 'menor'; preferido: string }
type Catalogo = Record<string, ItemCatalogo>   // feature_id -> item

const EJERCICIO_VACIO: Ejercicio = {
  nombre: '', tipo: '', reference_model_id: '', competitor_ids: [], feature_ids: null,
  precios: {}, ajustes: {}, notas: '',
}

const parseNum = (v: string) => parseFloat(String(v).replace(',', '.').trim())
const isBoolVal = (v: string) => ['yes', 'no', 'sí', 'si'].includes(v.toLowerCase().trim())
const isYesVal = (v: string) => ['yes', 'sí', 'si'].includes(v.toLowerCase().trim())
const isNumVal = (v: string) => v.trim() !== '' && !isNaN(parseNum(v))

// ============ INPUT NUMÉRICO ============
// Recalcula EN TIEMPO REAL: cada tecla propaga el valor (onCommit). Se mantiene un
// texto local para que se pueda escribir "-" o "12." sin que el campo se reinicie.
// Si el valor cambia desde fuera (cargar otro ejercicio), el texto se sincroniza.
function NumInput({ value, onCommit, className, step = 50, placeholder = '0' }:
  { value: number; onCommit: (n: number) => void; className?: string; step?: number; placeholder?: string }) {
  const [txt, setTxt] = useState(value === 0 ? '' : String(value))
  useEffect(() => {
    const n = parseFloat(txt); const cur = isNaN(n) ? 0 : n
    if (cur !== value) setTxt(value === 0 ? '' : String(value))
  }, [value])
  return (
    <input
      type="number"
      step={step}
      value={txt}
      placeholder={placeholder}
      onChange={e => { setTxt(e.target.value); const n = parseFloat(e.target.value); onCommit(isNaN(n) ? 0 : n) }}
      onBlur={() => { if (txt !== '' && (parseFloat(txt) === 0 || isNaN(parseFloat(txt)))) setTxt('') }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      onWheel={e => (e.target as HTMLInputElement).blur()}  // la rueda del ratón no cambia el valor
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
  const [catalogo, setCatalogo] = useState<Catalogo>({})
  const [catOpen, setCatOpen] = useState(false)
  const [catDraft, setCatDraft] = useState<Catalogo>({})
  const [catSaving, setCatSaving] = useState(false)
  const [addCompOpen, setAddCompOpen] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  // Cabeceras fijas: la 2ª fila se pega justo debajo de la 1ª, midiendo su altura real
  const headRow1 = useRef<HTMLTableRowElement>(null)
  const [headH, setHeadH] = useState(28)

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
  useEffect(() => { loadEjercicios(true); loadCatalogo() }, [])

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
  async function loadCatalogo() {
    const { data } = await supabase.from('valor_cliente_items').select('*')
    const map: Catalogo = {}
    ;(data || []).forEach((d: any) => {
      map[d.feature_id] = { valor: Number(d.valor_default) || 0, regla: (d.regla || 'fijo') as Regla, direccion: d.direccion === 'menor' ? 'menor' : 'mayor', preferido: d.preferido || '' }
    })
    setCatalogo(map)
  }
  function abrirCatalogo() { setCatDraft(JSON.parse(JSON.stringify(catalogo))); setCatOpen(true) }
  function setCatItem(fid: string, patch: Partial<ItemCatalogo>) {
    setCatDraft(prev => {
      const base: ItemCatalogo = prev[fid] || { valor: 0, regla: 'fijo', direccion: 'mayor', preferido: '' }
      return { ...prev, [fid]: { ...base, ...patch } }
    })
  }
  async function guardarCatalogo() {
    setCatSaving(true)
    const rows = Object.entries(catDraft).map(([feature_id, it]) => ({
      feature_id, valor_default: it.valor || 0, regla: it.regla, direccion: it.direccion, preferido: it.preferido?.trim() || null,
    }))
    const { error } = await supabase.from('valor_cliente_items').upsert(rows, { onConflict: 'feature_id' })
    setCatSaving(false)
    if (error) { toast('Error al guardar el catálogo: ' + error.message); return }
    setCatalogo(catDraft); setCatOpen(false); toast('Catálogo guardado ✓')
  }
  function cargar(row: any) {
    setEj({
      id: row.id, nombre: row.nombre || '', tipo: row.tipo || '',
      reference_model_id: row.reference_model_id || '', competitor_ids: row.competitor_ids || [],
      feature_ids: row.feature_ids ?? null,
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

  // Ítem de catálogo de una característica (la autonomía tiene 16 €/km por defecto si no está en el catálogo)
  function itemDe(f: any): ItemCatalogo | null {
    const it = catalogo[f.id]
    if (it && it.valor) return it
    if (autonomiaFeat && f.id === autonomiaFeat.id) return { valor: 16, regla: 'unidad', direccion: 'mayor', preferido: '' }
    return null
  }
  // Ajuste AUTOMÁTICO según el catálogo, comparando referencia y competidor
  function ajusteAuto(compId: string, f: any): number {
    if (!refModel) return 0
    const it = itemDe(f); if (!it) return 0
    const v1 = getVal(f.id, refModel.id), v2 = getVal(f.id, compId)
    if (it.regla === 'texto') {
      const pref = it.preferido.trim().toLowerCase(); if (!pref) return 0
      const a = v1.trim().toLowerCase() === pref, b = v2.trim().toLowerCase() === pref
      return a && !b ? it.valor : (!a && b ? -it.valor : 0)
    }
    if (isBoolVal(v1) && isBoolVal(v2)) {
      const a = isYesVal(v1), b = isYesVal(v2)
      return a && !b ? it.valor : (!a && b ? -it.valor : 0)
    }
    if (isNumVal(v1) && isNumVal(v2)) {
      const diff = (parseNum(v1) - parseNum(v2)) * (it.direccion === 'menor' ? -1 : 1)
      if (it.regla === 'unidad') return Math.round(diff * it.valor)
      return diff > 0 ? it.valor : diff < 0 ? -it.valor : 0
    }
    return 0
  }
  const esManual = (compId: string, featId: string) => ej.ajustes[compId]?.[featId] !== undefined
  // Ajuste efectivo: la corrección manual prevalece sobre el automático
  function ajusteDe(compId: string, f: any): number {
    const manual = ej.ajustes[compId]?.[f.id]
    return manual !== undefined ? manual : ajusteAuto(compId, f)
  }
  function setAjuste(compId: string, featId: string, valor: number) {
    const comp = { ...(ej.ajustes[compId] || {}) }
    comp[featId] = valor                       // se guarda como corrección manual (aunque sea 0)
    upd({ ajustes: { ...ej.ajustes, [compId]: comp } })
  }
  function quitarManual(compId: string, featId: string) {
    const comp = { ...(ej.ajustes[compId] || {}) }
    delete comp[featId]
    upd({ ajustes: { ...ej.ajustes, [compId]: comp } })
  }

  // Reseteo: elimina las correcciones manuales del EJERCICIO EN CURSO y vuelve a los
  // valores automáticos del catálogo. No toca otros ejercicios guardados.
  function resetAjustes(compId?: string) {
    const comp = compId ? compModels.find((c: any) => c.id === compId) : null
    const msg = comp
      ? `¿Quitar las correcciones manuales de ${`${comp.brand} ${comp.name} ${comp.version || ''}`.trim()} y volver a los valores automáticos del catálogo?`
      : `¿Quitar TODAS las correcciones manuales de este ejercicio (${compModels.length} competidores) y volver a los valores automáticos del catálogo?`
    if (!confirm(msg)) return
    if (compId) upd({ ajustes: { ...ej.ajustes, [compId]: {} } })
    else upd({ ajustes: {} })
  }
  const nAjustesManuales = useMemo(() =>
    compModels.reduce((n: number, c: any) => n + Object.keys(ej.ajustes[c.id] || {}).length, 0)
  , [ej.ajustes, compModels])

  useEffect(() => { if (headRow1.current) setHeadH(headRow1.current.offsetHeight) }, [compModels.length, refModel?.id])

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
  }, [refModel, compModels, filas, ej.ajustes, ej.precios, catalogo])

  // ---------- Acciones sobre competidores ----------
  function addCompetidor(id: string) {
    upd({ competitor_ids: [...ej.competitor_ids, id] })
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
    if (!id || id === ej.reference_model_id) return
    const oldRef = ej.reference_model_id
    let comps = ej.competitor_ids.filter(x => x !== id)
    // Si la nueva referencia era un competidor, la antigua referencia pasa a competidor (como en el Excel)
    if (oldRef && ej.competitor_ids.includes(id)) comps = [oldRef, ...comps]
    let ajustes = ej.ajustes
    if (nAjustesManuales > 0) {
      const descartar = confirm(`Al cambiar la referencia, todos los ajustes se recalculan automáticamente desde el catálogo.\nHay ${nAjustesManuales} correcciones manuales hechas con la referencia anterior que dejan de tener sentido.\n\nAceptar = descartarlas (recomendado) · Cancelar = conservarlas`)
      if (descartar) ajustes = {}
    }
    upd({ reference_model_id: id, competitor_ids: comps, ajustes })
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
  // Guardado automático: 1,2 s después del último cambio, solo si el ejercicio ya existe
  // (tiene id y nombre). El primer guardado de un ejercicio nuevo se hace con el botón.
  useEffect(() => {
    if (!dirty || !ej.id || !ej.nombre.trim() || saving) return
    const t = setTimeout(() => { guardar(true) }, 1200)
    return () => clearTimeout(t)
  }, [ej, dirty])

  async function guardar(auto = false) {
    if (!ej.nombre.trim()) { if (!auto) toast('Pon un nombre al ejercicio antes de guardar'); return }
    if (!ej.reference_model_id) { if (!auto) toast('Selecciona un vehículo de referencia'); return }
    setSaving(true)
    const row: any = {
      nombre: ej.nombre.trim(), tipo: ej.tipo.trim() || null,
      reference_model_id: ej.reference_model_id, competitor_ids: ej.competitor_ids,
      feature_ids: ej.feature_ids, precios: ej.precios, ajustes: ej.ajustes,
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
      setLastSaved(new Date())
      await loadEjercicios(false)
      if (!auto) toast('Ejercicio guardado ✓')
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
      precioKm: autonomiaFeat ? (itemDe(autonomiaFeat)?.valor ?? 16) : 16,
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

  // Bloques verticales por modelo: separador grueso al inicio de cada bloque,
  // fondo alterno entre competidores y columna de referencia enmarcada en azul.
  const edge = 'border-l-2 border-l-slate-400'
  const grp = (i: number) => i % 2 === 1 ? 'bg-slate-50/70' : ''
  const refCol = 'border-l-2 border-l-blue-300 border-r-2 border-r-blue-300 bg-blue-50/60'

  return (
    <div>
      {msg && <div className="fixed top-4 right-4 bg-[#081224] text-white px-5 py-3 rounded-full text-sm font-bold shadow-lg z-50">{msg}</div>}

      {/* CABECERA */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Valor Cliente</h1>
          <p className="text-slate-500 text-sm">Cuánto costaría cada competidor si tuviera el equipamiento del vehículo de referencia</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-right leading-tight hidden md:block">
            {saving ? <div className="text-xs font-bold text-slate-500">Guardando…</div>
              : !ej.id ? <div className="text-xs font-bold text-amber-600">Ejercicio sin guardar</div>
              : dirty ? <div className="text-xs font-bold text-amber-600">Cambios pendientes · se guardarán solos</div>
              : lastSaved ? <div className="text-xs font-bold text-emerald-600">Guardado ✓ {lastSaved.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
              : <div className="text-xs font-bold text-emerald-600">Guardado ✓</div>}
            {ej.id && <div className="text-[10px] text-slate-400">Guardado automático activado</div>}
          </div>
          <button onClick={() => guardar(false)} disabled={saving}
            className={`flex items-center gap-2 px-5 py-2.5 text-white text-sm font-black rounded-xl transition shadow-md disabled:opacity-50 ${dirty || !ej.id ? 'bg-[#081224] hover:bg-[#162040] ring-2 ring-amber-300' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            {saving ? 'Guardando…' : 'Guardar ejercicio'}
          </button>
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
            <button onClick={() => guardar(false)} disabled={saving} className={`${btnGhost} relative`}>
              {saving ? 'Guardando…' : 'Guardar'}
              {dirty && !saving && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white" title="Cambios sin guardar" />}
            </button>
          </div>
        </div>
        {!ej.id && ej.reference_model_id && <p className="text-[11px] text-amber-600 mt-2">Ponle nombre y pulsa «Guardar ejercicio»: a partir de ahí los cambios se guardan automáticamente.</p>}
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
              <span className="text-[11px] text-slate-400">Los ajustes se calculan solos desde el <button onClick={abrirCatalogo} className="text-blue-600 font-bold hover:underline">catálogo de valores</button></span>
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md mb-4">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2 rounded-t-2xl">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-black text-slate-500 uppercase tracking-wider">Ficha de equipamiento</span>
              <span className="text-slate-400">{filas.length} filas</span>
              {hiddenWithValue > 0 && <span className="text-amber-600">{hiddenWithValue} con ajuste ocultas (no suman)</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 hidden xl:inline">Ajuste <span className="text-emerald-600 font-bold">+</span> la referencia tiene algo que el competidor no · <span className="text-red-600 font-bold">−</span> al revés · <span className="text-amber-500 font-bold">●</span> corrección manual</span>
              <button onClick={abrirCatalogo} className={btnGhost}>⚙ Catálogo de valores</button>
              <button onClick={() => resetAjustes()} disabled={nAjustesManuales === 0} title="Quitar las correcciones manuales y volver a los valores automáticos"
                className={`${btn} border-red-100 bg-white text-red-500 hover:bg-red-50 disabled:opacity-40`}>
                ↺ Quitar correcciones{nAjustesManuales > 0 && <span className="ml-1 text-red-300">({nAjustesManuales})</span>}
              </button>
              <button onClick={() => setShowRows(true)} className={btnGhost}>Filas visibles</button>
            </div>
          </div>

          {/* Sin overflow en los contenedores: así las cabeceras pueden fijarse al hacer scroll de página */}
          <div>
            <table className="border-collapse text-xs" style={{ tableLayout: 'fixed', width: '100%', minWidth: `${100 + 200 + 130 + compModels.length * 240}px` }}>
              <colgroup>
                {/* Cat. y Característica fijas; referencia y bloques de competidores se reparten el resto */}
                <col style={{ width: 100 }} /><col style={{ width: 200 }} /><col />
                {compModels.map((c: any) => <Fragment key={c.id}><col key={c.id + 'v'} /><col key={c.id + 'a'} /></Fragment>)}
              </colgroup>
              <thead>
                <tr ref={headRow1}>
                  <th colSpan={2} className="bg-[#081224] sticky top-0 z-30"></th>
                  <th className="bg-blue-800 text-blue-100 text-center py-1.5 text-[10px] font-black tracking-widest uppercase border-2 border-blue-300 sticky top-0 z-30">{refModel.brand}</th>
                  {compModels.map((c: any) => <th key={c.id} colSpan={2} className="bg-[#0d1e3a] text-[#7aa4cc] text-center py-1.5 text-[10px] font-black tracking-widest uppercase border border-[#1a2f4a] border-l-2 border-l-slate-400 sticky top-0 z-30">{c.brand}</th>)}
                </tr>
                <tr>
                  <th style={{ top: headH }} className="bg-[#081224] text-white text-left px-2 py-2 font-black uppercase text-[10px] sticky z-30">Cat.</th>
                  <th style={{ top: headH }} className="bg-[#081224] text-white text-left px-2 py-2 font-black uppercase text-[10px] sticky z-30">Característica</th>
                  <th style={{ top: headH }} className="bg-blue-700 text-white text-center px-1 py-2 font-black text-[11px] border-2 border-blue-300 border-t-0 sticky z-30">
                    <div>{refModel.name} {refModel.version}</div><div className="text-[8px] text-blue-200 font-bold">referencia</div>
                  </th>
                  {compModels.map((c: any) => (
                    <Fragment key={c.id}>
                      <th key={c.id + 'v'} style={{ top: headH }} className="bg-[#1c3050] text-white text-center px-1 py-2 font-black text-[11px] border border-[#1a2f4a] border-l-2 border-l-slate-400 sticky z-30">{c.name} {c.version}</th>
                      <th key={c.id + 'a'} style={{ top: headH }} className="bg-[#1c3050] text-[#a8c4e8] text-center px-1 py-2 font-black text-[10px] border border-[#1a2f4a] sticky z-30">
                        Ajuste €
                        <button title="Quitar las correcciones manuales de este modelo y volver a los valores automáticos" onClick={() => resetAjustes(c.id)}
                          className="ml-1 text-[9px] text-[#7aa4cc] hover:text-red-300">↺</button>
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* MSRP */}
                <tr className="bg-slate-50">
                  <td className="border border-slate-100 px-2 py-2 text-[9px] font-bold text-slate-500">Precio</td>
                  <td className="border border-slate-100 px-2 py-2 text-[10px] font-bold text-slate-700">MSRP (€)</td>
                  <td className={`border border-slate-100 px-1 py-1 text-center ${refCol}`}>
                    <NumInput value={msrpOf(refModel)} step={10} onCommit={n => upd({ precios: { ...ej.precios, [refModel.id]: n } })} className="w-24 text-center font-black text-xs rounded-lg px-2 py-1 border border-blue-200 bg-white text-blue-900 outline-none focus:border-blue-400" />
                  </td>
                  {compModels.map((c: any, gi: number) => (
                    <Fragment key={c.id}>
                      <td key={c.id + 'v'} className={`border border-slate-100 px-1 py-1 text-center ${edge} ${grp(gi)}`}>
                        <NumInput value={msrpOf(c)} step={10} onCommit={n => upd({ precios: { ...ej.precios, [c.id]: n } })} className="w-24 text-center font-black text-xs rounded-lg px-2 py-1 border border-slate-200 bg-white text-slate-800 outline-none focus:border-blue-400" />
                      </td>
                      <td key={c.id + 'a'} className={`border border-slate-100 ${grp(gi)}`}></td>
                    </Fragment>
                  ))}
                </tr>
                <tr className="bg-slate-50">
                  <td className="border border-slate-100"></td>
                  <td className="border border-slate-100 px-2 py-1.5 text-[10px] text-slate-500">Diferencia MSRP vs referencia</td>
                  <td className={`border border-slate-100 ${refCol}`}></td>
                  {resumen.map((r: any, gi: number) => (
                    <Fragment key={r.model.id}>
                      <td key={r.model.id + 'v'} className={`border border-slate-100 px-2 py-1.5 text-center font-bold ${edge} ${grp(gi)} ${signCls(r.difMsrp)}`}>{fmtEur(r.difMsrp, true)}</td>
                      <td key={r.model.id + 'a'} className={`border border-slate-100 px-2 py-1.5 text-center font-bold ${grp(gi)} ${signCls(r.difMsrp)}`}>{fmtPct(r.difMsrpPct)}</td>
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
                      <td className="border border-slate-100 px-2 py-1.5 text-[11px] font-bold text-slate-500 bg-slate-50 whitespace-nowrap overflow-hidden text-ellipsis">{f.isFirst ? f.catName : ''}</td>
                      <td className="border border-slate-100 px-2 py-1.5 text-[11px] text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis" title={getName(f, lang)}>
                        {getName(f, lang)}{isAut && <span className="text-[8px] text-slate-400 ml-1">×{itemDe(f)?.valor ?? 16} €/km</span>}
                      </td>
                      <td className={`border border-slate-100 px-2 py-1.5 text-center ${refCol} ${valCls(refV)}`} title={refV}>{displayVal(refV)}</td>
                      {compModels.map((c: any, gi: number) => {
                        const v = getVal(f.id, c.id); const a = ajusteDe(c.id, f)
                        return (
                          <Fragment key={c.id}>
                            <td key={c.id + 'v'} className={`border border-slate-100 px-2 py-1.5 text-center ${edge} ${grp(gi)} ${valCls(v)}`} title={v}>{displayVal(v)}</td>
                            <td key={c.id + 'a'} className={`border border-slate-100 px-1 py-1 text-center ${grp(gi)}`}>
                              <div className="inline-flex items-center gap-1">
                                {esManual(c.id, f.id)
                                  ? <button onClick={() => quitarManual(c.id, f.id)} title={`Corrección manual (automático: ${fmtEur(ajusteAuto(c.id, f), true)}). Pulsa para volver al automático`} className="w-2 h-2 rounded-full bg-amber-400 hover:bg-amber-600 shrink-0" />
                                  : <span className="w-2 h-2 shrink-0" />}
                                <NumInput value={a} onCommit={n => setAjuste(c.id, f.id, n)} className={`w-24 text-right font-bold text-xs rounded-lg px-2 py-1 border outline-none focus:border-blue-400 ${ajCls(a)}`} />
                              </div>
                            </td>
                          </Fragment>
                        )
                      })}
                    </tr>
                  )
                })}

                {/* RESULTADO */}
                <tr className="bg-amber-50 border-t-2 border-amber-200">
                  <td className="border border-amber-100 px-2 py-2 text-[9px] font-black text-amber-700 uppercase">Resultado</td>
                  <td className="border border-amber-100 px-2 py-2 text-[10px] font-bold text-slate-700">Total ajustes equipamiento</td>
                  <td className={`border border-amber-100 ${refCol}`}></td>
                  {resumen.map((r: any) => (
                    <Fragment key={r.model.id}>
                      <td key={r.model.id + 'v'} className={`border border-amber-100 ${edge}`}></td>
                      <td key={r.model.id + 'a'} className={`border border-amber-100 px-2 py-2 text-right font-black ${signCls(r.total)}`}>{fmtEur(r.total, true)}</td>
                    </Fragment>
                  ))}
                </tr>
                <tr className="bg-amber-50">
                  <td className="border border-amber-100"></td>
                  <td className="border border-amber-100 px-2 py-2 text-[10px] font-bold text-slate-700">Precio ajustado (€)</td>
                  <td className={`border border-amber-100 px-2 py-2 text-center font-black text-blue-900 ${refCol}`}>{fmtEur(msrpOf(refModel))}</td>
                  {resumen.map((r: any) => (
                    <Fragment key={r.model.id}>
                      <td key={r.model.id + 'v'} className={`border border-amber-100 px-2 py-2 text-center font-black text-sm text-slate-900 ${edge}`}>{fmtEur(r.precioAjustado)}</td>
                      <td key={r.model.id + 'a'} className="border border-amber-100"></td>
                    </Fragment>
                  ))}
                </tr>
                <tr className="bg-amber-50">
                  <td className="border border-amber-100"></td>
                  <td className="border border-amber-100 px-2 py-2 text-[10px] font-bold text-slate-700">Diferencia ajustada vs referencia</td>
                  <td className={`border border-amber-100 ${refCol}`}></td>
                  {resumen.map((r: any) => (
                    <Fragment key={r.model.id}>
                      <td key={r.model.id + 'v'} className={`border border-amber-100 px-2 py-2 text-center font-black ${edge} ${signCls(r.difAjustada)}`}>{fmtEur(r.difAjustada, true)}</td>
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

      {/* MODAL CATÁLOGO DE VALORES */}
      {catOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCatOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <div className="font-black text-base">Catálogo de valores cliente</div>
                <div className="text-xs text-slate-400">Cuánto vale cada característica y cómo se aplica. Es común a todos los ejercicios: los ajustes automáticos se recalculan al guardar.</div>
              </div>
              <button onClick={() => setCatOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="px-6 py-2 border-b border-slate-100 text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
              <span><b>Fijo</b>: importe único cuando uno lo tiene (sí/no) o es mejor (numérico).</span>
              <span><b>Por unidad</b>: importe × diferencia numérica (ej. 16 €/km).</span>
              <span><b>Texto preferido</b>: importe si uno tiene el valor preferido y el otro no (ej. "Leather").</span>
              <span><b>Dirección</b>: en numéricos, si es mejor mayor (potencia) o menor (peso).</span>
            </div>
            <div className="overflow-y-auto p-4">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-[10px] font-black text-slate-500 uppercase">
                    <th className="text-left px-2 py-1">Característica</th>
                    <th className="text-left px-2 py-1 w-20">Tipo</th>
                    <th className="text-right px-2 py-1 w-24">Valor €</th>
                    <th className="text-left px-2 py-1 w-32">Regla</th>
                    <th className="text-left px-2 py-1 w-28">Dirección</th>
                    <th className="text-left px-2 py-1 w-40">Valor preferido</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat: any) => {
                    const fs = features.filter((f: any) => f.category_id === cat.id); if (!fs.length) return null
                    return (
                      <Fragment key={cat.id}>
                        <tr><td colSpan={6} className="px-2 pt-4 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">{getName(cat, lang)}</td></tr>
                        {fs.map((f: any) => {
                          const it: ItemCatalogo = catDraft[f.id] || { valor: 0, regla: 'fijo', direccion: 'mayor', preferido: '' }
                          const isB = f.type === 'boolean'
                          const sel = "border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white outline-none focus:border-blue-400"
                          return (
                            <tr key={f.id} className={`border-b border-slate-50 ${it.valor ? '' : 'opacity-60'}`}>
                              <td className="px-2 py-1 text-slate-700">{getName(f, lang)}</td>
                              <td className="px-2 py-1"><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isB ? 'bg-emerald-50 text-emerald-600' : f.type === 'numeric' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>{isB ? 'sí/no' : f.type === 'numeric' ? 'numérico' : 'texto'}</span></td>
                              <td className="px-2 py-1 text-right">
                                <input type="number" step={50} value={it.valor || ''} placeholder="0" onWheel={e => (e.target as HTMLInputElement).blur()}
                                  onChange={e => setCatItem(f.id, { valor: parseFloat(e.target.value) || 0 })}
                                  className={`w-20 text-right font-bold ${sel} ${it.valor ? 'text-slate-900' : 'text-slate-400'}`} />
                              </td>
                              <td className="px-2 py-1">
                                {isB ? <span className="text-slate-400">fijo</span> : (
                                  <select value={it.regla} onChange={e => setCatItem(f.id, { regla: e.target.value as Regla })} className={sel}>
                                    <option value="fijo">Fijo</option>
                                    <option value="unidad">Por unidad</option>
                                    <option value="texto">Texto preferido</option>
                                  </select>
                                )}
                              </td>
                              <td className="px-2 py-1">
                                {!isB && it.regla !== 'texto' ? (
                                  <select value={it.direccion} onChange={e => setCatItem(f.id, { direccion: e.target.value as 'mayor' | 'menor' })} className={sel}>
                                    <option value="mayor">Mayor es mejor</option>
                                    <option value="menor">Menor es mejor</option>
                                  </select>
                                ) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-2 py-1">
                                {it.regla === 'texto' ? (
                                  <input value={it.preferido} onChange={e => setCatItem(f.id, { preferido: e.target.value })} placeholder="ej. Leather" className={`w-36 ${sel}`} />
                                ) : <span className="text-slate-300">—</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setCatOpen(false)} className={btnGhost}>Cancelar</button>
              <button onClick={guardarCatalogo} disabled={catSaving} className={btnDark}>{catSaving ? 'Guardando…' : 'Guardar catálogo'}</button>
            </div>
          </div>
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