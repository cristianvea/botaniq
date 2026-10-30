// Identificación con Pl@ntNet (https://my.plantnet.org)
// La clave debe estar "expuesta" y con tu dominio en "Authorized domains".

// trim(): un espacio o salto de línea al copiar la clave en GitHub la invalida
const KEY = (import.meta.env.VITE_PLANTNET_KEY || '').trim();
export const plantnetEnabled = Boolean(KEY);

export async function identifyPlant(blob, organ = 'auto') {
  if (!KEY) throw new Error('Falta la clave de Pl@ntNet (VITE_PLANTNET_KEY)');
  const form = new FormData();
  form.append('images', blob, 'planta.jpg');
  form.append('organs', organ);
  const url = `https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(KEY)}&lang=es&nb-results=5&include-related-images=false`;
  let res;
  try {
    res = await fetch(url, { method: 'POST', body: form });
  } catch {
    // El navegador bloquea la petición (CORS): casi siempre falta autorizar el dominio en Pl@ntNet
    throw new Error(`Pl@ntNet ha rechazado la conexión. En my.plantnet.org → Settings → API key, marca «Expose my API key» y añade «${location.hostname}» en «Authorized domains».`);
  }
  if (res.status === 404) return []; // Pl@ntNet devuelve 404 si no reconoce ninguna especie
  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => '');
    let detail = body;
    try { detail = JSON.parse(body).message || body; } catch { /* texto plano */ }
    throw new Error(`Pl@ntNet ha rechazado la petición (${res.status}: ${String(detail).slice(0, 120)}). Revisa que ${location.hostname} esté en sus dominios autorizados.`);
  }
  if (res.status === 429) throw new Error('Se ha agotado el cupo diario de identificaciones de Pl@ntNet. Prueba mañana.');
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Pl@ntNet respondió con un error (${res.status}). ${txt.slice(0, 120)}`);
  }
  const j = await res.json();
  return (j.results || []).map((r) => ({
    score: r.score,
    species: r.species.scientificNameWithoutAuthor,
    genus: r.species.genus?.scientificNameWithoutAuthor,
    family: r.species.family?.scientificNameWithoutAuthor,
    commonName: r.species.commonNames?.[0] || null,
    commonNames: r.species.commonNames || [],
  }));
}
