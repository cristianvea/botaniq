// Pregunta en curso a Florencio, independiente de la pantalla: si sales mientras piensa,
// la respuesta se sigue escribiendo y se guarda en la conversación.
import * as db from './data.js';
import { askAssistant } from './assistant.js';

let pending = null; // { threadId, text, tier, ctrl }
const listeners = new Set();
const emit = (ev) => listeners.forEach((fn) => fn(ev));

export const getPending = () => pending;

// Copia de los mensajes de la casa, para que no se pierdan al cambiar de pantalla
let cache = { hid: null, list: null };
export const cachedMessages = (hid) => (cache.hid === hid ? cache.list : null);
export function rememberMessages(hid, list) { cache = { hid, list }; }
export function addMessage(hid, msg) { if (cache.hid === hid) cache = { hid, list: [...(cache.list || []), msg] }; }
/** Junta lo que viene de la base de datos con lo que solo está en memoria (errores, respuestas recién llegadas, miniaturas) */
export function mergeMessages(fetched, local = []) {
  const byId = new Map(local.map((m) => [m.id, m]));
  const out = fetched.map((m) => (byId.get(m.id)?.localUrl ? { ...m, localUrl: byId.get(m.id).localUrl } : m));
  const ids = new Set(fetched.map((m) => m.id));
  for (const m of local) if (!ids.has(m.id)) out.push(m);
  return out.sort((a, b) => String(a.created_at || '9').localeCompare(String(b.created_at || '9')));
}
// Preguntas que le quedan hoy (lo dice el servidor)
let remaining = null;
export const getRemaining = () => remaining;
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function stop(threadId) { if (pending && (!threadId || pending.threadId === threadId)) pending.ctrl.abort('stop'); }

/**
 * Lanza la pregunta. history: mensajes del hilo (el último es la pregunta).
 * Emite { t:'live', threadId, text, tier } mientras escribe, { t:'done', threadId, msg } al acabar
 * y { t:'error', threadId, msg } si falla o se detiene.
 */
export async function ask({ household, user, plants, threadId, plantId, history, context, image }) {
  if (pending) throw new Error('Florencio aún está respondiendo otra pregunta');
  const ctrl = new AbortController();
  const me = { threadId, text: '', tier: null, ctrl };
  pending = me;
  emit({ t: 'live', threadId, text: '', tier: null });
  const timer = setTimeout(() => ctrl.abort('timeout'), 90_000);
  try {
    const res = await askAssistant({
      messages: history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
      context, image, signal: ctrl.signal,
      onEvent: (ev) => {
        if (ev.t === 'meta') { me.tier = ev.tier; if (ev.remaining != null) remaining = ev.remaining; }
        if (ev.t === 'delta') me.text += ev.text;
        if (pending === me) emit({ t: 'live', threadId, text: me.text, tier: me.tier });
      },
    });
    const known = new Set(plants.map((p) => p.id));
    const ids = (res.reminder?.plant_ids || []).filter((id) => known.has(id));
    const msg = await db.addChat({
      household_id: household.id, user_id: user.id, plant_id: plantId, thread_id: threadId, role: 'assistant', content: res.answer,
      meta: { model: res.model, tier: res.tier, reason: res.reason, suggestions: res.suggestions, reminder: ids.length ? { ...res.reminder, plant_ids: ids } : null },
    });
    addMessage(household.id, msg);
    emit({ t: 'done', threadId, msg });
  } catch (e) {
    const reason = ctrl.signal.reason;
    const aborted = e.name === 'AbortError' || ctrl.signal.aborted;
    const content = !aborted ? e.message
      : reason === 'timeout' ? 'Florencio está tardando demasiado. Vuelve a preguntar en un momento.'
      : 'Pregunta detenida.';
    const msg = { id: `err-${Date.now()}`, role: 'assistant', content, thread_id: threadId, created_at: new Date().toISOString(), meta: { error: !aborted, stopped: aborted } };
    addMessage(household.id, msg);
    emit({ t: 'error', threadId, msg });
  } finally {
    clearTimeout(timer);
    if (pending === me) { pending = null; emit({ t: 'idle', threadId }); }
  }
}

/** Agrupa los mensajes en conversaciones, de la más reciente a la más antigua */
export function threadsOf(messages) {
  const map = new Map();
  for (const m of messages) {
    const id = m.thread_id || 'antigua';
    if (!map.has(id)) map.set(id, { id, messages: [] });
    map.get(id).messages.push(m);
  }
  return [...map.values()].map((t) => {
    const first = t.messages.find((m) => m.role === 'user') || t.messages[0];
    const last = t.messages[t.messages.length - 1];
    return { ...t, title: first?.content || 'Conversación', plantId: first?.plant_id || null, updated: last?.created_at, count: t.messages.length };
  }).sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
}

// Emoji y color según el tema de la conversación
const TOPICS = [
  [/abon|fertiliz|nutrient|npk|humus|compost|guano/, '💪', 'var(--orange-soft)'],
  [/plaga|bicho|cochinilla|ara[ñn]a|pulg[oó]n|trips|mosca|mosquit|insect/, '🐛', 'var(--red-soft)'],
  [/hongo|moho|podrid/, '🍄', 'var(--red-soft)'],
  [/amarill|manch|marchit|se muere|seca|quemad|qu[eé] le pasa|enferm/, '🩺', 'var(--red-soft)'],
  [/luz|sol\b|sombra|ventana|oscur/, '☀️', 'var(--sun-soft)'],
  [/riego|regar|riega|agua|\bsed\b|encharc|pulveriz|humedad/, '💧', 'var(--water-soft)'],
  [/trasplant|maceta|sustrato|tierra/, '🪴', 'var(--tint-soft)'],
  [/poda|podar|esqueje|reproduc|cortar/, '✂️', 'var(--tint-soft)'],
  [/flor|florec/, '🌸', 'var(--red-soft)'],
  [/fr[ií]o|helad|invierno|calor|temperatura/, '🌡️', 'var(--water-soft)'],
];
export function topicOf(text = '') {
  const q = text.toLowerCase();
  const hit = TOPICS.find(([re]) => re.test(q));
  return hit ? { emoji: hit[1], bg: hit[2] } : { emoji: '🌱', bg: 'var(--tint-soft)' };
}
