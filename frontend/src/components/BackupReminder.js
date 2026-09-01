import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { triggerManualBackup, getBackupStatus } from '../services/api';

const BACKUP_REMINDER_DAYS = 15;

const formatData = (d) => d
  ? new Date(d).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : 'Niciodată';

// Popup global de reminder pentru backup manual — apare pe orice pagină, cât
// timp userul e admin, dacă nu s-a mai făcut un backup de peste 15 zile
// (sau niciodată). Backup-ul e o funcționalitate doar-admin (rutele API
// cer requireAdmin), deci componenta nu face nimic pentru ceilalți useri.
export default function BackupReminder() {
  const { user, isAdmin } = useAuth();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState(null);

  useEffect(() => {
    if (!user || !isAdmin) return;

    getBackupStatus().then(r => { if (r.data.lastBackupAt) setLastBackupAt(r.data.lastBackupAt); }).catch(() => {});

    const lastBackupDate = localStorage.getItem('lastBackupDate');
    if (!lastBackupDate) {
      setShow(true);
    } else {
      const zileTrecute = (Date.now() - new Date(lastBackupDate).getTime()) / (1000 * 60 * 60 * 24);
      if (zileTrecute > BACKUP_REMINDER_DAYS) setShow(true);
    }
  }, [user, isAdmin]);

  if (!user || !isAdmin || !show) return null;

  const handleBackup = async () => {
    setLoading(true);
    try {
      await triggerManualBackup();
      const now = new Date().toISOString();
      localStorage.setItem('lastBackupDate', now);
      setLastBackupAt(now);
      setShow(false);
    } catch (_) {
      // lăsăm popup-ul deschis dacă backup-ul eșuează
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => setShow(false);

  return (
    <div
      onClick={handleDismiss}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'backupReminderFadeIn 0.3s ease',
      }}
    >
      <style>{`@keyframes backupReminderFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, maxWidth: 460, width: '90%',
          padding: 32, margin: 'auto', position: 'relative',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <button
          onClick={handleDismiss}
          aria-label="Închide"
          style={{
            position: 'absolute', top: 16, right: 16, background: 'none', border: 'none',
            fontSize: 20, cursor: 'pointer', color: '#999', lineHeight: 1, padding: 4,
          }}
        >✕</button>

        <div style={{
          width: 60, height: 60, borderRadius: '50%', background: '#FFA726', color: '#fff',
          fontSize: 32, fontWeight: 700, display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 16px',
        }}>!</div>

        <div style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', color: 'var(--text)' }}>
          Backup recomandat
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 6 }}>
          Ultima salvare: {formatData(lastBackupAt)}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text)', textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>
          Salvează periodic o copie a tuturor datelor din aplicație — pacienți, vizite, ambulanță,
          angajați — pentru siguranța informațiilor.
        </div>

        <button
          className="btn btn-primary"
          onClick={handleBackup}
          disabled={loading}
          style={{ width: '100%', marginTop: 24, padding: '12px 0', fontSize: 15, justifyContent: 'center' }}
        >
          {loading ? 'Se salvează...' : '⬇️ Descarcă backup complet'}
        </button>
        <button
          className="btn btn-ghost"
          onClick={handleDismiss}
          style={{ width: '100%', marginTop: 10, padding: '12px 0', fontSize: 14, justifyContent: 'center' }}
        >
          Amintește-mi mai târziu
        </button>
      </div>
    </div>
  );
}
