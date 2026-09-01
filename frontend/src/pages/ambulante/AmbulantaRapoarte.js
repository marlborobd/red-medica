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
  const [expandSumar, setExpandSumar] = useState(false);
  const [expandZile, setExpandZile] = useState(() => new Set());
  const [expandCurseRaport, setExpandCurseRaport] = useState(() => new Set());

  const toggleSet = (setter, id) => setter(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

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
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Filtre</div>

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
        </div>

        {/* ── Preview ── */}
        {raport && (
          <>
            {/* Sumar perioadă */}
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ padding: '14px 20px 10px', fontWeight: 600, fontSize: 15 }}>
                Sumar perioadă — {raport.ambulanta.numar_inmatriculare} ({raport.perioada.de_la} → {raport.perioada.pana_la})
              </div>
              {raport.sumar_perioada ? (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 95 }}>Data început</th>
                        <th className="col-wide">Locație început</th>
                        <th className="col-p2" style={{ width: 95 }}>Data final</th>
                        <th className="col-p2 col-wide">Locație final</th>
                        <th className="col-num">Total km</th>
                        <th className="col-p3 col-num">Odo start</th>
                        <th className="col-p3 col-num">Odo final</th>
                        <th className="col-p2">Staț. pornit</th>
                        <th className="col-p2">Condus</th>
                        <th className="col-p3">Staț. oprit</th>
                        <th className="col-p2 col-num">V. medie</th>
                        <th className="col-p3 col-num">V. max</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        className={`row-expandable${expandSumar ? ' row-expanded' : ''}`}
                        onClick={() => setExpandSumar(v => !v)}
                      >
                        <td>{raport.sumar_perioada.data_start}</td>
                        <td className="col-wide" style={{ color: '#0A50B4' }}>{raport.sumar_perioada.locatie_start}</td>
                        <td className="col-p2">{raport.sumar_perioada.data_final}</td>
                        <td className="col-p2 col-wide" style={{ color: '#0A50B4' }}>{raport.sumar_perioada.locatie_final}</td>
                        <td className="col-num"><strong>{formatKm(raport.sumar_perioada.total_km)}</strong></td>
                        <td className="col-p3 col-num">{formatOdo(raport.sumar_perioada.odometru_start)}</td>
                        <td className="col-p3 col-num">{formatOdo(raport.sumar_perioada.odometru_final)}</td>
                        <td className="col-p2">{formatDurata(raport.sumar_perioada.stationare_pornit_sec)}</td>
                        <td className="col-p2">{formatDurata(raport.sumar_perioada.condus_sec)}</td>
                        <td className="col-p3">{formatDurata(raport.sumar_perioada.stationare_oprit_sec)}</td>
                        <td className="col-p2 col-num">{formatV(raport.sumar_perioada.viteza_medie)}</td>
                        <td className="col-p3 col-num">{formatV(raport.sumar_perioada.viteza_maxima)}</td>
                      </tr>
                      <tr className="row-detail">
                        <td colSpan={12}>
                          <dl className="row-detail-grid">
                            <dt>Data final</dt><dd>{raport.sumar_perioada.data_final}</dd>
                            <dt>Locație final</dt><dd>{raport.sumar_perioada.locatie_final}</dd>
                            <dt>Odo start</dt><dd>{formatOdo(raport.sumar_perioada.odometru_start)}</dd>
                            <dt>Odo final</dt><dd>{formatOdo(raport.sumar_perioada.odometru_final)}</dd>
                            <dt>Staț. pornit</dt><dd>{formatDurata(raport.sumar_perioada.stationare_pornit_sec)}</dd>
                            <dt>Condus</dt><dd>{formatDurata(raport.sumar_perioada.condus_sec)}</dd>
                            <dt>Staț. oprit</dt><dd>{formatDurata(raport.sumar_perioada.stationare_oprit_sec)}</dd>
                            <dt>V. medie</dt><dd>{formatV(raport.sumar_perioada.viteza_medie)}</dd>
                            <dt>V. max</dt><dd>{formatV(raport.sumar_perioada.viteza_maxima)}</dd>
                          </dl>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '0 20px 16px', color: 'var(--text-secondary)', fontSize: 13 }}>Nu există date pentru această perioadă.</div>
              )}
            </div>

            {/* Sumar per zi */}
            {raport.zile.length > 0 && (
              <div className="card" style={{ marginBottom: 12 }}>
                <div style={{ padding: '14px 20px 10px', fontWeight: 600, fontSize: 15 }}>Sumar pe zile</div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th className="col-p2" style={{ width: 90 }}>Zi</th>
                        <th style={{ width: 95 }}>Dată</th>
                        <th style={{ width: 110 }}>Status</th>
                        <th className="col-p2" style={{ width: 75 }}>Ora început</th>
                        <th className="col-p2 col-wide">Loc. început</th>
                        <th className="col-p2" style={{ width: 75 }}>Ora final</th>
                        <th className="col-p2 col-wide">Loc. final</th>
                        <th className="col-num">Total km</th>
                        <th className="col-p2">Condus</th>
                        <th className="col-p3 col-num">V. medie</th>
                        <th className="col-p3 col-num">V. max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {raport.zile.map(zi => (
                        <React.Fragment key={zi.id}>
                          <tr
                            className={`row-expandable${expandZile.has(zi.id) ? ' row-expanded' : ''}`}
                            onClick={() => toggleSet(setExpandZile, zi.id)}
                          >
                            <td className="col-p2" style={{ textTransform: 'capitalize' }}>{zi.zi_saptamana}</td>
                            <td>{zi.data}</td>
                            <td>
                              <span className={`badge ${zi.status === 'finalizata' ? 'badge-green' : 'badge-blue'}`}>
                                {zi.status === 'finalizata' ? '✓ Finalizată' : '● Deschisă'}
                              </span>
                            </td>
                            <td className="col-p2">{zi.sumar_zi ? formatOra(zi.sumar_zi.ora_start) : '—'}</td>
                            <td className="col-p2 col-wide" style={{ color: '#0A50B4' }}>{zi.sumar_zi?.locatie_start || '—'}</td>
                            <td className="col-p2">{zi.sumar_zi ? formatOra(zi.sumar_zi.ora_final) : '—'}</td>
                            <td className="col-p2 col-wide" style={{ color: '#0A50B4' }}>{zi.sumar_zi?.locatie_final || '—'}</td>
                            <td className="col-num"><strong>{zi.sumar_zi ? formatKm(zi.sumar_zi.total_km) : '—'}</strong></td>
                            <td className="col-p2">{zi.sumar_zi ? formatDurata(zi.sumar_zi.condus_sec) : '—'}</td>
                            <td className="col-p3 col-num">{zi.sumar_zi ? formatV(zi.sumar_zi.viteza_medie) : '—'}</td>
                            <td className="col-p3 col-num">{zi.sumar_zi ? formatV(zi.sumar_zi.viteza_maxima) : '—'}</td>
                          </tr>
                          <tr className="row-detail">
                            <td colSpan={11}>
                              <dl className="row-detail-grid">
                                <dt>Zi</dt><dd style={{ textTransform: 'capitalize' }}>{zi.zi_saptamana}</dd>
                                <dt>Ora început</dt><dd>{zi.sumar_zi ? formatOra(zi.sumar_zi.ora_start) : '—'}</dd>
                                <dt>Loc. început</dt><dd>{zi.sumar_zi?.locatie_start || '—'}</dd>
                                <dt>Ora final</dt><dd>{zi.sumar_zi ? formatOra(zi.sumar_zi.ora_final) : '—'}</dd>
                                <dt>Loc. final</dt><dd>{zi.sumar_zi?.locatie_final || '—'}</dd>
                                <dt>Condus</dt><dd>{zi.sumar_zi ? formatDurata(zi.sumar_zi.condus_sec) : '—'}</dd>
                                <dt>V. medie</dt><dd>{zi.sumar_zi ? formatV(zi.sumar_zi.viteza_medie) : '—'}</dd>
                                <dt>V. max</dt><dd>{zi.sumar_zi ? formatV(zi.sumar_zi.viteza_maxima) : '—'}</dd>
                              </dl>
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Detalii curse */}
            {toateCursele.length > 0 && (
              <div className="card">
                <div style={{ padding: '14px 20px 10px', fontWeight: 600, fontSize: 15 }}>
                  Detalii călătorii ({toateCursele.length} curse)
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 95 }}>Data</th>
                        <th style={{ width: 118 }}>Interval</th>
                        <th className="col-p2 col-wide">Plecare</th>
                        <th className="col-p2 col-wide">Sosire</th>
                        <th className="col-num">km</th>
                        <th className="col-p3 col-num">Odo start</th>
                        <th className="col-p3 col-num">Odo final</th>
                        <th className="col-p2">Staț. pornit</th>
                        <th className="col-p2">Condus</th>
                        <th className="col-p3">Staț. oprit</th>
                        <th className="col-p2 col-num">V. medie</th>
                        <th className="col-p3 col-num">V. max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {toateCursele.map(c => (
                        <React.Fragment key={c.id}>
                          <tr
                            className={`row-expandable${expandCurseRaport.has(c.id) ? ' row-expanded' : ''}`}
                            onClick={() => toggleSet(setExpandCurseRaport, c.id)}
                          >
                            <td>{c.data_cursa}</td>
                            <td>{formatOra(c.ora_plecare)} – {formatOra(c.ora_sosire)}</td>
                            <td className="col-p2 col-wide" style={{ color: '#0A50B4' }} title={c.locatie_plecare}>{c.locatie_plecare}</td>
                            <td className="col-p2 col-wide" style={{ color: '#0A50B4' }} title={c.locatie_sosire}>{c.locatie_sosire}</td>
                            <td className="col-num">{formatKm(c.distanta_km)}</td>
                            <td className="col-p3 col-num">{formatOdo(c.odometru_start)}</td>
                            <td className="col-p3 col-num">{formatOdo(c.odometru_final)}</td>
                            <td className="col-p2">{formatDurata(c.stationare_pornit_sec)}</td>
                            <td className="col-p2">{formatDurata(c.durata_condus_sec)}</td>
                            <td className="col-p3">{c.stationare_oprit_sec != null ? formatDurata(c.stationare_oprit_sec) : '—'}</td>
                            <td className="col-p2 col-num">{formatV(c.viteza_medie)}</td>
                            <td className="col-p3 col-num">{formatV(c.viteza_maxima)}</td>
                          </tr>
                          <tr className="row-detail">
                            <td colSpan={12}>
                              <dl className="row-detail-grid">
                                <dt>Plecare</dt><dd>{c.locatie_plecare}</dd>
                                <dt>Sosire</dt><dd>{c.locatie_sosire}</dd>
                                <dt>Odo start</dt><dd>{formatOdo(c.odometru_start)}</dd>
                                <dt>Odo final</dt><dd>{formatOdo(c.odometru_final)}</dd>
                                <dt>Staț. pornit</dt><dd>{formatDurata(c.stationare_pornit_sec)}</dd>
                                <dt>Condus</dt><dd>{formatDurata(c.durata_condus_sec)}</dd>
                                <dt>Staț. oprit</dt><dd>{c.stationare_oprit_sec != null ? formatDurata(c.stationare_oprit_sec) : '—'}</dd>
                                <dt>V. medie</dt><dd>{formatV(c.viteza_medie)}</dd>
                                <dt>V. max</dt><dd>{formatV(c.viteza_maxima)}</dd>
                              </dl>
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {raport.zile.length === 0 && (
              <div className="card" style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Nu există zile de activitate finalizate în perioada selectată.
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
