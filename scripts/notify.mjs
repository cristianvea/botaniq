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
import { householdSummary, buildNotification } from '../src/lib/notifyText.js';

const {
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT = 'mailto:botaniq@example.com',
  APP_URL = '', DRY_RUN, FORCE,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
if (!DRY_RUN && (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY)) throw new Error('Faltan las claves VAPID');
if (!DRY_RUN) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Lee la tabla entera de 1.000 en 1.000 (Supabase devuelve como mucho 1.000 filas por consulta)
async function all(table, build = (q) => q, key = 'id') {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(sb.from(table).select('*')).order(key).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

const since = new Date(Date.now() - 120 * 86400000).toISOString();
const [households, plants, events, members, subs, zones] = await Promise.all([
  all('households', (q) => q.not('lat', 'is', null)),
  all('plants', (q) => q.eq('archived', false)),
  all('plant_events', (q) => q.gte('at', since)),
  all('household_members', (q) => q, 'user_id'),
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
    console.error(`[${h.id.slice(0, 8)}] sin tiempo: ${e.message}`);
    return (messageCache[h.id] = { failed: true }); // se reintenta en la siguiente ejecución
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
  const withWater = hr.filter((r) => r.mode === 'with_watering' && dueIds.has(r.plant_id) && reminderStatus(r, events, new Date(), 'Europe/Madrid').due);
  const byDays = hr.filter((r) => r.mode === 'every_days' && reminderStatus(r, events, new Date(), 'Europe/Madrid').due);

  // El repositorio es público: en el registro solo números, nunca nombres de casas ni de plantas
  console.log(`[${h.id.slice(0, 8)}] ${hp.length} plantas, ${due.length} por regar, ${toMist.length} pulverizar, ${withWater.length + byDays.length} cuidados`);
  if (!due.length && !toMist.length && !byDays.length) return null;

  return (messageCache[h.id] = householdSummary({
    house: h.name,
    due: due.map(({ p }) => ({ name: p.name, zone: zoneName[p.zone_id] || '' })),
    withWater: withWater.map((r) => ({ title: r.title, plant: name(r.plant_id) })),
    mist: toMist.map((p) => p.name),
    byDays: byDays.map((r) => ({ title: r.title, plant: name(r.plant_id) })),
  }));
}

let sent = 0;
for (const s of ready) {
  const hids = members.filter((m) => m.user_id === s.user_id).map((m) => m.household_id);
  let gone = false;
  // Un único aviso con todas las plantas de todas sus casas
  const summaries = [];
  for (const h of households.filter((x) => hids.includes(x.id))) summaries.push(await messageFor(h));
  // Si falló el tiempo de alguna casa, no marcamos el día: se reintenta en la próxima hora de la ventana
  if (summaries.some((x) => x?.failed)) { console.log('  sin datos del tiempo: se reintentará'); continue; }
  const note = buildNotification(summaries, { url: APP_URL || undefined });
  if (note) {
    const payload = JSON.stringify(note);
    if (DRY_RUN) console.log('  → (simulado)', note.title); // sin nombres de plantas en el registro público
    else {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600 });
        sent++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await sb.from('push_subscriptions').delete().eq('id', s.id);
          console.log('  suscripción caducada eliminada');
          gone = true;
        } else {
          console.error('  error push', e.statusCode);
          continue; // fallo temporal: no marcamos el día, se reintenta en la próxima hora
        }
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
