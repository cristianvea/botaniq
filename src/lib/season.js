// Época del año: estación (según hemisferio), horas de luz y qué es normal en cada tipo de planta.

const NAMES = { spring: 'Primavera', summer: 'Verano', autumn: 'Otoño', winter: 'Invierno' };

/** Horas de luz solar para una latitud y fecha (fórmula astronómica aproximada) */
export function dayLength(lat, date) {
  const d = new Date(date);
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const n = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000);
  const decl = (23.44 * Math.PI / 180) * Math.sin((2 * Math.PI * (284 + n)) / 365);
  const phi = (lat * Math.PI) / 180;
  const x = Math.min(1, Math.max(-1, -Math.tan(phi) * Math.tan(decl)));
  return (2 * Math.acos(x) * 180) / Math.PI / 15;
}

/**
 * Estación astronómica aproximada (equinoccios y solsticios ~21) en el hemisferio de `lat`.
 * Devuelve { key, name, phase: 'inicio'|'mitad'|'final', month, dayHours, trend: 'alargan'|'acortan' }
 */
export function seasonInfo(date = new Date(), lat = 40) {
  const d = new Date(date);
  const m = d.getMonth(); // 0-11
  const day = d.getDate();
  // Hemisferio norte: primavera 21 mar – 20 jun, verano 21 jun – 22 sep, otoño 23 sep – 20 dic, invierno 21 dic – 20 mar
  const doy = m * 31 + day; // orden suficiente para comparar
  let key;
  if (doy >= 2 * 31 + 21 && doy < 5 * 31 + 21) key = 'spring';
  else if (doy >= 5 * 31 + 21 && doy < 8 * 31 + 23) key = 'summer';
  else if (doy >= 8 * 31 + 23 && doy < 11 * 31 + 21) key = 'autumn';
  else key = 'winter';
  if (lat < 0) key = { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' }[key];

  // Fase dentro de la estación (cada una dura ~3 meses)
  const starts = { spring: [2, 21], summer: [5, 21], autumn: [8, 23], winter: [11, 21] };
  const north = lat < 0 ? { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' }[key] : key;
  const [sm, sd] = starts[north];
  let begin = new Date(d.getFullYear(), sm, sd);
  if (begin > d) begin = new Date(d.getFullYear() - 1, sm, sd);
  const elapsed = (d - begin) / 86400000;
  const phase = elapsed < 30 ? 'inicio' : elapsed < 61 ? 'mitad' : 'final';

  const hours = dayLength(lat, d);
  const tomorrow = dayLength(lat, new Date(d.getTime() + 86400000));
  return {
    key, name: NAMES[key], phase, month: d.toLocaleDateString('es-ES', { month: 'long' }),
    dayHours: hours, trend: tomorrow >= hours ? 'alargan' : 'acortan',
  };
}

export const fmtHours = (h) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')} min`;

// ─── Cuidados y señales normales por época ───
// care: consejo para el usuario. normal: lo que es esperable ver y NO debe tomarse como problema.
const GENERAL = {
  spring: { growth: 'activo (arranca)', care: 'Empieza a crecer: buen momento para trasplantar y volver a abonar.', normal: 'brotes y hojas nuevas más claras; necesita más agua cada semana' },
  summer: { growth: 'máximo', care: 'Máximo consumo de agua. Abona cada 2–4 semanas y evita el sol fuerte de mediodía tras un cristal.', normal: 'crecimiento rápido; la tierra se seca mucho antes' },
  autumn: { growth: 'se ralentiza', care: 'El crecimiento se frena: espacia riegos y deja de abonar a final de estación.', normal: 'crecimiento más lento; alguna hoja vieja inferior amarillea y cae' },
  winter: { growth: 'reposo', care: 'Reposo: riega lo justo, no abones y aléjala de radiadores y corrientes.', normal: 'casi no crece; brotes algo más alargados y pálidos por la poca luz' },
};

const BY_PROFILE = {
  cactus: {
    winter: { growth: 'reposo invernal', care: 'Reposo invernal: casi sin riego y en sitio fresco y luminoso. Así florecen mejor en primavera.', normal: 'aspecto algo arrugado o deslucido por la falta de riego; no crece' },
    autumn: { care: 'Ve reduciendo el riego para preparar el reposo invernal.' },
  },
  suculenta: {
    winter: { growth: 'reposo invernal (salvo aeonium, que crece en invierno)', care: 'Riega muy poco. Si se estira buscando la luz, acércala a la ventana.', normal: 'colores más apagados o verdes; algunas hojas inferiores secas' },
    summer: { care: 'Muchas (aeonium, sempervivum) se cierran en verano: riega menos si las rosetas se compactan.', normal: 'rosetas cerradas en aeonium por el calor; tonos rojizos por el sol' },
  },
  orquidea: {
    autumn: { care: 'Una bajada de unos 5 °C por la noche ayuda a que saque vara floral.', normal: 'aparición de varas florales nuevas; caída de flores viejas' },
    winter: { care: 'Temporada típica de floración: no la cambies de sitio con flores.', normal: 'floración; pérdida de alguna hoja basal vieja' },
  },
  hortensia: {
    autumn: { care: 'Las flores se secan y viran de color: puedes dejarlas hasta el final del invierno.', normal: 'flores secas o rojizas; hojas que amarillean' },
    winter: { growth: 'reposo (caducifolia)', care: 'Pierde las hojas: es normal. Riega solo para que no se seque del todo.', normal: 'sin hojas o casi; ramas desnudas' },
  },
  arbusto_exterior: {
    autumn: { normal: 'si es caducifolio, hojas que cambian de color y caen' },
    winter: { growth: 'reposo', normal: 'caducifolios sin hojas; perennes sin crecimiento' },
  },
  geranio: {
    winter: { growth: 'reposo', care: 'Reposo: poco riego. Poda a finales de invierno para que rebrote fuerte.', normal: 'pocas o ninguna flor; hojas inferiores amarillas' },
  },
  aromatica_blanda: {
    autumn: { care: 'La albahaca es anual: en otoño decae y termina su ciclo. Cosecha lo que puedas.', normal: 'albahaca espigada, con flores o decaída por el frío; menta que pierde vigor' },
    winter: { growth: 'parada', normal: 'parte aérea seca en menta; albahaca muerta (anual)' },
  },
  huerto: {
    autumn: { care: 'Fin de temporada de tomates y pimientos: es normal que la planta decaiga.', normal: 'planta envejecida, hojas bajas secas, frutos que no maduran' },
    winter: { growth: 'fuera de temporada', normal: 'plantas de verano secas o muertas' },
  },
  floracion: {
    autumn: { normal: 'fin de la floración de temporada; planta decaída si es anual' },
    winter: { normal: 'sin flores en plantas de verano; floración en ciclámenes y prímulas' },
  },
  aromatica_lenosa: {
    winter: { care: 'Aguantan bien el frío seco, no el encharcamiento: riega muy poco.', normal: 'romero florido (florece en invierno); lavanda gris y parada' },
  },
  tropical_humeda: {
    winter: { care: 'La calefacción reseca el aire: pulveriza o usa un plato con piedras y agua.', normal: 'algún borde marrón por aire seco' },
  },
  carnivora: {
    winter: { growth: 'dormancia (Dionaea y Sarracenia)', care: 'Venus atrapamoscas y sarracenias necesitan un invierno fresco: menos agua y sin alimentarlas.', normal: 'trampas que se ennegrecen y mueren; planta pequeña' },
  },
};

/** Ficha de la época para una planta: { ...seasonInfo, growth, care, normal } */
export function seasonalCare(plant, date, lat) {
  const s = seasonInfo(date, lat);
  const base = GENERAL[s.key];
  const spec = BY_PROFILE[plant.profile]?.[s.key] || {};
  const outdoorWinter = plant.location === 'outdoor' && s.key === 'winter'
    ? ' En exterior, vigila las heladas.' : '';
  return {
    ...s,
    growth: spec.growth || base.growth,
    care: (spec.care || base.care) + outdoorWinter,
    normal: [spec.normal, base.normal].filter(Boolean).join('; '),
  };
}

/** Factor de luz del día para el cálculo de riego en interior (días largos → más consumo) */
export function photoperiodFactor(lat, date) {
  if (lat == null || !date) return 1;
  const h = dayLength(lat, new Date(date + 'T12:00:00Z'));
  return Math.min(1.2, Math.max(0.8, Math.sqrt(h / 12)));
}
