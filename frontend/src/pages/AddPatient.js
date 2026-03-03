import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPatient } from '../services/api';
import { useAuth } from '../context/AuthContext';

function extractBirthDateFromCNP(cnp) {
  if (!cnp || cnp.length !== 13 || !/^\d{13}$/.test(cnp)) return null;
  const s = parseInt(cnp[0]);
  const yearSuffix = parseInt(cnp.substring(1, 3));
  const month = cnp.substring(3, 5);
  const day = cnp.substring(5, 7);
  let year;
  if (s === 1 || s === 2) year = 1900 + yearSuffix;
  else if (s === 3 || s === 4) year = 1800 + yearSuffix;
  else if (s === 5 || s === 6) year = 2000 + yearSuffix;
  else return null;
  const d = new Date(`${year}-${month}-${day}`);
  if (isNaN(d.getTime())) return null;
  return `${year}-${month}-${day}`;
}

function calculateAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatDateRo(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

export default function AddPatient() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    nume: '', cnp: '', adresa: '', telefon: '', acord_gdpr: false
  });
  const [computed, setComputed] = useState({ data_nasterii: '', varsta: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newVal = type === 'checkbox' ? checked : value;
    setForm(prev => ({ ...prev, [name]: newVal }));
    setErrors(prev => ({ ...prev, [name]: '' }));

    if (name === 'cnp') {
      const birthDate = extractBirthDateFromCNP(value);
      const age = calculateAge(birthDate);
      setComputed({
        data_nasterii: birthDate || '',
        varsta: age !== null ? String(age) : ''
      });
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.nume.trim()) errs.nume = 'Numele este obligatoriu';
    if (!form.cnp) errs.cnp = 'CNP-ul este obligatoriu';
    else if (!/^\d{13}$/.test(form.cnp)) errs.cnp = 'CNP-ul trebuie să aibă exact 13 cifre';
    else if (!computed.data_nasterii) errs.cnp = 'CNP invalid — verificați primul cifru și data';
    if (form.telefon && !/^[0-9+\s\-().]{7,15}$/.test(form.telefon)) {
      errs.telefon = 'Număr de telefon invalid';
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    setApiError('');
    try {
      const { data } = await createPatient(form);
      navigate(`/pacienti/${data.id}`);
    } catch (err) {
      setApiError(err.response?.data?.error || 'Eroare la salvare. Încercați din nou.');
    } finally {
      setLoading(false);
    }
  };

  const cnpValid = form.cnp.length === 13 && computed.data_nasterii;

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
        <form onSubmit={handleSubmit} noValidate>
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
                  <label className="form-label" htmlFor="cnp">
                    CNP <span className="required">*</span>
                  </label>
                  <input
                    id="cnp"
                    name="cnp"
                    className={`form-control ${errors.cnp ? 'error' : cnpValid ? '' : ''}`}
                    placeholder="13 cifre"
                    value={form.cnp}
                    onChange={handleChange}
                    maxLength={13}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    style={{ fontFamily: 'monospace', letterSpacing: 2, fontSize: 18 }}
                  />
                  {errors.cnp && <span className="form-error">⚠️ {errors.cnp}</span>}
                  {!errors.cnp && cnpValid && (
                    <span className="form-hint" style={{ color: 'var(--secondary)' }}>
                      ✓ CNP valid
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Data Nașterii (din CNP)</label>
                  <input
                    className="form-control"
                    value={computed.data_nasterii ? formatDateRo(computed.data_nasterii) : ''}
                    readOnly
                    placeholder="Extrasă automat din CNP"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Vârstă (calculată automat)</label>
                  <input
                    className="form-control"
                    value={computed.varsta ? `${computed.varsta} ani` : ''}
                    readOnly
                    placeholder="Calculată automat"
                  />
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
        </form>
      </div>

      {/* Sticky footer buttons */}
      <div style={{
        position: 'fixed',
        bottom: 'var(--bottom-nav-height, 0)',
        left: 0,
        right: 0,
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
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          onClick={(e) => {
            e.preventDefault();
            const errs = validate();
            if (Object.keys(errs).length) { setErrors(errs); return; }
            setLoading(true);
            setApiError('');
            createPatient(form)
              .then(({ data }) => navigate(`/pacienti/${data.id}`))
              .catch(err => setApiError(err.response?.data?.error || 'Eroare la salvare'))
              .finally(() => setLoading(false));
          }}
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
