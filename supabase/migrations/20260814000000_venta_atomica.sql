-- La venta, en una sola transacción.
--
-- Antes eran dos escrituras desde el navegador —primero `numeros`, después
-- `compradores`— con un borrado manual si la segunda fallaba. Ese deshacer solo corre
-- si el navegador sigue vivo: cerrando la pestaña o cortándose la red entre las dos,
-- el número quedaba vendido sin comprador, y la clave primaria impedía revenderlo.

create or replace function public.vender_numeros(
  p_rifa     uuid,
  p_numeros  int[],
  p_nombre   text,
  p_telefono text,
  p_pago     text default 'pendiente'
) returns setof numeros
language plpgsql security definer set search_path = public as $$
declare
  v_total      int;
  v_max        int;
  v_min        int;
  v_finalizado boolean;
begin
  -- `security definer` apaga el RLS: sin esta comprobación cualquier usuario
  -- autenticado vendería en la rifa de otro. Es la seguridad entera de la función.
  if not (es_mia(p_rifa) and esta_aprobado()) then
    raise exception 'Esta rifa no es tuya, o tu cuenta todavía no está aprobada.'
      using errcode = '42501';
  end if;

  if p_numeros is null or array_length(p_numeros, 1) is null then
    raise exception 'No hay números que vender.' using errcode = '22023';
  end if;

  if array_length(p_numeros, 1) <> (select count(distinct n) from unnest(p_numeros) n) then
    raise exception 'La lista de números trae repetidos.' using errcode = '22023';
  end if;

  -- Se valida acá y no solo con los `check` de `compradores` para que el dueño lea un
  -- mensaje y no el nombre de una constraint.
  if length(trim(coalesce(p_nombre, ''))) < 2 then
    raise exception 'El nombre del comprador necesita al menos 2 letras.'
      using errcode = '22023';
  end if;

  if coalesce(p_telefono, '') !~ '^[0-9]{7,15}$' then
    raise exception 'El teléfono debe tener entre 7 y 15 dígitos, sin espacios ni signos.'
      using errcode = '22023';
  end if;

  -- Sin esto, un valor cualquiera revienta contra el `check` de `numeros` y el dueño
  -- lee el texto crudo de la constraint.
  if coalesce(p_pago, '') not in ('pendiente', 'efectivo', 'transferencia') then
    raise exception 'Pago inválido: %. Solo vale pendiente, efectivo o transferencia.', p_pago
      using errcode = '22023';
  end if;

  -- `for update` bloquea la fila de la rifa, que es la misma que bloquea el trigger
  -- que baja el total. Sin esto, una pestaña baja el total mientras otra vende por
  -- encima y ninguna de las dos comprobaciones ve a la otra.
  select coalesce((config ->> 'totalNumeros')::int, 0),
         coalesce((config ->> 'finalizado')::boolean, false)
    into v_total, v_finalizado
  from rifas where id = p_rifa for update;

  -- El cliente ya lo frena, pero el RPC se puede llamar directo: la regla vive donde
  -- no se puede esquivar salteando el cliente.
  if v_finalizado then
    raise exception 'El sorteo ya está cerrado. Reábrelo para seguir vendiendo.'
      using errcode = '22023';
  end if;

  select min(n), max(n) into v_min, v_max from unnest(p_numeros) n;

  -- El tablero va de 0 a total-1, por eso `>=` y no `>`.
  if v_min < 0 or v_max >= v_total then
    raise exception 'Los números de esta rifa van del 0 al %; llegó el %.', v_total - 1, v_max
      using errcode = '22003';
  end if;

  -- Un insert por sentencia: o entran todas las filas o no entra ninguna. El choque de
  -- clave primaria sale como 23505 y significa que alguien lo vendió primero.
  insert into numeros (rifa_id, numero, pago)
  select p_rifa, n, p_pago from unnest(p_numeros) n;

  insert into compradores (rifa_id, numero, nombre, telefono)
  select p_rifa, n, trim(p_nombre), p_telefono from unnest(p_numeros) n;

  return query
    select * from numeros where rifa_id = p_rifa and numero = any(p_numeros);
end $$;

revoke all on function public.vender_numeros(uuid, int[], text, text, text) from public, anon;
grant execute on function public.vender_numeros(uuid, int[], text, text, text) to authenticated;
