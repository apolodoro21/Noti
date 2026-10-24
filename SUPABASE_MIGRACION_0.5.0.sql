-- NOTI 0.5.0 — migración ADITIVA e idempotente. Ejecutar DESPUÉS de la 0.4.0. No toca notes/drawings/schedules.
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists username text;
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format check (username is null or username ~ '^[A-Za-z0-9_.-]{3,20}$');
create unique index if not exists profiles_username_lower_uidx on public.profiles (lower(username)) where username is not null;

alter table public.profiles enable row level security;
do $$ begin
  drop policy if exists profiles_own_select on public.profiles; drop policy if exists profiles_own_insert on public.profiles; drop policy if exists profiles_own_update on public.profiles;
  create policy profiles_own_select on public.profiles for select to authenticated using (auth.uid() = id);
  create policy profiles_own_insert on public.profiles for insert to authenticated with check (auth.uid() = id);
  create policy profiles_own_update on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
end $$;

-- Merge ATÓMICO de settings (una sola sentencia: el bloqueo de fila serializa dispositivos concurrentes).
-- p_patch: claves de preferencias (reemplaza solo esas claves). p_legacy: decisiones de importación; la PRIMERA decisión de cada clave se conserva.
create or replace function public.noti_merge_settings(p_patch jsonb default '{}', p_legacy jsonb default '{}')
returns jsonb language sql security invoker set search_path = public, pg_temp as $$
  insert into public.profiles as p (id, settings)
  values (auth.uid(), coalesce(p_patch,'{}') || jsonb_build_object('legacyImport', coalesce(p_legacy,'{}')))
  on conflict (id) do update set settings =
    (coalesce(p.settings,'{}') || coalesce(p_patch,'{}')) ||
    jsonb_build_object('legacyImport', coalesce(p_legacy,'{}') || coalesce(p.settings->'legacyImport','{}'))
  returning settings;
$$;
revoke all on function public.noti_merge_settings(jsonb, jsonb) from public, anon;
grant execute on function public.noti_merge_settings(jsonb, jsonb) to authenticated;

-- Resolución usuario → correo. SECURITY DEFINER necesario (el visitante aún no está autenticado y RLS oculta profiles).
-- Solo coincidencia EXACTA (sin comodines), una fila, retardo anti-fuerza-bruta. Riesgo residual: enumeración de usuarios/correos (ver CAMBIOS_0.5.0.md).
create or replace function public.email_por_usuario(p_username text)
returns text language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare v text;
begin
  if p_username is null or p_username !~ '^[A-Za-z0-9_.-]{3,20}$' then return null; end if;
  perform pg_sleep(0.2);
  select u.email::text into v from public.profiles p join auth.users u on u.id = p.id where lower(p.username) = lower(p_username) limit 1;
  return v;
end $$;
revoke all on function public.email_por_usuario(text) from public;
grant execute on function public.email_por_usuario(text) to anon, authenticated;

-- El perfil se crea EN LA MISMA transacción que la cuenta: no hay fallo parcial. Usuario duplicado/ inválido => el registro falla entero.
create or replace function public.noti_on_auth_user_created() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v text := nullif(btrim(new.raw_user_meta_data->>'username'),'');
begin
  insert into public.profiles (id, display_name, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), v)
  on conflict (id) do update set username = coalesce(public.profiles.username, excluded.username);
  return new;
end $$;
drop trigger if exists noti_on_auth_user_created on auth.users;
create trigger noti_on_auth_user_created after insert on auth.users for each row execute function public.noti_on_auth_user_created();

-- Usuario existente. mruizn23@gmail.com queda PENDIENTE hasta que confirmes el nombre deseado.
update public.profiles p set username = 'apolo' from auth.users u where u.id = p.id and lower(u.email) = 'apolodoro19@gmail.com' and p.username is null;
-- VERIFICACIÓN: select p.username, u.email from public.profiles p join auth.users u using(id);  select public.email_por_usuario('APOLO');
