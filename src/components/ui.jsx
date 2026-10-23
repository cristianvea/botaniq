import { useEffect, useRef, useState } from 'react';
import { STATUS_LABEL } from '../lib/watering.js';
import Icon from './Icon.jsx';

export { Icon };

/** true cuando la página ha hecho scroll más allá de `offset` px */
export function useScrolled(offset = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > offset);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [offset]);
  return scrolled;
}

/** Barra superior estilo iOS. Con `large`, el título grande va debajo y aparece arriba al hacer scroll. */
export function NavBar({ title, large, sub, left, right, solid }) {
  const scrolled = useScrolled(large ? 40 : 4);
  return (
    <>
      <header className={`navbar ${scrolled ? 'scrolled' : ''} ${solid ? 'solid' : ''} ${large ? '' : 'always-title'}`}>
        <div className="navbar-inner">
          <div className="navbar-left">{left}</div>
          <div className="navbar-title">{title}</div>
          <div className="navbar-right">{right}</div>
        </div>
      </header>
      {large && (
        <div className="large-title">
          <h1 className="t-large">{title}</h1>
          {sub && <p className="sub t-sub c2">{sub}</p>}
        </div>
      )}
    </>
  );
}

export function BackButton({ href, label = 'Atrás' }) {
  return (
    <a className="nav-btn" href={href}>
      <Icon name="chevronLeft" size={24} stroke={2.4} />
      <span>{label}</span>
    </a>
  );
}

export function TabBar({ active, badge }) {
  const tabs = [
    ['today', '#/', 'today', 'Hoy'],
    ['plants', '#/plants', 'leaf', 'Plantas'],
    ['settings', '#/settings', 'gear', 'Ajustes'],
  ];
  return (
    <nav className="tabbar" aria-label="Secciones">
      <div className="tabbar-inner">
        {tabs.map(([key, href, icon, label]) => (
          <a key={key} href={href} className={`tab ${active === key ? 'on' : ''}`} aria-current={active === key ? 'page' : undefined}>
            <Icon name={icon} size={25} stroke={active === key ? 2.2 : 1.8} />
            <span>{label}</span>
            {key === 'today' && badge > 0 && <span className="badge">{badge}</span>}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function Section({ header, footer, action, big, children, className = '', inset }) {
  return (
    <section className={`section ${className}`}>
      {header && (
        <div className={`section-header ${big ? 'big' : ''}`}>
          <span>{header}</span>
          {action}
        </div>
      )}
      {children && <div className={`group ${inset ? `inset-${inset}` : ''}`}>{children}</div>}
      {footer && <div className="section-footer">{footer}</div>}
    </section>
  );
}

/** Fila de lista. Si recibe href es un enlace; si recibe onClick, un botón. */
export function Cell({ icon, iconBg, leading, title, sub, value, chevron, href, onClick, children, className = '', danger }) {
  const inner = (
    <>
      {icon && <span className="cell-icon" style={{ background: iconBg || 'var(--tint)' }}><Icon name={icon} size={18} stroke={2.2} /></span>}
      {leading}
      <div className="cell-main">
        {title && <div className={`cell-title ${danger ? 'c-red' : ''}`}>{title}</div>}
        {sub && <div className="cell-sub">{sub}</div>}
      </div>
      {value != null && <span className="cell-value">{value}</span>}
      {children}
      {chevron && <Icon name="chevronRight" size={16} stroke={2.6} className="chev" />}
    </>
  );
  if (href) return <a className={`cell ${className}`} href={href}>{inner}</a>;
  if (onClick) return <button type="button" className={`cell ${className}`} onClick={onClick}>{inner}</button>;
  return <div className={`cell ${className}`}>{inner}</div>;
}

export function Switch({ checked, onChange, label }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map(([v, label]) => (
        <button type="button" key={v} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Anillo de progreso (sequedad) */
export function Ring({ value, size = 92, stroke = 10, color, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setShown(v)); return () => cancelAnimationFrame(t); }, [v]);
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg className="ring" width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - shown)} />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

export function drynessColor(v) {
  if (v >= 1) return 'var(--water)';
  if (v >= 0.75) return 'var(--orange)';
  return '#34c759';
}

export function Meter({ value }) {
  const v = Math.min(1, value || 0);
  return <div className="meter"><i style={{ width: `${Math.round(v * 100)}%`, background: drynessColor(value) }} /></div>;
}

export function StatusPill({ status }) {
  if (!status) return null;
  return <span className={`pill pill-${status.status}`}>{statusText(status)}</span>;
}

export function statusText(s) {
  if (s.status === 'ok') return s.daysUntil >= 60 ? 'Sin prisa' : s.daysUntil === 1 ? 'Mañana' : `En ${s.daysUntil} días`;
  return STATUS_LABEL[s.status];
}

export function Avatar({ url, size = 52, glyph = 'sprout' }) {
  return url ? (
    <img className="avatar" src={url} alt="" style={{ width: size, height: size }} loading="lazy" />
  ) : (
    <div className="avatar avatar-empty" style={{ width: size, height: size }}><Icon name={glyph} size={size * 0.46} /></div>
  );
}

export function Hud({ text, action, onClose }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const t = setTimeout(() => closeRef.current(), action ? 6000 : 3000);
    return () => clearTimeout(t);
  }, [text, action]);
  return (
    <div className="hud" role="status">
      <span>{text}</span>
      {action && <button onClick={() => { action.run(); onClose(); }}>{action.label}</button>}
    </div>
  );
}

export function Sheet({ onClose, children }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        {children}
      </div>
    </div>
  );
}

export function Spinner({ size = 18 }) {
  return (
    <svg className="spin" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export const fmtRelDays = (n) => (n == null ? '—' : n === 0 ? 'Hoy' : n === 1 ? 'Ayer' : `Hace ${n} días`);

let fieldSeq = 0;
const useFieldId = (id) => { const [v] = useState(() => id || `f${++fieldSeq}`); return v; };

/** Campo de texto con etiqueta fija arriba y caja rellenable bien diferenciada */
export function TextField({ label, hint, id, multiline, style, ...props }) {
  const fid = useFieldId(id);
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div className="tf">
      {label && <label className="tf-label" htmlFor={fid}>{label}</label>}
      <Tag id={fid} className="tf-input" style={style} {...props} />
      {hint && <div className="tf-hint">{hint}</div>}
    </div>
  );
}

/** Desplegable con el mismo aspecto que TextField */
export function SelectField({ label, hint, id, options, value, onChange }) {
  const fid = useFieldId(id);
  return (
    <div className="tf">
      {label && <label className="tf-label" htmlFor={fid}>{label}</label>}
      <div className="tf-select">
        <select id={fid} className="tf-input" value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <Icon name="chevronRight" size={14} stroke={2.6} className="tf-chev" />
      </div>
      {hint && <div className="tf-hint">{hint}</div>}
    </div>
  );
}
