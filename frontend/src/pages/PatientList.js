import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPatients, deletePatient } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function PatientList() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getPatients(search || undefined);
      setPatients(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const handleDelete = async (id) => {
    try {
      await deletePatient(id);
      setDeleteConfirm(null);
      showToast('Pacientul a fost șters cu succes.');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Eroare la ștergere', 'error');
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('ro-RO') : '-';

  return (
    <>
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">👥 Pacienți</div>
          <div className="page-subtitle">{patients.length} pacienți</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/pacienti/nou')}>
          + Adaugă
        </button>
      </div>

      <div className="page-body">
        <div className="card mb-3">
          <div className="card-body" style={{ padding: '14px 16px' }}>
            <div className="search-bar">
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  className="search-input"
                  placeholder="Căutare după nume sau telefon..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoComplete="off"
                />
              </div>
              {search && (
                <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')} style={{ whiteSpace: 'nowrap' }}>
                  ✕ Șterge
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading">
            <div className="loading-spinner" />
            <span className="loading-text">Se încarcă pacienții...</span>
          </div>
        ) : patients.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>{search ? 'Niciun pacient găsit' : 'Nu există pacienți'}</h3>
            <p>{search ? `Nu există rezultate pentru "${search}"` : 'Adăugați primul pacient în sistem'}</p>
            {!search && (
              <button className="btn btn-primary" onClick={() => navigate('/pacienti/nou')}>
                + Adaugă Primul Pacient
              </button>
            )}
          </div>
        ) : (
          <>
            {/* MOBILE CARDS */}
            <div>
              {patients.map((p) => (
                <div
                  key={`card-${p.id}`}
                  className="patient-card-mobile"
                  onClick={() => navigate(`/pacienti/${p.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate(`/pacienti/${p.id}`)}
                >
                  <div className="pcm-header">
                    <span className="pcm-name">{p.nume}</span>
                    <span className={`badge ${p.acord_gdpr ? 'badge-green' : 'badge-red'}`}>
                      {p.acord_gdpr ? '✓ GDPR' : '✗ GDPR'}
                    </span>
                  </div>
                  <div className="pcm-body">
                    <div className="pcm-info">
                      🎂 <strong>{p.varsta ? `${p.varsta} ani` : '—'}</strong>
                    </div>
                    <div className="pcm-info">
                      📞 <strong>{p.telefon || '—'}</strong>
                    </div>
                    {p.data_nasterii && (
                      <div className="pcm-info" style={{ gridColumn: '1 / -1', fontSize: 12 }}>
                        📅 {formatDate(p.data_nasterii)}
                      </div>
                    )}
                    {p.adresa && (
                      <div className="pcm-info" style={{ gridColumn: '1 / -1', fontSize: 12 }}>
                        📍 {p.adresa}
                      </div>
                    )}
                  </div>
                  <div className="pcm-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate(`/pacienti/${p.id}`)}>
                      👁️ Profil
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/pacienti/${p.id}/vizita`)}>
                      📋 Vizită
                    </button>
                    {isAdmin && (
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(p)}>
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP TABLE */}
            <div className="card desktop-table-wrap">
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Nume</th>
                      <th>Data Nașterii</th>
                      <th>Vârstă</th>
                      <th>Telefon</th>
                      <th>GDPR</th>
                      {isAdmin && <th>Angajat</th>}
                      <th>Înregistrat</th>
                      <th>Acțiuni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map((p, idx) => (
                      <tr key={p.id}>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{idx + 1}</td>
                        <td>
                          <button
                            onClick={() => navigate(`/pacienti/${p.id}`)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 700, fontSize: 14 }}
                          >
                            {p.nume}
                          </button>
                        </td>
                        <td>{p.data_nasterii ? formatDate(p.data_nasterii) : '—'}</td>
                        <td>{p.varsta ? <span className="badge badge-blue">{p.varsta} ani</span> : '—'}</td>
                        <td>{p.telefon || '—'}</td>
                        <td>
                          {p.acord_gdpr
                            ? <span className="badge badge-green">✓ Da</span>
                            : <span className="badge badge-red">✗ Nu</span>}
                        </td>
                        {isAdmin && <td style={{ fontSize: 13 }}>{p.creator_name || '—'}</td>}
                        <td style={{ fontSize: 12 }}>{formatDate(p.data_inregistrare)}</td>
                        <td>
                          <div className="table-actions">
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate(`/pacienti/${p.id}`)} title="Profil">👁️</button>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate(`/pacienti/${p.id}/vizita`)} title="Adaugă vizită">📋</button>
                            {isAdmin && (
                              <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteConfirm(p)} title="Șterge">🗑️</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">⚠️ Confirmare Ștergere</span>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-danger">
                <span>🗑️</span>
                <div>
                  <strong>Sigur doriți să ștergeți pacientul?</strong>
                  <br />
                  <span style={{ fontSize: 15 }}>{deleteConfirm.nume}</span>
                  <br />
                  <small>Toate vizitele asociate vor fi de asemenea șterse. Această acțiune este <strong>ireversibilă</strong>!</small>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Anulare</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm.id)}>
                🗑️ Șterge Definitiv
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
