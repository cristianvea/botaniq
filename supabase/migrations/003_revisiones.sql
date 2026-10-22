-- ───────────── Revisiones con foto, pulverizado y diagnóstico ─────────────
-- Si ya ejecutaste schema.sql antes de esta versión, ejecuta solo este archivo.

alter table public.plant_events drop constraint if exists plant_events_type_check;
alter table public.plant_events add constraint plant_events_type_check
  check (type in ('water', 'check_wet', 'checkin', 'mist'));

alter table public.plant_events add column if not exists photo_path text;
alter table public.plant_events add column if not exists soil text
  check (soil is null or soil in ('wet', 'moist', 'dry_top', 'dry'));
alter table public.plant_events add column if not exists note text;
alter table public.plant_events add column if not exists diagnosis jsonb;
