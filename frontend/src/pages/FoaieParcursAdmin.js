import React, { useState, useEffect } from 'react';
import { getEmployees, getFoiParcurs } from '../services/api';

function formatData(str) {
  if (!str) return '';
  return str.slice(0, 10).split('-').reverse().join('.');
}

function getNumereInmatriculare(foi) {
  return [...new Set(foi.map(f => f.numar_inmatriculare).filter(Boolean))].join(', ') || '—';
}

function addPdfHeader(doc, numarInmatriculare, angajatNume, perioadaDe, perioadaPana) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const cx = pageWidth / 2;
  const dataGen = new Date().toLocaleDateString('ro-RO');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('UNITATEA RED MEDICA HOME SRL', cx, 16, { align: 'center' });

  doc.setFontSize(13);
  doc.text('FOAIE DE PARCURS', cx, 24, { align: 'center' });

  doc.setLineWidth(0.5);
  doc.setDrawColor(192, 57, 43);
  doc.line(14, 28, pageWidth - 14, 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Data generare raport: ${dataGen}`, 14, 35);
  doc.text(`Număr înmatriculare: ${numarInmatriculare}`, 14, 41);
  doc.text(`Angajat: ${angajatNume}`, 14, 47);
  doc.text(`Perioada: ${perioadaDe || '—'} - ${perioadaPana || '—'}`, 14, 53);

  return 61;
}

async function addExcelHeader(ws, cols, numarInmatriculare, angajatNume, perioadaDe, perioadaPana) {
  const dataGen = new Date().toLocaleDateString('ro-RO');
  const range = `A1:${String.fromCharCode(64 + cols)}1`;

  ws.mergeCells(`A1:${String.fromCharCode(64 + cols)}1`);
  ws.getCell('A1').value = 'UNITATEA RED MEDICA HOME SRL';
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0392B' } };
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 24;

  ws.mergeCells(`A2:${String.fromCharCode(64 + cols)}2`);
  ws.getCell('A2').value = 'FOAIE DE PARCURS';
  ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE74C3C' } };
  ws.getCell('A2').font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 20;

  const grayFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  const details = [
    `Data generare raport: ${dataGen}`,
    `Număr înmatriculare: ${numarInmatriculare}`,
    `Angajat: ${angajatNume}`,
    `Perioada: ${perioadaDe || '—'} - ${perioadaPana || '—'}`
  ];
  details.forEach((text, i) => {
    const rowNum = i + 3;
    ws.mergeCells(`A${rowNum}:${String.fromCharCode(64 + cols)}${rowNum}`);
    ws.getCell(`A${rowNum}`).value = text;
    ws.getCell(`A${rowNum}`).fill = grayFill;
    ws.getCell(`A${rowNum}`).font = { size: 10 };
    ws.getCell(`A${rowNum}`).alignment = { horizontal: 'left' };
  });

  ws.addRow([]); // empty row before table (row 7)
}

export default function FoaieParcursAdmin() {
  const [angajati, setAngajati] = useState([]);
  // Filtre tabel
  const [emailSelectat, setEmailSelectat] = useState('');
  const [dataDe, setDataDe] = useState('');
  const [dataPana, setDataPana] = useState('');
  const [appliedEmail, setAppliedEmail] = useState('');
  const [appliedDe, setAppliedDe] = useState('');
  const [appliedPana, setAppliedPana] = useState('');
  const [foi, setFoi] = useState([]);
  const [totalKm, setTotalKm] = useState(0);
  const [loading, setLoading] = useState(false);
  // Filtre raport (independente)
  const [raportEmail, setRaportEmail] = useState('');
  const [raportDe, setRaportDe] = useState('');
  const [raportPana, setRaportPana] = useState('');
  const [raportLoading, setRaportLoading] = useState(false);

  useEffect(() => {
    getEmployees().then(({ data }) => setAngajati(data || [])).catch(() => {});
    loadFoi({});
  }, []); // only on mount

  const loadFoi = async (params) => {
    setLoading(true);
    try {
      const { data } = await getFoiParcurs(params);
      setFoi(data.foi || []);
      setTotalKm(data.total_km || 0);
    } catch (_) {
      setFoi([]);
      setTotalKm(0);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    const params = {};
    if (emailSelectat) params.email = emailSelectat;
    if (dataDe) params.data_de = dataDe;
    if (dataPana) params.data_pana = dataPana;
    setAppliedEmail(emailSelectat);
    setAppliedDe(dataDe);
    setAppliedPana(dataPana);
    loadFoi(params);
  };

  const numeAngajat = (email) => {
    if (!email) return 'Toți Angajații';
    const a = angajati.find(a => a.email === email);
    return a ? a.name : email;
  };

  const fetchRaportData = async () => {
    const params = {};
    if (raportEmail) params.email = raportEmail;
    if (raportDe) params.data_de = raportDe;
    if (raportPana) params.data_pana = raportPana;
    const { data } = await getFoiParcurs(params);
    return { foiRaport: data.foi || [], totalKmRaport: data.total_km || 0 };
  };

  const generatePDF = async () => {
    setRaportLoading(true);
    try {
      const { foiRaport, totalKmRaport } = await fetchRaportData();
      if (!foiRaport.length) { alert('Nu există date pentru export.'); return; }
      const titluRaport = numeAngajat(raportEmail);
      const numarePlate = getNumereInmatriculare(foiRaport);
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'landscape' });

      const startY = addPdfHeader(doc, numarePlate, titluRaport, raportDe, raportPana);

      autoTable(doc, {
        startY,
        head: [['Data', 'Angajat', 'Nr. Înmatriculare', 'Ora Început', 'Ora Final', 'KM Început', 'KM Final', 'KM Total', 'Observații']],
        body: foiRaport.map(f => [
          formatData(f.data),
          f.angajat_nume || f.angajat_email || '',
          f.numar_inmatriculare || '',
          f.ora_inceput || '',
          f.ora_final || '',
          f.km_inceput !== null ? f.km_inceput : '',
          f.km_final !== null ? f.km_final : '',
          f.km_total !== null ? f.km_total : '',
          f.observatii || ''
        ]),
        foot: [['', '', '', '', '', '', 'TOTAL KM:', totalKmRaport, '']],
        headStyles: { fillColor: [192, 57, 43], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 219, 216] },
        styles: { fontSize: 8 }
      });

      doc.save(`RaportFoiParcurs_${titluRaport.replace(/\s/g, '_')}.pdf`);
    } catch (err) {
      alert('Eroare PDF: ' + err.message);
    } finally {
      setRaportLoading(false);
    }
  };

  const generateExcel = async () => {
    setRaportLoading(true);
    try {
      const { foiRaport, totalKmRaport } = await fetchRaportData();
      if (!foiRaport.length) { alert('Nu există date pentru export.'); return; }
      const titluRaport = numeAngajat(raportEmail);
      const numarePlate = getNumereInmatriculare(foiRaport);
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Foi Parcurs');
      const cols = 9;

      await addExcelHeader(ws, cols, numarePlate, titluRaport, raportDe, raportPana);

      const headerRow = ws.addRow(['Data', 'Angajat', 'Nr. Înmatriculare', 'Ora Început', 'Ora Final', 'KM Început', 'KM Final', 'KM Total', 'Observații']);
      headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0392B' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center' };
      });

      foiRaport.forEach((f, i) => {
        const row = ws.addRow([
          formatData(f.data),
          f.angajat_nume || f.angajat_email || '',
          f.numar_inmatriculare || '',
          f.ora_inceput || '',
          f.ora_final || '',
          f.km_inceput !== null ? f.km_inceput : '',
          f.km_final !== null ? f.km_final : '',
          f.km_total !== null ? f.km_total : '',
          f.observatii || ''
        ]);
        if (i % 2 === 1) {
          row.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFADBD8' } };
          });
        }
      });

      const totalRow = ws.addRow(['', '', '', '', '', '', 'TOTAL KM:', totalKmRaport, '']);
      totalRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
        cell.font = { bold: true };
      });

      ws.columns = [
        { width: 12 }, { width: 20 }, { width: 18 }, { width: 12 }, { width: 12 },
        { width: 12 }, { width: 12 }, { width: 12 }, { width: 24 }
      ];

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RaportFoiParcurs_${titluRaport.replace(/\s/g, '_')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Eroare Excel: ' + err.message);
    } finally {
      setRaportLoading(false);
    }
  };

  const card = { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 24 };
  const inputStyle = { padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 15, boxSizing: 'border-box' };
  const labelStyle = { display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#555' };
  const btnPrimary = { background: '#C0392B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 12px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#C0392B', marginBottom: 20 }}>
        🚗 Foi Parcurs Angajați
      </h1>

      {/* Filtre */}
      <div style={card}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: '#333' }}>Filtre</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>Angajat</label>
            <select style={{ ...inputStyle, minWidth: 220 }} value={emailSelectat} onChange={e => setEmailSelectat(e.target.value)}>
              <option value="">Toți Angajații</option>
              {angajati.map(a => (
                <option key={a.email} value={a.email}>{a.name} ({a.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Data de</label>
            <input style={{ ...inputStyle, width: 150 }} type="date" value={dataDe} onChange={e => setDataDe(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Data până</label>
            <input style={{ ...inputStyle, width: 150 }} type="date" value={dataPana} onChange={e => setDataPana(e.target.value)} />
          </div>
          <button style={btnPrimary} onClick={handleApplyFilters} disabled={loading}>
            🔍 Aplică Filtre
          </button>
        </div>
      </div>

      {/* Total tabel */}
      <div style={{ ...card, padding: '12px 24px' }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>
          Total KM afișați: <span style={{ color: '#C0392B', fontSize: 18 }}>{totalKm}</span>
          {appliedEmail && <span style={{ fontWeight: 400, fontSize: 13, color: '#666', marginLeft: 8 }}>({numeAngajat(appliedEmail)})</span>}
        </span>
      </div>

      {/* Generează Raport */}
      <div style={card}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: '#333' }}>📄 Generează Raport</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>Angajat</label>
            <select style={{ ...inputStyle, minWidth: 220 }} value={raportEmail} onChange={e => setRaportEmail(e.target.value)}>
              <option value="">Toți Angajații</option>
              {angajati.map(a => (
                <option key={a.email} value={a.email}>{a.name} ({a.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Data de</label>
            <input style={{ ...inputStyle, width: 150 }} type="date" value={raportDe} onChange={e => setRaportDe(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Data până</label>
            <input style={{ ...inputStyle, width: 150 }} type="date" value={raportPana} onChange={e => setRaportPana(e.target.value)} />
          </div>
          <button style={btnPrimary} onClick={generatePDF} disabled={raportLoading}>📄 Descarcă PDF</button>
          <button style={{ ...btnPrimary, background: '#1a6e3f' }} onClick={generateExcel} disabled={raportLoading}>📊 Descarcă Excel</button>
          {raportLoading && <span style={{ color: '#888', fontSize: 13 }}>Se generează...</span>}
        </div>
      </div>

      {/* Lista foi */}
      <div style={card}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: '#333' }}>
          Foi de Parcurs ({foi.length})
        </h2>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#888', padding: '20px 0' }}>Se încarcă...</div>
        ) : foi.length === 0 ? (
          <div style={{ color: '#999', textAlign: 'center', padding: '24px 0' }}>Nu există foi de parcurs. Selectați filtrele și apăsați Aplică Filtre.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#C0392B', color: '#fff' }}>
                  {['Data', 'Angajat', 'Nr. Înmtr.', 'Ora Înc.', 'Ora Final', 'KM Înc.', 'KM Final', 'KM Total', 'Observații'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {foi.map((f, i) => (
                  <tr key={f.id} style={{ background: i % 2 === 1 ? '#FADBD8' : '#fff', borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{formatData(f.data)}</td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{f.angajat_nume || f.angajat_email}</td>
                    <td style={{ padding: '8px 10px' }}>{f.numar_inmatriculare || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{f.ora_inceput || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{f.ora_final || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{f.km_inceput !== null ? f.km_inceput : '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{f.km_final !== null ? f.km_final : '—'}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#C0392B' }}>{f.km_total !== null ? f.km_total : '—'}</td>
                    <td style={{ padding: '8px 10px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.observatii || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#FFF9C4', fontWeight: 700 }}>
                  <td colSpan={7} style={{ padding: '8px 10px', textAlign: 'right' }}>TOTAL KM:</td>
                  <td style={{ padding: '8px 10px', color: '#C0392B', fontSize: 15 }}>{totalKm}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
