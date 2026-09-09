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

const C = {
  dark: [8, 18, 36] as [number, number, number],
  dark2: [28, 48, 80] as [number, number, number],
  refBg: [219, 234, 254] as [number, number, number],     // blue-100
  refText: [30, 64, 175] as [number, number, number],     // blue-800
  compBg: [30, 41, 59] as [number, number, number],
  text: [51, 65, 85] as [number, number, number],
  muted: [148, 163, 184] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  rowAlt: [248, 250, 252] as [number, number, number],
  posBg: [220, 252, 231] as [number, number, number], posFg: [4, 120, 87] as [number, number, number],
  negBg: [254, 226, 226] as [number, number, number], negFg: [185, 28, 28] as [number, number, number],
  totBg: [254, 249, 195] as [number, number, number],     // amarillo suave (como el Excel)
  catBg: [241, 245, 249] as [number, number, number],
}

export function exportarValorClientePDF(d: VCExportData) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 8
  const tableW = pageW - margin * 2
  const nComp = d.comps.length

  // Cabecera documento
  doc.setFillColor(...C.dark)
  doc.rect(0, 0, pageW, 24, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
  doc.text(d.titulo, margin, 11)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
  doc.text(`Valor Cliente · Referencia: ${nombreCorto(d.ref)}${d.tipo ? ` · ${d.tipo}` : ''}`, margin, 17.5)
  doc.text(`Generado el ${d.fecha}`, pageW - margin, 17.5, { align: 'right' })

  // ----- Resumen ejecutivo (tarjetas) -----
  let y = 30
  const gap = 3
  const cardW = Math.min(52, (tableW - gap * nComp) / (nComp + 1))
  const cardH = 26
  const drawCard = (x: number, title: string, sub: string, lines: [string, string, [number, number, number]?][], highlight = false) => {
    doc.setFillColor(...(highlight ? C.refBg : [255, 255, 255] as [number, number, number]))
    doc.setDrawColor(...C.border); doc.setLineWidth(0.25)
    doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...(highlight ? C.refText : C.muted))
    doc.text(title.toUpperCase(), x + 2.5, y + 4)
    doc.setFontSize(8.5); doc.setTextColor(...C.dark)
    doc.text(sub, x + 2.5, y + 8.5)
    let ly = y + 13.5
    lines.forEach(([l, v, color]) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...C.muted)
      doc.text(l, x + 2.5, ly)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...(color ?? C.dark))
      doc.text(v, x + cardW - 2.5, ly, { align: 'right' })
      ly += 4
    })
  }
  drawCard(margin, d.ref.marca, `${d.ref.modelo} ${d.ref.version}`.trim(), [['MSRP', fmtEur(d.ref.msrp)], ['Referencia', '—']], true)
  d.comps.forEach((c, i) => {
    const color = c.difAjustada >= 0 ? C.posFg : C.negFg
    drawCard(margin + (i + 1) * (cardW + gap), c.marca, `${c.modelo} ${c.version}`.trim(), [
      ['MSRP', fmtEur(c.msrp)],
      ['Precio ajustado', fmtEur(c.precioAjustado)],
      ['Δ ajustada vs ref.', `${fmtEur(c.difAjustada, true)} (${fmtPct(c.difAjustadaPct)})`, color],
    ])
  })
  y += cardH + 5

  // ----- Tabla -----
  const head: RowInput[] = [
    [
      { content: '', colSpan: 2, styles: { fillColor: C.dark } },
      { content: d.ref.marca, styles: { fillColor: C.refText, halign: 'center' } },
      ...d.comps.map(c => ({ content: c.marca, colSpan: 2, styles: { fillColor: C.dark2, halign: 'center' as const } })),
    ],
    [
      { content: 'Categoría', styles: { halign: 'left' } },
      { content: 'Característica', styles: { halign: 'left' } },
      { content: `${d.ref.modelo} ${d.ref.version}`.trim(), styles: { fillColor: C.refText, halign: 'center' } },
      ...d.comps.flatMap(c => [
        { content: `${c.modelo} ${c.version}`.trim(), styles: { fillColor: C.dark2, halign: 'center' as const } },
        { content: 'Ajuste €', styles: { fillColor: C.dark2, halign: 'center' as const } },
      ]),
    ],
  ]

  const body: RowInput[] = []
  const mark = (v: any, kind: string) => ({ content: v, __kind: kind }) as any

  body.push([mark('Precio', 'cat'), mark('MSRP (€)', 'lab'), mark(fmtEur(d.ref.msrp), 'ref'), ...d.comps.flatMap(c => [mark(fmtEur(c.msrp), 'val'), mark('', 'val')])])
  body.push([mark('', 'cat'), mark('Diferencia MSRP vs referencia', 'lab'), mark('', 'ref'), ...d.comps.flatMap(c => [mark(fmtEur(c.difMsrp, true), c.difMsrp >= 0 ? 'pos' : 'neg'), mark(fmtPct(c.difMsrpPct), c.difMsrp >= 0 ? 'pos' : 'neg')])])

  let lastCat = ''
  d.filas.forEach(f => {
    body.push([
      mark(f.categoria !== lastCat ? f.categoria : '', 'cat'),
      mark(f.caracteristica + (f.esAutonomia ? ` (×${d.precioKm} €/km)` : ''), 'lab'),
      mark(f.refVal, 'ref'),
      ...f.comps.flatMap(c => [
        mark(c.val, 'val'),
        mark(c.ajuste !== 0 ? fmtEur(c.ajuste, true) : '', c.ajuste > 0 ? 'pos' : c.ajuste < 0 ? 'neg' : 'val'),
      ]),
    ])
    lastCat = f.categoria
  })

  body.push([mark('Resultado', 'tot'), mark('Total ajustes equipamiento', 'tot'), mark('', 'tot'), ...d.comps.flatMap(c => [mark('', 'tot'), mark(fmtEur(c.totalAjustes, true), c.totalAjustes >= 0 ? 'totpos' : 'totneg')])])
  body.push([mark('', 'tot'), mark('Precio ajustado (€)', 'tot'), mark(fmtEur(d.ref.msrp), 'tot'), ...d.comps.flatMap(c => [mark(fmtEur(c.precioAjustado), 'totb'), mark('', 'tot')])])
  body.push([mark('', 'tot'), mark('Diferencia ajustada vs referencia', 'tot'), mark('', 'tot'), ...d.comps.flatMap(c => [mark(fmtEur(c.difAjustada, true), c.difAjustada >= 0 ? 'totpos' : 'totneg'), mark(fmtPct(c.difAjustadaPct), c.difAjustada >= 0 ? 'totpos' : 'totneg')])])

  const catW = 22, labW = 48, refW = 24
  const restW = tableW - catW - labW - refW
  const compValW = Math.max(14, (restW / nComp) * 0.58)
  const compAjW = Math.max(12, (restW / nComp) * 0.42)
  const columnStyles: any = { 0: { cellWidth: catW }, 1: { cellWidth: labW }, 2: { cellWidth: refW, halign: 'center' } }
  d.comps.forEach((_, i) => { columnStyles[3 + i * 2] = { cellWidth: compValW, halign: 'center' }; columnStyles[4 + i * 2] = { cellWidth: compAjW, halign: 'right' } })

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: 12, bottom: 12 },
    head, body,
    theme: 'grid',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: { font: 'helvetica', fontSize: 6.3, cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 }, lineColor: C.border, lineWidth: 0.12, textColor: C.text, valign: 'middle', overflow: 'linebreak' },
    headStyles: { fillColor: C.dark, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.3 },
    columnStyles,
    didParseCell: (data: CellHookData) => {
      if (data.section !== 'body') return
      const raw: any = data.cell.raw
      const kind = raw && typeof raw === 'object' ? raw.__kind : ''
      if (raw && typeof raw === 'object' && 'content' in raw) data.cell.text = [String(raw.content ?? '')]
      const s = data.cell.styles
      switch (kind) {
        case 'cat': s.fillColor = C.catBg; s.fontStyle = 'bold'; s.textColor = C.muted; break
        case 'lab': s.textColor = C.text; break
        case 'ref': s.fillColor = C.refBg; s.textColor = C.refText; s.fontStyle = 'bold'; break
        case 'pos': s.fillColor = C.posBg; s.textColor = C.posFg; s.fontStyle = 'bold'; break
        case 'neg': s.fillColor = C.negBg; s.textColor = C.negFg; s.fontStyle = 'bold'; break
        case 'tot': s.fillColor = C.totBg; s.fontStyle = 'bold'; s.textColor = C.dark; break
        case 'totb': s.fillColor = C.totBg; s.fontStyle = 'bold'; s.textColor = C.dark; s.fontSize = 7; break
        case 'totpos': s.fillColor = C.totBg; s.fontStyle = 'bold'; s.textColor = C.posFg; break
        case 'totneg': s.fillColor = C.totBg; s.fontStyle = 'bold'; s.textColor = C.negFg; break
        default: if (data.row.index % 2 === 1) s.fillColor = C.rowAlt
      }
    },
  })

  // Leyenda
  let ly = (doc as any).lastAutoTable.finalY + 5
  if (ly + 12 > pageH - 10) { doc.addPage(); ly = 15 }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.muted)
  doc.text('Ajuste > 0: la referencia tiene algo que el competidor no tiene (su precio sube para ser equivalente). Ajuste < 0: el competidor tiene algo que la referencia no tiene.', margin, ly)
  doc.text(`Precio ajustado = MSRP competidor + Σ ajustes. Autonomía: (km referencia − km competidor) × ${d.precioKm} €/km.`, margin, ly + 3.5)

  // Pie
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(...C.muted)
    doc.text(`LIUX Comparador · Valor Cliente · Página ${i} de ${n}`, pageW / 2, pageH - 5, { align: 'center' })
  }
  const safe = d.titulo.replace(/[^a-zA-Z0-9áéíóúñÑ _-]/g, '').trim().replace(/\s+/g, '_') || 'valor-cliente'
  doc.save(`valor-cliente-${safe}.pdf`)
}