import React, { useState, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);

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
            src={process.env.REACT_APP_LOGO_URL || '/logo.png'}
            alt="Red Medica"
            className="mobile-logo-img"
            style={{ width: 40, height: 40, objectFit: 'contain' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <span>{getPageTitle()}</span>
        </div>

        <button
          className="header-action-btn"
          onClick={() => { navigate('/pacienti'); closeSidebar(); }}
          aria-label="Căutare pacient"
        >
          🔍
        </button>
      </header>

      {/* Desktop / Mobile Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} role="navigation">
        <div className="sidebar-logo" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <img
            src={process.env.REACT_APP_LOGO_URL || '/logo.png'}
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
