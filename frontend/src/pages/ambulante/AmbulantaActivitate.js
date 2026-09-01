import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  getAmbulante, updateAmbulanta,
  getZile, createZi, getZi, finalizeazaZi, redeschideZi, deleteZi,
  createCursa, updateCursa, deleteCursa, calcDistanta,
} from '../../services/api';
import AddressAutocomplete from '../../components/AddressAutocomplete';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const p2 = n => String(n).padStart(2, '0');

function formatDurata(sec) {
  if (sec === null || sec === undefined || isNaN(Number(sec))) return '—';
  const s = Math.abs(Math.round(Number(sec)));
  return `${p2(Math.floor(s / 3600))}:${p2(Math.floor((s % 3600) / 60))}:${p2(s % 60)}`;
}

function parseDurata(str) {
  if (!str || typeof str !== 'string') return 0;
  const parts = str.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
  return 0;
}

function timeToSec(t) {
  if (!t) return 0;
  const parts = t.split(':').map(Number);
  return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
}

function ensureHMS(t) {
  if (!t) return '';
  return t.split(':').length === 2 ? t + ':00' : t;
}

const ORA_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function formatTimeInput(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + ':' + digits.slice(2, 4);
}

function validateOra(val) {
  if (!val) return 'Câmp obligatoriu.';
  if (!ORA_RE.test(val)) return 'Format invalid (HH:MM, 24h).';
  return '';
}

function calcViteza(km, sec) {
  const k = parseFloat(km);
  const s = Number(sec);
  if (!k || !s || s <= 0 || isNaN(k) || isNaN(s)) return '';
  return String(Math.round(k / (s / 3600)));
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatData(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Init form cursă ──────────────────────────────────────────────────────────

function initCursaForm(zi, curse, editData) {
  if (editData) {
    return {
      data_cursa: editData.data_cursa,
      ora_plecare: editData.ora_plecare.slice(0, 5),
      ora_sosire: editData.ora_sosire.slice(0, 5),
      locatie_plecare: editData.locatie_plecare,
      locatie_sosire: editData.locatie_sosire,
      distanta_km: String(editData.distanta_km),
      distanta_sursa: editData.distanta_sursa,
      odometru_start: String(editData.odometru_start),
      odometru_final: String(editData.odometru_final),
      viteza_medie: editData.viteza_medie != null ? String(editData.viteza_medie) : '',
      viteza_medie_sursa: editData.viteza_medie_sursa || 'auto',
      viteza_maxima: editData.viteza_maxima != null ? String(editData.viteza_maxima) : '',
      stationare_pornit_hms: formatDurata(editData.stationare_pornit_sec || 0),
      stationare_oprit_sec: editData.stationare_oprit_sec,
    };
  }
  const last = curse && curse.length > 0 ? curse[curse.length - 1] : null;
  return {
    data_cursa: zi.data_activitate,
    ora_plecare: '',
    ora_sosire: '',
    locatie_plecare: last ? last.locatie_sosire : zi.locatie_start,
    locatie_sosire: '',
    distanta_km: '',
    distanta_sursa: 'auto',
    odometru_start: String(last ? last.odometru_final : zi.odometru_start),
    odometru_final: String(last ? last.odometru_final : zi.odometru_start),
    viteza_medie: '',
    viteza_medie_sursa: 'auto',
    viteza_maxima: '',
    stationare_pornit_hms: '00:00:00',
    stationare_oprit_sec: null,
  };
}

// ─── Componenta ───────────────────────────────────────────────────────────────

export default function AmbulantaActivitate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [ambulanta, setAmbulanta] = useState(null);
  const [zile, setZile] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ziExpandata, setZiExpandata] = useState(null);
  const [ziDetalii, setZiDetalii] = useState(null);
  const [loadingZi, setLoadingZi] = useState(false);
  const [curseExpandate, setCurseExpandate] = useState(() => new Set());

  const toggleCursaExpand = (cursaId) => {
    setCurseExpandate(prev => {
      const next = new Set(prev);
      if (next.has(cursaId)) next.delete(cursaId); else next.add(cursaId);
      return next;
    });
  };

  // Odometru inline
  const [editOdo, setEditOdo] = useState(false);
  const [odoVal, setOdoVal] = useState('');
  const [savingOdo, setSavingOdo] = useState(false);

  // Modal zi nouă
  const [showZiModal, setShowZiModal] = useState(false);
  const [ziForm, setZiForm] = useState({});
  const [ziError, setZiError] = useState('');
  const [savingZi, setSavingZi] = useState(false);

  // Modal cursă
  const [showCursaModal, setShowCursaModal] = useState(false);
  const [editCursa, setEditCursa] = useState(null);
  const [cursaForm, setCursaForm] = useState({});
  const [cursaError, setCursaError] = useState('');
  const [oraErrors, setOraErrors] = useState({ ora_plecare: '', ora_sosire: '' });
  const [savingCursa, setSavingCursa] = useState(false);
  const [calculandKm, setCalculandKm] = useState(false);
  const [googleDurata, setGoogleDurata] = useState(null);

  // Modal finalizare
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [finalForm, setFinalForm] = useState({ locatie_final: '', odometru_final: '' });
  const [finalError, setFinalError] = useState('');
  const [finalAvert, setFinalAvert] = useState([]);
  const [savingFinal, setSavingFinal] = useState(false);

  // ── Încărcare date ─────────────────────────────────────────────────────────

  const loadAmbulanta = useCallback(async () => {
    try {
      const { data } = await getAmbulante();
      const found = data.find(a => String(a.id) === String(id));
      if (found) setAmbulanta(found);
    } catch (_) {}
  }, [id]);

  const loadZile = useCallback(async () => {
    try {
      const { data } = await getZile({ ambulanta_id: id });
      setZile(data);
    } catch (_) {}
  }, [id]);

  const reloadZi = useCallback(async (ziId) => {
    setLoadingZi(true);
    try {
      const { data } = await getZi(ziId);
      setZiDetalii(data);
      setZile(prev => prev.map(z => z.id === ziId ? { ...z, ...data } : z));
    } finally {
      setLoadingZi(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadAmbulanta(), loadZile()]);
      setLoading(false);
    })();
  }, [loadAmbulanta, loadZile]);

  // ── Expand zi ──────────────────────────────────────────────────────────────

  const handleToggleZi = useCallback(async (ziId) => {
    if (ziExpandata === ziId) {
      setZiExpandata(null);
      setZiDetalii(null);
      return;
    }
    setZiExpandata(ziId);
    setLoadingZi(true);
    try {
      const { data } = await getZi(ziId);
      setZiDetalii(data);
    } finally {
      setLoadingZi(false);
    }
  }, [ziExpandata]);

  // ── Odometru inline ────────────────────────────────────────────────────────

  const handleEditOdo = () => {
    setOdoVal(String(ambulanta.odometru_curent));
    setEditOdo(true);
  };

  const handleSaveOdo = async () => {
    const val = parseFloat(odoVal);
    if (isNaN(val) || val < 0) return;
    setSavingOdo(true);
    try {
      await updateAmbulanta(id, { numar_inmatriculare: ambulanta.numar_inmatriculare, odometru_curent: val });
      setAmbulanta(prev => ({ ...prev, odometru_curent: val }));
      setEditOdo(false);
    } catch (_) {}
    setSavingOdo(false);
  };

  // ── Zi nouă ────────────────────────────────────────────────────────────────

  const openZiModal = () => {
    const ultimaFinalizata = zile.find(z => z.status === 'finalizata' && z.locatie_final);
    setZiForm({
      data_activitate: todayStr(),
      locatie_start: ultimaFinalizata ? ultimaFinalizata.locatie_final : '',
      odometru_start: ambulanta ? String(ambulanta.odometru_curent) : '',
    });
    setZiError('');
    setShowZiModal(true);
  };

  const handleSaveZi = async () => {
    if (!ziForm.data_activitate || !ziForm.locatie_start.trim()) {
      setZiError('Data și locația de start sunt obligatorii.');
      return;
    }
    setSavingZi(true);
    setZiError('');
    try {
      await createZi({
        ambulanta_id: id,
        data_activitate: ziForm.data_activitate,
        locatie_start: ziForm.locatie_start.trim(),
        odometru_start: ziForm.odometru_start !== '' ? parseFloat(ziForm.odometru_start) : undefined,
      });
      setShowZiModal(false);
      await loadZile();
    } catch (err) {
      setZiError(err.response?.data?.error || 'Eroare la salvare');
    } finally {
      setSavingZi(false);
    }
  };

  // ── Cursă: câmpuri derivate ────────────────────────────────────────────────

  const updateCursaField = (field, value) => {
    setCursaForm(prev => {
      const next = { ...prev, [field]: value };

      if (field === 'distanta_km') next.distanta_sursa = 'manual';
      if (field === 'viteza_medie') next.viteza_medie_sursa = 'manual';

      if (field === 'distanta_km' || field === 'odometru_start') {
        const km = parseFloat(field === 'distanta_km' ? value : next.distanta_km);
        const odo = parseFloat(field === 'odometru_start' ? value : next.odometru_start);
        if (!isNaN(km) && !isNaN(odo)) {
          next.odometru_final = String(Math.round((odo + km) * 100) / 100);
        }
      }

      if (next.viteza_medie_sursa === 'auto') {
        const dur = timeToSec(ensureHMS(next.ora_sosire)) - timeToSec(ensureHMS(next.ora_plecare));
        next.viteza_medie = calcViteza(next.distanta_km, dur);
      }

      return next;
    });
  };

  // ── Cursă: Calculează km ───────────────────────────────────────────────────

  const handleCalcKm = async () => {
    if (!cursaForm.locatie_plecare?.trim() || !cursaForm.locatie_sosire?.trim()) {
      setCursaError('Completați locațiile pentru a calcula distanța.');
      return;
    }
    setCursaError('');
    setCalculandKm(true);
    try {
      const { data } = await calcDistanta({
        origine: cursaForm.locatie_plecare.trim(),
        destinatie: cursaForm.locatie_sosire.trim(),
      });
      if (data.status === 'ok') {
        setGoogleDurata(data.durata_sec);
        setCursaForm(prev => {
          const next = { ...prev, distanta_km: String(data.distanta_km), distanta_sursa: 'auto' };
          const odo = parseFloat(next.odometru_start);
          if (!isNaN(odo)) {
            next.odometru_final = String(Math.round((odo + data.distanta_km) * 100) / 100);
          }
          if (next.viteza_medie_sursa === 'auto') {
            const dur = timeToSec(ensureHMS(next.ora_sosire)) - timeToSec(ensureHMS(next.ora_plecare));
            next.viteza_medie = calcViteza(data.distanta_km, dur);
          }
          return next;
        });
      } else {
        setCursaError('Nu s-a putut calcula distanța: ' + (data.error || data.status));
      }
    } catch (err) {
      setCursaError(err.response?.data?.error || 'Eroare la calculul distanței.');
    } finally {
      setCalculandKm(false);
    }
  };

  // ── Cursă: viteza recalculare ──────────────────────────────────────────────

  const handleVitezaRecalc = () => {
    setCursaForm(prev => {
      const next = { ...prev, viteza_medie_sursa: 'auto' };
      const dur = timeToSec(ensureHMS(next.ora_sosire)) - timeToSec(ensureHMS(next.ora_plecare));
      next.viteza_medie = calcViteza(next.distanta_km, dur);
      return next;
    });
  };

  // ── Cursă: deschide modal ──────────────────────────────────────────────────

  const handleOraChange = (field, raw) => {
    const formatted = formatTimeInput(raw);
    updateCursaField(field, formatted);
    setOraErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleOraBlur = (field, val) => {
    const err = validateOra(val);
    setOraErrors(prev => ({ ...prev, [field]: err }));
  };

  const openCursaModal = (editData = null) => {
    setEditCursa(editData);
    setCursaForm(initCursaForm(ziDetalii, ziDetalii?.curse, editData));
    setCursaError('');
    setOraErrors({ ora_plecare: '', ora_sosire: '' });
    setGoogleDurata(null);
    setShowCursaModal(true);
  };

  // ── Cursă: salvare ─────────────────────────────────────────────────────────

  const handleSaveCursa = async () => {
    const pleErr = validateOra(cursaForm.ora_plecare);
    const sosErr = validateOra(cursaForm.ora_sosire);
    if (pleErr || sosErr) {
      setOraErrors({ ora_plecare: pleErr, ora_sosire: sosErr });
      setCursaError('Corectați orele înainte de salvare.');
      return;
    }
    if (!cursaForm.locatie_plecare?.trim() || !cursaForm.locatie_sosire?.trim()) {
      setCursaError('Locațiile de plecare și sosire sunt obligatorii.');
      return;
    }
    if (cursaForm.distanta_km === '' || parseFloat(cursaForm.distanta_km) < 0) {
      setCursaError('Introduceți distanța (km ≥ 0).');
      return;
    }
    setSavingCursa(true);
    setCursaError('');
    try {
      if (editCursa) {
        const payload = {
          ora_plecare: ensureHMS(cursaForm.ora_plecare),
          ora_sosire: ensureHMS(cursaForm.ora_sosire),
          locatie_plecare: cursaForm.locatie_plecare.trim(),
          locatie_sosire: cursaForm.locatie_sosire.trim(),
          distanta_km: parseFloat(cursaForm.distanta_km),
          distanta_sursa: cursaForm.distanta_sursa,
          stationare_pornit_sec: parseDurata(cursaForm.stationare_pornit_hms),
          viteza_maxima: cursaForm.viteza_maxima ? parseInt(cursaForm.viteza_maxima) : null,
          viteza_medie: cursaForm.viteza_medie_sursa === 'auto'
            ? null
            : (cursaForm.viteza_medie ? parseInt(cursaForm.viteza_medie) : null),
        };
        await updateCursa(editCursa.id, payload);
      } else {
        const payload = {
          data_cursa: cursaForm.data_cursa,
          ora_plecare: ensureHMS(cursaForm.ora_plecare),
          ora_sosire: ensureHMS(cursaForm.ora_sosire),
          locatie_plecare: cursaForm.locatie_plecare.trim(),
          locatie_sosire: cursaForm.locatie_sosire.trim(),
          distanta_km: parseFloat(cursaForm.distanta_km),
          distanta_sursa: cursaForm.distanta_sursa,
          stationare_pornit_sec: parseDurata(cursaForm.stationare_pornit_hms),
        };
        if (cursaForm.viteza_maxima) payload.viteza_maxima = parseInt(cursaForm.viteza_maxima);
        if (cursaForm.viteza_medie_sursa === 'manual' && cursaForm.viteza_medie) {
          payload.viteza_medie = parseInt(cursaForm.viteza_medie);
        }
        const { data } = await createCursa(ziDetalii.id, payload);
        if (data.avertismente?.length) {
          alert('Cursă adăugată cu avertisment:\n' + data.avertismente.join('\n'));
        }
      }
      setShowCursaModal(false);
      await reloadZi(ziDetalii.id);
    } catch (err) {
      setCursaError(err.response?.data?.error || 'Eroare la salvare');
    } finally {
      setSavingCursa(false);
    }
  };

  const handleDeleteCursa = async (cursaId) => {
    if (!window.confirm('Ștergeți această cursă? Lanțul odometrului va fi repropagat.')) return;
    try {
      await deleteCursa(cursaId);
      await reloadZi(ziDetalii.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Eroare la ștergere');
    }
  };

  // ── Finalizare ──────────────────────────────────────────────────────────────

  const openFinalModal = () => {
    const curse = ziDetalii?.curse || [];
    const last = curse[curse.length - 1];
    setFinalForm({
      locatie_final: last?.locatie_sosire || '',
      odometru_final: last ? String(last.odometru_final) : String(ziDetalii?.odometru_start || ''),
    });
    setFinalError('');
    setFinalAvert([]);
    setShowFinalModal(true);
  };

  const handleSaveFinal = async () => {
    if (!finalForm.locatie_final.trim()) {
      setFinalError('Locația finală este obligatorie.');
      return;
    }
    setSavingFinal(true);
    setFinalError('');
    try {
      const { data } = await finalizeazaZi(ziDetalii.id, {
        locatie_final: finalForm.locatie_final.trim(),
        odometru_final: parseFloat(finalForm.odometru_final),
      });
      await reloadZi(ziDetalii.id);
      await loadAmbulanta();
      if (data.avertismente?.length) {
        setFinalAvert(data.avertismente);
      } else {
        setShowFinalModal(false);
      }
    } catch (err) {
      setFinalError(err.response?.data?.error || 'Eroare la finalizare');
    } finally {
      setSavingFinal(false);
    }
  };

  // ── Redeschide ─────────────────────────────────────────────────────────────

  const handleRedeschide = async () => {
    if (!window.confirm('Redeschideți ziua? Odometrul ambulanței nu se va readuce automat.')) return;
    try {
      await redeschideZi(ziDetalii.id);
      await reloadZi(ziDetalii.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Eroare');
    }
  };

  const handleRedeschideDinLista = async (e, ziId) => {
    e.stopPropagation();
    if (!window.confirm('Redeschideți ziua? Odometrul ambulanței nu se va readuce automat.')) return;
    try {
      await redeschideZi(ziId);
      await loadZile();
      if (ziExpandata === ziId) {
        await reloadZi(ziId);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Eroare');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="loading"><div className="loading-spinner" />Se încarcă...</div>;
  }

  if (!ambulanta) {
    return (
      <div className="page-body">
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
          Ambulanța nu a fost găsită.{' '}
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/ambulante')}>Înapoi</button>
        </div>
      </div>
    );
  }

  // Valori derivate pentru modalul de cursă (calculate inline)
  const cursaDurataSec = cursaForm.ora_plecare && cursaForm.ora_sosire
    ? timeToSec(ensureHMS(cursaForm.ora_sosire)) - timeToSec(ensureHMS(cursaForm.ora_plecare))
    : 0;
  const vitezaMaxSug = cursaForm.viteza_medie && parseInt(cursaForm.viteza_medie) > 0
    ? Math.min(parseInt(cursaForm.viteza_medie) * 2, 130)
    : 130;

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/ambulante')}>← Înapoi</button>
          <div>
            <div className="page-title">🚑 {ambulanta.numar_inmatriculare}</div>
            <div className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              Odometru curent:&nbsp;
              {editOdo ? (
                <>
                  <input
                    type="number" min="0" step="0.1" autoFocus
                    value={odoVal}
                    onChange={e => setOdoVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveOdo(); if (e.key === 'Escape') setEditOdo(false); }}
                    style={{ width: 110, padding: '2px 6px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 }}
                  />
                  <span style={{ fontSize: 12, color: '#999' }}>km</span>
                  <button className="btn btn-primary btn-sm" onClick={handleSaveOdo} disabled={savingOdo}>✓</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditOdo(false)}>✕</button>
                </>
              ) : (
                <>
                  <strong>{Number(ambulanta.odometru_curent).toLocaleString('ro-RO')} km</strong>
                  {isAdmin && (
                    <button
                      onClick={handleEditOdo}
                      title="Editează odometru (corecție manuală)"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
                    >✏️</button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openZiModal}>+ Zi nouă</button>
      </div>

      {/* ── Listă zile ─────────────────────────────────────────────────────── */}
      <div className="page-body">
        {zile.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>
            <div style={{ fontWeight: 600 }}>Nicio zi de activitate</div>
            <div style={{ marginTop: 8, fontSize: 14 }}>Adăugați prima zi de activitate cu butonul de mai sus.</div>
          </div>
        ) : (
          zile.map(zi => {
            const isOpen = zi.id === ziExpandata;
            const isFinalizata = zi.status === 'finalizata';
            const totalKm = isFinalizata && zi.odometru_final != null
              ? Math.round((zi.odometru_final - zi.odometru_start) * 100) / 100
              : null;

            return (
              <div key={zi.id} className="card" style={{ marginBottom: 10 }}>
                {/* Rând zi */}
                <div
                  onClick={() => handleToggleZi(zi.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', lineHeight: 1.3 }}>
                      {formatData(zi.data_activitate)}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {zi.locatie_start}{zi.locatie_final ? ` → ${zi.locatie_final}` : ''}
                      {totalKm !== null ? ` · ${totalKm} km` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span className={`badge ${isFinalizata ? 'badge-green' : 'badge-blue'}`}>
                      {isFinalizata ? '✓ Finalizată' : '● Deschisă'}
                    </span>
                    {isFinalizata && isAdmin && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={e => handleRedeschideDinLista(e, zi.id)}
                        title="Redeschide ziua"
                      >↩ Redeschide</button>
                    )}
                    <span style={{ color: '#bbb', fontSize: 13, lineHeight: 1 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Conținut expandat */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px 20px' }}>
                    {loadingZi ? (
                      <div className="loading"><div className="loading-spinner" />Se încarcă...</div>
                    ) : ziDetalii && (
                      <>
                        {/* Tabel curse */}
                        {ziDetalii.curse?.length > 0 ? (
                          <div className="table-wrapper">
                            <table>
                              <thead>
                                <tr>
                                  <th style={{ width: 32, textAlign: 'center' }}>#</th>
                                  <th style={{ width: 118 }}>Interval orar</th>
                                  <th className="col-p2 col-wide">Plecare</th>
                                  <th className="col-p2 col-wide">Sosire</th>
                                  <th className="col-num">km</th>
                                  <th className="col-p3 col-num">Odo start</th>
                                  <th className="col-p3 col-num">Odo final</th>
                                  <th className="col-p2">Durată</th>
                                  <th className="col-p2 col-num">V. medie</th>
                                  <th className="col-p3 col-num">V. max</th>
                                  <th className="col-p3">Staț. oprit</th>
                                  {!isFinalizata && <th></th>}
                                </tr>
                              </thead>
                              <tbody>
                                {ziDetalii.curse.map(c => (
                                  <React.Fragment key={c.id}>
                                    <tr
                                      className={`row-expandable${curseExpandate.has(c.id) ? ' row-expanded' : ''}`}
                                      onClick={() => toggleCursaExpand(c.id)}
                                    >
                                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.ordine}</td>
                                      <td title={`${c.ora_plecare.slice(0, 5)} – ${c.ora_sosire.slice(0, 5)}`}>{c.ora_plecare.slice(0, 5)} – {c.ora_sosire.slice(0, 5)}</td>
                                      <td className="col-p2 col-wide" title={c.locatie_plecare}>{c.locatie_plecare}</td>
                                      <td className="col-p2 col-wide" title={c.locatie_sosire}>{c.locatie_sosire}</td>
                                      <td className="col-num">{c.distanta_km} km</td>
                                      <td className="col-p3 col-num">{c.odometru_start}</td>
                                      <td className="col-p3 col-num">{c.odometru_final}</td>
                                      <td className="col-p2">{formatDurata(c.durata_condus_sec)}</td>
                                      <td className="col-p2 col-num">{c.viteza_medie ?? '—'} km/h</td>
                                      <td className="col-p3 col-num">{c.viteza_maxima ?? '—'} km/h</td>
                                      <td className="col-p3">{c.stationare_oprit_sec != null ? formatDurata(c.stationare_oprit_sec) : '—'}</td>
                                      {!isFinalizata && (
                                        <td>
                                          <div className="table-actions" style={{ gap: 4 }}>
                                            <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); openCursaModal(c); }} title="Editează">✏️</button>
                                            <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleDeleteCursa(c.id); }} title="Șterge">🗑️</button>
                                          </div>
                                        </td>
                                      )}
                                    </tr>
                                    <tr className="row-detail">
                                      <td colSpan={isFinalizata ? 11 : 12}>
                                        <dl className="row-detail-grid">
                                          <dt>Plecare</dt><dd>{c.locatie_plecare}</dd>
                                          <dt>Sosire</dt><dd>{c.locatie_sosire}</dd>
                                          <dt>Durată</dt><dd>{formatDurata(c.durata_condus_sec)}</dd>
                                          <dt>V. medie</dt><dd>{c.viteza_medie ?? '—'} km/h</dd>
                                          <dt>Odo start</dt><dd>{c.odometru_start}</dd>
                                          <dt>Odo final</dt><dd>{c.odometru_final}</dd>
                                          <dt>V. max</dt><dd>{c.viteza_maxima ?? '—'} km/h</dd>
                                          <dt>Staț. oprit</dt><dd>{c.stationare_oprit_sec != null ? formatDurata(c.stationare_oprit_sec) : '—'}</dd>
                                        </dl>
                                      </td>
                                    </tr>
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                            {isFinalizata ? 'Ziua finalizată fără curse înregistrate.' : 'Nicio cursă — adăugați prima cursă mai jos.'}
                          </div>
                        )}

                        {/* Butoane acțiuni zi */}
                        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {!isFinalizata && (
                            <>
                              <button className="btn btn-primary btn-sm" onClick={() => openCursaModal()}>+ Cursă nouă</button>
                              <button className="btn btn-success btn-sm" onClick={openFinalModal}>✓ Finalizează ziua</button>
                              {isAdmin && (
                                <button className="btn btn-danger btn-sm" onClick={async () => {
                                  if (!window.confirm('Ștergeți această zi și toate cursele ei?')) return;
                                  try {
                                    await deleteZi(zi.id);
                                    setZiExpandata(null);
                                    setZiDetalii(null);
                                    await loadZile();
                                  } catch (err) {
                                    alert(err.response?.data?.error || 'Eroare la ștergere');
                                  } }}>🗑️ Șterge ziua</button>
                              )}
                            </>
                          )}
                          {isFinalizata && isAdmin && (
                            <button className="btn btn-ghost btn-sm" onClick={handleRedeschide}>↩ Redeschide</button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Modal Zi nouă ──────────────────────────────────────────────────── */}
      {showZiModal && (
        <div className="modal-overlay" onClick={() => setShowZiModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">📅 Zi nouă de activitate</span>
              <button className="modal-close" onClick={() => setShowZiModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {ziError && <div className="alert alert-danger mb-2">{ziError}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Data <span className="required">*</span></label>
                  <input type="date" className="form-control" value={ziForm.data_activitate}
                    onChange={e => setZiForm(p => ({ ...p, data_activitate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Locație start <span className="required">*</span></label>
                  <AddressAutocomplete value={ziForm.locatie_start}
                    onChange={val => setZiForm(p => ({ ...p, locatie_start: val }))}
                    placeholder="ex: Strada Principală 1, Arad" />
                </div>
                <div className="form-group">
                  <label className="form-label">Odometru start (km)</label>
                  <input type="number" min="0" step="0.1" className="form-control"
                    value={ziForm.odometru_start}
                    onChange={e => setZiForm(p => ({ ...p, odometru_start: e.target.value }))}
                    placeholder={ambulanta ? `Prefil: ${ambulanta.odometru_curent}` : ''} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowZiModal(false)}>Anulare</button>
              <button className="btn btn-primary" onClick={handleSaveZi} disabled={savingZi}>
                {savingZi ? 'Se salvează...' : '💾 Salvează'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Cursă ────────────────────────────────────────────────────── */}
      {showCursaModal && ziDetalii && (
        <div className="modal-overlay" onClick={() => setShowCursaModal(false)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editCursa ? '✏️ Editează cursă' : '+ Cursă nouă'}</span>
              <button className="modal-close" onClick={() => setShowCursaModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
              {cursaError && <div className="alert alert-danger mb-2">{cursaError}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Data */}
                <div className="form-group">
                  <label className="form-label">Data cursei</label>
                  <input type="date" className="form-control" value={cursaForm.data_cursa}
                    onChange={e => updateCursaField('data_cursa', e.target.value)} />
                </div>

                {/* Ore */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Oră plecare <span className="required">*</span></label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="form-control"
                      value={cursaForm.ora_plecare}
                      onChange={e => handleOraChange('ora_plecare', e.target.value)}
                      onBlur={e => handleOraBlur('ora_plecare', e.target.value)}
                      placeholder="HH:MM"
                      maxLength={5}
                    />
                    {oraErrors.ora_plecare && (
                      <div style={{ fontSize: 11, color: '#E53935', marginTop: 2 }}>{oraErrors.ora_plecare}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Oră sosire <span className="required">*</span></label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="form-control"
                      value={cursaForm.ora_sosire}
                      onChange={e => handleOraChange('ora_sosire', e.target.value)}
                      onBlur={e => handleOraBlur('ora_sosire', e.target.value)}
                      placeholder="HH:MM"
                      maxLength={5}
                    />
                    {oraErrors.ora_sosire && (
                      <div style={{ fontSize: 11, color: '#E53935', marginTop: 2 }}>{oraErrors.ora_sosire}</div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: -6 }}>
                  Durată condus: <strong>{cursaDurataSec > 0 ? formatDurata(cursaDurataSec) : '—'}</strong>
                  {googleDurata && (
                    <span style={{ marginLeft: 10, color: '#888' }}>
                      (Google sugerează: {formatDurata(googleDurata)})
                    </span>
                  )}
                </div>

                {/* Locații */}
                <div className="form-group">
                  <label className="form-label">Locație plecare <span className="required">*</span></label>
                  <AddressAutocomplete value={cursaForm.locatie_plecare}
                    onChange={val => updateCursaField('locatie_plecare', val)}
                    placeholder="Adresă completă" />
                </div>
                <div className="form-group">
                  <label className="form-label">Locație sosire <span className="required">*</span></label>
                  <AddressAutocomplete value={cursaForm.locatie_sosire}
                    onChange={val => updateCursaField('locatie_sosire', val)}
                    placeholder="Adresă completă" />
                </div>

                {/* Distanță + Calculează */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label className="form-label">
                      Distanță (km) <span className="required">*</span>
                      {' '}
                      <span className={`badge ${cursaForm.distanta_sursa === 'auto' ? 'badge-green' : 'badge-blue'}`} style={{ fontSize: 9 }}>
                        {cursaForm.distanta_sursa === 'auto' ? 'Google' : 'manual'}
                      </span>
                    </label>
                    <input type="number" min="0" step="0.01" className="form-control"
                      value={cursaForm.distanta_km}
                      onChange={e => updateCursaField('distanta_km', e.target.value)}
                      placeholder="0.00" />
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={handleCalcKm} disabled={calculandKm}
                    style={{ whiteSpace: 'nowrap', marginBottom: 0 }}>
                    {calculandKm ? '⏳' : '🗺️ Calculează km'}
                  </button>
                </div>

                {/* Odometru */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Odo start (km)</label>
                    <input type="number" min="0" step="0.1" className="form-control"
                      value={cursaForm.odometru_start}
                      onChange={e => updateCursaField('odometru_start', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Odo final (km)</label>
                    <input type="number" min="0" step="0.1" className="form-control"
                      value={cursaForm.odometru_final}
                      onChange={e => setCursaForm(p => ({ ...p, odometru_final: e.target.value }))} />
                  </div>
                </div>

                {/* Viteze */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      Viteză medie (km/h)
                      {cursaForm.viteza_medie_sursa === 'manual' && (
                        <button onClick={handleVitezaRecalc}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#E53935', padding: 0 }}>
                          ↺ auto
                        </button>
                      )}
                    </label>
                    <input type="number" min="1" max="200" className="form-control"
                      value={cursaForm.viteza_medie}
                      onChange={e => updateCursaField('viteza_medie', e.target.value)}
                      placeholder={cursaForm.viteza_medie_sursa === 'auto' ? 'auto' : ''} />
                    {cursaForm.viteza_medie_sursa === 'auto' && (
                      <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>calculată automat</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Viteză maximă (km/h)</label>
                    <input type="number" min="1" max="300" className="form-control"
                      value={cursaForm.viteza_maxima}
                      onChange={e => updateCursaField('viteza_maxima', e.target.value)}
                      placeholder={String(vitezaMaxSug)} />
                  </div>
                </div>

                {/* Staționări */}
                <div style={{ display: 'grid', gridTemplateColumns: editCursa ? '1fr 1fr' : '1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Staț. motor pornit (HH:MM:SS)</label>
                    <input className="form-control" value={cursaForm.stationare_pornit_hms}
                      onChange={e => setCursaForm(p => ({ ...p, stationare_pornit_hms: e.target.value }))}
                      placeholder="00:00:00" />
                  </div>
                  {editCursa && (
                    <div className="form-group">
                      <label className="form-label" style={{ color: '#999' }}>
                        Staț. motor oprit <span style={{ fontSize: 10 }}>(calculat server)</span>
                      </label>
                      <input className="form-control"
                        value={cursaForm.stationare_oprit_sec != null ? formatDurata(cursaForm.stationare_oprit_sec) : '—'}
                        readOnly
                        style={{ background: '#f7f7f7', color: '#aaa' }} />
                    </div>
                  )}
                </div>

              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowCursaModal(false)}>Anulare</button>
              <button className="btn btn-primary" onClick={handleSaveCursa} disabled={savingCursa}>
                {savingCursa ? 'Se salvează...' : '💾 Salvează'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Finalizare ────────────────────────────────────────────────── */}
      {showFinalModal && ziDetalii && (
        <div className="modal-overlay" onClick={() => { if (!finalAvert.length && !savingFinal) setShowFinalModal(false); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">✓ Finalizează — {formatData(ziDetalii.data_activitate)}</span>
              <button className="modal-close" onClick={() => setShowFinalModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {finalAvert.length > 0 ? (
                <div>
                  {finalAvert.map((a, i) => (
                    <div key={i} className="alert alert-warning" style={{ marginBottom: 8 }}>⚠️ {a}</div>
                  ))}
                  <div style={{ fontSize: 13, color: '#666', marginTop: 8 }}>
                    Ziua a fost finalizată. Corectați discrepanțele prin redeschidere (admin).
                  </div>
                </div>
              ) : (
                <>
                  {finalError && <div className="alert alert-danger mb-2">{finalError}</div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="form-group">
                      <label className="form-label">Locație finală <span className="required">*</span></label>
                      <AddressAutocomplete value={finalForm.locatie_final}
                        onChange={val => setFinalForm(p => ({ ...p, locatie_final: val }))}
                        placeholder="Adresa de retur / parcare" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Odometru final (km)</label>
                      <input type="number" min="0" step="0.1" className="form-control"
                        value={finalForm.odometru_final}
                        onChange={e => setFinalForm(p => ({ ...p, odometru_final: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              {finalAvert.length > 0 ? (
                <button className="btn btn-primary" onClick={() => setShowFinalModal(false)}>Înțeles, închide</button>
              ) : (
                <>
                  <button className="btn btn-ghost" onClick={() => setShowFinalModal(false)}>Anulare</button>
                  <button className="btn btn-success" onClick={handleSaveFinal} disabled={savingFinal}>
                    {savingFinal ? 'Se finalizează...' : '✓ Finalizează ziua'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
