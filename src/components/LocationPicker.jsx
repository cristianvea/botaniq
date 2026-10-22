import { useState } from 'react';
import { searchPlaces } from '../lib/weather.js';
import { Section, Cell, Icon, Spinner } from './ui.jsx';

export default function LocationPicker({ onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const search = async (e) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setBusy(true); setErr(null);
    try {
      const r = await searchPlaces(q.trim());
      setResults(r);
      if (!r.length) setErr('No encuentro esa ciudad.');
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  const pick = async (loc) => { setBusy(true); try { await onPick(loc); } finally { setBusy(false); } };

  const useGps = () => {
    if (!navigator.geolocation) return setErr('Tu navegador no permite obtener la ubicación.');
    setBusy(true); setErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => pick({ lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3), name: 'Mi ubicación' }),
      () => { setBusy(false); setErr('No se pudo obtener la ubicación. Busca tu ciudad.'); },
      { timeout: 15000 }
    );
  };

  return (
    <>
      <Section inset="icon">
        <Cell icon="location" iconBg="#0a7aff" title="Usar mi ubicación actual" onClick={useGps}>{busy && <Spinner />}</Cell>
      </Section>
      <Section header="O busca una ciudad" footer={err}>
        <form className="cell" onSubmit={search}>
          <input className="left" type="search" enterKeyHint="search" placeholder="Madrid, Sevilla, Bilbao…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="nav-btn" style={{ minHeight: 30 }} disabled={busy || !q.trim()}>Buscar</button>
        </form>
        {results.map((r) => (
          <Cell key={`${r.lat},${r.lon}`} title={r.name.split(', ')[0]} sub={r.name.split(', ').slice(1).join(', ')} chevron onClick={() => pick(r)} />
        ))}
      </Section>
    </>
  );
}
