// Generare PDF Raport de Călătorie Ambulanță — pattern identic FoaieParcursAdmin.js

const p2 = n => String(n).padStart(2, '0');

function formatDurata(sec) {
  if (sec === null || sec === undefined || isNaN(Number(sec))) return '—';
  const s = Math.abs(Math.round(Number(sec)));
  return `${p2(Math.floor(s / 3600))}:${p2(Math.floor((s % 3600) / 60))}:${p2(s % 60)}`;
}

function formatKm(km) {
  if (km === null || km === undefined) return '—';
  return `${Number(km).toFixed(2)} km`;
}

function formatOdo(km) {
  if (km === null || km === undefined) return '—';
  return `${Number(km).toFixed(1)} km`;
}

function formatViteza(v) {
  if (v === null || v === undefined) return '—';
  return `${v} km/h`;
}

function formatOra(t) {
  if (!t) return '—';
  return t.slice(0, 5);
}

function celulaCursa(cursa) {
  return [
    `${cursa.data_cursa}\n${formatOra(cursa.ora_plecare)}`,
    cursa.locatie_plecare || '—',
    `${cursa.data_cursa}\n${formatOra(cursa.ora_sosire)}`,
    cursa.locatie_sosire || '—',
    formatKm(cursa.distanta_km),
    formatOdo(cursa.odometru_start),
    formatOdo(cursa.odometru_final),
    formatDurata(cursa.stationare_pornit_sec),
    formatDurata(cursa.durata_condus_sec),
    cursa.stationare_oprit_sec != null ? formatDurata(cursa.stationare_oprit_sec) : '—',
    formatViteza(cursa.viteza_medie),
    formatViteza(cursa.viteza_maxima),
  ];
}

function celulaSumar(s, fara_ore) {
  return [
    fara_ore ? (s.data_start || '—') : `${s.data_start || '—'}\n${formatOra(s.ora_start)}`,
    s.locatie_start || '—',
    fara_ore ? (s.data_final || '—') : `${s.data_final || '—'}\n${formatOra(s.ora_final)}`,
    s.locatie_final || '—',
    formatKm(s.total_km),
    formatOdo(s.odometru_start),
    formatOdo(s.odometru_final),
    formatDurata(s.stationare_pornit_sec),
    formatDurata(s.condus_sec),
    formatDurata(s.stationare_oprit_sec),
    formatViteza(s.viteza_medie),
    formatViteza(s.viteza_maxima),
  ];
}

const HEAD = [[
  'Data început',
  'Locație început',
  'Data final',
  'Locație final',
  'Distanță (km)',
  'Odo start (km)',
  'Odo final (km)',
  'Staț. pornit',
  'Durată condus',
  'Staț. oprit',
  'V. medie',
  'V. max',
]];

const COL_WIDTHS = [22, 38, 22, 38, 18, 22, 22, 18, 18, 18, 14, 14];

function tableStyles(doc, nr, perioada, data_generare) {
  const pageW = doc.internal.pageSize.getWidth();
  const drawnPages = new Set();

  function drawHeader() {
    const cx = pageW / 2;
    const M = 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('REDMEDICA HOME SRL', M, 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Data generare raport: ${data_generare}`, M, 16);
    doc.text(`Perioada: ${perioada.de_la} - ${perioada.pana_la}`, M, 21);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('RAPORT DE CALATORIE DETALIAT', cx, 10, { align: 'center' });
    doc.setFontSize(11);
    doc.text(nr, cx, 17, { align: 'center' });

    doc.setLineWidth(0.3);
    doc.setDrawColor(92, 168, 41);
    doc.line(M, 25, pageW - M, 25);
    doc.setTextColor(0, 0, 0);
  }

  function didDrawPage(data) {
    const pg = data.pageNumber;
    if (!drawnPages.has(pg)) {
      drawnPages.add(pg);
      drawHeader();
    }
  }

  const base = {
    theme: 'grid',
    startY: 28,
    margin: { left: 10, right: 10 },
    head: HEAD,
    headStyles: {
      fillColor: [92, 168, 41],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7,
    },
    styles: {
      fontSize: 7,
      lineWidth: 0.1,
      lineColor: [180, 180, 180],
      cellPadding: 2,
      overflow: 'linebreak',
    },
    columnStyles: COL_WIDTHS.reduce((acc, w, i) => {
      acc[i] = { cellWidth: w };
      if (i === 1 || i === 3) acc[i].textColor = [10, 80, 180];
      return acc;
    }, {}),
    didDrawPage,
  };

  return base;
}

export async function genereazaRaportPdf(dateRaport) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const { ambulanta, perioada, data_generare, sumar_perioada, zile } = dateRaport;
  const nr = ambulanta.numar_inmatriculare;

  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
  const styles = tableStyles(doc, nr, perioada, data_generare);

  // ── 1. Sumar perioadă ───────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);

  let nextY = 28;

  // Titlu secțiune
  doc.text('Sumar perioada', 10, nextY + 4);
  nextY += 7;

  if (sumar_perioada) {
    autoTable(doc, {
      ...styles,
      startY: nextY,
      body: [celulaSumar(sumar_perioada, true)],
      didDrawPage: styles.didDrawPage,
    });
    nextY = doc.lastAutoTable.finalY + 6;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Nu exista date pentru aceasta perioada.', 10, nextY + 4);
    nextY += 10;
  }

  // ── 2. Sumar per zi ─────────────────────────────────────────────────────
  for (const zi of zile) {
    if (nextY > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      nextY = 28;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const ziLabel = `Sumarul zilei de ${zi.zi_saptamana}, ${zi.data}`;
    doc.text(ziLabel, 10, nextY + 4);
    nextY += 7;

    if (zi.sumar_zi) {
      autoTable(doc, {
        ...styles,
        startY: nextY,
        body: [celulaSumar(zi.sumar_zi, false)],
        didDrawPage: styles.didDrawPage,
      });
      nextY = doc.lastAutoTable.finalY + 4;
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Nicio cursa in aceasta zi.', 10, nextY + 4);
      nextY += 8;
    }
  }

  // ── 3. Detalii călătorii ─────────────────────────────────────────────────
  if (nextY > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    nextY = 28;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('Detalii calatorii', 10, nextY + 4);
  nextY += 7;

  const toateCursele = zile.flatMap(z => z.curse);

  if (toateCursele.length > 0) {
    autoTable(doc, {
      ...styles,
      startY: nextY,
      body: toateCursele.map(c => celulaCursa(c)),
      didDrawPage: styles.didDrawPage,
    });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Nu exista curse in aceasta perioada.', 10, nextY + 4);
  }

  const filename = `RedMedica_raport_calatorie_${nr}_${perioada.de_la}_${perioada.pana_la}.pdf`;
  doc.save(filename);
}
