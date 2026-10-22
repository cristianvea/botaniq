import { supabase } from './supabase.js';

export { ISSUE_LABELS, OVERALL, CONFIDENCE } from './diagnose-labels.js';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** Llama a la Edge Function "diagnose" (OpenAI o Gemini) con la foto y el contexto de la planta */
export async function diagnosePhoto(blob, context) {
  const image = await blobToBase64(blob);
  const { data, error } = await supabase.functions.invoke('diagnose', { body: { image, context } });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch { /* sin cuerpo */ }
    if (/not found|404/i.test(msg)) msg = 'El diagnóstico no está activado (falta desplegar la función "diagnose" en Supabase).';
    throw new Error(msg);
  }
  return data;
}
