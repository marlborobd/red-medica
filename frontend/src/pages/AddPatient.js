import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPatient } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function AddPatient() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    nume: '', data_nasterii: '', varsta: '',
    adresa: '', telefon: '', acord_gdpr: false
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!form.nume.trim()) errs.nume = 'Numele este obligatoriu';
    if (form.telefon && !/^[0-9+\s\-().]{7,15}$/.test(form.telefon)) {
      errs.telefon = 'Număr de telefon invalid';
    }
    if (form.varsta && (isNaN(form.varsta) || form.varsta < 0 || form.varsta > 150)) {
      errs.varsta = 'Vârstă invalidă';
    }
    return errs;
  };

  const doSave = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    setApiError('');
    createPatient(form)
      .then(({ data }) => navigate(`/pacienti/${data.id}`))
      .catch(err => setApiError(err.response?.data?.error || 'Eroare la salvare. Încercați din nou.'))
      .finally(() => setLoading(false));
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">+ Pacient Nou</div>
          <div className="page-subtitle">Completați datele pacientului</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/pacienti')}>
          ← Înapoi
        </button>
      </div>

      <div className="page-body" style={{ paddingBottom: 100 }}>
        {apiError && (
          <div className="alert alert-danger mb-3">
            <span>⚠️</span>
            <span>{apiError}</span>
          </div>
        )}

        {/* Identitate */}
        <div className="card mb-3">
          <div className="card-header">
            <span className="card-title">👤 Date de Identificare</span>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="form-group form-full">
                <label className="form-label" htmlFor="nume">
                  Nume complet <span className="required">*</span>
                </label>
                <input
                  id="nume"
                  name="nume"
                  className={`form-control ${errors.nume ? 'error' : ''}`}
                  placeholder="ex: Ionescu Maria"
                  value={form.nume}
                  onChange={handleChange}
                  autoComplete="name"
                />
                {errors.nume && <span className="form-error">⚠️ {errors.nume}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="data_nasterii">Data Nașterii</label>
                <input
                  id="data_nasterii"
                  name="data_nasterii"
                  type="date"
                  className="form-control"
                  value={form.data_nasterii}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="varsta">Vârstă (ani)</label>
                <input
                  id="varsta"
                  name="varsta"
                  type="number"
                  min="0"
                  max="150"
                  className={`form-control ${errors.varsta ? 'error' : ''}`}
                  placeholder="ex: 65"
                  value={form.varsta}
                  onChange={handleChange}
                  inputMode="numeric"
                />
                {errors.varsta && <span className="form-error">⚠️ {errors.varsta}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="card mb-3">
          <div className="card-header">
            <span className="card-title">📞 Date de Contact</span>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="telefon">Telefon</label>
                <input
                  id="telefon"
                  name="telefon"
                  type="tel"
                  className={`form-control ${errors.telefon ? 'error' : ''}`}
                  placeholder="ex: 0722 123 456"
                  value={form.telefon}
                  onChange={handleChange}
                  inputMode="tel"
                  autoComplete="tel"
                />
                {errors.telefon && <span className="form-error">⚠️ {errors.telefon}</span>}
              </div>

              <div className="form-group form-full">
                <label className="form-label" htmlFor="adresa">Adresă</label>
                <textarea
                  id="adresa"
                  name="adresa"
                  className="form-control"
                  placeholder="Str. Exemplu, nr. 1, Localitate, Județ"
                  value={form.adresa}
                  onChange={handleChange}
                  rows={3}
                  autoComplete="street-address"
                />
              </div>
            </div>
          </div>
        </div>

        {/* GDPR + Info auto */}
        <div className="card mb-3">
          <div className="card-header">
            <span className="card-title">🔒 GDPR și Informații Sistem</span>
          </div>
          <div className="card-body">
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="acord_gdpr"
                name="acord_gdpr"
                checked={form.acord_gdpr}
                onChange={handleChange}
              />
              <label htmlFor="acord_gdpr">
                <strong>Acord GDPR</strong> — Pacientul și-a exprimat acordul pentru prelucrarea datelor cu caracter personal în conformitate cu GDPR
              </label>
            </div>

            <div className="divider" />

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Angajat Creator</label>
                <input className="form-control" value={user?.name || ''} readOnly />
              </div>
              <div className="form-group">
                <label className="form-label">Data Înregistrare</label>
                <input className="form-control" value={new Date().toLocaleDateString('ro-RO')} readOnly />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div style={{
        position: 'fixed',
        bottom: 'var(--bottom-nav-height, 0)',
        left: 0, right: 0,
        background: 'white',
        borderTop: '1px solid var(--border)',
        padding: '12px 20px',
        display: 'flex',
        gap: 12,
        justifyContent: 'flex-end',
        zIndex: 50,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.08)'
      }}>
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/pacienti')}>
          Anulare
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={loading}
          onClick={doSave}
          style={{ minWidth: 160 }}
        >
          {loading
            ? <><div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Se salvează...</>
            : '💾 Salvează Pacient'}
        </button>
      </div>
    </>
  );
}
