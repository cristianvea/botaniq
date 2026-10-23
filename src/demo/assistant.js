// Asistente simulado para la demo: respuestas de ejemplo según la pregunta
export { buildContext, TIER_LABEL } from '../lib/assistant.js';

export async function askAssistant({ messages, context, image }) {
  await new Promise((r) => setTimeout(r, 1200));
  const q = messages[messages.length - 1].content.toLowerCase();
  const focus = /\[id ([^\]]+)\]/.exec(context.split('La conversación es sobre:')[1] || context)?.[1];
  if (/abono|fertiliz/.test(q) && image) {
    return {
      answer: 'Por la etiqueta, es un abono líquido mineral para plantas verdes, NPK 7-3-6: rico en nitrógeno, bueno para hojas. A tu planta le viene bien.\n\nEn interior usa la mitad de lo que pone: unos 2,5 ml (media tapa) por litro de agua, cada dos riegos y solo de marzo a septiembre. Ahora en otoño, mejor guardarlo hasta primavera.\n\n¿Quieres que lo añada a tus avisos de riego?',
      reminder: { title: 'Abono líquido verde', note: '2,5 ml por litro en el agua de riego', mode: 'with_watering', every: 2, months: [3, 4, 5, 6, 7, 8, 9], plant_ids: focus ? [focus] : [] },
      suggestions: ['¿Y si se me pasa la dosis?', '¿Vale para el cactus?'],
      model: 'demo · gemini-flash', tier: 'standard', reason: 'Hay que mirar la foto',
    };
  }
  if (/abono|fertiliz/.test(q)) {
    return {
      answer: 'Buena idea, a esta época le viene bien saberlo. Con un abono líquido universal, en interior usa la mitad de la dosis de la etiqueta (normalmente unos 2–3 ml por litro) y échalo con el agua de riego cada dos riegos, de marzo a septiembre. Ahora en otoño mejor parar: la planta crece poco y el abono se acumula en la tierra.\n\n¿Quieres que lo añada a tus avisos de riego para que te acuerdes?',
      reminder: { title: 'Abono líquido', note: '2–3 ml por litro en el agua de riego', mode: 'with_watering', every: 2, months: [3, 4, 5, 6, 7, 8, 9], plant_ids: focus ? [focus] : [] },
      suggestions: ['¿Y si es abono en bolitas?', '¿Cuándo la trasplanto?'],
      model: 'demo · gemini-flash', tier: 'standard', reason: 'Hay que preparar un plan',
    };
  }
  if (/luz|sol|ventana/.test(q) || image) {
    return {
      answer: 'Tranquilo, que tiene buena pinta. Por lo que tienes registrado está con luz indirecta brillante, que es lo que necesita. Señales de que le falta luz: tallos que se estiran hacia la ventana, hojas nuevas más pequeñas o que pierden el dibujo. En otoño los días se acortan, así que si la notas estirada acércala un poco a la ventana, sin sol directo de mediodía.',
      reminder: null,
      suggestions: ['¿Cada cuánto la giro?', '¿Le pongo luz artificial?'],
      model: 'demo · gemini-flash', tier: image ? 'standard' : 'lite', reason: image ? 'Hay que mirar la foto' : 'Pregunta sencilla: modelo rápido',
    };
  }
  return {
    answer: '¡Hola! Soy Florencio, tu botánico de confianza. En la demo solo sé responder a un par de ejemplos. Prueba con «Tengo este abono, ¿cómo lo uso?» o «¿Crees que necesita más luz?».',
    reminder: null, suggestions: ['Tengo un abono líquido, ¿cómo lo uso?', '¿Necesita más luz?'],
    model: 'demo', tier: 'lite', reason: 'Pregunta sencilla: modelo rápido',
  };
}
