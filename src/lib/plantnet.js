// Identificación con Pl@ntNet (https://my.plantnet.org)
// La clave debe estar "expuesta" y con tu dominio en "Authorized domains".

const KEY = import.meta.env.VITE_PLANTNET_KEY;
export const plantnetEnabled = Boolean(KEY);

export async function identifyPlant(blob, organ = 'auto') {
  if (!KEY) throw new Error('Falta la clave de Pl@ntNet (VITE_PLANTNET_KEY)');
  const form = new FormData();
  form.append('images', blob, 'planta.jpg');
  form.append('organs', organ);
  const url = `https://my-api.plantnet.org/v2/identify/all?api-key=${KEY}&lang=es&nb-results=5&include-related-images=false`;
  const res = await fetch(url, { method: 'POST', body: form });
  if (res.status === 404) return []; // Pl@ntNet devuelve 404 si no reconoce ninguna especie
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Pl@ntNet ${res.status}: ${txt.slice(0, 140)}`);
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
