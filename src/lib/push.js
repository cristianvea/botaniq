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

export async function enablePush(userId) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('No has dado permiso para notificaciones');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(VAPID) });
  }
  const j = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth },
    { onConflict: 'endpoint' }
  );
  if (error) throw error;
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}
