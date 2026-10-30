import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { Spinner, TextField } from '../components/ui.jsx';
import appIcon from '../assets/logo.svg';

const TITLES = { login: 'Inicia sesión', signup: 'Crea tu cuenta', reset: 'Recuperar contraseña' };

// Accesos con Google / Apple: se activan en Supabase y se listan en la variable AUTH_PROVIDERS de GitHub (p. ej. "google,apple")
const PROVIDERS = (import.meta.env.VITE_AUTH_PROVIDERS || '').split(',').map((x) => x.trim().toLowerCase()).filter((x) => ['google', 'apple'].includes(x));

// Error que devuelve Google/Apple/Supabase al volver a la app
function oauthError() {
  const q = new URLSearchParams(window.location.search + '&' + window.location.hash.replace(/^#/, ''));
  const e = q.get('error_description') || q.get('error');
  return e ? decodeURIComponent(e.replace(/\+/g, ' ')) : null;
}

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [rawEmail, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(() => (oauthError() ? { ok: false, text: `No se pudo entrar: ${oauthError()}` } : null));

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

  const oauth = async (provider) => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirect } });
    if (error) { setMsg({ ok: false, text: translate(error.message) }); setBusy(false); }
  };

  return (
    <div className="auth">
      <div className="auth-head">
        <img src={appIcon} alt="" className="app-icon" />
        <h1 className="t-large">BotanIQ</h1>
        <p className="t-sub c2" style={{ maxWidth: 280 }}>Cuidado botánico inteligente para tu hogar</p>
      </div>

      {PROVIDERS.length > 0 && mode !== 'reset' && (
        <div className="stack">
          {PROVIDERS.includes('apple') && (
            <button className="btn block oauth apple" disabled={busy} onClick={() => oauth('apple')}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-3.9zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z"/></svg>
              Continuar con Apple
            </button>
          )}
          {PROVIDERS.includes('google') && (
            <button className="btn block oauth google" disabled={busy} onClick={() => oauth('google')}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
              Continuar con Google
            </button>
          )}
          <div className="oauth-or"><span>o con tu correo</span></div>
        </div>
      )}

      <form onSubmit={submit} className="stack">
        <div className="section-header" style={{ padding: '0 16px', marginBottom: -4 }}>{TITLES[mode]}</div>
        <div className="group">
          <TextField label="Correo electrónico" type="email" autoComplete="username" inputMode="email" autoCapitalize="none"
            autoCorrect="off" spellCheck={false} placeholder="tu@correo.com" required value={rawEmail} onChange={(e) => setEmail(e.target.value)} />
          {mode !== 'reset' && (
            <div className="tf">
              <label className="tf-label" htmlFor="password">Contraseña</label>
              <div className="tf-pass">
                <input id="password" className="tf-input" type={showPass ? 'text' : 'password'} minLength={mode === 'signup' ? 8 : 6} required
                  autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  placeholder={mode === 'signup' ? 'Mínimo 8 caracteres' : 'Tu contraseña'} value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="btn plain small tf-toggle" onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPass ? 'Ocultar' : 'Mostrar'}</button>
              </div>
            </div>
          )}
        </div>
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
  if (/provider is not enabled|Unsupported provider/i.test(m)) return 'Ese acceso aún no está activado.';
  if (/signups? not allowed|Signups not allowed/i.test(m)) return 'Ahora mismo no se admiten cuentas nuevas. Pide a quien te invitó que te dé acceso.';
  if (/Password should be/i.test(m)) return 'La contraseña es demasiado corta o sencilla.';
  return m;
}
