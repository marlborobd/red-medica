import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPatient, createVisit, getVisit, updateVisit, uploadPhoto } from '../services/api';
import { useAuth } from '../context/AuthContext';

const SERVICII_OPTIONS = [
  'Monitorizare semne vitale',
  'Administrare medicamente',
  'Pansamente și îngrijiri plăgi',
  'Kinetoterapie',
  'Asistență igienă personală',
  'Recoltare analize',
  'Injecții',
  'Consultație medicală',
  'Îngrijire post-operatorie',
  'Terapie respiratorie'
];

const STARI_PACIENT = [
  '', 'Bună', 'Stabilă', 'Moderată', 'Ameliorată',
  'Recuperare', 'Agravată', 'Gravă', 'Critică'
];

export default function AddVisit() {
  const { id: patientId, visitId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = !!visitId;

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [poze, setPoze] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().substring(0, 5);

  const [form, setForm] = useState({
    diagnostic: '', tratament: '', cass: '',
    perioada_tratament_inceput: '', perioada_tratament_sfarsit: '',
    zile_cass: '', servicii_efectuate: '', stare_pacient: '',
    medicamente: '', tensiune: '', temperatura: '',
    observatii: '', suma_de_plata: '', suma_incasata: ''
  });

  useEffect(() => { loadData(); }, [patientId, visitId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const pRes = await getPatient(patientId);
      setPatient(pRes.data);
      if (isEdit) {
        const vRes = await getVisit(visitId);
        const v = vRes.data;
        setForm({
          diagnostic: v.diagnostic || '', tratament: v.tratament || '',
          cass: v.cass || '',
          perioada_tratament_inceput: v.perioada_tratament_inceput || '',
          perioada_tratament_sfarsit: v.perioada_tratament_sfarsit || '',
          zile_cass: v.zile_cass || '', servicii_efectuate: v.servicii_efectuate || '',
          stare_pacient: v.stare_pacient || '', medicamente: v.medicamente || '',
          tensiune: v.tensiune || '', temperatura: v.temperatura || '',
          observatii: v.observatii || '', suma_de_plata: v.suma_de_plata || '',
          suma_incasata: v.suma_incasata || ''
        });
        try { setPoze(JSON.parse(v.poze || '[]')); } catch (_) { setPoze([]); }
      }
    } catch {
      navigate(`/pacienti/${patientId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const toggleServiciu = (s) => {
    const current = form.servicii_efectuate
      ? form.servicii_efectuate.split(', ').filter(Boolean)
      : [];
    const updated = current.includes(s)
      ? current.filter(x => x !== s)
      : [...current, s];
    setForm(prev => ({ ...prev, servicii_efectuate: updated.join(', ') }));
  };

  // ===== Upload poze =====
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingPhoto(true);
    setError('');
    try {
      for (const file of files) {
        const { data } = await uploadPhoto(file);
        setPoze(prev => [...prev, data.url]);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Eroare la încărcarea fotografiei. Verificați configurarea Cloudinary.');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = (idx) => {
    setPoze(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, poze: JSON.stringify(poze) };
      if (isEdit) {
        await updateVisit(visitId, payload);
      } else {
        await createVisit({ ...payload, patient_id: parseInt(patientId) });
      }
      navigate(`/pacienti/${patientId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Eroare la salvare. Verificați datele și încercați din nou.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="loading">
      <div className="loading-spinner" />
      <span className="loading-text">Se încarcă formularul...</span>
    </div>
  );

  const currentServices = form.servicii_efectuate
    ? form.servicii_efectuate.split(', ').filter(Boolean)
    : [];

  const rest = Number(form.suma_de_plata || 0) - Number(form.suma_incasata || 0);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{isEdit ? '✏️ Editează Vizita' : '📋 Vizită Nouă'}</div>
          <div className="page-subtitle">Pacient: <strong>{patient?.nume}</strong></div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/pacienti/${patientId}`)}>
          ← Înapoi
        </button>
      </div>

      <div className="page-body" style={{ paddingBottom: 100 }}>
        {error && (
          <div className="alert alert-danger mb-3">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Auto info */}
        <div className="card mb-3">
          <div className="card-header"><span className="card-title">ℹ️ Informații Automate</span></div>
          <div className="card-body">
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">Data</label>
                <input className="form-control" value={isEdit ? '— (dată existentă)' : todayStr} readOnly />
              </div>
              <div className="form-group">
                <label className="form-label">Ora</label>
                <input className="form-control" value={isEdit ? '— (oră existentă)' : timeStr} readOnly />
              </div>
              <div className="form-group">
                <label className="form-label">Angajat</label>
                <input className="form-control" value={user?.name || ''} readOnly />
              </div>
            </div>
          </div>
        </div>

        {/* Semne vitale */}
        <div className="card mb-3">
          <div className="card-header"><span className="card-title">💉 Semne Vitale</span></div>
          <div className="card-body">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Tensiune Arterială</label>
                <input name="tensiune" className="form-control" placeholder="ex: 120/80 mmHg" value={form.tensiune} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Temperatură (°C)</label>
                <input name="temperatura" type="number" step="0.1" min="34" max="42" className="form-control" placeholder="ex: 36.7" value={form.temperatura} onChange={handleChange} inputMode="decimal" />
              </div>
              <div className="form-group form-full">
                <label className="form-label">Stare Pacient</label>
                <select name="stare_pacient" className="form-control" value={form.stare_pacient} onChange={handleChange}>
                  {STARI_PACIENT.map(s => <option key={s} value={s}>{s || '— Selectați starea —'}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Diagnostic + Tratament */}
        <div className="card mb-3">
          <div className="card-header"><span className="card-title">🏥 Diagnostic și Tratament</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Diagnostic</label>
                <textarea name="diagnostic" className="form-control" rows={3} placeholder="Diagnosticul pacientului..." value={form.diagnostic} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Tratament</label>
                <textarea name="tratament" className="form-control" rows={3} placeholder="Tratamentul prescris și administrat..." value={form.tratament} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Medicamente</label>
                <textarea name="medicamente" className="form-control" rows={3} placeholder="Lista medicamentelor (denumire, doză, frecvență)..." value={form.medicamente} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Observații</label>
                <textarea name="observatii" className="form-control" rows={3} placeholder="Observații suplimentare despre starea pacientului..." value={form.observatii} onChange={handleChange} />
              </div>
            </div>
          </div>
        </div>

        {/* Poze rețete */}
        <div className="card mb-3">
          <div className="card-header"><span className="card-title">📷 Poze Rețete / Documente</span></div>
          <div className="card-body">
            {/* Thumbnails */}
            {poze.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                {poze.map((url, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    <img
                      src={url}
                      alt={`Poza ${idx + 1}`}
                      onClick={() => window.open(url, '_blank')}
                      style={{
                        width: 80, height: 80,
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: '2px solid var(--border)',
                        cursor: 'pointer'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      title="Șterge fotografia"
                      style={{
                        position: 'absolute', top: -7, right: -7,
                        background: 'var(--danger)', color: 'white',
                        border: 'none', borderRadius: '50%',
                        width: 22, height: 22, fontSize: 12,
                        cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        padding: 0, fontWeight: 700
                      }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Buton upload — pe mobil deschide camera direct */}
            <label className="upload-photo-label" style={{ cursor: uploadingPhoto ? 'wait' : 'pointer' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                style={{ display: 'none' }}
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
              />
              <div
                className={`btn upload-photo-btn ${uploadingPhoto ? 'btn-ghost' : 'btn-secondary'}`}
                style={{ pointerEvents: uploadingPhoto ? 'none' : 'auto' }}
              >
                {uploadingPhoto
                  ? <><div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Se încarcă fotografia...</>
                  : '📷 Fotografiați Rețeta / Adaugă Poze'}
              </div>
            </label>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              Pe mobil: apasă pentru a fotografia direct cu camera. Pe desktop: selectați fișierul imagine.
            </div>
          </div>
        </div>

        {/* Servicii */}
        <div className="card mb-3">
          <div className="card-header"><span className="card-title">🩺 Servicii Efectuate</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {SERVICII_OPTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleServiciu(s)}
                  className={`btn btn-sm ${currentServices.includes(s) ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ borderRadius: 20 }}
                >
                  {currentServices.includes(s) ? '✓ ' : ''}{s}
                </button>
              ))}
            </div>
            <div className="form-group">
              <label className="form-label">Servicii selectate / alte servicii</label>
              <input name="servicii_efectuate" className="form-control" placeholder="Editați lista sau adăugați alte servicii..." value={form.servicii_efectuate} onChange={handleChange} />
            </div>
          </div>
        </div>

        {/* CASS */}
        <div className="card mb-3">
          <div className="card-header"><span className="card-title">📄 CASS</span></div>
          <div className="card-body">
            <div className="form-grid">
              <div className="form-group form-full">
                <label className="form-label">CASS</label>
                <input name="cass" className="form-control" placeholder="Informații CASS..." value={form.cass} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Perioadă Tratament — Început</label>
                <input name="perioada_tratament_inceput" type="date" className="form-control" value={form.perioada_tratament_inceput} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Perioadă Tratament — Sfârșit</label>
                <input name="perioada_tratament_sfarsit" type="date" className="form-control" value={form.perioada_tratament_sfarsit} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Zile CASS</label>
                <input name="zile_cass" type="number" min="0" className="form-control" placeholder="0" value={form.zile_cass} onChange={handleChange} inputMode="numeric" />
              </div>
            </div>
          </div>
        </div>

        {/* Plăți */}
        <div className="card mb-3">
          <div className="card-header"><span className="card-title">💰 Plăți</span></div>
          <div className="card-body">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Sumă de Plată (lei)</label>
                <input name="suma_de_plata" type="number" step="0.01" min="0" className="form-control" placeholder="0.00" value={form.suma_de_plata} onChange={handleChange} inputMode="decimal" />
              </div>
              <div className="form-group">
                <label className="form-label">Sumă Încasată (lei)</label>
                <input name="suma_incasata" type="number" step="0.01" min="0" className="form-control" placeholder="0.00" value={form.suma_incasata} onChange={handleChange} inputMode="decimal" />
              </div>
            </div>
            {form.suma_de_plata && form.suma_incasata && rest > 0 && (
              <div className="alert alert-warning mt-2">
                ⚠️ Rest de plată: <strong>{rest.toLocaleString('ro-RO')} lei</strong>
              </div>
            )}
            {form.suma_de_plata && form.suma_incasata && rest <= 0 && Number(form.suma_de_plata) > 0 && (
              <div className="alert alert-success mt-2">✓ Plata este completă</div>
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
        <button type="button" className="btn btn-ghost" onClick={() => navigate(`/pacienti/${patientId}`)}>
          Anulare
        </button>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth: 180 }}>
          {saving
            ? <><div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Se salvează...</>
            : `💾 ${isEdit ? 'Actualizează Vizita' : 'Salvează Vizita'}`}
        </button>
      </div>
    </>
  );
}
