-- BotanIQ · esquema de base de datos para Supabase
-- Pégalo entero en Supabase → SQL Editor → New query → Run.

create extension if not exists pgcrypto;

-- ───────────── Tablas ─────────────

create table if not exists public.households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  invite_code  text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
  lat          double precision,
  lon          double precision,
  place_name   text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text,
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.plants (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,                 -- apodo: "Monstera del salón"
  species      text,                          -- nombre científico
  genus        text,
  family       text,
  common_name  text,
  profile      text not null default 'generica',
  location     text not null default 'indoor'   check (location in ('indoor','outdoor')),
  light        text not null default 'indirect' check (light in ('direct','indirect','low')),
  substrate    text not null default 'unknown',
  pot          text not null default 'medium'   check (pot in ('small','medium','large')),
  pot_material text not null default 'plastic'  check (pot_material in ('plastic','terracotta')),
  gets_rain    boolean not null default true,   -- solo exterior: ¿le cae la lluvia?
  adjust       double precision not null default 1, -- factor aprendido (>1 se seca antes)
  photo_path   text,
  notes        text,
  archived     boolean not null default false,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists public.plant_events (
  id           uuid primary key default gen_random_uuid(),
  plant_id     uuid not null references public.plants(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  type         text not null check (type in ('water','check_wet')),
  at           timestamptz not null default now(),
  user_id      uuid references auth.users(id) on delete set null
);
create index if not exists plant_events_plant_at on public.plant_events (plant_id, at desc);

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
-- Hora del aviso (local del dispositivo) y último día avisado
alter table public.push_subscriptions add column if not exists notify_hour smallint not null default 9 check (notify_hour between 0 and 23);
alter table public.push_subscriptions add column if not exists tz text not null default 'Europe/Madrid';
alter table public.push_subscriptions add column if not exists last_sent_on date;

-- ───────────── Funciones auxiliares ─────────────

create or replace function public.is_member(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = hid and user_id = auth.uid());
$$;

create or replace function public.create_household(p_name text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into households (name, created_by) values (p_name, auth.uid()) returning id into hid;
  insert into household_members (household_id, user_id, display_name) values (hid, auth.uid(), p_display_name);
  return hid;
end $$;

create or replace function public.join_household(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into hid from households where invite_code = upper(trim(p_code));
  if hid is null then raise exception 'Código no válido'; end if;
  insert into household_members (household_id, user_id, display_name)
    values (hid, auth.uid(), p_display_name)
    on conflict do nothing;
  return hid;
end $$;

-- ───────────── Seguridad (RLS) ─────────────

alter table public.households         enable row level security;
alter table public.household_members  enable row level security;
alter table public.plants             enable row level security;
alter table public.plant_events       enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists hh_select on public.households;
drop policy if exists hh_update on public.households;
create policy hh_select on public.households for select using (public.is_member(id));
create policy hh_update on public.households for update using (public.is_member(id));

drop policy if exists hm_select on public.household_members;
drop policy if exists hm_delete on public.household_members;
create policy hm_select on public.household_members for select using (public.is_member(household_id));
create policy hm_delete on public.household_members for delete using (user_id = auth.uid());

drop policy if exists pl_all on public.plants;
create policy pl_all on public.plants for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));

drop policy if exists ev_all on public.plant_events;
create policy ev_all on public.plant_events for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));

drop policy if exists ps_all on public.push_subscriptions;
create policy ps_all on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────── Fotos (Storage) ─────────────
-- Las fotos se guardan como  <household_id>/<archivo>.jpg

insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', false)
on conflict (id) do nothing;

drop policy if exists photos_select on storage.objects;
drop policy if exists photos_insert on storage.objects;
drop policy if exists photos_delete on storage.objects;
create policy photos_select on storage.objects for select
  using (bucket_id = 'plant-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy photos_insert on storage.objects for insert
  with check (bucket_id = 'plant-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy photos_delete on storage.objects for delete
  using (bucket_id = 'plant-photos' and public.is_member(((storage.foldername(name))[1])::uuid));

-- ───────────── Zonas (salón, comedor, terraza…) ─────────────

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

-- ───────────── Revisiones con foto, pulverizado y diagnóstico ─────────────

alter table public.plant_events drop constraint if exists plant_events_type_check;
alter table public.plant_events add constraint plant_events_type_check
  check (type in ('water', 'check_wet', 'checkin', 'mist'));

alter table public.plant_events add column if not exists photo_path text;
alter table public.plant_events add column if not exists soil text
  check (soil is null or soil in ('wet', 'moist', 'dry_top', 'dry'));
alter table public.plant_events add column if not exists note text;
alter table public.plant_events add column if not exists diagnosis jsonb;

-- ───────────── Drenaje de la maceta ─────────────
alter table public.plants add column if not exists pot_drainage boolean not null default true;

-- Asistente: recordatorios de cuidados (abono, girar la maceta…) y conversaciones
create table if not exists public.care_reminders (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  plant_id     uuid not null references public.plants(id) on delete cascade,
  title        text not null,                 -- "Abono líquido"
  note         text,                          -- "5 ml por litro en el agua de riego"
  mode         text not null default 'with_watering' check (mode in ('with_watering', 'every_days')),
  every        smallint not null default 1 check (every between 1 and 365), -- cada N riegos o N días
  months       smallint[] not null default '{}', -- meses en los que aplica (vacío = todo el año)
  last_done_at timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists care_reminders_household on public.care_reminders(household_id);

create table if not exists public.chat_messages (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  plant_id     uuid references public.plants(id) on delete set null,
  role         text not null check (role in ('user', 'assistant')),
  content      text not null,
  meta         jsonb,                          -- modelo usado, recordatorio propuesto, sugerencias…
  created_at   timestamptz not null default now()
);
create index if not exists chat_messages_user on public.chat_messages(user_id, household_id, created_at);
alter table public.chat_messages add column if not exists thread_id uuid;
create index if not exists chat_messages_thread on public.chat_messages(thread_id);

alter table public.care_reminders enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists cr_all on public.care_reminders;
create policy cr_all on public.care_reminders for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));

-- Cada persona ve solo sus conversaciones
drop policy if exists cm_all on public.chat_messages;
create policy cm_all on public.chat_messages for all
  using (user_id = auth.uid() and public.is_member(household_id))
  with check (user_id = auth.uid() and public.is_member(household_id));


-- Frecuencia de riego fijada por el usuario (null = automática)
alter table public.plants add column if not exists fixed_days smallint check (fixed_days between 1 and 60);
-- BotanIQ · 009: más seguridad
-- Se puede ejecutar más de una vez.

-- ───── 1. Códigos de invitación largos y difíciles de adivinar ─────
-- 10 caracteres sin letras que se confundan (sin 0/O ni 1/I): ~10^15 combinaciones
create or replace function public.gen_invite_code()
returns text language sql volatile set search_path = public, extensions as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 32), 1), '')
  from (select gen_random_bytes(10) as b) r, generate_series(0, 9) as i;
$$;
alter table public.households alter column invite_code set default public.gen_invite_code();
-- Los códigos antiguos de 6 caracteres se cambian por uno nuevo
update public.households set invite_code = public.gen_invite_code() where length(invite_code) < 10;

-- Intentos de unirse a una casa (para frenar a quien prueba códigos al azar)
create table if not exists public.join_attempts (
  user_id uuid not null,
  at      timestamptz not null default now()
);
create index if not exists join_attempts_user on public.join_attempts(user_id, at);
alter table public.join_attempts enable row level security; -- sin políticas: solo las funciones la usan

create or replace function public.join_household(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if (select count(*) from join_attempts where user_id = auth.uid() and at > now() - interval '1 hour') >= 10 then
    raise exception 'Demasiados intentos. Prueba dentro de una hora.';
  end if;
  insert into join_attempts (user_id) values (auth.uid());
  select id into hid from households where invite_code = upper(replace(trim(p_code), ' ', ''));
  -- Sin excepción: así el intento queda apuntado (una excepción desharía el insert de arriba)
  if hid is null then return null; end if;
  insert into household_members (household_id, user_id, display_name)
    values (hid, auth.uid(), left(coalesce(nullif(trim(p_display_name), ''), 'Sin nombre'), 40))
    on conflict do nothing;
  return hid;
end $$;

create or replace function public.create_household(p_name text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 60 then raise exception 'Ponle un nombre a la casa (máx. 60 letras)'; end if;
  if (select count(*) from households where created_by = auth.uid()) >= 5 then
    raise exception 'Ya has creado 5 casas';
  end if;
  insert into households (name, created_by) values (trim(p_name), auth.uid()) returning id into hid;
  insert into household_members (household_id, user_id, display_name)
    values (hid, auth.uid(), left(coalesce(nullif(trim(p_display_name), ''), 'Sin nombre'), 40));
  return hid;
end $$;

-- Cambiar el código de invitación (si se ha compartido de más)
create or replace function public.rotate_invite_code(p_household uuid)
returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not public.is_member(p_household) then raise exception 'No eres de esta casa'; end if;
  update households set invite_code = public.gen_invite_code() where id = p_household returning invite_code into code;
  return code;
end $$;

-- Las funciones solo para usuarios con sesión
revoke execute on function public.create_household(text, text) from public, anon;
revoke execute on function public.join_household(text, text) from public, anon;
revoke execute on function public.rotate_invite_code(uuid) from public, anon;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;
grant execute on function public.rotate_invite_code(uuid) to authenticated;

-- ───── 2. De una casa solo se puede cambiar el nombre y la ubicación ─────
revoke update on public.households from authenticated, anon;
grant update (name, lat, lon, place_name) on public.households to authenticated;

-- Quien creó la casa puede sacar a otros miembros (y cada uno puede salirse)
drop policy if exists hm_delete on public.household_members;
create policy hm_delete on public.household_members for delete using (
  user_id = auth.uid()
  or exists (select 1 from public.households h where h.id = household_id and h.created_by = auth.uid())
);

-- ───── 3. Riegos y recordatorios solo de plantas de la misma casa ─────
do $$ begin
  alter table public.plants add constraint plants_id_household unique (id, household_id);
exception when duplicate_table or duplicate_object then null; end $$;
do $$ begin
  alter table public.plant_events add constraint plant_events_same_household
    foreign key (plant_id, household_id) references public.plants (id, household_id) on delete cascade not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.care_reminders add constraint care_reminders_same_household
    foreign key (plant_id, household_id) references public.plants (id, household_id) on delete cascade not valid;
exception when duplicate_object then null; end $$;

-- Lo que se crea queda a nombre de quien lo crea (no se puede firmar como otro)
create or replace function public.stamp_author()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if tg_table_name = 'plant_events' then new.user_id := auth.uid(); end if;
    if tg_table_name in ('plants', 'care_reminders') then new.created_by := auth.uid(); end if;
  end if;
  return new;
end $$;
drop trigger if exists stamp_author on public.plant_events;
create trigger stamp_author before insert on public.plant_events for each row execute function public.stamp_author();
drop trigger if exists stamp_author on public.plants;
create trigger stamp_author before insert on public.plants for each row execute function public.stamp_author();
drop trigger if exists stamp_author on public.care_reminders;
create trigger stamp_author before insert on public.care_reminders for each row execute function public.stamp_author();

-- ───── 4. Avisos: solo direcciones https de servicios de notificaciones ─────
do $$ begin
  alter table public.push_subscriptions add constraint push_endpoint_https
    check (endpoint ~ '^https://[a-z0-9.-]+/') not valid;
exception when duplicate_object then null; end $$;

-- ───── 5. Fotos: solo imágenes y como mucho 5 MB ─────
update storage.buckets
  set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id = 'plant-photos';

-- ───── 6. Uso de la IA (para el límite diario de Florencio) ─────
create table if not exists public.ai_usage (
  id      bigserial primary key,
  user_id uuid not null,
  task    text not null,
  at      timestamptz not null default now()
);
create index if not exists ai_usage_user on public.ai_usage(user_id, task, at);
alter table public.ai_usage enable row level security; -- sin políticas: solo la función "ai" (con la clave de servicio)

