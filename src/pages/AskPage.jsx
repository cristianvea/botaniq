import { useEffect, useRef, useState } from 'react';
import * as db from '../lib/data.js';
import { askAssistant, buildContext, TIER_LABEL } from '../lib/assistant.js';
import { cadenceText } from '../lib/reminders.js';
import { resizeImage } from '../lib/image.js';
import { NavBar, Icon, Avatar, Spinner } from '../components/ui.jsx';

const EXAMPLES = [
  'Tengo este abono, ¿cómo lo uso?',
  '¿Crees que necesita más luz?',
  '¿Por qué se le ponen las hojas amarillas?',
  '¿Cuándo debería trasplantarla?',
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

  const pickImage = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const blob = await resizeImage(f, 1280, 0.8);
    setImage({ blob, url: URL.createObjectURL(blob) });
  };

  const send = async (raw) => {
    const q = (raw ?? text).trim();
    if (!q || busy) return;
    setText('');
    const img = image;
    setImage(null);
    const userMsg = await db.addChat({
      household_id: household.id, user_id: user.id, plant_id: focus, role: 'user', content: q,
      meta: img ? { photo: true } : null,
    });
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
      if (img) URL.revokeObjectURL(img.url);
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
      <NavBar title="Preguntar" large
        right={messages?.length ? <button className="icon-circle" onClick={clear} aria-label="Borrar conversación"><Icon name="trash" size={18} /></button> : null} />

      {plants.length > 0 && (
        <div className="chips ask-focus" role="radiogroup" aria-label="Sobre qué planta">
          <button className={`chip ${!focus ? 'on' : ''}`} onClick={() => setFocus(null)} role="radio" aria-checked={!focus}>Todas</button>
          {plants.map((p) => (
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
          <div className="ask-glyph"><Icon name="sparkles" size={30} /></div>
          <h2 className="t-title3">Pregunta lo que quieras</h2>
          <p className="t-sub c2">
            {focusPlant ? `Conozco a ${focusPlant.name}: su luz, su maceta, cuándo la regaste y el tiempo que hace.` : 'Conozco tus plantas, dónde están, cuándo las regaste y el tiempo que hace.'}
            {' '}Puedes mandarme una foto de la planta o de la etiqueta de un producto.
          </p>
          <div className="ask-examples">
            {EXAMPLES.map((e) => <button key={e} className="ask-example" onClick={() => send(e)}>{e}</button>)}
          </div>
        </div>
      ) : (
        <div className="thread">
          {messages.map((m) => (
            <Message key={m.id} m={m} plants={plants} onAdd={() => addReminder(m)} onDismiss={() => setMeta(m, { reminderState: 'dismissed' })} />
          ))}
          {busy && <div className="bubble bot typing" aria-label="Escribiendo"><span /><span /><span /></div>}
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
          <textarea ref={inputRef} rows={1} value={text} placeholder={focusPlant ? `Pregunta sobre ${focusPlant.name}…` : 'Pregunta sobre tus plantas…'}
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
        <div className="msg-model" title={meta.reason}>{TIER_LABEL[meta.tier] || ''} · {String(meta.model).replace(/^models\//, '')}</div>
      )}
    </div>
  );
}
