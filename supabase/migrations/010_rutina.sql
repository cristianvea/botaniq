-- BotanIQ · 010: rutina de riego propia
-- Se puede ejecutar más de una vez.
alter table public.plants add column if not exists fixed_seasonal boolean not null default false; -- adaptar la rutina a la estación
alter table public.plants add column if not exists fixed_month smallint check (fixed_month between 1 and 12); -- mes en que se puso
notify pgrst, 'reload schema';
