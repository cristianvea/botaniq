import { supabase } from './supabase.js';

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export const pushSupported =
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && Boolean(VAPID);

export const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone =
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

function b64ToUint8(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function currentSubscription() {
  if (!pushSupported) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid'; } catch { return 'Europe/Madrid'; } })();
const ASKED_KEY = 'botaniq.notifyAsked';

export const DEFAULT_HOUR = 9;
export const fmtHour = (h) => `${h}:00`;

// Se puede ofrecer activar avisos en este dispositivo (en iPhone, solo con la app instalada)
export const canAskPush = () =>
  pushSupported && (!isIOS || isStandalone) && Notification.permission !== 'denied';

export const alreadyAsked = () => { try { return localStorage.getItem(ASKED_KEY) === '1'; } catch { return false; } };
export const markAsked = () => { try { localStorage.setItem(ASKED_KEY, '1'); } catch { /* sin almacenamiento */ } };

// Preferencias de este dispositivo: { on, hour }
// La verdad la tiene el servidor: si el navegador está suscrito pero falta la fila (la borró el aviso diario
// o era de otra cuenta), la volvemos a guardar a nombre de quien ha iniciado sesión.
export async function pushPrefs(userId) {
  const sub = await currentSubscription().catch(() => null);
  if (!sub) return { on: false, hour: DEFAULT_HOUR };
  const { data } = await supabase.from('push_subscriptions').select('notify_hour').eq('endpoint', sub.endpoint).maybeSingle();
  if (data) return { on: true, hour: data.notify_hour ?? DEFAULT_HOUR };
  if (userId && Notification.permission === 'granted') {
    const j = sub.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert(
      { user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, notify_hour: DEFAULT_HOUR, tz: TZ },
      { onConflict: 'endpoint' });
    if (!error) return { on: true, hour: DEFAULT_HOUR };
  }
  return { on: false, hour: DEFAULT_HOUR };
}

/** Al cerrar sesión: este dispositivo deja de recibir los avisos de esa cuenta */
export async function forgetDevice() {
  try { await disablePush(); } catch { /* sin suscripción */ }
}

export async function setPushHour(hour) {
  const sub = await currentSubscription();
  if (!sub) throw new Error('Los avisos no están activados en este dispositivo');
  const { error } = await supabase.from('push_subscriptions')
    .update({ notify_hour: hour, tz: TZ, last_sent_on: null }).eq('endpoint', sub.endpoint);
  if (error) throw error;
}

// Muestra ya una notificación de ejemplo, para comprobar que llegan
export async function testNotification() {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('💧 Así te avisaremos', {
    body: 'Salón: Monstera, Potos. Revisa la tierra (y haz una foto) antes de regar.',
    icon: reg.scope + 'icon-192-tulipan.png',
    tag: 'prueba',
  });
}

export async function enablePush(userId, hour = DEFAULT_HOUR) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    throw new Error(isIOS
      ? 'No has dado permiso. Actívalo en Ajustes del iPhone → Notificaciones → BotanIQ.'
      : 'No has dado permiso para notificaciones. Actívalo en los ajustes del navegador.');
  }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(VAPID) });
  }
  const j = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, notify_hour: hour, tz: TZ, last_sent_on: null },
    { onConflict: 'endpoint' }
  );
  if (error) {
    if (/notify_hour|tz|last_sent_on/.test(error.message)) throw new Error('Falta actualizar la base de datos (migración 005_avisos.sql)');
    throw error;
  }
  markAsked();
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}
