import { supabase } from './supabase.js';

const BUCKET = 'plant-photos';

export async function myHouseholds() {
  const { data, error } = await supabase.from('households').select('*').order('created_at');
  if (error) throw error;
  return data;
}

export async function householdMembers(hid) {
  const { data, error } = await supabase.from('household_members').select('*').eq('household_id', hid);
  if (error) throw error;
  return data;
}

export async function createHousehold(name, displayName) {
  const { data, error } = await supabase.rpc('create_household', { p_name: name, p_display_name: displayName });
  if (error) throw error;
  return data;
}

export async function joinHousehold(code, displayName) {
  const { data, error } = await supabase.rpc('join_household', { p_code: code, p_display_name: displayName });
  if (error) throw error;
  return data;
}

export async function updateHousehold(id, patch) {
  const { error } = await supabase.from('households').update(patch).eq('id', id);
  if (error) throw error;
}

export async function leaveHousehold(hid, userId) {
  const { error } = await supabase.from('household_members').delete().eq('household_id', hid).eq('user_id', userId);
  if (error) throw error;
}

export async function listPlants(hid) {
  const { data, error } = await supabase
    .from('plants').select('*').eq('household_id', hid).eq('archived', false).order('name');
  if (error) throw error;
  return data;
}

export async function listEvents(hid, sinceDays = 120) {
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const { data, error } = await supabase
    .from('plant_events').select('*').eq('household_id', hid).gte('at', since).order('at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function savePlant(plant) {
  const { id, ...rest } = plant;
  const q = id
    ? supabase.from('plants').update(rest).eq('id', id).select().single()
    : supabase.from('plants').insert(rest).select().single();
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function deletePlant(plant) {
  if (plant.photo_path) await supabase.storage.from(BUCKET).remove([plant.photo_path]);
  const { error } = await supabase.from('plants').delete().eq('id', plant.id);
  if (error) throw error;
}

export async function addEvent(plant, type, userId, at = new Date(), extra = {}) {
  const { data, error } = await supabase.from('plant_events').insert({
    plant_id: plant.id, household_id: plant.household_id, type, user_id: userId, at: at.toISOString(), ...extra,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateEvent(id, patch) {
  const { error } = await supabase.from('plant_events').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteEvent(event) {
  if (event.photo_path) await supabase.storage.from(BUCKET).remove([event.photo_path]);
  const { error } = await supabase.from('plant_events').delete().eq('id', event.id);
  if (error) throw error;
}

export async function uploadPhoto(hid, blob) {
  const path = `${hid}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

export async function removePhoto(path) {
  if (path) await supabase.storage.from(BUCKET).remove([path]);
}

const urlCache = new Map();
export async function photoUrls(paths) {
  const missing = paths.filter((p) => p && !urlCache.has(p));
  if (missing.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(missing, 60 * 60 * 24 * 7);
    for (const d of data || []) if (d.signedUrl) urlCache.set(d.path, d.signedUrl);
  }
  return Object.fromEntries(paths.filter(Boolean).map((p) => [p, urlCache.get(p)]));
}

// ───────── Zonas ─────────
export async function listZones(hid) {
  const { data, error } = await supabase.from('zones').select('*').eq('household_id', hid).order('created_at');
  if (error) throw error;
  return data;
}

export async function saveZone(zone) {
  const { id, ...rest } = zone;
  const q = id
    ? supabase.from('zones').update(rest).eq('id', id).select().single()
    : supabase.from('zones').insert(rest).select().single();
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function deleteZone(id) {
  const { error } = await supabase.from('zones').delete().eq('id', id);
  if (error) throw error;
}
