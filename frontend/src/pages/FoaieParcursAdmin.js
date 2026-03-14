import React, { useState, useEffect, useCallback } from 'react';
import { getEmployees, getFoiParcursAdmin } from '../services/api';

function formatData(str) {
  if (!str) return '';
  return str.slice(0, 10).split('-').reverse().join('.');
}

export default function FoaieParcursAdmin() {
  const [angajati, setAngajati] = useState([]);
  const [emailSelectat, setEmailSelectat] = useState('');
  const [dataDe, setDataDe] = useState('');
  const [dataPana, setDataPana] = useState('');
  const [foi, setFoi] = useState([]);
  const [totalKm, setTotalKm] = useState(0);
  const [loading, setLoading] = useState(false);
  const [raportLoading, setRaportLoading] = useState(false);

  useEffect(() => {
    getEmployees().then(({ data }) => setAngajati(data || [])).catch(() => {});
  }, []);

  const loadFoi = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (emailSelectat) params.email = emailSelectat;
      if (dataDe) params.data_de = dataDe;
      if (dataPana) params.data_pana = dataPana;
      const { data } = await getFoiParcursAdmin(params);
      setFoi(data.foi || []);
      setTotalKm(data.total_km || 0);
    } catch (_) {
      setFoi([]);
      setTotalKm(0);
    } finally {
      setLoading(false);
    }
  }, [emailSelectat, dataDe, dataPana]);

  useEffect(() => {
    loadFoi();
  }, [loadFoi]);

  const numeAngajat = (email) => {
    const a = angajati.find(a => a.email === email);
    return a ? a.name : email;
  };

  const titluRaport = emailSelectat
    ? numeAngajat(emailSelectat)
    : 'Toți angajații';

  const generatePDF = async () => {
    setRaportLoading(true);
    try {
      if (!foi.length) { alert('Nu există date pentru export.'); return; }
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.setTextColor('#C0392B');
      doc.text('Red Medica - Asistență Medicală la Domiciliu', 14, 18);
      doc.setFontSize(12);
      doc.setTextColor('#000000');
      doc.text('Raport Foi de Parcurs', 14, 28);
      doc.text(`Angajat: ${titluRaport}`, 14, 36);
      if (dataDe || dataPana) {
        doc.text(`Perioadă: ${dataDe || '—'} → ${dataPana || '—'}`, 14, 44);
      }

      autoTable(doc, {
        startY: dataDe || dataPana ? 52 : 44,
        head: [['Data', 'Angajat', 'Nr. Înmtr.', 'Ora Înc.', 'Ora Final', 'KM Înc.', 'KM Final', 'KM Total', 'Observații']],
        body: foi.map(f => [
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
        foot: [['', '', '', '', '', '', 'TOTAL KM:', totalKm, '']],
        headStyles: { fillColor: [192, 57, 43], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 240, 240] },
        styles: { fontSize: 7 }
      });

      const finalY = doc.lastAutoTable.finalY + 8;
      doc.setFontSize(9);
      doc.setTextColor('#666666');
      doc.text(`Generat la: ${new Date().toLocaleDateString('ro-RO')}`, 14, finalY);
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
      if (!foi.length) { alert('Nu există date pentru export.'); return; }
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Foi Parcurs');

      ws.mergeCells('A1:I1');
      ws.getCell('A1').value = 'Red Medica - Asistență Medicală la Domiciliu';
      ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFC0392B' } };
      ws.getCell('A1').alignment = { horizontal: 'center' };

      ws.mergeCells('A2:I2');
      ws.getCell('A2').value = `Angajat: ${titluRaport}${dataDe || dataPana ? `  |  Perioadă: ${dataDe || '—'} → ${dataPana || '—'}` : ''}`;
      ws.getCell('A2').alignment = { horizontal: 'center' };

      const headerRow = ws.addRow(['Data', 'Angajat', 'Nr. Înmtr.', 'Ora Înc.', 'Ora Final', 'KM Înc.', 'KM Final', 'KM Total', 'Observații']);
      headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0392B' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center' };
      });

      foi.forEach((f, i) => {
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
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE8E8' } };
          });
        }
      });

      // Totaluri per angajat
      if (!emailSelectat) {
        const byAngajat = {};
        foi.forEach(f => {
          const key = f.angajat_email;
          if (!byAngajat[key]) byAngajat[key] = { nume: f.angajat_nume || f.angajat_email, km: 0 };
          byAngajat[key].km += (f.km_total || 0);
        });
        ws.addRow([]);
        const subtitluRow = ws.addRow(['Totaluri per angajat', '', '', '', '', '', '', '', '']);
        subtitluRow.getCell(1).font = { bold: true };
        Object.values(byAngajat).forEach(({ nume, km }) => {
          const r = ws.addRow([nume, '', '', '', '', '', 'KM Total:', km, '']);
          r.getCell(7).font = { bold: true };
          r.getCell(8).font = { bold: true };
        });
      }

      const totalRow = ws.addRow(['', '', '', '', '', '', 'TOTAL KM:', totalKm, '']);
      totalRow.getCell(7).font = { bold: true };
      totalRow.getCell(8).font = { bold: true };
      totalRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
      });

      ws.columns = [
        { width: 12 }, { width: 20 }, { width: 16 }, { width: 11 }, { width: 11 },
        { width: 11 }, { width: 11 }, { width: 11 }, { width: 22 }
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
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '16px 12px' }}>
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
              <option value="">Toți angajații</option>
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
        </div>
      </div>

      {/* Raport */}
      <div style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>
            Total KM: <span style={{ color: '#C0392B', fontSize: 18 }}>{totalKm}</span>
            {emailSelectat && <span style={{ fontWeight: 400, fontSize: 13, color: '#666', marginLeft: 8 }}>({numeAngajat(emailSelectat)})</span>}
          </span>
          <button style={btnPrimary} onClick={generatePDF} disabled={raportLoading}>📄 PDF</button>
          <button style={{ ...btnPrimary, background: '#1a6e3f' }} onClick={generateExcel} disabled={raportLoading}>📊 Excel</button>
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
          <div style={{ color: '#999', textAlign: 'center', padding: '24px 0' }}>Nu există foi de parcurs pentru filtrele selectate.</div>
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
                  <tr key={f.id} style={{ background: i % 2 === 1 ? '#fff0f0' : '#fff', borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{formatData(f.data)}</td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{f.angajat_nume || f.angajat_email}</td>
                    <td style={{ padding: '8px 10px' }}>{f.numar_inmatriculare || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{f.ora_inceput || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{f.ora_final || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{f.km_inceput !== null ? f.km_inceput : '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{f.km_final !== null ? f.km_final : '—'}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#C0392B' }}>{f.km_total !== null ? f.km_total : '—'}</td>
                    <td style={{ padding: '8px 10px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.observatii || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f5f5f5', fontWeight: 700 }}>
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
