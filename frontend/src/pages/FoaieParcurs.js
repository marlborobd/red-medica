import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getFoiParcurs, createFoaieParcurs, updateFoaieParcurs, deleteFoaieParcurs,
  getRaportFoiParcurs, getNumarInmatriculare, saveNumarInmatriculare
} from '../services/api';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}

function formatData(str) {
  if (!str) return '';
  return str.slice(0, 10).split('-').reverse().join('.');
}

export default function FoaieParcurs() {
  const { user } = useAuth();

  const emptyForm = {
    numar_inmatriculare: '',
    data: today(),
    ora_inceput: nowTime(),
    ora_final: '',
    km_inceput: '',
    km_final: '',
    observatii: ''
  };

  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [foi, setFoi] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');
  const [raportDe, setRaportDe] = useState('');
  const [raportPana, setRaportPana] = useState('');
  const [raportLoading, setRaportLoading] = useState(false);

  const kmTotal = form.km_final !== '' && form.km_inceput !== ''
    ? (parseInt(form.km_final) || 0) - (parseInt(form.km_inceput) || 0)
    : '';

  const loadFoi = useCallback(async () => {
    try {
      const { data } = await getFoiParcurs();
      setFoi(data.foi || data);
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadFoi();
    getNumarInmatriculare().then(({ data }) => {
      if (data.numar_inmatriculare) {
        setForm(f => ({ ...f, numar_inmatriculare: data.numar_inmatriculare }));
      }
    }).catch(() => {});
  }, [loadFoi]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setSuccess('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        km_inceput: parseInt(form.km_inceput) || 0,
        km_final: parseInt(form.km_final) || 0
      };
      if (editId) {
        await updateFoaieParcurs(editId, payload);
        setSuccess('Foaie actualizată!');
      } else {
        await createFoaieParcurs(payload);
        setSuccess('Foaie salvată!');
      }
      // Salvează numărul de înmatriculare
      if (form.numar_inmatriculare) {
        await saveNumarInmatriculare(form.numar_inmatriculare).catch(() => {});
      }
      setForm({ ...emptyForm, numar_inmatriculare: form.numar_inmatriculare });
      setEditId(null);
      loadFoi();
    } catch (err) {
      setErr(err.response?.data?.error || 'Eroare la salvare');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (f) => {
    setEditId(f.id);
    setForm({
      numar_inmatriculare: f.numar_inmatriculare || '',
      data: f.data || today(),
      ora_inceput: f.ora_inceput || '',
      ora_final: f.ora_final || '',
      km_inceput: f.km_inceput !== null ? String(f.km_inceput) : '',
      km_final: f.km_final !== null ? String(f.km_final) : '',
      observatii: f.observatii || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Ștergi această foaie de parcurs?')) return;
    try {
      await deleteFoaieParcurs(id);
      loadFoi();
    } catch (_) {}
  };

  const handleCancel = () => {
    setEditId(null);
    setErr('');
    setSuccess('');
    setForm({ ...emptyForm, numar_inmatriculare: form.numar_inmatriculare });
  };

  const generatePDF = async (foiData, totalKm, angajatNume, perioadaDe, perioadaPana) => {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const cx = pageWidth / 2;
    const dataGen = new Date().toLocaleDateString('ro-RO');
    const numarePlate = [...new Set(foiData.map(f => f.numar_inmatriculare).filter(Boolean))].join(', ') || '—';

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
    doc.text(`Număr înmatriculare: ${numarePlate}`, 14, 41);
    doc.text(`Angajat: ${angajatNume}`, 14, 47);
    doc.text(`Perioada: ${perioadaDe || '—'} - ${perioadaPana || '—'}`, 14, 53);

    autoTable(doc, {
      startY: 61,
      head: [['Data', 'Angajat', 'Nr. Înmatriculare', 'Ora Început', 'Ora Final', 'KM Început', 'KM Final', 'KM Total', 'Observații']],
      body: foiData.map(f => [
        formatData(f.data),
        angajatNume,
        f.numar_inmatriculare || '',
        f.ora_inceput || '',
        f.ora_final || '',
        f.km_inceput !== null ? f.km_inceput : '',
        f.km_final !== null ? f.km_final : '',
        f.km_total !== null ? f.km_total : '',
        f.observatii || ''
      ]),
      foot: [['', '', '', '', '', '', 'TOTAL KM:', totalKm, '']],
      headStyles: { fillColor: [192, 57, 43], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.3 },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      styles: { fontSize: 8, textColor: [0, 0, 0], fontStyle: 'bold', fillColor: [255, 255, 255], lineColor: [0, 0, 0], lineWidth: 0.3 }
    });

    const filename = `FoaieParcurs_${angajatNume.replace(/\s/g, '_')}_${perioadaDe || 'toate'}.pdf`;
    doc.save(filename);
  };

  const generateExcel = async (foiData, totalKm, angajatNume, perioadaDe, perioadaPana) => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Foaie Parcurs');
    const cols = 9;
    const dataGen = new Date().toLocaleDateString('ro-RO');
    const numarePlate = [...new Set(foiData.map(f => f.numar_inmatriculare).filter(Boolean))].join(', ') || '—';
    const lastCol = String.fromCharCode(64 + cols);

    ws.mergeCells(`A1:${lastCol}1`);
    ws.getCell('A1').value = 'UNITATEA RED MEDICA HOME SRL';
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0392B' } };
    ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 24;

    ws.mergeCells(`A2:${lastCol}2`);
    ws.getCell('A2').value = 'FOAIE DE PARCURS';
    ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE74C3C' } };
    ws.getCell('A2').font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 20;

    const grayFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    [
      `Data generare raport: ${dataGen}`,
      `Număr înmatriculare: ${numarePlate}`,
      `Angajat: ${angajatNume}`,
      `Perioada: ${perioadaDe || '—'} - ${perioadaPana || '—'}`
    ].forEach((text, i) => {
      const rn = i + 3;
      ws.mergeCells(`A${rn}:${lastCol}${rn}`);
      ws.getCell(`A${rn}`).value = text;
      ws.getCell(`A${rn}`).fill = grayFill;
      ws.getCell(`A${rn}`).font = { size: 10 };
      ws.getCell(`A${rn}`).alignment = { horizontal: 'left' };
    });

    ws.addRow([]); // row 7 - gol

    const headerRow = ws.addRow(['Data', 'Angajat', 'Nr. Înmatriculare', 'Ora Început', 'Ora Final', 'KM Început', 'KM Final', 'KM Total', 'Observații']);
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0392B' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center' };
    });

    foiData.forEach((f, i) => {
      const row = ws.addRow([
        formatData(f.data),
        angajatNume,
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

    const totalRow = ws.addRow(['', '', '', '', '', '', 'TOTAL KM:', totalKm, '']);
    totalRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
      cell.font = { bold: true };
    });

    ws.columns = [
      { width: 12 }, { width: 20 }, { width: 18 }, { width: 12 },
      { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 24 }
    ];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FoaieParcurs_${angajatNume.replace(/\s/g, '_')}_${perioadaDe || 'toate'}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRaport = async (format) => {
    setRaportLoading(true);
    try {
      const params = {};
      if (raportDe) params.data_de = raportDe;
      if (raportPana) params.data_pana = raportPana;
      const { data } = await getRaportFoiParcurs(params);
      if (!data.foi || data.foi.length === 0) {
        alert('Nu există foi de parcurs în perioada selectată.');
        return;
      }
      if (format === 'pdf') {
        await generatePDF(data.foi, data.total_km, user?.name || user?.email, raportDe, raportPana);
      } else {
        await generateExcel(data.foi, data.total_km, user?.name || user?.email, raportDe, raportPana);
      }
    } catch (err) {
      alert('Eroare la generare raport: ' + (err.message || 'Necunoscută'));
    } finally {
      setRaportLoading(false);
    }
  };

  const card = { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 24 };
  const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 15, boxSizing: 'border-box' };
  const labelStyle = { display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#555' };
  const btnPrimary = { background: '#C0392B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer' };
  const btnSecondary = { background: '#f5f5f5', color: '#333', border: '1px solid #ddd', borderRadius: 8, padding: '10px 20px', fontSize: 15, fontWeight: 600, cursor: 'pointer' };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 12px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#C0392B', marginBottom: 20 }}>
        🚗 Foaie de Parcurs
      </h1>

      {/* Formular */}
      <div style={card}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, color: '#333' }}>
          {editId ? 'Editează Foaie' : 'Adaugă Foaie Nouă'}
        </h2>
        {err && <div style={{ background: '#fee', color: '#C0392B', padding: '10px 14px', borderRadius: 8, marginBottom: 12 }}>{err}</div>}
        {success && <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '10px 14px', borderRadius: 8, marginBottom: 12 }}>{success}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Număr Înmatriculare</label>
              <input style={inputStyle} name="numar_inmatriculare" value={form.numar_inmatriculare} onChange={handleChange} placeholder="ex: B 123 ABC" />
            </div>
            <div>
              <label style={labelStyle}>Data</label>
              <input style={inputStyle} type="date" name="data" value={form.data} onChange={handleChange} required />
            </div>
            <div>
              <label style={labelStyle}>Ora Început</label>
              <input style={inputStyle} type="time" name="ora_inceput" value={form.ora_inceput} onChange={handleChange} />
            </div>
            <div>
              <label style={labelStyle}>KM Început</label>
              <input style={inputStyle} type="number" name="km_inceput" value={form.km_inceput} onChange={handleChange} placeholder="0" min="0" />
            </div>
            <div>
              <label style={labelStyle}>Ora Sfârșit</label>
              <input style={inputStyle} type="time" name="ora_final" value={form.ora_final} onChange={handleChange} />
            </div>
            <div>
              <label style={labelStyle}>KM Final</label>
              <input style={inputStyle} type="number" name="km_final" value={form.km_final} onChange={handleChange} placeholder="0" min="0" />
            </div>
            <div>
              <label style={labelStyle}>KM Total</label>
              <input style={{ ...inputStyle, background: '#f5f5f5', color: '#555' }} value={kmTotal !== '' ? kmTotal : ''} readOnly placeholder="calculat automat" />
            </div>
            <div>
              <label style={labelStyle}>Observații (opțional)</label>
              <input style={inputStyle} name="observatii" value={form.observatii} onChange={handleChange} placeholder="Observații..." />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="submit" style={{ ...btnPrimary, flex: 1 }} disabled={loading}>
              {loading ? 'Se salvează...' : (editId ? '💾 Actualizează' : '💾 Salvează')}
            </button>
            {editId && (
              <button type="button" style={btnSecondary} onClick={handleCancel}>Anulează</button>
            )}
          </div>
        </form>
      </div>

      {/* Generare Raport */}
      <div style={card}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14, color: '#333' }}>📄 Generează Raport</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>Data de</label>
            <input style={{ ...inputStyle, width: 160 }} type="date" value={raportDe} onChange={e => setRaportDe(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Data până</label>
            <input style={{ ...inputStyle, width: 160 }} type="date" value={raportPana} onChange={e => setRaportPana(e.target.value)} />
          </div>
          <button style={{ ...btnPrimary, background: '#C0392B' }} onClick={() => handleRaport('pdf')} disabled={raportLoading}>
            📄 Descarcă PDF
          </button>
          <button style={{ ...btnPrimary, background: '#1a6e3f' }} onClick={() => handleRaport('excel')} disabled={raportLoading}>
            📊 Descarcă Excel
          </button>
        </div>
        {raportLoading && <div style={{ marginTop: 10, color: '#888' }}>Se generează raportul...</div>}
      </div>

      {/* Lista foi */}
      <div style={card}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14, color: '#333' }}>
          Lista Foi de Parcurs ({foi.length})
        </h2>
        {foi.length === 0 ? (
          <div style={{ color: '#999', textAlign: 'center', padding: '24px 0' }}>Nu există foi de parcurs înregistrate.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#C0392B', color: '#fff' }}>
                  {['Data', 'Nr. Înmtr.', 'Ora Înc.', 'Ora Final', 'KM Înc.', 'KM Final', 'KM Total', 'Observații', 'Acțiuni'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {foi.map((f, i) => (
                  <tr key={f.id} style={{ background: i % 2 === 1 ? '#fff0f0' : '#fff', borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{formatData(f.data)}</td>
                    <td style={{ padding: '8px 10px' }}>{f.numar_inmatriculare || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{f.ora_inceput || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{f.ora_final || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{f.km_inceput !== null ? f.km_inceput : '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{f.km_final !== null ? f.km_final : '—'}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#C0392B' }}>{f.km_total !== null ? f.km_total : '—'}</td>
                    <td style={{ padding: '8px 10px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.observatii || '—'}</td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => handleEdit(f)} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 12, marginRight: 6 }}>✏️</button>
                      <button onClick={() => handleDelete(f.id)} style={{ ...btnPrimary, padding: '4px 10px', fontSize: 12 }}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
