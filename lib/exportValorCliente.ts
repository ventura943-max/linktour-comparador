// lib/exportValorCliente.ts
// Utilidades y exportación (Excel + PDF) del módulo Valor Cliente.
//
// Convención de signos del ajuste (idéntica al Excel de referencia):
//   Ajuste > 0 → la referencia (LIUX) tiene algo que el competidor NO tiene.
//                El precio del competidor SUBE para ser equivalente.
//   Ajuste < 0 → el competidor tiene algo que la referencia NO tiene.
//                El precio del competidor BAJA.
//   Precio ajustado = MSRP competidor + Σ ajustes
//   Diferencia ajustada = Precio ajustado − MSRP referencia

import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable, { RowInput, CellHookData } from 'jspdf-autotable'

// ============ TIPOS ============

export interface VCModeloResumen {
  id: string
  marca: string
  modelo: string
  version: string
  segmento: string
  msrp: number
}

export interface VCCompetidor extends VCModeloResumen {
  totalAjustes: number
  precioAjustado: number
  difMsrp: number        // MSRP comp − MSRP ref
  difMsrpPct: number     // difMsrp / MSRP ref
  difAjustada: number    // precioAjustado − MSRP ref
  difAjustadaPct: number
}

export interface VCFila {
  categoria: string
  caracteristica: string
  esAutonomia: boolean
  refVal: string
  comps: { val: string; ajuste: number }[]
}

export interface VCExportData {
  titulo: string
  tipo: string
  fecha: string
  precioKm: number
  ref: VCModeloResumen
  comps: VCCompetidor[]
  filas: VCFila[]
}

// ============ UTILIDADES ============

// Parser robusto de precios: acepta "17.450", "16.450 €", "17,5", "17990€ - 23560€" (toma el primero)
export function parsePrice(raw: any): number {
  if (raw === null || raw === undefined) return 0
  if (typeof raw === 'number') return raw
  const m = String(raw).match(/\d[\d.,\s]*/)
  if (!m) return 0
  let s = m[0].replace(/\s/g, '').replace(/[.,]$/, '')
  const hasDot = s.includes('.'), hasComma = s.includes(',')
  if (hasDot && hasComma) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (hasDot) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  } else if (hasComma) {
    if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '')
    else s = s.replace(',', '.')
  }
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

export function fmtEur(n: number, signed = false): string {
  const r = Math.round(n)
  const s = Math.abs(r).toLocaleString('es-ES')
  if (signed) return (r > 0 ? '+' : r < 0 ? '−' : '') + s + ' €'
  return (r < 0 ? '−' : '') + s + ' €'
}

export function fmtPct(p: number, signed = true): string {
  if (!isFinite(p)) return '—'
  const v = Math.round(p * 1000) / 10
  const s = Math.abs(v).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  if (signed) return (v > 0 ? '+' : v < 0 ? '−' : '') + s + ' %'
  return s + ' %'
}

function nombreCorto(m: VCModeloResumen) {
  return `${m.marca} ${m.modelo} ${m.version}`.trim()
}

// ============ EXCEL ============

export function exportarValorClienteExcel(d: VCExportData) {
  const aoa: any[][] = []
  const col = (i: number) => XLSX.utils.encode_col(i)

  // Columnas: A=Categoría, B=Característica, C=Referencia, luego pares (Valor, Ajuste)
  const refCol = 2
  const compValCol = (i: number) => 3 + i * 2
  const compAjCol = (i: number) => 4 + i * 2

  aoa.push([d.titulo, d.tipo ? `Tipo: ${d.tipo}` : '', `Generado: ${d.fecha}`])
  aoa.push([])
  // Cabeceras de modelos (4 filas: marca, modelo, versión, segmento)
  const h = (f: (m: VCModeloResumen) => string) => {
    const r: any[] = ['', '', f(d.ref)]
    d.comps.forEach(c => { r.push(f(c), '') })
    return r
  }
  aoa.push(h(m => m.marca))
  aoa.push(h(m => m.modelo))
  aoa.push(h(m => m.version))
  aoa.push(h(m => m.segmento))
  // Fila de etiquetas de columnas
  const lab: any[] = ['Categoría', 'Característica', 'Referencia']
  d.comps.forEach(() => lab.push('Valor', 'Ajuste (€)'))
  aoa.push(lab)

  // MSRP (fila con números)
  const msrpRowIdx = aoa.length
  const msrp: any[] = ['Precio', 'MSRP (€)', d.ref.msrp]
  d.comps.forEach(c => msrp.push(c.msrp, ''))
  aoa.push(msrp)
  const msrpRow = msrpRowIdx + 1 // 1-based para fórmulas

  // Diferencia MSRP (fórmulas)
  const dif: any[] = ['', 'Diferencia MSRP vs referencia (€)', '']
  d.comps.forEach((_, i) => dif.push({ t: 'n', f: `${col(compValCol(i))}${msrpRow}-$${col(refCol)}$${msrpRow}` }, ''))
  aoa.push(dif)
  const difP: any[] = ['', 'Diferencia MSRP (%)', '']
  d.comps.forEach((_, i) => difP.push({ t: 'n', f: `IF($${col(refCol)}$${msrpRow}=0,0,${col(compValCol(i))}${msrpRow + 1}/$${col(refCol)}$${msrpRow})`, z: '0.0%' }, ''))
  aoa.push(difP)

  // Filas de características
  const firstFeatRow = aoa.length + 1
  let lastCat = ''
  d.filas.forEach(f => {
    const r: any[] = [f.categoria !== lastCat ? f.categoria : '', f.caracteristica, f.refVal]
    lastCat = f.categoria
    f.comps.forEach(c => r.push(c.val, c.ajuste !== 0 ? c.ajuste : ''))
    aoa.push(r)
  })
  const lastFeatRow = aoa.length

  // Totales (fórmulas)
  const tot: any[] = ['Resultado', 'Total ajustes equipamiento (€)', '']
  d.comps.forEach((_, i) => tot.push('', { t: 'n', f: `SUM(${col(compAjCol(i))}${firstFeatRow}:${col(compAjCol(i))}${lastFeatRow})` }))
  aoa.push(tot)
  const totRow = aoa.length
  const pa: any[] = ['', 'Precio ajustado (€)', { t: 'n', f: `${col(refCol)}${msrpRow}` }]
  d.comps.forEach((_, i) => pa.push({ t: 'n', f: `${col(compValCol(i))}${msrpRow}+${col(compAjCol(i))}${totRow}` }, ''))
  aoa.push(pa)
  const paRow = aoa.length
  const da: any[] = ['', 'Diferencia ajustada vs referencia (€)', '']
  d.comps.forEach((_, i) => da.push({ t: 'n', f: `${col(compValCol(i))}${paRow}-$${col(refCol)}$${paRow}` }, ''))
  aoa.push(da)
  const daP: any[] = ['', 'Diferencia ajustada (%)', '']
  d.comps.forEach((_, i) => daP.push({ t: 'n', f: `IF($${col(refCol)}$${paRow}=0,0,${col(compValCol(i))}${paRow + 1}/$${col(refCol)}$${paRow})`, z: '0.0%' }, ''))
  aoa.push(daP)
  aoa.push([])
  aoa.push(['', `Autonomía: ajuste = (km referencia − km competidor) × ${d.precioKm} €/km`])
  aoa.push(['', 'Ajuste > 0: la referencia tiene algo que el competidor no tiene (su precio sube para ser equivalente). Ajuste < 0: el competidor tiene algo que la referencia no tiene.'])

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 16 }, ...d.comps.flatMap(() => [{ wch: 16 }, { wch: 12 }])]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Valor Cliente')
  const safe = d.titulo.replace(/[^a-zA-Z0-9áéíóúñÑ _-]/g, '').trim().replace(/\s+/g, '_') || 'valor-cliente'
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `valor-cliente-${safe}.xlsx`)
}

// ============ PDF ============
// Siempre A4 apaisado. Tamaños de letra, relleno y anchos se adaptan al número de
// competidores. Las fuentes estándar del PDF no tienen "−", "Δ", "Σ", "✓" ni "✗":
// los signos se sustituyen por equivalentes y los ✓/✗ se dibujan vectorialmente.

const C = {
  dark: [8, 18, 36] as [number, number, number],
  dark2: [28, 48, 80] as [number, number, number],
  refHead: [29, 78, 216] as [number, number, number],     // blue-700
  refBg: [232, 240, 254] as [number, number, number],     // ~blue-50
  refLine: [147, 197, 253] as [number, number, number],   // blue-300
  text: [51, 65, 85] as [number, number, number],
  muted: [148, 163, 184] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  edge: [148, 163, 184] as [number, number, number],      // separador de bloque (slate-400)
  grpAlt: [248, 250, 252] as [number, number, number],    // fondo alterno de bloque
  posBg: [220, 252, 231] as [number, number, number], posFg: [4, 120, 87] as [number, number, number],
  negBg: [254, 226, 226] as [number, number, number], negFg: [185, 28, 28] as [number, number, number],
  totBg: [255, 251, 235] as [number, number, number],     // amber-50
  totLine: [253, 230, 138] as [number, number, number],
  catBg: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
}

// Sustituye caracteres que la fuente estándar del PDF no puede dibujar
function pdfSafe(t: string): string {
  return t.replace(/−/g, '-').replace(/Δ/g, 'Dif. ').replace(/Σ/g, 'suma de').replace(/×/g, 'x').replace(/·/g, '-')
}

export function exportarValorClientePDF(d: VCExportData) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 7
  const tableW = pageW - margin * 2
  const nComp = d.comps.length

  // Escala según nº de competidores (A4 fijo)
  const fs = nComp <= 3 ? 7.2 : nComp <= 5 ? 6.4 : nComp <= 7 ? 5.7 : 5.1
  const pad = nComp <= 3 ? 1.4 : nComp <= 5 ? 1.1 : 0.85
  const catW = nComp <= 3 ? 22 : 17
  const labW = nComp <= 3 ? 48 : nComp <= 5 ? 40 : 34
  const refW = nComp <= 3 ? 26 : nComp <= 5 ? 22 : 18
  const restW = tableW - catW - labW - refW
  const compValW = (restW / nComp) * 0.58
  const compAjW = (restW / nComp) * 0.42

  // ---------- Cabecera ----------
  doc.setFillColor(...C.dark)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  doc.text(pdfSafe(d.titulo), margin, 10)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  doc.text(pdfSafe(`Valor Cliente - Referencia: ${nombreCorto(d.ref)}${d.tipo ? ` - ${d.tipo}` : ''}`), margin, 16.5)
  doc.text(`Generado el ${d.fecha}`, pageW - margin, 16.5, { align: 'right' })

  // ---------- Resumen ejecutivo (tabla compacta) ----------
  const sumFs = nComp <= 5 ? 7 : 6.2
  const sumHead: RowInput[] = [[
    { content: 'Resumen ejecutivo', styles: { fillColor: C.dark, halign: 'left' } },
    { content: `${d.ref.marca}\n${d.ref.modelo} ${d.ref.version}`.trim(), styles: { fillColor: C.refHead, halign: 'center' } },
    ...d.comps.map(c => ({ content: `${c.marca}\n${c.modelo} ${c.version}`.trim(), styles: { fillColor: C.dark2, halign: 'center' as const } })),
  ]]
  const sk = (v: string, kind: string) => ({ content: pdfSafe(v), __kind: kind }) as any
  const sumBody: RowInput[] = [
    [sk('MSRP', 'lab'), sk(fmtEur(d.ref.msrp), 'ref'), ...d.comps.map(c => sk(fmtEur(c.msrp), 'val'))],
    [sk('Diferencia MSRP vs referencia', 'lab'), sk('', 'ref'), ...d.comps.map(c => sk(`${fmtEur(c.difMsrp, true)}  (${fmtPct(c.difMsrpPct)})`, c.difMsrp >= 0 ? 'pos' : 'neg'))],
    [sk('Total ajustes equipamiento', 'lab'), sk('', 'ref'), ...d.comps.map(c => sk(fmtEur(c.totalAjustes, true), c.totalAjustes >= 0 ? 'pos' : 'neg'))],
    [sk('Precio ajustado', 'tot'), sk(fmtEur(d.ref.msrp), 'totref'), ...d.comps.map(c => sk(fmtEur(c.precioAjustado), 'totb'))],
    [sk('Diferencia ajustada vs referencia', 'tot'), sk('', 'totref'), ...d.comps.map(c => sk(`${fmtEur(c.difAjustada, true)}  (${fmtPct(c.difAjustadaPct)})`, c.difAjustada >= 0 ? 'totpos' : 'totneg'))],
  ]
  const sumLab = catW + labW
  const sumCol = (tableW - sumLab) / (nComp + 1)
  const sumColStyles: any = { 0: { cellWidth: sumLab, halign: 'left' }, 1: { cellWidth: sumCol, halign: 'center' } }
  d.comps.forEach((_, i) => { sumColStyles[2 + i] = { cellWidth: sumCol, halign: 'center' } })

  autoTable(doc, {
    startY: 27,
    margin: { left: margin, right: margin },
    head: sumHead, body: sumBody, theme: 'grid',
    styles: { font: 'helvetica', fontSize: sumFs, cellPadding: { top: 1.4, bottom: 1.4, left: 1.5, right: 1.5 }, lineColor: C.border, lineWidth: 0.12, textColor: C.text, valign: 'middle' },
    headStyles: { fillColor: C.dark, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: sumFs },
    columnStyles: sumColStyles,
    didParseCell: (data: CellHookData) => applyKind(data),
  })

  // ---------- Tabla principal ----------
  const head: RowInput[] = [
    [
      { content: '', colSpan: 2, styles: { fillColor: C.dark } },
      { content: d.ref.marca, styles: { fillColor: [30, 64, 175], halign: 'center' } },
      ...d.comps.map(c => ({ content: c.marca, colSpan: 2, styles: { fillColor: [13, 30, 58] as [number, number, number], textColor: [122, 164, 204] as [number, number, number], halign: 'center' as const } })),
    ],
    [
      { content: 'Cat.', styles: { halign: 'left' } },
      { content: 'Característica', styles: { halign: 'left' } },
      { content: `${d.ref.modelo} ${d.ref.version}`.trim() + '\nreferencia', styles: { fillColor: C.refHead, halign: 'center' } },
      ...d.comps.flatMap(c => [
        { content: `${c.modelo} ${c.version}`.trim(), styles: { fillColor: C.dark2, halign: 'center' as const } },
        { content: 'Ajuste €', styles: { fillColor: C.dark2, textColor: [168, 196, 232] as [number, number, number], halign: 'center' as const } },
      ]),
    ],
  ]

  // mark: contenido + tipo de celda + índice de bloque (para separador y fondo alterno)
  const mark = (v: any, kind: string, g = -1) => ({ content: pdfSafe(String(v ?? '')), __kind: kind, __g: g }) as any
  const valKind = (v: string) => v === '✓' ? 'yes' : v === '✗' ? 'no' : (v === '—' || v === '') ? 'empty' : 'val'

  const body: RowInput[] = []
  body.push([mark('Precio', 'catfirst'), mark('MSRP (€)', 'lab'), mark(fmtEur(d.ref.msrp), 'refb'), ...d.comps.flatMap((c, i) => [mark(fmtEur(c.msrp), 'valb', i), mark('', 'val', i)])])
  body.push([mark('', 'cat'), mark('Diferencia MSRP vs referencia', 'lab'), mark('', 'ref'), ...d.comps.flatMap((c, i) => [mark(fmtEur(c.difMsrp, true), c.difMsrp >= 0 ? 'pos' : 'neg', i), mark(fmtPct(c.difMsrpPct), c.difMsrp >= 0 ? 'pos' : 'neg', i)])])

  let lastCat = ''
  d.filas.forEach(f => {
    body.push([
      mark(f.categoria !== lastCat ? f.categoria : '', f.categoria !== lastCat ? 'catfirst' : 'cat'),
      mark(f.caracteristica + (f.esAutonomia ? ` (x${d.precioKm} €/km)` : ''), 'lab'),
      mark(f.refVal, 'ref' + (valKind(f.refVal) === 'yes' ? 'yes' : valKind(f.refVal) === 'no' ? 'no' : '')),
      ...f.comps.flatMap((c, i) => [
        mark(c.val, valKind(c.val), i),
        mark(c.ajuste !== 0 ? fmtEur(c.ajuste, true) : '', c.ajuste > 0 ? 'pos' : c.ajuste < 0 ? 'neg' : 'val', i),
      ]),
    ])
    lastCat = f.categoria
  })

  body.push([mark('Resultado', 'totcat'), mark('Total ajustes equipamiento', 'tot'), mark('', 'totref'), ...d.comps.flatMap((c, i) => [mark('', 'tot', i), mark(fmtEur(c.totalAjustes, true), c.totalAjustes >= 0 ? 'totpos' : 'totneg', i)])])
  body.push([mark('', 'totcat'), mark('Precio ajustado (€)', 'tot'), mark(fmtEur(d.ref.msrp), 'totref'), ...d.comps.flatMap((c, i) => [mark(fmtEur(c.precioAjustado), 'totb', i), mark('', 'tot', i)])])
  body.push([mark('', 'totcat'), mark('Diferencia ajustada vs referencia', 'tot'), mark('', 'totref'), ...d.comps.flatMap((c, i) => [mark(fmtEur(c.difAjustada, true), c.difAjustada >= 0 ? 'totpos' : 'totneg', i), mark(fmtPct(c.difAjustadaPct), c.difAjustada >= 0 ? 'totpos' : 'totneg', i)])])

  const columnStyles: any = { 0: { cellWidth: catW }, 1: { cellWidth: labW }, 2: { cellWidth: refW, halign: 'center' } }
  d.comps.forEach((_, i) => { columnStyles[3 + i * 2] = { cellWidth: compValW, halign: 'center' }; columnStyles[4 + i * 2] = { cellWidth: compAjW, halign: 'center' } })

  function applyKind(data: CellHookData) {
    if (data.section !== 'body') return
    const raw: any = data.cell.raw
    if (!raw || typeof raw !== 'object') return
    data.cell.text = [String(raw.content ?? '')]
    const kind: string = raw.__kind || ''
    const g: number = raw.__g ?? -1
    const s = data.cell.styles
    const alt = g >= 0 && g % 2 === 1
    switch (kind) {
      case 'cat': s.fillColor = C.catBg; s.textColor = C.muted; s.fontStyle = 'bold'; break
      case 'catfirst': s.fillColor = C.catBg; s.textColor = C.text; s.fontStyle = 'bold'; break
      case 'lab': s.textColor = C.text; break
      case 'ref': case 'refyes': case 'refno': s.fillColor = C.refBg; s.textColor = C.text; if (kind !== 'ref') data.cell.text = ['']; break
      case 'refb': s.fillColor = C.refBg; s.textColor = [30, 58, 138]; s.fontStyle = 'bold'; break
      case 'val': s.fillColor = alt ? C.grpAlt : C.white; s.textColor = C.text; break
      case 'valb': s.fillColor = alt ? C.grpAlt : C.white; s.textColor = C.text; s.fontStyle = 'bold'; break
      case 'empty': s.fillColor = alt ? C.grpAlt : C.white; s.textColor = C.muted; data.cell.text = ['-']; break
      case 'yes': s.fillColor = C.posBg; data.cell.text = ['']; break
      case 'no': s.fillColor = C.negBg; data.cell.text = ['']; break
      case 'pos': s.fillColor = C.posBg; s.textColor = C.posFg; s.fontStyle = 'bold'; break
      case 'neg': s.fillColor = C.negBg; s.textColor = C.negFg; s.fontStyle = 'bold'; break
      case 'tot': case 'totcat': s.fillColor = C.totBg; s.fontStyle = 'bold'; s.textColor = kind === 'totcat' ? [180, 83, 9] : C.dark; break
      case 'totref': s.fillColor = C.refBg; s.fontStyle = 'bold'; s.textColor = [30, 58, 138]; break
      case 'totb': s.fillColor = C.totBg; s.fontStyle = 'bold'; s.textColor = C.dark; s.fontSize = (s.fontSize || fs) + 0.8; break
      case 'totpos': s.fillColor = C.totBg; s.fontStyle = 'bold'; s.textColor = C.posFg; break
      case 'totneg': s.fillColor = C.totBg; s.fontStyle = 'bold'; s.textColor = C.negFg; break
    }
  }

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 5,
    margin: { left: margin, right: margin, top: 10, bottom: 10 },
    head, body,
    theme: 'grid',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: { font: 'helvetica', fontSize: fs, cellPadding: { top: pad, bottom: pad, left: 1.2, right: 1.2 }, lineColor: C.border, lineWidth: 0.12, textColor: C.text, valign: 'middle', overflow: 'linebreak' },
    headStyles: { fillColor: C.dark, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: fs },
    columnStyles,
    didParseCell: (data: CellHookData) => applyKind(data),
    didDrawCell: (data: CellHookData) => {
      const raw: any = data.cell.raw
      const kind: string = raw && typeof raw === 'object' ? raw.__kind || '' : ''
      const x = data.cell.x, y = data.cell.y, w = data.cell.width, h = data.cell.height
      // Separador de bloque: línea gruesa a la izquierda de la 1ª columna de cada competidor y de la referencia
      const col = data.column.index
      if (data.section === 'body' && col >= 2 && (col === 2 || (col - 3) % 2 === 0)) {
        doc.setDrawColor(...(col === 2 ? C.refLine : C.edge)); doc.setLineWidth(col === 2 ? 0.5 : 0.45)
        doc.line(x, y, x, y + h)
        if (col === 2) doc.line(x + w, y, x + w, y + h)
      }
      // ✓ / ✗ vectoriales
      if (kind === 'yes' || kind === 'refyes' || kind === 'no' || kind === 'refno') {
        const cx = x + w / 2, cy = y + h / 2, sz = Math.min(1.1, h * 0.28)
        doc.setLineWidth(0.4)
        if (kind.endsWith('yes')) {
          doc.setDrawColor(...C.posFg)
          doc.line(cx - sz, cy, cx - sz * 0.25, cy + sz * 0.75)
          doc.line(cx - sz * 0.25, cy + sz * 0.75, cx + sz, cy - sz * 0.75)
        } else {
          doc.setDrawColor(...C.negFg)
          doc.line(cx - sz * 0.8, cy - sz * 0.8, cx + sz * 0.8, cy + sz * 0.8)
          doc.line(cx - sz * 0.8, cy + sz * 0.8, cx + sz * 0.8, cy - sz * 0.8)
        }
      }
    },
  })

  // ---------- Leyenda ----------
  let ly = (doc as any).lastAutoTable.finalY + 4
  if (ly + 9 > pageH - 8) { doc.addPage(); ly = 14 }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.3); doc.setTextColor(...C.muted)
  doc.text('Ajuste > 0: la referencia tiene algo que el competidor no tiene (su precio sube para ser equivalente). Ajuste < 0: el competidor tiene algo que la referencia no tiene.', margin, ly)
  doc.text(`Precio ajustado = MSRP competidor + suma de ajustes. Autonomía: (km referencia - km competidor) x ${d.precioKm} €/km.`, margin, ly + 3.3)

  // ---------- Pie ----------
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(6.5); doc.setTextColor(...C.muted)
    doc.text(`LIUX Comparador - Valor Cliente - Página ${i} de ${n}`, pageW / 2, pageH - 4, { align: 'center' })
  }
  const safe = d.titulo.replace(/[^a-zA-Z0-9áéíóúñÑ _-]/g, '').trim().replace(/\s+/g, '_') || 'valor-cliente'
  doc.save(`valor-cliente-${safe}.pdf`)
}