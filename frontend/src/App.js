import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import BackupReminder from './components/BackupReminder';
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
import Ambulante from './pages/ambulante/Ambulante';
import AmbulantaActivitate from './pages/ambulante/AmbulantaActivitate';
import AmbulantaRapoarte from './pages/ambulante/AmbulantaRapoarte';

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

// Rută accesibilă doar pentru admin și employee (nu ambulanță).
function EmployeeRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ambulanta') return <Navigate to="/ambulante" replace />;
  return children;
}

// Rută accesibilă pentru admin și ambulanță.
function AmbRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin' && user.role !== 'ambulanta') return <Navigate to="/" replace />;
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

  const loginRedirect = user
    ? <Navigate to={user.role === 'ambulanta' ? '/ambulante' : '/'} replace />
    : <Login />;

  return (
    <Routes>
      <Route path="/login" element={loginRedirect} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<EmployeeRoute><Dashboard /></EmployeeRoute>} />
        <Route path="pacienti" element={<EmployeeRoute><PatientList /></EmployeeRoute>} />
        <Route path="pacienti/nou" element={<EmployeeRoute><AddPatient /></EmployeeRoute>} />
        <Route path="pacienti/:id" element={<EmployeeRoute><PatientProfile /></EmployeeRoute>} />
        <Route path="pacienti/:id/vizita" element={<EmployeeRoute><AddVisit /></EmployeeRoute>} />
        <Route path="pacienti/:id/vizita/:visitId" element={<EmployeeRoute><AddVisit /></EmployeeRoute>} />
        <Route path="rapoarte" element={<AdminRoute><Reports /></AdminRoute>} />
        <Route path="utilizatori" element={<AdminRoute><Users /></AdminRoute>} />
        <Route path="foaie-parcurs" element={<EmployeeRoute><FoaieParcurs /></EmployeeRoute>} />
        <Route path="foi-parcurs-admin" element={<AdminRoute><FoaieParcursAdmin /></AdminRoute>} />
        <Route path="ambulante" element={<AmbRoute><Ambulante /></AmbRoute>} />
        <Route path="ambulante/rapoarte" element={<AmbRoute><AmbulantaRapoarte /></AmbRoute>} />
        <Route path="ambulante/:id" element={<AmbRoute><AmbulantaActivitate /></AmbRoute>} />
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
        <BackupReminder />
      </AuthProvider>
    </BrowserRouter>
  );
}
