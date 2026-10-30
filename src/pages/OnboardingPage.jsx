import { useState } from 'react';
import * as db from '../lib/data.js';
import { supabase } from '../lib/supabase.js';
import { forgetDevice } from '../lib/push.js';
import { NavBar, Section, Segmented, Icon, Spinner, TextField } from '../components/ui.jsx';

export default function OnboardingPage({ user, onDone, canCancel }) {
  const [mode, setMode] = useState('create');
  const [name, setName] = useState('Mi casa');
  const [code, setCode] = useState('');
  const [me, setMe] = useState(user.email.split('@')[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true); setErr(null);
    try {
      const id = mode === 'create' ? await db.createHousehold(name.trim(), me.trim()) : await db.joinHousehold(code, me.trim());
      await onDone(id);
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  return (
    <div className="screen">
      <NavBar
        title={canCancel ? 'Otra casa' : 'Bienvenido'}
        left={canCancel ? <a className="nav-btn" href="#/settings">Cancelar</a> : null}
        right={!canCancel ? <button className="nav-btn" onClick={async () => { await forgetDevice(); supabase.auth.signOut(); }}>Salir</button> : null}
      />
      <div className="empty-state" style={{ paddingTop: 8, paddingBottom: 24 }}>
        <div className="glyph"><Icon name="house" size={40} /></div>
        <h1 className="t-title2">{canCancel ? 'Añade otra casa' : 'Empecemos por tu casa'}</h1>
        <p className="t-sub c2">Las plantas se organizan en casas. Puedes compartir la tuya para que cualquiera marque una planta como regada.</p>
      </div>

      <form onSubmit={submit}>
        <div className="content" style={{ marginBottom: 20 }}>
          <Segmented value={mode} onChange={setMode} options={[['create', 'Crear casa'], ['join', 'Unirme con código']]} />
        </div>
        <Section footer={err ? <span className="c-red">{err}</span> : mode === 'join' ? 'Te lo da quien creó la casa, en Ajustes → Invitar.' : null}>
          {mode === 'create' ? (
            <TextField label="Nombre de la casa" required value={name} placeholder="Mi casa" onChange={(e) => setName(e.target.value)} />
          ) : (
            <TextField label="Código de invitación" required value={code} maxLength={12} placeholder="ABCD2345EF" autoCapitalize="characters" autoCorrect="off"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', letterSpacing: 2 }} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          )}
          <TextField label="Tu nombre" required value={me} placeholder="Cómo te verán los demás" onChange={(e) => setMe(e.target.value)} />
        </Section>
        <div className="content">
          <button className="btn block" disabled={busy}>{busy ? <Spinner /> : mode === 'create' ? 'Crear casa' : 'Unirme'}</button>
        </div>
      </form>
    </div>
  );
}
