import { useState } from 'react';
import * as db from '../lib/data.js';
import { Segmented, Switch } from './ui.jsx';

export const zoneKind = (z) =>
  z.location === 'indoor' ? 'Interior' : z.gets_rain ? 'Exterior' : 'Exterior cubierto';

const SUGGESTIONS = ['Salón', 'Comedor', 'Cocina', 'Dormitorio', 'Baño', 'Terraza', 'Balcón', 'Jardín'];
const OUTDOOR = ['Terraza', 'Balcón', 'Jardín'];

/** Crear o editar una zona (se pinta como una lista agrupada) */
export default function ZoneEditor({ householdId, zone, existingNames = [], onSaved, onCancel, onDeleted, notify }) {
  const [name, setName] = useState(zone?.name || '');
  const [location, setLocation] = useState(zone?.location || 'indoor');
  const [covered, setCovered] = useState(zone ? !zone.gets_rain : false);
  const [busy, setBusy] = useState(false);
  const suggestions = SUGGESTIONS.filter((s) => !existingNames.includes(s));

  const save = async () => {
    if (!name.trim()) return notify?.('Ponle nombre a la zona');
    setBusy(true);
    try {
      const saved = await db.saveZone({
        id: zone?.id, household_id: householdId, name: name.trim(), location,
        gets_rain: location === 'outdoor' ? !covered : true,
      });
      await onSaved(saved);
    } catch (e) { notify?.(e.message); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm(`¿Eliminar la zona «${zone.name}»? Sus plantas no se borran: solo quedan sin zona.`)) return;
    setBusy(true);
    try { await db.deleteZone(zone.id); await onDeleted?.(); } catch (e) { notify?.(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="group" style={{ marginTop: 8 }}>
      <label className="cell">
        <input className="left" autoFocus placeholder="Nombre de la zona" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      {!zone && !name && suggestions.length > 0 && (
        <div className="cell">
          <div className="chips wrap">
            {suggestions.map((s) => (
              <button type="button" key={s} className="chip" onClick={() => { setName(s); if (OUTDOOR.includes(s)) setLocation('outdoor'); }}>{s}</button>
            ))}
          </div>
        </div>
      )}
      <div className="cell">
        <Segmented value={location} onChange={setLocation} options={[['indoor', 'Interior'], ['outdoor', 'Exterior']]} />
      </div>
      {location === 'outdoor' && (
        <div className="cell">
          <div className="cell-main">
            <div className="cell-title">Bajo techo</div>
            <div className="cell-sub t-foot">No le cae la lluvia</div>
          </div>
          <Switch checked={covered} onChange={setCovered} label="Bajo techo" />
        </div>
      )}
      <div className="cell" style={{ gap: 8 }}>
        {zone && onDeleted && <button type="button" className="btn plain small c-red" style={{ color: 'var(--red-text)', paddingLeft: 0 }} disabled={busy} onClick={remove}>Eliminar</button>}
        <span style={{ flex: 1 }} />
        {onCancel && <button type="button" className="btn gray small" disabled={busy} onClick={onCancel}>Cancelar</button>}
        <button type="button" className="btn small" disabled={busy} onClick={save}>{zone ? 'Guardar' : 'Crear zona'}</button>
      </div>
    </div>
  );
}
