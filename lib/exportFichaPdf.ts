// lib/exportFichaPdf.ts
// Ficha de catálogo de un modelo en PDF (A4 vertical), con el mismo estilo que el
// resto de exportaciones: portada con imagen y datos clave, notas, ficha técnica
// por categorías (una categoría nunca se corta entre páginas) y fuentes clicables.

import jsPDF from 'jspdf'
import autoTable, { RowInput, CellHookData } from 'jspdf-autotable'

export interface FichaPdfData {
  marca: string
  mercado?: string            // p.ej. "Italia" (vacío si no aplica)
  modelo: string
  version: string
  segmento: string
  precio: string              // texto ya formateado ("17.450 €") o vacío
  imgDataUrl?: string | null
  claves: { label: string; value: string }[]
  notas?: string
  categorias: { nombre: string; filas: { caracteristica: string; valor: string }[] }[]
  fuentes: { label: string; url: string; esPdf?: boolean }[]
  fecha: string
  textos: { fichaTecnica: string; datosClave: string; notas: string; fuentes: string; mercado: string; segmento: string; precio: string }
}

const C = {
  dark: [8, 18, 36] as [number, number, number],
  blue: [37, 99, 235] as [number, number, number],
  text: [51, 65, 85] as [number, number, number],
  muted: [148, 163, 184] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  rowAlt: [248, 250, 252] as [number, number, number],
  catBg: [30, 41, 59] as [number, number, number],
  posBg: [220, 252, 231] as [number, number, number], posFg: [22, 163, 74] as [number, number, number],
  negBg: [254, 226, 226] as [number, number, number], negFg: [220, 38, 38] as [number, number, number],
  imgBg: [248, 250, 252] as [number, number, number],
}

const pdfSafe = (t: string) => (t || '').replace(/−/g, '-').replace(/·/g, '-').replace(/×/g, 'x')

export function exportarFichaPDF(d: FichaPdfData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentW = pageW - margin * 2

  // ---------- Banda superior ----------
  doc.setFillColor(...C.dark)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.text('LIUX COMPARADOR', margin, 9)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  doc.text(`${d.fecha}`, pageW - margin, 9, { align: 'right' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
  doc.text(pdfSafe(`${d.marca} ${d.modelo} ${d.version}`.trim()), margin, 17)

  // ---------- Portada: imagen + identidad ----------
  let y = 30
  const imgW = 82, imgH = 54
  doc.setFillColor(...C.imgBg); doc.setDrawColor(...C.border); doc.setLineWidth(0.25)
  doc.roundedRect(margin, y, imgW, imgH, 2, 2, 'FD')
  if (d.imgDataUrl) {
    try {
      const p = doc.getImageProperties(d.imgDataUrl); const r = p.width / p.height
      let w = imgW - 6, h = w / r; if (h > imgH - 6) { h = imgH - 6; w = h * r }
      doc.addImage(d.imgDataUrl, 'PNG', margin + (imgW - w) / 2, y + (imgH - h) / 2, w, h)
    } catch { /* sin imagen */ }
  }
  const infoX = margin + imgW + 8
  const infoW = contentW - imgW - 8
  let iy = y + 6
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.blue)
  doc.text(pdfSafe(d.marca.toUpperCase()), infoX, iy)
  iy += 8
  doc.setFontSize(20); doc.setTextColor(...C.dark)
  doc.text(pdfSafe(`${d.modelo} ${d.version}`.trim()), infoX, iy)
  iy += 8
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...C.text)
  const meta: string[] = []
  if (d.segmento) meta.push(`${d.textos.segmento}: ${d.segmento}`)
  if (d.mercado) meta.push(`${d.textos.mercado}: ${d.mercado}`)
  if (d.precio) meta.push(`${d.textos.precio}: ${d.precio}`)
  meta.forEach(t => { doc.text(pdfSafe(t), infoX, iy); iy += 5 })

  // Datos clave (rejilla de 2 columnas dentro del bloque derecho)
  if (d.claves.length) {
    iy += 2
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...C.muted)
    doc.text(d.textos.datosClave.toUpperCase(), infoX, iy); iy += 4
    const colW = infoW / 2
    d.claves.forEach((k, i) => {
      const cx = infoX + (i % 2) * colW
      const cy = iy + Math.floor(i / 2) * 7
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.muted)
      doc.text(pdfSafe(k.label), cx, cy)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.dark)
      doc.text(pdfSafe(k.value), cx, cy + 3.8)
    })
    iy += Math.ceil(d.claves.length / 2) * 7
  }
  y = Math.max(y + imgH, iy) + 8

  // ---------- Notas ----------
  if (d.notas && d.notas.trim()) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.muted)
    doc.text(d.textos.notas.toUpperCase(), margin, y); y += 4.5
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...C.text)
    const lines = doc.splitTextToSize(pdfSafe(d.notas.trim()), contentW)
    lines.forEach((ln: string) => {
      if (y > pageH - 20) { doc.addPage(); y = 20 }
      doc.text(ln, margin, y); y += 4.2
    })
    y += 4
  }

  // ---------- Ficha técnica por categorías ----------
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.muted)
  if (y > pageH - 30) { doc.addPage(); y = 20 }
  doc.text(d.textos.fichaTecnica.toUpperCase(), margin, y); y += 3

  for (const cat of d.categorias) {
    if (!cat.filas.length) continue
    const head: RowInput[] = [[{ content: pdfSafe(cat.nombre.toUpperCase()), colSpan: 2, styles: { fillColor: C.catBg, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left', fontSize: 8 } }]]
    const body: RowInput[] = cat.filas.map(f => [pdfSafe(f.caracteristica), f.valor])
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, top: 14, bottom: 14 },
      head, body,
      pageBreak: 'avoid', rowPageBreak: 'avoid', showHead: 'everyPage',
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 1.8, bottom: 1.8, left: 2.5, right: 2.5 }, lineColor: C.border, lineWidth: 0.15, textColor: C.text, valign: 'middle', overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: contentW * 0.55, textColor: C.blue }, 1: { cellWidth: contentW * 0.45, halign: 'center', fontStyle: 'bold' } },
      alternateRowStyles: { fillColor: C.rowAlt },
      didParseCell: (data: CellHookData) => {
        if (data.section !== 'body' || data.column.index !== 1) return
        const raw = String(data.cell.raw ?? '').trim()
        if (raw === '✓') { data.cell.styles.fillColor = C.posBg; data.cell.text = [''] }
        else if (raw === '✗') { data.cell.styles.fillColor = C.negBg; data.cell.text = [''] }
        else if (raw === '—' || raw === '') { data.cell.styles.textColor = C.muted; data.cell.text = ['-'] }
        else data.cell.text = [pdfSafe(raw)]
      },
      didDrawCell: (data: CellHookData) => {
        if (data.section !== 'body' || data.column.index !== 1) return
        const raw = String(data.cell.raw ?? '').trim()
        const cx = data.cell.x + data.cell.width / 2, cy = data.cell.y + data.cell.height / 2, s = 1.2
        doc.setLineWidth(0.45)
        if (raw === '✓') { doc.setDrawColor(...C.posFg); doc.line(cx - s, cy, cx - s * 0.25, cy + s * 0.75); doc.line(cx - s * 0.25, cy + s * 0.75, cx + s, cy - s * 0.75) }
        else if (raw === '✗') { doc.setDrawColor(...C.negFg); doc.line(cx - s * 0.8, cy - s * 0.8, cx + s * 0.8, cy + s * 0.8); doc.line(cx - s * 0.8, cy + s * 0.8, cx + s * 0.8, cy - s * 0.8) }
      },
    })
    y = (doc as any).lastAutoTable.finalY + 4
  }

  // ---------- Fuentes ----------
  if (d.fuentes.length) {
    if (y + 12 + d.fuentes.length * 5 > pageH - 14) { doc.addPage(); y = 20 }
    y += 2
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.muted)
    doc.text(d.textos.fuentes.toUpperCase(), margin, y); y += 5
    d.fuentes.forEach(f => {
      if (y > pageH - 14) { doc.addPage(); y = 20 }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5)
      if (f.esPdf) { doc.setFillColor(...C.negBg); doc.setTextColor(...C.negFg) } else { doc.setFillColor(...C.posBg); doc.setTextColor(...C.blue) }
      doc.roundedRect(margin, y - 2.6, 7, 3.4, 0.6, 0.6, 'F')
      doc.text(f.esPdf ? 'PDF' : 'WEB', margin + 3.5, y - 0.2, { align: 'center' })
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.blue)
      let t = pdfSafe(f.label || f.url); const maxW = contentW - 12
      while (t.length > 3 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1)
      if (t !== (f.label || f.url)) t += '…'
      doc.textWithLink(t, margin + 10, y, { url: f.url })
      y += 5
    })
  }

  // ---------- Pie ----------
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(...C.muted)
    doc.text(`LIUX Comparador - ${pdfSafe(`${d.marca} ${d.modelo} ${d.version}`.trim())} - ${i}/${n}`, pageW / 2, pageH - 6, { align: 'center' })
  }
  const safe = `${d.marca}-${d.modelo}-${d.version}`.replace(/[^a-zA-Z0-9áéíóúñÑ _-]/g, '').trim().replace(/\s+/g, '_')
  doc.save(`ficha-${safe || 'modelo'}.pdf`)
}