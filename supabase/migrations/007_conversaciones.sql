-- Florencio: varias conversaciones guardadas
alter table public.chat_messages add column if not exists thread_id uuid;
create index if not exists chat_messages_thread on public.chat_messages(thread_id);
notify pgrst, 'reload schema';
