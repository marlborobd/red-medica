import React, { useState, useEffect, useRef } from 'react';
import { getAdreseFrecvente } from '../services/api';

// Input de adresă cu autocomplete din istoricul de adrese folosite (amb_adrese_frecvente).
export default function AddressAutocomplete({
  value, onChange, placeholder, className = 'form-control', autoFocus, id,
}) {
  const [sugestii, setSugestii] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSugestii = async (q) => {
    try {
      const { data } = await getAdreseFrecvente(q);
      setSugestii(data);
    } catch (_) {}
  };

  const handleFocus = () => {
    fetchSugestii(value || '');
    setShowDropdown(true);
  };

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    setShowDropdown(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSugestii(val), 200);
  };

  const handleSelect = (adresa) => {
    onChange(adresa);
    setShowDropdown(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        id={id}
        className={className}
        value={value || ''}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={e => { if (e.key === 'Escape') setShowDropdown(false); }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {showDropdown && sugestii.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'var(--white)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', marginTop: 4, maxHeight: 220, overflowY: 'auto',
          boxShadow: 'var(--shadow-md)',
        }}>
          {sugestii.map((s) => (
            <div
              key={s.adresa}
              onMouseDown={() => handleSelect(s.adresa)}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary-lighter)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.adresa}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11, flexShrink: 0 }}>{s.utilizari}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
