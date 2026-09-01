import React, { useState, useEffect, useRef } from 'react';
import { getAdreseFrecvente, salveazaAdresaFrecventa } from '../services/api';

// NOTĂ: proiectul folosește Create React App (react-scripts), nu Vite — variabilele de mediu
// expuse la client trebuie să înceapă cu REACT_APP_ (nu VITE_) ca să fie incluse în build.
const GOOGLE_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

let googleMapsPromise = null;
function loadGoogleMaps() {
  if (!GOOGLE_KEY) return Promise.resolve(false);
  if (window.google?.maps?.places) return Promise.resolve(true);
  if (googleMapsPromise) return googleMapsPromise;
  googleMapsPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => resolve(!!window.google?.maps?.places);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

// Input de adresă cu autocomplete din istoricul local (amb_adrese_frecvente) +
// sugestii Google Places (dacă REACT_APP_GOOGLE_MAPS_API_KEY este configurat).
export default function AddressAutocomplete({
  value, onChange, placeholder, className = 'form-control', autoFocus, id,
}) {
  const [sugestiiLocale, setSugestiiLocale] = useState([]);
  const [sugestiiGoogle, setSugestiiGoogle] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);
  const googleServiceRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(ok => {
      if (ok && !cancelled) {
        googleServiceRef.current = new window.google.maps.places.AutocompleteService();
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSugestiiLocale = async (q) => {
    try {
      const { data } = await getAdreseFrecvente(q);
      setSugestiiLocale(data);
    } catch (_) {}
  };

  const fetchSugestiiGoogle = (q) => {
    if (!googleServiceRef.current || q.trim().length < 3) {
      setSugestiiGoogle([]);
      return;
    }
    googleServiceRef.current.getPlacePredictions(
      { input: q, componentRestrictions: { country: 'ro' } },
      (predictions, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSugestiiGoogle(predictions.map(p => p.description));
        } else {
          setSugestiiGoogle([]);
        }
      }
    );
  };

  const handleFocus = () => {
    // La focus, fără să fi tastat, arătăm top 10 cele mai folosite adrese — nu filtrate
    // după valoarea curentă (câmpul poate fi deja precompletat cu o adresă anterioară).
    fetchSugestiiLocale('');
    fetchSugestiiGoogle(value || '');
    setShowDropdown(true);
  };

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    setShowDropdown(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSugestiiLocale(val);
      fetchSugestiiGoogle(val);
    }, 200);
  };

  const handleSelect = (item) => {
    onChange(item.label);
    setShowDropdown(false);
    if (item.sursa === 'google') {
      salveazaAdresaFrecventa(item.label).catch(() => {});
    }
  };

  const combinate = [
    ...sugestiiLocale.map(s => ({ label: s.adresa, sursa: 'local', utilizari: s.utilizari })),
    ...sugestiiGoogle
      .filter(g => !sugestiiLocale.some(s => s.adresa.toLowerCase() === g.toLowerCase()))
      .map(g => ({ label: g, sursa: 'google' })),
  ];

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
      {showDropdown && combinate.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'var(--white)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', marginTop: 4, maxHeight: 260, overflowY: 'auto',
          boxShadow: 'var(--shadow-md)',
        }}>
          {combinate.map((item, i) => (
            <div
              key={`${item.sursa}-${item.label}-${i}`}
              onMouseDown={() => handleSelect(item)}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary-lighter)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
              {item.sursa === 'local' ? (
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  🕓 Folosit anterior ({item.utilizari}×)
                </span>
              ) : (
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, flexShrink: 0, whiteSpace: 'nowrap' }}>📍 Google</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
