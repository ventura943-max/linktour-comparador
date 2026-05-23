import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { model1, model2, features, values, categories, lang } = await req.json()

  const langLabels: Record<string, string> = {
    es: 'español',
    en: 'English',
    it: 'italiano'
  }

  function getVal(featId: string, modelId: string) {
    const v = values.find((v: any) => v.feature_id === featId && v.model_id === modelId)
    return v ? v.value : '—'
  }

  function buildSpecs(model: any) {
    let text = `${model.brand} ${model.name} ${model.version || ''}\n`
    if (model.price) text += `Precio: ${model.price}\n`
    categories.forEach((cat: any) => {
      const catFeats = features.filter((f: any) => f.category_id === cat.id)
      if (!catFeats.length) return
      text += `\n${cat.name}:\n`
      catFeats.forEach((feat: any) => {
        const val = getVal(feat.id, model.id)
        text += `  - ${feat.name}: ${val}\n`
      })
    })
    if (model.notes) text += `\nNotas adicionales:\n${model.notes}\n`
    return text
  }

  const specs1 = buildSpecs(model1)
  const specs2 = buildSpecs(model2)

  const prompt = `Eres un experto en análisis comercial y técnico de vehículos eléctricos compactos.

Analiza y compara estos dos vehículos eléctricos en detalle. Responde en ${langLabels[lang] || 'español'}.

=== VEHÍCULO 1 ===
${specs1}

=== VEHÍCULO 2 ===
${specs2}

Genera un informe comparativo estructurado con estas secciones exactas en formato Markdown:

## Resumen ejecutivo
(3-4 frases resumiendo la comparativa y el posicionamiento de cada vehículo)

## Análisis técnico
(Compara las especificaciones más relevantes: autonomía, potencia, batería, velocidad, carga)

## Análisis comercial
(Compara precio, equipamiento, relación calidad-precio, público objetivo)

## Puntos fuertes
### ${model1.brand} ${model1.name} ${model1.version || ''}
- punto fuerte 1
- punto fuerte 2
- ...

### ${model2.brand} ${model2.name} ${model2.version || ''}
- punto fuerte 1
- punto fuerte 2
- ...

## Puntos débiles
### ${model1.brand} ${model1.name} ${model1.version || ''}
- punto débil 1
- ...

### ${model2.brand} ${model2.name} ${model2.version || ''}
- punto débil 1
- ...

## Recomendación comercial
(¿A qué perfil de cliente le recomendarías cada vehículo? ¿Cuál tiene mejor posicionamiento?)

## Veredicto final
(Una conclusión clara y directa de máximo 2 frases)`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7
      })
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || 'OpenAI error')
    const text = data.choices[0].message.content
    return NextResponse.json({ analysis: text })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}