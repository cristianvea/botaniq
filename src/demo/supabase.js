// Modo demo: imita la parte de Supabase que usa la app, con datos en memoria (y en localStorage si se puede).
import { seed, SEED_PHOTOS } from './seed.js';

const KEY = 'botaniq.demo.v1';
const PHOTOS_KEY = 'botaniq.demo.photos.v1';

const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin espacio o bloqueado */ } };

let db = load(KEY) || seed();
const photos = load(PHOTOS_KEY) || {};
const persist = () => save(KEY, db);
const persistPhotos = () => save(PHOTOS_KEY, photos);

export function resetDemo() {
  db = seed();
  for (const k of Object.keys(photos)) delete photos[k];
  persist(); persistPhotos();
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now());
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const me = () => db.session?.user?.id;
const memberOf = (hid) => db.household_members.some((m) => m.household_id === hid && m.user_id === me());

// Visibilidad equivalente a las políticas RLS
const visible = {
  households: (r) => memberOf(r.id),
  household_members: (r) => memberOf(r.household_id),
  zones: (r) => memberOf(r.household_id),
  plants: (r) => memberOf(r.household_id),
  plant_events: (r) => memberOf(r.household_id),
  push_subscriptions: (r) => r.user_id === me(),
};

// Triggers: la planta hereda interior/exterior y lluvia de su zona
function syncPlant(p) {
  const z = db.zones.find((x) => x.id === p.zone_id);
  if (z) { p.location = z.location; p.gets_rain = z.gets_rain; }
  return p;
}
const DEFAULTS = {
  plants: () => ({ id: uid(), created_at: new Date().toISOString(), archived: false, adjust: 1, pot_drainage: true, gets_rain: true, notes: null }),
  plant_events: () => ({ id: uid(), at: new Date().toISOString() }),
  zones: () => ({ id: uid(), created_at: new Date().toISOString(), gets_rain: true }),
  push_subscriptions: () => ({ id: uid() }),
  chat_messages: () => ({ id: uid(), created_at: new Date().toISOString() }),
  care_reminders: () => ({ id: uid(), created_at: new Date().toISOString(), months: [], last_done_at: null }),
};

class Query {
  constructor(table) { this.table = table; this.filters = []; this.op = 'select'; this.payload = null; this.wantSingle = false; this.sort = null; }
  select() { if (this.op === 'select') this.op = 'select'; this.returning = true; return this; }
  eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
  gte(c, v) { this.filters.push((r) => r[c] >= v); return this; }
  is(c, v) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  not(c, op, v) { if (op === 'is' && v === null) this.filters.push((r) => r[c] != null); return this; }
  order(c, { ascending = true } = {}) { this.sort = { c, ascending }; return this; }
  limit(n) { this.max = n; return this; }
  insert(row) { this.op = 'insert'; this.payload = row; return this; }
  update(patch) { this.op = 'update'; this.payload = patch; return this; }
  upsert(row) { this.op = 'upsert'; this.payload = row; return this; }
  delete() { this.op = 'delete'; return this; }
  single() { this.wantSingle = true; return this; }
  then(res, rej) { return this.run().then(res, rej); }

  async run() {
    await wait();
    const rows = db[this.table] || (db[this.table] = []);
    const vis = visible[this.table] || (() => true);
    const match = (r) => vis(r) && this.filters.every((f) => f(r));
    let out = [];

    if (this.op === 'select') {
      out = rows.filter(match);
      if (this.sort) {
        const { c, ascending } = this.sort;
        out = [...out].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (ascending ? 1 : -1));
      }
      if (this.max) out = out.slice(0, this.max);
    } else if (this.op === 'insert' || this.op === 'upsert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload];
      for (const raw of list) {
        let row = { ...(DEFAULTS[this.table]?.() || { id: uid() }), ...raw };
        if (this.op === 'upsert' && this.table === 'push_subscriptions') {
          const i = rows.findIndex((r) => r.endpoint === row.endpoint);
          if (i >= 0) rows.splice(i, 1);
        }
        if (this.table === 'plants') row = syncPlant(row);
        rows.push(row); out.push(row);
      }
    } else if (this.op === 'update') {
      for (const r of rows.filter(match)) {
        Object.assign(r, this.payload);
        if (this.table === 'plants') syncPlant(r);
        if (this.table === 'zones') db.plants.filter((p) => p.zone_id === r.id).forEach(syncPlant);
        out.push(r);
      }
    } else if (this.op === 'delete') {
      const del = rows.filter(match);
      db[this.table] = rows.filter((r) => !del.includes(r));
      if (this.table === 'plants') db.plant_events = db.plant_events.filter((e) => !del.some((p) => p.id === e.plant_id));
      if (this.table === 'zones') db.plants.forEach((p) => { if (del.some((z) => z.id === p.zone_id)) p.zone_id = null; });
      out = del;
    }
    if (this.op !== 'select') persist();
    const data = JSON.parse(JSON.stringify(out));
    return { data: this.wantSingle ? data[0] ?? null : data, error: null };
  }
}

const listeners = new Set();
const emit = () => listeners.forEach((cb) => cb('SIGNED_IN', db.session));

export const configured = true;
export const supabase = {
  from: (t) => new Query(t),

  async rpc(name, args) {
    await wait();
    if (!me()) return { data: null, error: new Error('Inicia sesión') };
    if (name === 'create_household') {
      const id = uid();
      db.households.push({ id, name: args.p_name, invite_code: Math.random().toString(36).slice(2, 8).toUpperCase(), lat: null, lon: null, place_name: null, created_at: new Date().toISOString() });
      db.household_members.push({ household_id: id, user_id: me(), display_name: args.p_display_name });
      persist();
      return { data: id, error: null };
    }
    if (name === 'rotate_invite_code') {
      const h = db.households.find((x) => x.id === args.p_household);
      if (h) h.invite_code = Math.random().toString(36).slice(2, 12).toUpperCase();
      persist();
      return { data: h?.invite_code, error: null };
    }
    if (name === 'join_household') {
      const h = db.households.find((x) => x.invite_code === String(args.p_code).trim().toUpperCase());
      if (!h) return { data: null, error: new Error('Código no válido. En la demo prueba con DEMO42.') };
      if (!memberOf(h.id)) db.household_members.push({ household_id: h.id, user_id: me(), display_name: args.p_display_name });
      persist();
      return { data: h.id, error: null };
    }
    return { data: null, error: new Error(`rpc ${name} no disponible en la demo`) };
  },

  auth: {
    async getSession() { return { data: { session: db.session } }; },
    onAuthStateChange(cb) { listeners.add(cb); return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }; },
    async signInWithPassword({ email }) {
      await wait(400);
      db.session = { user: { id: db.demoUserId, email } };
      persist(); emit();
      return { data: { session: db.session }, error: null };
    },
    async signUp(args) { return supabase.auth.signInWithPassword(args); },
    async resetPasswordForEmail() { await wait(300); return { error: null }; },
    async signOut() { db.session = null; persist(); listeners.forEach((cb) => cb('SIGNED_OUT', null)); return { error: null }; },
  },

  storage: {
    from() {
      return {
        async upload(path, blob) {
          const url = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
          photos[path] = url; persistPhotos();
          return { data: { path }, error: null };
        },
        async remove(paths) { for (const p of paths) delete photos[p]; persistPhotos(); return { error: null }; },
        async createSignedUrls(paths) {
          return { data: paths.map((p) => ({ path: p, signedUrl: photos[p] || SEED_PHOTOS[p] || null })), error: null };
        },
      };
    },
  },

  functions: { async invoke() { return { data: null, error: new Error('No disponible en la demo') }; } },
};
export const supabaseUrl = 'demo';
export const supabaseKey = 'demo';
