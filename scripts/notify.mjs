// Envía cada mañana una notificación con las plantas que toca regar.
// Lo ejecuta GitHub Actions (.github/workflows/notify.yml). También puedes lanzarlo a mano:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... node scripts/notify.mjs
// Con DRY_RUN=1 solo muestra lo que enviaría.

import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { fetchWeather } from '../src/lib/weather.js';
import { computeStatus, mistStatus } from '../src/lib/watering.js';
import { MIST } from '../src/lib/care.js';

const {
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT = 'mailto:botaniq@example.com',
  APP_URL = '', DRY_RUN,
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

const eventsByPlant = {};
for (const e of events) (eventsByPlant[e.plant_id] ||= []).push(e);

let sent = 0;
for (const h of households) {
  const hp = plants.filter((p) => p.household_id === h.id);
  if (!hp.length) continue;

  let weather;
  try {
    weather = await fetchWeather(h.lat, h.lon);
  } catch (e) {
    console.error(`[${h.name}] sin tiempo: ${e.message}`);
    continue;
  }

  const due = hp
    .map((p) => ({ p, st: computeStatus(p, eventsByPlant[p.id] || [], weather) }))
    .filter(({ st }) => st.status === 'due' || st.status === 'overdue')
    .sort((a, b) => b.st.dryness - a.st.dryness);

  const toMist = hp.filter((p) => MIST[p.profile] && mistStatus(p, eventsByPlant[p.id] || [], weather, MIST[p.profile])?.due);

  console.log(`[${h.name}] ${hp.length} plantas, ${due.length} por regar: ${due.map((d) => d.p.name).join(', ')}; pulverizar: ${toMist.map((p) => p.name).join(', ')}`);
  if (!due.length && !toMist.length) continue;

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
  if (toMist.length) parts.push(`💦 Pulverizar: ${toMist.map((p) => p.name).join(', ')}`);
  const payload = JSON.stringify({
    title: due.length
      ? `💧 Toca regar ${due.length === 1 ? '1 planta' : `${due.length} plantas`}`
      : '💦 Toca pulverizar',
    body: parts.join('\n'),
    tag: `riego-${h.id}`,
    url: APP_URL || undefined,
  });

  const userIds = members.filter((m) => m.household_id === h.id).map((m) => m.user_id);
  for (const s of subs.filter((s) => userIds.includes(s.user_id))) {
    if (DRY_RUN) { console.log('  → (simulado)', s.endpoint.slice(0, 50), payload); continue; }
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600 });
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await sb.from('push_subscriptions').delete().eq('id', s.id);
        console.log('  suscripción caducada eliminada');
      } else {
        console.error('  error push', e.statusCode, e.body || e.message);
      }
    }
  }
}
console.log(`Notificaciones enviadas: ${sent}`);
