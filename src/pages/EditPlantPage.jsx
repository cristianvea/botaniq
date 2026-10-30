import { useEffect, useRef, useState } from 'react';
import * as db from '../lib/data.js';
import { go } from '../lib/nav.js';
import { resizeImage } from '../lib/image.js';
import { identifyPlant, plantnetEnabled } from '../lib/plantnet.js';
import { PROFILES, SUBSTRATES, profileForTaxon, suggestedPlacement } from '../lib/profiles.js';
import { NavBar, Section, Segmented, Switch, Icon, Spinner, Sheet, TextField, SelectField } from '../components/ui.jsx';
import ZoneEditor from '../components/ZoneEditor.jsx';
import TypePicker from '../components/TypePicker.jsx';

const EMPTY = {
  name: '', species: '', genus: '', family: '', common_name: '',
  zone_id: null, profile: 'generica', location: 'indoor', light: 'indirect', substrate: 'unknown',
  pot: 'medium', pot_material: 'plastic', pot_drainage: true, gets_rain: true, notes: '', fixed_days: null,
};
const LAST = [['0', 'Hoy'], ['3', 'Hace unos días'], ['7', 'Hace una semana'], ['unknown', 'No lo sé']];
const LAST_ZONE_KEY = 'botaniq.lastZone';
// Ayuda para elegir el tamaño: se mide el ancho de la boca de la maceta
const POT_HINT = {
  small: 'Menos de 12 cm de boca. Cabe en una mano, como una taza o un vaso grande.',
  medium: 'De 12 a 25 cm de boca, más o menos un palmo. Como la típica maceta de supermercado.',
  large: 'Más de 25 cm de boca. Necesitas las dos manos para moverla, como un cubo de fregar o mayor.',
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const short = (label) => label.split(' (')[0];
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } } };

export default function EditPlantPage(ctx) {
  const { plantId, plants, zones, household, user, photos, reload, notify } = ctx;
  const existing = plantId ? plants.find((p) => p.id === plantId) : null;

  const [step, setStep] = useState(existing ? 'confirm' : 'capture'); // capture | identifying | confirm
  const [form, setForm] = useState(() => (existing ? { ...EMPTY, ...existing } : { ...EMPTY, zone_id: defaultZone(zones) }));
  const [touched, setTouched] = useState({ name: !!existing, light: !!existing, zone: !!existing, profile: false });
  const [identifying, setIdentifying] = useState(false);
  const [askMismatch, setAskMismatch] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [mismatchOk, setMismatchOk] = useState(false);
  const [photoBlob, setPhotoBlob] = useState(null);
  const [preview, setPreview] = useState(existing ? photos[existing.photo_path] : null);
  const [candidates, setCandidates] = useState([]);
  const [picked, setPicked] = useState(null);
  const [showAlts, setShowAlts] = useState(false);
  const [idError, setIdError] = useState(null);
  const [lastWatered, setLastWatered] = useState('unknown');
  const [lastDate, setLastDate] = useState('');
  const [newLocation, setNewLocation] = useState(existing?.location || 'indoor'); // solo si aún no hay zonas
  const [newZone, setNewZone] = useState(false);
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const camRef = useRef();
  const libRef = useRef();

  useEffect(() => () => { if (photoBlob && preview) URL.revokeObjectURL(preview); }, [photoBlob, preview]);

  // (todos los hooks antes de cualquier return)
  // Planta ya guardada sin especie: la identificamos con su foto al abrir la edición
  useEffect(() => {
    if (existing && !existing.species && existing.photo_path && plantnetEnabled) {
      let alive = true;
      (async () => { const b = await currentBlob(); if (alive && b) runIdentify(b); })();
      return () => { alive = false; };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (plantId && !existing) return <div className="center c3">Planta no encontrada</div>;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const back = existing ? `#/plant/${existing.id}` : '#/';

  // Aplica una especie identificada y precarga lo que se deduce de ella
  const apply = (c) => {
    const profile = profileForTaxon(c);
    const sug = suggestedPlacement(profile);
    setForm((f) => {
      const patch = { species: c.species, genus: c.genus || '', family: c.family || '', common_name: c.commonName || '' };
      if (!touched.profile) patch.profile = profile;
      if (!touched.name) patch.name = cap(c.commonName || c.species);
      if (!touched.light) patch.light = sug.light;
      if (!touched.zone && zones.length) {
        const wanted = zones.find((z) => z.location === sug.location);
        if (wanted && zones.find((z) => z.id === f.zone_id)?.location !== sug.location) patch.zone_id = wanted.id;
      }
      if (!zones.length) setNewLocation(sug.location);
      return { ...f, ...patch };
    });
    setPicked(c.species);
  };

  // Identifica con Pl@ntNet. Si el usuario ya eligió un tipo a mano, no lo pisamos: avisamos si no coincide.
  const runIdentify = async (blob) => {
    if (!plantnetEnabled) { setIdError('La identificación no está configurada (falta la clave de Pl@ntNet).'); return; }
    setIdentifying(true); setIdError(null); setMismatchOk(false);
    try {
      const r = await identifyPlant(blob, 'auto');
      setCandidates(r);
      if (r.length && r[0].score >= 0.5) apply(r[0]);
      else if (r.length) setShowAlts(true);
      else setIdError('No he reconocido la especie en esta foto. Prueba con otra más cercana a las hojas o flores.');
    } catch (ex) {
      setIdError(ex.message);
    } finally {
      setIdentifying(false);
    }
  };

  const currentBlob = async () => {
    if (photoBlob) return photoBlob;
    if (!preview) return null;
    try { return await (await fetch(preview)).blob(); } catch { return null; }
  };

  const retryIdentify = async () => {
    const b = await currentBlob();
    if (b) runIdentify(b); else setIdError('Añade una foto para poder identificarla.');
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const blob = await resizeImage(file);
    setPhotoBlob(blob);
    setPreview(URL.createObjectURL(blob));
    if (existing) { setStep('confirm'); runIdentify(blob); return; }
    setStep('identifying');
    await runIdentify(blob);
    setStep('confirm');
  };

  const save = async (force = false) => {
    if (!form.name.trim()) return notify('Ponle un nombre a la planta');
    if (!force && mismatch && !mismatchOk) { setAskMismatch(true); return; }
    if (lastWatered === 'date' && !lastDate) return notify('Elige la fecha del último riego');
    setSaving(true);
    try {
      let zone = zones.find((z) => z.id === form.zone_id);
      if (!zone && zones.length) { setSaving(false); return notify('Elige en qué zona está'); }
      if (!zone) {
        zone = await db.saveZone({ household_id: household.id, name: newLocation === 'indoor' ? 'Interior' : 'Exterior', location: newLocation, gets_rain: true });
      }
      store.set(LAST_ZONE_KEY, zone.id);
      let photo_path = existing?.photo_path || null;
      if (photoBlob) {
        photo_path = await db.uploadPhoto(household.id, photoBlob);
        if (existing?.photo_path) await db.removePhoto(existing.photo_path);
      }
      const row = {
        id: existing?.id, household_id: household.id, name: form.name.trim(),
        species: form.species || null, genus: form.genus || null, family: form.family || null, common_name: form.common_name || null,
        profile: form.profile, zone_id: zone.id, location: zone.location, gets_rain: zone.gets_rain,
        light: form.light, substrate: form.substrate, pot: form.pot, pot_material: form.pot_material, pot_drainage: form.pot_drainage,
        notes: form.notes || null, photo_path,
        ...(form.fixed_days || existing?.fixed_days ? { fixed_days: form.fixed_days ? Number(form.fixed_days) : null } : {}),
      };
      if (!existing) row.created_by = user.id;
      const saved = await db.savePlant(row);
      if (!existing && lastWatered !== 'unknown') {
        const when = lastWatered === 'date' ? new Date(lastDate + 'T10:00:00') : new Date(Date.now() - Number(lastWatered) * 86400000);
        await db.addEvent(saved, 'water', user.id, when);
      }
      await reload();
      go(`#/plant/${saved.id}`);
      notify(existing ? 'Cambios guardados' : `${saved.name} añadida`);
      if (!existing) ctx.maybeAskNotify?.();
    } catch (ex) {
      notify(ex.message);
    } finally {
      setSaving(false);
    }
  };

  const inputs = (
    <>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
      <input ref={libRef} type="file" accept="image/*" hidden onChange={onPhoto} />
    </>
  );

  // ───────── 1. Foto ─────────
  if (step === 'capture') {
    return (
      <div className="screen">
        <NavBar title="Nueva planta" left={<a className="nav-btn" href={back}>Cancelar</a>} />
        <div className="empty-state" style={{ paddingTop: 40 }}>
          <div className="glyph" style={{ width: 120, height: 120 }}><Icon name="camera" size={54} stroke={1.6} /></div>
          <h1 className="t-title2">Haz una foto a tu planta</h1>
          <p className="t-sub c2" style={{ maxWidth: 300 }}>La identificamos y preparamos sus cuidados. Solo tendrás que confirmar unos detalles.</p>
          <div className="stack" style={{ width: '100%', maxWidth: 320, marginTop: 20 }}>
            <button className="btn block" onClick={() => camRef.current.click()}><Icon name="camera" size={20} /> Hacer foto</button>
            <button className="btn gray block" onClick={() => libRef.current.click()}>Elegir de la galería</button>
            <button className="btn plain" onClick={() => setStep('confirm')}>Añadir sin foto</button>
          </div>
          <p className="t-foot c3" style={{ marginTop: 18 }}>Consejo: la planta entera o una hoja de cerca, con buena luz.</p>
        </div>
        {inputs}
      </div>
    );
  }

  // ───────── 2. Identificando ─────────
  if (step === 'identifying') {
    return (
      <div className="screen">
        <NavBar title="Nueva planta" left={<a className="nav-btn" href={back}>Cancelar</a>} />
        <div className="photo-wide" style={{ cursor: 'default', position: 'relative' }}>
          {preview && <img src={preview} alt="" />}
          <div className="identifying"><Spinner size={28} /><span>Identificando…</span></div>
        </div>
      </div>
    );
  }

  // ───────── 3. Confirmación ─────────
  const top = candidates.find((c) => c.species === picked);
  const prof = PROFILES[form.profile] || PROFILES.generica;
  // ¿El tipo elegido a mano contradice lo que dice la foto?
  const idProfile = top ? profileForTaxon(top) : null;
  const mismatch = !!(top && idProfile && idProfile !== form.profile && top.score >= 0.3);
  const idName = top ? `${cap(top.commonName || top.species)} (${top.species})` : '';
  const simpleSub = form.substrate === 'unknown' || form.substrate === 'cactus';
  const todayStr = new Date().toLocaleDateString('en-CA');

  return (
    <div className="screen" style={{ paddingBottom: 'calc(var(--bottom) + 110px)' }}>
      <NavBar
        title={existing ? 'Editar planta' : 'Confirmar'}
        left={<a className="nav-btn" href={back}>Cancelar</a>}
        right={<button className="nav-btn bold" disabled={saving} onClick={() => save()}>{saving ? <Spinner /> : 'Guardar'}</button>}
      />

      {/* Cabecera: foto + nombre + especie */}
      <div className="confirm-head">
        <button className="confirm-photo" onClick={() => (preview ? libRef.current.click() : camRef.current.click())} aria-label={preview ? 'Cambiar foto' : 'Añadir foto'}>
          {preview ? <img src={preview} alt="" /> : <Icon name="camera" size={30} stroke={1.8} />}
        </button>
        <div className="confirm-id">
          <input className="confirm-name" value={form.name} placeholder="Nombre de la planta"
            onChange={(e) => { setTouched((t) => ({ ...t, name: true })); set({ name: e.target.value }); }} />
          {form.species
            ? <div className="t-sub c2"><i>{form.species}</i>{form.common_name && form.common_name.toLowerCase() !== form.name.trim().toLowerCase() ? ` · ${cap(form.common_name)}` : ''}</div>
            : <div className="t-sub c3">Especie sin identificar</div>}
          <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
            {top && <span className={`pill ${top.score >= 0.5 ? 'pill-ok' : 'pill-soon'}`}><Icon name="sparkles" size={12} /> {Math.round(top.score * 100)} %</span>}
            <button type="button" className="pill type-btn" onClick={() => setTypeOpen(true)} aria-label="Cambiar tipo de planta">
              {prof.emoji} {short(prof.label)} <Icon name="chevronRight" size={12} stroke={2.6} className="chev" />
            </button>
            {candidates.length > 1 && <button className="btn plain small" style={{ padding: 0, minHeight: 0, whiteSpace: 'nowrap' }} onClick={() => setShowAlts(true)}>¿No es esta?</button>}
          </div>
        </div>
      </div>
      {identifying && (
        <Section><div className="cell"><Spinner /><span className="c2">Identificando la planta…</span></div></Section>
      )}
      {idError && !identifying && (
        <Section footer={idError}>
          <button type="button" className="cell" onClick={retryIdentify}>
            <span className="cell-icon" style={{ background: '#ff9500' }}><Icon name="sparkles" size={18} stroke={2.2} /></span>
            <div className="cell-main"><div className="cell-title c-tint">Volver a identificar</div></div>
          </button>
        </Section>
      )}
      {existing && !identifying && !idError && !top && plantnetEnabled && (preview || photoBlob) && (
        <Section>
          <button type="button" className="cell" onClick={retryIdentify}>
            <span className="cell-icon" style={{ background: 'var(--tint)' }}><Icon name="sparkles" size={18} stroke={2.2} /></span>
            <div className="cell-main"><div className="cell-title c-tint">{form.species ? 'Volver a identificar con la foto' : 'Identificar con la foto'}</div></div>
          </button>
        </Section>
      )}
      {mismatch && !mismatchOk && (
        <Section footer={`Has elegido «${short(prof.label)}», pero la foto se parece a ${idName} con un ${Math.round(top.score * 100)} % de confianza, que es «${short(PROFILES[idProfile].label)}». El tipo cambia la frecuencia y la forma de riego.`}>
          <button type="button" className="cell" onClick={() => { set({ profile: idProfile }); setTouched((t) => ({ ...t, profile: false })); }}>
            <span className="cell-icon" style={{ background: '#ff9500' }}><Icon name="sparkles" size={18} stroke={2.2} /></span>
            <div className="cell-main"><div className="cell-title c-tint">Usar «{short(PROFILES[idProfile].label)}»</div></div>
          </button>
          <button type="button" className="cell" onClick={() => setMismatchOk(true)}>
            <div className="cell-main" style={{ paddingLeft: 42 }}><div className="cell-title">Mantener «{short(prof.label)}»</div></div>
          </button>
        </Section>
      )}

      <Section footer={prof.tip}>
        {/* Zona */}
        <div className="cell stacked">
          <span className="t-foot c2 upper">{zones.length ? 'Zona' : 'Ubicación'}</span>
          {zones.length ? (
            <div className="chips wrap">
              {zones.map((z) => (
                <button type="button" key={z.id} className={`chip ${form.zone_id === z.id ? 'on' : ''}`}
                  onClick={() => { setTouched((t) => ({ ...t, zone: true })); set({ zone_id: z.id }); setNewZone(false); }}>
                  <Icon name={z.location === 'indoor' ? 'house' : z.gets_rain ? 'sun' : 'sunDim'} size={15} /> {z.name}
                </button>
              ))}
              <button type="button" className="chip add" onClick={() => setNewZone(true)} aria-label="Nueva zona"><Icon name="plus" size={15} stroke={2.4} /></button>
            </div>
          ) : (
            <Segmented value={newLocation} onChange={setNewLocation} options={[['indoor', 'Interior'], ['outdoor', 'Exterior']]} />
          )}
        </div>

        <div className="cell stacked">
          <span className="t-foot c2 upper">Luz</span>
          <Segmented value={form.light} onChange={(v) => { setTouched((t) => ({ ...t, light: true })); set({ light: v }); }}
            options={[['direct', 'Directa'], ['indirect', 'Indirecta'], ['low', 'Sombra']]} />
        </div>

        <div className="cell stacked">
          <span className="t-foot c2 upper">Maceta</span>
          <Segmented value={form.pot} onChange={(v) => set({ pot: v })} options={[['small', 'Pequeña'], ['medium', 'Mediana'], ['large', 'Grande']]} />
          <span className="t-foot c2 pot-hint">{POT_HINT[form.pot]}</span>
          <Segmented value={form.pot_material} onChange={(v) => set({ pot_material: v })} options={[['plastic', 'Plástico'], ['terracotta', 'Barro']]} />
        </div>
        <div className="cell">
          <div className="cell-main">
            <div className="cell-title">Con agujeros de drenaje</div>
            {!form.pot_drainage && <div className="cell-sub t-foot">Regaremos con menos cantidad</div>}
          </div>
          <Switch checked={form.pot_drainage} onChange={(v) => set({ pot_drainage: v })} label="Con agujeros de drenaje" />
        </div>

        <div className="cell stacked">
          <span className="t-foot c2 upper">Sustrato</span>
          {simpleSub ? (
            <Segmented value={form.substrate} onChange={(v) => set({ substrate: v })} options={[['unknown', 'Estándar / de tienda'], ['cactus', 'Muy drenante']]} />
          ) : (
            <button type="button" className="chip on" onClick={() => setMore(true)}>{short(SUBSTRATES[form.substrate]?.label || '')}</button>
          )}
        </div>

        {!existing && (
          <div className="cell stacked">
            <span className="t-foot c2 upper">Último riego</span>
            <div className="chips wrap">
              {LAST.map(([v, l]) => (
                <button type="button" key={v} className={`chip ${lastWatered === v ? 'on' : ''}`} onClick={() => setLastWatered(v)}>{l}</button>
              ))}
            </div>
            {lastWatered === 'unknown' && <span className="t-foot c2">Te pediré que la revises pronto para afinar.</span>}
          </div>
        )}
      </Section>

      {newZone && (
        <div className="section" style={{ marginTop: -18 }}>
          <ZoneEditor householdId={household.id} existingNames={zones.map((z) => z.name)} notify={notify}
            onCancel={() => setNewZone(false)}
            onSaved={async (z) => { await reload(); set({ zone_id: z.id }); setTouched((t) => ({ ...t, zone: true })); setNewZone(false); }} />
        </div>
      )}

      {/* Más opciones */}
      <Section>
        <button type="button" className="cell" onClick={() => setMore(!more)} aria-expanded={more}>
          <div className="cell-main"><div className="cell-title">Más opciones</div><div className="cell-sub t-foot">Nombres, tipo, sustrato, fecha exacta y notas</div></div>
          <Icon name="chevronRight" size={16} stroke={2.6} className="chev" style={{ transform: more ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
        </button>
        {more && (
          <>
            <div className="tf">
              <span className="tf-label">Tipo de planta</span>
              <button type="button" className="tf-input" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setTypeOpen(true)}>
                <span>{prof.emoji}</span><span style={{ flex: 1, textAlign: 'left' }}>{short(prof.label)}</span>
                <Icon name="chevronRight" size={14} stroke={2.6} className="chev" />
              </button>
            </div>
            <TextField label="Nombre común" value={form.common_name || ''} placeholder="Ej.: brecina, potos, costilla de Adán"
              onChange={(e) => set({ common_name: e.target.value })} />
            <TextField label="Nombre botánico (latín)" value={form.species || ''} placeholder="Ej.: Calluna vulgaris" autoCorrect="off" autoCapitalize="off"
              style={{ fontStyle: form.species ? 'italic' : 'normal' }} onChange={(e) => set({ species: e.target.value })} />
            <SelectField label="Sustrato" value={form.substrate} onChange={(v) => set({ substrate: v })}
              options={Object.entries(SUBSTRATES).map(([k, s]) => [k, k === 'unknown' ? 'Estándar / de tienda' : short(s.label).split(' / ')[0]])} />
            <SelectField label="Frecuencia de riego" value={String(form.fixed_days || '')} onChange={(v) => set({ fixed_days: v ? Number(v) : null })}
              hint="Si sabes cada cuánto la riegas y te funciona, fíjalo aquí y BotanIQ lo respetará."
              options={[['', 'Automática (según la planta y el tiempo)'], ...[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 21, 30].map((n) => [String(n), n === 1 ? 'Cada día' : `Cada ${n} días`])]} />
            {!existing && (
              <TextField label="Fecha exacta del último riego" type="date" max={todayStr} value={lastDate}
                onChange={(e) => { setLastDate(e.target.value); setLastWatered(e.target.value ? 'date' : 'unknown'); }} />
            )}
            <TextField label="Notas" multiline rows={3} value={form.notes || ''} placeholder="Abono, de dónde viene, cuidados especiales…"
              onChange={(e) => set({ notes: e.target.value })} />
          </>
        )}
      </Section>

      <div className="bottom-bar">
        <button className="btn block" disabled={saving} onClick={() => save()}>{saving ? <Spinner /> : existing ? 'Guardar cambios' : 'Guardar planta'}</button>
      </div>

      {typeOpen && (
        <TypePicker value={form.profile} suggested={idProfile} suggestedScore={top?.score}
          onClose={() => setTypeOpen(false)}
          onPick={(k) => { setTypeOpen(false); setTouched((t) => ({ ...t, profile: true })); setMismatchOk(false); set({ profile: k }); }} />
      )}
      {askMismatch && top && (
        <Sheet onClose={() => setAskMismatch(false)}>
          <div className="content" style={{ padding: '8px 16px 16px' }}>
            <div className="t-title3">¿Seguro que es «{short(prof.label)}»?</div>
            <p className="t-sub c2" style={{ marginTop: 6, lineHeight: 1.4 }}>
              Según la foto, al {Math.round(top.score * 100)} % de confianza parece <b>{idName}</b>, que es «{short(PROFILES[idProfile].label)}».
            </p>
          </div>
          <div className="content stack">
            <button className="btn block" onClick={() => { setAskMismatch(false); set({ profile: idProfile }); setTimeout(() => document.querySelector('.bottom-bar .btn')?.click(), 0); }}>
              Usar «{short(PROFILES[idProfile].label)}»
            </button>
            <button className="btn gray block" onClick={() => { setAskMismatch(false); setMismatchOk(true); save(true); }}>
              Guardar con «{short(prof.label)}»
            </button>
          </div>
        </Sheet>
      )}
      {showAlts && (
        <Sheet onClose={() => setShowAlts(false)}>
          <div className="content" style={{ padding: '8px 16px 14px' }}>
            <div className="t-title3">¿Cuál es tu planta?</div>
            <p className="t-sub c2" style={{ marginTop: 4 }}>
              {candidates[0]?.score < 0.5 ? 'No estoy del todo seguro. Elige la que más se parezca.' : 'Otras especies parecidas.'}
            </p>
          </div>
          <div className="section">
            <div className="group">
              {candidates.slice(0, 5).map((c) => (
                <button type="button" className="cell" key={c.species} onClick={() => { apply(c); setShowAlts(false); }}>
                  <div className="cell-main">
                    <div className="cell-title t-headline">{cap(c.commonName || c.species)}</div>
                    <div className="cell-sub t-foot"><i>{c.species}</i></div>
                  </div>
                  <div className="score t-foot c2 num">{Math.round(c.score * 100)} %<div className="bar"><i style={{ width: `${Math.round(c.score * 100)}%` }} /></div></div>
                  <span style={{ width: 22, color: 'var(--tint)' }}>{picked === c.species && <Icon name="check" size={20} stroke={2.6} />}</span>
                </button>
              ))}
              <button type="button" className="cell" onClick={() => { setShowAlts(false); setMore(true); setPicked(null); }}>
                <div className="cell-title c-tint">Ninguna, la indico yo</div>
              </button>
            </div>
          </div>
        </Sheet>
      )}
      {inputs}
    </div>
  );
}

function defaultZone(zones) {
  const last = store.get(LAST_ZONE_KEY);
  return zones.find((z) => z.id === last)?.id || zones[0]?.id || null;
}
