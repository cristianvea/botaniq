// Datos de ejemplo de la demo (las fotos son ilustraciones)
import monstera from './img/monstera.jpg?inline';
import calathea from './img/calathea.jpg?inline';
import cactus from './img/cactus.jpg?inline';
import romero from './img/romero.jpg?inline';
import albahaca from './img/albahaca.jpg?inline';

const HID = 'demo-casa';
const UID = 'demo-user';
const OTHER = 'demo-lucia';

export const SEED_PHOTOS = {
  [`${HID}/monstera.jpg`]: monstera,
  [`${HID}/calathea.jpg`]: calathea,
  [`${HID}/cactus.jpg`]: cactus,
  [`${HID}/romero.jpg`]: romero,
  [`${HID}/albahaca.jpg`]: albahaca,
};

export function seed() {
  const now = Date.now();
  const ago = (d, h = 10) => { const t = new Date(now - d * 86400000); t.setHours(h, 15, 0, 0); return t.toISOString(); };
  const plant = (id, name, zone, extra) => ({
    id, household_id: HID, zone_id: zone, name, profile: 'tropical', location: 'indoor', light: 'indirect',
    substrate: 'unknown', pot: 'medium', pot_material: 'plastic', pot_drainage: true, gets_rain: true, adjust: 1,
    created_at: ago(70), archived: false, photo_path: `${HID}/${id}.jpg`, notes: null, ...extra,
  });
  return {
    demoUserId: UID,
    session: { user: { id: UID, email: 'tu@ejemplo.com' } },
    households: [{ id: HID, name: 'Casa', invite_code: 'DEMO42', lat: 40.42, lon: -3.7, place_name: 'Madrid, Comunidad de Madrid, España', created_at: ago(70) }],
    household_members: [
      { household_id: HID, user_id: UID, display_name: 'Tú' },
      { household_id: HID, user_id: OTHER, display_name: 'Lucía' },
    ],
    zones: [
      { id: 'z-salon', household_id: HID, name: 'Salón', location: 'indoor', gets_rain: true, created_at: ago(70) },
      { id: 'z-comedor', household_id: HID, name: 'Comedor', location: 'indoor', gets_rain: true, created_at: ago(70) },
      { id: 'z-terraza', household_id: HID, name: 'Terraza', location: 'outdoor', gets_rain: true, created_at: ago(70) },
    ],
    plants: [
      plant('monstera', 'Monstera', 'z-salon', { species: 'Monstera deliciosa', common_name: 'Costilla de Adán', genus: 'Monstera', family: 'Araceae', adjust: 0.88, notes: 'Regalo de cumpleaños. Le salen hojas nuevas cada mes.' }),
      plant('calathea', 'Calathea', 'z-comedor', { profile: 'tropical_humeda', species: 'Goeppertia orbifolia', common_name: 'Calathea', genus: 'Goeppertia', family: 'Marantaceae' }),
      plant('cactus', 'Cactus de la ventana', 'z-salon', { profile: 'cactus', light: 'direct', pot_material: 'terracotta', species: 'Cereus peruvianus', common_name: 'Cactus candelabro', genus: 'Cereus', family: 'Cactaceae' }),
      plant('romero', 'Romero', 'z-terraza', { profile: 'aromatica_lenosa', location: 'outdoor', light: 'direct', pot: 'large', pot_material: 'terracotta', species: 'Salvia rosmarinus', common_name: 'Romero', genus: 'Salvia', family: 'Lamiaceae' }),
      plant('albahaca', 'Albahaca', 'z-terraza', { profile: 'aromatica_blanda', location: 'outdoor', light: 'direct', pot: 'small', species: 'Ocimum basilicum', common_name: 'Albahaca', genus: 'Ocimum', family: 'Lamiaceae' }),
    ],
    plant_events: [
      { id: 'e1', plant_id: 'monstera', household_id: HID, type: 'water', at: ago(14), user_id: UID },
      { id: 'e0', plant_id: 'monstera', household_id: HID, type: 'checkin', soil: 'moist', at: ago(6, 19), user_id: OTHER, photo_path: `${HID}/monstera.jpg`, note: 'Ha sacado una hoja nueva',
        diagnosis: { photo_ok: true, overall: 'mild', summary: 'Planta sana con crecimiento activo. Una hoja baja amarillea ligeramente, algo normal en otoño.', issues: [{ type: 'exceso_riego', confidence: 'low', evidence: 'Una hoja inferior con amarilleo uniforme.', action: 'Espera a que se sequen los 3 cm superiores antes de regar.' }], watering: 'keep', light: 'keep', tips: ['En otoño crece más despacio: espacia los riegos y deja de abonar.', 'Limpia el polvo de las hojas con un paño húmedo.'] } },
      { id: 'e1b', plant_id: 'monstera', household_id: HID, type: 'water', at: ago(23), user_id: OTHER },
      { id: 'e2', plant_id: 'calathea', household_id: HID, type: 'water', at: ago(3), user_id: UID },
      { id: 'e2m', plant_id: 'calathea', household_id: HID, type: 'mist', at: ago(4), user_id: UID },
      { id: 'e3', plant_id: 'cactus', household_id: HID, type: 'water', at: ago(9), user_id: UID },
      { id: 'e4', plant_id: 'romero', household_id: HID, type: 'water', at: ago(7), user_id: OTHER },
      { id: 'e5', plant_id: 'albahaca', household_id: HID, type: 'water', at: ago(3), user_id: UID },
    ],
    push_subscriptions: [],
  };
}
