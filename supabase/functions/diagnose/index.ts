// Supabase Edge Function: diagnóstico de salud de una planta a partir de una foto.
// Usa OpenAI si existe el secreto OPENAI_API_KEY; si no, Gemini (GEMINI_API_KEY).
// Las claves viven aquí como secretos, nunca en el móvil.
// Supabase comprueba el token del usuario antes de ejecutar esta función (verify_jwt).

const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-6.1-sol';
const OPENAI_EFFORT = Deno.env.get('OPENAI_REASONING') || 'medium';

const MODELS = [Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest', 'gemini-2.5-flash'];
const KEY = Deno.env.get('GEMINI_API_KEY');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ISSUES = [
  'falta_luz', 'exceso_luz', 'falta_riego', 'exceso_riego', 'humedad_baja',
  'plagas', 'hongos', 'nutrientes', 'maceta_pequena', 'frio', 'calor', 'otro',
];

const schema = {
  type: 'OBJECT',
  properties: {
    photo_ok: { type: 'BOOLEAN', description: 'false si la foto no permite ver bien la planta' },
    overall: { type: 'STRING', enum: ['good', 'mild', 'attention', 'severe'] },
    summary: { type: 'STRING', description: 'Una o dos frases para el usuario' },
    issues: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: ISSUES },
          confidence: { type: 'STRING', enum: ['low', 'medium', 'high'] },
          evidence: { type: 'STRING', description: 'Qué se ve en la foto que lo indica' },
          action: { type: 'STRING', description: 'Qué hacer, concreto' },
        },
        required: ['type', 'confidence', 'evidence', 'action'],
      },
    },
    watering: { type: 'STRING', enum: ['more_often', 'less_often', 'keep'] },
    light: { type: 'STRING', enum: ['more', 'less', 'keep'] },
    tips: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['photo_ok', 'overall', 'summary', 'issues', 'watering', 'light', 'tips'],
};

function prompt(c: Record<string, unknown>) {
  const lines = Object.entries(c)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
  return `Eres un experto en cuidado de plantas en maceta (interior y exterior) en España.
Analiza la foto de esta planta y su contexto, y diagnostica su estado.

Contexto que da la app:
${lines}

Busca en concreto:
- Falta de luz: tallos alargados y débiles, entrenudos largos, hojas pequeñas o pálidas, planta inclinada hacia la luz, pérdida de variegado.
- Exceso de luz/sol: manchas blanquecinas o marrones quemadas en las hojas más expuestas, decoloración.
- Exceso de riego: hojas amarillas y blandas (sobre todo las bajas), base o tallos negros/blandos, sustrato encharcado, moho blanco en la superficie, mosquitas.
- Falta de riego: hojas lacias o arrugadas, bordes secos y crujientes, sustrato despegado de la maceta.
- Humedad ambiental baja: puntas y bordes marrones en hojas finas (calathea, helechos, palmeras).
- Plagas: cochinilla (algodoncillos), araña roja (telillas, punteado), trips, pulgón, mosca blanca.
- Hongos, carencias de nutrientes (clorosis entre nervios), maceta pequeña (raíces saliendo), frío o calor.

Época del año (muy importante):
- Ten en cuenta la estación, las horas de luz y la fase de crecimiento esperada que indica el contexto.
- No marques como problema lo que es normal en esta época ("normal_en_esta_epoca"): reposo invernal, caída otoñal de hojas en caducifolias, fin de ciclo de anuales, crecimiento lento en otoño/invierno, ligera etiolación invernal por días cortos.
- Ajusta las recomendaciones a la estación: en otoño/invierno, menos riego y nada de abono; en primavera, trasplante y abonado; en verano, más riego y protección del sol fuerte.
- Si algo NO encaja con la época (p. ej. hojas nuevas pálidas y estiradas en pleno verano, o amarilleo masivo en primavera), dale más peso.

Reglas:
- Si el usuario ha dicho cómo está la tierra, eso pesa más que lo que parezca la foto.
- Sé honesto con la incertidumbre: usa confidence "low" si no estás seguro. No inventes problemas: si la planta se ve sana, overall "good" e issues vacío.
- "watering": more_often/less_often solo si hay señales claras; si no, "keep". Igual con "light".
- Si la foto no muestra bien la planta, photo_ok=false y explícalo en summary.
- Responde en español de España, frases cortas y prácticas. Máximo 3 tips, y al menos uno adaptado a la época del año.`;
}

// Convierte el esquema (formato Gemini) a JSON Schema estricto para OpenAI
// deno-lint-ignore no-explicit-any
function strict(node: any): any {
  const out: Record<string, unknown> = { type: String(node.type).toLowerCase() };
  if (node.enum) out.enum = node.enum;
  if (node.description) out.description = node.description;
  if (node.items) out.items = strict(node.items);
  if (node.properties) {
    out.properties = Object.fromEntries(Object.entries(node.properties).map(([k, v]) => [k, strict(v)]));
    out.required = Object.keys(node.properties);
    out.additionalProperties = false;
  }
  return out;
}

async function diagnoseOpenAI(image: string, text: string) {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      reasoning: { effort: OPENAI_EFFORT },
      store: false,
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text },
          { type: 'input_image', image_url: `data:image/jpeg;base64,${image}`, detail: 'high' },
        ],
      }],
      text: { format: { type: 'json_schema', name: 'diagnostico_planta', strict: true, schema: strict(schema) } },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error('openai', res.status, detail.slice(0, 500));
    const msg = res.status === 429 ? 'OpenAI: límite de uso o saldo agotado.' : res.status === 401 ? 'OpenAI: clave no válida.' : `OpenAI ${res.status}`;
    throw new Error(msg);
  }
  const data = await res.json();
  // deno-lint-ignore no-explicit-any
  const msg = (data.output || []).find((o: any) => o.type === 'message');
  // deno-lint-ignore no-explicit-any
  const part = msg?.content?.find((c: any) => c.type === 'output_text');
  if (!part) {
    // deno-lint-ignore no-explicit-any
    const refusal = msg?.content?.find((c: any) => c.type === 'refusal');
    throw new Error(refusal ? 'La IA no ha querido analizar esta foto' : 'Respuesta vacía de OpenAI');
  }
  return { diagnosis: JSON.parse(part.text), model: data.model || OPENAI_MODEL, usage: data.usage };
}

async function callGemini(model: string, image: string, text: string) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY! },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: image } }, { text }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2 },
    }),
  });
  return res;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

  if (!KEY && !OPENAI_KEY) return json({ error: 'Falta el secreto OPENAI_API_KEY (o GEMINI_API_KEY) en Supabase' }, 500);

  try {
    const { image, context } = await req.json();
    if (!image || typeof image !== 'string') return json({ error: 'Falta la imagen' }, 400);
    if (image.length > 4_000_000) return json({ error: 'Imagen demasiado grande' }, 413);

    const text = prompt(context || {});

    if (OPENAI_KEY) {
      try {
        const { diagnosis, model, usage } = await diagnoseOpenAI(image, text);
        console.log('openai uso', JSON.stringify(usage));
        return json({ ...diagnosis, model, at: new Date().toISOString() });
      } catch (e) {
        if (!KEY) return json({ error: (e as Error).message }, 502);
        console.error('OpenAI falló, pruebo con Gemini:', (e as Error).message);
      }
    }

    let res: Response | null = null;
    let used = '';
    for (const model of MODELS) {
      res = await callGemini(model, image, text);
      used = model;
      if (res.status !== 404) break; // modelo no disponible → probar el siguiente
    }
    if (!res!.ok) {
      const detail = await res!.text();
      const msg = res!.status === 429 ? 'Has llegado al límite gratuito de Gemini por hoy. Prueba más tarde.' : `Gemini ${res!.status}`;
      console.error(used, res!.status, detail.slice(0, 500));
      return json({ error: msg }, 502);
    }
    const data = await res!.json();
    const out = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
    const diagnosis = JSON.parse(out);
    diagnosis.model = used;
    diagnosis.at = new Date().toISOString();
    return json(diagnosis);
  } catch (e) {
    console.error(e);
    return json({ error: 'No se pudo analizar la foto' }, 500);
  }
});
