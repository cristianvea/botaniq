import { useEffect, useRef, useState } from 'react';
import { searchPlaces, reversePlace } from '../lib/weather.js';
import { Section, Cell, Spinner } from './ui.jsx';

// Busca mientras escribes (barrio, calle o ciudad) o usa la ubicación del móvil
export default function LocationPicker({ onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const seq = useRef(0);

  // Búsqueda con pausa de 700 ms para no saturar el servicio
  useEffect(() => {
    const text = q.trim();
    if (text.length < 3) { setResults([]); return; }
    const id = ++seq.current;
    const t = setTimeout(async () => {
      setSearching(true); setErr(null);
      try {
        const r = await searchPlaces(text);
        if (id !== seq.current) return;
        setResults(r);
        if (!r.length) setErr('No encuentro ese lugar. Prueba con calle y ciudad, o con el barrio.');
      } catch (ex) {
        if (id === seq.current) setErr(ex.message);
      } finally {
        if (id === seq.current) setSearching(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [q]);

  const pick = async (loc) => {
    setSaving(true); setErr(null);
    try { await onPick(loc); } catch (ex) { setErr(ex.message); } finally { setSaving(false); }
  };

  const useGps = () => {
    document.activeElement?.blur?.();
    if (!navigator.geolocation) return setErr('Este navegador no permite obtener la ubicación. Busca tu barrio o calle.');
    setLocating(true); setErr(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = +pos.coords.latitude.toFixed(4);
        const lon = +pos.coords.longitude.toFixed(4);
        const name = (await reversePlace(lat, lon)) || 'Mi ubicación';
        setLocating(false);
        await pick({ lat, lon, name });
      },
      (e) => {
        setLocating(false);
        setErr(e.code === 1
          ? 'No hay permiso de ubicación. Actívalo en Ajustes del iPhone → Privacidad → Localización → Safari, o busca tu barrio aquí abajo.'
          : 'No se pudo obtener la ubicación. Inténtalo otra vez o busca tu barrio aquí abajo.');
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
  };

  const busy = locating || saving;

  return (
    <>
      <Section inset="icon">
        <Cell icon="location" iconBg="#0a7aff" title="Usar mi ubicación actual" sub={locating ? 'Buscando…' : 'Lo más preciso'} onClick={busy ? undefined : useGps}>
          {busy && <Spinner />}
        </Cell>
      </Section>
      <Section header="O busca tu barrio, calle o ciudad" footer={err || 'Basta con aproximarte: el tiempo es el mismo en un radio de 1–2 km.'}>
        <label className="cell">
          <input className="left" type="search" enterKeyHint="search" autoCorrect="off" spellCheck={false}
            placeholder="Ej.: Chamberí, Madrid · Calle Mayor 5, Sevilla" value={q} onChange={(e) => setQ(e.target.value)} />
          {searching && <Spinner />}
        </label>
        {results.map((r) => (
          <Cell key={`${r.lat},${r.lon},${r.name}`} title={r.name} sub={r.detail} chevron onClick={busy ? undefined : () => pick(r)} />
        ))}
      </Section>
    </>
  );
}
