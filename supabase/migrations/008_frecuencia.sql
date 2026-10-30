-- Frecuencia de riego fijada por el usuario (null = automática)
alter table public.plants add column if not exists fixed_days smallint check (fixed_days between 1 and 60);
notify pgrst, 'reload schema';
