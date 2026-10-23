import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, configured } from './lib/supabase.js';
import * as db from './lib/data.js';
import { fetchWeather } from './lib/weather.js';
import { computeStatus } from './lib/watering.js';
import AuthPage from './pages/AuthPage.jsx';
import OnboardingPage from './pages/OnboardingPage.jsx';
import TodayPage from './pages/TodayPage.jsx';
import PlantsPage from './pages/PlantsPage.jsx';
import PlantPage from './pages/PlantPage.jsx';
import EditPlantPage from './pages/EditPlantPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import CheckinPage from './pages/CheckinPage.jsx';
import LocationPicker from './components/LocationPicker.jsx';
import { Hud, TabBar, NavBar, Spinner, Section } from './components/ui.jsx';
import { go } from './lib/nav.js';
import NotifySheet from './components/NotifySheet.jsx';
import { pushPrefs, canAskPush, alreadyAsked } from './lib/push.js';

function parseHash() {
  const [, name = '', id] = window.location.hash.split('/');
  return { name: name || 'home', id };
}

const ACTIVE_KEY = 'botaniq.household';

export default function App() {
  const [session, setSession] = useState(undefined);
  const [route, setRoute] = useState(parseHash());
  const [push, setPush] = useState({ on: false, hour: 9, ready: false });
  const [notifySheet, setNotifySheet] = useState(null); // { step, mode }
  const [households, setHouseholds] = useState(null);
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY));
  const [plants, setPlants] = useState([]);
  const [events, setEvents] = useState([]);
  const [zones, setZones] = useState([]);
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState(null);
  const [photos, setPhotos] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // ── Sesión ──
  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      setToast((t) => (t && (t.action || Date.now() - t.ts < 600) ? t : null)); // los avisos viejos no siguen a la siguiente pantalla
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // ── Casas ──
  const loadHouseholds = useCallback(async () => {
    const list = await db.myHouseholds();
    setHouseholds(list);
    return list;
  }, []);

  useEffect(() => {
    if (session) loadHouseholds().catch((e) => setToast({ text: e.message }));
    else setHouseholds(null);
  }, [session, loadHouseholds]);

  const household = useMemo(() => {
    if (!households?.length) return null;
    return households.find((h) => h.id === activeId) || households[0];
  }, [households, activeId]);

  const selectHousehold = (id) => {
    localStorage.setItem(ACTIVE_KEY, id);
    setActiveId(id);
  };

  // ── Plantas, eventos y tiempo ──
  const reload = useCallback(async () => {
    if (!household) return;
    setLoading(true);
    try {
      const [p, e, z] = await Promise.all([
        db.listPlants(household.id), db.listEvents(household.id), db.listZones(household.id),
      ]);
      setPlants(p);
      setEvents(e);
      setZones(z);
      db.photoUrls(p.map((x) => x.photo_path)).then(setPhotos).catch(() => {});
    } catch (err) {
      setToast({ text: err.message });
    } finally {
      setLoading(false);
    }
  }, [household]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    setWeather(null);
    setWeatherError(null);
    if (household?.lat == null) return;
    fetchWeather(household.lat, household.lon)
      .then(setWeather)
      .catch((e) => setWeatherError(e.message));
  }, [household?.lat, household?.lon]);

  // Avisos de este dispositivo
  useEffect(() => {
    if (!session) return;
    pushPrefs().then((p) => setPush({ ...p, ready: true })).catch(() => setPush((p) => ({ ...p, ready: true })));
  }, [session]);

  const statuses = useMemo(() => {
    if (!weather) return {};
    const byPlant = {};
    for (const e of events) (byPlant[e.plant_id] ||= []).push(e);
    return Object.fromEntries(plants.map((p) => [p.id, computeStatus(p, byPlant[p.id] || [], weather)]));
  }, [plants, events, weather]);

  // ── Render ──
  if (!configured) return <NotConfigured />;
  if (session === undefined) return <Loading />;
  if (!session) return <AuthPage />;
  if (households === null) return <Loading />;

  const user = session.user;
  const dueCount = Object.values(statuses).filter((s) => s.status === 'due' || s.status === 'overdue').length;
  const ctx = {
    user, household, households, plants, events, zones, weather, weatherError, statuses, photos, loading,
    reload, loadHouseholds, selectHousehold, notify: (text, action) => setToast({ text, action, ts: Date.now() }),
    push, setPush,
    // Abre la hoja de avisos: { step: 'ask' | 'hour', mode: 'enable' | 'change' }
    openNotify: (opts = {}) => setNotifySheet({ step: 'ask', mode: 'enable', ...opts }),
    // Tras añadir una planta: pregunta una sola vez si quieres avisos
    maybeAskNotify: () => {
      if (push.ready && !push.on && canAskPush() && !alreadyAsked()) setTimeout(() => setNotifySheet({ step: 'ask', mode: 'enable' }), 700);
    },
  };

  let page;
  let tab = null;
  if (!household || route.name === 'join') {
    page = <OnboardingPage {...ctx} canCancel={!!household} onDone={async (id) => { await loadHouseholds(); selectHousehold(id); go('#/'); }} />;
  } else if (household.lat == null) {
    page = (
      <div className="screen">
        <NavBar title="Ubicación" large sub="La uso para saber la temperatura, la humedad y la lluvia de tu zona." />
        <LocationPicker
          onPick={async (loc) => {
            await db.updateHousehold(household.id, { lat: loc.lat, lon: loc.lon, place_name: loc.name });
            await loadHouseholds();
          }}
        />
      </div>
    );
  } else if (route.name === 'plant') {
    page = <PlantPage key={route.id} {...ctx} plantId={route.id} />;
  } else if (route.name === 'new' || route.name === 'edit') {
    page = <EditPlantPage key={route.id || 'new'} {...ctx} plantId={route.name === 'edit' ? route.id : null} />;
  } else if (route.name === 'checkin') {
    page = <CheckinPage key={route.id} {...ctx} plantId={route.id} />;
  } else if (route.name === 'settings') {
    page = <SettingsPage {...ctx} />; tab = 'settings';
  } else if (route.name === 'plants') {
    page = <PlantsPage {...ctx} />; tab = 'plants';
  } else {
    page = <TodayPage {...ctx} />; tab = 'today';
  }

  return (
    <>
      {page}
      {tab && <TabBar active={tab} badge={dueCount} />}
      {notifySheet && (
        <NotifySheet {...notifySheet} user={user} hour={push.hour} notify={ctx.notify}
          onClose={() => setNotifySheet(null)}
          onDone={(hour) => { setPush({ on: true, hour, ready: true }); setNotifySheet(null); }} />
      )}
      {toast && <Hud {...toast} onClose={() => setToast(null)} />}
    </>
  );
}

function Loading() {
  return <div className="center c3"><Spinner size={28} /></div>;
}

function NotConfigured() {
  return (
    <div className="screen">
      <NavBar title="Falta configuración" large />
      <Section footer="No encuentro VITE_SUPABASE_URL ni VITE_SUPABASE_ANON_KEY. Sigue los pasos del README para crearlas." />
    </div>
  );
}
