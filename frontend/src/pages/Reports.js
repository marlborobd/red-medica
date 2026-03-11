import React, { useState, useEffect } from 'react';
import { getReportSummary, getReportMonthly, getReportEmployees, getVisitsDetail, getUsers, triggerManualBackup, getBackupStatus } from '../services/api';

const MONTHS = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Reports() {
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [visits, setVisits] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [filters, setFilters] = useState({ from: '', to: '', angajat_id: '' });
  const [activeTab, setActiveTab] = useState('general');
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState(null);
  const [lastBackupAt, setLastBackupAt] = useState(null);

  useEffect(() => {
    loadMain();
    loadUsers();
    getBackupStatus().then(r => { if (r.data.lastBackupAt) setLastBackupAt(r.data.lastBackupAt); }).catch(() => {});
  }, []);

  useEffect(() => { loadMonthly(); }, [year]);

  const loadMain = async () => {
    setLoading(true);
    try {
      const [sRes, eRes] = await Promise.all([getReportSummary(), getReportEmployees()]);
      setSummary(sRes.data);
      setEmployees(eRes.data);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthly = async () => {
    try {
      const res = await getReportMonthly(year);
      setMonthly(res.data);
    } catch {}
  };

  const loadUsers = async () => {
    try {
      const res = await getUsers();
      setUsers(res.data);
    } catch {}
  };

  const loadVisits = async () => {
    setVisitsLoading(true);
    try {
      const res = await getVisitsDetail(filters);
      setVisits(res.data);
    } finally {
      setVisitsLoading(false);
    }
  };

  const handleManualBackup = async () => {
    setBackupLoading(true);
    setBackupMsg(null);
    try {
      await triggerManualBackup();
      const now = new Date().toISOString();
      setLastBackupAt(now);
      setBackupMsg({ ok: true, text: 'Backup reușit!' });
    } catch (err) {
      setBackupMsg({ ok: false, text: err.response?.data?.message || 'Eroare la backup' });
    } finally {
      setBackupLoading(false);
      setTimeout(() => setBackupMsg(null), 5000);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('ro-RO') : '-';
  const formatMoney = (v) => `${Number(v || 0).toLocaleString('ro-RO')} lei`;

  const maxMonthlyVisits = Math.max(...monthly.map(m => m.vizite), 1);

  if (loading) return <div className="loading"><div className="loading-spinner" />Se încarcă rapoartele...</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">📈 Rapoarte</div>
          <div className="page-subtitle">Statistici și analize — doar administratori</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <button
            className="btn btn-danger btn-sm"
            onClick={handleManualBackup}
            disabled={backupLoading}
            style={{ minWidth: 150 }}
          >
            {backupLoading
              ? <><span className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }} />Se salvează...</>
              : '💾 Backup Manual'}
          </button>
          {backupMsg && (
            <span style={{ fontSize: 12, fontWeight: 600, color: backupMsg.ok ? 'var(--secondary)' : 'var(--danger)' }}>
              {backupMsg.ok ? '✓' : '✗'} {backupMsg.text}
            </span>
          )}
          {lastBackupAt && !backupMsg && (
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Ultimul backup: {new Date(lastBackupAt).toLocaleString('ro-RO')}
            </span>
          )}
        </div>
      </div>

      <div className="page-body">
        {/* Tab navigation */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--white)', padding: 6, borderRadius: 10, marginBottom: 20, border: '1px solid var(--border)', width: 'fit-content' }}>
          {[
            { key: 'general', label: '📊 General' },
            { key: 'lunar', label: '📅 Lunar' },
            { key: 'angajati', label: '👤 Angajați' },
            { key: 'vizite', label: '📋 Vizite Detaliate' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); if (tab.key === 'vizite' && visits.length === 0) loadVisits(); }}
              className={`btn btn-sm ${activeTab === tab.key ? 'btn-primary' : 'btn-ghost'}`}
              style={{ border: 'none' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* General */}
        {activeTab === 'general' && (
          <div className="report-section">
            <div className="stats-grid">
              {[
                { label: 'Total Pacienți', value: summary?.totalPatients, icon: '👥', color: 'blue' },
                { label: 'Total Vizite', value: summary?.totalVisits, icon: '📋', color: 'green' },
                { label: 'Angajați Activi', value: summary?.totalEmployees, icon: '👤', color: 'purple' },
                { label: 'Vizite Luna Aceasta', value: summary?.visitsThisMonth, icon: '📅', color: 'orange' },
                { label: 'Pacienți Noi Luna Aceasta', value: summary?.patientsThisMonth, icon: '🆕', color: 'teal' },
                { label: 'Total Facturat', value: formatMoney(summary?.revenue), icon: '💳', color: 'blue' },
                { label: 'Total Încasat', value: formatMoney(summary?.incasat), icon: '💰', color: 'green' },
                {
                  label: 'Rest de Încasat',
                  value: formatMoney((summary?.revenue || 0) - (summary?.incasat || 0)),
                  icon: '⚠️',
                  color: 'orange'
                }
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <div className={`stat-icon ${s.color}`}>{s.icon}</div>
                  <div>
                    <div className="stat-value" style={{ fontSize: typeof s.value === 'string' ? 20 : 28 }}>{s.value ?? 0}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Monthly */}
        {activeTab === 'lunar' && (
          <div className="report-section">
            <div className="card">
              <div className="card-header">
                <span className="card-title">📅 Statistici Lunare {year}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setYear(y => y - 1)}>← {year - 1}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setYear(y => y + 1)}>{year + 1} →</button>
                </div>
              </div>
              <div className="card-body">
                {/* Bar chart */}
                <div className="chart-bars" style={{ height: 200, marginBottom: 12 }}>
                  {MONTHS.map((month, idx) => {
                    const data = monthly.find(m => parseInt(m.luna) === idx + 1);
                    const count = data?.vizite || 0;
                    const height = maxMonthlyVisits > 0 ? (count / maxMonthlyVisits) * 160 : 0;
                    return (
                      <div key={month} className="chart-bar-wrapper">
                        {count > 0 && <div className="chart-value">{count}</div>}
                        <div className="chart-bar" style={{ height: Math.max(height, count > 0 ? 4 : 0) }} title={`${month}: ${count} vizite`} />
                        <div className="chart-label">{month}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="table-wrapper mt-2">
                  <table>
                    <thead>
                      <tr><th>Lună</th><th>Vizite</th><th>Total Facturat</th><th>Total Încasat</th><th>Rest</th></tr>
                    </thead>
                    <tbody>
                      {MONTHS.map((month, idx) => {
                        const d = monthly.find(m => parseInt(m.luna) === idx + 1);
                        if (!d) return (
                          <tr key={month}><td>{month}</td><td style={{ color: 'var(--text-secondary)' }}>0</td><td>—</td><td>—</td><td>—</td></tr>
                        );
                        const rest = (d.total_plata || 0) - (d.total_incasat || 0);
                        return (
                          <tr key={month}>
                            <td><strong>{month}</strong></td>
                            <td><span className="badge badge-blue">{d.vizite}</span></td>
                            <td>{formatMoney(d.total_plata)}</td>
                            <td style={{ color: 'var(--secondary)', fontWeight: 600 }}>{formatMoney(d.total_incasat)}</td>
                            <td style={{ color: rest > 0 ? 'var(--danger)' : 'var(--secondary)' }}>{formatMoney(rest)}</td>
                          </tr>
                        );
                      })}
                      <tr style={{ background: 'var(--primary-light)', fontWeight: 700 }}>
                        <td>TOTAL</td>
                        <td>{monthly.reduce((s, m) => s + m.vizite, 0)}</td>
                        <td>{formatMoney(monthly.reduce((s, m) => s + (m.total_plata || 0), 0))}</td>
                        <td style={{ color: 'var(--secondary)' }}>{formatMoney(monthly.reduce((s, m) => s + (m.total_incasat || 0), 0))}</td>
                        <td style={{ color: 'var(--danger)' }}>{formatMoney(monthly.reduce((s, m) => s + (m.total_plata || 0) - (m.total_incasat || 0), 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Employees */}
        {activeTab === 'angajati' && (
          <div className="report-section">
            <div className="card">
              <div className="card-header"><span className="card-title">👤 Statistici pe Angajați</span></div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Angajat</th><th>Rol</th><th>Pacienți</th><th>Vizite</th><th>Total Facturat</th><th>Total Încasat</th></tr>
                  </thead>
                  <tbody>
                    {employees.map(e => (
                      <tr key={e.id}>
                        <td><strong>{e.name}</strong><br /><small style={{ color: 'var(--text-secondary)' }}>{e.email}</small></td>
                        <td><span className={`badge ${e.role === 'admin' ? 'badge-purple' : 'badge-blue'}`}>{e.role === 'admin' ? 'Admin' : 'Angajat'}</span></td>
                        <td>{e.pacienti}</td>
                        <td><strong>{e.vizite}</strong></td>
                        <td>{formatMoney(e.total_plata)}</td>
                        <td style={{ color: 'var(--secondary)', fontWeight: 600 }}>{formatMoney(e.total_incasat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Visits detail */}
        {activeTab === 'vizite' && (
          <div className="report-section">
            <div className="card mb-3">
              <div className="card-header"><span className="card-title">🔍 Filtrare Vizite</span></div>
              <div className="card-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">De la data</label>
                    <input type="date" className="form-control" value={filters.from} onChange={e => setFilters(p => ({ ...p, from: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Până la data</label>
                    <input type="date" className="form-control" value={filters.to} onChange={e => setFilters(p => ({ ...p, to: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Angajat</label>
                    <select className="form-control" value={filters.angajat_id} onChange={e => setFilters(p => ({ ...p, angajat_id: e.target.value }))}>
                      <option value="">Toți angajații</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={loadVisits} disabled={visitsLoading}>
                    {visitsLoading ? 'Se încarcă...' : '🔍 Aplică Filtrele'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => { setFilters({ from: '', to: '', angajat_id: '' }); setVisits([]); }}>
                    Resetează
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">📋 Vizite ({visits.length})</span>
                {visits.length > 0 && (
                  <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                    <span>Total facturat: <strong style={{ color: 'var(--primary)' }}>{formatMoney(visits.reduce((s, v) => s + (v.suma_de_plata || 0), 0))}</strong></span>
                    <span>Total încasat: <strong style={{ color: 'var(--secondary)' }}>{formatMoney(visits.reduce((s, v) => s + (v.suma_incasata || 0), 0))}</strong></span>
                  </div>
                )}
              </div>
              {visitsLoading ? (
                <div className="loading"><div className="loading-spinner" />Se încarcă...</div>
              ) : visits.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <h3>Aplicați filtrele pentru a vedea vizitele</h3>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>Data</th><th>Pacient</th><th>CNP</th><th>Angajat</th><th>Diagnostic</th><th>Stare</th><th>Tensiune</th><th>Temp.</th><th>Facturat</th><th>Încasat</th></tr>
                    </thead>
                    <tbody>
                      {visits.map(v => (
                        <tr key={v.id}>
                          <td>{formatDate(v.data)}<br /><small style={{ color: 'var(--text-secondary)' }}>{v.ora}</small></td>
                          <td><strong>{v.patient_name}</strong></td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{v.cnp}</td>
                          <td>{v.angajat_name}</td>
                          <td>{v.diagnostic || '-'}</td>
                          <td>{v.stare_pacient ? <span className="badge badge-blue">{v.stare_pacient}</span> : '-'}</td>
                          <td>{v.tensiune || '-'}</td>
                          <td>{v.temperatura ? `${v.temperatura}°C` : '-'}</td>
                          <td>{v.suma_de_plata > 0 ? formatMoney(v.suma_de_plata) : '-'}</td>
                          <td style={{ color: 'var(--secondary)', fontWeight: 600 }}>{v.suma_incasata > 0 ? formatMoney(v.suma_incasata) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
