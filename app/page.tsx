export const revalidate = 0
import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { data: models } = await supabase
    .from('models')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')

  const { data: features } = await supabase
    .from('features')
    .select('*')
    .order('sort_order')

  const { data: values } = await supabase
    .from('feature_values')
    .select('*')

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="bg-[#071225] text-white px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-lg">
        <div>
          <div className="font-black text-xl tracking-widest">LIUX</div>
          <div className="text-[9px] tracking-[.3em] text-slate-400">COMPARADOR</div>
        </div>
        <nav className="flex gap-4 text-sm font-semibold text-slate-300">
          <a href="#modelos" className="hover:text-white">Modelos</a>
          <a href="#comparativa" className="hover:text-white">Comparativa</a>
        </nav>
      </header>

      <section className="text-center py-10 px-4">
        <h1 className="text-3xl font-black tracking-tight mb-2">Comparador de Modelos</h1>
        <p className="text-slate-500 text-sm">Comparativa técnica y comercial</p>
      </section>

      <section id="modelos" className="px-6 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 max-w-screen-xl mx-auto">
          {models?.map(model => (
            <div key={model.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-md">
              <div className="text-[9px] font-black tracking-widest text-blue-600 uppercase mb-1">{model.brand}</div>
              <div className="font-black text-lg mb-3">{model.name}</div>
              {model.img_url
                ? <img src={model.img_url} alt={model.name} className="h-24 object-contain mx-auto mb-3" />
                : <div className="h-24 bg-slate-100 rounded-lg mb-3 flex items-center justify-center text-xs text-slate-400">Sin imagen</div>
              }
              <div className="space-y-1 text-xs">
                {[
                  ['Precio', model.price],
                  ['Autonomía', model.range_wmtc],
                  ['Vel. máx.', model.max_speed],
                  ['Batería', model.battery],
                  ['Potencia', model.power],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between border-t border-slate-100 pt-1">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-bold">{val || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {(!models || models.length === 0) && (
            <div className="col-span-full text-center text-slate-400 py-10">
              No hay modelos todavía. Añádelos desde el panel de administración.
            </div>
          )}
        </div>
      </section>

      <section id="comparativa" className="px-4 pb-10">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#081224] text-white">
                <th className="text-left p-3 font-bold">Categoría</th>
                <th className="text-left p-3 font-bold">Característica</th>
                {models?.map(m => (
                  <th key={m.id} className="p-3 font-bold text-center">{m.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories?.map(cat => {
                const catFeatures = features?.filter(f => f.category_id === cat.id) || []
                return catFeatures.map((feat, fi) => (
                  <tr key={feat.id} className={`border-t ${fi === 0 ? 'border-t-2 border-slate-300' : 'border-slate-100'} hover:bg-slate-50`}>
                    <td className="p-3 font-bold text-slate-600 bg-slate-50">{fi === 0 ? cat.name : ''}</td>
                    <td className="p-3 text-slate-700">{feat.name}</td>
                    {models?.map(m => {
                      const val = values?.find(v => v.feature_id === feat.id && v.model_id === m.id)?.value || '—'
                      const isYes = val.toLowerCase() === 'yes'
                      const isNo = val.toLowerCase() === 'no'
                      return (
                        <td key={m.id} className={`p-3 text-center font-bold ${isYes ? 'text-emerald-600 bg-emerald-50' : isNo ? 'text-red-600 bg-red-50' : ''}`}>
                          {isYes ? '✓' : isNo ? '✗' : val}
                        </td>
                      )
                    })}
                  </tr>
                ))
              })}
              {(!categories || categories.length === 0) && (
                <tr>
                  <td colSpan={100} className="text-center text-slate-400 py-10">
                    Sin datos. Añade modelos y características desde el panel admin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}