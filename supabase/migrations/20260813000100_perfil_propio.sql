-- Perfil propio editable, correo sincronizado y candado contra quedarse sin acceso.

-- Mismo espíritu que el tope de `pago_nota` (200) y el mínimo de
-- `compradores.nombre`: un nombre sin límite se pinta en la lista del superadmin
-- y viaja en cada payload de realtime. 100 alcanza de sobra para un nombre propio
-- (el tope es más chico que el de `pago_nota` porque un nombre no es una nota).
alter table perfiles drop constraint if exists perfiles_nombre_largo;
alter table perfiles add constraint perfiles_nombre_largo
  check (nombre is null or length(nombre) <= 100);

-- Cambiar el nombre propio por función y no por policy: RLS no restringe columnas, y
-- un `grant update (nombre) to authenticated` actúa por rol — le quitaría al
-- superadmin la escritura de `estado` y `rol`, porque él también es `authenticated`.
-- Así `perfiles` no necesita ninguna policy de update para el usuario común.
-- El largo se valida acá además del check de la tabla porque este RPC es la única
-- puerta que queda abierta a un `nuevo` de más de 100 caracteres mandado a mano
-- (consola del navegador, curl a /rpc): el `<input>` del cliente ya trae su propio
-- `maxLength`, así que por el camino normal nunca se llega a este `if`. Por eso
-- rechaza en vez de recortar: quien la llama espera una respuesta, y hay margen
-- para devolvérsela — a diferencia del alta (ver `manejar_usuario_nuevo` más abajo),
-- que no tiene a quién avisarle si falla.
create or replace function public.actualizar_mi_nombre(nuevo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(trim(nuevo)) > 100 then
    raise exception 'El nombre es muy largo (máximo 100 caracteres).';
  end if;

  update perfiles set nombre = nullif(trim(nuevo), '') where id = auth.uid();
end $$;

revoke all on function public.actualizar_mi_nombre(text) from public, anon;
grant execute on function public.actualizar_mi_nombre(text) to authenticated;

-- El check de arriba puede reventar el alta: `manejar_usuario_nuevo` (de
-- 20260811010000_roles.sql) copia `raw_user_meta_data->>'nombre'` tal cual, y un
-- nombre de más de 100 caracteres al registrarse aborta el `insert` en `perfiles`
-- — lo que aborta el `insert` en `auth.users` entero, porque el trigger corre en
-- la misma transacción. El visitante ve un error genérico de GoTrue y no queda
-- cuenta creada. Por eso acá se recorta en silencio en vez de rechazar: el alta
-- no tiene a quién devolverle un mensaje de error (dispara sola, disparada por
-- GoTrue, sin que el que se registra vea el resultado de este trigger), así que
-- fallar no protege a nadie, solo rompe el único camino de entrada. Un nombre
-- cortado es un defecto cosmético que el usuario puede arreglar después desde
-- "Mi cuenta"; un alta que revienta no tiene arreglo desde la UI. Contraste con
-- `actualizar_mi_nombre` arriba, que sí rechaza: ahí hay un llamador esperando
-- respuesta y margen para devolvérsela.
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
    nullif(left(trim(new.raw_user_meta_data ->> 'nombre'), 100), ''),
    rol_asignado,
    estado_asignado,
    case when estado_asignado = 'aprobado' then now() end
  )
  on conflict (id) do nothing;

  return new;
end $$;

-- El alta ya copia el correo; el cambio no. Sin esto, quien cambie su correo en
-- Supabase queda con dos correos distintos y `accesos_previos`, que compara por
-- correo, deja de reconocerlo.
create or replace function public.sincronizar_correo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update perfiles set email = new.email where id = new.id;
  return new;
end $$;

drop trigger if exists al_cambiar_correo on auth.users;
create trigger al_cambiar_correo
after update of email on auth.users
for each row when (old.email is distinct from new.email)
execute function public.sincronizar_correo();

-- Un clic mal dado te deja fuera de tu propia plataforma y solo se arregla entrando
-- por SQL. La UI también lo impide, pero la UI no es donde se defiende esto.
create or replace function public.proteger_perfiles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.rol is distinct from old.rol and old.id = auth.uid() then
    raise exception 'No puedes cambiar tu propio rol.';
  end if;

  return new;
end $$;

drop trigger if exists al_editar_perfil on perfiles;
create trigger al_editar_perfil
before update on perfiles
for each row execute function public.proteger_perfiles();

-- El candado de "al menos un superadmin" no puede vivir en un trigger por fila:
--   - un update que toca varias filas de una ("where rol='superadmin'") dispara
--     el trigger una vez por fila, y cada disparo cuenta sobre datos que todavía
--     no reflejan los cambios de las otras filas de esa misma sentencia — con dos
--     superadmins, cada uno "ve" al otro como superadmin y los dos pasan.
--   - dos transacciones concurrentes que se degradan una a la otra (dos clics de
--     panel casi al mismo tiempo) tienen el mismo problema entre sesiones.
-- Por eso es AFTER ... FOR EACH STATEMENT, que cuenta una sola vez al final sobre
-- el resultado ya aplicado por la sentencia, y por eso el conteo va detrás de un
-- advisory lock: serializa las sentencias que sí tocan rol/estado para que la
-- segunda transacción cuente después de que la primera termine (commit o
-- rollback), no en paralelo con ella. También cubre estado: un superadmin
-- aprobado que queda 'rechazado' pierde el acceso exactamente igual que uno sin
-- rol de superadmin.
--
-- Si esto llega a dejar la tabla en cero superadmins aprobados (por un DELETE,
-- que este trigger no cubre, o por una restauración), la salida es un único
-- update que ponga rol y estado a la vez, por ejemplo:
--   update perfiles set rol = 'superadmin', estado = 'aprobado' where id = '...';
-- En dos pasos no sirve: el primer update (por ejemplo, solo el rol) sigue
-- viendo cero superadmins aprobados en el momento en que corre y revienta ahí,
-- antes de llegar al segundo.
create or replace function public.proteger_ultimo_superadmin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from anteriores a join nuevas n on n.id = a.id
    where a.rol is distinct from n.rol or a.estado is distinct from n.estado
  ) then
    return null;
  end if;

  -- 872341987 no tiene más significado que "el número de este candado": se generó
  -- una vez y queda fijo para que todas las sentencias que llegan hasta acá
  -- compitan por la misma clave. Es la forma de un argumento (`classid` 0
  -- implícito), así que choca con cualquier otro `pg_advisory_xact_lock` de un
  -- solo argumento que use este mismo número — no hay ningún otro en el repo, y
  -- es una colisión de baja probabilidad si algo externo también usa locks
  -- consultivos de sesión (esta base no lo hace).
  perform pg_advisory_xact_lock(872341987);

  if not exists (select 1 from perfiles where rol = 'superadmin' and estado = 'aprobado') then
    raise exception 'Debe quedar al menos un superadmin aprobado.';
  end if;

  return null;
end $$;

drop trigger if exists al_editar_perfiles_lote on perfiles;
create trigger al_editar_perfiles_lote
after update on perfiles
referencing old table as anteriores new table as nuevas
for each statement execute function public.proteger_ultimo_superadmin();
