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

notify pgrst, 'reload schema';
