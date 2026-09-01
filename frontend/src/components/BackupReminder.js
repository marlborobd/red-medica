import React from 'react';

const formatData = (d) => d
  ? new Date(d).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : 'Niciodată';

// Popup de reminder pentru backup manual, afișat dacă nu s-a mai făcut un
// backup de peste 15 zile (sau niciodată).
export default function BackupReminder({ lastBackupAt, onBackup, onDismiss, loading }) {
  return (
    <div
      onClick={onDismiss}
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
          onClick={onDismiss}
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
          onClick={onBackup}
          disabled={loading}
          style={{ width: '100%', marginTop: 24, padding: '12px 0', fontSize: 15, justifyContent: 'center' }}
        >
          {loading ? 'Se salvează...' : '⬇️ Descarcă backup complet'}
        </button>
        <button
          className="btn btn-ghost"
          onClick={onDismiss}
          style={{ width: '100%', marginTop: 10, padding: '12px 0', fontSize: 14, justifyContent: 'center' }}
        >
          Amintește-mi mai târziu
        </button>
      </div>
    </div>
  );
}
