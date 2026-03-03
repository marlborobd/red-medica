import React, { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../services/api';
import { useAuth } from '../context/AuthContext';

const EMPTY_FORM = { email: '', password: '', name: '', role: 'employee' };

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await getUsers();
      setUsers(data);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditUser(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({ email: u.email, password: '', name: u.name, role: u.role });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) { setError('Numele și email-ul sunt obligatorii'); return; }
    if (!editUser && !form.password) { setError('Parola este obligatorie pentru utilizatori noi'); return; }
    setSaving(true);
    setError('');
    try {
      if (editUser) {
        const payload = { name: form.name, role: form.role, active: editUser.active };
        if (form.password) payload.password = form.password;
        await updateUser(editUser.id, payload);
      } else {
        await createUser(form);
      }
      setShowModal(false);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Eroare la salvare');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (u) => {
    try {
      await updateUser(u.id, { name: u.name, role: u.role, active: u.active ? 0 : 1 });
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Eroare');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteUser(deleteConfirm.id);
      setDeleteConfirm(null);
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Eroare la dezactivare');
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('ro-RO') : '-';

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">👤 Utilizatori</div>
          <div className="page-subtitle">{users.length} utilizatori înregistrați</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Adaugă Utilizator</button>
      </div>

      <div className="page-body">
        <div className="card">
          {loading ? (
            <div className="loading"><div className="loading-spinner" />Se încarcă...</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Nume</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Status</th>
                    <th>Data Creare</th>
                    <th>Acțiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.name}</strong>
                        {u.id === currentUser?.id && <span className="badge badge-blue" style={{ marginLeft: 8 }}>Tu</span>}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                      <td>
                        <span className={`badge ${u.role === 'admin' ? 'badge-purple' : 'badge-blue'}`}>
                          {u.role === 'admin' ? '🛡️ Administrator' : '👤 Angajat'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${u.active ? 'badge-green' : 'badge-gray'}`}>
                          {u.active ? '✓ Activ' : '✗ Inactiv'}
                        </span>
                      </td>
                      <td>{formatDate(u.created_at)}</td>
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>✏️ Editează</button>
                          {u.id !== currentUser?.id && (
                            <button
                              className={`btn btn-sm ${u.active ? 'btn-danger' : 'btn-success'}`}
                              onClick={() => handleToggleActive(u)}
                            >
                              {u.active ? '🚫 Dezactivează' : '✓ Activează'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editUser ? '✏️ Editează Utilizator' : '+ Utilizator Nou'}</span>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger mb-2">{error}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Nume complet <span className="required">*</span></label>
                  <input className="form-control" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="ex: Ion Popescu" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email <span className="required">*</span></label>
                  <input className="form-control" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@exemplu.ro" disabled={!!editUser} />
                </div>
                <div className="form-group">
                  <label className="form-label">{editUser ? 'Parolă nouă (lăsați gol pentru a nu schimba)' : 'Parolă *'}</label>
                  <input className="form-control" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Minim 6 caractere" />
                </div>
                <div className="form-group">
                  <label className="form-label">Rol</label>
                  <select className="form-control" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                    <option value="employee">👤 Angajat</option>
                    <option value="admin">🛡️ Administrator</option>
                  </select>
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

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Dezactivare Utilizator</span>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning">
                Sigur doriți să dezactivați utilizatorul <strong>{deleteConfirm.name}</strong>?
                Acesta nu va mai putea accesa aplicația.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Anulare</button>
              <button className="btn btn-danger" onClick={handleDelete}>🚫 Dezactivează</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
