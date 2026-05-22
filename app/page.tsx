export const revalidate = 0
import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { data: models } = await supabase.from('models').select('*').eq('is_active', true).order('sort_order')
  const { data: categories } = await supabase.from('categories').select('*').order('sort_order')
  const { data: features } = await supabase.from('features').select('*').order('sort_order')
  const { data: values } = await supabase.from('feature_values').select('*')

  const modelsJSON = JSON.stringify(models || [])
  const catsJSON = JSON.stringify(categories || [])
  const featsJSON = JSON.stringify(features || [])
  const valsJSON = JSON.stringify(values || [])

  return (
    <main className="min-h-screen bg-[#f3f6fa]">
      <header className="bg-[#071225] text-white px-8 py-0 flex items-center justify-between sticky top-0 z-10 shadow-lg h-16">
        <div>
          <div className="font-black text-xl tracking-widest leading-none">LIUX</div>
          <div className="text-[9px] tracking-[.3em] text-slate-400 leading-none mt-1">LINKTOUR</div>
        </div>
        <nav className="flex gap-1">
          {['Comparador','Modelos','Ficha completa'].map(n => (
            <a key={n} href={`#${n.toLowerCase().replace(' ','-')}`}
              className="text-slate-300 hover:text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-white/10 transition">{n}</a>
          ))}
          <a href="/admin" className="text-slate-300 hover:text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-white/10 transition">⚙</a>
        </nav>
      </header>

      <div id="app-root" className="w-full"
        data-models={modelsJSON}
        data-categories={catsJSON}
        data-features={featsJSON}
        data-values={valsJSON}
      />

      <script dangerouslySetInnerHTML={{ __html: `
(function(){
  const root = document.getElementById('app-root')
  const models = JSON.parse(root.dataset.models)
  const categories = JSON.parse(root.dataset.categories)
  const features = JSON.parse(root.dataset.features)
  const values = JSON.parse(root.dataset.values)

  // Group models by brand+model
  const groups = {}
  models.forEach(m => {
    const key = m.brand + ' ' + m.name
    if (!groups[key]) groups[key] = []
    groups[key].push(m)
  })

  function val(featId, modelId) {
    const v = values.find(v => v.feature_id === featId && v.model_id === modelId)
    return v ? v.value : '—'
  }

  function specVal(featName, modelId) {
    const f = features.find(f => f.name === featName)
    if (!f) return '—'
    return val(f.id, modelId)
  }

  // CARDS
  const cardsHTML = models.map(m => \`
    <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-md min-w-0">
      <div class="text-[9px] font-black tracking-widest text-blue-600 uppercase mb-0">\${m.brand} \${m.name}</div>
      <div class="font-black text-xl tracking-tight mb-3">\${m.version || m.name}</div>
      <div class="h-28 flex items-center justify-center overflow-hidden mb-3 bg-slate-50 rounded-xl">
        \${m.img_url
          ? \`<img src="\${m.img_url}" alt="\${m.name}" class="max-h-28 max-w-full object-contain" onerror="this.parentNode.innerHTML='<span class=text-xs text-slate-400>Sin imagen</span>'">\`
          : '<span class="text-xs text-slate-400">Sin imagen</span>'
        }
      </div>
      \${[
        ['Range WMTC', specVal('Driving Mileage under WMTC mode (km)', m.id)],
        ['Max speed', specVal('Maximum speed (km/h)', m.id)],
        ['Battery', specVal('Battery capacity (kWh)', m.id)],
        ['Peak power', specVal('Motor peak power (kW)', m.id)],
        ['Torque', specVal('Motor torque (Nm)', m.id)],
        ['Charge 0-100%', specVal('AC charging time 0-100% (h)', m.id)],
      ].map(([l,v]) => \`
        <div class="flex justify-between border-t border-slate-100 pt-1 gap-2">
          <span class="text-xs text-slate-500">\${l}</span>
          <span class="text-xs font-black text-slate-900">\${v}</span>
        </div>\`).join('')}
    </div>\`).join('')

  // CATEGORY PILLS
  const pillsHTML = \`<button onclick="filterCat('all')" id="pill-all" class="pill active px-4 py-2 rounded-full text-xs font-bold border border-slate-300 bg-[#081224] text-white cursor-pointer">Todo</button>\`
    + categories.map(c => \`<button onclick="filterCat('\${c.id}')" id="pill-\${c.id}" class="pill px-4 py-2 rounded-full text-xs font-bold border border-slate-200 bg-white text-slate-600 cursor-pointer hover:border-slate-400">\${c.name}</button>\`).join('')

  // TABLE HEADER
  const brandGroups = Object.entries(groups)
  const headerRow1 = brandGroups.map(([key, ms]) =>
    \`<th colspan="\${ms.length}" class="bg-[#14243a] text-[#a8c4e8] text-center py-2 text-xs font-black tracking-wider uppercase">\${key}</th>\`
  ).join('')
  const headerRow2 = models.map(m =>
    \`<th class="bg-[#081224] text-white text-center py-3 px-2 text-xs font-black min-w-[80px]">\${m.version || m.name}</th>\`
  ).join('')

  // TABLE ROWS
  let tableRows = ''
  categories.forEach((cat, ci) => {
    const catFeats = features.filter(f => f.category_id === cat.id)
    catFeats.forEach((feat, fi) => {
      const vals = models.map(m => {
        const v = val(feat.id, m.id)
        const lo = v.toLowerCase().trim()
        const cls = lo === 'yes' ? 'text-emerald-700 bg-emerald-50 font-black' : lo === 'no' ? 'text-red-600 bg-red-50 font-black' : lo === 'n/a' ? 'text-slate-400' : ''
        const display = lo === 'yes' ? '✓' : lo === 'no' ? '✗' : v
        return \`<td class="border border-slate-100 px-2 py-2 text-center text-xs \${cls} whitespace-nowrap">\${display}</td>\`
      }).join('')
      const borderTop = fi === 0 && ci > 0 ? 'border-t-2 border-slate-300' : ''
      tableRows += \`<tr class="feat-row \${borderTop}" data-cat="\${cat.id}" data-text="\${cat.name.toLowerCase()} \${feat.name.toLowerCase()}">
        <td class="border border-slate-100 px-3 py-2 text-xs font-bold text-slate-500 bg-slate-50 whitespace-nowrap">\${fi === 0 ? cat.name : ''}</td>
        <td class="border border-slate-100 px-3 py-2 text-xs text-slate-700 whitespace-nowrap">\${feat.name}</td>
        \${vals}
      </tr>\`
    })
  })

  root.innerHTML = \`
    <section id="modelos" class="px-6 py-8">
      <h1 class="text-3xl font-black tracking-tight text-center mb-1">Comparador de Modelos</h1>
      <p class="text-slate-500 text-sm text-center mb-6">Comparativa técnica y comercial</p>
      <div class="grid gap-4" style="grid-template-columns: repeat(\${models.length}, minmax(140px, 1fr))">
        \${cardsHTML}
      </div>
    </section>

    <section id="ficha-completa" class="px-6 pb-10">
      <div class="flex items-center justify-between mb-3 flex-wrap gap-3">
        <h2 class="text-2xl font-black tracking-tight">Ficha completa</h2>
        <div class="flex items-center gap-3">
          <input type="text" id="search-input" placeholder="Buscar especificación..." oninput="doSearch()"
            class="border border-slate-200 rounded-full px-4 py-2 text-sm outline-none focus:border-blue-400 min-w-[200px]">
          <span id="row-count" class="text-sm text-slate-400 whitespace-nowrap"></span>
        </div>
      </div>
      <div class="flex gap-2 flex-wrap mb-4" id="pills">\${pillsHTML}</div>
      <div class="bg-white rounded-2xl border border-slate-200 shadow-md overflow-auto">
        <table class="w-full border-collapse text-xs" id="spec-table">
          <thead>
            <tr><th colspan="2" class="bg-[#081224]"></th>\${headerRow1}</tr>
            <tr>
              <th class="bg-[#081224] text-white text-left px-3 py-3 font-black uppercase text-[10px] tracking-wider min-w-[120px]">Categoría</th>
              <th class="bg-[#081224] text-white text-left px-3 py-3 font-black uppercase text-[10px] tracking-wider min-w-[180px]">Característica</th>
              \${headerRow2}
            </tr>
          </thead>
          <tbody id="table-body">\${tableRows}</tbody>
        </table>
      </div>
      <p class="text-xs text-slate-400 text-right mt-2" id="row-count-bottom"></p>
    </section>
  \`

  updateCount()
})()

let activeCat = 'all'

function filterCat(catId) {
  activeCat = catId
  document.querySelectorAll('.pill').forEach(p => {
    p.classList.remove('bg-[#081224]','text-white','border-slate-300')
    p.classList.add('bg-white','text-slate-600','border-slate-200')
  })
  const active = document.getElementById('pill-' + catId)
  if (active) {
    active.classList.add('bg-[#081224]','text-white')
    active.classList.remove('bg-white','text-slate-600')
  }
  applyFilters()
}

function doSearch() { applyFilters() }

function applyFilters() {
  const q = (document.getElementById('search-input')?.value || '').toLowerCase()
  const rows = document.querySelectorAll('.feat-row')
  let n = 0
  rows.forEach(tr => {
    const catMatch = activeCat === 'all' || tr.dataset.cat === activeCat
    const textMatch = !q || tr.dataset.text.includes(q)
    const show = catMatch && textMatch
    tr.style.display = show ? '' : 'none'
    if (show) n++
  })
  const txt = n + ' especificaciones visibles'
  const el1 = document.getElementById('row-count')
  const el2 = document.getElementById('row-count-bottom')
  if (el1) el1.textContent = txt
  if (el2) el2.textContent = txt
}

function updateCount() { applyFilters() }
      `}} />
    </main>
  )
}