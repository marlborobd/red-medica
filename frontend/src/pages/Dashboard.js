import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getReportSummary, getPatients, getVisitsDetail } from '../services/api';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentVisits, setRecentVisits] = useState([]);
  const [recentPatients, setRecentPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const patientsRes = await getPatients();
      setRecentPatients(patientsRes.data.slice(0, 5));

      if (isAdmin) {
        const from30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const [summaryRes, visitsRes] = await Promise.all([
          getReportSummary(),
          getVisitsDetail({ from: from30d })
        ]);
        setStats(summaryRes.data);
        setRecentVisits(visitsRes.data.slice(0, 5));
      } else {
        const now = new Date();
        setStats({
          totalPatients: patientsRes.data.length,
          totalVisits: '—',
          visitsThisMonth: '—',
          patientsThisMonth: patientsRes.data.filter(p => {
            const date = new Date(p.data_inregistrare);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
          }).length
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  const dayName = new Date().toLocaleDateString('ro-RO', { weekday: 'long' });
  const fullDate = new Date().toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) return (
    <div className="loading">
      <div className="loading-spinner" />
      <span className="loading-text">Se încarcă dashboard-ul...</span>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">
            {dayName.charAt(0).toUpperCase() + dayName.slice(1)}, {fullDate} — Bun venit, <strong>{user?.name}</strong>!
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/pacienti/nou')}>
          + Pacient Nou
        </button>
      </div>

      <div className="page-body">
        {/* Statistics */}
        <div className="stats-grid">
          <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/pacienti')}>
            <div className="stat-icon blue">👥</div>
            <div>
              <div className="stat-value">{stats?.totalPatients ?? 0}</div>
              <div className="stat-label">Total Pacienți</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">📋</div>
            <div>
              <div className="stat-value">{stats?.totalVisits ?? 0}</div>
              <div className="stat-label">Total Vizite</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange">📅</div>
            <div>
              <div className="stat-value">{stats?.visitsThisMonth ?? 0}</div>
              <div className="stat-label">Vizite Luna Aceasta</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">🆕</div>
            <div>
              <div className="stat-value">{stats?.patientsThisMonth ?? 0}</div>
              <div className="stat-label">Pacienți Noi / Lună</div>
            </div>
          </div>
          {isAdmin && (
            <>
              <div className="stat-card">
                <div className="stat-icon teal">👤</div>
                <div>
                  <div className="stat-value">{stats?.totalEmployees ?? 0}</div>
                  <div className="stat-label">Angajați Activi</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green">💰</div>
                <div>
                  <div className="stat-value" style={{ fontSize: 20 }}>
                    {Number(stats?.incasat ?? 0).toLocaleString('ro-RO')} lei
                  </div>
                  <div className="stat-label">Total Încasat</div>
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr', gap: 20 }}>
          {/* Recent Patients */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">👥 Pacienți Recenți</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/pacienti')}>
                Vezi toți →
              </button>
            </div>
            {recentPatients.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 20px' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
                <p>Nu există pacienți înregistrați</p>
                <button className="btn btn-primary btn-sm mt-1" onClick={() => navigate('/pacienti/nou')}>
                  + Adaugă Primul Pacient
                </button>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Nume</th>
                      <th>Vârstă</th>
                      <th>Telefon</th>
                      <th>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPatients.map(p => (
                      <tr
                        key={p.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/pacienti/${p.id}`)}
                      >
                        <td><strong>{p.nume}</strong></td>
                        <td>{p.varsta ? <span className="badge badge-blue">{p.varsta} ani</span> : '—'}</td>
                        <td style={{ fontSize: 13 }}>{p.telefon || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatDate(p.data_inregistrare)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Visits (admin only) */}
          {isAdmin && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">📋 Vizite Recente (30 zile)</span>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/rapoarte')}>
                  Rapoarte →
                </button>
              </div>
              {recentVisits.length === 0 ? (
                <div className="empty-state" style={{ padding: '32px 20px' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                  <p>Nu există vizite în ultimele 30 zile</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Pacient</th>
                        <th>Angajat</th>
                        <th>Data</th>
                        <th>Încasat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentVisits.map(v => (
                        <tr
                          key={v.id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/pacienti/${v.patient_id}`)}
                        >
                          <td><strong>{v.patient_name}</strong></td>
                          <td style={{ fontSize: 13 }}>{v.angajat_name}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatDate(v.data)}</td>
                          <td style={{ color: 'var(--secondary)', fontWeight: 600 }}>
                            {Number(v.suma_incasata || 0).toLocaleString('ro-RO')} lei
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick actions (mobile) */}
        <div className="card mt-3" style={{ display: 'block' }}>
          <div className="card-header"><span className="card-title">⚡ Acțiuni Rapide</span></div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {[
              { icon: '👥', label: 'Lista Pacienți', to: '/pacienti' },
              { icon: '➕', label: 'Pacient Nou', to: '/pacienti/nou' },
              ...(isAdmin ? [
                { icon: '📈', label: 'Rapoarte', to: '/rapoarte' },
                { icon: '🔧', label: 'Utilizatori', to: '/utilizatori' }
              ] : [])
            ].map(item => (
              <button
                key={item.to}
                className="btn btn-ghost"
                onClick={() => navigate(item.to)}
                style={{ justifyContent: 'flex-start', gap: 10, fontSize: 15, padding: '14px 16px', height: 54 }}
              >
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
