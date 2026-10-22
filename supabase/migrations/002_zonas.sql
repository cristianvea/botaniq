-- ───────────── Zonas (salón, comedor, terraza…) ─────────────
-- Si ya ejecutaste schema.sql antes de que existieran las zonas, ejecuta solo este archivo.

create table if not exists public.zones (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  location     text not null default 'indoor' check (location in ('indoor','outdoor')),
  gets_rain    boolean not null default true,   -- solo exterior: false si está bajo techo
  created_at   timestamptz not null default now()
);
create index if not exists zones_household on public.zones (household_id);

alter table public.plants add column if not exists zone_id uuid references public.zones(id) on delete set null;

alter table public.zones enable row level security;
drop policy if exists zo_all on public.zones;
create policy zo_all on public.zones for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));

-- La planta hereda interior/exterior y lluvia de su zona
create or replace function public.plant_from_zone()
returns trigger language plpgsql as $$
declare z record;
begin
  if new.zone_id is not null then
    select location, gets_rain, household_id into z from public.zones where id = new.zone_id;
    if z.household_id is distinct from new.household_id then
      raise exception 'La zona no pertenece a esta casa';
    end if;
    new.location := z.location;
    new.gets_rain := z.gets_rain;
  end if;
  return new;
end $$;

drop trigger if exists plants_zone_sync on public.plants;
create trigger plants_zone_sync before insert or update of zone_id, location, gets_rain on public.plants
  for each row execute function public.plant_from_zone();

-- Si cambias una zona (p. ej. cubres la terraza), se actualizan sus plantas
create or replace function public.zone_to_plants()
returns trigger language plpgsql as $$
begin
  update public.plants set location = new.location, gets_rain = new.gets_rain where zone_id = new.id;
  return new;
end $$;

drop trigger if exists zones_sync_plants on public.zones;
create trigger zones_sync_plants after update of location, gets_rain on public.zones
  for each row execute function public.zone_to_plants();
