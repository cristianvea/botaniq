// Recomendaciones de riego y cuidados: fijas por tipo de planta + según el tiempo y la zona.
import { PROFILES, substrateFor } from './profiles.js';
import { indoorClimate, mistEvery } from './watering.js';

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
    how: 'Riega por encima del sustrato con moderación, hasta que empiece a escurrir. Que nunca quede agua en el cubremacetas: el exceso pudre los rizomas.',
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
    short: 'Hasta que escurra y vaciar el plato',
    how: 'Riega por encima de forma uniforme hasta que escurra. Vacía el plato: el ficus pierde hojas si tiene las raíces encharcadas.',
    amount: 1,
  },
  palmera: {
    method: 'Por encima, abundante',
    short: 'Riego abundante, sin dejar agua en el plato',
    how: 'Riega por encima de forma abundante, repartiendo el agua por toda la superficie hasta que salga por los agujeros, y vacía el plato. Si las puntas se ponen marrones, usa agua con menos cal y aumenta la humedad ambiental.',
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
    how: 'Riega por encima a fondo, hasta que salga por los agujeros, y espera a que el sustrato se seque bien antes del siguiente riego. Nunca dejes agua en el plato.',
    amount: 0.9,
  },
  aromatica_blanda: {
    method: 'Por encima, frecuente',
    short: 'Riego frecuente, temprano por la mañana',
    how: 'Riega por encima, poco a poco, hasta que empiece a escurrir, preferiblemente por la mañana temprano. Que el sustrato no llegue a secarse del todo.',
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
    short: 'A fondo, hasta que salga por los agujeros',
    how: 'Riega a fondo al pie de la planta hasta que salga por los agujeros. En verano, temprano o al atardecer.',
    amount: 1.2,
  },
  hortensia: {
    method: 'Abundante con agua sin cal',
    short: 'Abundante, con agua sin cal',
    how: 'Riega por encima, despacio y en abundancia, hasta que salga agua por los agujeros; a los 15 minutos vacía el plato. Usa agua sin cal (de lluvia o reposada): con agua calcárea las hojas amarillean (clorosis férrica).',
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
    short: 'Hasta que escurra y vaciar el plato',
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

const SOAK_MIN = { small: 5, medium: 10 };
const NO_MIST = ['cactus', 'suculenta', 'resistente', 'aromatica_lenosa', 'geranio'];
const BOTTOM_OK = ['floracion', 'geranio', 'suculenta', 'tropical_humeda', 'aromatica_blanda'];

function lastSoil(events = []) {
  const c = events.filter((e) => e.type === 'checkin' && e.soil).sort((a, b) => new Date(b.at) - new Date(a.at))[0];
  const w = events.filter((e) => e.type === 'water').sort((a, b) => new Date(b.at) - new Date(a.at))[0];
  if (!c || (w && new Date(w.at) > new Date(c.at))) return null; // la revisión es anterior al último riego
  return c.soil;
}

const TECH = {
  top: 'Por encima del sustrato',
  base: 'Al pie de la planta',
  soak: 'Inmersión',
  tray: 'Por abajo, en bandeja',
};
// Técnica habitual de cada tipo (lo demás de WATERING son matices)
const TECH_OF = {
  floracion: 'base', geranio: 'base', huerto: 'base', arbusto_exterior: 'base',
  orquidea: 'soak', tillandsia: 'soak', carnivora: 'tray',
};

/**
 * Recomendación de riego de esta planta:
 *  - normal: cómo regarla habitualmente (técnica + matices), según tipo, maceta, drenaje y sustrato
 *  - today: si hoy conviene otra cosa (p. ej. está muy seca → inmersión)
 *  - ifDry: qué hacer si alguna vez se seca del todo
 *  y además cantidad, agua, cuándo y pulverizado.
 */
export function wateringGuide(plant, { weather = null, status = null, events = [] } = {}) {
  const base = WATERING[plant.profile] || WATERING.generica;
  const prof = PROFILES[plant.profile] || PROFILES.generica;
  const size = plant.pot || 'medium';
  const drains = plant.pot_drainage !== false;
  const outdoor = plant.location === 'outdoor';
  const sub = substrateFor(plant);
  const peat = sub === 'turba' || sub === 'acida';
  const terracotta = plant.pot_material === 'terracotta';
  const soil = lastSoil(events);
  const dueNow = ['due', 'overdue'].includes(status?.status);
  const veryDry = (status?.dryness ?? 0) >= 1.15 || soil === 'dry';
  const canSoak = drains && size !== 'large';
  const day = weather?.days.find((d) => d.date === weather.today);
  const noCal = base.soft ? ' sin cal' : '';

  // ── Modo normal ──
  let tech = TECH_OF[plant.profile] || (outdoor ? 'base' : 'top');
  let title = TECH[tech];
  let detail = base.short;
  let how = base.how;
  let amount = base.amount;
  let alt = null;
  const why = [];

  if (plant.profile === 'tillandsia') {
    title = 'Inmersión 20–30 minutos';
  } else if (plant.profile === 'orquidea') {
    if (canSoak) {
      title = 'Inmersión 10 minutos';
      detail = 'Sumergir y escurrir bien';
      why.push('Maceta con agujeros y de tamaño manejable: la inmersión empapa bien la corteza sin encharcar.');
    } else {
      tech = 'top'; title = TECH.top; amount = 0.5;
      detail = 'Despacio sobre la corteza; escurrir bien';
      how = 'Vierte agua sin cal despacio sobre la corteza hasta que empiece a salir por abajo y deja que escurra del todo. No mojes el centro de las hojas.';
      why.push(drains ? 'Maceta grande: sumergirla no es práctico.' : 'Sin agujeros no se puede sumergir: el agua se quedaría dentro y pudriría las raíces.');
    }
  } else if (plant.profile === 'carnivora') {
    if (!canSoak) {
      tech = 'top'; title = TECH.top; amount = 0.8;
      detail = 'Agua destilada o de lluvia; que nunca se seque';
      how = 'Riega por encima con agua destilada, osmotizada o de lluvia hasta que el sustrato quede bien húmedo. Que nunca llegue a secarse.';
      why.push(drains ? 'Maceta grande: la bandeja no llega a humedecer todo el sustrato.' : 'Sin agujeros la bandeja no sirve: el agua no puede subir.');
    }
  } else if (!drains) {
    tech = 'top'; title = TECH.top;
    detail = 'Poca agua, solo humedecer';
    how = `Riega despacio por encima, solo hasta humedecer el sustrato, sin que se acumule agua en el fondo.${base.soft ? ' Usa agua sin cal.' : ''} Antes del siguiente riego, comprueba con el dedo que la tierra se ha secado.`;
    why.push('Maceta sin agujeros: nada de inmersión ni plato, y poca cantidad porque el agua sobrante no tiene salida.');
  } else {
    if (size === 'large') {
      why.push(outdoor
        ? 'Fuera y en maceta grande: al pie, despacio, hasta que salga por los agujeros.'
        : 'Maceta grande: sumergirla no es práctico; reparte el agua por toda la superficie, no solo junto al tallo.');
    } else if (size === 'small') {
      why.push('Maceta pequeña: se seca rápido y admite poca agua; riega hasta que escurra y no más.');
    }
    if (canSoak && BOTTOM_OK.includes(plant.profile) && !outdoor) {
      alt = 'También puedes regarla por abajo: 15–20 min en un plato con 2–3 cm de agua y tira lo que sobre. Así no mojas hojas ni flores.';
    }
  }

  // ── Hoy, si conviene otra cosa ──
  let today = null;
  if (dueNow && veryDry && drains && !['orquidea', 'tillandsia', 'carnivora'].includes(plant.profile)) {
    const reason = soil === 'dry' ? 'En la última revisión la tierra estaba seca del todo' : 'Lleva tiempo sin regar y el sustrato estará muy seco';
    if (canSoak && (peat || terracotta || size === 'small')) {
      const min = SOAK_MIN[size];
      today = {
        title: `Inmersión ${min} minutos`,
        how: `Mete la maceta en un barreño con agua${noCal} a temperatura ambiente, sin que cubra el sustrato, durante ${min} minutos (hasta que dejen de salir burbujas). Sácala, déjala escurrir y no dejes agua en el plato.`,
        why: `${reason}: ${peat ? 'la turba seca repele el agua y por encima resbalaría por los lados sin empapar' : terracotta ? 'el barro seco absorbe el agua antes que la tierra' : 'sumergida se empapa todo el cepellón de forma uniforme'}.`,
        short: `Hoy: sumergir ${min} min`,
      };
    } else if (size === 'large') {
      today = {
        title: 'Por encima, en dos o tres pasadas',
        how: 'Riega despacio por toda la superficie, espera 3–4 minutos y repite hasta que salga por los agujeros.',
        why: `${reason}: si echas todo de golpe, el agua se escapa por los bordes sin empapar el centro.`,
        short: 'Hoy: en 2–3 pasadas',
      };
    }
  }

  // ── Si alguna vez se seca del todo ──
  let ifDry = null;
  if (!today && drains && !['orquidea', 'tillandsia', 'carnivora', 'cactus', 'suculenta'].includes(plant.profile)) {
    if (peat) ifDry = canSoak
      ? `Si alguna vez se seca del todo, la turba repele el agua: ese día sumérgela ${SOAK_MIN[size]} minutos en vez de regar por encima.`
      : 'Si alguna vez se seca del todo, la turba repele el agua: ese día riega en dos o tres pasadas lentas.';
    else if (terracotta && canSoak) ifDry = `Si alguna vez se seca del todo, el barro absorbe el agua antes que la tierra: ese día mejor inmersión ${SOAK_MIN[size]} minutos.`;
    else if (size === 'large') ifDry = 'Si alguna vez se seca del todo, riega en dos o tres pasadas lentas para que el agua no se escape por los bordes.';
  }

  // ── Pulverizar ──
  const mistCfg = MIST[plant.profile] || null;
  let mistAdvice = null;
  if (NO_MIST.includes(plant.profile)) {
    mistAdvice = { title: 'No la pulverices', sub: 'El agua en las hojas favorece la podredumbre en este tipo de planta.' };
  } else if (mistCfg && day) {
    const rh = outdoor ? day.rh ?? 60 : indoorClimate(day).rh;
    const every = mistEvery(mistCfg, rh);
    mistAdvice = every
      ? { title: every === 1 ? 'Pulverizar una vez al día' : `Pulverizar cada ${every} días`, sub: `Humedad del aire ~${Math.round(rh)} %${every === 1 ? ', muy seca para ella' : ''}. Por la mañana, con agua sin cal, para que las hojas se sequen antes de la noche.`, every }
      : { title: 'Ahora no hace falta pulverizar', sub: `Humedad del aire ~${Math.round(rh)} %: suficiente.` };
  } else if (plant.profile === 'floracion' || plant.profile === 'hortensia') {
    mistAdvice = { title: 'No pulverices las flores', sub: 'Se manchan y aparecen hongos. Si el aire está seco, mejor un plato con piedras y agua debajo, sin que lo toque.' };
  }

  // ── Cuándo ──
  let when = 'Por la mañana, con agua a temperatura ambiente.';
  if (outdoor && day) {
    if (day.tmax >= 25) when = 'Temprano por la mañana o al atardecer, nunca a pleno sol.';
    else if ((day.tmean ?? 15) < 10) when = 'A media mañana, cuando ya ha subido la temperatura; nunca al anochecer si hay riesgo de helada.';
  }

  // Que el matiz no repita la técnica del título ("Por encima hasta que escurra" → "Hasta que escurra")
  detail = detail.replace(/^(por encima|al pie de la planta|al pie)\b[,;]?\s*(y\s+)?/i, '');
  detail = detail.charAt(0).toUpperCase() + detail.slice(1);

  const noAmount = tech === 'soak' || tech === 'tray';
  return {
    tech, title, detail, how: how.replace(/\s+/g, ' ').trim(), why, alt, today, ifDry,
    method: title, kind: today ? (today.title.startsWith('Inmersión') ? 'soak' : tech) : tech,
    short: today ? today.short : tech === 'top' || tech === 'base' ? `${tech === 'top' ? 'Por encima' : 'Al pie'} · ${detail.charAt(0).toLowerCase()}${detail.slice(1)}` : detail,
    amountText: noAmount ? null : amountText(plant, { ...base, amount }),
    mist: mistCfg, mistAdvice, when, soft: !!base.soft,
    water: base.soft ? 'Sin cal: de lluvia, filtrada o reposada 24 h.' : null, tip: prof.tip,
  };
}

const WEEKDAY = (iso) => new Date(iso + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long' });

/**
 * Avisos según el tiempo, referidos al próximo día de riego (no a hoy si aún faltan días).
 * Devuelve [{icon, text}]
 */
export function contextTips(plant, weather, status = null) {
  const tips = [];
  if (!weather) return tips;
  const mist = MIST[plant.profile];
  const days = weather.days.filter((d) => d.date >= weather.today);
  const day = days[0];
  const outdoor = plant.location === 'outdoor';
  const dueNow = ['due', 'overdue'].includes(status?.status);
  const wDate = dueNow || !status ? weather.today : status.nextDate;
  const wDay = days.find((d) => d.date === wDate);
  const when = wDate === weather.today ? 'Hoy' : status?.daysUntil === 1 ? 'Mañana' : `El ${WEEKDAY(wDate)}`;

  if (outdoor) {
    if (wDay && wDay.tmax >= 30) {
      tips.push({ icon: '🌡️', text: `${when}${wDate === weather.today ? '' : ', día de riego,'} llegará a ${Math.round(wDay.tmax)}°: riega temprano o al atardecer, nunca a pleno sol.` });
    }
    const frost = days.slice(0, 4).find((d) => d.tmin <= 2);
    if (frost) {
      const fWhen = frost.date === weather.today ? 'hoy' : `el ${WEEKDAY(frost.date)}`;
      tips.push({ icon: '❄️', text: `Se esperan ${Math.round(frost.tmin)}° de mínima ${fWhen}: protégela del frío${frost.date === wDate ? ' y ese día no riegues al anochecer' : ''}.` });
    }
    if (plant.gets_rain !== false) {
      const until = days.filter((d) => d.date > weather.today && d.date <= (dueNow ? days[Math.min(3, days.length - 1)]?.date : wDate));
      const rain = until.reduce((a, d) => a + (d.precip || 0), 0);
      if (rain >= 5) {
        tips.push({ icon: '🌧️', text: dueNow
          ? `Se esperan ${Math.round(rain)} mm de lluvia en los próximos días: si la tierra no está muy seca, puedes esperar a que llueva.`
          : `Se esperan ${Math.round(rain)} mm de lluvia antes del riego ${when === 'Mañana' ? 'de mañana' : `del ${WEEKDAY(wDate)}`}: revisa la tierra ese día, puede que no haga falta.` });
      }
      if (day && day.precip >= 15) tips.push({ icon: '🪣', text: 'Hoy ha llovido mucho: revisa que el plato no tenga agua acumulada.' });
    }
  } else if (day) {
    const { rh } = indoorClimate(day);
    if (mist && rh < mist.belowRh) {
      tips.push({ icon: '💦', text: `El aire de casa estará sobre el ${Math.round(rh)} %: además de pulverizar, ayuda poner la maceta sobre un plato con piedras y agua (sin que la toque).` });
    }
    if ((day.tmean ?? 20) < 12) {
      tips.push({ icon: '🔥', text: 'Con la calefacción encendida, aléjala de radiadores y corrientes de aire caliente.' });
      if (['cactus', 'suculenta', 'resistente'].includes(plant.profile)) {
        tips.push({ icon: '😴', text: 'Está en reposo invernal: riega muy poco y solo con el sustrato totalmente seco.' });
      }
    }
  }
  return tips;
}
