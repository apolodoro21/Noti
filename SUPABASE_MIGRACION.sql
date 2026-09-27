-- NOTI 2.0 - ajustes para sincronización
-- Ejecutar UNA sola vez en Supabase > SQL Editor > New query.

alter table public.schedules
  add column if not exists position integer not null default 0;

create unique index if not exists notes_user_day_unique
  on public.notes (user_id, day_of_week);

create unique index if not exists drawings_user_day_unique
  on public.drawings (user_id, day_of_week);

-- Refuerza RLS si por alguna razón se desactivó en alguna tabla.
alter table public.notes enable row level security;
alter table public.drawings enable row level security;
alter table public.schedules enable row level security;
alter table public.profiles enable row level security;

-- Realtime: si ya las agregaste a supabase_realtime, estas líneas pueden dar
-- "relation already member"; en ese caso no vuelvas a ejecutarlas.
-- Las tablas que Noti necesita escuchar son: notes, drawings, schedules.
