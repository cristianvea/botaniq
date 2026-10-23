# BotanIQ

App web instalable (PWA) para saber qué plantas regar. Haces una foto, Pl@ntNet identifica la planta y la app calcula cuándo necesita agua según el tipo de planta, si está dentro o fuera, la luz, el sustrato, la maceta y el tiempo real de tu zona (Open-Meteo). Cada mañana te avisa con una notificación.

Antes de regar puedes hacer una **revisión**: una foto y cómo está la tierra. Con eso, la app afina sus cálculos y la IA (OpenAI o Gemini) diagnostica problemas como falta de luz, exceso o falta de riego, plagas, etc. Cada planta tiene también sus **recomendaciones de riego** (inmersión, por encima, por bandeja, pulverizar…), que se adaptan al tiempo que hace.

Todo funciona con planes gratuitos (GitHub Pages + GitHub Actions, Supabase, Pl@ntNet, Open-Meteo y Gemini), salvo el diagnóstico con OpenAI, que es opcional y cuesta unos céntimos por foto.

---

## Puesta en marcha (unos 20 minutos)

### 1. Supabase (cuentas, datos y fotos)

1. Crea una cuenta en <https://supabase.com> y un proyecto nuevo (plan Free y región Europa).
2. Ve a **SQL Editor → New query**, pega el contenido de `supabase/schema.sql` y pulsa **Run**.
3. En **Authentication → Sign In / Providers → Email**:
   - Déjalo activado.
   - Si quieres que tus amigos entren sin confirmar el email, desactiva **Confirm email**. Es lo más cómodo, porque el correo gratuito de Supabase permite muy pocos envíos por hora.
4. En **Authentication → URL Configuration**, pon como *Site URL* `https://TU_USUARIO.github.io/botaniq/`.
5. En **Project Settings → API**, apunta estos tres valores:
   - `Project URL`
   - `anon public` key
   - `service_role` key (es secreta y solo va a GitHub)

### 2. Pl@ntNet (identificación de plantas)

1. Regístrate en <https://my.plantnet.org>. El plan gratuito da unas 500 identificaciones al día.
2. En **Settings → API key**:
   - Copia la clave.
   - Marca **Expose my API key**.
   - En **Authorized domains** añade `TU_USUARIO.github.io`. Si vas a probar en local, añade también `localhost`.

### 3. IA para el diagnóstico por foto (OpenAI o Gemini)

La función usa **OpenAI** si encuentra su clave y, si no, **Gemini**. Si configuras las dos, Gemini actúa de respaldo cuando OpenAI falla.

**Opción recomendada: OpenAI `gpt-6.1-sol`.** Tiene muy buena visión y razonamiento, y cuesta unos 2–4 céntimos por foto.

1. En <https://platform.openai.com/api-keys> crea una clave.
2. En **Billing → Limits** pon un límite mensual, por ejemplo 5 $, para que el gasto nunca se dispare.

**Alternativa gratuita: Gemini.** Crea una clave en <https://aistudio.google.com/apikey>. En el plan gratuito, Google puede usar las fotos para mejorar sus productos.

**Desplegar la función (en ambos casos):**

1. En Supabase, ve a **Edge Functions → Deploy a new function → Via editor**:
   - Llámala exactamente `ai` (la usan el diagnóstico por foto y el asistente «Preguntar»).
   - Borra el código de ejemplo y pega el contenido de `supabase/functions/ai/index.ts`.
   - Pulsa **Deploy**.
2. En **Edge Functions → Secrets**, añade los secretos:

   | Secreto | Valor |
   |---|---|
   | `OPENAI_API_KEY` | tu clave de OpenAI |
   | `OPENAI_MODEL` | *(opcional)* por defecto `gpt-6.1-sol`. `gpt-6-astra` es lo máximo (unas 5 veces más caro) y `gpt-6-luna` el más barato |
   | `OPENAI_REASONING` | *(opcional)* `low`, `medium` (por defecto) o `high` |
   | `GEMINI_API_KEY` | *(opcional)* clave de Gemini, como alternativa o respaldo |
   | `GEMINI_MODEL`, `GEMINI_MODEL_LITE`, `GEMINI_MODEL_PRO` | *(opcional)* modelos de Gemini para preguntas normales, sencillas y complejas |
   | `OPENAI_EFFORT_LITE`, `OPENAI_EFFORT_PRO` | *(opcional)* razonamiento de OpenAI para preguntas sencillas (`low`) y complejas (`high`) |

El asistente elige el modelo según la pregunta: uno rápido para lo sencillo, el estándar si hay foto o hay que preparar un plan, y el más potente para problemas complejos (plagas, hojas amarillas con foto…). Si el potente no está disponible o no queda cupo, usa el estándar.

Las claves nunca llegan al móvil: la app envía la foto a tu función de Supabase, que solo responde a usuarios que han iniciado sesión. Con OpenAI, las peticiones se hacen con `store: false` para que no se guarden en tu cuenta.

### 4. Claves para las notificaciones (VAPID)

En una terminal con Node instalado, dentro de la carpeta del proyecto:

```bash
npx web-push generate-vapid-keys
```

Guarda la *Public Key* y la *Private Key*.

### 5. GitHub (alojamiento y avisos diarios)

1. Crea un repositorio **público** llamado `botaniq`. Pages gratis exige que sea público; tus claves quedan protegidas como *secrets*.
2. Sube este proyecto al repositorio:

   ```bash
   git init && git add . && git commit -m "BotanIQ"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/botaniq.git
   git push -u origin main
   ```

3. En **Settings → Pages → Source**, elige **GitHub Actions**.
4. En **Settings → Secrets and variables → Actions → New repository secret**, crea estos secretos:

   | Secret | Valor |
   |---|---|
   | `SUPABASE_URL` | Project URL |
   | `SUPABASE_ANON_KEY` | anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
   | `PLANTNET_KEY` | clave de Pl@ntNet |
   | `VAPID_PUBLIC_KEY` | Public Key de VAPID |
   | `VAPID_PRIVATE_KEY` | Private Key de VAPID |
   | `VAPID_SUBJECT` | `mailto:tu@email.com` |

5. En **Actions → Publicar app → Run workflow**, lánzalo. Si creaste los secretos después del primer push, esta ejecución es la que publica la app con ellos. Tras un minuto la app estará en `https://TU_USUARIO.github.io/botaniq/`.

### 6. Instalarla en el móvil

- **iPhone (iOS 16.4 o posterior)**: ábrela en **Safari** y pulsa **Compartir → Añadir a pantalla de inicio**. Ábrela desde el icono y ve a **Ajustes → Activar avisos**. En iPhone las notificaciones solo funcionan con la app instalada.
- **Android**: ábrela en Chrome, pulsa **Instalar app** y luego ve a **Ajustes → Activar avisos**.

Para compartir con amigos, mándales el enlace. Cada uno crea su propia casa, o se une a la tuya con el código de invitación que aparece en **Ajustes**.

**Zonas**: cada casa se divide en zonas con nombre (salón, comedor, terraza…), y cada zona es interior, exterior o exterior bajo techo. Las plantas de una zona heredan ese tipo; si cambias una zona (por ejemplo, cubres la terraza), se actualizan todas sus plantas. La luz sigue siendo de cada planta, porque dentro del mismo salón una puede estar junto a la ventana y otra en una esquina. Las zonas se crean al dar de alta una planta o desde **Ajustes → Zonas**.

**Revisar antes de regar**: cuando una planta pide agua, pulsa **📷 Revisar**.

- Haces una foto y dices cómo está la tierra: encharcada, húmeda, seca por encima o seca del todo.
- La app compara eso con lo que había calculado y corrige el ritmo de secado de esa planta (como mucho un 15 % cada vez).
- Si activas el análisis, la IA revisa la foto y propone acciones con un botón para aplicarlas: «regarla con menos frecuencia», «la he movido a más luz»…
- Las fotos forman la **evolución** de la planta en su ficha.

**Pulverizar**: las plantas que agradecen humedad (calatheas, helechos, orquídeas, tillandsias…) tienen su propio aviso. Solo salta cuando el aire está seco, y para el interior se tiene en cuenta que la calefacción lo reseca.

> Si ya habías ejecutado `schema.sql` en una versión anterior, ejecuta solo los archivos de `supabase/migrations/` que te falten (`002_zonas.sql`, `003_revisiones.sql`).

### 7. Probar los avisos

En **Actions → Avisos de riego → Run workflow** puedes lanzarlo a mano:

- Con *Solo simular* marcado, ves en el log qué plantas avisaría sin enviar nada.
- Sin marcarlo, envía las notificaciones de verdad.

Sin intervención, se ejecuta cada día a las 07:00 UTC, que son las 9:00 en verano y las 8:00 en invierno en Madrid. Para cambiar la hora, edita el `cron` en `.github/workflows/notify.yml`.

---

## Desarrollo en tu ordenador

```bash
cp .env.example .env.local   # y rellena los valores
npm install
npm run dev                  # http://localhost:5173
npm test                     # tests del cálculo de riego
```

---

## Añadir una planta

1. Haz una foto a la planta, o elígela de la galería.
2. BotanIQ la identifica. Si no está segura (menos del 50 %), te enseña las especies más probables para que elijas.
3. Confirmas los detalles, ya precargados según la especie y la última zona que usaste:
   - zona;
   - luz;
   - tamaño de la maceta (con una guía de medidas);
   - material de la maceta y si tiene agujeros de drenaje;
   - sustrato;
   - último riego.
4. Pulsas **Guardar planta**.

En **Más opciones** puedes cambiar el tipo de planta, el sustrato detallado, la fecha exacta del último riego y las notas.

> Si ya habías ejecutado `schema.sql` en una versión anterior, ejecuta también `supabase/migrations/004_drenaje.sql`.

## Diseño

La interfaz sigue las convenciones de iOS:

- Tipografía del sistema, títulos grandes que se compactan al hacer scroll.
- Listas agrupadas, barras translúcidas y barra de pestañas (Hoy · Plantas · Ajustes).
- Hojas que suben desde abajo, interruptores y controles segmentados.
- Modo claro y oscuro automáticos. Si el sistema pide reducir el movimiento, se respeta.

Los iconos son propios (`src/components/Icon.jsx`) y los colores están definidos como variables en `src/styles.css`.

## Cómo calcula el riego

Cada planta tiene un **nivel de sequedad**. Cuando la riegas vale 0 % y cada día sube según una tasa. Cuando llega al 100 %, toca regar.

```
tasa diaria = 1 / días_base(tipo de planta)
            × sustrato × tamaño de maceta × material × ajuste aprendido
            × factor ambiental del día
```

- **Días base por tipo de planta** (en `src/lib/profiles.js`): cactus 21, suculenta 14, tropical 8, helecho o calathea 5, albahaca 3, etc.
- **Planta de interior**: la temperatura y la humedad de casa se estiman a partir de las de fuera, que se amortiguan, y se tiene en cuenta que la calefacción seca el aire. Se usa el déficit de presión de vapor, porque el aire caliente y seco seca más, y un factor de crecimiento, porque con frío la planta consume menos. La luz directa acelera el secado.
- **Planta de exterior**: se usa la evapotranspiración de referencia (ET0) de Open-Meteo, que ya incluye sol, viento, temperatura y humedad. **La lluvia descuenta sequedad**, salvo que hayas indicado que la planta está bajo techo.
- **Último riego «No lo sé»**: al dar de alta la planta se pregunta siempre cuándo se regó por última vez. Si contestas «No lo sé», la app supone que la planta está a medio secar (50 %).
- **Sustrato «No lo sé»**: se asume el habitual de tienda para ese tipo de planta. Para cactus y suculentas es mineral, para orquídeas corteza y para el resto universal.
- **Época del año**: la app calcula la estación según tu hemisferio y las horas de luz del día.
  - En interior, los días largos de verano aceleran el secado y los cortos de invierno lo frenan.
  - Cada ficha muestra los cuidados de la temporada y qué es normal ver en esa época.
  - El diagnóstico por foto recibe la estación, las horas de luz y la fase de crecimiento esperada. Así no confunde, por ejemplo, el reposo invernal o la caída otoñal de hojas con un problema, y adapta sus consejos a la época.
- **La app aprende**:
  - En cada **revisión** dices cómo está la tierra: la sequedad se corrige a ese valor y, si el modelo se había equivocado, ajusta el ritmo de esa planta (como mucho un 15 % cada vez).
  - El diagnóstico por foto también puede proponer regar más o menos a menudo (±12 %), pero solo se aplica si pulsas el botón.

## Cosas a tener en cuenta

- **Supabase** pausa los proyectos gratuitos tras 7 días sin actividad. El aviso diario hace una consulta cada día, así que lo mantiene despierto.
- **GitHub** desactiva las tareas programadas si el repositorio pasa 60 días sin commits. Te avisa por email y se reactiva con un clic en Actions.
- **La clave `anon` de Supabase** es pública por diseño. La seguridad la dan las políticas RLS de `schema.sql`: cada persona solo ve las casas de las que es miembro.

## Estructura

```
src/lib/profiles.js   tipos de planta, sustratos y mapeo de Pl@ntNet a tipo
src/lib/watering.js   modelo de riego (compartido entre la app y los avisos)
src/lib/weather.js    Open-Meteo
src/lib/plantnet.js   identificación
src/lib/care.js       recomendaciones de riego y pulverizado
src/lib/diagnose.js   diagnóstico por foto (cliente)
supabase/functions/ai/        Edge Function de IA: diagnóstico y asistente (OpenAI o Gemini)
src/pages/            pantallas
src/sw.js             service worker (offline y notificaciones push)
scripts/notify.mjs    aviso diario (GitHub Actions)
supabase/schema.sql   base de datos y seguridad
```
