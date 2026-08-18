// lib/exportPdf.ts
// Exportación a PDF del Comparador LIUX
// - PDF vectorial (texto real, no imagen)
// - Una tabla por categoría con pageBreak: 'avoid' => una categoría nunca se corta
//   entre páginas (salvo que ocupe más de una página completa, en cuyo caso
//   repite cabeceras en la continuación)
// - Símbolos ✓ / ✗ dibujados vectorialmente con los colores de la web

import jsPDF from 'jspdf';
import autoTable, { RowInput, CellHookData } from 'jspdf-autotable';

// ============ TIPOS DE ENTRADA ============

export interface PdfModelo {
  marca: string;      // p.ej. "LIUX"
  modelo: string;     // p.ej. "BIG"
  version: string;    // p.ej. "20"
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
};

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

  let cursorY = 32;

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