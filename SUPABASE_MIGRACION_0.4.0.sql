-- =====================================================================
-- NOTI 0.4.0 — migración ADITIVA (no borra ni modifica tablas existentes)
-- Ejecutar UNA vez en Supabase > SQL Editor > New query. Es idempotente:
-- si la ejecutas dos veces no duplica nada.
--
-- Qué hace:
--   1. Crea notes_by_date, drawings_by_date, schedule_items, schedule_exceptions.
--   2. Activa RLS: cada usuario solo ve/escribe sus filas (auth.uid() = user_id).
--   3. Registra las tablas nuevas en Realtime.
--   4. Copia los horarios semanales actuales (public.schedules) a schedule_items
--      como series que se repiten cada semana. La tabla original NO se toca.
--
-- Lo que NO hace: no elimina, renombra ni altera public.notes / drawings /
-- schedules / profiles. Noti 3.0 sigue pudiendo leerlas. Las notas y dibujos por
-- día de la semana se importan desde la app, fecha por fecha, a petición del usuario.
-- =====================================================================

-- ---------- 1. Tablas nuevas ----------
create table if not exists public.notes_by_date (
  user_id     uuid not null references auth.users(id) on delete cascade,
  note_date   date not null,
  content     text not null default '',
  font_family text not null default 'system',
  updated_at  timestamptz not null default now(),
  primary key (user_id, note_date)
);

create table if not exists public.drawings_by_date (
  user_id      uuid not null references auth.users(id) on delete cascade,
  drawing_date date not null,
  drawing_data text,
  updated_at   timestamptz not null default now(),
  primary key (user_id, drawing_date)
);

create table if not exists public.schedule_items (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  kind               text not null check (kind in ('recurring','single')),
  subject            text not null default '',
  room               text not null default '',
  teacher            text not null default '',
  color              text,
  start_time         time,
  end_time           time,
  weekdays           smallint[] not null default '{}',   -- 1=lunes … 7=domingo
  start_date         date,                               -- null = sin límite inferior
  end_date           date,                               -- null = sin fecha de fin
  single_date        date,                               -- solo kind='single'
  position           integer not null default 0,
  legacy_schedule_id text,                               -- id de public.schedules de origen (evita duplicar la copia)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint schedule_items_weekdays_valid check (weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  constraint schedule_items_kind_valid check (
    (kind = 'recurring' and cardinality(weekdays) > 0 and single_date is null) or
    (kind = 'single' and single_date is not null)),
  constraint schedule_items_range_valid check (start_date is null or end_date is null or end_date >= start_date),
  constraint schedule_items_legacy_unique unique (user_id, legacy_schedule_id)  -- NULL múltiples permitidos
);
create index if not exists schedule_items_user_idx on public.schedule_items (user_id);

create table if not exists public.schedule_exceptions (
  item_id         uuid not null references public.schedule_items(id) on delete cascade,
  occurrence_date date not null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  action          text not null check (action in ('skip','override')),
  subject         text,
  room            text,
  teacher         text,
  start_time      time,
  end_time        time,
  updated_at      timestamptz not null default now(),
  primary key (item_id, occurrence_date)
);
create index if not exists schedule_exceptions_user_idx on public.schedule_exceptions (user_id);

-- ---------- 2. Seguridad (RLS) ----------
do $$
declare t text;
begin
  foreach t in array array['notes_by_date','drawings_by_date','schedule_items','schedule_exceptions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format('create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_own', t);
  end loop;
end $$;

-- ---------- 3. Realtime ----------
do $$
declare t text;
begin
  foreach t in array array['notes_by_date','drawings_by_date','schedule_items','schedule_exceptions'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
             when undefined_object then null;   -- proyecto sin publicación realtime
    end;
  end loop;
end $$;

-- ---------- 4. Copia de horarios actuales (solo si existe public.schedules) ----------
-- Cada bloque semanal pasa a ser una serie "se repite cada <día>", sin fecha de inicio ni fin,
-- que es exactamente como se comportaba en Noti 3.0.
do $$
begin
  if to_regclass('public.schedules') is not null then
    insert into public.schedule_items
      (user_id, kind, subject, room, teacher, color, start_time, end_time, weekdays, position, legacy_schedule_id)
    select s.user_id, 'recurring', coalesce(s.subject,''), coalesce(s.room,''), coalesce(s.teacher,''), s.color,
           nullif(s.start_time::text,'')::time, nullif(s.end_time::text,'')::time,
           array[s.day_of_week::smallint], coalesce(s.position,0), s.id::text
    from public.schedules s
    where s.day_of_week between 1 and 7
    on conflict (user_id, legacy_schedule_id) do nothing;
  end if;
end $$;

-- =====================================================================
-- VERIFICACIÓN (ejecútalas después; no modifican datos)
-- =====================================================================
-- a) Cada horario original debe tener su copia (debe devolver 0 filas):
--    select s.id from public.schedules s
--    where not exists (select 1 from public.schedule_items i where i.user_id = s.user_id and i.legacy_schedule_id = s.id::text);
-- b) Conteos comparables:
--    select (select count(*) from public.schedules) as originales, (select count(*) from public.schedule_items where legacy_schedule_id is not null) as copiados;
-- c) Las tablas originales siguen intactas:
--    select count(*) from public.notes; select count(*) from public.drawings; select count(*) from public.schedules;
-- d) RLS activo en las 4 tablas nuevas (rowsecurity = true):
--    select tablename, rowsecurity from pg_tables where tablename in ('notes_by_date','drawings_by_date','schedule_items','schedule_exceptions');
--
-- ROLLBACK (solo si quisieras deshacer; no afecta a Noti 3.0 ni a tus datos antiguos):
--    drop table public.schedule_exceptions, public.schedule_items, public.drawings_by_date, public.notes_by_date;
