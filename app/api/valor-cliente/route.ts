import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { model1, model2, ajustes, precioBase, ajusteTotal, precioEstimado, lang } = await req.json()

  const langLabels: Record<string, string> = { es: 'español', en: 'English', it: 'italiano' }

  const ventajasM1 = ajustes.filter((a: any) => a.ajuste > 0)
  const ventajasM2 = ajustes.filter((a: any) => a.ajuste < 0)

  const prompt = `Eres un experto en argumentación comercial de vehículos eléctricos compactos del segmento L7e.

Tienes que redactar un argumento comercial profesional basado en el siguiente análisis de Valor Cliente.
Responde en ${langLabels[lang] || 'español'}.

=== DATOS ===
Vehículo propio: ${model1.brand} ${model1.name} ${model1.version || ''} — Precio: ${precioBase}€
Vehículo competidor: ${model2.brand} ${model2.name} ${model2.version || ''} — Precio desconocido

=== VENTAJAS del ${model1.brand} ${model1.version} sobre el competidor (suman valor) ===
${ventajasM1.map((a: any) => `- ${a.caracteristica}: ${a.valor_m1} vs ${a.valor_m2} → +${a.ajuste}€`).join('\n') || 'Ninguna'}

=== VENTAJAS del competidor ${model2.brand} ${model2.version} sobre el ${model1.brand} (restan valor) ===
${ventajasM2.map((a: any) => `- ${a.caracteristica}: ${a.valor_m1} vs ${a.valor_m2} → ${a.ajuste}€`).join('\n') || 'Ninguna'}

=== RESULTADO ===
Ajuste neto: ${ajusteTotal >= 0 ? '+' : ''}${ajusteTotal}€ ${ajusteTotal >= 0 ? 'a favor del LIUX' : 'a favor del competidor'}
Precio estimado justo del competidor: ${precioEstimado}€

Genera un informe con estas secciones en formato Markdown:

## Resumen ejecutivo
(2-3 frases que resuman la posición competitiva del ${model1.brand} ${model1.version})

## Ventajas competitivas del ${model1.brand} ${model1.version}
(Explica en lenguaje comercial las ventajas en equipamiento y prestaciones que justifican el precio)

## Puntos donde el competidor supera al ${model1.brand}
(Reconoce honestamente los puntos donde el competidor tiene ventaja, minimizando su impacto)

## Argumento de precio
(El argumento clave: basándose en el análisis de valor, el precio estimado justo del ${model2.brand} ${model2.version} sería ${precioEstimado}€. Si se vende por menos, el LIUX es la mejor opción en valor)

## Argumentario para el comercial
(3-4 frases cortas y directas que el comercial puede usar en la presentación al cliente)`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 1500, temperature: 0.7 })
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || 'OpenAI error')
    return NextResponse.json({ analysis: data.choices[0].message.content })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}