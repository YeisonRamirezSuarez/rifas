-- Esquema de las rifas. Pegar completo en Supabase > SQL Editor > Run.
--
-- Cada persona tiene su cuenta y puede llevar varias rifas al tiempo.
--   rifas       -> una fila por rifa, con su dueño y su slug para el link público.
--   numeros     -> qué está vendido. Lectura pública: cualquiera con el link ve el tablero.
--   compradores -> nombre y teléfono. Solo el dueño. El "tapado" es real, no maquillaje:
--                  la API ni siquiera devuelve estos datos a un visitante.

create extension if not exists pgcrypto;

create table if not exists rifas (
  id uuid primary key default gen_random_uuid(),
  dueno uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug text not null unique,
  config jsonb not null default '{}'::jsonb,
  creada_en timestamptz not null default now()
);

create index if not exists rifas_dueno_idx on rifas (dueno);

create table if not exists numeros (
  rifa_id uuid not null references rifas (id) on delete cascade,
  numero int not null,
  pago text not null default 'pendiente' check (pago in ('pendiente', 'efectivo', 'transferencia')),
  vendido_en timestamptz not null default now(),
  primary key (rifa_id, numero)
);

create table if not exists compradores (
  rifa_id uuid not null,
  numero int not null,
  nombre text not null check (length(trim(nombre)) >= 2),
  telefono text not null check (telefono ~ '^[0-9]{7,15}$'),
  primary key (rifa_id, numero),
  foreign key (rifa_id, numero) references numeros (rifa_id, numero) on delete cascade
);

-- La primary key (rifa_id, numero) es lo que evita la venta doble: si dos personas
-- venden el 42 de la misma rifa a la vez, el segundo insert falla con 23505.
-- No hace falta lock, y dos rifas distintas no se estorban.

create or replace function es_mia(r uuid) returns boolean
language sql
stable
as $$
  select exists (select 1 from rifas where id = r and dueno = auth.uid());
$$;

alter table rifas enable row level security;
alter table numeros enable row level security;
alter table compradores enable row level security;

drop policy if exists "rifas lectura publica" on rifas;
drop policy if exists "rifas del dueno" on rifas;
drop policy if exists "numeros lectura publica" on numeros;
drop policy if exists "numeros del dueno" on numeros;
drop policy if exists "compradores solo dueno" on compradores;

-- El póster es público por diseño: quien tenga el link ve el tablero.
create policy "rifas lectura publica" on rifas for select using (true);
create policy "numeros lectura publica" on numeros for select using (true);

-- Escribir solo en lo propio. `dueno` sale de auth.uid() por defecto, y el
-- with check impide crear o mover una rifa a nombre de otra persona.
create policy "rifas del dueno" on rifas for all to authenticated
  using (dueno = auth.uid()) with check (dueno = auth.uid());
create policy "numeros del dueno" on numeros for all to authenticated
  using (es_mia(rifa_id)) with check (es_mia(rifa_id));

-- Sin policy de lectura pública: el visitante anónimo no recibe ni un teléfono.
create policy "compradores solo dueno" on compradores for all to authenticated
  using (es_mia(rifa_id)) with check (es_mia(rifa_id));

-- Realtime: los tableros abiertos se actualizan solos al vender o liberar.
-- En un DO block porque `add table` falla si la tabla ya está en la publicación,
-- y este archivo se debe poder correr dos veces sin romperse.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rifas'
  ) then
    alter publication supabase_realtime add table rifas;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'numeros'
  ) then
    alter publication supabase_realtime add table numeros;
  end if;
end $$;
