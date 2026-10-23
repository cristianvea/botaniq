import { supabase } from './supabase.js';
import { blobToBase64 } from './image.js';

export { ISSUE_LABELS, OVERALL, CONFIDENCE } from './diagnose-labels.js';

/** Llama a la Edge Function "ai" (OpenAI o Gemini) con la foto y el contexto de la planta */
export async function diagnosePhoto(blob, context) {
  const image = await blobToBase64(blob);
  const { data, error } = await supabase.functions.invoke('ai', { body: { task: 'diagnose', image, context } });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); msg = j.error || j.message || j.msg || msg; } catch { /* sin cuerpo */ }
    if (/not found|404/i.test(msg)) msg = 'La IA no está activada (falta desplegar la función "ai" en Supabase).';
    throw new Error(msg);
  }
  return data;
}
