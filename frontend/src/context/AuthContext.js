import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getVapidPublicKey, subscribeToPush } from '../services/api';

const AuthContext = createContext(null);

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function registerPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const swReg = await navigator.serviceWorker.ready;
    const { data } = await getVapidPublicKey();
    const subscription = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey)
    });
    await subscribeToPush(subscription.toJSON());
    console.log('[Push] Subscription înregistrată');
  } catch (err) {
    console.warn('[Push] Subscription error:', err.message);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (stored && storedToken) {
      try {
        setUser(JSON.parse(stored));
        setToken(storedToken);
      } catch {}
    }
    setLoading(false);
  }, []);

  // Solicită permisiune push și înregistrează subscription după login
  useEffect(() => {
    if (!user) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    if (Notification.permission === 'granted') {
      registerPushSubscription();
      return;
    }
    if (Notification.permission === 'denied') return;
    const asked = localStorage.getItem('push_permission_asked');
    if (asked) return;
    const timer = setTimeout(async () => {
      const permission = await Notification.requestPermission();
      localStorage.setItem('push_permission_asked', '1');
      if (permission === 'granted') registerPushSubscription();
    }, 3000);
    return () => clearTimeout(timer);
  }, [user]);

  const login = (userData, tokenData) => {
    setUser(userData);
    setToken(tokenData);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', tokenData);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
