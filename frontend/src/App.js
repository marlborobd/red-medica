import React, { useEffect } from 'react';
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

function AppRoutes() {
  const { user } = useAuth();

  // Sincronizează user-ul cu OneSignal (external_id = email)
  useEffect(() => {
    if (!window.OneSignalDeferred) return;
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        if (user && user.email) {
          console.log('[OneSignal] Login cu email:', user.email);
          await OneSignal.login(user.email);
          console.log('[OneSignal] Login reușit');
        } else {
          await OneSignal.logout();
          console.log('[OneSignal] Logout efectuat');
        }
      } catch (err) {
        console.error('[OneSignal] Eroare login:', err);
      }
    });
  }, [user]);

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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  // Inițializează OneSignal o singură dată
  useEffect(() => {
    const appId = process.env.REACT_APP_ONESIGNAL_APP_ID;
    console.log('[OneSignal] REACT_APP_ONESIGNAL_APP_ID:', appId ? appId : 'LIPSEȘTE - setați în Railway Variables');
    if (!appId) {
      console.error('[OneSignal] App ID lipsă - OneSignal nu se va inițializa!');
      return;
    }
    if (!window.OneSignalDeferred) {
      console.error('[OneSignal] window.OneSignalDeferred lipsă - SDK-ul nu s-a încărcat!');
      return;
    }
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        console.log('[OneSignal] Init start, appId:', appId);
        await OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: true,
          notifyButton: { enable: false },
          serviceWorkerParam: { scope: '/' },
          promptOptions: {
            slidedown: {
              prompts: [{
                type: 'push',
                autoPrompt: true,
                text: {
                  actionMessage: 'Dorești să primești notificări despre pacienți și vizite?',
                  acceptButton: 'Da, acceptă',
                  cancelButton: 'Nu acum'
                },
                delay: {
                  pageViews: 1,
                  timeDelay: 3
                }
              }]
            }
          }
        });
        console.log('[OneSignal] Init done');

        OneSignal.Notifications.requestPermission().then(permission => {
          console.log('[OneSignal] Permission:', permission);
        }).catch(err => {
          console.error('[OneSignal] requestPermission eroare:', err);
        });
      } catch (err) {
        console.error('[OneSignal] Eroare init:', err);
      }
    });
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
