// Asistente: pregunta a la Edge Function "ai" con el contexto de tus plantas.
import { supabase, supabaseUrl, supabaseKey } from './supabase.js';
import { blobToBase64 } from './image.js';
import { PROFILES, LIGHTS, POTS, POT_MATERIALS, SUBSTRATES, substrateFor } from './profiles.js';
import { wateringGuide } from './care.js';
import { seasonInfo, fmtHours } from './season.js';
import { indoorClimate } from './watering.js';
import { cadenceText } from './reminders.js';

const label = (o, k) => (o[k]?.label || k || '').split(' (')[0];

function plantLine(p, { zones, statuses }) {
  const st = statuses[p.id];
  const zone = zones.find((z) => z.id === p.zone_id);
  const when = !st ? '' : ['due', 'overdue'].includes(st.status) ? 'toca regar hoy' : `próximo riego en ${st.daysUntil} días`;
  return `- [id ${p.id}] ${p.name}${p.species ? ` (${p.species})` : ''} · ${label(PROFILES, p.profile)} · ${zone?.name || ''} (${p.location === 'outdoor' ? 'exterior' : 'interior'}) · ${when}`;
}

/** Contexto en texto para la IA: fecha, estación, tiempo, plantas y, si hay una elegida, todos sus datos */
export function buildContext(ctx, plantId) {
  const { household, plants, zones, statuses, events, weather, reminders = [] } = ctx;
  const s = seasonInfo(new Date(), household.lat ?? 40);
  const day = weather?.days.find((d) => d.date === weather.today);
  const lines = [
    `Fecha: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
    `Lugar: ${(household.place_name || '').split(',').slice(0, 2).join(',')} · ${s.name} (${s.phase} de la estación) · ${fmtHours(s.dayHours)} de luz, los días se ${s.trend}`,
  ];
  if (weather) {
    lines.push(`Tiempo fuera hoy: ${Math.round(weather.current.temp)}° ahora, máx ${Math.round(day?.tmax)}° / mín ${Math.round(day?.tmin)}°, humedad ${Math.round(weather.current.rh)} %, lluvia ${day?.precip?.toFixed(1)} mm`);
    if (day) lines.push(`Dentro de casa (estimado): ~${Math.round(indoorClimate(day).t)}°, humedad ~${Math.round(indoorClimate(day).rh)} %`);
  }
  lines.push('', `Plantas de la casa (${plants.length}):`, ...plants.map((p) => plantLine(p, ctx)));

  const p = plantId && plants.find((x) => x.id === plantId);
  if (p) {
    const st = statuses[p.id];
    const mine = events.filter((e) => e.plant_id === p.id);
    const g = wateringGuide(p, { weather, status: st, events: mine });
    const lastCheck = mine.find((e) => e.type === 'checkin');
    const lastDiag = mine.find((e) => e.diagnosis)?.diagnosis;
    lines.push('', `La conversación es sobre: ${p.name} [id ${p.id}]`,
      `- Especie: ${p.species || 'sin identificar'}${p.common_name ? ` (${p.common_name})` : ''}${p.family ? `, familia ${p.family}` : ''}`,
      `- Tipo: ${PROFILES[p.profile]?.label || p.profile}`,
      `- Luz: ${label(LIGHTS, p.light)} · ${p.location === 'outdoor' ? `exterior${p.gets_rain === false ? ', a cubierto de la lluvia' : ''}` : 'interior'}`,
      `- Maceta: ${label(POTS, p.pot)}, ${label(POT_MATERIALS, p.pot_material)}, ${p.pot_drainage === false ? 'SIN agujeros' : 'con agujeros'}`,
      `- Sustrato: ${label(SUBSTRATES, substrateFor(p))}${p.substrate === 'unknown' ? ' (supuesto: el de tienda)' : ''}`,
      st ? `- Riego: sequedad estimada ${Math.round(st.dryness * 100)} %, ${st.lastWatered ? `último riego hace ${st.daysSinceWater} días` : 'sin riegos registrados'}, ${['due', 'overdue'].includes(st.status) ? 'toca regar ya' : `próximo en ${st.daysUntil} días`}` : '',
      `- Cómo la riega la app: ${g.title} (${g.detail})`,
      p.fixed_days > 0 ? `- El usuario tiene su propia rutina: la riega cada ${p.fixed_days} días${p.fixed_seasonal ? ' (adaptada a la estación)' : ''}. Respétala; solo sugiere cambiarla si hay síntomas claros o te lo pregunta.` : '',
      lastCheck ? `- Última revisión: ${new Date(lastCheck.at).toLocaleDateString('es-ES')}, tierra ${lastCheck.soil || 'sin indicar'}${lastCheck.note ? `, nota: "${lastCheck.note}"` : ''}` : '',
      lastDiag ? `- Último diagnóstico por foto: ${lastDiag.summary}` : '',
      p.notes ? `- Notas del usuario: ${p.notes}` : '',
    );
  }

  if (reminders.length) {
    lines.push('', 'Recordatorios que ya existen:', ...reminders.map((r) => {
      const pl = plants.find((x) => x.id === r.plant_id);
      return `- ${r.title} · ${pl?.name || '?'} · ${cadenceText(r)}`;
    }));
  }
  return lines.filter((l) => l !== '').join('\n');
}

/**
 * Envía la conversación y va recibiendo la respuesta según se escribe.
 * messages: [{role:'user'|'assistant', content}]
 * onEvent({t:'meta'|'model'|'delta', ...}) para ir pintando; devuelve { answer, reminder|null, suggestions[], model, tier, reason }
 * signal: AbortSignal para detener la pregunta.
 */
export async function askAssistant({ messages, context, image, signal, onEvent = () => {} }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Inicia sesión de nuevo para hablar con Florencio.');
  const body = { task: 'chat', messages, context, image: image ? await blobToBase64(image) : undefined };

  let res;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/ai`, {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}`, apikey: supabaseKey },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error('No hay conexión con Florencio. Revisa internet y vuelve a probar.');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = '';
    try { const j = JSON.parse(text); msg = j.error || j.message || j.msg || ''; } catch { msg = text.slice(0, 160); }
    if (res.status === 404) msg = 'Florencio no está activado todavía: falta desplegar la función "ai" en Supabase.';
    else if (res.status === 401) msg = `No se ha podido comprobar tu sesión (${msg || '401'}). Si sigue pasando, desactiva «Verify JWT» en la función "ai" de Supabase.`;
    else if (res.status === 504 || res.status === 546) msg = `Florencio ha tardado demasiado (${res.status}). Vuelve a probar.`;
    throw new Error(msg ? `${msg}` : `Error ${res.status} de la función "ai"`);
  }

  // Respuesta en streaming: una línea JSON por evento
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  let done = null;
  while (true) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buf += value;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      if (ev.t === 'error') throw new Error(ev.error === 'cancelado' ? 'Pregunta cancelada' : ev.error);
      if (ev.t === 'done') done = ev;
      else onEvent(ev);
    }
  }
  if (!done) throw new Error('La respuesta se ha cortado. Vuelve a probar.');
  return done;
}

export const TIER_LABEL = { lite: 'Rápido', standard: 'Estándar', pro: 'Avanzado' };
