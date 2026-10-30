import { PROFILES } from '../lib/profiles.js';
import { Sheet, Icon } from './ui.jsx';

// Grupos para que la lista se lea de un vistazo
const GROUPS = [
  ['Interior', ['tropical', 'tropical_humeda', 'ficus', 'palmera', 'resistente', 'orquidea']],
  ['Crasas', ['cactus', 'suculenta']],
  ['Flor y exterior', ['flor_interior', 'floracion', 'geranio', 'hortensia', 'arbusto_exterior', 'bonsai']],
  ['Aromáticas y huerto', ['aromatica_lenosa', 'aromatica_blanda', 'huerto']],
  ['Especiales', ['carnivora', 'tillandsia']],
  ['', ['generica']],
];

const split = (label) => {
  const i = label.indexOf(' (');
  return i < 0 ? [label, ''] : [label.slice(0, i), label.slice(i + 2, -1)];
};

/** Hoja para elegir el tipo de planta, con ejemplos y frecuencia de riego orientativa */
export default function TypePicker({ value, suggested, suggestedScore, onPick, onClose }) {
  return (
    <Sheet onClose={onClose}>
      <div className="content" style={{ padding: '6px 16px 12px' }}>
        <div className="t-title3">Tipo de planta</div>
        <p className="t-sub c2" style={{ marginTop: 4 }}>Decide cada cuánto y cómo se riega. Si dudas, deja la que proponga la foto.</p>
      </div>
      {(suggested ? [['Según la foto', [suggested]], ...GROUPS] : GROUPS).map(([title, keys]) => (
        <section className="section" key={title || 'otros'} style={{ marginBottom: 18 }}>
          {title && <div className="section-header"><span>{title}</span></div>}
          <div className="group">
            {keys.map((k) => {
              const p = PROFILES[k];
              const [name, examples] = split(p.label);
              const isSuggested = k === suggested;
              return (
                <button type="button" key={k} className="cell" onClick={() => onPick(k)} style={{ paddingTop: 11, paddingBottom: 11 }}>
                  <span className="type-emoji" aria-hidden="true">{p.emoji}</span>
                  <div className="cell-main">
                    <div className="cell-title" style={{ fontWeight: value === k ? 600 : 400 }}>{name}</div>
                    <div className="cell-sub t-foot">
                      {examples ? `${examples} · ` : ''}riego cada ~{Math.round(p.baseDays)} días
                    </div>
                    {isSuggested && (
                      <span className="pill pill-ok" style={{ marginTop: 5 }}>
                        <Icon name="sparkles" size={12} /> Según la foto{suggestedScore ? ` · ${Math.round(suggestedScore * 100)} %` : ''}
                      </span>
                    )}
                  </div>
                  <span style={{ width: 22, color: 'var(--tint)' }}>{value === k && <Icon name="check" size={20} stroke={2.6} />}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </Sheet>
  );
}
