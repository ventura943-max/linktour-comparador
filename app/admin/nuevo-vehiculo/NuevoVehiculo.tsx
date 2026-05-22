'use client'
import { useState, useEffect } from 'react'
import { supabase, uploadImage } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

export default function NuevoVehiculo() {
  const router = useRouter()
  const params = useSearchParams()
  const modelId = params.get('id')

  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const [categories, setCategories] = useState<any[]>([])
  const [features, setFeatures] = useState<any[]>([])

  const [model, setModel] = useState({
    brand:'', name:'', version:'', price:'',
    range_wmtc:'', max_speed:'', battery:'', power:'',
    torque:'', charge_time:'', img_url:'', is_active:true, sort_order:0
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
      if (m) setModel(m)
      const { data: vals } = await supabase.from('feature_values').select('*').eq('model_id', modelId)
      if (vals) {
        const map: Record<string,string> = {}
        vals.forEach((v: any) => { map[v.feature_id] = v.value || '' })
        setValues(map)
      }
    }
  }

  function toast(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!modelId && !model.name) { toast('Guarda el vehículo primero antes de subir imagen'); return }
    setUploading(true)
    const tempId = modelId || `temp_${Date.now()}`
    const url = await uploadImage(file, tempId)
    if (url) {
      setModel({...model, img_url: url})
      toast('Imagen subida ✓')
    } else {
      toast('Error al subir imagen')
    }
    setUploading(false)
  }

  async function save() {
    if (!model.brand || !model.name) { toast('Marca y modelo son obligatorios'); return }
    setLoading(true)
    let mid = modelId
    if (modelId) {
      await supabase.from('models').update(model).eq('id', modelId)
    } else {
      const { data } = await supabase.from('models').insert(model).select().single()
      mid = data?.id
    }
    if (mid) {
      const upserts = Object.entries(values)
        .filter(([, v]) => v !== '')
        .map(([feature_id, value]) => ({ feature_id, model_id: mid, value }))
      if (upserts.length > 0) {
        await supabase.from('feature_values').upsert(upserts, { onConflict: 'feature_id,model_id' })
      }
    }
    toast('Guardado ✓')
    setLoading(false)
    setTimeout(() => router.push('/admin'), 1200)
  }

  const ic = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
  const lc = "block text-xs font-bold text-slate-500 uppercase mb-1"

  return (
    <div className="min-h-screen bg-slate-100">
      {msg && <div className="fixed top-4 right-4 bg-[#081224] text-white px-5 py-3 rounded-full text-sm font-bold shadow-lg z-50">{msg}</div>}

      <header className="bg-[#071225] text-white px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <div className="font-black text-xl tracking-widest">LIUX</div>
          <div className="text-[9px] tracking-[.3em] text-slate-400">{modelId ? 'EDITAR VEHÍCULO' : 'NUEVO VEHÍCULO'}</div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.push('/admin')} className="text-sm text-slate-300 hover:text-white px-4 py-2 rounded-lg hover:bg-white/10">← Volver</button>
          <button onClick={save} disabled={loading} className="text-sm bg-white text-[#081224] font-bold px-6 py-2 rounded-lg hover:bg-slate-100 disabled:opacity-50">
            {loading ? 'Guardando...' : 'Guardar vehículo'}
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-6">

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-black text-base mb-4 text-slate-700 uppercase tracking-wider">Identificación</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div><label className={lc}>Marca</label><input className={ic} value={model.brand} onChange={e => setModel({...model, brand:e.target.value})} placeholder="ej. LIUX" /></div>
            <div><label className={lc}>Modelo</label><input className={ic} value={model.name} onChange={e => setModel({...model, name:e.target.value})} placeholder="ej. BIG" /></div>
            <div><label className={lc}>Versión</label><input className={ic} value={model.version} onChange={e => setModel({...model, version:e.target.value})} placeholder="ej. 15" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className={lc}>Precio</label><input className={ic} value={model.price} onChange={e => setModel({...model, price:e.target.value})} placeholder="ej. 16.450 €" /></div>
          </div>

          {/* IMAGE UPLOAD */}
          <div className="mb-4">
            <label className={lc}>Imagen del vehículo</label>
            <div className="flex items-center gap-4">
              <div className="w-32 h-24 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden">
                {model.img_url
                  ? <img src={model.img_url} alt="preview" className="max-w-full max-h-full object-contain" />
                  : <span className="text-xs text-slate-400">Sin imagen</span>
                }
              </div>
              <div className="flex-1">
                <label className="block w-full cursor-pointer">
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-blue-300 hover:bg-blue-50 transition">
                    <div className="text-sm font-bold text-slate-600">
                      {uploading ? 'Subiendo...' : '📁 Seleccionar imagen'}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">JPG, PNG, WebP</div>
                  </div>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
                </label>
                {model.img_url && (
                  <button onClick={() => setModel({...model, img_url:''})}
                    className="mt-2 text-xs text-red-500 hover:text-red-700">✕ Eliminar imagen</button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" checked={model.is_active} onChange={e => setModel({...model, is_active:e.target.checked})} />
            <label htmlFor="active" className="text-sm text-slate-600">Visible en el comparador</label>
          </div>
        </div>

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
  )
}