import { useEffect, useState } from 'react';
import * as db from '../lib/data.js';
import { go } from '../lib/nav.js';
import { PROFILES, SUBSTRATES, LIGHTS, POTS, POT_MATERIALS, substrateFor } from '../lib/profiles.js';
import { SOIL, mistStatus } from '../lib/watering.js';
import { wateringGuide, contextTips } from '../lib/care.js';
import { seasonalCare, fmtHours } from '../lib/season.js';
import { OVERALL } from '../lib/diagnose.js';
import { waterPlants, mistPlants } from '../lib/actions.js';
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
  const { plantId, plants, zones, events, statuses, photos, weather, household, reload, notify } = ctx;
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
  const guide = wateringGuide(plant);
  const tips = contextTips(plant, weather);
  const mist = mistStatus(plant, myEvents, weather, guide.mist);
  const lastDiag = checkins.find((e) => e.diagnosis);
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
            <p>{[plant.common_name, plant.species].filter(Boolean).join(' · ') || prof.label}</p>
          </div>
        </div>
      ) : (
        <div className="hero no-photo">
          <div className="hero-title">
            <Avatar size={72} />
            <div>
              <h1 className="t-large">{plant.name}</h1>
              <p className="t-sub c2">{[plant.common_name, plant.species].filter(Boolean).join(' · ') || prof.label}</p>
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

      <Section header="Cómo regarla" inset="icon"
        footer={['due', 'overdue', 'soon'].includes(st?.status) ? 'Antes de regar, pulsa «Revisar»: con una foto y el estado de la tierra, BotanIQ afina sus cálculos.' : null}>
        <div className="care-line">
          <span className="cell-icon" style={{ background: 'var(--water)' }}><Icon name="drop" size={18} stroke={2.2} /></span>
          <div>
            <div className="t-headline">{guide.method}</div>
            <p className="c2" style={{ marginTop: 2 }}>{guide.how}</p>
          </div>
        </div>
        {guide.amountText && (
          <Cell icon="pot" iconBg="#a2845e" title="Cantidad" sub="Orientativa, según la maceta" value={guide.amountText} />
        )}
        {guide.mist && mist && (
          <Cell icon="mist" iconBg="#30b0c7" title={`Pulverizar cada ${guide.mist.everyDays} días`}
            sub={mist.needed ? (mist.due ? 'Hoy toca' : `Última vez hace ${mist.since} días`) : `Ahora no hace falta · humedad ~${Math.round(mist.rh)} %`} />
        )}
        <div className="care-line">
          <span className="cell-icon" style={{ background: '#ffcc00' }}><Icon name="bulb" size={18} stroke={2.2} /></span>
          <p className="c2">{guide.tip}</p>
        </div>
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
        <Section header="Con el tiempo de hoy" inset="icon">
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
