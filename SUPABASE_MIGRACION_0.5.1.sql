-- NOTI 0.5.1 — migración ADITIVA e idempotente (ejecutar después de 0.4.0 y 0.5.0). No toca notes/drawings/schedules/schedule_items.
-- Actividades/tareas: sin hora, con fecha límite opcional, descripción y estado. Separadas del horario universitario.
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null check (length(btrim(title)) > 0 and length(title) <= 200),
  description text not null default '' check (length(description) <= 2000),
  due_date    date,
  done        boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists activities_user_due_idx on public.activities (user_id, due_date) where not done;
alter table public.activities enable row level security;
drop policy if exists activities_own on public.activities;
create policy activities_own on public.activities for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
do $$ begin
  begin alter publication supabase_realtime add table public.activities;
  exception when duplicate_object then null; when undefined_object then null; end;
end $$;
-- VERIFICACIÓN: select rowsecurity from pg_tables where tablename='activities';  (debe ser true)
-- ROLLBACK (solo esta tabla): drop table public.activities;
