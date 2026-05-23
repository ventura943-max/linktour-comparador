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
      }
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
      await supabase.from('models').update(modelData).eq('id', modelId)
    } else {
      const { data } = await supabase.from('models').insert(modelData).select().single()
      mid = data?.id
    }

    if (mid) {
      const upserts = Object.entries(values).filter(([, v]) => v !== '').map(([feature_id, value]) => ({ feature_id, model_id: mid, value }))
      if (upserts.length > 0) await supabase.from('feature_values').upsert(upserts, { onConflict: 'feature_id,model_id' })
    }

    toast('Guardado ✓')
    setLoading(false)
    setTimeout(() => router.push('/'), 1200)
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
            <button onClick={() => router.push('/')} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">← Volver</button>
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