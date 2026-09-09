'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

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
              ${(item as any).active ? 'bg-white/15 text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>
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

// Estructura de una fuente en el formulario. `id` solo existe si viene de la BD.
// `file` solo existe si es un PDF recién seleccionado pendiente de subir.
type SourceRow = {
  id?: string
  label: string
  url: string
  sort_order: number
  file?: File | null      // PDF pendiente de subir (aún no está en Storage)
  uploading?: boolean
}

export default function NuevoVehiculo() {
  const router = useRouter()
  const params = useSearchParams()
  const modelId = params.get('id')

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [categories, setCategories] = useState<any[]>([])
  const [features, setFeatures] = useState<any[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [galleryFiles, setGalleryFiles] = useState<File[]>([])
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([])

  const [model, setModel] = useState({
    brand:'', name:'', version:'', price:'',
    img_url:'', notes:'', gallery:[] as string[],
    is_active:true, sort_order:0
  })
  const [values, setValues] = useState<Record<string,string>>({})
  // Copia de los valores tal como estaban en la BD al cargar. Sirve para
  // detectar qué características se han vaciado y borrarlas al guardar.
  const [initialValues, setInitialValues] = useState<Record<string,string>>({})

  // FUENTES
  const [sources, setSources] = useState<SourceRow[]>([])
  const [deletedSourceIds, setDeletedSourceIds] = useState<string[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [c, f] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('features').select('*').order('sort_order'),
    ])
    setCategories(c.data || [])
    setFeatures(f.data || [])
    if (modelId) {
      const { data: m } = await supabase.from('models').select('*').eq('id', modelId).single()
      if (m) {
        setModel(m)
        if (m.img_url) setImagePreview(m.img_url)
        if (m.gallery?.length) setGalleryPreviews(m.gallery)
      }
      const { data: vals } = await supabase.from('feature_values').select('*').eq('model_id', modelId)
      if (vals) {
        const map: Record<string,string> = {}
        vals.forEach((v: any) => { map[v.feature_id] = v.value || '' })
        setValues(map)
        setInitialValues(map)
      }
      const { data: srcs } = await supabase.from('model_sources').select('*').eq('model_id', modelId).order('sort_order')
      if (srcs) setSources(srcs.map((s: any) => ({ id: s.id, label: s.label || '', url: s.url || '', sort_order: s.sort_order || 0 })))
    }
  }

  function toast(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function handleGallerySelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setGalleryFiles(prev => [...prev, ...files])
    setGalleryPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
  }

  function removeGalleryItem(idx: number) {
    setGalleryFiles(prev => prev.filter((_, i) => i !== idx))
    setGalleryPreviews(prev => prev.filter((_, i) => i !== idx))
    setModel(prev => ({ ...prev, gallery: (prev.gallery || []).filter((_, i) => i !== idx) }))
  }

  async function uploadFile(file: File, path: string): Promise<string | null> {
    const { error } = await supabase.storage.from('vehicles').upload(path, file, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('vehicles').getPublicUrl(path)
    return data.publicUrl
  }

  // ---------- GESTIÓN DE FUENTES ----------
  function addSource() {
    setSources(prev => [...prev, { label: '', url: '', sort_order: prev.length }])
  }
  function updateSource(idx: number, patch: Partial<SourceRow>) {
    setSources(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }
  function removeSource(idx: number) {
    setSources(prev => {
      const s = prev[idx]
      if (s.id) setDeletedSourceIds(ids => [...ids, s.id!])
      return prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sort_order: i }))
    })
  }
  function moveSource(idx: number, dir: -1 | 1) {
    setSources(prev => {
      const target = idx + dir
      if (target < 0 || target >= prev.length) return prev
      const copy = [...prev]
      ;[copy[idx], copy[target]] = [copy[target], copy[idx]]
      return copy.map((s, i) => ({ ...s, sort_order: i }))
    })
  }
  // Selección de un PDF: se guarda el File y se rellena la etiqueta con el
  // nombre del archivo si está vacía. La subida real ocurre en save().
  function handleSourcePdfSelect(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSources(prev => prev.map((s, i) => i === idx
      ? { ...s, file, url: file.name, label: s.label || file.name.replace(/\.pdf$/i, '') }
      : s))
    e.target.value = ''
  }

  async function save() {
    if (!model.brand || !model.name) { toast('Marca y modelo son obligatorios'); return }
    setLoading(true)

    let imgUrl = model.img_url
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `${model.brand}${model.name}${model.version || 'default'}${Date.now()}.${ext}`.toLowerCase().replace(/[^a-z0-9.]/g, '')
      const url = await uploadFile(imageFile, path)
      if (url) imgUrl = url
      else { toast('Error subiendo imagen principal'); setLoading(false); return }
    }

    let galleryUrls = [...(model.gallery || []).filter(u => u.startsWith('http'))]
    for (const file of galleryFiles) {
      const ext = file.name.split('.').pop()
      const path = `gallery_${model.brand}${model.name}${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`.toLowerCase().replace(/[^a-z0-9._]/g, '')
      const url = await uploadFile(file, path)
      if (url) galleryUrls.push(url)
    }

    const modelData = { ...model, img_url: imgUrl, gallery: galleryUrls }
    let mid = modelId

    if (modelId) {
      const { error } = await supabase.from('models').update(modelData).eq('id', modelId)
      if (error) { toast('Error guardando el vehículo: ' + error.message); setLoading(false); return }
    } else {
      const { data, error } = await supabase.from('models').insert(modelData).select().single()
      if (error || !data) { toast('Error creando el vehículo: ' + (error?.message || '')); setLoading(false); return }
      mid = data.id
    }

    if (mid) {
      // 1. Guardar/actualizar las características con valor
      const upserts = Object.entries(values).filter(([, v]) => v !== '').map(([feature_id, value]) => ({ feature_id, model_id: mid, value }))
      if (upserts.length > 0) {
        const { error } = await supabase.from('feature_values').upsert(upserts, { onConflict: 'feature_id,model_id' })
        if (error) { toast('Error guardando características: ' + error.message); setLoading(false); return }
      }

      // 2. Borrar las características que TENÍAN valor y ahora se han vaciado.
      //    Sin esto, un dato borrado en el formulario reaparecía al recargar,
      //    porque el upsert ignora los valores vacíos y la fila antigua persistía.
      const toDelete = Object.keys(initialValues).filter(
        (feature_id) => initialValues[feature_id] !== '' && (values[feature_id] ?? '') === ''
      )
      if (toDelete.length > 0) {
        await supabase.from('feature_values').delete().eq('model_id', mid).in('feature_id', toDelete)
      }

      // ----- Guardar fuentes -----
      // 1. Borrar las que el usuario quitó
      if (deletedSourceIds.length > 0) {
        await supabase.from('model_sources').delete().in('id', deletedSourceIds)
      }
      // 2. Subir PDFs pendientes y preparar filas
      for (let i = 0; i < sources.length; i++) {
        const s = sources[i]
        if (s.file) {
          const ext = s.file.name.split('.').pop()
          const path = `source_${model.brand}${model.name}${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`.toLowerCase().replace(/[^a-z0-9._]/g, '')
          const url = await uploadFile(s.file, path)
          if (url) { s.url = url; s.file = null }
        }
      }
      // 3. Upsert de fuentes con URL válida
      const validSources = sources.filter(s => s.url && s.url.trim() !== '' && !s.file)
      for (const s of validSources) {
        const row: any = {
          model_id: mid,
          label: s.label?.trim() || null,
          url: s.url.trim(),
          sort_order: s.sort_order,
        }
        if (s.id) row.id = s.id
        await supabase.from('model_sources').upsert(row)
      }
    }

    toast('Guardado ✓')
    setLoading(false)
    // router.refresh() obliga a Next.js a volver a pedir modelos y valores al servidor,
    // para que el Comparador vea el vehículo recién creado/editado sin necesidad de F5.
    setTimeout(() => { router.refresh(); router.push('/') }, 1200)
  }

  const ic = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
  const lc = "block text-xs font-bold text-slate-500 uppercase mb-1"

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1 ml-56">
        {msg && <div className="fixed top-4 right-4 bg-[#081224] text-white px-5 py-3 rounded-full text-sm font-bold shadow-lg z-50">{msg}</div>}
        <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
          <div>
            <h1 className="font-black text-lg">{modelId ? 'Editar vehículo' : 'Nuevo vehículo'}</h1>
            <p className="text-xs text-slate-400">Los cambios se guardan al pulsar Guardar</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { router.refresh(); router.push('/') }} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">← Volver</button>
            <button onClick={save} disabled={loading} className="px-6 py-2 bg-[#081224] text-white text-sm font-bold rounded-lg hover:bg-[#162040] disabled:opacity-50">
              {loading ? 'Guardando...' : 'Guardar vehículo'}
            </button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto p-6 space-y-6">

          {/* IDENTIFICACIÓN */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-black text-base mb-4 text-slate-700 uppercase tracking-wider">Identificación</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div><label className={lc}>Marca</label><input className={ic} value={model.brand} onChange={e => setModel({...model, brand:e.target.value})} placeholder="ej. LIUX" /></div>
              <div><label className={lc}>Modelo</label><input className={ic} value={model.name} onChange={e => setModel({...model, name:e.target.value})} placeholder="ej. BIG" /></div>
              <div><label className={lc}>Versión</label><input className={ic} value={model.version} onChange={e => setModel({...model, version:e.target.value})} placeholder="ej. 15" /></div>
            </div>
            <div className="mb-4">
              <label className={lc}>Precio</label>
              <input className={ic} value={model.price} onChange={e => setModel({...model, price:e.target.value})} placeholder="ej. 16.450 €" />
            </div>

            {/* IMAGEN PRINCIPAL */}
            <div className="mb-4">
              <label className={lc}>Imagen principal</label>
              <div className="flex items-center gap-4">
                <div className="w-36 h-24 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                  {imagePreview ? <img src={imagePreview} alt="preview" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-slate-400">Sin imagen</span>}
                </div>
                <label className="flex-1 cursor-pointer">
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-blue-300 hover:bg-blue-50 transition">
                    <div className="text-sm font-bold text-slate-600">📁 {imageFile ? imageFile.name : 'Seleccionar imagen'}</div>
                    <div className="text-xs text-slate-400 mt-1">Se sube al guardar · JPG, PNG, WebP</div>
                  </div>
                  <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                </label>
              </div>
              {imagePreview && <button onClick={() => { setImageFile(null); setImagePreview(''); setModel({...model, img_url:''}) }} className="mt-2 text-xs text-red-500 hover:text-red-700">✕ Eliminar imagen</button>}
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={model.is_active} onChange={e => setModel({...model, is_active:e.target.checked})} />
              <label htmlFor="active" className="text-sm text-slate-600">Visible en el comparador</label>
            </div>
          </div>

          {/* GALERÍA */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-black text-base mb-2 text-slate-700 uppercase tracking-wider">Galería de fotos</h2>
            <p className="text-xs text-slate-400 mb-4">Añade fotos adicionales del vehículo. La IA las usará para el análisis comparativo.</p>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3 mb-4">
              {galleryPreviews.map((url, idx) => (
                <div key={idx} className="relative group aspect-video bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
                  <img src={url} className="w-full h-full object-cover" />
                  <button onClick={() => removeGalleryItem(idx)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center">✕</button>
                </div>
              ))}
              <label className="aspect-video border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition">
                <span className="text-2xl text-slate-300">+</span>
                <span className="text-xs text-slate-400 mt-1">Añadir</span>
                <input type="file" accept="image/*" multiple onChange={handleGallerySelect} className="hidden" />
              </label>
            </div>
          </div>

          {/* NOTAS */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-black text-base mb-2 text-slate-700 uppercase tracking-wider">Notas adicionales</h2>
            <p className="text-xs text-slate-400 mb-3">Información relevante sobre el vehículo: argumentario comercial, puntos diferenciales, información del fabricante, etc. La IA usará este texto en el análisis comparativo.</p>
            <textarea
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 resize-none"
              rows={6}
              placeholder="Ej: El LIUX BIG 15 destaca por su diseño innovador y su tecnología de carga rápida. Según el fabricante, es el vehículo eléctrico urbano más eficiente de su segmento..."
              value={model.notes || ''}
              onChange={e => setModel({...model, notes:e.target.value})}
            />
          </div>

          {/* FUENTES */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-black text-base mb-2 text-slate-700 uppercase tracking-wider">Fuentes de datos</h2>
            <p className="text-xs text-slate-400 mb-4">Enlaces o PDFs de donde proceden los datos de este vehículo (ficha oficial, vídeo, artículo…). Aparecerán como enlaces clicables en el comparador y en el PDF exportado.</p>

            <div className="space-y-3">
              {sources.map((s, idx) => {
                const isPdf = !!s.file || /\.pdf($|\?)/i.test(s.url)
                return (
                  <div key={s.id || idx} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                    <div className="flex items-start gap-2">
                      {/* Botones de orden */}
                      <div className="flex flex-col gap-0.5 pt-1">
                        <button onClick={() => moveSource(idx, -1)} disabled={idx === 0}
                          className="text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs leading-none">▲</button>
                        <button onClick={() => moveSource(idx, 1)} disabled={idx === sources.length - 1}
                          className="text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs leading-none">▼</button>
                      </div>

                      <div className="flex-1 space-y-2">
                        {/* Etiqueta */}
                        <input
                          className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400"
                          value={s.label}
                          onChange={e => updateSource(idx, { label: e.target.value })}
                          placeholder="Etiqueta (ej. Ficha técnica oficial, Vídeo YouTube)"
                        />
                        {/* URL o PDF */}
                        {s.file ? (
                          <div className="flex items-center gap-2 text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                            <span className="text-red-500 font-bold text-xs">PDF</span>
                            <span className="flex-1 truncate text-slate-600">{s.file.name}</span>
                            <span className="text-[10px] text-amber-500">Se subirá al guardar</span>
                            <button onClick={() => updateSource(idx, { file: null, url: '' })} className="text-slate-400 hover:text-red-500">✕</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400"
                              value={s.url}
                              onChange={e => updateSource(idx, { url: e.target.value })}
                              placeholder="https://… (pega una URL)"
                            />
                            <span className="text-xs text-slate-400">o</span>
                            <label className="cursor-pointer whitespace-nowrap text-xs font-bold text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition">
                              📄 Subir PDF
                              <input type="file" accept="application/pdf" onChange={e => handleSourcePdfSelect(idx, e)} className="hidden" />
                            </label>
                          </div>
                        )}
                        {/* Vista previa del enlace si ya es una URL http */}
                        {!s.file && s.url.startsWith('http') && (
                          <a href={s.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 hover:underline truncate max-w-full">
                            🔗 {s.url}
                          </a>
                        )}
                      </div>

                      {/* Borrar fuente */}
                      <button onClick={() => removeSource(idx)}
                        className="text-slate-300 hover:text-red-500 transition text-sm pt-1">🗑</button>
                    </div>
                  </div>
                )
              })}
            </div>

            <button onClick={addSource}
              className="w-full mt-3 border-2 border-dashed border-slate-200 rounded-xl py-3 text-sm font-bold text-slate-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition">
              + Añadir fuente
            </button>
          </div>

          {/* CARACTERÍSTICAS */}
          {categories.map(cat => {
            const catFeats = features.filter(f => f.category_id === cat.id)
            if (!catFeats.length) return null
            return (
              <div key={cat.id} className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="font-black text-base mb-4 text-slate-700 uppercase tracking-wider">{cat.name}</h2>
                <div className="space-y-3">
                  {catFeats.map(feat => (
                    <div key={feat.id} className="grid grid-cols-2 gap-4 items-center border-b border-slate-50 pb-2">
                      <label className="text-sm text-slate-600">{feat.name}</label>
                      {feat.type === 'boolean'
                        ? <select className={ic} value={values[feat.id]||''} onChange={e => setValues({...values,[feat.id]:e.target.value})}>
                            <option value="">—</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                            <option value="N/A">N/A</option>
                          </select>
                        : <input className={ic} value={values[feat.id]||''} onChange={e => setValues({...values,[feat.id]:e.target.value})} placeholder="Valor..." />
                      }
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          <button onClick={save} disabled={loading} className="w-full bg-[#081224] text-white font-bold py-4 rounded-2xl hover:bg-[#162040] disabled:opacity-50 text-sm">
            {loading ? 'Guardando...' : '✓ Guardar vehículo completo'}
          </button>
        </div>
      </div>
    </div>
  )
}