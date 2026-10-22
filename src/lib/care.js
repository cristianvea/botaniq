// Recomendaciones de riego y cuidados: fijas por tipo de planta + según el tiempo y la zona.
import { PROFILES, substrateFor } from './profiles.js';
import { indoorClimate } from './watering.js';

// Cómo regar cada tipo de planta
export const WATERING = {
  cactus: {
    method: 'A fondo por encima',
    short: 'A fondo y escurrir; nunca agua en el plato',
    how: 'Riega por encima del sustrato hasta que salga agua por los agujeros, espera 10 minutos y vacía el plato. Nada de riegos pequeños frecuentes.',
    amount: 0.6,
  },
  suculenta: {
    method: 'A fondo por encima',
    short: 'A fondo y escurrir; sin mojar las rosetas',
    how: 'Riega directamente sobre el sustrato, sin mojar las hojas ni el centro de las rosetas (se pudren). Deja escurrir y vacía el plato.',
    amount: 0.6,
  },
  resistente: {
    method: 'Por encima, poca cantidad',
    short: 'Poca agua, sin encharcar',
    how: 'Riega por encima del sustrato con moderación. Que nunca quede agua en el cubremacetas: el exceso pudre los rizomas.',
    amount: 0.6,
  },
  tropical: {
    method: 'Por encima, sin encharcar',
    short: 'Por encima hasta que escurra; vaciar el plato',
    how: 'Riega por encima del sustrato poco a poco hasta que empiece a salir por abajo. A los 15 minutos vacía el plato o cubremacetas.',
    amount: 1,
  },
  tropical_humeda: {
    method: 'Por encima con agua sin cal',
    short: 'Agua sin cal, suave y sin encharcar',
    how: 'Usa agua sin cal (filtrada, de lluvia o reposada 24 h) a temperatura ambiente. Riega poco a poco por encima para que el sustrato quede húmedo, nunca encharcado.',
    amount: 0.9,
    soft: true,
  },
  ficus: {
    method: 'Por encima, sin encharcar',
    short: 'Por encima y vaciar el plato',
    how: 'Riega por encima de forma uniforme hasta que escurra. Vacía el plato: el ficus pierde hojas si tiene las raíces encharcadas.',
    amount: 1,
  },
  palmera: {
    method: 'Por encima, abundante',
    short: 'Riego abundante, sin dejar agua en el plato',
    how: 'Riego abundante por encima. Si las puntas se ponen marrones, usa agua con menos cal y aumenta la humedad ambiental.',
    amount: 1,
  },
  orquidea: {
    method: 'Inmersión',
    short: 'Sumergir 10 min y escurrir bien',
    how: 'Mete la maceta en un recipiente con agua a temperatura ambiente durante 10 minutos. Sácala, déjala escurrir del todo y no dejes agua en el cubremacetas. No mojes el centro de las hojas.',
    amount: null,
    soft: true,
  },
  floracion: {
    method: 'Por encima, sin mojar flores',
    short: 'Al pie de la planta, sin mojar flores',
    how: 'Riega al pie de la planta, sin mojar flores ni hojas para evitar hongos. En plena floración, no dejes que se seque del todo.',
    amount: 1,
  },
  geranio: {
    method: 'Al pie, sin mojar hojas',
    short: 'Al pie de la planta, sin mojar hojas',
    how: 'Riega al pie, sin mojar hojas ni flores. Mejor quedarse corto que pasarse: los tallos se pudren con exceso de agua.',
    amount: 0.9,
  },
  aromatica_lenosa: {
    method: 'A fondo y espaciado',
    short: 'A fondo y espaciado; odia el encharcamiento',
    how: 'Riega a fondo y espera a que el sustrato se seque bien antes del siguiente riego. Nunca dejes agua en el plato.',
    amount: 0.9,
  },
  aromatica_blanda: {
    method: 'Por encima, frecuente',
    short: 'Riego frecuente, temprano por la mañana',
    how: 'Riega por encima, preferiblemente por la mañana temprano. Que el sustrato no llegue a secarse del todo.',
    amount: 0.8,
  },
  huerto: {
    method: 'Al pie, regular',
    short: 'Al pie, sin mojar hojas, a horas fijas',
    how: 'Riega al pie de la planta, sin mojar las hojas (evita hongos como el mildiu), siempre a la misma hora: temprano o al atardecer.',
    amount: 1.3,
  },
  arbusto_exterior: {
    method: 'A fondo al pie',
    short: 'A fondo al pie de la planta',
    how: 'Riega a fondo al pie de la planta hasta que salga por los agujeros. En verano, temprano o al atardecer.',
    amount: 1.2,
  },
  hortensia: {
    method: 'Abundante con agua sin cal',
    short: 'Abundante, con agua sin cal',
    how: 'Riego abundante con agua sin cal (de lluvia o reposada). Con agua calcárea las hojas amarillean (clorosis férrica).',
    amount: 1.3,
    soft: true,
  },
  carnivora: {
    method: 'Por bandeja',
    short: 'Bandeja con 1–2 cm de agua destilada',
    how: 'Deja la maceta en una bandeja con 1–2 cm de agua destilada, osmotizada o de lluvia. Nunca uses agua del grifo ni abono.',
    amount: null,
    soft: true,
  },
  tillandsia: {
    method: 'Inmersión',
    short: 'Remojar 20–30 min y secar boca abajo',
    how: 'Sumérgela 20–30 minutos en agua sin cal, sacúdela y déjala secar boca abajo en un sitio ventilado (menos de 4 h mojada).',
    amount: null,
    soft: true,
  },
  bonsai: {
    method: 'Por encima en dos pasadas',
    short: 'Dos pasadas con regadera de alcachofa fina',
    how: 'Riega con regadera de alcachofa fina en dos pasadas: una para humedecer y otra a los pocos minutos hasta que escurra.',
    amount: 0.5,
  },
  generica: {
    method: 'Por encima, sin encharcar',
    short: 'Por encima y vaciar el plato',
    how: 'Riega por encima del sustrato hasta que empiece a escurrir y vacía el plato a los 15 minutos.',
    amount: 1,
  },
};

// Pulverizar: cada cuántos días y por debajo de qué humedad del aire
export const MIST = {
  tropical_humeda: { everyDays: 2, belowRh: 60 },
  orquidea: { everyDays: 3, belowRh: 50 },
  tillandsia: { everyDays: 3, belowRh: 70 },
  palmera: { everyDays: 4, belowRh: 45 },
  tropical: { everyDays: 4, belowRh: 40 },
};

const POT_LITERS = { small: [0.1, 0.2], medium: [0.3, 0.6], large: [1, 2] };

function amountText(plant, w) {
  if (w.amount == null) return null;
  const noDrain = plant.pot_drainage === false ? 0.4 : 1; // sin drenaje: mucha menos agua
  const [a, b] = (POT_LITERS[plant.pot] || POT_LITERS.medium).map((x) => x * w.amount * noDrain);
  const ml = (x) => Math.max(50, Math.round((x * 1000) / 50) * 50);
  const l = (x) => (Math.round(x * 2) / 2).toString().replace('.', ',');
  if (b < 1) return `${ml(a)}–${ml(b)} ml`;
  if (a >= 1) return `${l(a)}–${l(b)} L`;
  return `${ml(a)} ml–${l(b)} L`;
}

/** Ficha de riego de la planta (lo que no depende del tiempo). */
export function wateringGuide(plant) {
  const w = WATERING[plant.profile] || WATERING.generica;
  const p = PROFILES[plant.profile] || PROFILES.generica;
  return { ...w, amountText: amountText(plant, w), mist: MIST[plant.profile] || null, tip: p.tip };
}

/** Consejos según el tiempo de hoy y los próximos días. Devuelve [{icon, text}] */
export function contextTips(plant, weather) {
  const tips = [];
  const w = WATERING[plant.profile] || WATERING.generica;
  const mist = MIST[plant.profile];
  const sub = substrateFor(plant);
  const day = weather?.days.find((d) => d.date === weather.today);
  const next3 = weather?.days.filter((d) => d.date > weather.today).slice(0, 3) || [];
  const outdoor = plant.location === 'outdoor';

  if (plant.pot_drainage === false) {
    tips.push({ icon: '⚠️', text: 'Maceta sin agujeros: riega poca cantidad, nunca «hasta que escurra», y vigila que no quede agua en el fondo. Si puedes, pásala a una maceta con drenaje.' });
  }
  if (w.soft) tips.push({ icon: '🚰', text: 'Usa agua sin cal: de lluvia, filtrada o reposada 24 h.' });

  if (day) {
    if (outdoor) {
      if (day.tmax >= 30) tips.push({ icon: '🌡️', text: `Hoy llega a ${Math.round(day.tmax)}°: riega temprano o al atardecer, nunca a pleno sol.` });
      const frost = [day, ...next3].find((d) => d.tmin <= 2);
      if (frost) tips.push({ icon: '❄️', text: `Se esperan ${Math.round(frost.tmin)}° de mínima: no riegues al anochecer y protégela del frío.` });
      const rain = next3.reduce((a, d) => a + (d.precip || 0), 0);
      if (plant.gets_rain !== false && rain >= 5) tips.push({ icon: '🌧️', text: `Se esperan ${Math.round(rain)} mm de lluvia en 3 días: si no está muy seca, puedes esperar.` });
      if (plant.gets_rain !== false && day.precip >= 15) tips.push({ icon: '🪣', text: 'Ha llovido mucho: revisa que el plato no tenga agua acumulada.' });
    } else {
      const { rh } = indoorClimate(day);
      if (mist && rh < mist.belowRh) {
        tips.push({ icon: '💦', text: `El aire de casa estará sobre el ${Math.round(rh)} %: pulveriza las hojas cada ${mist.everyDays} días (con agua sin cal) o pon la maceta sobre un plato con piedras y agua.` });
      }
      if ((day.tmean ?? 20) < 12) {
        tips.push({ icon: '🔥', text: 'Con la calefacción encendida, aléjala de radiadores y corrientes de aire caliente.' });
        if (['cactus', 'suculenta', 'resistente'].includes(plant.profile)) {
          tips.push({ icon: '😴', text: 'Está en reposo invernal: riega muy poco y solo con el sustrato totalmente seco.' });
        }
      }
    }
  }
  if (plant.pot_material === 'terracotta') tips.push({ icon: '🏺', text: 'El barro transpira: se seca antes, sobre todo en verano.' });
  if (sub === 'turba' || sub === 'acida') tips.push({ icon: '🧽', text: 'Si la turba se seca del todo repele el agua: rehidrátala por inmersión unos minutos.' });
  return tips;
}
