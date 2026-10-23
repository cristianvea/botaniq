-- Avisos a la hora que elija cada persona (por dispositivo)
alter table public.push_subscriptions add column if not exists notify_hour smallint not null default 9 check (notify_hour between 0 and 23);
alter table public.push_subscriptions add column if not exists tz text not null default 'Europe/Madrid';
alter table public.push_subscriptions add column if not exists last_sent_on date;
notify pgrst, 'reload schema';
