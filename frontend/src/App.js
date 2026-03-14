import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PatientList from './pages/PatientList';
import AddPatient from './pages/AddPatient';
import PatientProfile from './pages/PatientProfile';
import AddVisit from './pages/AddVisit';
import Reports from './pages/Reports';
import Users from './pages/Users';
import FoaieParcurs from './pages/FoaieParcurs';
import FoaieParcursAdmin from './pages/FoaieParcursAdmin';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><div className="loading-spinner" />Se încarcă...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function UpdateBanner() {
  const [swReg, setSwReg] = useState(null);

  useEffect(() => {
    const handler = (e) => setSwReg(e.detail);
    window.addEventListener('swUpdateAvailable', handler);
    return () => window.removeEventListener('swUpdateAvailable', handler);
  }, []);

  if (!swReg) return null;

  const handleUpdate = () => {
    if (swReg.waiting) {
      swReg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  return (
    <div style={{
      position: 'fixed', bottom: 70, left: '50%', transform: 'translateX(-50%)',
      background: '#1a1a2e', color: '#fff', borderRadius: 12,
      padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 9999,
      fontSize: 14, maxWidth: 'calc(100vw - 32px)', whiteSpace: 'nowrap'
    }}>
      <span>🔄 Versiune nouă disponibilă</span>
      <button
        onClick={handleUpdate}
        style={{
          background: '#C0392B', color: '#fff', border: 'none',
          borderRadius: 8, padding: '6px 16px', fontSize: 13,
          fontWeight: 700, cursor: 'pointer', flexShrink: 0
        }}
      >
        Actualizează
      </button>
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="pacienti" element={<PatientList />} />
        <Route path="pacienti/nou" element={<AddPatient />} />
        <Route path="pacienti/:id" element={<PatientProfile />} />
        <Route path="pacienti/:id/vizita" element={<AddVisit />} />
        <Route path="pacienti/:id/vizita/:visitId" element={<AddVisit />} />
        <Route path="rapoarte" element={<AdminRoute><Reports /></AdminRoute>} />
        <Route path="utilizatori" element={<AdminRoute><Users /></AdminRoute>} />
        <Route path="foaie-parcurs" element={<FoaieParcurs />} />
        <Route path="foi-parcurs-admin" element={<AdminRoute><FoaieParcursAdmin /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <UpdateBanner />
      </AuthProvider>
    </BrowserRouter>
  );
}
