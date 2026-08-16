-- Bajar el total no puede borrar ventas.
--
-- Antes, el cliente corría `delete from numeros where numero >= totalNumeros` 600 ms
-- después de teclear, y la clave foránea de `compradores` cascadeaba. Tecleando un
-- total más chico desaparecían números vendidos con sus compradores, sin aviso.

-- `security definer` no es un detalle: el trigger cuenta números para decidir, y si
-- corriera con el RLS del que edita podría ver menos filas de las que hay y dejar
-- pasar un borrado. Tiene que ver la tabla entera para que el conteo signifique algo.
create or replace function public.proteger_total_numeros() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_nuevo int;
  v_viejo int;
  v_max   int;
begin
  v_nuevo := (new.config ->> 'totalNumeros')::int;
  v_viejo := (old.config ->> 'totalNumeros')::int;

  -- Sin total declarado no hay límite que hacer cumplir. Bloquear por un dato ausente
  -- rompería rifas viejas por algo que no es del dueño.
  if v_nuevo is null then
    return new;
  end if;

  -- Solo cuando el total baja: escribir el título o el premio no debe pagar una
  -- consulta a `numeros`, que es la tabla grande.
  if v_viejo is not null and v_nuevo >= v_viejo then
    return new;
  end if;

  select max(numero) into v_max from numeros where rifa_id = new.id;

  if v_max is not null and v_max >= v_nuevo then
    raise exception
      'No se puede bajar a %: hay números vendidos hasta el %. Libéralos primero.',
      v_nuevo, v_max using errcode = 'RIF01';
  end if;

  return new;
end $$;

drop trigger if exists al_bajar_total on rifas;
create trigger al_bajar_total before update on rifas
  for each row execute function public.proteger_total_numeros();
