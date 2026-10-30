// Recordatorios de cuidados (abono, girar la maceta…): cuándo tocan.
// Sirve en la app y en el script de avisos (scripts/notify.mjs).

export const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const DAY = 86400000;
// Fecha de calendario (AAAA-MM-DD) en la zona horaria dada (por defecto, la del dispositivo)
const dayKey = (d, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
const calendarDays = (a, b, tz) => Math.round((new Date(dayKey(b, tz)) - new Date(dayKey(a, tz))) / DAY);

/** ¿Aplica este mes? (months vacío = todo el año) */
export function inSeason(r, date = new Date()) {
  return !r.months?.length || r.months.includes(date.getMonth() + 1);
}

/**
 * Estado de un recordatorio.
 *  - with_watering: toca cada N riegos → { due, withWatering: true, left } (left = riegos que faltan)
 *  - every_days:    toca cada N días   → { due, daysLeft }
 */
export function reminderStatus(r, events = [], now = new Date(), tz = undefined) {
  if (!inSeason(r, now)) return { due: false, off: true };
  const since = new Date(r.last_done_at || r.created_at || 0).getTime();
  if (r.mode === 'every_days') {
    // Días de calendario: si lo hiciste el día 1 por la noche, cada 7 días toca el día 8 desde por la mañana
    const elapsed = r.last_done_at ? calendarDays(since, now, tz) : r.every; // nunca hecho → ya toca
    return { due: elapsed >= r.every, daysLeft: Math.max(0, r.every - elapsed) };
  }
  // Riegos hechos desde la última vez; toca en el riego número N
  const waterings = events.filter((e) => e.plant_id === r.plant_id && e.type === 'water' && new Date(e.at).getTime() > since).length;
  const left = r.last_done_at ? Math.max(0, r.every - 1 - waterings) : 0;
  return { due: left === 0, withWatering: true, left };
}

/** Texto corto de la frecuencia: "Cada 2 riegos · mar–sep" */
export function cadenceText(r) {
  const base = r.mode === 'every_days'
    ? (r.every === 1 ? 'Cada día' : r.every === 7 ? 'Cada semana' : r.every === 14 ? 'Cada 2 semanas' : `Cada ${r.every} días`)
    : (r.every === 1 ? 'En cada riego' : `Cada ${r.every} riegos`);
  return r.months?.length ? `${base} · ${monthsText(r.months)}` : base;
}

export function monthsText(months = []) {
  if (!months.length || months.length === 12) return 'todo el año';
  const m = [...months].sort((a, b) => a - b);
  const contiguous = m.every((x, i) => i === 0 || x === m[i - 1] + 1);
  return contiguous ? `${MONTHS[m[0] - 1]}–${MONTHS[m[m.length - 1] - 1]}` : m.map((x) => MONTHS[x - 1]).join(', ');
}

/** Estado corto para la ficha: "Próximo riego", "En 3 riegos", "Hoy", "En 5 días", "En pausa" */
export function reminderWhen(st) {
  if (st.off) return 'En pausa';
  if (st.withWatering) return st.due ? 'Próximo riego' : `En ${st.left + 1} riegos`;
  return st.due ? 'Hoy' : st.daysLeft === 1 ? 'Mañana' : `En ${st.daysLeft} días`;
}
