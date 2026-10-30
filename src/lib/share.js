// Compartir BotanIQ (WhatsApp u otra app) con instrucciones para instalarla y registrarse.

// Dirección de la app (la del dominio en el que está abierta)
export const appUrl = () => new URL(import.meta.env.BASE_URL || '/', window.location.origin).href;
export const installUrl = (code) => `${appUrl()}instalar/${code ? `?casa=${encodeURIComponent(code)}` : ''}`;

/** Mensaje para WhatsApp. Con código, invita además a unirse a la casa. */
export function shareMessage({ code, house } = {}) {
  return [
    '🌷 *BotanIQ*: te avisa de cuándo regar cada planta según el tiempo que hace, y tiene un botánico, Florencio, para resolver dudas.',
    '',
    `👉 ${installUrl(code)}`,
    '',
    '*Instálala como app* (después ábrela siempre desde su icono):',
    '📱 iPhone: ábrelo en Safari → botón Compartir (cuadrado con flecha) → «Añadir a pantalla de inicio».',
    '🤖 Android: ábrelo en Chrome → menú ⋮ → «Instalar aplicación» o «Añadir a pantalla de inicio».',
    '',
    '*Regístrate*: abre BotanIQ desde el icono → «Regístrate» → tu correo y una contraseña. Si te llega un correo de confirmación, pulsa el enlace y vuelve a entrar desde el icono.',
    code
      ? `\n🏡 Luego elige «Unirme con código» y pon *${code}* para cuidar conmigo las plantas de «${house}».`
      : '\n🏡 Luego crea tu casa y añade tu primera planta con una foto.',
  ].join('\n');
}

/** Abre el menú de compartir del móvil; si no hay, WhatsApp directamente */
export async function shareApp(opts = {}) {
  const text = shareMessage(opts);
  if (navigator.share) {
    try { await navigator.share({ text }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  return 'whatsapp';
}

// Código de invitación que llega en el enlace (?casa=XXXX): se guarda hasta que se use
const PENDING = 'botaniq.pendingCode';
export function capturePendingCode() {
  try {
    const q = new URLSearchParams(window.location.search);
    const c = q.get('casa');
    if (!c) return;
    localStorage.setItem(PENDING, c.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12));
    q.delete('casa');
    const rest = q.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash);
  } catch { /* sin almacenamiento */ }
}
export const pendingCode = () => { try { return localStorage.getItem(PENDING) || ''; } catch { return ''; } };
export const clearPendingCode = () => { try { localStorage.removeItem(PENDING); } catch { /* nada */ } };
