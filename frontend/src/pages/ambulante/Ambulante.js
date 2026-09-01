import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAmbulante, createAmbulanta, updateAmbulanta, deleteAmbulanta } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const NR_REGEX = /^[A-Z]{1,2}[0-9]{2,3}[A-Z]{3}$/;
const EMPTY_FORM = { numar_inmatriculare: '', odometru_curent: '' };

export default function Ambulante() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [ambulante, setAmbulante] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editAmb, setEditAmb] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { loadAmbulante(); }, []);

  const loadAmbulante = async () => {
    setLoading(true);
    try {
      const { data } = await getAmbulante();
      setAmbulante(data);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditAmb(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (amb) => {
    setEditAmb(amb);
    setForm({ numar_inmatriculare: amb.numar_inmatriculare, odometru_curent: String(amb.odometru_curent) });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    const nr = form.numar_inmatriculare.trim().toUpperCase();
    if (!NR_REGEX.test(nr)) {
      setError('Numărul de înmatriculare este invalid (ex: B123ABC)');
      return;
    }
    const odometru = parseFloat(form.odometru_curent);
    if (isNaN(odometru) || odometru < 0) {
      setError('Odometrul trebuie să fie un număr pozitiv');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editAmb) {
        await updateAmbulanta(editAmb.id, { numar_inmatriculare: nr, odometru_curent: odometru });
      } else {
        await createAmbulanta({ numar_inmatriculare: nr, odometru_curent: odometru });
      }
      setShowModal(false);
      loadAmbulante();
    } catch (err) {
      setError(err.response?.data?.error || 'Eroare la salvare');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAmbulanta(deleteConfirm.id);
      setDeleteConfirm(null);
      loadAmbulante();
    } catch (err) {
      alert(err.response?.data?.error || 'Eroare la ștergere');
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">🚑 Ambulanță</div>
          <div className="page-subtitle">{ambulante.length} ambulanțe înregistrate</div>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openAdd}>+ Adaugă Ambulanță</button>
        )}
      </div>

      <div className="page-body">
        <div className="card">
          {loading ? (
            <div className="loading"><div className="loading-spinner" />Se încarcă...</div>
          ) : ambulante.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🚑</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Nicio ambulanță înregistrată</div>
              {isAdmin && (
                <div style={{ marginTop: 8, fontSize: 14 }}>Adaugă prima ambulanță folosind butonul de mai sus.</div>
              )}
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Nr. Înmatriculare</th>
                    <th className="col-num">Odometru curent (km)</th>
                    <th className="col-p2">Ultima Activitate</th>
                    {isAdmin && <th>Acțiuni</th>}
                  </tr>
                </thead>
                <tbody>
                  {ambulante.map(amb => (
                    <tr
                      key={amb.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/ambulante/${amb.id}`)}
                    >
                      <td>
                        <strong style={{ fontSize: 15 }}>{amb.numar_inmatriculare}</strong>
                      </td>
                      <td className="col-num">{amb.odometru_curent.toLocaleString('ro-RO')} km</td>
                      <td className="col-p2" style={{ color: 'var(--text-secondary)' }}>
                        {formatDate(amb.ultima_activitate)}
                      </td>
                      {isAdmin && (
                        <td onClick={e => e.stopPropagation()}>
                          <div className="table-actions">
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(amb)}>✏️ Editează</button>
                            <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(amb)}>🗑️ Șterge</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editAmb ? '✏️ Editează Ambulanță' : '+ Ambulanță Nouă'}</span>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger mb-2">{error}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Nr. Înmatriculare <span className="required">*</span></label>
                  <input
                    className="form-control"
                    value={form.numar_inmatriculare}
                    onChange={e => setForm(p => ({ ...p, numar_inmatriculare: e.target.value.toUpperCase() }))}
                    placeholder="ex: B123ABC"
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    {editAmb ? 'Odometru curent (km) — corecție manuală' : 'Odometru inițial (km)'} <span className="required">*</span>
                  </label>
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.odometru_curent}
                    onChange={e => setForm(p => ({ ...p, odometru_curent: e.target.value }))}
                    placeholder="ex: 125000"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Anulare</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Se salvează...' : '💾 Salvează'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Ștergere Ambulanță</span>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning">
                Sigur doriți să ștergeți ambulanța <strong>{deleteConfirm.numar_inmatriculare}</strong>?
                Toate zilele și cursele asociate vor fi șterse definitiv.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Anulare</button>
              <button className="btn btn-danger" onClick={handleDelete}>🗑️ Șterge</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
