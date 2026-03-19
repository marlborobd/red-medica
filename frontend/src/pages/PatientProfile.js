import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPatient, getVisits, deleteVisit, updatePatient, createScheduledVisit, getEmployees, setPatientSold } from '../services/api';
import { useAuth } from '../context/AuthContext';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatDateRo(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function parsePoze(pozeStr) {
  try { return JSON.parse(pozeStr || '[]'); } catch (_) { return []; }
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="toast-container">
      <div className={`toast ${type}`}>{message}</div>
    </div>
  );
}

export default function PatientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('date');
  const [deleteVisitId, setDeleteVisitId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [expandedVisit, setExpandedVisit] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [toast, setToast] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [scheduleType, setScheduleType] = useState('simpla');
  const [scheduleForm, setScheduleForm] = useState({ data_programata: '', ora_programata: '', angajat_responsabil: '' });
  const [multipleForm, setMultipleForm] = useState({ data_inceput: '', data_sfarsit: '', ora_programata: '', angajat_responsabil: '' });
  const [employees, setEmployees] = useState([]);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [soldInput, setSoldInput] = useState('');
  const [soldSaving, setSoldSaving] = useState(false);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const openScheduleModal = () => {
    const today = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().substring(0, 5);
    setScheduleType('simpla');
    setScheduleForm({ data_programata: today, ora_programata: time, angajat_responsabil: '' });
    setMultipleForm({ data_inceput: today, data_sfarsit: today, ora_programata: time, angajat_responsabil: '' });
    setScheduleError('');
    setScheduleModal(true);
    if (employees.length === 0) {
      getEmployees().then(({ data }) => setEmployees(data)).catch(() => {});
    }
  };

  const countZileMultiple = () => {
    if (!multipleForm.data_inceput || !multipleForm.data_sfarsit) return 0;
    const start = new Date(multipleForm.data_inceput);
    const end = new Date(multipleForm.data_sfarsit);
    if (isNaN(start) || isNaN(end) || end < start) return 0;
    return Math.round((end - start) / 86400000) + 1;
  };

  const formatDateRoShort = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}.${y}`;
  };

  const handleScheduleSave = async () => {
    setScheduleSaving(true);
    setScheduleError('');
    try {
      if (scheduleType === 'multipla') {
        if (!multipleForm.data_inceput || !multipleForm.data_sfarsit || !multipleForm.ora_programata) {
          setScheduleError('Data Inceput, Data Sfarsit si Ora sunt obligatorii');
          setScheduleSaving(false);
          return;
        }
        const nrZile = countZileMultiple();
        if (nrZile <= 0) {
          setScheduleError('Data Sfarsit trebuie sa fie dupa Data Inceput');
          setScheduleSaving(false);
          return;
        }
        const payload = {
          pacient_id: parseInt(id),
          data_inceput: multipleForm.data_inceput,
          data_sfarsit: multipleForm.data_sfarsit,
          ora_programata: multipleForm.ora_programata,
        };
        if (multipleForm.angajat_responsabil) {
          payload.angajat_responsabil = parseInt(multipleForm.angajat_responsabil);
        }
        const { data } = await createScheduledVisit(payload);
        setScheduleModal(false);
        showToast(`${data.count} vizite programate intre ${formatDateRoShort(data.data_inceput)} si ${formatDateRoShort(data.data_sfarsit)}. Angajatul a primit notificare.`);
      } else {
        if (!scheduleForm.data_programata || !scheduleForm.ora_programata) {
          setScheduleError('Data si ora sunt obligatorii');
          setScheduleSaving(false);
          return;
        }
        const payload = {
          pacient_id: parseInt(id),
          data_programata: scheduleForm.data_programata,
          ora_programata: scheduleForm.ora_programata,
        };
        if (scheduleForm.angajat_responsabil) {
          payload.angajat_responsabil = parseInt(scheduleForm.angajat_responsabil);
        }
        await createScheduledVisit(payload);
        setScheduleModal(false);
        showToast('Vizita a fost programata cu succes. Angajatul a primit notificare.');
      }
    } catch (err) {
      setScheduleError(err.response?.data?.error || 'Eroare la programare');
    } finally {
      setScheduleSaving(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pRes, vRes] = await Promise.all([getPatient(id), getVisits(id)]);
      setPatient(pRes.data);
      setVisits(vRes.data);
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 403) navigate('/pacienti');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVisit = async () => {
    try {
      await deleteVisit(deleteVisitId);
      setDeleteVisitId(null);
      showToast('Vizita a fost ștearsă cu succes.');
      loadData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Eroare la ștergere', 'error');
    }
  };

  const startEdit = () => {
    setEditForm({
      nume: patient.nume,
      data_nasterii: patient.data_nasterii || '',
      varsta: patient.varsta || '',
      adresa: patient.adresa || '',
      telefon: patient.telefon || '',
      acord_gdpr: patient.acord_gdpr === 1
    });
    setEditMode(true);
    setEditError('');
  };

  const handleEditSave = async () => {
    if (!editForm.nume?.trim()) { setEditError('Numele este obligatoriu'); return; }
    setEditLoading(true);
    setEditError('');
    try {
      await updatePatient(id, editForm);
      setEditMode(false);
      showToast('Datele pacientului au fost actualizate.');
      loadData();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Eroare la salvare');
    } finally {
      setEditLoading(false);
    }
  };

  const stareColor = (stare) => {
    if (!stare) return 'badge-gray';
    const s = stare.toLowerCase();
    if (s.includes('bun') || s.includes('stabi') || s.includes('amelior') || s.includes('recup')) return 'badge-green';
    if (s.includes('grav') || s.includes('critic')) return 'badge-red';
    if (s.includes('mediu') || s.includes('moderat') || s.includes('agrav')) return 'badge-orange';
    return 'badge-blue';
  };

  if (loading) return (
    <div className="loading">
      <div className="loading-spinner" />
      <span className="loading-text">Se încarcă profilul pacientului...</span>
    </div>
  );
  if (!patient) return null;

  const totalFacturat = visits.reduce((s, v) => s + (Number(v.suma_de_plata) || 0), 0);
  const totalIncasat = visits.reduce((s, v) => s + (Number(v.suma_incasata) || 0), 0);

  const soldInitial = Number(patient?.sold_initial) || 0;
  const soldRamas = Number(patient?.sold_ramas) || 0;
  const soldEditable = soldRamas <= 0;

  const handleSetSold = async () => {
    if (!soldInput && soldInput !== 0) return;
    setSoldSaving(true);
    try {
      await setPatientSold(id, soldInput);
      showToast('Suma de plată a fost setată.');
      loadData();
      setSoldInput('');
    } catch (err) {
      showToast(err.response?.data?.error || 'Eroare la setare sold', 'error');
    } finally {
      setSoldSaving(false);
    }
  };

  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <div className="page-title">Profil Pacient</div>
          <div className="page-subtitle">{patient.nume}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/pacienti')}>← Înapoi</button>
          <button className="btn btn-secondary btn-sm" onClick={startEdit}>✏️ Editează</button>
          <button className="btn btn-ghost btn-sm" onClick={openScheduleModal} style={{ color: 'var(--primary)' }}>📅 Programează</button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate(`/pacienti/${id}/vizita`)}>+ Vizită</button>
        </div>
      </div>

      <div className="page-body">
        {/* Profile header */}
        <div className="profile-header mb-2">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                <h2 style={{ margin: 0 }}>{patient.nume}</h2>
                {patient.telefon && (
                  <a
                    href={`tel:${patient.telefon.replace(/\s/g, '')}`}
                    title={`Apelează: ${patient.telefon}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: '#16a34a', color: 'white',
                      borderRadius: 20, padding: '5px 14px',
                      fontSize: 13, fontWeight: 700, textDecoration: 'none',
                      boxShadow: '0 2px 6px rgba(22,163,74,0.3)'
                    }}
                  >
                    Apelează
                  </a>
                )}
                {patient.adresa && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(patient.adresa)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Navigare Google Maps"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: '#2563eb', color: 'white',
                      borderRadius: 20, padding: '5px 14px',
                      fontSize: 13, fontWeight: 700, textDecoration: 'none',
                      boxShadow: '0 2px 6px rgba(37,99,235,0.3)'
                    }}
                  >
                    Navigare
                  </a>
                )}
              </div>
              <div className="profile-meta">
                <div className="profile-meta-item">🎂 <strong>{patient.varsta ? `${patient.varsta} ani` : 'N/A'}</strong></div>
                {patient.data_nasterii && <div className="profile-meta-item">📅 {formatDateRo(patient.data_nasterii)}</div>}
                {patient.telefon && <div className="profile-meta-item">📞 <strong>{patient.telefon}</strong></div>}
                {patient.adresa && <div className="profile-meta-item">📍 {patient.adresa}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className={`badge ${patient.acord_gdpr ? 'badge-green' : 'badge-red'}`} style={{ padding: '7px 14px', fontSize: 12 }}>
                {patient.acord_gdpr ? '✓ GDPR Acordat' : '✗ GDPR Neacordat'}
              </span>
              <span className="badge badge-blue" style={{ padding: '7px 14px', fontSize: 12 }}>
                {visits.length} vizite
              </span>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Vizite', value: visits.length, icon: '📋' },
            { label: 'Ultima vizită', value: visits[0] ? formatDate(visits[0].data) : '—', icon: '📅' },
            { label: 'Total facturat', value: `${totalFacturat.toLocaleString('ro-RO')} lei`, icon: '💳' },
            { label: 'Total încasat', value: `${totalIncasat.toLocaleString('ro-RO')} lei`, icon: '💰' }
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', padding: '14px 12px', textAlign: 'center', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)', lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div className="profile-tabs">
          <button className={`tab-btn ${activeTab === 'date' ? 'active' : ''}`} onClick={() => setActiveTab('date')}>
            📋 Date Personale
          </button>
          <button className={`tab-btn ${activeTab === 'vizite' ? 'active' : ''}`} onClick={() => setActiveTab('vizite')}>
            📅 Vizite <span className="badge badge-blue" style={{ marginLeft: 6, fontSize: 11, padding: '2px 8px' }}>{visits.length}</span>
          </button>
        </div>

        {/* Tab: Date Personale */}
        {activeTab === 'date' && (
          <div className="tab-content">
            <div className="profile-grid">
              <div className="card">
                <div className="card-header">
                  <span className="card-title">📋 Date Personale</span>
                  <button className="btn btn-ghost btn-sm" onClick={startEdit}>✏️ Editează</button>
                </div>
                <div className="card-body">
                  <div className="info-list">
                    {[
                      { label: 'Nume', value: <strong>{patient.nume}</strong> },
                      { label: 'Data Nașterii', value: formatDateRo(patient.data_nasterii) },
                      { label: 'Vârstă', value: patient.varsta ? `${patient.varsta} ani` : '—' },
                      { label: 'Adresă', value: patient.adresa || '—' },
                      { label: 'Telefon', value: patient.telefon || '—' },
                      {
                        label: 'Acord GDPR',
                        value: <span className={`badge ${patient.acord_gdpr ? 'badge-green' : 'badge-red'}`}>
                          {patient.acord_gdpr ? '✓ Acordat' : '✗ Neacordat'}
                        </span>
                      },
                      { label: 'Angajat Creator', value: patient.creator_name || '—' },
                      { label: 'Data Înregistrare', value: formatDate(patient.data_inregistrare) }
                    ].map(({ label, value }) => (
                      <div key={label} className="info-row">
                        <span className="info-label">{label}</span>
                        <span className="info-value">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><span className="card-title">📊 Sumar Financiar</span></div>
                <div className="card-body">
                  <div className="info-list">
                    <div className="info-row"><span className="info-label">Total Vizite</span><span className="info-value"><strong>{visits.length}</strong></span></div>
                    <div className="info-row"><span className="info-label">Total Facturat</span><span className="info-value"><strong>{totalFacturat.toLocaleString('ro-RO')} lei</strong></span></div>
                    <div className="info-row"><span className="info-label">Total Încasat</span><span className="info-value" style={{ color: 'var(--secondary)', fontWeight: 700 }}>{totalIncasat.toLocaleString('ro-RO')} lei</span></div>
                    <div className="info-row">
                      <span className="info-label">Rest de Plată</span>
                      <span className="info-value" style={{ color: totalFacturat - totalIncasat > 0 ? 'var(--danger)' : 'var(--secondary)', fontWeight: 700 }}>
                        {(totalFacturat - totalIncasat).toLocaleString('ro-RO')} lei
                      </span>
                    </div>
                    <div className="info-row"><span className="info-label">Prima Vizită</span><span className="info-value">{visits.length > 0 ? formatDate(visits[visits.length - 1]?.data) : '—'}</span></div>
                    <div className="info-row"><span className="info-label">Ultima Vizită</span><span className="info-value">{visits[0] ? formatDate(visits[0].data) : '—'}</span></div>
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <button className="btn btn-primary w-100" onClick={() => navigate(`/pacienti/${id}/vizita`)}>
                      + Adaugă Vizită Nouă
                    </button>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><span className="card-title">💳 Plăți</span></div>
                <div className="card-body">
                  <div className="info-list" style={{ marginBottom: 16 }}>
                    <div className="info-row">
                      <span className="info-label">Sumă Inițială</span>
                      <span className="info-value"><strong>{soldInitial.toLocaleString('ro-RO')} lei</strong></span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Total Încasat</span>
                      <span className="info-value" style={{ color: 'var(--secondary)', fontWeight: 700 }}>{totalIncasat.toLocaleString('ro-RO')} lei</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Sold Rămas</span>
                      <span className="info-value" style={{ color: soldRamas <= 0 ? 'var(--secondary)' : 'var(--danger)', fontWeight: 700 }}>
                        {soldRamas.toLocaleString('ro-RO')} lei
                      </span>
                    </div>
                  </div>
                  {soldRamas <= 0 && soldInitial > 0 && (
                    <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '8px 12px', marginBottom: 14, color: '#15803d', fontWeight: 700, fontSize: 14 }}>
                      ✓ Achitat complet
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Sumă De Plată (lei)</label>
                    {soldEditable ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-control"
                          placeholder="0.00"
                          value={soldInput}
                          onChange={e => setSoldInput(e.target.value)}
                          inputMode="decimal"
                        />
                        <button className="btn btn-primary" onClick={handleSetSold} disabled={soldSaving || soldInput === ''} style={{ whiteSpace: 'nowrap' }}>
                          {soldSaving ? 'Se salvează...' : 'Setează'}
                        </button>
                      </div>
                    ) : (
                      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 14, color: 'var(--danger)', fontWeight: 700 }}>
                        Sold rămas: {soldRamas.toLocaleString('ro-RO')} lei
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Vizite */}
        {activeTab === 'vizite' && (
          <div className="tab-content">
            <div className="card">
              <div className="card-header">
                <span className="card-title">📅 Istoric Vizite ({visits.length})</span>
                <button className="btn btn-primary btn-sm" onClick={() => navigate(`/pacienti/${id}/vizita`)}>+ Vizită Nouă</button>
              </div>
              <div className="card-body" style={{ padding: '16px' }}>
                {visits.length === 0 ? (
                  <div className="empty-state" style={{ padding: 40 }}>
                    <div className="empty-icon">📋</div>
                    <h3>Nicio vizită înregistrată</h3>
                    <p>Adăugați prima vizită pentru acest pacient</p>
                    <button className="btn btn-primary" onClick={() => navigate(`/pacienti/${id}/vizita`)}>+ Adaugă Prima Vizită</button>
                  </div>
                ) : (
                  visits.map(v => {
                    const poze = parsePoze(v.poze);
                    return (
                      <div
                        key={v.id}
                        className="visit-card"
                        style={{
                          borderLeftColor: v.stare_pacient && (v.stare_pacient.toLowerCase().includes('grav') || v.stare_pacient.toLowerCase().includes('critic'))
                            ? 'var(--danger)' : 'var(--primary)'
                        }}
                      >
                        <div className="visit-header">
                          <div>
                            <span className="visit-date">📅 {formatDate(v.data)}</span>
                            {v.ora && <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--text-secondary)' }}>🕐 {v.ora}</span>}
                            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-secondary)' }}>👤 {v.angajat_name}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            {v.stare_pacient && <span className={`badge ${stareColor(v.stare_pacient)}`}>{v.stare_pacient}</span>}
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setExpandedVisit(expandedVisit === v.id ? null : v.id)} title={expandedVisit === v.id ? 'Restrânge' : 'Extinde'}>
                              {expandedVisit === v.id ? '▲' : '▼'}
                            </button>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate(`/pacienti/${id}/vizita/${v.id}`)} title="Editează vizita">✏️</button>
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteVisitId(v.id)} title="Șterge vizita">🗑️</button>
                          </div>
                        </div>

                        {/* Sumar mereu vizibil */}
                        <div className="visit-details">
                          {v.diagnostic && <div className="visit-detail"><span className="label">Diagnostic: </span><span className="value">{v.diagnostic}</span></div>}
                          {v.tensiune && <div className="visit-detail"><span className="label">Tensiune: </span><span className="value">{v.tensiune}</span></div>}
                          {v.temperatura && <div className="visit-detail"><span className="label">Temp.: </span><span className="value">{v.temperatura}°C</span></div>}
                          {Number(v.suma_incasata) > 0 && (
                            <div className="visit-detail">
                              <span className="label">Încasat: </span>
                              <span className="value" style={{ color: 'var(--secondary)', fontWeight: 700 }}>{Number(v.suma_incasata).toLocaleString('ro-RO')} lei</span>
                            </div>
                          )}
                        </div>

                        {/* Poze - mereu vizibile */}
                        {poze.length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                              📷 Fotografii / Rețete ({poze.length})
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {poze.map((url, i) => (
                                <img
                                  key={i}
                                  src={url}
                                  alt={`Fotografie ${i + 1}`}
                                  onClick={() => setLightboxUrl(url)}
                                  style={{
                                    width: 72, height: 72,
                                    objectFit: 'cover',
                                    borderRadius: 8,
                                    border: '2px solid var(--border)',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s'
                                  }}
                                  onMouseOver={e => e.target.style.transform = 'scale(1.08)'}
                                  onMouseOut={e => e.target.style.transform = 'scale(1)'}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Detalii extinse */}
                        {expandedVisit === v.id && (
                          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
                            <div className="visit-details">
                              {v.tratament && <div className="visit-detail"><span className="label">Tratament: </span><span className="value">{v.tratament}</span></div>}
                              {v.medicamente && <div className="visit-detail"><span className="label">Medicamente: </span><span className="value">{v.medicamente}</span></div>}
                              {v.cass && <div className="visit-detail"><span className="label">CASS: </span><span className="value">{v.cass}</span></div>}
                              {v.zile_cass > 0 && <div className="visit-detail"><span className="label">Zile CASS: </span><span className="value">{v.zile_cass}</span></div>}
                              {v.perioada_tratament_inceput && (
                                <div className="visit-detail">
                                  <span className="label">Perioadă: </span>
                                  <span className="value">{formatDate(v.perioada_tratament_inceput)} — {formatDate(v.perioada_tratament_sfarsit)}</span>
                                </div>
                              )}
                              {v.servicii_efectuate && <div className="visit-detail" style={{ gridColumn: '1/-1' }}><span className="label">Servicii: </span><span className="value">{v.servicii_efectuate}</span></div>}
                              {v.observatii && <div className="visit-detail" style={{ gridColumn: '1/-1' }}><span className="label">Observații: </span><span className="value">{v.observatii}</span></div>}
                              {Number(v.suma_de_plata) > 0 && <div className="visit-detail"><span className="label">Facturat: </span><span className="value">{Number(v.suma_de_plata).toLocaleString('ro-RO')} lei</span></div>}
                            </div>

                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal programare vizita */}
      {scheduleModal && (
        <div className="modal-overlay" onClick={() => setScheduleModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">📅 Programează Vizită</span>
              <button className="modal-close" onClick={() => setScheduleModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {scheduleError && <div className="alert alert-danger mb-2">⚠️ {scheduleError}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Toggle Vizita Simpla / Multipla */}
                <div style={{ display: 'flex', gap: 8, background: '#f5f5f5', borderRadius: 8, padding: 4 }}>
                  <button
                    type="button"
                    onClick={() => { setScheduleType('simpla'); setScheduleError(''); }}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                      fontWeight: 700, fontSize: 14,
                      background: scheduleType === 'simpla' ? 'var(--primary)' : 'transparent',
                      color: scheduleType === 'simpla' ? '#fff' : 'var(--text-secondary)',
                      transition: 'all 0.2s'
                    }}
                  >
                    Vizită Simplă
                  </button>
                  <button
                    type="button"
                    onClick={() => { setScheduleType('multipla'); setScheduleError(''); }}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                      fontWeight: 700, fontSize: 14,
                      background: scheduleType === 'multipla' ? 'var(--primary)' : 'transparent',
                      color: scheduleType === 'multipla' ? '#fff' : 'var(--text-secondary)',
                      transition: 'all 0.2s'
                    }}
                  >
                    Vizită Multiplă
                  </button>
                </div>

                {scheduleType === 'simpla' ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">Data Vizitei <span className="required">*</span></label>
                      <input
                        type="date"
                        className="form-control"
                        value={scheduleForm.data_programata}
                        onChange={e => setScheduleForm(p => ({ ...p, data_programata: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Ora Vizitei <span className="required">*</span></label>
                      <input
                        type="time"
                        className="form-control"
                        value={scheduleForm.ora_programata}
                        onChange={e => setScheduleForm(p => ({ ...p, ora_programata: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Angajat Responsabil</label>
                      <select
                        className="form-control"
                        value={scheduleForm.angajat_responsabil}
                        onChange={e => setScheduleForm(p => ({ ...p, angajat_responsabil: e.target.value }))}
                      >
                        <option value="">— Eu (utilizatorul curent) —</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label">Data Început <span className="required">*</span></label>
                      <input
                        type="date"
                        className="form-control"
                        value={multipleForm.data_inceput}
                        onChange={e => setMultipleForm(p => ({ ...p, data_inceput: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Data Sfârșit <span className="required">*</span></label>
                      <input
                        type="date"
                        className="form-control"
                        value={multipleForm.data_sfarsit}
                        onChange={e => setMultipleForm(p => ({ ...p, data_sfarsit: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Ora Vizitei <span className="required">*</span></label>
                      <input
                        type="time"
                        className="form-control"
                        value={multipleForm.ora_programata}
                        onChange={e => setMultipleForm(p => ({ ...p, ora_programata: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Angajat Responsabil</label>
                      <select
                        className="form-control"
                        value={multipleForm.angajat_responsabil}
                        onChange={e => setMultipleForm(p => ({ ...p, angajat_responsabil: e.target.value }))}
                      >
                        <option value="">— Eu (utilizatorul curent) —</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                      </select>
                    </div>
                    {countZileMultiple() > 0 && (
                      <div style={{
                        background: '#E3F2FD', border: '1px solid #90CAF9', borderRadius: 8,
                        padding: '10px 14px', fontSize: 14, fontWeight: 700, color: '#1565C0'
                      }}>
                        📅 {countZileMultiple()} vizite programate între {formatDateRoShort(multipleForm.data_inceput)} și {formatDateRoShort(multipleForm.data_sfarsit)}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setScheduleModal(false)}>Anulare</button>
              <button className="btn btn-primary" onClick={handleScheduleSave} disabled={scheduleSaving}>
                {scheduleSaving ? 'Se salvează...' : '📅 Programează'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editare pacient */}
      {editMode && (
        <div className="modal-overlay" onClick={() => setEditMode(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">✏️ Editează Pacient</span>
              <button className="modal-close" onClick={() => setEditMode(false)}>✕</button>
            </div>
            <div className="modal-body">
              {editError && <div className="alert alert-danger mb-2">⚠️ {editError}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Nume <span className="required">*</span></label>
                  <input className="form-control" value={editForm.nume || ''} onChange={e => setEditForm(p => ({ ...p, nume: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Data Nașterii</label>
                  <input className="form-control" type="date" value={editForm.data_nasterii || ''} onChange={e => setEditForm(p => ({ ...p, data_nasterii: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Vârstă (ani)</label>
                  <input className="form-control" type="number" min="0" max="150" value={editForm.varsta || ''} onChange={e => setEditForm(p => ({ ...p, varsta: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Adresă</label>
                  <textarea className="form-control" rows={2} value={editForm.adresa || ''} onChange={e => setEditForm(p => ({ ...p, adresa: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefon</label>
                  <input className="form-control" type="tel" value={editForm.telefon || ''} onChange={e => setEditForm(p => ({ ...p, telefon: e.target.value }))} />
                </div>
                <div className="checkbox-group">
                  <input type="checkbox" id="edit_gdpr" checked={editForm.acord_gdpr || false} onChange={e => setEditForm(p => ({ ...p, acord_gdpr: e.target.checked }))} />
                  <label htmlFor="edit_gdpr">Pacientul și-a exprimat acordul GDPR</label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditMode(false)}>Anulare</button>
              <button className="btn btn-primary" onClick={handleEditSave} disabled={editLoading}>
                {editLoading ? 'Se salvează...' : '💾 Salvează Modificările'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox foto */}
      {lightboxUrl && (
        <div
          className="modal-overlay"
          onClick={() => setLightboxUrl(null)}
          style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
            <button
              onClick={() => setLightboxUrl(null)}
              style={{
                position: 'absolute', top: -14, right: -14,
                background: 'white', border: '1px solid var(--border)',
                borderRadius: '50%', width: 30, height: 30,
                cursor: 'pointer', fontWeight: 700, fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1, boxShadow: 'var(--shadow)'
              }}
            >✕</button>
            <img
              src={lightboxUrl}
              alt="Fotografie"
              style={{
                maxWidth: '90vw', maxHeight: '85vh',
                objectFit: 'contain', borderRadius: 8,
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)'
              }}
            />
          </div>
        </div>
      )}

      {/* Modal ștergere vizită */}
      {deleteVisitId && (
        <div className="modal-overlay" onClick={() => setDeleteVisitId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">⚠️ Șterge Vizita</span>
              <button className="modal-close" onClick={() => setDeleteVisitId(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-danger">
                <span>🗑️</span>
                <div>
                  <strong>Sigur doriți să ștergeți această vizită?</strong><br />
                  <small>Acțiunea este ireversibilă și toate datele vizitei vor fi pierdute.</small>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteVisitId(null)}>Anulare</button>
              <button className="btn btn-danger" onClick={handleDeleteVisit}>🗑️ Șterge Vizita</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
