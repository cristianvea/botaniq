import { useEffect, useRef, useState } from 'react';
import * as db from '../lib/data.js';
import { askAssistant, buildContext, TIER_LABEL } from '../lib/assistant.js';
import { cadenceText } from '../lib/reminders.js';
import { resizeImage } from '../lib/image.js';
import { NavBar, Icon, Avatar, Spinner } from '../components/ui.jsx';

// photo: abre la cámara y manda la pregunta con la foto
const EXAMPLES = [
  { text: 'Quiero abonarla, ¿qué abono uso?' },
  { text: 'Tengo este abono, ¿qué tipo es y cómo lo uso?', label: 'Tengo este abono', hint: 'Hazle una foto a la etiqueta', photo: true },
  { text: '¿Crees que necesita más luz?' },
  { text: '¿Por qué se le ponen las hojas amarillas?' },
  { text: '¿Cuándo debería trasplantarla?' },
];

export default function AskPage(ctx) {
  const { household, plants, photos, user, notify, reload, plantId } = ctx;
  const [focus, setFocus] = useState(plantId || (plants.length === 1 ? plants[0].id : null));
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState('');
  const [image, setImage] = useState(null); // { blob, url }
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { db.listChat(household.id).then(setMessages); }, [household.id]);
  // Que se vea la planta elegida en la fila de chips
  useEffect(() => {
    document.querySelector('.ask-focus .chip.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [focus]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: messages?.length > 1 ? 'smooth' : 'auto', block: 'end' }); }, [messages, busy]);

  const focusPlant = plants.find((p) => p.id === focus);
  // La planta desde la que vienes, primera
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
    setText('');
    const img = imgOverride || image;
    setImage(null);
    const userMsg = await db.addChat({
      household_id: household.id, user_id: user.id, plant_id: focus, role: 'user', content: q,
      meta: img ? { photo: true } : null,
    });
    if (img) userMsg.localUrl = img.url; // miniatura solo en esta sesión (la foto no se guarda)
    const history = [...(messages || []), userMsg];
    setMessages(history);
    setBusy(true);
    try {
      const res = await askAssistant({
        messages: history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
        context: buildContext(ctx, focus),
        image: img?.blob,
      });
      const known = new Set(plants.map((p) => p.id));
      const reminder = res.reminder && { ...res.reminder, plant_ids: res.reminder.plant_ids.filter((id) => known.has(id)) };
      const botMsg = await db.addChat({
        household_id: household.id, user_id: user.id, plant_id: focus, role: 'assistant', content: res.answer,
        meta: { model: res.model, tier: res.tier, reason: res.reason, suggestions: res.suggestions, reminder: reminder?.plant_ids.length ? reminder : null },
      });
      setMessages((m) => [...m, botMsg]);
    } catch (e) {
      setMessages((m) => [...m, { id: `err-${Date.now()}`, role: 'assistant', content: e.message, meta: { error: true } }]);
    } finally {
      setBusy(false);
    }
  };

  const setMeta = (msg, patch) => {
    const meta = { ...msg.meta, ...patch };
    setMessages((list) => list.map((m) => (m.id === msg.id ? { ...m, meta } : m)));
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

  const clear = async () => {
    if (!confirm('¿Borrar toda la conversación?')) return;
    await db.clearChat(household.id);
    setMessages([]);
  };

  const last = messages?.[messages.length - 1];

  return (
    <div className="screen with-tabs ask">
      <NavBar title="Florencio" large sub="Tu botánico de confianza"
        right={messages?.length ? <button className="icon-circle" onClick={clear} aria-label="Borrar conversación"><Icon name="trash" size={18} /></button> : null} />

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

      {messages === null ? (
        <div className="center c3" style={{ minHeight: 200 }}><Spinner /></div>
      ) : messages.length === 0 ? (
        <div className="ask-empty">
          <div className="ask-glyph florencio">F</div>
          <h2 className="t-title3">¡Hola! Soy Florencio</h2>
          <p className="t-sub c2">
            Tu botánico de confianza. {focusPlant ? `Ya conozco a ${focusPlant.name}: su luz, su maceta, cuándo la regaste y el tiempo que hace.` : 'Ya conozco tus plantas, dónde están, cuándo las regaste y el tiempo que hace.'}
            {' '}Pregúntame lo que quieras, y si me mandas una foto de la planta o de la etiqueta de un abono, mejor que mejor.
          </p>
          <div className="ask-examples">
            {EXAMPLES.map((e) => (
              <button key={e.text} className={`ask-example ${e.photo ? 'photo' : ''}`} onClick={() => (e.photo ? askWithPhoto(e.text) : send(e.text))}>
                {e.photo && <Icon name="camera" size={20} />}
                <span>{e.label || e.text}{e.hint && <small>{e.hint}</small>}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="thread">
          {messages.map((m) => (
            <Message key={m.id} m={m} plants={plants} onAdd={() => addReminder(m)} onDismiss={() => setMeta(m, { reminderState: 'dismissed' })} />
          ))}
          {busy && <div className="bubble bot typing" aria-label="Florencio está escribiendo"><span /><span /><span /></div>}
          {!busy && last?.role === 'assistant' && last.meta?.suggestions?.length > 0 && (
            <div className="ask-suggest">
              {last.meta.suggestions.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
            </div>
          )}
        </div>
      )}
      <div ref={endRef} />

      <div className="composer">
        {image && (
          <div className="composer-photo">
            <img src={image.url} alt="Foto adjunta" />
            <button className="icon-circle" aria-label="Quitar foto" onClick={() => { URL.revokeObjectURL(image.url); setImage(null); }}><Icon name="close" size={12} stroke={2.8} /></button>
          </div>
        )}
        <div className="composer-row">
          <button className="composer-btn" aria-label="Añadir foto" onClick={() => fileRef.current?.click()}><Icon name="camera" size={22} /></button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImage} />
          <textarea ref={inputRef} rows={1} value={text} placeholder="Pregúntale a Florencio…"
            onChange={(e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`; }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); send(); } }} />
          <button className="composer-send" aria-label="Enviar" disabled={!text.trim() || busy} onClick={() => send()}><Icon name="arrowUp" size={20} stroke={2.6} /></button>
        </div>
      </div>
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
            <span className="cell-icon" style={{ background: '#34c759' }}><Icon name="flask" size={17} stroke={2.2} /></span>
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
        <div className="msg-model" title={meta.reason}>Florencio · {TIER_LABEL[meta.tier] || ''} · {String(meta.model).replace(/^models\//, '')}</div>
      )}
    </div>
  );
}
