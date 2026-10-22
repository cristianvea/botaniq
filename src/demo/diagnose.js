// Diagnóstico simulado para la demo, coherente con lo que indica el usuario y la época
export { ISSUE_LABELS, OVERALL, CONFIDENCE } from '../lib/diagnose-labels.js';

export async function diagnosePhoto(_blob, ctx) {
  await new Promise((r) => setTimeout(r, 1800));
  const tierra = (ctx.tierra_segun_usuario || '').toLowerCase();
  const otono = /otoño/i.test(ctx.estacion || '');
  const invierno = /invierno/i.test(ctx.estacion || '');
  const sinDrenaje = /SIN agujeros/.test(ctx.maceta || '');
  const issues = [];
  let watering = 'keep';
  if (tierra.includes('encharcada') || sinDrenaje) {
    issues.push({ type: 'exceso_riego', confidence: 'medium', evidence: 'Hojas bajas amarillentas y algo blandas; el sustrato se ve oscuro y compacto.', action: 'Deja secar más entre riegos y vacía el plato o cubremacetas.' });
    watering = 'less_often';
  } else if (tierra.includes('seca del todo')) {
    issues.push({ type: 'falta_riego', confidence: 'medium', evidence: 'Hojas algo lacias y bordes ligeramente secos.', action: 'Riega a fondo hoy y revísala de nuevo en unos días.' });
    watering = 'more_often';
  }
  if (/sombra|poca luz/i.test(ctx.luz || '')) {
    issues.push({ type: 'falta_luz', confidence: 'low', evidence: 'Entrenudos algo largos y hojas nuevas más pequeñas.', action: 'Acércala a una ventana luminosa, sin sol directo en las horas centrales.' });
  }
  const overall = issues.length === 0 ? 'good' : issues.some((i) => i.confidence === 'medium') ? 'attention' : 'mild';
  const summary = issues.length === 0
    ? `Se ve sana y con buen color.${otono ? ' Crecer más despacio en otoño es normal.' : invierno ? ' En invierno es normal que apenas crezca.' : ''}`
    : `Aspecto general correcto, con ${issues.length === 1 ? 'un punto' : 'algunos puntos'} a vigilar.`;
  const tips = [
    otono ? 'En otoño crece menos: espacia los riegos y deja de abonar a final de estación.'
      : invierno ? 'En invierno, riega lo justo y aléjala de radiadores.'
        : 'Es buena época para abonar cada 2–4 semanas.',
    'Gira la maceta cada semana para que crezca recta.',
  ];
  return { photo_ok: true, overall, summary, issues, watering, light: issues.some((i) => i.type === 'falta_luz') ? 'more' : 'keep', tips, model: 'demo', at: new Date().toISOString() };
}
