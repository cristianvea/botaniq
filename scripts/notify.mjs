// Envía una notificación con las plantas que toca regar, a la hora que eligió cada persona.
// GitHub Actions (.github/workflows/notify.yml) lo lanza cada hora; cada dispositivo recibe como mucho
// un aviso al día, en cuanto llega su hora (o hasta 3 h después si GitHub se retrasa).
// También puedes lanzarlo a mano:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... node scripts/notify.mjs
// Con DRY_RUN=1 solo muestra lo que enviaría; con FORCE=1 ignora la hora y lo que ya se envió hoy.

import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { fetchWeather } from '../src/lib/weather.js';
import { computeStatus, mistStatus } from '../src/lib/watering.js';
import { MIST } from '../src/lib/care.js';
import { reminderStatus } from '../src/lib/reminders.js';

const {
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT = 'mailto:botaniq@example.com',
  APP_URL = '', DRY_RUN, FORCE,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
if (!DRY_RUN && (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY)) throw new Error('Faltan las claves VAPID');
if (!DRY_RUN) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function all(table, build = (q) => q) {
  const { data, error } = await build(sb.from(table).select('*'));
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

const since = new Date(Date.now() - 120 * 86400000).toISOString();
const [households, plants, events, members, subs, zones] = await Promise.all([
  all('households', (q) => q.not('lat', 'is', null)),
  all('plants', (q) => q.eq('archived', false)),
  all('plant_events', (q) => q.gte('at', since)),
  all('household_members'),
  all('push_subscriptions'),
  all('zones'),
]);
const zoneName = Object.fromEntries(zones.map((z) => [z.id, z.name]));
// Recordatorios de cuidados (si aún no existe la tabla, seguimos sin ellos)
const reminders = await all('care_reminders').catch((e) => { console.warn('Sin recordatorios:', e.message); return []; });

const eventsByPlant = {};
for (const e of events) (eventsByPlant[e.plant_id] ||= []).push(e);

// Hora y fecha locales de cada dispositivo
function localNow(tz) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((p) => [p.type, p.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
  } catch {
    return localNow('Europe/Madrid');
  }
}

const WINDOW = 3; // horas de margen por si GitHub Actions se retrasa
const hasPrefs = subs.length === 0 || 'notify_hour' in subs[0];
if (!hasPrefs) console.warn('⚠️  Falta la migración 005_avisos.sql: se usa las 9:00 para todos.');

// ¿A qué dispositivos les toca ahora?
const ready = subs.filter((s) => {
  const { date, hour } = localNow(s.tz);
  const want = s.notify_hour ?? 9;
  s._today = date;
  if (FORCE) return true;
  if (!hasPrefs) return hour === want;
  return s.last_sent_on !== date && hour >= want && hour < want + WINDOW;
});
console.log(`${subs.length} dispositivos, ${ready.length} en su hora de aviso`);

// Mensaje de cada casa (se calcula solo si hace falta)
const messageCache = {};
async function messageFor(h) {
  if (h.id in messageCache) return messageCache[h.id];
  messageCache[h.id] = null;
  const hp = plants.filter((p) => p.household_id === h.id);
  if (!hp.length) return null;

  let weather;
  try {
    weather = await fetchWeather(h.lat, h.lon);
  } catch (e) {
    console.error(`[${h.name}] sin tiempo: ${e.message}`);
    return null;
  }

  const due = hp
    .map((p) => ({ p, st: computeStatus(p, eventsByPlant[p.id] || [], weather) }))
    .filter(({ st }) => st.status === 'due' || st.status === 'overdue')
    .sort((a, b) => b.st.dryness - a.st.dryness);

  const toMist = hp.filter((p) => MIST[p.profile] && mistStatus(p, eventsByPlant[p.id] || [], weather, MIST[p.profile])?.due);

  // Recordatorios: los de "con el riego" de las plantas que toca regar, y los de "cada N días" que tocan hoy
  const hr = reminders.filter((r) => hp.some((p) => p.id === r.plant_id));
  const dueIds = new Set(due.map((d) => d.p.id));
  const name = (id) => hp.find((p) => p.id === id)?.name;
  const withWater = hr.filter((r) => r.mode === 'with_watering' && dueIds.has(r.plant_id) && reminderStatus(r, events).due);
  const byDays = hr.filter((r) => r.mode === 'every_days' && reminderStatus(r, events).due);

  console.log(`[${h.name}] ${hp.length} plantas, ${due.length} por regar: ${due.map((d) => d.p.name).join(', ')}; pulverizar: ${toMist.map((p) => p.name).join(', ')}; cuidados: ${[...withWater, ...byDays].map((r) => r.title).join(', ')}`);
  if (!due.length && !toMist.length && !byDays.length) return null;

  // Agrupado por zona: "Salón: Monstera, Potos · Terraza: Romero"
  const groups = {};
  for (const { p } of due) (groups[zoneName[p.zone_id] || ''] ||= []).push(p.name);
  const body = Object.entries(groups)
    .map(([z, names]) => {
      const list = names.length <= 3 ? names.join(', ') : `${names.slice(0, 2).join(', ')} y ${names.length - 2} más`;
      return z ? `${z}: ${list}` : list;
    })
    .join(' · ');
  const parts = [];
  if (due.length) parts.push(`${body}. Revisa la tierra (y haz una foto) antes de regar.`);
  if (withWater.length) parts.push(`🌱 Con este riego: ${withWater.map((r) => `${r.title.toLowerCase()} (${name(r.plant_id)})`).join(', ')}`);
  if (toMist.length) parts.push(`💦 Pulverizar: ${toMist.map((p) => p.name).join(', ')}`);
  if (byDays.length) parts.push(`🌱 Hoy: ${byDays.map((r) => `${r.title.toLowerCase()} (${name(r.plant_id)})`).join(', ')}`);
  const multi = households.length > 1 ? ` · ${h.name}` : '';
  return (messageCache[h.id] = JSON.stringify({
    title: (due.length
      ? `💧 Toca regar ${due.length === 1 ? '1 planta' : `${due.length} plantas`}`
      : toMist.length ? '💦 Toca pulverizar' : '🌱 Cuidados de hoy') + multi,
    body: parts.join('\n'),
    tag: `riego-${h.id}`,
    url: APP_URL || undefined,
  }));
}

let sent = 0;
for (const s of ready) {
  const hids = members.filter((m) => m.user_id === s.user_id).map((m) => m.household_id);
  let gone = false;
  for (const h of households.filter((x) => hids.includes(x.id))) {
    const payload = await messageFor(h);
    if (!payload || gone) continue;
    if (DRY_RUN) { console.log('  → (simulado)', s.endpoint.slice(0, 50), payload); continue; }
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600 });
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await sb.from('push_subscriptions').delete().eq('id', s.id);
        console.log('  suscripción caducada eliminada');
        gone = true;
      } else {
        console.error('  error push', e.statusCode, e.body || e.message);
      }
    }
  }
  // Ya se ha mirado hoy este dispositivo (haya o no plantas que regar)
  if (!gone && !DRY_RUN && !FORCE && hasPrefs) {
    const { error } = await sb.from('push_subscriptions').update({ last_sent_on: s._today }).eq('id', s.id);
    if (error) console.error('  no se pudo marcar el envío:', error.message);
  }
}
console.log(`Notificaciones enviadas: ${sent}`);
