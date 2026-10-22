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

// Búsqueda de ciudades (geocoding de Open-Meteo)
export async function searchPlaces(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=6&language=es&name=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('No se pudo buscar la ciudad');
  const j = await res.json();
  return (j.results || []).map((r) => ({
    name: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
  }));
}
