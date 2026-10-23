import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { Spinner } from '../components/ui.jsx';
import appIcon from '../../public/icon-192.png?inline';

const TITLES = { login: 'Inicia sesión', signup: 'Crea tu cuenta', reset: 'Recuperar contraseña' };

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [rawEmail, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const redirect = window.location.origin + window.location.pathname;

  const submit = async (e) => {
    e.preventDefault();
    const email = rawEmail.trim().toLowerCase();
    setBusy(true); setMsg(null);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect } });
        if (error) throw error;
        if (!data.session) setMsg({ ok: true, text: 'Te hemos enviado un correo para confirmar la cuenta. Ábrelo, pulsa el enlace y después vuelve aquí e inicia sesión.' });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirect });
        if (error) throw error;
        setMsg({ ok: true, text: 'Revisa tu correo para cambiar la contraseña.' });
      }
    } catch (ex) {
      setMsg({ ok: false, text: translate(ex.message) });
    } finally {
      setBusy(false);
    }
  };

  const switchTo = (m) => { setMode(m); setMsg(null); };

  return (
    <div className="auth">
      <div className="auth-head">
        <img src={appIcon} alt="" className="app-icon" />
        <h1 className="t-large">BotanIQ</h1>
        <p className="t-sub c2" style={{ maxWidth: 280 }}>Cada planta, regada en su momento. Según su especie, su sitio y el tiempo que hace.</p>
      </div>

      <form onSubmit={submit} className="stack">
        <div className="section-header" style={{ padding: '0 16px', marginBottom: -4 }}>{TITLES[mode]}</div>
        <div className="group">
          <div><input className="field" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Correo electrónico" required value={rawEmail} onChange={(e) => setEmail(e.target.value)} /></div>
          {mode !== 'reset' && (
            <div>
              <input
                className="field" type={showPass ? 'text' : 'password'} minLength={6} required placeholder="Contraseña"
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password} onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: 92 }}
              />
              <button type="button" className="btn plain small" onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 6, top: 8 }} aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {showPass ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          )}
        </div>
        {mode === 'signup' && <p className="section-footer" style={{ marginTop: -6 }}>Mínimo 6 caracteres.</p>}
        <button className="btn block" disabled={busy}>
          {busy ? <Spinner /> : mode === 'login' ? 'Continuar' : mode === 'signup' ? 'Crear cuenta' : 'Enviar enlace'}
        </button>
        {msg && <p className={msg.ok ? 'ok-text' : 'error-text'}>{msg.text}</p>}
      </form>

      <div className="stack" style={{ alignItems: 'center', gap: 4 }}>
        {mode === 'login' && <button className="btn plain small" onClick={() => switchTo('reset')}>¿Has olvidado la contraseña?</button>}
        {mode !== 'signup'
          ? <p className="t-sub c2">¿No tienes cuenta? <button className="btn plain small" style={{ padding: 0, minHeight: 0 }} onClick={() => switchTo('signup')}>Regístrate</button></p>
          : <p className="t-sub c2">¿Ya tienes cuenta? <button className="btn plain small" style={{ padding: 0, minHeight: 0 }} onClick={() => switchTo('login')}>Inicia sesión</button></p>}
        {mode === 'reset' && <button className="btn plain small" onClick={() => switchTo('login')}>Volver</button>}
      </div>
    </div>
  );
}

function translate(m) {
  if (/Invalid login/i.test(m)) return 'El correo o la contraseña no son correctos.';
  if (/Email not confirmed/i.test(m)) return 'Aún no has confirmado tu correo: abre el enlace que te enviamos y vuelve a entrar.';
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.';
  if (/already registered/i.test(m)) return 'Ese correo ya tiene cuenta. Inicia sesión.';
  return m;
}
