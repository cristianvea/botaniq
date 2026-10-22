-- ───────────── Drenaje de la maceta ─────────────
-- Si ya ejecutaste schema.sql antes de esta versión, ejecuta solo este archivo.
alter table public.plants add column if not exists pot_drainage boolean not null default true;
