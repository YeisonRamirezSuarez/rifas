-- El link público de una rifa vale mientras su dueño esté aprobado.
--
-- Antes, desactivar una cuenta le cortaba la escritura pero dejaba sus tableros
-- abiertos: la sanción se veía por dentro y no por fuera, que es justo al revés.

-- security definer: la consulta el visitante anónimo, que no puede leer `perfiles`.
create or replace function public.dueno_aprobado(d uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = d and estado = 'aprobado');
$$;

drop policy if exists "rifas lectura publica" on rifas;
create policy "rifas lectura publica" on rifas for select
  using (dueno_aprobado(dueno));

drop policy if exists "numeros lectura publica" on numeros;
create policy "numeros lectura publica" on numeros for select
  using (dueno_aprobado((select dueno from rifas where id = rifa_id)));

-- Sin esto, desactivar una cuenta le borra sus rifas del "Control general": la
-- pantalla que existe justamente para auditar cuentas desactivadas dejaría de
-- verlas apenas se desactivan. El superadmin ve todo, esté aprobado el dueño o no
-- — pero el superadmin mismo sí tiene que estar aprobado: `es_superadmin()` sola
-- mira `rol` y no `estado`, así que un superadmin en 'rechazado' seguiría leyendo
-- todo. El `and esta_aprobado()` cierra eso acá. Queda asimétrico a propósito: la
-- policy de `perfiles` en 20260811010000_roles.sql tiene el mismo hueco
-- (`es_superadmin()` sin mirar estado) y no se toca en esta migración — cambiar
-- `es_superadmin()` misma alcanzaría también a esa policy vieja, y esta base
-- tiene sorteos en curso.
drop policy if exists "rifas lectura superadmin" on rifas;
create policy "rifas lectura superadmin" on rifas for select to authenticated
  using (es_superadmin() and esta_aprobado());

drop policy if exists "numeros lectura superadmin" on numeros;
create policy "numeros lectura superadmin" on numeros for select to authenticated
  using (es_superadmin() and esta_aprobado());
