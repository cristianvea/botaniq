// Etiquetas del diagnóstico (compartidas con la demo)
export const ISSUE_LABELS = {
  falta_luz: '🌑 Falta de luz',
  exceso_luz: '☀️ Exceso de sol',
  falta_riego: '🏜️ Falta de riego',
  exceso_riego: '💦 Exceso de riego',
  humedad_baja: '🌬️ Humedad ambiental baja',
  plagas: '🐛 Plagas',
  hongos: '🍄 Hongos',
  nutrientes: '🧪 Carencia de nutrientes',
  maceta_pequena: '🪴 Maceta pequeña',
  frio: '❄️ Frío',
  calor: '🌡️ Calor',
  otro: '🔍 Otro',
};

export const OVERALL = {
  good: { label: 'Se ve sana', cls: 'ok' },
  mild: { label: 'Algo leve', cls: 'soon' },
  attention: { label: 'Necesita atención', cls: 'due' },
  severe: { label: 'Problema serio', cls: 'overdue' },
};

export const CONFIDENCE = { low: 'poco seguro', medium: 'bastante seguro', high: 'muy seguro' };
