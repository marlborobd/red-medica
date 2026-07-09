import React, { useState, useEffect } from 'react';
import { getAmbulante, getRaportAmb } from '../../services/api';
import { genereazaRaportPdf } from '../../utils/ambPdf';

// ─── Helpers dată ────────────────────────────────────────────────────────────

function toISO(d) {
  return d.toISOString().split('T')[0];
}

function mondayOf(d) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  return m;
}

function preseturi() {
  const azi = new Date();
  const ieri = new Date(azi); ieri.setDate(azi.getDate() - 1);
  const lunaCurL = new Date(azi.getFullYear(), azi.getMonth(), 1);
  const lunaTrecL = new Date(azi.getFullYear(), azi.getMonth() - 1, 1);
  const lunaTrecF = new Date(azi.getFullYear(), azi.getMonth(), 0);
  const saptCurL = mondayOf(azi);
  const saptTrecL = new Date(saptCurL); saptTrecL.setDate(saptCurL.getDate() - 7);
  const saptTrecF = new Date(saptCurL); saptTrecF.setDate(saptCurL.getDate() - 1);

  return {
    'Azi':                { de_la: toISO(azi),      pana_la: toISO(azi) },
    'Ieri':               { de_la: toISO(ieri),     pana_la: toISO(ieri) },
    'Sapt. curentă':      { de_la: toISO(saptCurL), pana_la: toISO(azi) },
    'Sapt. trecută':      { de_la: toISO(saptTrecL),pana_la: toISO(saptTrecF) },
    'Luna curentă':       { de_la: toISO(lunaCurL), pana_la: toISO(azi) },
    'Luna trecută':       { de_la: toISO(lunaTrecL),pana_la: toISO(lunaTrecF) },
    'Anul curent':        { de_la: `${azi.getFullYear()}-01-01`, pana_la: toISO(azi) },
    'Custom':             null,
  };
}

// ─── Formatare preview ────────────────────────────────────────────────────────

const p2 = n => String(n).padStart(2, '0');

function formatDurata(sec) {
  if (sec === null || sec === undefined || isNaN(Number(sec))) return '—';
  const s = Math.abs(Math.round(Number(sec)));
  return `${p2(Math.floor(s / 3600))}:${p2(Math.floor((s % 3600) / 60))}:${p2(s % 60)}`;
}

function formatOra(t) { return t ? t.slice(0, 5) : '—'; }
function formatKm(km) { return km != null ? `${Number(km).toFixed(2)} km` : '—'; }
function formatOdo(km) { return km != null ? `${Number(km).toFixed(1)} km` : '—'; }
function formatV(v) { return v != null ? `${v} km/h` : '—'; }

// ─── Componenta ───────────────────────────────────────────────────────────────

export default function AmbulantaRapoarte() {
  const [ambulante, setAmbulante] = useState([]);
  const [ambulantaId, setAmbulantaId] = useState('');
  const [preset, setPreset] = useState('Luna curentă');
  const [deLa, setDeLa] = useState('');
  const [panaLa, setPanaLa] = useState('');
  const [includeDeschise, setIncludeDeschise] = useState(false);
  const [loading, setLoading] = useState(false);
  const [raport, setRaport] = useState(null);
  const [error, setError] = useState('');
  const [generandPdf, setGenerandPdf] = useState(false);

  const PRESETURI = preseturi();

  useEffect(() => {
    getAmbulante().then(({ data }) => {
      setAmbulante(data);
      if (data.length > 0) setAmbulantaId(String(data[0].id));
    }).catch(() => {});
    applyPreset('Luna curentă');
  }, []); // eslint-disable-line

  function applyPreset(name) {
    setPreset(name);
    if (PRESETURI[name]) {
      setDeLa(PRESETURI[name].de_la);
      setPanaLa(PRESETURI[name].pana_la);
    }
  }

  const handleAfiseaza = async () => {
    if (!ambulantaId) { setError('Selectați o ambulanță.'); return; }
    if (!deLa || !panaLa) { setError('Selectați perioada.'); return; }
    if (deLa > panaLa) { setError('Data de început trebuie să fie înainte de data de sfârșit.'); return; }
    setLoading(true);
    setError('');
    setRaport(null);
    try {
      const { data } = await getRaportAmb({
        ambulanta_id: ambulantaId,
        de_la: deLa,
        pana_la: panaLa,
        include_deschise: includeDeschise ? 'true' : 'false',
      });
      setRaport(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Eroare la încărcarea raportului.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerezaPdf = async () => {
    if (!raport) return;
    setGenerandPdf(true);
    try {
      await genereazaRaportPdf(raport);
    } catch (err) {
      alert('Eroare la generarea PDF: ' + err.message);
    } finally {
      setGenerandPdf(false);
    }
  };

  const toateCursele = raport ? raport.zile.flatMap(z => z.curse) : [];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">📊 Rapoarte Ambulanță</div>
          <div className="page-subtitle">Generați rapoarte de călătorie în format PDF</div>
        </div>
        {raport && (
          <button className="btn btn-primary" onClick={handleGenerezaPdf} disabled={generandPdf}>
            {generandPdf ? 'Se generează...' : '⬇️ Generează PDF'}
          </button>
        )}
      </div>

      <div className="page-body">
        {/* ── Filtre ── */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Filtre</div>

          {error && <div className="alert alert-danger mb-2">{error}</div>}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
            {/* Ambulanță */}
            <div className="form-group" style={{ minWidth: 160, marginBottom: 0 }}>
              <label className="form-label">Ambulanță</label>
              <select className="form-control" value={ambulantaId} onChange={e => setAmbulantaId(e.target.value)}>
                {ambulante.length === 0 && <option value="">—</option>}
                {ambulante.map(a => (
                  <option key={a.id} value={a.id}>{a.numar_inmatriculare}</option>
                ))}
              </select>
            </div>

            {/* Preseturi */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Perioadă</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.keys(PRESETURI).map(name => (
                  <button
                    key={name}
                    className={`btn btn-sm ${preset === name ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => applyPreset(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Date custom */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">De la</label>
              <input type="date" className="form-control" value={deLa}
                onChange={e => { setDeLa(e.target.value); setPreset('Custom'); }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Până la</label>
              <input type="date" className="form-control" value={panaLa}
                onChange={e => { setPanaLa(e.target.value); setPreset('Custom'); }} />
            </div>

            {/* Include deschise */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
              <input type="checkbox" id="incl-deschise" checked={includeDeschise}
                onChange={e => setIncludeDeschise(e.target.checked)} style={{ width: 16, height: 16 }} />
              <label htmlFor="incl-deschise" style={{ fontSize: 13, cursor: 'pointer', margin: 0 }}>
                Include zilele nefinalizate
              </label>
            </div>

            <button className="btn btn-primary" onClick={handleAfiseaza} disabled={loading}
              style={{ alignSelf: 'flex-end' }}>
              {loading ? 'Se încarcă...' : '🔍 Afișează'}
            </button>
          </div>
        </div>

        {/* ── Preview ── */}
        {raport && (
          <>
            {/* Sumar perioadă */}
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
                Sumar perioadă — {raport.ambulanta.numar_inmatriculare} ({raport.perioada.de_la} → {raport.perioada.pana_la})
              </div>
              {raport.sumar_perioada ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ fontSize: 12, minWidth: 700 }}>
                    <thead>
                      <tr>
                        <th>Data început</th><th>Locație început</th>
                        <th>Data final</th><th>Locație final</th>
                        <th>Total km</th><th>Odo start</th><th>Odo final</th>
                        <th>Staț. pornit</th><th>Condus</th><th>Staț. oprit</th>
                        <th>V. medie</th><th>V. max</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{raport.sumar_perioada.data_start}</td>
                        <td style={{ color: '#0A50B4' }}>{raport.sumar_perioada.locatie_start}</td>
                        <td>{raport.sumar_perioada.data_final}</td>
                        <td style={{ color: '#0A50B4' }}>{raport.sumar_perioada.locatie_final}</td>
                        <td><strong>{formatKm(raport.sumar_perioada.total_km)}</strong></td>
                        <td>{formatOdo(raport.sumar_perioada.odometru_start)}</td>
                        <td>{formatOdo(raport.sumar_perioada.odometru_final)}</td>
                        <td>{formatDurata(raport.sumar_perioada.stationare_pornit_sec)}</td>
                        <td>{formatDurata(raport.sumar_perioada.condus_sec)}</td>
                        <td>{formatDurata(raport.sumar_perioada.stationare_oprit_sec)}</td>
                        <td>{formatV(raport.sumar_perioada.viteza_medie)}</td>
                        <td>{formatV(raport.sumar_perioada.viteza_maxima)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Nu există date pentru această perioadă.</div>
              )}
            </div>

            {/* Sumar per zi */}
            {raport.zile.length > 0 && (
              <div className="card" style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Sumar pe zile</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ fontSize: 12, minWidth: 700 }}>
                    <thead>
                      <tr>
                        <th>Zi</th><th>Dată</th><th>Status</th>
                        <th>Ora început</th><th>Loc. început</th>
                        <th>Ora final</th><th>Loc. final</th>
                        <th>Total km</th><th>Condus</th>
                        <th>V. medie</th><th>V. max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {raport.zile.map(zi => (
                        <tr key={zi.id}>
                          <td style={{ textTransform: 'capitalize' }}>{zi.zi_saptamana}</td>
                          <td>{zi.data}</td>
                          <td>
                            <span className={`badge ${zi.status === 'finalizata' ? 'badge-green' : 'badge-blue'}`}>
                              {zi.status === 'finalizata' ? '✓ Finalizată' : '● Deschisă'}
                            </span>
                          </td>
                          <td>{zi.sumar_zi ? formatOra(zi.sumar_zi.ora_start) : '—'}</td>
                          <td style={{ color: '#0A50B4' }}>{zi.sumar_zi?.locatie_start || '—'}</td>
                          <td>{zi.sumar_zi ? formatOra(zi.sumar_zi.ora_final) : '—'}</td>
                          <td style={{ color: '#0A50B4' }}>{zi.sumar_zi?.locatie_final || '—'}</td>
                          <td><strong>{zi.sumar_zi ? formatKm(zi.sumar_zi.total_km) : '—'}</strong></td>
                          <td>{zi.sumar_zi ? formatDurata(zi.sumar_zi.condus_sec) : '—'}</td>
                          <td>{zi.sumar_zi ? formatV(zi.sumar_zi.viteza_medie) : '—'}</td>
                          <td>{zi.sumar_zi ? formatV(zi.sumar_zi.viteza_maxima) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Detalii curse */}
            {toateCursele.length > 0 && (
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
                  Detalii călătorii ({toateCursele.length} curse)
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ fontSize: 11, minWidth: 900 }}>
                    <thead>
                      <tr>
                        <th>Data</th><th>Interval</th>
                        <th>Plecare</th><th>Sosire</th>
                        <th style={{ textAlign: 'right' }}>km</th>
                        <th style={{ textAlign: 'right' }}>Odo start</th>
                        <th style={{ textAlign: 'right' }}>Odo final</th>
                        <th>Staț. pornit</th><th>Condus</th><th>Staț. oprit</th>
                        <th style={{ textAlign: 'right' }}>V. medie</th>
                        <th style={{ textAlign: 'right' }}>V. max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {toateCursele.map(c => (
                        <tr key={c.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{c.data_cursa}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{formatOra(c.ora_plecare)} – {formatOra(c.ora_sosire)}</td>
                          <td style={{ color: '#0A50B4', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.locatie_plecare}>{c.locatie_plecare}</td>
                          <td style={{ color: '#0A50B4', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.locatie_sosire}>{c.locatie_sosire}</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatKm(c.distanta_km)}</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatOdo(c.odometru_start)}</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatOdo(c.odometru_final)}</td>
                          <td>{formatDurata(c.stationare_pornit_sec)}</td>
                          <td>{formatDurata(c.durata_condus_sec)}</td>
                          <td>{c.stationare_oprit_sec != null ? formatDurata(c.stationare_oprit_sec) : '—'}</td>
                          <td style={{ textAlign: 'right' }}>{formatV(c.viteza_medie)}</td>
                          <td style={{ textAlign: 'right' }}>{formatV(c.viteza_maxima)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {raport.zile.length === 0 && (
              <div className="card" style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Nu există zile de activitate finalizate în perioada selectată.
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
