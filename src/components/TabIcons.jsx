// Iconos ilustrados de la barra de pestañas (en gris cuando no están activos)
import Florencio from './Florencio.jsx';

const rays = [0, 45, 90, 135, 180, 225, 270, 315];

export function TabIcon({ name }) {
  if (name === 'ask') return <span className="tab-ico"><Florencio mood="head" size={30} title="" /></span>;
  return (
    <svg className="tab-ico" viewBox="0 0 32 32" aria-hidden="true">
      {name === 'today' && (
        <>
          <g fill="#ffc23d">{rays.map((a) => <rect key={a} x="14.7" y="1.5" width="2.6" height="5" rx="1.3" transform={`rotate(${a} 16 16)`} />)}</g>
          <circle cx="16" cy="16" r="9" fill="#ffc23d" stroke="#e5a400" strokeWidth="1.5" />
          <circle cx="13" cy="15" r="1.3" fill="#6b4500" /><circle cx="19" cy="15" r="1.3" fill="#6b4500" />
          <path d="M12.8 18.3c1.8 2 4.6 2 6.4 0" stroke="#6b4500" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </>
      )}
      {name === 'plants' && (
        <>
          <path d="M16 15V8" stroke="#2b8a43" strokeWidth="2" strokeLinecap="round" />
          <path d="M16 10c-6 0-8-4-8-7 5 0 8 3 8 7z" fill="#3aa856" />
          <path d="M16 12c5 0 8-3 8-6-5 0-8 2-8 6z" fill="#7ad98a" />
          <path d="M7 15h18l-2.2 12.5a2 2 0 0 1-2 1.5h-9.6a2 2 0 0 1-2-1.5z" fill="#ff8a5b" />
          <rect x="6" y="14" width="20" height="4" rx="2" fill="#e0673a" />
          <circle cx="13" cy="22" r="1.1" fill="#5a2a12" /><circle cx="19" cy="22" r="1.1" fill="#5a2a12" />
          <path d="M14 24.6c1.2 1 2.8 1 4 0" stroke="#5a2a12" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </>
      )}
      {name === 'settings' && (
        <>
          <g fill="#9b6bff">{rays.map((a) => <rect key={a} x="13.5" y="2.5" width="5" height="6" rx="1.6" transform={`rotate(${a} 16 16)`} />)}</g>
          <circle cx="16" cy="16" r="10" fill="#9b6bff" stroke="#7a49e0" strokeWidth="1.5" />
          <circle cx="16" cy="16" r="4" fill="#fff" />
        </>
      )}
    </svg>
  );
}
