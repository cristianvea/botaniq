import { useEffect, useState } from 'react';

// Si BotanIQ cambia de dirección (dominio propio), las copias instaladas en la antigua siguen
// funcionando desde la caché. Aquí lo detectamos (la antigua redirige a la nueva) y lo avisamos.
export default function Moved() {
  const [to, setTo] = useState(null);
  useEffect(() => {
    if (import.meta.env.VITE_DEMO || import.meta.env.DEV) return;
    const base = import.meta.env.BASE_URL || '/';
    fetch(`${base}ping.txt?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => {
        const u = new URL(r.url);
        if (r.ok && u.origin !== window.location.origin && u.pathname.endsWith('/ping.txt')) setTo(u.href.replace(/ping\.txt.*$/, ''));
      })
      .catch(() => {});
  }, []);
  if (!to) return null;
  const host = new URL(to).host;
  return (
    <div className="moved" role="dialog" aria-label="Nueva dirección">
      <div className="moved-card">
        <div className="moved-emoji">🌷</div>
        <b>BotanIQ tiene nueva dirección</b>
        <p className="t-sub c2">Ahora está en <b>{host}</b>. Ábrela allí e instálala de nuevo en tu pantalla de inicio. Tus plantas siguen igual: solo tendrás que volver a entrar y activar los avisos. Después puedes borrar esta app.</p>
        <a className="btn block" href={`${to}instalar/`}>Ir a {host}</a>
      </div>
    </div>
  );
}
