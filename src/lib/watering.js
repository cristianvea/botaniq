// Modelo de riego: "balance de sequedad".
// Tras regar, la sequedad vale 0. Cada día suma una tasa que depende de la planta y del tiempo.
// Cuando llega a 1, toca regar. En exterior la lluvia la reduce.

import { PROFILES, SUBSTRATES, LIGHTS, POTS, POT_MATERIALS, substrateFor } from './profiles.js';
import { photoperiodFactor } from './season.js';

const RAIN_FULL_MM = 10;      // lluvia que equivale a un riego completo en maceta
const ET0_REF = 3;            // mm/día de referencia (día templado de primavera)
const WET_CHECK_DRYNESS = 0.7; // "aún estaba húmeda" → la dejamos en este nivel

// Estado de la tierra que indica el usuario al revisar (tocando 2–3 cm)
export const SOIL = {
  wet:     { label: 'Encharcada', emoji: '💦', level: 0.15 },
  moist:   { label: 'Húmeda', emoji: '💧', level: 0.5 },
  dry_top: { label: 'Seca por encima', emoji: '🌤️', level: 0.85 },
  dry:     { label: 'Seca del todo', emoji: '🏜️', level: 1.05 },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Déficit de presión de vapor (kPa): cuanto mayor, más rápido se seca
function vpd(t, rh) {
  const es = 0.6108 * Math.exp((17.27 * t) / (t + 237.3));
  return es * (1 - rh / 100);
}
const VPD_REF = vpd(21, 50);

/** Condiciones estimadas dentro de casa a partir de las de fuera */
export function indoorClimate(day) {
  const tout = day.tmean ?? 18;
  const rhout = day.rh ?? 60;
  const t = clamp(21 + (tout - 21) * 0.3, 16, 30);
  let rh = 0.5 * rhout + 20;
  if (tout < 12) rh -= 8; // calefacción encendida → aire más seco
  return { t, rh: clamp(rh, 25, 70) };
}

/** Factor ambiental (1 = condiciones de referencia) para un día concreto */
export function envFactor(plant, day) {
  if (!day) return 1;
  if (plant.location === 'outdoor') {
    const et0 = day.et0 ?? ET0_REF;
    let f = clamp(et0 / ET0_REF, 0.15, 2.8);
    if ((day.tmean ?? 15) < 6) f *= 0.6; // frío: la planta casi no consume
    return f * (LIGHTS[plant.light] || LIGHTS.indirect).outdoorFactor;
  }
  const { t, rh } = indoorClimate(day);
  const fv = Math.sqrt(vpd(t, rh) / VPD_REF);
  const growth = clamp((t - 8) / 13, 0.4, 1.3);
  // Días largos (verano) → más fotosíntesis y transpiración; días cortos (invierno) → menos
  const daylight = photoperiodFactor(day.lat, day.date);
  return fv * growth * daylight * (LIGHTS[plant.light] || LIGHTS.indirect).factor;
}

/** Tasa de secado diaria de la planta (fracción de "depósito" que pierde ese día) */
export function dailyRate(plant, day) {
  const profile = PROFILES[plant.profile] || PROFILES.generica;
  const substrate = SUBSTRATES[substrateFor(plant)]?.factor ?? 1;
  const pot = POTS[plant.pot]?.factor ?? 1;
  const material = POT_MATERIALS[plant.pot_material]?.factor ?? 1;
  const adjust = plant.adjust || 1;
  const drainage = plant.pot_drainage === false ? 0.8 : 1; // sin agujeros retiene el agua
  return (1 / profile.baseDays) * substrate * pot * material * drainage * adjust * envFactor(plant, day);
}

const dateInTz = (iso, tz) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);
}

/**
 * Calcula el estado de riego de una planta.
 * @param plant  fila de la tabla plants
 * @param events eventos de esa planta (water / check_wet / checkin / mist), cualquier orden
 * @param weather resultado de fetchWeather()
 */
export function computeStatus(plant, events, weather) {
  const tz = weather.timezone;
  const today = weather.today;
  const byDate = Object.fromEntries(weather.days.map((d) => [d.date, d]));

  const sorted = [...events].sort((a, b) => new Date(a.at) - new Date(b.at));
  const lastWater = [...sorted].reverse().find((e) => e.type === 'water');

  // Punto de partida
  let start, dryness;
  if (lastWater) {
    start = dateInTz(lastWater.at, tz);
    dryness = 0;
  } else {
    // Nunca registrada: suponemos que está a medias desde que se dio de alta
    start = dateInTz(plant.created_at || new Date().toISOString(), tz);
    dryness = 0.5;
  }

  // Revisiones posteriores al último riego: corrigen la sequedad estimada
  const startTs = lastWater ? new Date(lastWater.at).getTime() : -Infinity;
  const checks = {};
  for (const e of sorted) {
    if (new Date(e.at).getTime() <= startTs) continue;
    const d = dateInTz(e.at, tz);
    if (e.type === 'check_wet') checks[d] = (x) => Math.min(x, WET_CHECK_DRYNESS);
    else if (e.type === 'checkin' && SOIL[e.soil]) checks[d] = () => SOIL[e.soil].level;
  }

  const rainOk = plant.location === 'outdoor' && plant.gets_rain !== false;
  const recentRates = [];

  const step = (date) => {
    const day = byDate[date];
    const r = dailyRate(plant, day);
    dryness += r;
    if (rainOk && day?.precip) dryness = Math.max(0, dryness - day.precip / RAIN_FULL_MM);
    if (checks[date]) dryness = checks[date](dryness);
    return r;
  };

  // Desde el día siguiente al riego hasta hoy (incluido)
  let date = addDays(start, 1);
  if (checks[start]) dryness = checks[start](dryness);
  while (date <= today) {
    recentRates.push(step(date));
    date = addDays(date, 1);
  }
  const drynessToday = dryness;

  // Previsión: ¿cuándo llegará a 1?
  let daysUntil = 0;
  if (dryness < 1) {
    let d = today;
    let sim = dryness;
    const fallback = recentRates.length
      ? recentRates.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, recentRates.length)
      : dailyRate(plant, byDate[today]);
    for (let i = 1; i <= 60 && sim < 1; i++) {
      d = addDays(d, 1);
      const day = byDate[d];
      sim += day ? dailyRate(plant, day) : fallback;
      if (rainOk && day?.precip) sim = Math.max(0, sim - day.precip / RAIN_FULL_MM);
      daysUntil = i;
    }
    if (sim < 1) daysUntil = 60;
  }

  let status;
  if (drynessToday >= 1.25) status = 'overdue';
  else if (drynessToday >= 1) status = 'due';
  else if (daysUntil <= 1) status = 'soon';
  else status = 'ok';

  return {
    dryness: drynessToday,
    status,
    daysUntil,
    nextDate: addDays(today, daysUntil),
    lastWatered: lastWater ? start : null,
    daysSinceWater: lastWater ? daysBetween(start, today) : null,
    rateToday: dailyRate(plant, byDate[today]),
  };
}

/** Ajuste aprendido cuando el usuario dice que aún estaba húmeda */
export function adjustAfterWetCheck(adjust) {
  return clamp((adjust || 1) * 0.88, 0.4, 2.5);
}
/** Ajuste aprendido cuando estaba muy seca (riego tardío marcado como "estaba seca") */
export function adjustAfterDry(adjust) {
  return clamp((adjust || 1) * 1.1, 0.4, 2.5);
}

export const STATUS_LABEL = {
  overdue: 'Necesita agua ya',
  due: 'Toca regar hoy',
  soon: 'Mañana',
  ok: 'Bien',
};

/**
 * Aprende de una revisión: compara lo que predecía el modelo con lo que dice el usuario.
 * Devuelve el nuevo factor de ajuste (o el mismo si el modelo acertaba).
 */
export function learnFromSoil(adjust, predicted, soil) {
  const target = SOIL[soil]?.level;
  if (target == null || predicted == null) return adjust || 1;
  const err = predicted - target; // >0: el modelo creía que estaba más seca de lo real
  if (soil === 'dry' && predicted >= target) return adjust || 1; // tarde, pero el modelo no se equivocaba
  if (Math.abs(err) < 0.2) return adjust || 1;
  // Corrección suave y acotada: como mucho ±15 % por revisión
  const factor = clamp(1 - err * 0.25, 0.85, 1.15);
  return clamp((adjust || 1) * factor, 0.4, 2.5);
}

/** ¿Toca pulverizar? Solo plantas que lo agradecen y cuando el aire está seco. */
/** Cada cuántos días pulverizar según la humedad (null = no hace falta) */
export function mistEvery(mist, rh) {
  if (!mist || rh >= mist.belowRh) return null;
  if (rh < mist.belowRh - 15) return 1;
  if (rh < mist.belowRh - 7) return Math.max(1, Math.ceil(mist.everyDays / 2));
  return mist.everyDays;
}

export function mistStatus(plant, events, weather, mist) {
  if (!mist || !weather) return null;
  const day = weather.days.find((d) => d.date === weather.today);
  const rh = plant.location === 'outdoor' ? day?.rh ?? 60 : indoorClimate(day || {}).rh;
  const every = mistEvery(mist, rh);
  if (!every) return { needed: false, rh };
  const last = events.filter((e) => e.type === 'mist').sort((a, b) => new Date(b.at) - new Date(a.at))[0];
  const since = last ? daysBetween(dateInTz(last.at, weather.timezone), weather.today) : Infinity;
  return { needed: true, due: since >= every, every, since, rh };
}
