'use client'
import { useState, useEffect, useMemo } from 'react'
import { Lang } from '@/lib/i18n'
import { parseBrand } from '@/lib/brand'
import { exportarFichaPDF } from '@/lib/exportFichaPdf'

// Textos propios de la ficha en los tres idiomas de la web
const T: Record<Lang, Record<string, string>> = {
  es: { volver: 'Volver', editar: 'Editar', pdf: 'PDF', datosClave: 'Datos clave', notas: 'Argumentario y notas', fichaTecnica: 'Ficha técnica', fuentes: 'Fuentes de datos', mercado: 'Mercado', segmento: 'Segmento', precio: 'Precio', galeria: 'Galería', mostrarTodo: 'Mostrar características sin dato', sinImagen: 'Sin imagen', generando: 'Generando…', sinDatos: 'Sin datos', consulta: 'Ficha de catálogo' },
  en: { volver: 'Back', editar: 'Edit', pdf: 'PDF', datosClave: 'Key figures', notas: 'Sales notes', fichaTecnica: 'Technical sheet', fuentes: 'Data sources', mercado: 'Market', segmento: 'Segment', precio: 'Price', galeria: 'Gallery', mostrarTodo: 'Show features without data', sinImagen: 'No image', generando: 'Generating…', sinDatos: 'No data', consulta: 'Catalogue sheet' },
  it: { volver: 'Indietro', editar: 'Modifica', pdf: 'PDF', datosClave: 'Dati chiave', notas: 'Argomentario e note', fichaTecnica: 'Scheda tecnica', fuentes: 'Fonti dei dati', mercado: 'Mercato', segmento: 'Segmento', precio: 'Prezzo', galeria: 'Galleria', mostrarTodo: 'Mostra caratteristiche senza dato', sinImagen: 'Nessuna immagine', generando: 'Generazione…', sinDatos: 'Nessun dato', consulta: 'Scheda catalogo' },
}
const LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: 'es', flag: '🇪🇸', label: 'ES' }, { code: 'en', flag: '🇬🇧', label: 'EN' }, { code: 'it', flag: '🇮🇹', label: 'IT' },
]
function getName(item: any, lang: Lang) {
  if (lang === 'es' && item.name_es) return item.name_es
  if (lang === 'it' && item.name_it) return item.name_it
  return item.name
}
async function imageToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url); if (!res.ok) return null
    const bitmap = await createImageBitmap(await res.blob())
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height
    const ctx = canvas.getContext('2d'); if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0); return canvas.toDataURL('image/png')
  } catch { return null }
}

export default function FichaModelo({ model, categories, features, values, sources, cardFields, role }: any) {
  const isAdmin = role !== 'viewer'
  // Idioma: el mismo que el resto de la web (guardado en el navegador)
  const [lang, setLang] = useState<Lang>('es')
  useEffect(() => { try { const l = localStorage.getItem('liux_lang'); if (l === 'es' || l === 'en' || l === 'it') setLang(l) } catch {} }, [])
  function changeLang(l: Lang) { setLang(l); try { localStorage.setItem('liux_lang', l) } catch {} }
  const t = T[lang]

  const [showAll, setShowAll] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const { brand, marketLabel } = parseBrand(model.brand)
  const nombre = `${model.name} ${model.version || ''}`.trim()

  function val(featId: string): string {
    const v = values.find((v: any) => v.feature_id === featId)
    return v && v.value !== null && v.value !== undefined ? String(v.value) : ''
  }
  function specVal(featName: string): string {
    const f = features.find((f: any) => f.name === featName); return f ? val(f.id) : ''
  }
  const hasData = (v: string) => v.trim() !== '' && v.trim() !== '—'
  const display = (v: string) => { const lo = v.toLowerCase().trim(); if (lo === 'yes') return '✓'; if (lo === 'no') return '✗'; return hasData(v) ? v : '—' }

  const segmentFeat = features.find((f: any) => f.name === 'Segment')
  const segmento = segmentFeat ? val(segmentFeat.id) : ''
  const precio = model.price ? String(model.price).replace(/€/g, '').trim() + ' €' : ''

  const claves = useMemo(() =>
    (cardFields || []).filter((f: any) => f.enabled).sort((a: any, b: any) => a.order - b.order)
      .map((f: any) => ({ label: f.label, value: display(specVal(f.feature_name)) }))
  , [cardFields, values, features])

  // Ficha técnica: categorías con sus características (solo con dato salvo "mostrar todo")
  const secciones = useMemo(() =>
    categories.map((cat: any) => ({
      cat,
      filas: features.filter((f: any) => f.category_id === cat.id && (showAll || hasData(val(f.id)))),
    })).filter((s: any) => s.filas.length > 0)
  , [categories, features, values, showAll])

  const galeria: string[] = (model.gallery || []).filter((u: string) => u && u.startsWith('http'))
  const isPdf = (u: string) => /\.pdf($|\?)/i.test(u)

  async function exportPDF() {
    setExporting(true)
    try {
      exportarFichaPDF({
        marca: brand, mercado: marketLabel, modelo: model.name, version: model.version || '',
        segmento, precio,
        imgDataUrl: model.img_url ? await imageToDataUrl(model.img_url) : null,
        claves, notas: model.notes || '',
        categorias: secciones.map((s: any) => ({ nombre: getName(s.cat, lang), filas: s.filas.map((f: any) => ({ caracteristica: getName(f, lang), valor: display(val(f.id)) })) })),
        fuentes: sources.map((s: any) => ({ label: s.label || s.url, url: s.url, esPdf: isPdf(s.url) })),
        fecha: new Date().toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'it' ? 'it-IT' : 'es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
        textos: { fichaTecnica: t.fichaTecnica, datosClave: t.datosClave, notas: t.notas, fuentes: t.fuentes, mercado: t.mercado, segmento: t.segmento, precio: t.precio },
      })
    } finally { setExporting(false) }
  }

  const valCls = (v: string) => { const lo = v.toLowerCase().trim(); if (lo === 'yes') return 'bg-emerald-50 text-emerald-700'; if (lo === 'no') return 'bg-red-50 text-red-600'; if (!hasData(v) || lo === 'n/a') return 'text-slate-300'; return 'text-slate-900' }

  return (
    <div className="min-h-screen bg-[#f3f6fa]">
      {/* BARRA SUPERIOR */}
      <div className="sticky top-0 z-20 bg-[#071225] text-white">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-slate-300 hover:text-white whitespace-nowrap">← {t.volver}</a>
            <div className="hidden md:block">
              <div className="font-black text-base tracking-widest leading-none">LIUX</div>
              <div className="text-[8px] tracking-[.3em] text-slate-400">{t.consulta.toUpperCase()}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 mr-2">
              {LANGS.map(l => (
                <button key={l.code} onClick={() => changeLang(l.code)} className={`px-2 py-1 rounded-lg text-xs font-bold transition ${lang === l.code ? 'bg-white/20 text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>{l.flag} {l.label}</button>
              ))}
            </div>
            {isAdmin && <a href={`/admin/nuevo-vehiculo?id=${model.id}`} className="px-3 py-2 text-xs font-bold rounded-full border border-white/20 hover:bg-white/10 transition">✏ {t.editar}</a>}
            <button onClick={exportPDF} disabled={exporting} className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-full transition disabled:opacity-50">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {exporting ? t.generando : t.pdf}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        {/* CABECERA DE CATÁLOGO */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-5">
            <div className="md:col-span-2 bg-slate-50 flex items-center justify-center p-6 min-h-[260px] cursor-zoom-in" onClick={() => model.img_url && setLightbox(model.img_url)}>
              {model.img_url ? <img src={model.img_url} alt={nombre} className="max-h-72 max-w-full object-contain drop-shadow-md" /> : <span className="text-sm text-slate-400">{t.sinImagen}</span>}
            </div>
            <div className="md:col-span-3 p-6 md:p-8">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-black tracking-[.2em] text-blue-600 uppercase">{brand}</span>
                {marketLabel && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{t.mercado}: {marketLabel}</span>}
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 leading-none mb-3">{model.name} <span className="text-slate-400 font-bold">{model.version}</span></h1>
              <div className="flex flex-wrap items-center gap-2 mb-5 text-sm">
                {segmento && <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-xs">{t.segmento} {segmento}</span>}
                {precio && <span className="px-2.5 py-1 rounded-full bg-[#081224] text-white font-bold text-xs">{t.precio} {precio}</span>}
              </div>
              {claves.length > 0 && (
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">{t.datosClave}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {claves.map((k: any) => (
                      <div key={k.label} className="border border-slate-100 rounded-xl px-3 py-2 bg-slate-50/60">
                        <div className="text-[10px] text-slate-500 truncate">{k.label}</div>
                        <div className={`text-base font-black ${k.value === '—' ? 'text-slate-300' : 'text-slate-900'}`}>{k.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* GALERÍA */}
        {galeria.length > 0 && (
          <section>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">{t.galeria}</div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {galeria.map((u, i) => (
                <button key={i} onClick={() => setLightbox(u)} className="w-40 h-28 shrink-0 rounded-xl overflow-hidden border border-slate-200 bg-white hover:ring-2 hover:ring-blue-300 transition">
                  <img src={u} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* NOTAS */}
        {model.notes && model.notes.trim() && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">{t.notas}</div>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{model.notes}</p>
          </section>
        )}

        {/* FICHA TÉCNICA */}
        <section>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-xl font-black tracking-tight">{t.fichaTecnica}</h2>
            <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
              <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> {t.mostrarTodo}
            </label>
          </div>
          {secciones.length === 0 && <div className="text-sm text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">{t.sinDatos}</div>}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {secciones.map((s: any) => (
              <div key={s.cat.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-[#081224] px-4 py-2 text-white text-[11px] font-black uppercase tracking-wider">{getName(s.cat, lang)}</div>
                <dl>
                  {s.filas.map((f: any, i: number) => {
                    const v = val(f.id)
                    return (
                      <div key={f.id} className={`flex items-center justify-between gap-3 px-4 py-2 text-sm ${i % 2 ? 'bg-slate-50/60' : ''}`}>
                        <dt className="text-slate-600 min-w-0 truncate" title={getName(f, lang)}>{getName(f, lang)}</dt>
                        <dd className={`shrink-0 font-bold text-right px-2 py-0.5 rounded-md ${valCls(v)}`} title={v}>{display(v)}</dd>
                      </div>
                    )
                  })}
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* FUENTES */}
        {sources.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">{t.fuentes}</div>
            <ul className="space-y-2">
              {sources.map((s: any) => (
                <li key={s.id}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-2 text-sm text-slate-600 hover:text-blue-600 transition">
                    <span className={`mt-0.5 shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded ${isPdf(s.url) ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>{isPdf(s.url) ? 'PDF' : 'WEB'}</span>
                    <span className="min-w-0"><span className="block font-medium group-hover:underline">{s.label || s.url}</span>{s.label && <span className="block text-[11px] text-slate-400 truncate">{s.url}</span>}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {/* LIGHTBOX */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6 cursor-zoom-out" onClick={() => setLightbox(null)}>
          <img src={lightbox} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  )
}