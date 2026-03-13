import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getNotificari, markNotificareaCitita, markToateNotificariCitite } from '../services/api';

const NAV_ITEMS = [
  { to: '/', icon: '📊', label: 'Dashboard', exact: true },
  { to: '/pacienti', icon: '👥', label: 'Pacienți' },
];
const ADMIN_NAV_ITEMS = [
  { to: '/rapoarte', icon: '📈', label: 'Rapoarte' },
  { to: '/utilizatori', icon: '🔧', label: 'Utilizatori' },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificari, setNotificari] = useState([]);
  const [notifDropdown, setNotifDropdown] = useState(false);
  const notifRef = useRef(null);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);

  const fetchNotificari = useCallback(async () => {
    try {
      const { data } = await getNotificari();
      setNotificari(data);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchNotificari();
    const interval = setInterval(fetchNotificari, 30000);
    return () => clearInterval(interval);
  }, [fetchNotificari]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkCitita = async (id) => {
    await markNotificareaCitita(id);
    setNotificari(prev => prev.filter(n => n.id !== id));
  };

  const handleMarkToate = async () => {
    await markToateNotificariCitite();
    setNotificari([]);
    setNotifDropdown(false);
  };

  const formatTimp = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMin = Math.floor((now - date) / 60000);
    if (diffMin < 1) return 'acum';
    if (diffMin < 60) return `acum ${diffMin} minute`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `acum ${diffHrs} ${diffHrs === 1 ? 'oră' : 'ore'}`;
    const ora = date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    if (diffHrs < 48) return `ieri la ${ora}`;
    return date.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' }) + ` la ${ora}`;
  };

  const NotifBell = () => (
    <div ref={notifRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setNotifDropdown(prev => !prev)}
        aria-label="Notificări"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 22, padding: '8px', minWidth: 44, minHeight: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', borderRadius: 8,
          color: 'var(--text-primary, #333)'
        }}
      >
        🔔
        {notificari.length > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            background: '#E53935', color: 'white',
            borderRadius: '50%', fontSize: 10, fontWeight: 700,
            minWidth: 18, height: 18, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', lineHeight: 1
          }}>
            {notificari.length > 99 ? '99+' : notificari.length}
          </span>
        )}
      </button>

      {notifDropdown && (
        <div style={{
          position: 'absolute', top: '110%', right: 0,
          background: 'white', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          minWidth: 320, maxWidth: 360, maxHeight: 420, overflowY: 'auto',
          zIndex: 1000, border: '1px solid #eee'
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid #eee'
          }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>
              Notificări {notificari.length > 0 && `(${notificari.length})`}
            </span>
            {notificari.length > 0 && (
              <button
                onClick={handleMarkToate}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#E53935', fontSize: 12, fontWeight: 600, padding: '4px 8px'
                }}
              >
                Marchează toate ca citite
              </button>
            )}
          </div>

          {notificari.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#999', fontSize: 14 }}>
              Nu ai notificări noi
            </div>
          ) : (
            notificari.map(n => (
              <div
                key={n.id}
                style={{
                  padding: '12px 16px', borderBottom: '1px solid #f5f5f5',
                  background: '#fff8f8', cursor: 'pointer'
                }}
                onClick={() => handleMarkCitita(n.id)}
              >
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: '#222' }}>
                  {n.titlu}
                </div>
                <div style={{ fontSize: 13, color: '#555', marginBottom: 6, lineHeight: 1.4 }}>
                  {n.mesaj}
                </div>
                <div style={{ fontSize: 11, color: '#999' }}>
                  {formatTimp(n.created_at)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavClick = useCallback(() => {
    closeSidebar();
  }, [closeSidebar]);

  const initials = user?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2) || 'U';

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path === '/pacienti') return 'Pacienți';
    if (path === '/pacienti/nou') return 'Pacient Nou';
    if (path.includes('/vizita')) return 'Vizită';
    if (path.startsWith('/pacienti/')) return 'Profil Pacient';
    if (path === '/rapoarte') return 'Rapoarte';
    if (path === '/utilizatori') return 'Utilizatori';
    return 'Red Medica';
  };

  const isBottomActive = (to) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  return (
    <div className="app-layout">
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} aria-hidden="true" />
      )}

      {/* Mobile top header */}
      <header className="mobile-header" role="banner">
        <button className="hamburger-btn" onClick={toggleSidebar} aria-label="Deschide meniu">
          {sidebarOpen ? '✕' : '☰'}
        </button>

        <div className="mobile-logo-center">
          <img
            src="/logo.png"
            alt="Red Medica"
            className="mobile-logo-img"
            style={{ width: 40, height: 40, objectFit: 'contain' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <span>{getPageTitle()}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <NotifBell />
          <button
            className="header-action-btn"
            onClick={() => { navigate('/pacienti'); closeSidebar(); }}
            aria-label="Căutare pacient"
          >
            🔍
          </button>
        </div>
      </header>

      {/* Desktop / Mobile Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} role="navigation">
        <div className="sidebar-logo" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <img
            src="/logo.png"
            alt="Red Medica"
            className="sidebar-logo-img"
            style={{ width: 80, height: 80, objectFit: 'contain', marginBottom: 8 }}
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
          <div style={{ display: 'none', width: 80, height: 80, background: 'var(--primary)', borderRadius: 16, marginBottom: 8, alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: 'white', textAlign: 'center' }}>
            Red Medica
          </div>
          <div>
            <div className="logo-text">Red Medica</div>
            <div className="logo-sub">Asistență la Domiciliu</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">Principal</div>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={handleNavClick}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="nav-section" style={{ marginTop: 8 }}>Administrator</div>
              {ADMIN_NAV_ITEMS.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  onClick={handleNavClick}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </>
          )}

          <div className="nav-section" style={{ marginTop: 8 }}>Acțiuni rapide</div>
          <div
            className="nav-item"
            onClick={() => { navigate('/pacienti/nou'); handleNavClick(); }}
            role="button"
            tabIndex={0}
          >
            <span className="nav-icon">➕</span>
            Adaugă Pacient
          </div>
        </nav>

        <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0' }}>
          <NotifBell />
        </div>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{initials}</div>
            <div>
              <div className="user-name">{user?.name}</div>
              <div className="user-role">
                {user?.role === 'admin' ? '🛡️ Administrator' : '👤 Angajat'}
              </div>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            🚪 Deconectare
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="main-content">
        <Outlet />
      </div>

      {/* Bottom navigation bar (mobile only) */}
      <nav className="bottom-nav" role="navigation" aria-label="Navigare principală">
        <button
          className={`bottom-nav-item ${isBottomActive('/') && location.pathname === '/' ? 'active' : ''}`}
          onClick={() => { navigate('/'); closeSidebar(); }}
        >
          <span className="bottom-nav-icon">🏠</span>
          <span>Acasă</span>
        </button>

        <button
          className={`bottom-nav-item ${isBottomActive('/pacienti') && location.pathname === '/pacienti' ? 'active' : ''}`}
          onClick={() => { navigate('/pacienti'); closeSidebar(); }}
        >
          <span className="bottom-nav-icon">👥</span>
          <span>Pacienți</span>
        </button>

        <button
          className="bottom-nav-item"
          onClick={() => { navigate('/pacienti/nou'); closeSidebar(); }}
          aria-label="Adaugă pacient nou"
        >
          <div className="bottom-nav-add-btn">+</div>
          <span>Adaugă</span>
        </button>

        <button
          className={`bottom-nav-item ${isBottomActive('/pacienti') && location.pathname.includes('/vizita') ? 'active' : ''}`}
          onClick={() => { navigate('/pacienti'); closeSidebar(); }}
        >
          <span className="bottom-nav-icon">📋</span>
          <span>Vizite</span>
        </button>

        {isAdmin && (
          <button
            className={`bottom-nav-item ${isBottomActive('/rapoarte') ? 'active' : ''}`}
            onClick={() => { navigate('/rapoarte'); closeSidebar(); }}
          >
            <span className="bottom-nav-icon">📈</span>
            <span>Rapoarte</span>
          </button>
        )}
      </nav>
    </div>
  );
}
