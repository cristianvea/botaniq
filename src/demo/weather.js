// Tiempo simulado para la demo (valores típicos de cada mes, con algo de variación y lluvia ocasional)
const TMAX = [10, 12, 16, 18, 22, 28, 32, 31, 26, 20, 14, 10];
const TMIN = [3, 3, 6, 8, 11, 16, 19, 19, 15, 11, 6, 3];
const RH = [75, 68, 60, 58, 54, 45, 38, 40, 50, 64, 72, 76];
const ET0 = [1, 1.6, 2.6, 3.4, 4.5, 6, 6.8, 6, 4.3, 2.6, 1.4, 0.9];
const RAIN_P = [0.22, 0.2, 0.18, 0.25, 0.22, 0.1, 0.04, 0.05, 0.12, 0.25, 0.25, 0.25];

const fmt = (d) => d.toLocaleDateString('en-CA');
const rand = (s) => { const x = Math.sin(s * 9301 + 49297) * 233280; return x - Math.floor(x); };
function interp(arr, d, south) {
  const m = d.getMonth() + (d.getDate() - 15) / 30;
  const i = (Math.floor(m) + 12) % 12, j = (i + 1) % 12, t = m - Math.floor(m);
  const shift = (k) => (south ? (k + 6) % 12 : k);
  return arr[shift(i)] * (1 - t) + arr[shift(j)] * t;
}

export async function fetchWeather(lat = 40.4) {
  await new Promise((r) => setTimeout(r, 250));
  const south = lat < 0;
  const now = new Date();
  const today = fmt(now);
  const days = [];
  for (let k = -45; k < 10; k++) {
    const d = new Date(now); d.setDate(d.getDate() + k);
    const seed = Math.floor(d.getTime() / 86400000);
    const noise = (rand(seed) - 0.5) * 4;
    const raining = rand(seed + 7) < interp(RAIN_P, d, south);
    const precip = raining ? Math.round((1 + rand(seed + 3) * 12) * 10) / 10 : 0;
    const tmax = interp(TMAX, d, south) + noise - (raining ? 3 : 0);
    const tmin = interp(TMIN, d, south) + noise / 2;
    days.push({
      date: fmt(d), tmax, tmin, tmean: (tmax + tmin) / 2,
      rh: Math.min(95, interp(RH, d, south) + (raining ? 18 : 0) + noise * 2),
      precip, et0: Math.max(0.3, interp(ET0, d, south) * (raining ? 0.5 : 1)), forecast: k > 0, lat,
    });
  }
  const t = days.find((x) => x.date === today);
  const h = now.getHours() + now.getMinutes() / 60;
  const curve = Math.sin(((h - 9) / 24) * 2 * Math.PI) * 0.5 + 0.5;
  return {
    timezone: 'Europe/Madrid', today,
    current: { temp: t.tmin + (t.tmax - t.tmin) * curve, rh: t.rh + (1 - curve) * 10 },
    days,
  };
}

const PLACES = [
  ['Madrid', 'Comunidad de Madrid', 40.42, -3.7], ['Barcelona', 'Cataluña', 41.39, 2.17], ['Valencia', 'Comunidad Valenciana', 39.47, -0.38],
  ['Sevilla', 'Andalucía', 37.39, -5.98], ['Bilbao', 'País Vasco', 43.26, -2.93], ['Málaga', 'Andalucía', 36.72, -4.42],
  ['Zaragoza', 'Aragón', 41.65, -0.89], ['A Coruña', 'Galicia', 43.36, -8.41], ['Palma', 'Islas Baleares', 39.57, 2.65],
  ['Las Palmas de Gran Canaria', 'Canarias', 28.12, -15.43], ['Valladolid', 'Castilla y León', 41.65, -4.72], ['Murcia', 'Región de Murcia', 37.98, -1.13],
];
export async function searchPlaces(q) {
  const n = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return PLACES.filter(([c]) => c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(n))
    .map(([c, r, lat, lon]) => ({ name: `${c}, ${r}, España`, lat, lon }));
}
