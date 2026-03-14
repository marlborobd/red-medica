import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);

/* Register Service Worker */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[SW] Înregistrat:', reg.scope);

        // Detectează SW nou care instalează
        reg.onupdatefound = () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.onstatechange = () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              // Există versiune nouă în așteptare — notifică aplicația
              console.log('[SW] Versiune nouă disponibilă.');
              window.dispatchEvent(new CustomEvent('swUpdateAvailable', { detail: reg }));
            }
          };
        };

        // Dacă există deja un SW în waiting la încărcarea paginii
        if (reg.waiting && navigator.serviceWorker.controller) {
          window.dispatchEvent(new CustomEvent('swUpdateAvailable', { detail: reg }));
        }
      })
      .catch((err) => console.warn('[SW] Eroare înregistrare:', err));

    // Când SW-ul nou preia controlul → reîncarcă pagina
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  });
}
