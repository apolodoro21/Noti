-- NOTI 3.0 - preferencias por usuario + ajustes para sincronización
-- Ejecutar UNA sola vez en Supabase > SQL Editor > New query.

alter table public.schedules
  add column if not exists position integer not null default 0;

create unique index if not exists notes_user_day_unique
  on public.notes (user_id, day_of_week);

create unique index if not exists drawings_user_day_unique
  on public.drawings (user_id, day_of_week);

-- Preferencias de Noti: idioma, modo claro/oscuro y paleta.
alter table public.profiles
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- Refuerza RLS si por alguna razón se desactivó en alguna tabla.
alter table public.notes enable row level security;
alter table public.drawings enable row level security;
alter table public.schedules enable row level security;
alter table public.profiles enable row level security;

-- Realtime: las tablas de datos que Noti escucha son notes, drawings y schedules.
-- La tabla profiles no necesita Realtime para las preferencias.
