// Tiempo de Open-Meteo (gratis, sin clave). Funciona en navegador y en Node 18+.

const BASE = 'https://api.open-meteo.com/v1/forecast';

export async function fetchWeather(lat, lon, { pastDays = 45, forecastDays = 10 } = {}) {
  const url = new URL(BASE);
  url.search = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration',
    hourly: 'relative_humidity_2m',
    current: 'temperature_2m,relative_humidity_2m',
    past_days: String(pastDays),
    forecast_days: String(forecastDays),
    timezone: 'auto',
  }).toString();

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const j = await res.json();

  // Media diaria de humedad a partir de los datos horarios
  const rhByDate = {};
  j.hourly.time.forEach((t, i) => {
    const d = t.slice(0, 10);
    const v = j.hourly.relative_humidity_2m[i];
    if (v == null) return;
    (rhByDate[d] ||= []).push(v);
  });

  const today = j.current.time.slice(0, 10);
  const days = j.daily.time.map((date, i) => {
    const tmax = j.daily.temperature_2m_max[i];
    const tmin = j.daily.temperature_2m_min[i];
    const rhs = rhByDate[date] || [];
    return {
      date,
      tmax,
      tmin,
      tmean: tmax != null && tmin != null ? (tmax + tmin) / 2 : null,
      rh: rhs.length ? rhs.reduce((a, b) => a + b, 0) / rhs.length : null,
      precip: j.daily.precipitation_sum[i] ?? 0,
      et0: j.daily.et0_fao_evapotranspiration[i],
      forecast: date > today,
      lat: j.latitude,
    };
  });

  return {
    timezone: j.timezone,
    today,
    current: { temp: j.current.temperature_2m, rh: j.current.relative_humidity_2m },
    days,
  };
}

// ───────── Lugares (OpenStreetMap / Nominatim) ─────────
// Permite buscar barrios, calles o direcciones, no solo ciudades. Uso gratuito: máx. 1 petición por segundo.
const NOMINATIM = 'https://nominatim.openstreetmap.org';

function shortName(a = {}, fallback = '') {
  const street = [a.road || a.pedestrian || a.footway, a.house_number].filter(Boolean).join(' ');
  const area = a.neighbourhood || a.quarter || a.suburb || a.city_district || a.village || a.hamlet;
  const city = a.city || a.town || a.municipality || a.village || a.county;
  const parts = [street, area, city].filter(Boolean);
  const unique = parts.filter((p, i) => parts.indexOf(p) === i);
  return unique.length ? unique.join(', ') : fallback.split(',').slice(0, 3).join(',');
}

export async function searchPlaces(query) {
  const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=6&accept-language=es&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('No se pudo buscar el lugar. Prueba de nuevo en unos segundos.');
  const list = await res.json();
  return list.map((r) => ({
    name: shortName(r.address, r.display_name),
    detail: [r.address?.state, r.address?.country].filter(Boolean).join(', '),
    lat: +(+r.lat).toFixed(4),
    lon: +(+r.lon).toFixed(4),
  }));
}

export async function reversePlace(lat, lon) {
  try {
    const url = `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=16&accept-language=es&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const r = await res.json();
    return shortName(r.address, r.display_name || '');
  } catch {
    return null;
  }
}
