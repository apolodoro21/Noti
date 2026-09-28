-- NOTI 2.0 - login con usuario + contraseña
-- Ejecutar en Supabase > SQL Editor > New query. Se puede correr más de una vez.
-- Si ya tenías get_login_email creada, este archivo la reemplaza.

-- 1) Columna, unicidad (sin distinguir mayúsculas) y formato
alter table public.profiles add column if not exists username text;

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username));

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_.]{3,20}$');

-- 2) usuario -> correo (lo usa el login).
--    Busca en profiles y, si el perfil aún no existe (cuenta recién creada que
--    todavía no confirmó el correo), en los metadatos del registro.
drop function if exists public.get_login_email(text);
create function public.get_login_email(p_username text)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.email::text
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(coalesce(p.username, u.raw_user_meta_data->>'username')) = lower(trim(p_username))
  limit 1;
$$;

revoke all on function public.get_login_email(text) from public;
grant execute on function public.get_login_email(text) to anon, authenticated;

-- 3) ¿está libre el usuario? (lo usa el registro)
drop function if exists public.username_available(text);
create function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select not exists (
    select 1
    from auth.users u
    left join public.profiles p on p.id = u.id
    where lower(coalesce(p.username, u.raw_user_meta_data->>'username')) = lower(trim(p_username))
  );
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- 4) Tu cuenta existente: asígnale un usuario (en minúsculas).
--    Saca tu id con:  select id, display_name, username from public.profiles;
-- update public.profiles set username = 'tu_usuario' where id = 'AQUÍ-EL-UUID';

-- 5) Prueba (debe devolver tu correo):
-- select public.get_login_email('tu_usuario');
