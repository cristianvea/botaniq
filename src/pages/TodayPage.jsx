import { useState } from 'react';
import { waterPlants, mistPlants, completeReminder, dueWithWatering } from '../lib/actions.js';
import { reminderStatus } from '../lib/reminders.js';
import { mistStatus } from '../lib/watering.js';
import { wateringGuide } from '../lib/care.js';
import { seasonInfo, fmtHours } from '../lib/season.js';
import { canAskPush, alreadyAsked, markAsked } from '../lib/push.js';
import { NavBar, Section, Icon, Avatar, Meter, StatusPill, fmtRelDays } from '../components/ui.jsx';

const ORDER = { overdue: 0, due: 1, soon: 2, ok: 3 };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function TodayPage(ctx) {
  const { household, households, zones, events, plants: allPlants, statuses, weather, weatherError, photos, loading, selectHousehold } = ctx;
  const [zoneFilter, setZoneFilter] = useState('all');
  const [done, setDone] = useState({});
  const [hideBanner, setHideBanner] = useState(false);
  const showBanner = !hideBanner && ctx.push?.ready && !ctx.push.on && allPlants.length > 0 && canAskPush() && !alreadyAsked();
  const zoneById = Object.fromEntries(zones.map((z) => [z.id, z]));
  const filter = zoneFilter === 'all' || zoneById[zoneFilter] ? zoneFilter : 'all';
  const plants = filter === 'all' ? allPlants : allPlants.filter((p) => p.zone_id === filter);

  const sorted = [...plants].sort((a, b) => {
    const sa = statuses[a.id], sb = statuses[b.id];
    if (!sa || !sb) return a.name.localeCompare(b.name);
    return ORDER[sa.status] - ORDER[sb.status] || sa.daysUntil - sb.daysUntil || sb.dryness - sa.dryness;
  });
  const isDue = (p) => ['due', 'overdue'].includes(statuses[p.id]?.status);
  const needWater = sorted.filter(isDue);
  const week = sorted.filter((p) => !isDue(p) && statuses[p.id] && statuses[p.id].daysUntil <= 7);
  const toMist = weather ? plants.filter((p) => {
    const g = wateringGuide(p).mist;
    return g && mistStatus(p, events.filter((e) => e.plant_id === p.id), weather, g)?.due;
  }) : [];

  // Recordatorios por días (girar la maceta, abono granulado…) que tocan hoy
  const careDue = (ctx.reminders || []).filter((r) => r.mode === 'every_days'
    && plants.some((p) => p.id === r.plant_id) && reminderStatus(r, events).due);

  const water = async (list) => {
    setDone((d) => ({ ...d, ...Object.fromEntries(list.map((p) => [p.id, true])) }));
    await waterPlants(ctx, list);
    setDone({});
  };

  const today = weather?.days.find((d) => d.date === weather.today);
  const season = seasonInfo(new Date(), household.lat);
  const dateText = cap(new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
  const sub = (p) => {
    const st = statuses[p.id];
    return [zoneById[p.zone_id]?.name, st ? fmtRelDays(st.daysSinceWater) : null].filter(Boolean).join(' · ');
  };

  const allDue = allPlants.filter(isDue).length;
  const next = !allDue && sorted.find((p) => statuses[p.id]);
  const rainy = today && today.precip >= 2;
  const tone = allDue ? '' : rainy ? 'rain' : 'calm';

  return (
    <div className="screen with-tabs">
      <NavBar
        title="Hoy" large sub={import.meta.env.VITE_DEMO ? `${dateText} · Demo` : dateText}
        right={<a className="icon-circle" href="#/new" aria-label="Añadir planta"><Icon name="plus" size={20} stroke={2.4} /></a>}
      />

      {weather ? (
        <div className={`summary ${tone}`}>
          <div className="summary-top">
            <div>
              {households.length > 1 ? (
                <select className="place" value={household.id} onChange={(e) => selectHousehold(e.target.value)}
                  style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', fontWeight: 600, padding: 0 }}>
                  {households.map((h) => <option key={h.id} value={h.id} style={{ color: '#000' }}>{h.name}</option>)}
                </select>
              ) : <div className="place">{household.name}</div>}
              <div className="meta">{(household.place_name || '').split(',')[0]}</div>
              <div className="meta">{season.name} · {fmtHours(season.dayHours)} de luz</div>
            </div>
            <div className="big num">{Math.round(weather.current.temp)}°</div>
          </div>
          <div className="summary-msg">
            {allDue ? `${allDue === 1 ? '1 planta necesita' : `${allDue} plantas necesitan`} agua` : allPlants.length ? 'Todo en orden' : 'Bienvenido a BotanIQ'}
          </div>
          <p>
            {allDue
              ? 'Revisa la tierra antes de regar.'
              : next ? `Próximo riego: ${next.name}, ${statusTextLower(statuses[next.id])}.` : 'Añade tu primera planta para empezar.'}
          </p>
          <div className="summary-stats">
            <div><b className="num">{Math.round(weather.current.rh)}%</b><span>Humedad</span></div>
            <div><b className="num">{today ? `${Math.round(today.tmax)}° / ${Math.round(today.tmin)}°` : '—'}</b><span>Máx. / mín.</span></div>
            <div><b className="num">{today ? `${today.precip.toFixed(today.precip < 10 ? 1 : 0)} mm` : '—'}</b><span>Lluvia hoy</span></div>
          </div>
        </div>
      ) : (
        <Section footer={weatherError ? `Sin datos del tiempo: ${weatherError}` : 'Consultando el tiempo…'} />
      )}

      {showBanner && (
        <div className="notify-banner">
          <div className="notify-glyph"><Icon name="bell" size={22} /></div>
          <div className="grow">
            <div className="t-headline">¿Te avisamos para regar?</div>
            <div className="t-foot c2">Elige a qué hora te viene bien.</div>
          </div>
          <button className="btn" onClick={() => ctx.openNotify({ step: 'hour' })}>Activar</button>
          <button className="icon-circle" aria-label="Ahora no" onClick={() => { markAsked(); setHideBanner(true); }}><Icon name="close" size={14} stroke={2.6} /></button>
        </div>
      )}

      {zones.length > 1 && allPlants.length > 0 && (
        <div className="chips" role="tablist">
          <button className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setZoneFilter('all')}>Todas</button>
          {zones.map((z) => {
            const n = allPlants.filter((p) => p.zone_id === z.id && isDue(p)).length;
            return (
              <button key={z.id} className={`chip ${filter === z.id ? 'on' : ''}`} onClick={() => setZoneFilter(z.id)}>
                {z.name}{n > 0 && <span className="count">{n}</span>}
              </button>
            );
          })}
        </div>
      )}

      {allPlants.length === 0 && !loading && (
        <div className="empty-state">
          <div className="glyph emoji">🪴</div>
          <h2 className="t-title2">Tu jardín está vacío</h2>
          <p className="t-sub c2">Haz una foto a una planta y BotanIQ la identificará y te dirá cuándo regarla.</p>
          <a className="btn" href="#/new"><Icon name="camera" size={20} /> Añadir planta</a>
        </div>
      )}

      {needWater.length > 0 && (
        <Section
          header="💧 Regar" big inset="avatar"
          action={needWater.length > 1 && <button className="action-link" onClick={() => water(needWater)}>Regar todas</button>}
        >
          {needWater.map((p) => (
            <PlantRow key={p.id} plant={p} url={photos[p.photo_path]} sub={sub(p)} st={statuses[p.id]} how={[dueWithWatering(ctx, p).map((r) => `🌱 ${r.title}`).join(', '), wateringGuide(p, { weather, status: statuses[p.id], events: events.filter((e) => e.plant_id === p.id) }).short].filter(Boolean).join(' · ')}>
              <a className="icon-circle" href={`#/checkin/${p.id}`} aria-label={`Revisar ${p.name}`}><Icon name="camera" size={18} /></a>
              <button className={`water-btn ${done[p.id] ? 'done' : ''}`} onClick={() => water([p])} aria-label={`Marcar ${p.name} como regada`}>
                <Icon name={done[p.id] ? 'check' : 'dropFill'} size={20} stroke={done[p.id] ? 2.6 : 0} />
              </button>
            </PlantRow>
          ))}
        </Section>
      )}

      {toMist.length > 0 && (
        <Section
          header="💦 Pulverizar" big inset="avatar"
          footer="El aire está seco para estas plantas. Pulveriza las hojas con agua sin cal."
          action={toMist.length > 1 && <button className="action-link" onClick={() => mistPlants(ctx, toMist)}>Todas</button>}
        >
          {toMist.map((p) => (
            <PlantRow key={p.id} plant={p} url={photos[p.photo_path]} sub={zoneById[p.zone_id]?.name}>
              <button className="water-btn mist" onClick={() => mistPlants(ctx, [p])} aria-label={`Marcar ${p.name} como pulverizada`}>
                <Icon name="mist" size={20} />
              </button>
            </PlantRow>
          ))}
        </Section>
      )}

      {careDue.length > 0 && (
        <Section header="🌱 Otros cuidados" big inset="avatar">
          {careDue.map((r) => {
            const p = allPlants.find((x) => x.id === r.plant_id);
            return (
              <PlantRow key={r.id} plant={p} url={photos[p.photo_path]} sub={`🌱 ${r.title}`} how={r.note}>
                <button className="water-btn care" onClick={() => completeReminder(ctx, r)} aria-label={`Marcar ${r.title} como hecho`}>
                  <Icon name="check" size={20} stroke={2.6} />
                </button>
              </PlantRow>
            );
          })}
        </Section>
      )}

      {week.length > 0 && (
        <Section header="📅 Esta semana" big inset="avatar">
          {week.map((p) => (
            <PlantRow key={p.id} plant={p} url={photos[p.photo_path]} sub={sub(p)} st={statuses[p.id]} pill />
          ))}
        </Section>
      )}

      {allPlants.length > 0 && needWater.length === 0 && week.length === 0 && (
        <Section footer="Ninguna planta necesita agua en los próximos 7 días." />
      )}
    </div>
  );
}

function statusTextLower(st) {
  if (!st) return '';
  if (st.status === 'soon' || st.daysUntil === 1) return 'mañana';
  if (st.status === 'due' || st.status === 'overdue') return 'hoy';
  return st.daysUntil >= 60 ? 'sin prisa' : `en ${st.daysUntil} días`;
}

function PlantRow({ plant, url, sub, st, how, pill, children }) {
  return (
    <div className="cell" style={{ paddingTop: 12, paddingBottom: 12 }}>
      <a href={`#/plant/${plant.id}`} className="row" style={{ flex: 1, minWidth: 0, color: 'inherit', gap: 12 }}>
        <Avatar url={url} size={52} />
        <div className="cell-main">
          <div className="cell-title t-headline">{plant.name}</div>
          {sub && <div className="cell-sub t-foot" style={{ fontSize: 14 }}>{sub}</div>}
          {how && <div className="t-foot c2" style={{ marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{how}</div>}
          {st && !pill && <Meter value={st.dryness} />}
        </div>
      </a>
      {pill && <StatusPill status={st} />}
      {children}
    </div>
  );
}
