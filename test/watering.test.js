import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStatus, dailyRate } from '../src/lib/watering.js';
import { profileForTaxon } from '../src/lib/profiles.js';

function weather({ tmean = 20, rh = 50, et0 = 3, precip = 0, today = '2026-07-15' } = {}) {
  const days = [];
  for (let i = -30; i <= 10; i++) {
    const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    days.push({ date, tmax: tmean + 5, tmin: tmean - 5, tmean, rh, precip: typeof precip === 'function' ? precip(i) : precip, et0, forecast: i > 0 });
  }
  return { timezone: 'Europe/Madrid', today, days };
}
const base = { profile: 'tropical', location: 'indoor', light: 'indirect', substrate: 'unknown', pot: 'medium', pot_material: 'plastic', adjust: 1, created_at: '2026-06-01T10:00:00Z' };
const watered = (daysAgo, today = '2026-07-15') => { const d = new Date(today + 'T10:00:00Z'); d.setUTCDate(d.getUTCDate() - daysAgo); return [{ type: 'water', at: d.toISOString() }]; };

test('tropical en condiciones de referencia ≈ 8 días', () => {
  const w = weather({ tmean: 21, rh: 50 });
  // dentro de casa con 21 fuera → 21 dentro, HR 45 → algo más seco que ref
  const r = dailyRate(base, w.days[30]);
  const days = 1 / r;
  assert.ok(days > 6 && days < 9.5, `intervalo ${days}`);
});

test('recién regada está bien; tras muchos días toca regar', () => {
  const w = weather();
  assert.equal(computeStatus(base, watered(1), w).status, 'ok');
  assert.ok(['due', 'overdue'].includes(computeStatus(base, watered(12), w).status));
});

test('cactus aguanta mucho más que un helecho', () => {
  const w = weather();
  const c = computeStatus({ ...base, profile: 'cactus' }, watered(0), w);
  const h = computeStatus({ ...base, profile: 'tropical_humeda' }, watered(0), w);
  assert.ok(c.daysUntil > h.daysUntil * 2.5, `${c.daysUntil} vs ${h.daysUntil}`);
});

test('exterior en verano caluroso se seca rápido y la lluvia resetea', () => {
  const hot = weather({ tmean: 30, rh: 25, et0: 7 });
  const out = { ...base, location: 'outdoor', light: 'direct', gets_rain: true };
  const s = computeStatus(out, watered(4), hot);
  assert.ok(s.status === 'due' || s.status === 'overdue', s.status);
  const rainy = weather({ tmean: 30, rh: 25, et0: 7, precip: (i) => (i === 0 ? 15 : 0) });
  assert.equal(computeStatus(out, watered(4), rainy).status, 'ok');
  assert.ok(['due', 'overdue'].includes(computeStatus({ ...out, gets_rain: false }, watered(4), rainy).status));
});

test('"aún húmeda" pospone', () => {
  const w = weather();
  const ev = [...watered(10), { type: 'check_wet', at: '2026-07-15T09:00:00Z' }];
  assert.notEqual(computeStatus(base, ev, w).status, 'due');
});

test('mapeo Pl@ntNet', () => {
  assert.equal(profileForTaxon({ genus: 'Monstera' }), 'tropical');
  assert.equal(profileForTaxon({ genus: 'Dracaena' }), 'resistente');
  assert.equal(profileForTaxon({ genus: 'Xyz', family: 'Cactaceae' }), 'cactus');
  assert.equal(profileForTaxon({ genus: 'Xyz' }), 'generica');
});

import { learnFromSoil, mistStatus } from '../src/lib/watering.js';
import { wateringGuide, contextTips, MIST } from '../src/lib/care.js';

test('revisión "seca del todo" pone la planta en regar; "húmeda" la aplaza', () => {
  const w = weather();
  const dry = [...watered(2), { type: 'checkin', soil: 'dry', at: '2026-07-15T09:00:00Z' }];
  assert.ok(['due', 'overdue'].includes(computeStatus(base, dry, w).status));
  const moist = [...watered(12), { type: 'checkin', soil: 'moist', at: '2026-07-15T09:00:00Z' }];
  assert.equal(computeStatus(base, moist, w).status, 'ok');
});

test('una revisión anterior al riego no cuenta', () => {
  const w = weather();
  const ev = [{ type: 'checkin', soil: 'dry', at: '2026-07-15T08:00:00Z' }, { type: 'water', at: '2026-07-15T08:30:00Z' }];
  assert.equal(computeStatus(base, ev, w).status, 'ok');
});

test('aprendizaje desde la tierra', () => {
  assert.ok(learnFromSoil(1, 1.0, 'moist') < 1);   // creía seca, estaba húmeda → más lento
  assert.ok(learnFromSoil(1, 0.4, 'dry') > 1);     // creía húmeda, estaba seca → más rápido
  assert.equal(learnFromSoil(1, 0.55, 'moist'), 1); // acierto
  assert.equal(learnFromSoil(1, 1.4, 'dry'), 1);    // se regó tarde: no penaliza
  assert.ok(learnFromSoil(1, 3, 'wet') >= 0.75);    // corrección acotada
});

test('pulverizar solo con aire seco y si toca', () => {
  const dryAir = weather({ tmean: 8, rh: 40 }); // calefacción → aire seco
  const humid = weather({ tmean: 22, rh: 95 });
  const cal = { ...base, profile: 'tropical_humeda' };
  assert.equal(mistStatus(cal, [], dryAir, MIST.tropical_humeda).due, true);
  assert.equal(mistStatus(cal, [], humid, MIST.tropical_humeda).needed, false);
  assert.equal(mistStatus({ ...base, profile: 'cactus' }, [], dryAir, MIST.cactus), null);
  const misted = [{ type: 'mist', at: '2026-07-15T08:00:00Z' }];
  assert.equal(mistStatus(cal, misted, dryAir, MIST.tropical_humeda).due, false);
});

test('guía de riego y consejos', () => {
  assert.match(wateringGuide({ ...base, profile: 'orquidea' }).method, /^Inmersión/);
  assert.match(wateringGuide({ ...base, pot: 'large' }).amountText, /L/);
  const hot = weather({ tmean: 30, rh: 25, et0: 7 });
  hot.days.forEach((d) => (d.tmax = 36));
  const tips = contextTips({ ...base, location: 'outdoor' }, hot);
  assert.ok(tips.some((t) => t.icon === '🌡️'));
});

import { seasonInfo, dayLength, seasonalCare, photoperiodFactor } from '../src/lib/season.js';

test('estación según fecha y hemisferio', () => {
  assert.equal(seasonInfo(new Date('2026-10-22T12:00:00'), 40.4).key, 'autumn');
  assert.equal(seasonInfo(new Date('2026-10-22T12:00:00'), -34.6).key, 'spring'); // Buenos Aires
  assert.equal(seasonInfo(new Date('2026-01-15T12:00:00'), 40.4).key, 'winter');
  assert.equal(seasonInfo(new Date('2026-07-01T12:00:00'), 40.4).key, 'summer');
  assert.equal(seasonInfo(new Date('2026-04-01T12:00:00'), 40.4).key, 'spring');
  assert.equal(seasonInfo(new Date('2026-10-22T12:00:00'), 40.4).trend, 'acortan');
});

test('horas de luz en Madrid', () => {
  const jun = dayLength(40.4, new Date('2026-06-21T12:00:00Z'));
  const dic = dayLength(40.4, new Date('2026-12-21T12:00:00Z'));
  assert.ok(jun > 14.8 && jun < 15.4, `junio ${jun}`);
  assert.ok(dic > 9.0 && dic < 9.6, `diciembre ${dic}`);
  assert.ok(photoperiodFactor(40.4, '2026-06-21') > 1 && photoperiodFactor(40.4, '2026-12-21') < 1);
});

test('cuidados de temporada por tipo', () => {
  const w = seasonalCare({ profile: 'cactus', location: 'indoor' }, new Date('2026-01-10T12:00:00'), 40);
  assert.match(w.growth, /reposo/);
  const a = seasonalCare({ profile: 'aromatica_blanda', location: 'outdoor' }, new Date('2026-10-22T12:00:00'), 40);
  assert.match(a.normal, /albahaca/);
});

test('maceta sin drenaje: se seca más despacio, menos agua y aviso', () => {
  const w = weather();
  const drained = dailyRate(base, w.days[30]);
  const closed = dailyRate({ ...base, pot_drainage: false }, w.days[30]);
  assert.ok(closed < drained);
  assert.ok(wateringGuide({ ...base, pot_drainage: false }).why.some((t) => /sin agujeros/.test(t)));
  assert.match(wateringGuide({ ...base, pot_drainage: false }).amountText, /ml/);
});

test('modo de riego: nunca inmersión en maceta grande ni sin agujeros', () => {
  const w = weather();
  const dry = { status: 'overdue', dryness: 1.3 };
  const acid = { ...base, profile: 'hortensia', substrate: 'acida' };
  assert.match(wateringGuide({ ...acid, pot: 'medium' }, { weather: w, status: dry }).today.title, /Inmersión 10/);
  assert.match(wateringGuide({ ...acid, pot: 'large' }, { weather: w, status: dry }).today.title, /pasadas/);
  assert.equal(wateringGuide({ ...acid, pot: 'medium', pot_drainage: false }, { weather: w, status: dry }).today, null);
  // Sin prisa: modo normal por encima y, aparte, qué hacer si se seca del todo
  const calm = wateringGuide({ ...acid, pot: 'medium' }, { weather: w, status: { status: 'ok', dryness: 0.5 } });
  assert.equal(calm.today, null);
  assert.equal(calm.title, 'Por encima del sustrato');
  assert.match(calm.ifDry, /sumérgela/);
  assert.equal(wateringGuide({ ...base, profile: 'orquidea', pot: 'large' }).tech, 'top');
});

test('consejos del tiempo referidos al día de riego', () => {
  const w = weather({ tmean: 20 });
  w.days.forEach((d) => (d.tmax = 22));
  const later = w.days.find((d) => d.date > w.today);
  later.tmax = 34;
  const st = { status: 'ok', daysUntil: 1, nextDate: later.date };
  const tips = contextTips({ ...base, location: 'outdoor' }, w, st);
  assert.ok(tips.some((t) => /^Mañana, día de riego, llegará a 34°/.test(t.text)));
  // Si el calor no cae en su día de riego, no se avisa
  assert.ok(!contextTips({ ...base, location: 'outdoor' }, w, { status: 'ok', daysUntil: 0, nextDate: w.today }).some((t) => t.icon === '🌡️'));
});

import { reminderStatus, cadenceText, reminderWhen } from '../src/lib/reminders.js';

test('recordatorios con el riego y por días', () => {
  const now = new Date('2026-05-10T12:00:00Z');
  const r = { plant_id: 'p', mode: 'with_watering', every: 2, months: [3, 4, 5, 6, 7, 8, 9], created_at: '2026-05-01T00:00:00Z', last_done_at: null };
  // Nunca hecho → toca en el próximo riego
  assert.equal(reminderStatus(r, [], now).due, true);
  // Hecho ayer: el siguiente riego no, el de después sí
  const done = { ...r, last_done_at: '2026-05-09T10:00:00Z' };
  assert.equal(reminderStatus(done, [], now).due, false);
  assert.equal(reminderWhen(reminderStatus(done, [], now)), 'En 2 riegos');
  const watered = [{ plant_id: 'p', type: 'water', at: '2026-05-09T18:00:00Z' }];
  assert.equal(reminderStatus(done, watered, now).due, true);
  // Fuera de temporada
  assert.equal(reminderStatus(r, [], new Date('2026-11-10T12:00:00Z')).off, true);
  assert.equal(cadenceText(r), 'Cada 2 riegos · mar–sep');
  const d = { plant_id: 'p', mode: 'every_days', every: 14, months: [], created_at: '2026-05-01T00:00:00Z', last_done_at: '2026-05-05T10:00:00Z' };
  assert.equal(reminderWhen(reminderStatus(d, [], now)), 'En 9 días');
});

import { householdSummary, buildNotification } from '../src/lib/notifyText.js';

test('un solo aviso con todas las plantas', () => {
  const casa = householdSummary({ house: 'Casa', due: [{ name: 'Monstera', zone: 'Salón' }, { name: 'Potos', zone: 'Salón' }, { name: 'Romero', zone: 'Terraza' }], mist: ['Calathea'] });
  const n = buildNotification([casa]);
  assert.equal(n.title, '💧 Toca regar 3 plantas y pulverizar');
  assert.match(n.body, /Salón: Monstera, Potos · Terraza: Romero/);
  assert.match(n.body, /Pulverizar: Calathea/);
  const pueblo = householdSummary({ house: 'Pueblo', due: [{ name: 'Geranio', zone: 'Balcón' }] });
  const two = buildNotification([casa, pueblo, null]);
  assert.equal(two.title, '💧 Toca regar 4 plantas y pulverizar');
  assert.match(two.body, /^Casa\n/);
  assert.match(two.body, /Pueblo\n💧 Balcón: Geranio/);
  assert.equal(buildNotification([null]), null);
});

test('intervalos realistas: no hacer esperar de más', () => {
  const autumn = { date: '2026-10-25', tmean: 15, rh: 65, et0: 2.2, lat: 40.4 };
  const winter = { date: '2026-01-15', tmean: 7, rh: 75, et0: 1, lat: 40.4 };
  const days = (p, d) => 1 / dailyRate({ location: 'indoor', substrate: 'unknown', pot_material: 'plastic', pot: 'medium', light: 'indirect', ...p }, d);
  const brezo = days({ profile: 'hortensia', light: 'direct' }, autumn);
  assert.ok(brezo >= 2 && brezo <= 4, `brezo ${brezo}`);
  assert.ok(days({ profile: 'tropical' }, autumn) <= 9, 'monstera en otoño');
  assert.ok(days({ profile: 'tropical' }, winter) <= 12, 'monstera en invierno');
  assert.ok(days({ profile: 'tropical_humeda' }, autumn) <= 5, 'calathea en otoño');
});


test('flor de pascua no es una crasa', () => {
  assert.equal(profileForTaxon({ species: 'Euphorbia pulcherrima Willd. ex Klotzsch', genus: 'Euphorbia', family: 'Euphorbiaceae' }), 'flor_interior');
  assert.equal(profileForTaxon({ species: 'Euphorbia milii', genus: 'Euphorbia' }), 'suculenta');
  const d = 1 / dailyRate({ profile: 'flor_interior', location: 'indoor', light: 'indirect', pot: 'medium', pot_material: 'plastic', substrate: 'unknown' }, { date: '2026-12-15', tmean: 7, rh: 75, lat: 40.4 });
  assert.ok(d >= 2 && d <= 3.5, `pascua ${d}`);
  // Frecuencia fijada por el usuario: manda sobre el cálculo
  assert.equal(1 / dailyRate({ profile: "cactus", fixed_days: 2 }, { tmean: 5 }), 2);
});

test('calefacción en invierno y reposo de las crasas', () => {
  const jan = { date: '2027-01-15', tmean: 6, rh: 75, lat: 40.4 };
  const oct = { date: '2026-10-25', tmean: 15, rh: 65, lat: 40.4 };
  const days = (p, d) => 1 / dailyRate({ location: 'indoor', substrate: 'unknown', pot_material: 'plastic', pot: 'medium', light: 'indirect', ...p }, d);
  // Con calefacción, una tropical no se espacia más en enero que en octubre
  assert.ok(days({ profile: 'tropical' }, jan) <= days({ profile: 'tropical' }, oct) + 0.5);
  // El cactus, en cambio, descansa en invierno
  assert.ok(days({ profile: 'cactus', light: 'direct' }, jan) > 1.6 * days({ profile: 'cactus', light: 'direct' }, oct));
});

import { learnFromEarlyWatering } from '../src/lib/watering.js';
test('aprende cuando riegas antes de lo previsto', () => {
  assert.ok(learnFromEarlyWatering({ adjust: 1 }, { lastWatered: '2026-10-01', dryness: 0.6 }) > 1);
  assert.equal(learnFromEarlyWatering({ adjust: 1 }, { lastWatered: '2026-10-01', dryness: 0.95 }), null); // a su hora
  assert.equal(learnFromEarlyWatering({ adjust: 1, fixed_days: 3 }, { lastWatered: '2026-10-01', dryness: 0.6 }), null);
  assert.equal(learnFromEarlyWatering({ adjust: 1 }, { lastWatered: null, dryness: 0.6 }), null);
});

test('rutina propia: fija o adaptada a la estación', async () => {
  const { routineDays, seasonRatio, dailyRate } = await import('../src/lib/watering.js');
  const fixed = { profile: 'tropical', location: 'indoor', light: 'indirect', fixed_days: 4 };
  assert.equal(routineDays(fixed, 7), 4);
  const seasonal = { ...fixed, fixed_seasonal: true, fixed_month: 10 };
  assert.equal(routineDays(seasonal, 10), 4);
  assert.ok(routineDays(seasonal, 7) < 4, 'en verano, más a menudo');
  const out = { ...seasonal, location: 'outdoor', profile: 'generica' };
  assert.ok(routineDays(out, 1) > 5 && routineDays(out, 7) < 3);
  // Hemisferio sur: el verano es enero
  assert.ok(routineDays(out, 1, -34) < 3);
  // dailyRate usa el mes del día y la rutina
  assert.equal(dailyRate(fixed, { date: '2026-07-10', tmean: 30 }), 1 / 4);
  assert.ok(Math.abs(dailyRate(seasonal, { date: '2026-07-10', lat: 40 }) - seasonRatio(seasonal, 7, 10, 40) / 4) < 1e-9);
  // Sin mes de referencia: no cambia
  assert.equal(routineDays({ ...fixed, fixed_seasonal: true }, 7), 4);
});
