// Texto del aviso diario: UNA sola notificación por dispositivo con todas las plantas (y todas las casas).

const list = (names, max = 6) => (names.length <= max ? names.join(', ') : `${names.slice(0, max - 1).join(', ')} y ${names.length - (max - 1)} más`);

/**
 * Resumen de una casa.
 * due: [{ name, zone }] · withWater/byDays: [{ title, plant }] · mist: [nombre]
 */
export function householdSummary({ house, due = [], withWater = [], mist = [], byDays = [] }) {
  if (!due.length && !mist.length && !byDays.length) return null;
  const lines = [];
  if (due.length) {
    // Agrupado por zona: "Salón: Monstera, Potos · Terraza: Romero"
    const groups = {};
    for (const p of due) (groups[p.zone || ''] ||= []).push(p.name);
    const zones = Object.entries(groups).map(([z, names]) => (z ? `${z}: ${list(names)}` : list(names))).join(' · ');
    lines.push(`💧 ${zones}`);
  }
  if (withWater.length) lines.push(`🌱 Con este riego: ${withWater.map((r) => `${r.title.toLowerCase()} (${r.plant})`).join(', ')}`);
  if (mist.length) lines.push(`💦 Pulverizar: ${list(mist)}`);
  if (byDays.length) lines.push(`🌱 Hoy: ${byDays.map((r) => `${r.title.toLowerCase()} (${r.plant})`).join(', ')}`);
  return { house, due: due.length, mist: mist.length, care: byDays.length, lines };
}

/** Junta los resúmenes de todas las casas de una persona en un único aviso */
export function buildNotification(summaries, { url } = {}) {
  const s = summaries.filter(Boolean);
  if (!s.length) return null;
  const due = s.reduce((a, x) => a + x.due, 0);
  const mist = s.reduce((a, x) => a + x.mist, 0);
  const title = due
    ? `💧 Toca regar ${due === 1 ? '1 planta' : `${due} plantas`}${mist ? ' y pulverizar' : ''}`
    : mist ? `💦 Toca pulverizar ${mist === 1 ? '1 planta' : `${mist} plantas`}` : '🌱 Cuidados de hoy';
  const body = s.length === 1
    ? s[0].lines.join('\n')
    : s.map((x) => `${x.house}\n${x.lines.join('\n')}`).join('\n\n');
  return { title, body: due ? `${body}\nRevisa la tierra antes de regar.` : body, tag: 'riego', url };
}
