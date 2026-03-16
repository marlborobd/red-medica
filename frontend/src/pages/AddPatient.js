import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPatient, getEmployees } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function AddPatient() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    nume: '', data_nasterii: '', varsta: '',
    adresa: '', telefon: '', acord_gdpr: false
  });
  const [redirectToId, setRedirectToId] = useState('');
  const [employees, setEmployees] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  // Tip pacient
  const [tipPacient, setTipPacient] = useState('privat');
  const [cassInceput, setCassInceput] = useState('');
  const [cassSfarsit, setCassSfarsit] = useState('');

  // Periodicitate
  const [periodicitate, setPeriodicitate] = useState('');
  const [dataVizitei, setDataVizitei] = useState('');
  const [oraPrimaVizita, setOraPrimaVizita] = useState('08:00');
  const [oraADouaVizita, setOraADouaVizita] = useState('16:00');

  // Modal confirmare
  const [successModal, setSuccessModal] = useState(null);

  useEffect(() => {
    getEmployees().then(({ data }) => setEmployees(data)).catch(() => {});
  }, []);

  const zileCAss = (() => {
    if (!cassInceput || !cassSfarsit) return null;
    const diff = Math.round((new Date(cassSfarsit) - new Date(cassInceput)) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  })();

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
    const payload = { ...form };
    if (redirectToId) payload.redirectionat_catre_id = parseInt(redirectToId);

    payload.tip_pacient = tipPacient === 'cass' ? 'CASS' : 'PRIVAT';
    if (tipPacient === 'cass') {
      payload.perioada_cass_inceput = cassInceput || null;
      payload.perioada_cass_sfarsit = cassSfarsit || null;
      payload.zile_cass = zileCAss || null;
    }

    if (periodicitate && dataVizitei) {
      payload.periodicitate = periodicitate;
      payload.data_vizitei = dataVizitei;
      if (periodicitate === '2_vizite') {
        payload.ora_prima_vizita = oraPrimaVizita;
        payload.ora_a_doua_vizita = oraADouaVizita;
      }
    }

    createPatient(payload)
      .then(({ data }) => {
        if (data.programari) {
          setSuccessModal({
            patientId: data.id,
            programari: data.programari,
            dataVizitei,
            ora1: oraPrimaVizita,
            ora2: oraADouaVizita
          });
        } else {
          navigate(`/pacienti/${data.id}`);
        }
      })
      .catch(err => setApiError(err.response?.data?.error || 'Eroare la salvare. Încercați din nou.'))
      .finally(() => setLoading(false));
  };

  const radioStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
    padding: '10px 20px',
    border: `2px solid ${active ? '#E53935' : 'var(--border, #e0e0e0)'}`,
    borderRadius: 8,
    background: active ? '#fff5f5' : 'white',
    fontWeight: active ? 600 : 400,
    transition: 'all 0.15s'
  });

  if (successModal) {
    const dataFmt = successModal.dataVizitei
      ? new Date(successModal.dataVizitei + 'T00:00:00').toLocaleDateString('ro-RO')
      : '';
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
        <div className="card" style={{ maxWidth: 420, width: '100%' }}>
          <div className="card-body" style={{ padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Pacient salvat cu succes!</div>
            {successModal.programari === 1 ? (
              <p style={{ color: '#444', lineHeight: 1.6 }}>
                S-a creat <strong>1 programare</strong> pentru data <strong>{dataFmt}</strong>.
              </p>
            ) : (
              <p style={{ color: '#444', lineHeight: 1.6 }}>
                S-au creat <strong>2 programări</strong> pentru data <strong>{dataFmt}</strong> la orele <strong>{successModal.ora1}</strong> și <strong>{successModal.ora2}</strong>.
              </p>
            )}
            <button
              className="btn btn-primary"
              style={{ marginTop: 20, minWidth: 160 }}
              onClick={() => navigate(`/pacienti/${successModal.patientId}`)}
            >
              Vezi Pacientul
            </button>
          </div>
        </div>
      </div>
    );
  }

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
              <div className="form-group form-full">
                <label className="form-label">Redirecționează către angajat</label>
                <select
                  className="form-control"
                  value={redirectToId}
                  onChange={e => setRedirectToId(e.target.value)}
                >
                  <option value="">— Fără redirecționare (adaugă direct) —</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} {emp.role === 'admin' ? '(Admin)' : ''}
                    </option>
                  ))}
                </select>
                {redirectToId && (
                  <div className="alert alert-warning mt-2" style={{ padding: '8px 12px', fontSize: 13 }}>
                    Pacientul va fi trimis cu status PENDING. Angajatul selectat trebuie sa accepte sau sa refuze.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tip Pacient */}
        <div className="card mb-3">
          <div className="card-header">
            <span className="card-title">🏥 Tip Pacient</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 12, marginBottom: tipPacient === 'cass' ? 16 : 0, flexWrap: 'wrap' }}>
              <label style={radioStyle(tipPacient === 'privat')}>
                <input
                  type="radio" name="tip_pacient" value="privat"
                  checked={tipPacient === 'privat'}
                  onChange={() => setTipPacient('privat')}
                  style={{ accentColor: '#E53935' }}
                />
                Pacient Privat
              </label>
              <label style={radioStyle(tipPacient === 'cass')}>
                <input
                  type="radio" name="tip_pacient" value="cass"
                  checked={tipPacient === 'cass'}
                  onChange={() => setTipPacient('cass')}
                  style={{ accentColor: '#E53935' }}
                />
                Pacient CASS
              </label>
            </div>

            {tipPacient === 'cass' && (
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Data Început</label>
                  <input
                    type="date"
                    className="form-control"
                    value={cassInceput}
                    onChange={e => setCassInceput(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Data Sfârșit</label>
                  <input
                    type="date"
                    className="form-control"
                    value={cassSfarsit}
                    onChange={e => setCassSfarsit(e.target.value)}
                    min={cassInceput}
                  />
                </div>
                {zileCAss !== null && (
                  <div className="form-group form-full">
                    <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '10px 16px', color: '#2e7d32', fontWeight: 600, fontSize: 15 }}>
                      Număr zile tratament: {zileCAss} zile
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Periodicitate */}
        <div className="card mb-3">
          <div className="card-header">
            <span className="card-title">📅 Periodicitate</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 12, marginBottom: periodicitate ? 16 : 0, flexWrap: 'wrap' }}>
              <label style={radioStyle(periodicitate === '1_vizita')}>
                <input
                  type="radio" name="periodicitate" value="1_vizita"
                  checked={periodicitate === '1_vizita'}
                  onChange={() => setPeriodicitate('1_vizita')}
                  style={{ accentColor: '#E53935' }}
                />
                1 Vizită / Zi
              </label>
              <label style={radioStyle(periodicitate === '2_vizite')}>
                <input
                  type="radio" name="periodicitate" value="2_vizite"
                  checked={periodicitate === '2_vizite'}
                  onChange={() => setPeriodicitate('2_vizite')}
                  style={{ accentColor: '#E53935' }}
                />
                2 Vizite / Zi
              </label>
              {periodicitate && (
                <button
                  type="button"
                  style={{ padding: '10px 16px', border: '1px solid var(--border, #e0e0e0)', borderRadius: 8, background: 'white', cursor: 'pointer', color: '#888', fontSize: 13 }}
                  onClick={() => setPeriodicitate('')}
                >
                  ✕ Fără programare
                </button>
              )}
            </div>

            {periodicitate && (
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Data Vizitei</label>
                  <input
                    type="date"
                    className="form-control"
                    value={dataVizitei}
                    onChange={e => setDataVizitei(e.target.value)}
                  />
                </div>
                {periodicitate === '2_vizite' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Ora Prima Vizită</label>
                      <input
                        type="time"
                        className="form-control"
                        value={oraPrimaVizita}
                        onChange={e => setOraPrimaVizita(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Ora A Doua Vizită</label>
                      <input
                        type="time"
                        className="form-control"
                        value={oraADouaVizita}
                        onChange={e => setOraADouaVizita(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
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
