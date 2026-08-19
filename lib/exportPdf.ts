// lib/exportPdf.ts (v2)
// Exportación a PDF del Comparador LIUX
// - PDF vectorial (texto real, no imagen)
// - Cards de los vehículos comparados en la cabecera (imagen + specs)
// - Una tabla por categoría con pageBreak: 'avoid' => una categoría nunca se corta
//   entre páginas (salvo que ocupe más de una página completa, en cuyo caso
//   repite cabeceras en la continuación)
// - Símbolos ✓ / ✗ dibujados vectorialmente con los colores de la web

import jsPDF from 'jspdf';
import autoTable, { RowInput, CellHookData } from 'jspdf-autotable';

// ============ TIPOS DE ENTRADA ============

export interface PdfModelSpec {
  label: string;            // p.ej. "Autonomía WMTC"
  value: string;            // p.ej. "270"
}

export interface PdfFuente {
  label: string;            // etiqueta legible (o la propia URL si no hay etiqueta)
  url: string;              // enlace clicable
  esPdf?: boolean;          // para pintar la insignia PDF/WEB
}

export interface PdfModelo {
  marca: string;            // p.ej. "LIUX"
  modelo: string;           // p.ej. "BIG"
  version: string;          // p.ej. "20"
  imgDataUrl?: string | null; // imagen en base64 (data URL PNG/JPEG), opcional
  specs?: PdfModelSpec[];   // campos de la card (los mismos que la web)
  fuentes?: PdfFuente[];    // fuentes de datos (enlaces clicables)
}

export interface PdfFila {
  caracteristica: string;   // p.ej. "Autonomía WMTC (km)"
  valores: string[];        // un valor por modelo, en el mismo orden.
                            // Usa "✓", "✗", "—" o texto/número libre
}

export interface PdfCategoria {
  nombre: string;           // p.ej. "Dimensiones y peso"
  filas: PdfFila[];
}

// ============ PALETA (idéntica a la web / Tailwind) ============

const COLOR = {
  headerBg: [15, 23, 42] as [number, number, number],      // slate-900 (cabecera oscura)
  headerText: [255, 255, 255] as [number, number, number],
  catBg: [30, 41, 59] as [number, number, number],         // slate-800 (fila de categoría)
  rowAlt: [248, 250, 252] as [number, number, number],     // slate-50 (fila alterna)
  border: [226, 232, 240] as [number, number, number],     // slate-200
  text: [51, 65, 85] as [number, number, number],          // slate-700
  featureText: [37, 99, 235] as [number, number, number],  // blue-600 (característica)
  checkBg: [220, 252, 231] as [number, number, number],    // green-100
  checkFg: [22, 163, 74] as [number, number, number],      // green-600
  crossBg: [254, 226, 226] as [number, number, number],    // red-100
  crossFg: [220, 38, 38] as [number, number, number],      // red-600
  muted: [148, 163, 184] as [number, number, number],      // slate-400 (guiones "—")
  cardImgBg: [248, 250, 252] as [number, number, number],  // slate-50 (fondo imagen card)
  darkText: [15, 23, 42] as [number, number, number],      // slate-900 (nombre modelo)
};

// ============ UTILIDADES ============

// Recorta un texto con "…" si excede el ancho disponible (en mm).
// IMPORTANTE: la fuente y el tamaño deben estar ya fijados en el doc.
function fitText(doc: jsPDF, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1);
  return t + '…';
}

// ============ CARDS DE VEHÍCULOS ============

// Dibuja las cards de los modelos comparados y devuelve la coordenada Y
// donde terminan (para colocar las tablas debajo).
function drawModelCards(
  doc: jsPDF,
  modelos: PdfModelo[],
  margin: number,
  startY: number,
  tableW: number
): number {
  const gap = 4;
  const n = modelos.length;
  const cardW = Math.min(58, (tableW - gap * (n - 1)) / n);
  const pad = 3;
  const imgH = 20;
  const specLineH = 3.8;
  const maxSpecs = Math.max(0, ...modelos.map((m) => m.specs?.length ?? 0));
  const cardH = pad + 3.2 + 4.6 + 1.5 + imgH + 2 + maxSpecs * specLineH + pad;

  modelos.forEach((m, i) => {
    const x = margin + i * (cardW + gap);
    let y = startY;

    // Contorno de la card
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...COLOR.border);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');

    // Marca (azul, pequeño, mayúsculas)
    y += pad + 2.4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...COLOR.featureText);
    doc.text(fitText(doc, m.marca.toUpperCase(), cardW - pad * 2), x + pad, y);

    // Nombre del modelo (negrita, oscuro)
    y += 4.2;
    doc.setFontSize(9);
    doc.setTextColor(...COLOR.darkText);
    const nombre = `${m.modelo} ${m.version}`.trim();
    doc.text(fitText(doc, nombre, cardW - pad * 2), x + pad, y);

    // Caja de imagen (fondo slate-50)
    y += 1.9;
    const imgBoxX = x + pad;
    const imgBoxW = cardW - pad * 2;
    doc.setFillColor(...COLOR.cardImgBg);
    doc.roundedRect(imgBoxX, y, imgBoxW, imgH, 1.5, 1.5, 'F');

    if (m.imgDataUrl) {
      try {
        const props = doc.getImageProperties(m.imgDataUrl);
        const ratio = props.width / props.height;
        // Encajar la imagen dentro de la caja preservando la proporción
        let w = imgBoxW - 2;
        let h = w / ratio;
        if (h > imgH - 2) { h = imgH - 2; w = h * ratio; }
        doc.addImage(m.imgDataUrl, 'PNG', imgBoxX + (imgBoxW - w) / 2, y + (imgH - h) / 2, w, h);
      } catch {
        // Imagen corrupta o formato no soportado: placeholder
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...COLOR.muted);
        doc.text('—', imgBoxX + imgBoxW / 2, y + imgH / 2 + 1, { align: 'center' });
      }
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...COLOR.muted);
      doc.text('—', imgBoxX + imgBoxW / 2, y + imgH / 2 + 1, { align: 'center' });
    }

    // Specs (etiqueta a la izquierda, valor en negrita a la derecha)
    y += imgH + 3.2;
    (m.specs ?? []).forEach((spec) => {
      // Línea separadora fina encima de cada spec (como en la web)
      doc.setDrawColor(...COLOR.border);
      doc.setLineWidth(0.1);
      doc.line(x + pad, y - 2.6, x + cardW - pad, y - 2.6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(...COLOR.muted);
      // El valor tiene prioridad de espacio; la etiqueta se recorta si hace falta
      doc.setFont('helvetica', 'bold');
      const valTxt = fitText(doc, spec.value, (cardW - pad * 2) * 0.45);
      const valW = doc.getTextWidth(valTxt);
      doc.setFont('helvetica', 'normal');
      const labelTxt = fitText(doc, spec.label, cardW - pad * 2 - valW - 2);

      doc.text(labelTxt, x + pad, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR.darkText);
      doc.text(valTxt, x + cardW - pad, y, { align: 'right' });
      y += specLineH;
    });
  });

  return startY + cardH;
}

// ============ BLOQUE DE FUENTES ============

// Dibuja el bloque de fuentes al final del documento, con enlaces clicables.
// Gestiona el salto de página si no cabe. Devuelve la Y final.
function drawSourcesBlock(
  doc: jsPDF,
  modelos: PdfModelo[],
  margin: number,
  startY: number,
  pageW: number,
  pageH: number
): number {
  const modelosConFuentes = modelos.filter((m) => (m.fuentes?.length ?? 0) > 0);
  if (modelosConFuentes.length === 0) return startY;

  const bottomLimit = pageH - 14;
  let y = startY + 4;

  // Si no cabe ni la cabecera del bloque, nueva página
  if (y + 16 > bottomLimit) { doc.addPage(); y = 20; }

  // Cabecera del bloque (banda oscura)
  doc.setFillColor(...COLOR.headerBg);
  doc.rect(margin, y, pageW - margin * 2, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.headerText);
  doc.text('FUENTES DE DATOS', margin + 3, y + 4.8);
  y += 7 + 4;

  for (const m of modelosConFuentes) {
    const fuentes = m.fuentes!;
    // Alto estimado del bloque de este modelo (título + fuentes)
    const needed = 6 + fuentes.length * 5.2 + 3;
    if (y + needed > bottomLimit) { doc.addPage(); y = 20; }

    // Nombre del modelo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR.darkText);
    doc.text(`${m.marca} ${m.modelo} ${m.version}`.trim(), margin, y);
    y += 5;

    for (const f of fuentes) {
      if (y + 5.2 > bottomLimit) { doc.addPage(); y = 20; }

      // Insignia PDF / WEB
      const badge = f.esPdf ? 'PDF' : 'WEB';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      if (f.esPdf) {
        doc.setFillColor(...COLOR.crossBg);
        doc.setTextColor(...COLOR.crossFg);
      } else {
        doc.setFillColor(...COLOR.checkBg);
        doc.setTextColor(...COLOR.featureText);
      }
      doc.roundedRect(margin + 2, y - 2.6, 7, 3.4, 0.6, 0.6, 'F');
      doc.text(badge, margin + 5.5, y - 0.2, { align: 'center' });

      // Etiqueta (o URL) como enlace clicable
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLOR.featureText);
      const texto = f.label || f.url;
      const maxTextW = pageW - margin * 2 - 14;
      const shown = fitText(doc, texto, maxTextW);
      doc.textWithLink(shown, margin + 12, y, { url: f.url });

      y += 5.2;
    }
    y += 3;
  }

  return y;
}

// ============ FUNCIÓN PRINCIPAL ============

export function exportarComparativaPDF(
  modelos: PdfModelo[],
  categorias: PdfCategoria[],
  opciones?: { titulo?: string; subtitulo?: string; nombreArchivo?: string }
): void {
  const titulo = opciones?.titulo ?? 'Comparador de Modelos';
  const subtitulo = opciones?.subtitulo ?? 'Comparativa técnica y comercial · LIUX';
  const nombreArchivo =
    opciones?.nombreArchivo ??
    `comparativa-liux-${new Date().toISOString().slice(0, 10)}.pdf`;

  // A4 horizontal: 297 x 210 mm — más ancho para tablas con varios modelos
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 10;
  const tableW = pageW - margin * 2;

  // Anchos de columna: 1ª columna (característica) fija, resto a partes iguales
  const colCaracteristicaW = 65;
  const colModeloW = (tableW - colCaracteristicaW) / modelos.length;

  // ---------- Cabecera del documento (solo página 1) ----------
  doc.setFillColor(...COLOR.headerBg);
  doc.rect(0, 0, pageW, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(titulo, margin, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(subtitulo, margin, 19);
  const fecha = new Date().toLocaleDateString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  doc.text(`Generado el ${fecha}`, pageW - margin, 19, { align: 'right' });

  // ---------- Cards de los vehículos comparados ----------
  const cardsBottom = drawModelCards(doc, modelos, margin, 32, tableW);
  let cursorY = cardsBottom + 6;

  // ---------- Una tabla por categoría ----------
  for (const categoria of categorias) {
    if (categoria.filas.length === 0) continue;

    const head: RowInput[] = [
      // Fila 1: nombre de la categoría ocupando todo el ancho
      [{
        content: categoria.nombre.toUpperCase(),
        colSpan: 1 + modelos.length,
        styles: {
          fillColor: COLOR.catBg,
          textColor: COLOR.headerText,
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'left',
          cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
        },
      }],
      // Fila 2: "Característica" + nombres de modelos
      [
        {
          content: 'CARACTERÍSTICA',
          styles: { halign: 'left' as const },
        },
        ...modelos.map((m) => ({
          content: `${m.marca}\n${m.modelo} ${m.version}`.trim(),
          styles: { halign: 'center' as const },
        })),
      ],
    ];

    const body: RowInput[] = categoria.filas.map((fila) => [
      fila.caracteristica,
      ...fila.valores,
    ]);

    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin, top: 14, bottom: 14 },
      head,
      body,
      // CLAVE: si la categoría no cabe en lo que queda de página,
      // salta entera a la página siguiente
      pageBreak: 'avoid',
      rowPageBreak: 'avoid',      // una fila individual tampoco se corta nunca
      showHead: 'everyPage',      // si la categoría ocupa >1 página, repite cabeceras
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: { top: 1.8, bottom: 1.8, left: 2.5, right: 2.5 },
        lineColor: COLOR.border,
        lineWidth: 0.15,
        textColor: COLOR.text,
        valign: 'middle',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: COLOR.headerBg,
        textColor: COLOR.headerText,
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      alternateRowStyles: { fillColor: COLOR.rowAlt },
      columnStyles: {
        0: { cellWidth: colCaracteristicaW, textColor: COLOR.featureText, halign: 'left' },
        ...Object.fromEntries(
          modelos.map((_, i) => [i + 1, { cellWidth: colModeloW, halign: 'center' as const }])
        ),
      },

      // Colorear celdas ✓ / ✗ / — y vaciar su texto (los símbolos se dibujan aparte)
      didParseCell: (data: CellHookData) => {
        if (data.section !== 'body' || data.column.index === 0) return;
        const raw = String(data.cell.raw ?? '').trim();
        if (raw === '✓') {
          data.cell.styles.fillColor = COLOR.checkBg;
          data.cell.text = [''];
        } else if (raw === '✗' || raw === 'X' || raw === '✕') {
          data.cell.styles.fillColor = COLOR.crossBg;
          data.cell.text = [''];
        } else if (raw === '—' || raw === '-' || raw === '') {
          data.cell.styles.textColor = COLOR.muted;
          if (raw === '') data.cell.text = ['—'];
        }
      },

      // Dibujo vectorial de ✓ y ✗ (las fuentes PDF estándar no traen estos símbolos)
      didDrawCell: (data: CellHookData) => {
        if (data.section !== 'body' || data.column.index === 0) return;
        const raw = String(data.cell.raw ?? '').trim();
        const cx = data.cell.x + data.cell.width / 2;
        const cy = data.cell.y + data.cell.height / 2;
        const s = 1.2; // tamaño del símbolo (mm)

        if (raw === '✓') {
          doc.setDrawColor(...COLOR.checkFg);
          doc.setLineWidth(0.45);
          doc.line(cx - s, cy, cx - s * 0.25, cy + s * 0.75);
          doc.line(cx - s * 0.25, cy + s * 0.75, cx + s, cy - s * 0.75);
        } else if (raw === '✗' || raw === 'X' || raw === '✕') {
          doc.setDrawColor(...COLOR.crossFg);
          doc.setLineWidth(0.45);
          doc.line(cx - s * 0.8, cy - s * 0.8, cx + s * 0.8, cy + s * 0.8);
          doc.line(cx - s * 0.8, cy + s * 0.8, cx + s * 0.8, cy - s * 0.8);
        }
      },
    });

    // Posición para la siguiente categoría (con separación de 4 mm)
    cursorY = (doc as any).lastAutoTable.finalY + 4;
  }

  // ---------- Bloque de fuentes (enlaces clicables) ----------
  const pageH = doc.internal.pageSize.getHeight();
  drawSourcesBlock(doc, modelos, margin, cursorY, pageW, pageH);

  // ---------- Pie de página con numeración ----------
  const totalPaginas = doc.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR.muted);
    doc.text(
      `LIUX Comparador · Página ${i} de ${totalPaginas}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' }
    );
  }

  doc.save(nombreArchivo);
}