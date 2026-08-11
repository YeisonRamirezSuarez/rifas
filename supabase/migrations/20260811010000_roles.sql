-- Cuentas, roles y aprobación manual.
--
--   perfiles         -> un registro por usuario: rol y estado de aprobación.
--   accesos_previos  -> lista blanca: quien esté aquí entra ya aprobado y con su rol.
--
-- Roles por ahora: superadmin (aprueba cuentas) y admin (lleva sus rifas).
-- 'cliente' queda declarado para después; todavía no tiene permisos propios.

create table if not exists perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  nombre text,
  rol text not null default 'admin' check (rol in ('superadmin', 'admin', 'cliente')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  creado_en timestamptz not null default now(),
  aprobado_en timestamptz
);

create table if not exists accesos_previos (
  email text primary key,
  rol text not null default 'superadmin' check (rol in ('superadmin', 'admin', 'cliente'))
);

insert into accesos_previos (email, rol)
values ('yeisonfabianramirezsuarez@gmail.com', 'superadmin')
on conflict (email) do update set rol = excluded.rol;

-- security definer: estas funciones se usan dentro de las policies de `perfiles`,
-- y sin definer la consulta volvería a evaluar la policy y entraría en recursión.
create or replace function public.es_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'superadmin');
$$;

create or replace function public.esta_aprobado() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and estado = 'aprobado');
$$;

-- Al registrarse se crea el perfil. Si el correo está en la lista blanca entra
-- aprobado con su rol; si no, queda pendiente de que un superadmin lo acepte.
create or replace function public.manejar_usuario_nuevo() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rol_asignado text;
  estado_asignado text;
begin
  select a.rol into rol_asignado from accesos_previos a where a.email = new.email;
  if rol_asignado is null then
    rol_asignado := 'admin';
    estado_asignado := 'pendiente';
  else
    estado_asignado := 'aprobado';
  end if;

  insert into perfiles (id, email, nombre, rol, estado, aprobado_en)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'nombre', ''),
    rol_asignado,
    estado_asignado,
    case when estado_asignado = 'aprobado' then now() end
  )
  on conflict (id) do nothing;

  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
after insert on auth.users
for each row execute function public.manejar_usuario_nuevo();

-- Perfiles para los usuarios que ya existieran antes de esta migración.
insert into perfiles (id, email, rol, estado, aprobado_en)
select
  u.id,
  u.email,
  coalesce(a.rol, 'admin'),
  case when a.email is not null then 'aprobado' else 'pendiente' end,
  case when a.email is not null then now() end
from auth.users u
left join accesos_previos a on a.email = u.email
on conflict (id) do nothing;

alter table perfiles enable row level security;
alter table accesos_previos enable row level security;

drop policy if exists "perfil propio o superadmin" on perfiles;
drop policy if exists "superadmin edita perfiles" on perfiles;
drop policy if exists "accesos solo superadmin" on accesos_previos;

create policy "perfil propio o superadmin" on perfiles for select to authenticated
  using (id = auth.uid() or es_superadmin());
create policy "superadmin edita perfiles" on perfiles for update to authenticated
  using (es_superadmin()) with check (es_superadmin());
create policy "accesos solo superadmin" on accesos_previos for all to authenticated
  using (es_superadmin()) with check (es_superadmin());

-- Escribir rifas exige, además de ser el dueño, tener la cuenta aprobada.
drop policy if exists "rifas del dueno" on rifas;
drop policy if exists "numeros del dueno" on numeros;
drop policy if exists "compradores solo dueno" on compradores;

create policy "rifas del dueno" on rifas for all to authenticated
  using (dueno = auth.uid() and esta_aprobado())
  with check (dueno = auth.uid() and esta_aprobado());
create policy "numeros del dueno" on numeros for all to authenticated
  using (es_mia(rifa_id) and esta_aprobado())
  with check (es_mia(rifa_id) and esta_aprobado());
create policy "compradores solo dueno" on compradores for all to authenticated
  using (es_mia(rifa_id) and esta_aprobado())
  with check (es_mia(rifa_id) and esta_aprobado());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'perfiles'
  ) then
    alter publication supabase_realtime add table perfiles;
  end if;
end $$;
