// Supabase Edge Function "ai": la IA de BotanIQ.
//   task "diagnose" → diagnóstico de salud a partir de una foto
//   task "chat"     → asistente que responde preguntas y propone recordatorios (abono…)
// Usa OpenAI si existe el secreto OPENAI_API_KEY; si no, Gemini (GEMINI_API_KEY).
// Las claves viven aquí como secretos, nunca en el móvil.
// Supabase comprueba el token del usuario antes de ejecutar esta función (verify_jwt).

const env = (k: string) => Deno.env.get(k) || undefined;
const OPENAI_KEY = env('OPENAI_API_KEY');
const OPENAI_MODEL = env('OPENAI_MODEL') || 'gpt-6.1-sol';
const OPENAI_EFFORT = env('OPENAI_REASONING') || 'medium';

const KEY = env('GEMINI_API_KEY');
const FLASH = [env('GEMINI_MODEL') || 'gemini-flash-latest', 'gemini-2.5-flash'];
const LITE = [env('GEMINI_MODEL_LITE') || 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'];
const PRO = [env('GEMINI_MODEL_PRO') || 'gemini-pro-latest', 'gemini-2.5-pro'];
const MODELS = FLASH;

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


// ───────────────────────── Asistente (chat) ─────────────────────────

type Tier = 'lite' | 'standard' | 'pro';

// Elige el modelo según la pregunta: rápido y barato para lo sencillo, más potente para lo difícil
function route(question: string, hasImage: boolean, turns: number): { tier: Tier; reason: string } {
  const q = question.toLowerCase();
  const complex = /(plaga|bicho|cochinilla|ara[ñn]a roja|trips|pulg[oó]n|mosquit|hongo|moho|podrid|se (me )?muere|muriendo|ra[ií]z|ra[ií]ces|trasplant|esqueje|reproduc|por qu[eé]|diagn|enferm|amarill|manchas|qu[eé] le pasa|se cae|se caen|marchit)/.test(q);
  const plan = /(abono|abonar|fertiliz|plan\b|calendario|program|rutina|recu[eé]rd|av[ií]s|recordatorio|dosis|c[oó]mo (lo |la )?uso)/.test(q);
  if (hasImage && complex) return { tier: 'pro', reason: 'Foto y posible problema: modelo más potente' };
  if (complex && (q.length > 160 || turns > 4)) return { tier: 'pro', reason: 'Problema complejo: modelo más potente' };
  if (hasImage || complex || plan || q.length > 220) return { tier: 'standard', reason: hasImage ? 'Hay que mirar la foto' : plan ? 'Hay que preparar un plan' : 'Hay que razonar un poco' };
  return { tier: 'lite', reason: 'Pregunta sencilla: modelo rápido' };
}

const chatSchema = {
  type: 'OBJECT',
  properties: {
    answer: { type: 'STRING', description: 'Respuesta para el usuario, en español de España' },
    reminder: {
      type: 'OBJECT',
      description: 'Recordatorio que propones añadir a los avisos (propose=false si no procede)',
      properties: {
        propose: { type: 'BOOLEAN' },
        title: { type: 'STRING', description: 'Muy corto, p. ej. "Abono líquido"' },
        note: { type: 'STRING', description: 'Cómo hacerlo, p. ej. "5 ml por litro en el agua de riego"' },
        mode: { type: 'STRING', enum: ['with_watering', 'every_days'] },
        every: { type: 'INTEGER', description: 'Cada N riegos (with_watering) o cada N días (every_days)' },
        months: { type: 'ARRAY', items: { type: 'INTEGER' }, description: 'Meses (1-12) en los que aplica; vacío = todo el año' },
        plant_ids: { type: 'ARRAY', items: { type: 'STRING' }, description: 'ids de las plantas del contexto' },
      },
      required: ['propose', 'title', 'note', 'mode', 'every', 'months', 'plant_ids'],
    },
    suggestions: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Hasta 3 preguntas cortas de seguimiento' },
  },
  required: ['answer', 'reminder', 'suggestions'],
};

function chatSystem(context: string) {
  return `Te llamas Florencio y eres el botánico de confianza del usuario dentro de BotanIQ, una app para cuidar plantas en casa (España).
Tu carácter: un experto entrañable y amable, con la sabiduría tranquila de quien lleva toda la vida entre macetas. Tuteas, transmites cariño por las plantas y das confianza ("tranquilo, esto tiene arreglo"). Puedes usar alguna expresión cálida de vez en cuando, sin empalagar ni exagerar, y sin emojis salvo alguno muy ocasional (🌱).
Preséntate ("Soy Florencio, tu botánico de confianza") solo si te saludan, te preguntan quién eres o es el primer mensaje de la conversación; si no, ve directo a la respuesta.
Respondes en español de España, claro y práctico. Ve al grano: normalmente 2–6 frases o una lista corta con guiones. Sin títulos ni negritas. La calidez nunca resta precisión: las dosis, fechas y pasos, concretos.

Esto es lo que sabe la app (úsalo, no lo vuelvas a preguntar):
${context}

Cómo responder:
- Basa la respuesta en la planta concreta, su ubicación, su luz, su maceta, la época del año y el tiempo.
- Si preguntan por la luz, compara lo que necesita su tipo de planta con la luz que tiene registrada y con lo que se ve en la foto si la hay.
- Si mandan una foto de un producto ("tengo este abono", "he comprado esto"):
  1. Identifícalo primero y dilo en una frase: marca si se ve, y sobre todo el TIPO. Abonos: líquido mineral (NPK), granulado o de liberación lenta, específico (cactus, orquídeas, acidófilas, verde), orgánico comercial (humus de lombriz, guano, estiércol), o casero (compost, restos de comida, posos de café, cáscaras de huevo, piel de plátano, agua de cocer). Si no es abono (insecticida, fungicida, sustrato, vitaminas…), dilo.
  2. Lee de la etiqueta lo que se vea: NPK, dosis, frecuencia, para qué plantas. Si la foto no deja leerlo bien o dudas del tipo, dilo y pide otra foto más cerca de la etiqueta trasera.
  3. Di si le conviene a esta planta (p. ej. abono de acidófilas para un brezo sí; para un cactus, uno bajo en nitrógeno) y cómo usarlo: dosis concreta (en interior, la mitad de la etiqueta), cada cuánto y en qué meses.
  4. Abono casero o restos de comida: sé claro y amable. Los restos crudos sobre la maceta no alimentan a corto plazo y en interior dan moho, mosquitas y olores; mejor compostarlos antes o usar humus de lombriz. Posos de café: poca cantidad, secos y mezclados, nunca en capa. Cáscara de huevo: aporta calcio muy despacio, molida.
- Si dicen "tengo este abono" sin foto, pide amablemente una foto de la etiqueta (o el nombre y el NPK) antes de dar dosis.
- Si preguntan qué abono usar, recomienda el TIPO adecuado a la planta y a la época (no marcas), y explica cómo reconocerlo en la tienda (NPK aproximado, "para plantas verdes", "para acidófilas"…).
- No inventes dosis: si no sabes la del producto, da una pauta general prudente (mitad de la dosis de la etiqueta en interior) y pide una foto de la etiqueta.
- En otoño e invierno, por lo general, no se abona (salvo plantas en floración o con crecimiento activo): dilo si aplica.
- Si no sabes algo o falta información, dilo y explica cómo averiguarlo.

Recordatorios:
- Si el usuario quiere un plan o una rutina periódica (abonar, girar la maceta, limpiar hojas, tratar una plaga cada X días…), rellena "reminder" con propose=true y termina la respuesta preguntando si quiere que lo añada a sus avisos de riego. La app le mostrará los botones.
- mode "with_watering" para lo que se hace al regar (abono líquido en el agua de riego), con every = cada cuántos riegos. mode "every_days" para lo demás, con every = cada cuántos días.
- months: los meses en que aplica (abonado típico en España: 3–9 para interior, 3–10 exterior). Vacío si es todo el año.
- plant_ids: solo ids que aparezcan en el contexto. Si habla de una planta concreta, esa. Si no está claro, la planta en la que está la conversación.
- No propongas un recordatorio igual a uno que ya exista. Si no procede, propose=false y el resto con valores vacíos (every 1).
- suggestions: hasta 3 preguntas de seguimiento útiles y cortas (máx. 6 palabras), o ninguna.`;
}

// deno-lint-ignore no-explicit-any
async function geminiChat(models: string[], system: string, contents: any[]) {
  let last = '';
  for (const model of models) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY! },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { responseMimeType: 'application/json', responseSchema: chatSchema, temperature: 0.4 },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const out = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
      return { ...JSON.parse(out), model };
    }
    last = `${model} ${res.status}`;
    console.error('gemini', model, res.status, (await res.text()).slice(0, 300));
    // Modelo no disponible, sin cupo o saturado → probamos el siguiente
    if (![404, 429, 500, 503].includes(res.status)) break;
  }
  throw new Error(last.endsWith('429') ? 'Has llegado al límite gratuito de Gemini por hoy. Prueba más tarde.' : `Gemini: ${last}`);
}

// deno-lint-ignore no-explicit-any
async function openaiChat(effort: string, system: string, input: any[]) {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: OPENAI_MODEL, reasoning: { effort }, store: false, instructions: system, input,
      text: { format: { type: 'json_schema', name: 'respuesta_asistente', strict: true, schema: strict(chatSchema) } },
    }),
  });
  if (!res.ok) {
    console.error('openai', res.status, (await res.text()).slice(0, 300));
    throw new Error(res.status === 429 ? 'OpenAI: límite de uso o saldo agotado.' : `OpenAI ${res.status}`);
  }
  const data = await res.json();
  // deno-lint-ignore no-explicit-any
  const msg = (data.output || []).find((o: any) => o.type === 'message');
  // deno-lint-ignore no-explicit-any
  const part = msg?.content?.find((c: any) => c.type === 'output_text');
  if (!part) throw new Error('Respuesta vacía de OpenAI');
  return { ...JSON.parse(part.text), model: `${data.model || OPENAI_MODEL} (${effort})` };
}

// deno-lint-ignore no-explicit-any
async function chat(body: any) {
  const messages: { role: string; content: string }[] = (body.messages || []).slice(-12)
    .filter((m: { content?: string }) => m.content && typeof m.content === 'string')
    .map((m: { role: string; content: string }) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content.slice(0, 4000) }));
  if (!messages.length || messages[messages.length - 1].role !== 'user') throw new Error('Falta la pregunta');
  const image: string | null = typeof body.image === 'string' && body.image.length < 4_000_000 ? body.image : null;
  const question = messages[messages.length - 1].content;
  const { tier, reason } = route(question, !!image, messages.length);
  const system = chatSystem(String(body.context || '').slice(0, 12000));

  let out;
  if (OPENAI_KEY) {
    const effort = { lite: env('OPENAI_EFFORT_LITE') || 'low', standard: OPENAI_EFFORT, pro: env('OPENAI_EFFORT_PRO') || 'high' }[tier];
    const input = messages.map((m, i) => ({
      role: m.role,
      content: m.role === 'user' && i === messages.length - 1 && image
        ? [{ type: 'input_text', text: m.content }, { type: 'input_image', image_url: `data:image/jpeg;base64,${image}`, detail: 'high' }]
        : m.content,
    }));
    try {
      out = await openaiChat(effort, system, input);
    } catch (e) {
      if (!KEY) throw e;
      console.error('OpenAI falló, pruebo con Gemini:', (e as Error).message);
    }
  }
  if (!out) {
    const models = tier === 'lite' ? [...LITE, ...FLASH] : tier === 'pro' ? [...PRO, ...FLASH] : FLASH;
    const contents = messages.map((m, i) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: m.role === 'user' && i === messages.length - 1 && image
        ? [{ inline_data: { mime_type: 'image/jpeg', data: image } }, { text: m.content }]
        : [{ text: m.content }],
    }));
    out = await geminiChat(models, system, contents);
  }
  const r = out.reminder;
  return {
    answer: out.answer,
    reminder: r?.propose && r.plant_ids?.length ? { title: r.title, note: r.note, mode: r.mode, every: Math.max(1, r.every || 1), months: r.months || [], plant_ids: r.plant_ids } : null,
    suggestions: (out.suggestions || []).slice(0, 3),
    model: out.model, tier, reason,
  };
}

// deno-lint-ignore no-explicit-any
async function diagnose(body: any) {
  const { image, context } = body;
  if (!image || typeof image !== 'string') throw new HttpError(400, 'Falta la imagen');
  if (image.length > 4_000_000) throw new HttpError(413, 'Imagen demasiado grande');
  const text = prompt(context || {});

  if (OPENAI_KEY) {
    try {
      const { diagnosis, model, usage } = await diagnoseOpenAI(image, text);
      console.log('openai uso', JSON.stringify(usage));
      return { ...diagnosis, model, at: new Date().toISOString() };
    } catch (e) {
      if (!KEY) throw new HttpError(502, (e as Error).message);
      console.error('OpenAI falló, pruebo con Gemini:', (e as Error).message);
    }
  }

  let res: Response | null = null;
  let used = '';
  for (const model of MODELS) {
    res = await callGemini(model, image, text);
    used = model;
    if (![404, 503].includes(res.status)) break; // modelo no disponible → probar el siguiente
  }
  if (!res!.ok) {
    const detail = await res!.text();
    console.error(used, res!.status, detail.slice(0, 500));
    throw new HttpError(502, res!.status === 429 ? 'Has llegado al límite gratuito de Gemini por hoy. Prueba más tarde.' : `Gemini ${res!.status}`);
  }
  const data = await res!.json();
  const out = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
  const diagnosis = JSON.parse(out);
  diagnosis.model = used;
  diagnosis.at = new Date().toISOString();
  return diagnosis;
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

  if (!KEY && !OPENAI_KEY) return json({ error: 'Falta el secreto GEMINI_API_KEY (u OPENAI_API_KEY) en Supabase' }, 500);

  try {
    const body = await req.json();
    if (body.task === 'chat') return json(await chat(body));
    return json(await diagnose(body)); // por defecto, diagnóstico
  } catch (e) {
    console.error(e);
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    return json({ error: (e as Error).message || 'No se pudo completar la petición' }, 502);
  }
});
