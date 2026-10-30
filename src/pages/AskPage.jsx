import { useEffect, useMemo, useRef, useState } from 'react';
import * as chat from '../lib/chatStore.js';
import { threadsOf, topicOf } from '../lib/chatStore.js';
import { go } from '../lib/nav.js';
import * as db from '../lib/data.js';
import { buildContext, TIER_LABEL } from '../lib/assistant.js';
import { cadenceText } from '../lib/reminders.js';
import { resizeImage } from '../lib/image.js';
import Florencio from '../components/Florencio.jsx';
import { NavBar, BackButton, Section, Cell, Icon, Avatar, Spinner } from '../components/ui.jsx';

// photo: abre la cámara y manda la pregunta con la foto
const EXAMPLES = [
  { text: 'Quiero abonarla, ¿qué abono uso?' },
  { text: 'Tengo este abono, ¿qué tipo es y cómo lo uso?', label: 'Tengo este abono', hint: 'Hazle una foto a la etiqueta', photo: true },
  { text: '¿Crees que necesita más luz?' },
  { text: '¿Por qué se le ponen las hojas amarillas?' },
  { text: '¿Cuándo debería trasplantarla?' },
];

const fmtWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const key = (x) => x.toLocaleDateString('en-CA');
  const days = Math.round((new Date(key(new Date())) - new Date(key(d))) / 86400000); // días de calendario
  if (days === 0) return `Hoy, ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  if (days === 1) return 'Ayer';
  if (days < 7) return d.toLocaleDateString('es-ES', { weekday: 'long' });
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};
const short = (t, n = 60) => (t.length > n ? `${t.slice(0, n - 1).trim()}…` : t);

// Florencio: portada con saludo + conversaciones guardadas (#/ask), o una conversación (#/chat/:id)
export default function AskPage(ctx) {
  const { household, plants, photos, user, notify, reload, plantId, threadId } = ctx;
  const [all, setAllState] = useState(() => chat.cachedMessages(household.id)); // todos los mensajes de la casa
  const setAll = (fn) => setAllState((a) => { const v = typeof fn === 'function' ? fn(a) : fn; chat.rememberMessages(household.id, v); return v; });
  const [live, setLive] = useState(() => chat.getPending()); // pregunta en curso (sigue aunque salgas)
  const [focus, setFocus] = useState(plantId || (plants.length === 1 ? plants[0].id : null));
  const [text, setText] = useState('');
  const [image, setImage] = useState(null); // { blob, url }
  const endRef = useRef(null);
  const fileRef = useRef(null);

  // Al llegar, juntamos lo guardado con lo que ya había en memoria (respuestas que llegaron mientras no estabas, errores…)
  useEffect(() => { db.listChat(household.id).then((rows) => setAll((a) => chat.mergeMessages(rows, chat.cachedMessages(household.id) || a || []))); }, [household.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => chat.subscribe((ev) => {
    if (ev.t === 'live') setLive({ threadId: ev.threadId, text: ev.text, tier: ev.tier });
    if (ev.t === 'idle') setLive(null);
    if (ev.t === 'done' || ev.t === 'error') setAllState(chat.cachedMessages(household.id) || []);
  }), []);

  const threads = useMemo(() => threadsOf(all || []), [all]);
  const thread = threadId ? threads.find((t) => t.id === threadId) : null;
  const messages = thread?.messages || [];
  const busy = Boolean(threadId && live?.threadId === threadId);
  const busyElsewhere = Boolean(live && live.threadId !== threadId);
  const threadPlant = thread ? plants.find((p) => p.id === thread.plantId) : null;
  const focusPlant = plants.find((p) => p.id === focus);

  useEffect(() => { if (threadId) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [threadId, messages.length, busy, live?.text?.length]);
  // Que se vea la planta elegida en la fila de chips
  useEffect(() => { document.querySelector('.ask-focus .chip.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }); }, [focus]);
  const [firstId] = useState(focus);
  const chipOrder = [...plants].sort((a, b) => (b.id === firstId) - (a.id === firstId));

  const pendingRef = useRef(null); // pregunta que espera a la foto
  const pickImage = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!f) return;
    const blob = await resizeImage(f, 1600, 0.85); // algo más de resolución para leer etiquetas
    const img = { blob, url: URL.createObjectURL(blob) };
    if (pending) send(pending, img);
    else setImage(img);
  };
  const askWithPhoto = (q) => { pendingRef.current = q; fileRef.current?.click(); };

  const send = async (raw, imgOverride) => {
    const q = (raw ?? text).trim();
    if (!q || busy) return;
    if (busyElsewhere) return notify('Florencio aún está respondiendo tu otra pregunta. Espera un momento.');
    setText('');
    const img = imgOverride || image;
    setImage(null);
    const continuing = threadId && threadId !== 'antigua';
    const tid = continuing ? threadId : crypto.randomUUID();
    const pid = continuing ? thread?.plantId ?? null : focus;
    const userMsg = await db.addChat({
      household_id: household.id, user_id: user.id, plant_id: pid, thread_id: tid, role: 'user', content: q,
      meta: img ? { photo: true } : null,
    });
    if (img) userMsg.localUrl = img.url; // miniatura solo en esta sesión (la foto no se guarda)
    setAll((a) => [...(a || []), userMsg]);
    chat.ask({
      household, user, plants, threadId: tid, plantId: pid,
      history: [...(continuing ? messages : []), userMsg].filter((m) => !m.meta?.error && !m.meta?.stopped),
      context: buildContext(ctx, pid), image: img?.blob,
    });
    if (!continuing) go(`#/chat/${tid}`);
  };

  const setMeta = (msg, patch) => {
    const meta = { ...msg.meta, ...patch };
    setAll((list) => list.map((m) => (m.id === msg.id ? { ...m, meta } : m)));
    db.updateChatMeta(msg.id, meta);
  };

  const addReminder = async (msg) => {
    const r = msg.meta.reminder;
    try {
      for (const pid of r.plant_ids) {
        await db.saveReminder({
          household_id: household.id, plant_id: pid, title: r.title, note: r.note || null,
          mode: r.mode, every: r.every, months: r.months || [], created_by: user.id,
        });
      }
      setMeta(msg, { reminderState: 'added' });
      await reload();
      notify(r.mode === 'with_watering' ? 'Te lo recordaremos con el riego' : 'Recordatorio añadido');
    } catch (e) {
      notify(e.message);
    }
  };

  const removeThread = async () => {
    if (!confirm('¿Borrar esta conversación?')) return;
    chat.stop(threadId);
    try { await db.deleteThread(household.id, threadId); } catch (e) { notify(e.message); return; }
    setAll((a) => a.filter((m) => (m.thread_id || 'antigua') !== threadId));
    go('#/ask');
    notify('Conversación borrada');
  };

  const composer = (
    <div className="composer">
      {image && (
        <div className="composer-photo">
          <img src={image.url} alt="Foto adjunta" />
          <button className="icon-circle" aria-label="Quitar foto" onClick={() => { URL.revokeObjectURL(image.url); setImage(null); }}><Icon name="close" size={12} stroke={2.8} /></button>
        </div>
      )}
      {chat.getRemaining() != null && chat.getRemaining() <= 5 && (
        <div className="composer-quota">{chat.getRemaining() === 0 ? 'Florencio ya ha respondido todas las preguntas de hoy. Mañana más 🌱' : `Te quedan ${chat.getRemaining()} ${chat.getRemaining() === 1 ? 'pregunta' : 'preguntas'} hoy`}</div>
      )}
      <div className="composer-row">
        <button className="composer-btn" aria-label="Añadir foto" onClick={() => fileRef.current?.click()}><Icon name="camera" size={22} /></button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImage} />
        <textarea rows={1} value={text} placeholder={threadId ? 'Escribe a Florencio…' : 'Pregunta algo nuevo…'}
          onChange={(e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`; }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); send(); } }} />
        {busy
          ? <button className="composer-send stop" aria-label="Detener" onClick={() => chat.stop(threadId)}><span className="stop-square" /></button>
          : <button className="composer-send" aria-label="Enviar" disabled={!text.trim()} onClick={() => send()}><Icon name="arrowUp" size={20} stroke={2.6} /></button>}
      </div>
    </div>
  );

  // ───── Una conversación ─────
  if (threadId) {
    const last = messages[messages.length - 1];
    return (
      <div className="screen with-tabs ask">
        <NavBar left={<BackButton href="#/ask" label="Florencio" />} title={short(thread?.title || 'Conversación', 28)}
          right={thread ? <button className="icon-circle" onClick={removeThread} aria-label="Borrar conversación"><Icon name="trash" size={18} /></button> : null} />
        {all === null ? (
          <div className="center c3" style={{ minHeight: 200 }}><Spinner /></div>
        ) : !thread ? (
          <div className="ask-empty"><p className="t-sub c2">Esta conversación ya no existe.</p></div>
        ) : (
          <div className="thread">
            {threadPlant && <div className="thread-about"><Avatar url={photos[threadPlant.photo_path]} size={22} /> Sobre {threadPlant.name}</div>}
            {messages.map((m) => (
              <Message key={m.id} m={m} plants={plants} onAdd={() => addReminder(m)} onDismiss={() => setMeta(m, { reminderState: 'dismissed' })} />
            ))}
            {busy && (live?.text
              ? <div className="msg-bot"><div className="bubble bot">{live.text.split(/\n{2,}/).map((para, i, arr) => <p key={i}>{para}{i === arr.length - 1 && <span className="caret" />}</p>)}</div></div>
              : (
                <div className="msg-bot flo-thinking-row" role="status">
                  <Florencio mood="thinking" size={92} title="Florencio está pensando" />
                  <div className="msg-model">{live?.tier === 'pro' ? 'Mirando con lupa…' : live?.tier === 'standard' ? 'Pensando…' : 'Un momento…'}</div>
                </div>
              ))}
            {!busy && last?.role === 'assistant' && last.meta?.suggestions?.length > 0 && (
              <div className="ask-suggest">
                {last.meta.suggestions.map((sg) => <button key={sg} className="chip" onClick={() => send(sg)}>{sg}</button>)}
              </div>
            )}
          </div>
        )}
        <div ref={endRef} />
        {composer}
      </div>
    );
  }

  // ───── Portada: Florencio saluda, ejemplos y conversaciones guardadas ─────
  return (
    <div className="screen with-tabs ask">
      <NavBar title="Florencio" large sub="Tu botánico de confianza" />

      <div className="ask-welcome">
        <Florencio mood="idle" size={112} />
        <div>
          <h2 className="t-title3">¡Hola! Soy Florencio</h2>
          <p className="t-sub c2">Pregúntame lo que quieras sobre tus plantas. Si me mandas una foto, mejor que mejor.</p>
        </div>
      </div>

      {threads.length > 0 && (
        <Section header="Tus conversaciones" inset="avatar">
          {threads.map((t) => {
            const p = plants.find((x) => x.id === t.plantId);
            const writing = live?.threadId === t.id;
            return (
              <Cell key={t.id} href={`#/chat/${t.id}`} chevron
                leading={<span className="thread-emoji" style={{ background: topicOf(t.title).bg }} aria-hidden="true">{topicOf(t.title).emoji}</span>}
                title={short(t.title)}
                sub={<span className={writing ? 'c-tint' : ''}>{writing ? 'Florencio está escribiendo…' : `${p ? p.name : 'Todas tus plantas'} · ${fmtWhen(t.updated)}`}</span>} />
            );
          })}
        </Section>
      )}
      <div className="section-header ask-new-head">Nueva pregunta</div>
      {plants.length > 0 && (
        <div className="chips ask-focus" role="radiogroup" aria-label="Sobre qué planta">
          <button className={`chip ${!focus ? 'on' : ''}`} onClick={() => setFocus(null)} role="radio" aria-checked={!focus}>Todas</button>
          {chipOrder.map((p) => (
            <button key={p.id} className={`chip with-avatar ${focus === p.id ? 'on' : ''}`} onClick={() => setFocus(p.id)} role="radio" aria-checked={focus === p.id}>
              <Avatar url={photos[p.photo_path]} size={22} />{p.name}
            </button>
          ))}
        </div>
      )}

      <div className="ask-examples">
        {EXAMPLES.map((e) => (
          <button key={e.text} className={`ask-example ${e.photo ? 'photo' : ''}`} onClick={() => (e.photo ? askWithPhoto(e.text) : send(e.text))}>
            {e.photo && <Icon name="camera" size={20} />}
            <span>{e.label || e.text}{e.hint && <small>{e.hint}</small>}</span>
          </button>
        ))}
      </div>

      {all === null && <div className="center c3" style={{ minHeight: 80 }}><Spinner /></div>}
      {composer}
    </div>
  );
}

function Message({ m, plants, onAdd, onDismiss }) {
  const meta = m.meta || {};
  if (m.role === 'user') {
    const p = plants.find((x) => x.id === m.plant_id);
    return (
      <div className="msg-user">
        {(p || meta.photo) && <div className="msg-tag">{[meta.photo && '📷 Foto', p && `Sobre ${p.name}`].filter(Boolean).join(' · ')}</div>}
        {m.localUrl && <img className="msg-photo" src={m.localUrl} alt="Foto enviada" />}
        <div className="bubble me">{m.content}</div>
      </div>
    );
  }
  const r = meta.reminder;
  return (
    <div className="msg-bot">
      <div className={`bubble bot ${meta.error ? 'error' : ''}`}>
        {m.content.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
      </div>
      {r && (
        <div className="reminder-offer">
          <div className="reminder-head">
            <span className="cell-icon" style={{ background: 'var(--tint)' }}><Icon name="flask" size={17} stroke={2.2} /></span>
            <div>
              <div className="t-headline">{r.title}</div>
              <div className="t-foot c2">{cadenceText(r)} · {r.plant_ids.map((id) => plants.find((p) => p.id === id)?.name).filter(Boolean).join(', ')}</div>
            </div>
          </div>
          {r.note && <p className="t-sub c2" style={{ margin: '8px 0 0' }}>{r.note}</p>}
          {meta.reminderState === 'added' ? (
            <div className="reminder-done"><Icon name="check" size={16} stroke={2.6} /> Añadido a tus avisos</div>
          ) : meta.reminderState === 'dismissed' ? null : (
            <div className="reminder-actions">
              <button className="btn small" onClick={onAdd}>Añadir a mis avisos</button>
              <button className="btn plain small" onClick={onDismiss}>No, gracias</button>
            </div>
          )}
        </div>
      )}
      {meta.model && !meta.error && (
        <div className="msg-model msg-avatar" title={meta.reason}><Florencio mood="head" size={20} /> Florencio · {TIER_LABEL[meta.tier] || ''} · {String(meta.model).replace(/^models\//, '')}</div>
      )}
    </div>
  );
}
