import { ISSUE_LABELS, OVERALL, CONFIDENCE } from '../lib/diagnose.js';
import { Icon } from './ui.jsx';

const ISSUE_ICON = {
  falta_luz: ['sunDim', '#ff9500'], exceso_luz: ['sun', '#ff3b30'], falta_riego: ['drop', '#ff9500'],
  exceso_riego: ['humidity', '#0a7aff'], humedad_baja: ['mist', '#30b0c7'], plagas: ['bug', '#ff3b30'],
  hongos: ['leaf', '#a2845e'], nutrientes: ['sprout', '#ffcc00'], maceta_pequena: ['pot', '#8e8e93'],
  frio: ['thermo', '#5ac8fa'], calor: ['thermo', '#ff3b30'], otro: ['sparkles', '#af52de'],
};
const labelOf = (type) => {
  const l = ISSUE_LABELS[type] || type;
  return l.slice(l.indexOf(' ') + 1);
};

/** Diagnóstico de IA como lista agrupada (va dentro de un .section) */
export default function Diagnosis({ d, date }) {
  if (!d) return null;
  const o = OVERALL[d.overall] || OVERALL.mild;
  return (
    <div className="group">
      <div className="cell" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
        <div className="diag-head" style={{ width: '100%' }}>
          <span className={`pill pill-${o.cls}`}>{o.label}</span>
          <span className="t-foot c2" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <Icon name="sparkles" size={14} /> {date || 'Análisis IA'}
          </span>
        </div>
        <p className="t-body" style={{ lineHeight: 1.35 }}>{d.summary}</p>
      </div>
      {(d.issues || []).map((i, k) => {
        const [icon, color] = ISSUE_ICON[i.type] || ISSUE_ICON.otro;
        const label = labelOf(i.type);
        return (
          <div className="issue" key={k}>
            <span className="cell-icon" style={{ background: color, color: '#fff' }}><Icon name={icon} size={18} stroke={2.2} /></span>
            <div style={{ flex: 1 }}>
              <div className="t-headline">{label} <span className="t-foot c2" style={{ fontWeight: 400 }}>· {CONFIDENCE[i.confidence] || i.confidence}</span></div>
              <p className="c2">{i.evidence}</p>
              <p className="todo">{i.action}</p>
            </div>
          </div>
        );
      })}
      {(d.tips || []).map((t, k) => (
        <div className="care-line" key={`t${k}`}>
          <span className="c-tint"><Icon name="bulb" size={20} /></span>
          <p>{t}</p>
        </div>
      ))}
    </div>
  );
}
