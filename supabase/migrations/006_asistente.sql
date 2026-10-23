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

notify pgrst, 'reload schema';
