import { useEffect, useState } from 'react';
import * as db from '../lib/data.js';
import { supabase } from '../lib/supabase.js';
import { go } from '../lib/nav.js';
import { pushSupported, isIOS, isStandalone, disablePush, testNotification, fmtHour } from '../lib/push.js';
import LocationPicker from '../components/LocationPicker.jsx';
import ZoneEditor, { zoneKind } from '../components/ZoneEditor.jsx';
import { NavBar, Section, Cell, Switch, Icon } from '../components/ui.jsx';

export default function SettingsPage(ctx) {
  const { household, households, user, zones, plants, reload, loadHouseholds, selectHousehold, notify, push, setPush, openNotify } = ctx;
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [editLoc, setEditLoc] = useState(false);
  const [editingZone, setEditingZone] = useState(null);

  useEffect(() => { db.householdMembers(household.id).then(setMembers).catch(() => {}); }, [household.id]);

  const me = members.find((m) => m.user_id === user.id)?.display_name || user.email.split('@')[0];

  const togglePush = async (on) => {
    setBusy(true);
    try {
      if (!on) { await disablePush(); setPush({ ...push, on: false }); notify('Avisos desactivados en este dispositivo'); }
      else openNotify({ step: 'hour', mode: 'enable' });
    } catch (e) { notify(e.message); } finally { setBusy(false); }
  };

  const share = async () => {
    const text = `Únete a «${household.name}» en BotanIQ con el código ${household.invite_code}\n${location.origin}${location.pathname}`;
    if (navigator.share) { try { await navigator.share({ text }); } catch { /* cancelado */ } }
    else { await navigator.clipboard.writeText(text); notify('Invitación copiada'); }
  };

  const leave = async () => {
    if (!confirm(`¿Salir de «${household.name}»? Si eres la última persona, sus plantas quedarán inaccesibles.`)) return;
    await db.leaveHousehold(household.id, user.id);
    await loadHouseholds();
    go('#/');
  };

  const pushRow = isIOS && !isStandalone ? null : pushSupported;

  return (
    <div className="screen with-tabs">
      <NavBar title="Ajustes" large />

      <Section>
        <div className="cell" style={{ paddingTop: 14, paddingBottom: 14 }}>
          <div className="avatar avatar-empty" style={{ width: 60, height: 60, fontSize: 26, fontWeight: 900, background: 'linear-gradient(160deg,#55c2b2,#238a7d)', color: '#fff' }}>
            {me.charAt(0).toUpperCase()}
          </div>
          <div className="cell-main">
            <div className="t-title3">{me}</div>
            <div className="cell-sub">{user.email}</div>
          </div>
        </div>
      </Section>

      <Section header="Notificaciones" inset="icon"
        footer={pushRow === null
          ? 'En iPhone, primero instala BotanIQ: pulsa Compartir y después «Añadir a pantalla de inicio». Ábrela desde el icono y vuelve aquí.'
          : !pushRow ? 'Este navegador no admite notificaciones.'
          : push.on ? `Te avisamos a las ${fmtHour(push.hour)} solo los días que alguna planta necesite agua o pulverizar. Puede llegar con unos minutos de retraso.`
          : 'Activa los avisos y elige a qué hora te viene bien que te recordemos regar.'}>
        <Cell icon="bell" iconBg="#ff3b30" title="Avisos de riego">
          {pushRow && <Switch checked={push.on} onChange={(v) => !busy && togglePush(v)} label="Avisos de riego" />}
        </Cell>
        {pushRow && push.on && (
          <>
            <Cell icon="clock" iconBg="#ff9500" title="Hora del aviso" value={fmtHour(push.hour)} chevron
              onClick={() => openNotify({ step: 'hour', mode: 'change' })} />
            <Cell icon="bell" iconBg="#8e8e93" title={<span className="c-tint">Enviar un aviso de prueba</span>}
              onClick={() => testNotification().then(() => notify('Aviso de prueba enviado')).catch((e) => notify(e.message))} />
          </>
        )}
      </Section>

      <Section header={household.name} inset="icon" footer="Comparte el código para que otras personas cuiden contigo de estas plantas.">
        <Cell icon="person" iconBg="#5856d6" title="Miembros" value={members.map((m) => m.display_name || '¿?').join(', ')} />
        <Cell icon="share" iconBg="#0a7aff" title="Invitar" value={<span className="num" style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', letterSpacing: 2 }}>{household.invite_code}</span>} chevron onClick={share} />
        <Cell icon="pin" iconBg="#34c759" title="Ubicación" value={(household.place_name || '').split(',')[0]} chevron onClick={() => setEditLoc(!editLoc)} />
      </Section>
      {editLoc && (
        <LocationPicker onPick={async (loc) => {
          await db.updateHousehold(household.id, { lat: loc.lat, lon: loc.lon, place_name: loc.name });
          await loadHouseholds();
          setEditLoc(false);
          notify('Ubicación actualizada');
        }} />
      )}

      <Section header="Zonas" inset="icon" footer="Las zonas de exterior usan la lluvia y el sol de fuera; las de interior, una estimación del ambiente de casa.">
        {zones.map((z) => (
          <Cell key={z.id} icon={z.location === 'indoor' ? 'house' : z.gets_rain ? 'sun' : 'sunDim'}
            iconBg={z.location === 'indoor' ? '#af52de' : '#ff9500'}
            title={z.name} sub={zoneKind(z)}
            value={`${plants.filter((p) => p.zone_id === z.id).length}`} chevron
            onClick={() => setEditingZone(editingZone === z.id ? null : z.id)} />
        ))}
        <Cell icon="plus" iconBg="var(--tint)" title={<span className="c-tint">Añadir zona</span>} onClick={() => setEditingZone('new')} />
      </Section>
      {editingZone && (
        <div className="section" style={{ marginTop: -18 }}>
          <ZoneEditor
            key={editingZone}
            householdId={household.id}
            zone={zones.find((z) => z.id === editingZone)}
            existingNames={zones.map((z) => z.name)}
            notify={notify}
            onCancel={() => setEditingZone(null)}
            onSaved={async () => { await reload(); setEditingZone(null); notify('Zona guardada'); }}
            onDeleted={editingZone !== 'new' ? async () => { await reload(); setEditingZone(null); } : undefined}
          />
        </div>
      )}

      <Section header="Casas">
        {households.map((h) => (
          <Cell key={h.id} title={h.name} onClick={() => selectHousehold(h.id)}>
            {h.id === household.id && <Icon name="check" size={20} stroke={2.6} style={{ color: 'var(--tint)' }} />}
          </Cell>
        ))}
        <Cell title={<span className="c-tint">Crear o unirme a otra casa</span>} href="#/join" />
      </Section>

      {import.meta.env.VITE_DEMO && (
        <Section header="Demo" footer="Estás usando una demo: la identificación, el tiempo y el diagnóstico son simulados, y los datos solo se guardan en este navegador.">
          <Cell title={<span className="c-tint">Restablecer datos de ejemplo</span>}
            onClick={async () => { const m = await import('../demo/supabase.js'); m.resetDemo(); location.hash = ''; location.reload(); }} />
        </Section>
      )}

      <Section>
        <Cell title="Salir de esta casa" danger onClick={leave} />
        <Cell title="Cerrar sesión" danger onClick={() => supabase.auth.signOut()} />
      </Section>

      <p className="t-foot c2" style={{ textAlign: 'center', padding: '0 32px', lineHeight: 1.5 }}>
        BotanIQ · Identificación con Pl@ntNet · Tiempo de Open-Meteo
      </p>
    </div>
  );
}
