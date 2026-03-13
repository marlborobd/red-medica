import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as loginApi } from '../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await loginApi(email, password);
      login(data.user, data.token);
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function(OneSignal) {
        await OneSignal.login(email);
        console.log('[OneSignal] Login done:', email);
      });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Email sau parolă incorectă. Verificați datele și încercați din nou.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo centrat */}
        <div className="login-logo">
          <img
            src="/logo.png"
            alt="Red Medica"
            className="login-logo-img"
            style={{ width: 120, height: 120, objectFit: 'contain' }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div
            style={{
              display: 'none',
              width: 90, height: 90,
              background: 'var(--primary)',
              borderRadius: 20,
              margin: '0 auto 16px',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 800,
              color: 'white',
              textAlign: 'center',
              lineHeight: 1.2,
              padding: 8
            }}
          >
            Red Medica
          </div>
          <h1>Red Medica</h1>
          <p className="app-subtitle">Asistență Medicală la Domiciliu</p>
        </div>

        {error && (
          <div className="alert alert-danger mb-2" role="alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Adresă Email</label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="email@exemplu.ro"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              inputMode="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Parolă</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                className="form-control"
                placeholder="Introduceți parola"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingRight: 52 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                aria-label={showPass ? 'Ascunde parola' : 'Arată parola'}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  fontSize: 18,
                  padding: '8px',
                  minWidth: 44,
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6
                }}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-100"
            disabled={loading}
            style={{ marginTop: 8, borderRadius: 12, fontWeight: 700, fontSize: 17 }}
          >
            {loading
              ? <><div className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> Se conectează...</>
              : '🔐 Conectare'}
          </button>
        </form>

      </div>
    </div>
  );
}
