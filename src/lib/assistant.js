// Asistente: pregunta a la Edge Function "ai" con el contexto de tus plantas.
import { supabase } from './supabase.js';
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
 * Envía la conversación. messages: [{role:'user'|'assistant', content}]
 * Devuelve { answer, reminder|null, suggestions[], model, tier, reason }
 */
export async function askAssistant({ messages, context, image }) {
  const body = { task: 'chat', messages, context, image: image ? await blobToBase64(image) : undefined };
  const { data, error } = await supabase.functions.invoke('ai', { body });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch { /* sin cuerpo */ }
    if (/not found|404|Failed to send/i.test(msg)) msg = 'El asistente no está activado todavía: falta desplegar la función "ai" en Supabase.';
    throw new Error(msg);
  }
  return data;
}

export const TIER_LABEL = { lite: 'Rápido', standard: 'Estándar', pro: 'Avanzado' };
