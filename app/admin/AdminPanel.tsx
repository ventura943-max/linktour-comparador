'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableModel({ model, idx, total, onEdit, onDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: model.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50 bg-white">
      <div className="flex items-center gap-3">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-2 text-slate-300 hover:text-slate-500 touch-none">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="4" r="1.5"/><circle cx="11" cy="4" r="1.5"/>
            <circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/>
            <circle cx="5" cy="12" r="1.5"/><circle cx="11" cy="12" r="1.5"/>
          </svg>
        </div>
        <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">{idx + 1}</div>
        {model.img_url
          ? <img src={model.img_url} className="w-16 h-10 object-contain rounded-lg bg-slate-50 border border-slate-100" />
          : <div className="w-16 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-400">Sin img</div>
        }
        <div>
          <div className="text-xs font-bold text-blue-600 uppercase">{model.brand}</div>
          <div className="font-bold text-sm">{model.name} {model.version && <span className="text-slate-400 font-normal">{model.version}</span>}</div>
          <div className="text-xs text-slate-400">{model.price}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${model.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
          {model.is_active ? 'Visible' : 'Oculto'}
        </span>
        <a href={`/admin/nuevo-vehiculo?id=${model.id}`} className="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-100">✏ Editar</a>
        <button onClick={() => onDelete(model.id)} className="px-3 py-1 text-xs border border-red-100 text-red-500 rounded-lg hover:bg-red-50">🗑</button>
      </div>
    </div>
  )
}

export default function AdminPanel() {
  const [tab, setTab] = useState('models')
  const [models, setModels] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [features, setFeatures] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const [catForm, setCatForm] = useState({ name:'', sort_order:0 })
  const [editCatId, setEditCatId] = useState<string|null>(null)
  const [featForm, setFeatForm] = useState({ name:'', category_id:'', type:'boolean', sort_order:0 })
  const [editFeatId, setEditFeatId] = useState<string|null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [m, c, f] = await Promise.all([
      supabase.from('models').select('*').order('sort_order'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('features').select('*').order('sort_order'),
    ])
    setModels(m.data || [])
    setCategories(c.data || [])
    setFeatures(f.data || [])
  }

  function toast(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = models.findIndex(m => m.id === active.id)
    const newIdx = models.findIndex(m => m.id === over.id)
    const newModels = arrayMove(models, oldIdx, newIdx)
    setModels(newModels)
    await Promise.all(
      newModels.map((m, i) => supabase.from('models').update({ sort_order: i }).eq('id', m.id))
    )
    toast('Orden guardado ✓')
  }

  async function deleteModel(id: string) {
    if (!confirm('¿Eliminar este modelo?')) return
    await supabase.from('models').delete().eq('id', id)
    toast('Eliminado ✓'); await loadAll()
  }

  async function saveCat() {
    if (!catForm.name) { toast('El nombre es obligatorio'); return }
    setLoading(true)
    if (editCatId) {
      await supabase.from('categories').update(catForm).eq('id', editCatId)
      toast('Categoría actualizada ✓')
    } else {
      await supabase.from('categories').insert(catForm)
      toast('Categoría añadida ✓')
    }
    setCatForm({ name:'', sort_order:0 }); setEditCatId(null)
    await loadAll(); setLoading(false)
  }

  async function deleteCat(id: string) {
    if (!confirm('¿Eliminar? También se borran sus características.')) return
    await supabase.from('categories').delete().eq('id', id)
    toast('Eliminado ✓'); await loadAll()
  }

  async function saveFeat() {
    if (!featForm.name || !featForm.category_id) { toast('Nombre y categoría son obligatorios'); return }
    setLoading(true)
    if (editFeatId) {
      await supabase.from('features').update(featForm).eq('id', editFeatId)
      toast('Característica actualizada ✓')
    } else {
      await supabase.from('features').insert(featForm)
      toast('Característica añadida ✓')
    }
    setFeatForm({ name:'', category_id:'', type:'boolean', sort_order:0 }); setEditFeatId(null)
    await loadAll(); setLoading(false)
  }

  async function deleteFeat(id: string) {
    if (!confirm('¿Eliminar esta característica?')) return
    await supabase.from('features').delete().eq('id', id)
    toast('Eliminado ✓'); await loadAll()
  }

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' })
    window.location.href = '/admin/login'
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {msg && <div className="fixed top-4 right-4 bg-[#081224] text-white px-5 py-3 rounded-full text-sm font-bold shadow-lg z-50">{msg}</div>}

      <header className="bg-[#071225] text-white px-8 py-4 flex items-center justify-between">
        <div>
          <div className="font-black text-xl tracking-widest">LIUX</div>
          <div className="text-[9px] tracking-[.3em] text-slate-400">PANEL ADMIN</div>
        </div>
        <div className="flex gap-3">
          <a href="/" className="text-sm text-slate-300 hover:text-white px-4 py-2 rounded-lg hover:bg-white/10">Ver web</a>
          <button onClick={logout} className="text-sm text-red-400 hover:text-red-300 px-4 py-2 rounded-lg hover:bg-white/10">Salir</button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4 gap-4">
          <div className="flex gap-2 border-b border-slate-200 flex-1">
            {[['models','🚗 Modelos'],['categories','📂 Categorías'],['features','📋 Características']].map(([id,label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`px-5 py-3 text-sm font-bold rounded-t-lg border-b-2 transition ${tab === id ? 'border-[#081224] text-[#081224] bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 shrink-0">
            <a href="/admin/importar" className="px-4 py-2 border border-slate-300 bg-white text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50">⬆ Importar Excel</a>
            <a href="/admin/nuevo-vehiculo" className="px-4 py-2 bg-[#081224] text-white text-sm font-bold rounded-lg hover:bg-[#162040]">+ Nuevo vehículo</a>
          </div>
        </div>

        {tab === 'models' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-lg">Vehículos ({models.length})</h2>
              <p className="text-xs text-slate-400">Arrastra ⠿ para cambiar el orden</p>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={models.map(m => m.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {models.map((m, idx) => (
                    <SortableModel key={m.id} model={m} idx={idx} total={models.length} onDelete={deleteModel} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {models.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <div className="text-4xl mb-3">🚗</div>
                <div className="font-bold mb-1">Sin vehículos todavía</div>
                <div className="text-sm">Usa <strong>+ Nuevo vehículo</strong> o <strong>Importar Excel</strong></div>
              </div>
            )}
          </div>
        )}

        {tab === 'categories' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-black text-lg mb-4">{editCatId ? 'Editar categoría' : 'Añadir categoría'}</h2>
              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                  value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})} />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Orden</label>
                <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                  value={catForm.sort_order} onChange={e => setCatForm({...catForm, sort_order: parseInt(e.target.value)})} />
              </div>
              <div className="flex gap-2">
                {editCatId && <button onClick={() => { setEditCatId(null); setCatForm({ name:'', sort_order:0 }) }}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-500">Cancelar</button>}
                <button onClick={saveCat} disabled={loading}
                  className="px-6 py-2 bg-[#081224] text-white text-sm font-bold rounded-lg hover:bg-[#162040] disabled:opacity-50">
                  {loading ? 'Guardando...' : editCatId ? 'Actualizar' : 'Añadir'}
                </button>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-black text-lg mb-4">Categorías ({categories.length})</h2>
              <div className="space-y-2">
                {categories.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50">
                    <div>
                      <div className="font-bold text-sm">{c.name}</div>
                      <div className="text-xs text-slate-400">Orden: {c.sort_order}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditCatId(c.id); setCatForm(c) }}
                        className="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-100">✏ Editar</button>
                      <button onClick={() => deleteCat(c.id)}
                        className="px-3 py-1 text-xs border border-red-100 text-red-500 rounded-lg hover:bg-red-50">🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'features' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-black text-lg mb-4">{editFeatId ? 'Editar característica' : 'Añadir característica'}</h2>
              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                  value={featForm.name} onChange={e => setFeatForm({...featForm, name: e.target.value})} />
              </div>
              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoría</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                  value={featForm.category_id} onChange={e => setFeatForm({...featForm, category_id: e.target.value})}>
                  <option value="">Selecciona...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                  value={featForm.type} onChange={e => setFeatForm({...featForm, type: e.target.value})}>
                  <option value="boolean">Sí / No</option>
                  <option value="text">Texto</option>
                  <option value="numeric">Numérico</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Orden</label>
                <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                  value={featForm.sort_order} onChange={e => setFeatForm({...featForm, sort_order: parseInt(e.target.value)})} />
              </div>
              <div className="flex gap-2">
                {editFeatId && <button onClick={() => { setEditFeatId(null); setFeatForm({ name:'', category_id:'', type:'boolean', sort_order:0 }) }}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-500">Cancelar</button>}
                <button onClick={saveFeat} disabled={loading}
                  className="px-6 py-2 bg-[#081224] text-white text-sm font-bold rounded-lg hover:bg-[#162040] disabled:opacity-50">
                  {loading ? 'Guardando...' : editFeatId ? 'Actualizar' : 'Añadir'}
                </button>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm overflow-y-auto max-h-[600px]">
              <h2 className="font-black text-lg mb-4">Características ({features.length})</h2>
              <div className="space-y-1">
                {categories.map(cat => {
                  const catFeats = features.filter(f => f.category_id === cat.id)
                  if (!catFeats.length) return null
                  return (
                    <div key={cat.id}>
                      <div className="text-xs font-black text-slate-400 uppercase tracking-wider py-2 border-b border-slate-100">{cat.name}</div>
                      {catFeats.map(f => (
                        <div key={f.id} className="flex items-center justify-between py-2 px-1 hover:bg-slate-50 rounded-lg">
                          <div>
                            <div className="text-sm font-medium">{f.name}</div>
                            <div className="text-xs text-slate-400">{f.type}</div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => { setEditFeatId(f.id); setFeatForm(f) }}
                              className="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-100">✏</button>
                            <button onClick={() => deleteFeat(f.id)}
                              className="px-3 py-1 text-xs border border-red-100 text-red-500 rounded-lg hover:bg-red-50">🗑</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}