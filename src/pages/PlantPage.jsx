import { useEffect, useState } from 'react';
import * as db from '../lib/data.js';
import { go } from '../lib/nav.js';
import { PROFILES, SUBSTRATES, LIGHTS, POTS, POT_MATERIALS, substrateFor } from '../lib/profiles.js';
import { SOIL, mistStatus } from '../lib/watering.js';
import { wateringGuide, contextTips } from '../lib/care.js';
import { seasonalCare, fmtHours } from '../lib/season.js';
import { OVERALL } from '../lib/diagnose.js';
import { waterPlants, mistPlants, completeReminder } from '../lib/actions.js';
import { reminderStatus, reminderWhen, cadenceText } from '../lib/reminders.js';
import { canAskPush, fmtHour } from '../lib/push.js';
import {
  Section, Cell, Icon, Ring, StatusPill, Sheet, useScrolled, drynessColor, fmtRelDays, Avatar,
} from '../components/ui.jsx';
import Diagnosis from '../components/Diagnosis.jsx';

const fmtDate = (iso) => new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const fmtTime = (iso) => new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const TIP_ICON = {
  '🚰': ['drop', '#0a7aff'], '🌡️': ['thermo', '#ff9500'], '❄️': ['thermo', '#5ac8fa'], '🌧️': ['cloudRain', '#5e6ad2'],
  '🪣': ['cloudRain', '#5e6ad2'], '💦': ['mist', '#30b0c7'], '🔥': ['thermo', '#ff3b30'], '😴': ['moon', '#5856d6'],
  '🏺': ['pot', '#a2845e'], '⚠️': ['humidity', '#ff3b30'], '🧽': ['drop', '#34c759'],
};

const EVENT = {
  water: { icon: 'dropFill', color: '#0a7aff', label: () => 'Regada' },
  mist: { icon: 'mist', color: '#30b0c7', label: () => 'Pulverizada' },
  check_wet: { icon: 'hand', color: '#8e8e93', label: () => 'Aún húmeda' },
  checkin: { icon: 'camera', color: '#1a8f4c', label: (e) => `Revisión${e.soil ? ` · ${SOIL[e.soil]?.label.toLowerCase()}` : ''}` },
};

export default function PlantPage(ctx) {
  const { plantId, plants, zones, events, statuses, photos, weather, household, reload, notify, reminders = [] } = ctx;
  const [openReminder, setOpenReminder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [eventPhotos, setEventPhotos] = useState({});
  const [open, setOpen] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const scrolled = useScrolled(240);
  const plant = plants.find((p) => p.id === plantId);
  const myEvents = events.filter((e) => e.plant_id === plantId);
  const checkins = myEvents.filter((e) => e.type === 'checkin');
  const photoKey = checkins.map((e) => e.photo_path).join(',');

  useEffect(() => {
    const paths = photoKey.split(',').filter(Boolean);
    if (paths.length) db.photoUrls(paths).then(setEventPhotos).catch(() => {});
  }, [photoKey]);

  if (!plant) return <div className="center c3">Cargando…</div>;

  const st = statuses[plant.id];
  const zone = zones.find((z) => z.id === plant.zone_id);
  const prof = PROFILES[plant.profile] || PROFILES.generica;
  const guide = wateringGuide(plant, { weather, status: st, events: myEvents });
  const tips = contextTips(plant, weather, st);
  const mist = mistStatus(plant, myEvents, weather, guide.mist);
  const lastDiag = checkins.find((e) => e.diagnosis);
  const myReminders = reminders.filter((r) => r.plant_id === plant.id).map((r) => ({ r, st: reminderStatus(r, events) }));
  const withThisWatering = myReminders.filter(({ r, st }) => r.mode === 'with_watering' && st.due);
  const season = seasonalCare(plant, new Date(), household.lat);
  const SEASON_ICON = { spring: ['sprout', '#34c759'], summer: ['sun', '#ff9500'], autumn: ['leaf', '#c66a2c'], winter: ['thermo', '#5ac8fa'] }[season.key];
  const history = showAll ? myEvents : myEvents.slice(0, 5);
  const sub = substrateFor(plant);
  const adjustPct = Math.round(((plant.adjust || 1) - 1) * 100);
  const gallery = [
    ...checkins.filter((e) => e.photo_path).map((e) => ({ ...e, url: eventPhotos[e.photo_path] })),
    ...(plant.photo_path ? [{ id: 'alta', at: plant.created_at, url: photos[plant.photo_path], alta: true }] : []),
  ];
  const heroUrl = gallery.find((g) => g.url)?.url;
  const placeText = `${zone ? zone.name + ' · ' : ''}${plant.location === 'outdoor' ? (plant.gets_rain ? 'Exterior' : 'Exterior cubierto') : 'Interior'}`;

  const run = async (fn) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const remove = () => run(async () => {
    if (!confirm(`¿Eliminar «${plant.name}»? Se borrará también su historial y sus fotos.`)) return;
    for (const e of checkins) if (e.photo_path) await db.removePhoto(e.photo_path);
    await db.deletePlant(plant);
    await reload();
    go('#/plants');
    notify('Planta eliminada');
  });

  const ringText = !st ? '—' : st.status === 'due' || st.status === 'overdue' ? 'Hoy' : st.daysUntil >= 60 ? '60+' : st.daysUntil;
  const nextText = !st ? 'Calculando…'
    : st.status === 'overdue' ? 'Necesita agua ya'
    : st.status === 'due' ? 'Toca regar hoy'
    : st.daysUntil === 1 ? 'Riego mañana' : `Próximo riego: ${fmtDate(st.nextDate + 'T12:00')}`;

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <div className={`hero-bar ${scrolled || !heroUrl ? 'scrolled' : ''}`}>
        <div className="hero-bar-inner">
          <a className={`icon-circle ${heroUrl ? 'glass' : ''}`} href="#/plants" aria-label="Volver"><Icon name="chevronLeft" size={20} stroke={2.6} /></a>
          <div className="navbar-title">{plant.name}</div>
          <a className={`icon-circle ${heroUrl ? 'glass' : ''}`} href={`#/edit/${plant.id}`} aria-label="Editar"><Icon name="pencil" size={18} /></a>
        </div>
      </div>

      {heroUrl ? (
        <div className="hero">
          <img src={heroUrl} alt="" />
          <div className="hero-shade" />
          <div className="hero-title">
            <h1>{plant.name}</h1>
            <p>{[plant.common_name && plant.common_name.toLowerCase() !== plant.name.toLowerCase() ? plant.common_name.charAt(0).toUpperCase() + plant.common_name.slice(1) : null, plant.species].filter(Boolean).join(' · ') || prof.label.split(' (')[0]}</p>
          </div>
        </div>
      ) : (
        <div className="hero no-photo">
          <div className="hero-title">
            <Avatar size={72} />
            <div>
              <h1 className="t-large">{plant.name}</h1>
              <p className="t-sub c2">{[plant.common_name && plant.common_name.toLowerCase() !== plant.name.toLowerCase() ? plant.common_name.charAt(0).toUpperCase() + plant.common_name.slice(1) : null, plant.species].filter(Boolean).join(' · ') || prof.label.split(' (')[0]}</p>
            </div>
          </div>
          <div style={{ height: 18 }} />
        </div>
      )}

      <div className="status-card">
        <Ring value={st?.dryness} color={drynessColor(st?.dryness || 0)}>
          <b className="num">{ringText}</b>
          <span>{typeof ringText === 'number' ? (ringText === 1 ? 'día' : 'días') : st ? 'riego' : ''}</span>
        </Ring>
        <div style={{ flex: 1, minWidth: 0 }}>
          <StatusPill status={st} />
          <div className="t-headline" style={{ marginTop: 8 }}>{nextText}</div>
          {withThisWatering.length > 0 && (
            <div className="t-foot notify-note" style={{ color: 'var(--tint)' }}><Icon name="flask" size={14} />
              Con este riego: {withThisWatering.map(({ r }) => r.title.toLowerCase()).join(', ')}
            </div>
          )}
          {st && st.status !== 'due' && st.status !== 'overdue' && st.daysUntil < 60 && (ctx.push?.on ? (
            <div className="t-foot notify-note"><Icon name="bell" size={14} />
              Te avisaremos {st.daysUntil === 1 ? 'mañana' : `el ${new Date(st.nextDate + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long' })}`} a las {fmtHour(ctx.push.hour)}
            </div>
          ) : canAskPush() && (
            <button className="t-foot notify-note c-tint" style={{ background: 'none', border: 0, padding: 0, font: 'inherit', cursor: 'pointer' }}
              onClick={() => ctx.openNotify({ step: 'hour' })}>
              <Icon name="bell" size={14} /> Avísame ese día
            </button>
          ))}
          <div className="t-foot c2" style={{ marginTop: 4, lineHeight: 1.4 }}>
            {st ? <>Sequedad estimada: {Math.round(st.dryness * 100)} %<br />Último riego: {st.lastWatered ? fmtRelDays(st.daysSinceWater).toLowerCase() : 'sin registrar'}</> : null}
          </div>
        </div>
      </div>

      <div className="actions">
        <button className="action water" disabled={busy} onClick={() => run(() => waterPlants(ctx, [plant]))}>
          <Icon name="dropFill" size={24} stroke={0} />Regar
        </button>
        <a className="action" href={`#/checkin/${plant.id}`}><Icon name="camera" size={24} />Revisar</a>
        <a className="action" href={`#/ask/${plant.id}`}><Icon name="bubble" size={24} />Florencio</a>
        {guide.mist && (
          <button className="action mist" disabled={busy} onClick={() => run(() => mistPlants(ctx, [plant]))}>
            <Icon name="mist" size={24} />Pulverizar
          </button>
        )}
      </div>

      {!plant.species && (
        <Section footer="Sin la especie, los cuidados son genéricos. Con la foto la identifico y ajusto el riego.">
          <Cell icon="sparkles" iconBg="#34c759" title={<span className="c-tint">Identificar la planta</span>} chevron href={`#/edit/${plant.id}`} />
        </Section>
      )}

      <Section header="Recomendaciones de riego" inset="icon"
        footer={['due', 'overdue', 'soon'].includes(st?.status) ? 'Antes de regar, pulsa «Revisar»: con una foto y el estado de la tierra, BotanIQ afina sus cálculos.' : null}>
        {guide.today && (
          <div className="care-line today-line">
            <span className="cell-icon" style={{ background: 'var(--water)' }}><Icon name="dropFill" size={18} stroke={0} /></span>
            <div>
              <div className="eyebrow">Hoy, mejor</div>
              <div className="t-headline">{guide.today.title}</div>
              <p className="c2" style={{ marginTop: 2 }}>{guide.today.how}</p>
              <p className="t-foot c2" style={{ marginTop: 6 }}>{guide.today.why}</p>
            </div>
          </div>
        )}
        <div className="care-line">
          <span className="cell-icon" style={{ background: guide.today ? '#8e8e93' : 'var(--water)' }}><Icon name={guide.tech === 'soak' || guide.tech === 'tray' ? 'dropFill' : 'drop'} size={18} stroke={guide.tech === 'soak' || guide.tech === 'tray' ? 0 : 2.2} /></span>
          <div>
            <div className="eyebrow">{guide.today ? 'Normalmente' : 'Modo de riego'}</div>
            <div className="t-headline">{guide.title}</div>
            <div className="t-sub" style={{ marginTop: 1 }}>{guide.detail}</div>
            <p className="c2" style={{ marginTop: 4 }}>{guide.how}</p>
            {guide.why.length > 0 && (
              <ul className="why-list">
                {guide.why.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </div>
        </div>
        {guide.alt && (
          <div className="care-line">
            <span className="cell-icon" style={{ background: '#8e8e93' }}><Icon name="drop" size={18} stroke={2.2} /></span>
            <p className="c2">{guide.alt}</p>
          </div>
        )}
        {guide.ifDry && (
          <div className="care-line">
            <span className="cell-icon" style={{ background: '#c66a2c' }}><Icon name="humidity" size={18} stroke={2.2} /></span>
            <p className="c2">{guide.ifDry}</p>
          </div>
        )}
        {guide.amountText && (
          <Cell icon="pot" iconBg="#a2845e" title="Cantidad" sub={plant.pot_drainage === false ? 'Reducida: la maceta no tiene agujeros' : 'Orientativa, según la maceta'} value={guide.amountText} />
        )}
        {guide.water && <Cell icon="drop" iconBg="#5ac8fa" title="Agua" sub={guide.water} />}
        <Cell icon="clock" iconBg="#ff9500" title="Cuándo" sub={guide.when} />
        {guide.mistAdvice && (
          <Cell icon="mist" iconBg={guide.mistAdvice.every ? '#30b0c7' : '#8e8e93'} title={guide.mistAdvice.title}
            sub={guide.mistAdvice.every && mist?.needed
              ? `${mist.due ? 'Hoy toca. ' : mist.since !== Infinity ? `Última vez hace ${mist.since} ${mist.since === 1 ? 'día' : 'días'}. ` : ''}${guide.mistAdvice.sub}`
              : guide.mistAdvice.sub} />
        )}
        <div className="care-line">
          <span className="cell-icon" style={{ background: '#ffcc00' }}><Icon name="bulb" size={18} stroke={2.2} /></span>
          <p className="c2">{guide.tip}</p>
        </div>
      </Section>

      <Section header="Recordatorios" inset="icon"
        footer={myReminders.length ? 'Los que van con el riego se dan por hechos al pulsar «Regar», y aparecen en el aviso de ese día.' : 'Pregunta a Florencio, tu botánico de confianza, cómo usar tu abono o qué rutina le conviene, y te lo recordamos con el riego.'}>
        {myReminders.map(({ r, st: rs }) => (
          <Cell key={r.id} icon="flask" iconBg={rs.off ? '#8e8e93' : '#34c759'} title={r.title}
            sub={[cadenceText(r), r.note].filter(Boolean).join(' · ')}
            value={<span className={rs.due && !rs.off ? 'c-tint' : ''}>{reminderWhen(rs)}</span>} chevron
            onClick={() => setOpenReminder(r)} />
        ))}
        <Cell icon="sparkles" iconBg="var(--tint)" title={<span className="c-tint">{myReminders.length ? 'Añadir otro con Florencio' : 'Añadir con Florencio'}</span>} chevron href={`#/ask/${plant.id}`} />
      </Section>

      <Section header="Esta época" inset="icon" footer={`Lo normal ahora: ${season.normal}.`}>
        <div className="care-line">
          <span className="cell-icon" style={{ background: SEASON_ICON[1] }}><Icon name={SEASON_ICON[0]} size={18} stroke={2.2} /></span>
          <div>
            <div className="t-headline">{season.name} · {season.phase} de estación</div>
            <p className="c2" style={{ marginTop: 2 }}>{season.care}</p>
          </div>
        </div>
        <Cell icon="sunDim" iconBg="#ffcc00" title="Horas de luz" sub={`Los días se ${season.trend}`} value={fmtHours(season.dayHours)} />
        <Cell icon="sprout" iconBg="#34c759" title="Crecimiento" value={season.growth.charAt(0).toUpperCase() + season.growth.slice(1)} />
      </Section>

      {tips.length > 0 && (
        <Section header="Según el tiempo" inset="icon">
          {tips.map((t, i) => {
            const [icon, color] = TIP_ICON[t.icon] || ['bulb', '#8e8e93'];
            return (
              <div className="care-line" key={i}>
                <span className="cell-icon" style={{ background: color }}><Icon name={icon} size={18} stroke={2.2} /></span>
                <p>{t.text}</p>
              </div>
            );
          })}
        </Section>
      )}

      {gallery.length > 0 && (
        <section className="section">
          <div className="section-header big">
            <span>Evolución</span>
            <a className="t-sub" href={`#/checkin/${plant.id}`} style={{ fontWeight: 400 }}>Nueva foto</a>
          </div>
          <div className="gallery">
            {gallery.map((g) => (
              <button key={g.id} className="gallery-item" onClick={() => setOpen(g)}>
                {g.url ? <img src={g.url} alt="" loading="lazy" /> : <div className="tile-empty"><Icon name="sprout" size={32} /></div>}
                <span className="cap">{g.alta ? 'Alta' : fmtShort(g.at)}</span>
                {g.diagnosis && <span className={`dot dot-${OVERALL[g.diagnosis.overall]?.cls}`} />}
              </button>
            ))}
          </div>
        </section>
      )}

      {lastDiag && (
        <section className="section">
          <div className="section-header"><span>Último diagnóstico</span></div>
          <Diagnosis d={lastDiag.diagnosis} date={fmtShort(lastDiag.at)} />
        </section>
      )}

      <Section header="Detalles" inset="icon">
        <Cell icon="sprout" iconBg="#34c759" title="Tipo" value={prof.label.split(' (')[0]} />
        <Cell icon="house" iconBg="#5856d6" title="Ubicación" value={placeText} />
        <Cell icon="sun" iconBg="#ff9500" title="Luz" value={LIGHTS[plant.light]?.label} />
        <Cell icon="leaf" iconBg="#a2845e" title="Sustrato" value={`${SUBSTRATES[sub]?.label.split(' (')[0].split(' / ')[0]}${plant.substrate === 'unknown' ? '*' : ''}`} />
        <Cell icon="pot" iconBg="#8e8e93" title="Maceta" value={`${POTS[plant.pot]?.label.split(' (')[0]}, ${POT_MATERIALS[plant.pot_material]?.label.split(' /')[0].toLowerCase()}${plant.pot_drainage === false ? ', sin drenaje' : ''}`} />
        <Cell icon="sparkles" iconBg="#af52de" title="Ajuste aprendido"
          value={adjustPct === 0 ? 'Ninguno' : adjustPct > 0 ? `Se seca un ${adjustPct} % antes` : `Se seca un ${-adjustPct} % después`}
          onClick={adjustPct !== 0 ? () => run(async () => {
            if (!confirm('¿Restablecer lo aprendido para esta planta?')) return;
            await db.savePlant({ id: plant.id, adjust: 1 }); await reload();
          }) : undefined} />
      </Section>
      {plant.substrate === 'unknown' && <p className="section-footer" style={{ margin: '-22px 16px 28px' }}>* Sustrato supuesto: el habitual de tienda para este tipo de planta.</p>}
      {plant.notes && <Section header="Notas"><div className="cell"><p className="t-sub">{plant.notes}</p></div></Section>}

      <Section header="Historial" inset="icon"
        footer={myEvents.length > 5 && !showAll ? <button className="action-link" style={{ background: 'none', border: 'none', color: 'var(--tint)', padding: 0, fontSize: 13, cursor: 'pointer' }} onClick={() => setShowAll(true)}>Ver todo ({myEvents.length})</button> : null}>
        {history.length === 0 && <Cell title="Sin registros todavía" className="c2" />}
        {history.map((e) => {
          const ev = EVENT[e.type] || { icon: 'clock', color: '#8e8e93', label: () => e.type };
          return (
            <Cell key={e.id} icon={ev.icon} iconBg={ev.color} title={ev.label(e)} sub={e.note || undefined} value={fmtTime(e.at)}
              onClick={() => run(async () => { if (!confirm('¿Borrar este registro?')) return; await db.deleteEvent(e); await reload(); })} />
          );
        })}
      </Section>

      <Section>
        <Cell title="Eliminar planta" danger onClick={remove} />
      </Section>

      {openReminder && (
        <Sheet onClose={() => setOpenReminder(null)}>
          <div className="content" style={{ padding: '8px 16px 12px' }}>
            <div className="t-title3">{openReminder.title}</div>
            <p className="t-sub c2" style={{ marginTop: 6, lineHeight: 1.4 }}>
              {[cadenceText(openReminder), openReminder.note].filter(Boolean).join('. ')}.
              {openReminder.last_done_at ? ` Última vez: ${new Date(openReminder.last_done_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}.` : ''}
            </p>
          </div>
          <div className="content stack">
            <button className="btn block" onClick={() => { const r = openReminder; setOpenReminder(null); completeReminder(ctx, r); }}>Marcar como hecho hoy</button>
            <button className="btn gray block" style={{ color: 'var(--red)' }} onClick={async () => {
              const r = openReminder; setOpenReminder(null);
              try { await db.deleteReminder(r.id); await reload(); notify('Recordatorio eliminado'); } catch (e) { notify(e.message); }
            }}>Eliminar recordatorio</button>
          </div>
        </Sheet>
      )}
      {open && (
        <Sheet onClose={() => setOpen(null)}>
          {open.url && <img className="full" src={open.url} alt="" />}
          <div style={{ padding: '16px 0 0' }}>
            <div className="content" style={{ marginBottom: 14 }}>
              <div className="t-title3">{open.alta ? 'Foto del alta' : fmtDate(open.at)}</div>
              {open.soil && <div className="t-sub c2" style={{ marginTop: 2 }}>Tierra: {SOIL[open.soil]?.label.toLowerCase()}</div>}
              {open.note && <p className="t-sub" style={{ marginTop: 8 }}>{open.note}</p>}
            </div>
            {open.diagnosis && <div className="section"><Diagnosis d={open.diagnosis} /></div>}
            <div className="content"><button className="btn gray block" onClick={() => setOpen(null)}>Cerrar</button></div>
          </div>
        </Sheet>
      )}
    </div>
  );
}
