import { useState } from 'react';
import { enablePush, setPushHour, markAsked, fmtHour, DEFAULT_HOUR } from '../lib/push.js';
import { Sheet, Spinner, Icon, SelectField } from './ui.jsx';

const PRESETS = [
  { h: 8, label: 'Al levantarte' },
  { h: 9, label: 'A media mañana' },
  { h: 14, label: 'Al mediodía' },
  { h: 19, label: 'Al volver a casa' },
  { h: 21, label: 'Por la noche' },
];
const HOURS = Array.from({ length: 24 }, (_, h) => [String(h), fmtHour(h)]);

// Pregunta si quieres avisos y, si dices que sí, a qué hora.
// step: 'ask' (primera vez) | 'hour' (ya has dicho que sí o vienes de Ajustes)
// mode: 'enable' (suscribir este dispositivo) | 'change' (solo cambiar la hora)
export default function NotifySheet({ user, step: initialStep = 'ask', mode = 'enable', hour: initialHour = DEFAULT_HOUR, notify, onClose, onDone }) {
  const [step, setStep] = useState(initialStep);
  const [hour, setHour] = useState(initialHour);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const later = () => { markAsked(); onClose(); };

  const confirm = async () => {
    setBusy(true); setError(null);
    try {
      if (mode === 'change') await setPushHour(hour);
      else await enablePush(user.id, hour);
      notify(`Te avisaremos a las ${fmtHour(hour)}`);
      onDone(hour);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet onClose={step === 'ask' ? later : onClose}>
      {step === 'ask' ? (
        <>
          <div className="content notify-ask">
            <div className="notify-glyph"><Icon name="bell" size={30} /></div>
            <div className="t-title2">¿Te avisamos cuando toque regar?</div>
            <p className="t-sub c2">
              Te llegará una notificación solo los días que alguna planta necesite agua o pulverizar, todas juntas en un único aviso.
            </p>
          </div>
          <div className="content stack">
            <button className="btn block" onClick={() => setStep('hour')}>Sí, avísame</button>
            <button className="btn plain block" onClick={later}>Ahora no</button>
          </div>
        </>
      ) : (
        <>
          <div className="content" style={{ padding: '8px 16px 4px' }}>
            <div className="t-title3">¿A qué hora te viene bien?</div>
            <p className="t-sub c2" style={{ marginTop: 6, lineHeight: 1.4 }}>
              Lo ideal es regar a primera hora o al caer la tarde, cuando el agua no se evapora tan rápido.
            </p>
          </div>
          <div className="hour-list" role="radiogroup" aria-label="Hora del aviso">
            {PRESETS.map((p) => (
              <button key={p.h} role="radio" aria-checked={hour === p.h} className={`hour-opt ${hour === p.h ? 'on' : ''}`} onClick={() => setHour(p.h)}>
                <b className="num">{fmtHour(p.h)}</b>
                <span>{p.label}</span>
                {hour === p.h && <Icon name="check" size={18} stroke={2.6} />}
              </button>
            ))}
          </div>
          <div className="content" style={{ paddingTop: 4 }}>
            <SelectField label="Otra hora" value={String(hour)} options={HOURS} onChange={(v) => setHour(Number(v))} />
          </div>
          {error && <p className="t-foot" style={{ padding: '0 16px', lineHeight: 1.4, color: 'var(--red)' }}>{error}</p>}
          <div className="content stack" style={{ paddingTop: 8 }}>
            <button className="btn block" disabled={busy} onClick={confirm}>
              {busy ? <Spinner /> : mode === 'change' ? `Cambiar a las ${fmtHour(hour)}` : `Avisarme a las ${fmtHour(hour)}`}
            </button>
            <button className="btn plain block" onClick={mode === 'change' ? onClose : later}>{mode === 'change' ? 'Cancelar' : 'Ahora no'}</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
