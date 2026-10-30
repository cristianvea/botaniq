import { useRef, useState } from 'react';
import * as db from '../lib/data.js';
import { go } from '../lib/nav.js';
import { resizeImage } from '../lib/image.js';
import { diagnosePhoto } from '../lib/diagnose.js';
import { PROFILES, LIGHTS, SUBSTRATES, POTS, substrateFor } from '../lib/profiles.js';
import { SOIL, learnFromSoil, indoorClimate } from '../lib/watering.js';
import { seasonalCare, fmtHours } from '../lib/season.js';
import { waterPlants } from '../lib/actions.js';
import { NavBar, Section, Cell, Icon, Meter, Switch, Spinner, TextField } from '../components/ui.jsx';
import Diagnosis from '../components/Diagnosis.jsx';

const LIGHT_ORDER = ['low', 'indirect', 'direct'];
// Plantas a las que no conviene recomendar sol directo aunque la IA pida "más luz"
const NO_DIRECT_SUN = ['tropical', 'tropical_humeda', 'orquidea', 'resistente', 'palmera'];

const SOIL_UI = {
  wet: { icon: 'humidity', color: '#5e6ad2', hint: 'Sale agua al apretar, brilla' },
  moist: { icon: 'drop', color: '#0a7aff', hint: 'Fresca, se pega al dedo' },
  dry_top: { icon: 'sunDim', color: '#ff9500', hint: 'Seca arriba, húmeda debajo' },
  dry: { icon: 'sun', color: '#ff3b30', hint: 'Seca y suelta en profundidad' },
};

export default function CheckinPage(ctx) {
  const { plantId, plants, zones, statuses, weather, household, user, reload, notify } = ctx;
  const plant = plants.find((p) => p.id === plantId);
  const [blob, setBlob] = useState(null);
  const [preview, setPreview] = useState(null);
  const [soil, setSoil] = useState(null);
  const [note, setNote] = useState('');
  const [analyze, setAnalyze] = useState(true);
  const [phase, setPhase] = useState('form'); // form | saving | done
  const [step, setStep] = useState('');
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  if (!plant) return <div className="center c3">Cargando…</div>;

  const st = statuses[plant.id];
  const prof = PROFILES[plant.profile] || PROFILES.generica;
  const zone = zones.find((z) => z.id === plant.zone_id);
  const soilHint = plant.profile === 'orquidea'
    ? 'En orquídeas mira las raíces: plateadas significa seca; verdes, húmeda.'
    : plant.profile === 'tillandsia'
      ? 'Hojas enrolladas o muy grises: necesita agua.'
      : 'Mete un dedo 2–3 cm en el sustrato.';
  const maxLight = NO_DIRECT_SUN.includes(plant.profile) && plant.location === 'indoor' ? 1 : 2;

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b = await resizeImage(file, 1280);
    setBlob(b);
    setPreview(URL.createObjectURL(b));
  };

  const buildContext = () => {
    const day = weather?.days.find((d) => d.date === weather.today);
    const inside = day && plant.location === 'indoor' ? indoorClimate(day) : null;
    return {
      planta: plant.name,
      especie: plant.species || plant.common_name,
      tipo: prof.label,
      zona: `${zone?.name || ''} (${plant.location === 'outdoor' ? (plant.gets_rain ? 'exterior' : 'exterior bajo techo') : 'interior'})`,
      luz: LIGHTS[plant.light]?.label,
      sustrato: SUBSTRATES[substrateFor(plant)]?.label,
      maceta: `${POTS[plant.pot]?.label}${plant.pot_drainage === false ? ', SIN agujeros de drenaje' : ', con drenaje'}`,
      dias_desde_ultimo_riego: st?.daysSinceWater ?? 'desconocido',
      sequedad_estimada_por_la_app: st ? `${Math.round(st.dryness * 100)} %` : null,
      tierra_segun_usuario: soil ? SOIL[soil].label : 'no lo ha mirado',
      tiempo_exterior_hoy: day ? `${Math.round(day.tmin)}–${Math.round(day.tmax)} °C, humedad ${Math.round(day.rh ?? 0)} %` : null,
      ambiente_interior_estimado: inside ? `${Math.round(inside.t)} °C, humedad ${Math.round(inside.rh)} %` : null,
      ...(() => {
        const s = seasonalCare(plant, new Date(), household.lat);
        return {
          fecha: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
          estacion: `${s.name} (${s.phase} de la estación), hemisferio ${household.lat < 0 ? 'sur' : 'norte'}`,
          horas_de_luz: `${fmtHours(s.dayHours)} (los días se ${s.trend})`,
          fase_de_crecimiento_esperada: s.growth,
          normal_en_esta_epoca: s.normal,
        };
      })(),
      nota_del_usuario: note,
    };
  };

  const save = async () => {
    if (!blob && !soil) return notify('Haz una foto o indica cómo está la tierra');
    setPhase('saving');
    try {
      let photo_path = null;
      if (blob) { setStep('Subiendo foto…'); photo_path = await db.uploadPhoto(household.id, blob); }
      const ev = await db.addEvent(plant, 'checkin', user.id, new Date(), { soil, note: note || null, photo_path });

      let newAdjust = plant.adjust || 1;
      // Solo aprende si hay un riego registrado (si no, la sequedad era una suposición) y sin frecuencia fijada
      if (soil && st && st.lastWatered && !(plant.fixed_days > 0)) {
        newAdjust = learnFromSoil(plant.adjust, st.dryness, soil);
        if (Math.abs(newAdjust - (plant.adjust || 1)) > 0.001) await db.savePlant({ id: plant.id, adjust: newAdjust });
      }

      let diagnosis = null, diagError = null;
      if (blob && analyze) {
        setStep('Analizando la foto…');
        try {
          diagnosis = await diagnosePhoto(blob, buildContext());
          await db.updateEvent(ev.id, { diagnosis });
        } catch (e) { diagError = e.message; }
      }
      await reload();
      setResult({ diagnosis, diagError, adjustChange: newAdjust / (plant.adjust || 1) });
      setPhase('done');
      window.scrollTo(0, 0);
    } catch (e) {
      notify(e.message);
      setPhase('form');
    }
  };

  const applyWatering = async (dir) => {
    if (plant.fixed_days > 0) {
      // Con frecuencia fijada, movemos un día la frecuencia
      await db.savePlant({ id: plant.id, fixed_days: Math.max(1, plant.fixed_days + (dir === 'more_often' ? -1 : 1)) });
    } else {
      const adjust = Math.min(2.5, Math.max(0.4, (plant.adjust || 1) * (dir === 'more_often' ? 1.12 : 0.88)));
      await db.savePlant({ id: plant.id, adjust });
    }
    await reload();
    notify(dir === 'more_often' ? 'Te avisaré para regarla antes' : 'Espaciaré más sus riegos');
    setResult((r) => ({ ...r, appliedWatering: true }));
  };

  const applyLight = async (light) => {
    await db.savePlant({ id: plant.id, light });
    await reload();
    notify(`Luz actualizada: ${LIGHTS[light].label.toLowerCase()}`);
    setResult((r) => ({ ...r, appliedLight: true }));
  };

  // ───────── Resultado ─────────
  if (phase === 'done') {
    const d = result.diagnosis;
    const curStatus = statuses[plant.id]?.status;
    const needsWater = soil === 'dry' || (soil === 'dry_top' && ['due', 'overdue', 'soon'].includes(curStatus));
    const idx = LIGHT_ORDER.indexOf(plant.light);
    const lightTarget = d?.light === 'more' ? LIGHT_ORDER[Math.min(maxLight, idx + 1)] : d?.light === 'less' ? LIGHT_ORDER[Math.max(0, idx - 1)] : null;
    const soilMsg = {
      wet: 'Está encharcada: no riegues y vacía el plato. Si se repite, el sustrato o la maceta drenan mal.',
      moist: 'Aún tiene agua. Espera: ya lo he tenido en cuenta para el próximo aviso.',
      dry_top: 'Empieza a secarse; le queda poco para necesitar agua.',
      dry: 'Está seca: toca regarla.',
    };
    return (
      <div className="screen">
        <NavBar title="Revisión guardada" right={<a className="nav-btn bold" href={`#/plant/${plant.id}`}>OK</a>} />
        {preview && <div className="photo-wide" style={{ cursor: 'default' }}><img src={preview} alt="" /></div>}

        {soil && (
          <Section header="Tierra" inset="icon"
            footer={result.adjustChange < 0.99 ? 'BotanIQ ha aprendido que esta planta se seca más despacio de lo que calculaba.'
              : result.adjustChange > 1.01 ? 'BotanIQ ha aprendido que esta planta se seca más rápido de lo que calculaba.' : null}>
            <div className="care-line">
              <span className="cell-icon" style={{ background: SOIL_UI[soil].color }}><Icon name={SOIL_UI[soil].icon} size={18} stroke={2.2} /></span>
              <div>
                <div className="t-headline">{SOIL[soil].label}</div>
                <p className="c2" style={{ marginTop: 2 }}>{soilMsg[soil]}</p>
              </div>
            </div>
          </Section>
        )}

        {needsWater && (
          <div className="content" style={{ marginBottom: 28 }}>
            <button className="btn water block" onClick={async () => { await waterPlants(ctx, [plant]); go(`#/plant/${plant.id}`); }}>
              <Icon name="dropFill" size={20} stroke={0} /> La riego ahora
            </button>
          </div>
        )}

        {result.diagError && <Section footer={`No se pudo analizar la foto: ${result.diagError}`} />}

        {d && (
          <section className="section">
            <div className="section-header"><span>Diagnóstico</span></div>
            <Diagnosis d={d} date="Orientativo" />
          </section>
        )}

        {d && ((d.watering !== 'keep' && !result.appliedWatering) || (lightTarget && lightTarget !== plant.light && !result.appliedLight)) && (
          <Section header="Aplicar sugerencias" inset="icon">
            {d.watering !== 'keep' && !result.appliedWatering && (
              <Cell icon="drop" iconBg="var(--water)" title={d.watering === 'less_often' ? 'Regarla con menos frecuencia' : 'Regarla más a menudo'}
                sub="Ajusta su ritmo un 12 %" chevron onClick={() => applyWatering(d.watering)} />
            )}
            {lightTarget && lightTarget !== plant.light && !result.appliedLight && (
              <Cell icon={d.light === 'more' ? 'sun' : 'sunDim'} iconBg="#ff9500" title="Ya la he cambiado de sitio"
                sub={`Ahora tiene: ${LIGHTS[lightTarget].label.toLowerCase()}`} chevron onClick={() => applyLight(lightTarget)} />
            )}
          </Section>
        )}
      </div>
    );
  }

  // ───────── Formulario ─────────
  const saving = phase === 'saving';
  return (
    <div className="screen">
      <NavBar
        title={`Revisar ${plant.name}`}
        left={<a className="nav-btn" href={`#/plant/${plant.id}`}>Cancelar</a>}
        right={<button className="nav-btn bold" disabled={saving} onClick={save}>{saving ? <Spinner /> : 'Guardar'}</button>}
      />

      <button className="photo-wide" onClick={() => fileRef.current.click()} disabled={saving}>
        {preview ? <img src={preview} alt="" /> : (
          <>
            <span className="glyph"><Icon name="camera" size={30} /></span>
            <span className="t-headline" style={{ color: 'var(--label)' }}>Foto de hoy</span>
            <span className="t-foot">La planta entera, con buena luz</span>
          </>
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />

      {st && (
        <Section header="Estimación de BotanIQ">
          <div className="cell" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
            <div className="row between"><span>Sequedad</span><span className="c2 num">{Math.round(st.dryness * 100)} %</span></div>
            <Meter value={st.dryness} />
          </div>
        </Section>
      )}

      <Section header="¿Cómo está la tierra?" footer={soilHint} inset="icon">
        {Object.entries(SOIL).map(([k, s]) => (
          <Cell key={k} icon={SOIL_UI[k].icon} iconBg={SOIL_UI[k].color} title={s.label} sub={SOIL_UI[k].hint}
            onClick={() => setSoil(soil === k ? null : k)}>
            <span style={{ width: 22, color: 'var(--tint)' }}>{soil === k && <Icon name="check" size={20} stroke={2.6} />}</span>
          </Cell>
        ))}
      </Section>

      <Section>
        <TextField label="Nota (opcional)" multiline rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hojas amarillas abajo, ha sacado una hoja nueva…" />
      </Section>

      {blob && (
        <Section footer="Detecta falta o exceso de luz, problemas de riego, humedad baja, plagas y hongos. Es orientativo." inset="icon">
          <Cell icon="sparkles" iconBg="#af52de" title="Analizar con IA">
            <Switch checked={analyze} onChange={setAnalyze} label="Analizar con IA" />
          </Cell>
        </Section>
      )}

      <div className="content">
        <button className="btn block" disabled={saving} onClick={save}>
          {saving ? <><Spinner /> {step || 'Guardando…'}</> : 'Guardar revisión'}
        </button>
      </div>
    </div>
  );
}
