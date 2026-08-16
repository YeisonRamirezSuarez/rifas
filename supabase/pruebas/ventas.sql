-- Pruebas de humo de la venta atómica y del candado del total. Corre completo y no
-- deja nada:
--   psql "$DATABASE_URL" -f supabase/pruebas/ventas.sql
-- o pegar en el SQL Editor de Supabase. Si algo falla, revienta con el mensaje.
--
-- Mismo criterio que supabase/pruebas/cuentas.sql: cada bloque que espera una
-- excepción no solo comprueba que algo reventó, revisa el código o el mensaje de
-- la protección concreta. Un `when others` que se conforma con cualquier excepción
-- tapa el caso en que la protección correcta está rota y otra revienta por casualidad.
begin;

-- Dos usuarios de mentira: el dueño de la rifa de prueba, y otro admin aprobado
-- que no tiene nada que ver con ella. El trigger de alta les crea el perfil solo.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('99999999-9999-9999-9999-999999999991', 'dueno-ventas@prueba.test', '{"nombre":"Dueño Ventas"}'),
  ('99999999-9999-9999-9999-999999999992', 'otro-ventas@prueba.test', '{"nombre":"Otro Ventas"}');

update perfiles set estado = 'aprobado'
where id in ('99999999-9999-9999-9999-999999999991', '99999999-9999-9999-9999-999999999992');

-- Tablero de base cero: totalNumeros 10 significa números válidos del 0 al 9.
insert into rifas (id, slug, dueno, config)
values ('99999999-9999-9999-9999-999999999993', 'rifa-ventas-prueba',
        '99999999-9999-9999-9999-999999999991', '{"totalNumeros": 10}'::jsonb);

do $$
declare
  n_numeros     int;
  n_compradores int;
begin
  ---------------------------------------------------------- 1. rifa ajena: 42501
  -- Corre como el admin que no es dueño de esta rifa.
  set local role authenticated;
  set local request.jwt.claims =
    '{"sub":"99999999-9999-9999-9999-999999999992","role":"authenticated"}';

  begin
    perform vender_numeros('99999999-9999-9999-9999-999999999993', array[0],
      'Comprador Ajeno', '3001111111');
    raise exception 'FALLA: un usuario vendió en una rifa que no es suya';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
    if sqlstate <> '42501' then
      raise exception 'FALLA: la venta en rifa ajena reventó, pero con sqlstate=% en vez de 42501 (%)',
        sqlstate, sqlerrm;
    end if;
  end;

  ------------------------------------------------------ 2. fuera de rango: 22003
  -- Desde acá en más, como el dueño real.
  set local request.jwt.claims =
    '{"sub":"99999999-9999-9999-9999-999999999991","role":"authenticated"}';

  begin
    perform vender_numeros('99999999-9999-9999-9999-999999999993', array[10],
      'Comprador Fuera', '3002222222');
    raise exception 'FALLA: se vendió el número 10 en una rifa de totalNumeros=10 (el tope es 9)';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
    if sqlstate <> '22003' then
      raise exception 'FALLA: la venta fuera de rango reventó, pero con sqlstate=% en vez de 22003 (%)',
        sqlstate, sqlerrm;
    end if;
  end;

  ------------------------------------------------------------ 3. repetido: 23505
  -- El número 0 se vende de verdad acá: también deja la semilla para las
  -- aserciones 5 (candado del total) y 7 (conteo final).
  perform vender_numeros('99999999-9999-9999-9999-999999999993', array[0],
    'Primer Comprador', '3003333333');

  begin
    perform vender_numeros('99999999-9999-9999-9999-999999999993', array[0],
      'Segundo Comprador', '3004444444');
    raise exception 'FALLA: se vendió dos veces el mismo número';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
    if sqlstate <> '23505' then
      raise exception 'FALLA: la venta repetida reventó, pero con sqlstate=% en vez de 23505 (%)',
        sqlstate, sqlerrm;
    end if;
  end;

  ------------------------------------------------- 4. mitad de venta sin comprador
  -- El teléfono inválido tiene que reventar por el propio chequeo de la función
  -- (22023, mensaje de teléfono) y no dejar el número 1 huérfano en `numeros`. Si
  -- ese chequeo desapareciera, el mismo teléfono llegaría al insert y reventaría
  -- por el check de la tabla `compradores` en cambio: otro sqlstate, otro mensaje,
  -- y esta aserción lo nota aunque el número 1 igual quede sin fila (el insert
  -- entero se deshace con la sentencia que lo contiene).
  begin
    perform vender_numeros('99999999-9999-9999-9999-999999999993', array[1],
      'Comprador Sin Telefono', 'no-es-un-telefono');
    raise exception 'FALLA: se vendió con un teléfono inválido';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
    if sqlstate <> '22023' or sqlerrm !~ 'teléfono' then
      raise exception 'FALLA: la venta con teléfono inválido reventó, pero por el motivo equivocado (sqlstate=%): %',
        sqlstate, sqlerrm;
    end if;
  end;

  select count(*) into n_numeros from numeros
  where rifa_id = '99999999-9999-9999-9999-999999999993' and numero = 1;
  if n_numeros <> 0 then
    raise exception 'FALLA: quedó un número 1 sin comprador tras el fallo de teléfono';
  end if;

  ------------------------------------------------- 5. bajar por debajo de lo vendido
  -- El número 0 ya está vendido (aserción 3): bajar el total a 0 tiene que reventar.
  begin
    update rifas set config = jsonb_set(config, '{totalNumeros}', '0')
    where id = '99999999-9999-9999-9999-999999999993';
    raise exception 'FALLA: se bajó el total por debajo de un número vendido';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
    if sqlstate <> 'RIF01' then
      raise exception 'FALLA: el candado del total reventó, pero con sqlstate=% en vez de RIF01 (%)',
        sqlstate, sqlerrm;
    end if;
  end;

  ------------------------------- 6. control positivo: bajar por encima de lo vendido
  -- Sin este caso, un candado que bloquea SIEMPRE pasaría igual la aserción 5.
  -- Solo está vendido el 0, así que bajar a 5 (todavía por encima) tiene que entrar.
  update rifas set config = jsonb_set(config, '{totalNumeros}', '5')
  where id = '99999999-9999-9999-9999-999999999993';

  select (config ->> 'totalNumeros')::int into n_numeros from rifas
  where id = '99999999-9999-9999-9999-999999999993';
  if n_numeros <> 5 then
    raise exception 'FALLA: bajar el total por encima de lo vendido no se aplicó (quedó en %)', n_numeros;
  end if;

  ----------------------------------------------- 7. venta correcta: mismas filas
  perform vender_numeros('99999999-9999-9999-9999-999999999993', array[2,3],
    'Comprador Final', '3005555555');

  select count(*) into n_numeros from numeros
  where rifa_id = '99999999-9999-9999-9999-999999999993';
  select count(*) into n_compradores from compradores
  where rifa_id = '99999999-9999-9999-9999-999999999993';
  if n_numeros <> n_compradores then
    raise exception 'FALLA: numeros (%) y compradores (%) quedaron descuadrados', n_numeros, n_compradores;
  end if;

  --------------------------------- 8. la escritura directa está cerrada: 42501
  -- Sin esta aserción, la suite pasa igual de verde si la migración que quita el
  -- `insert` nunca se aplicó, y la venta a medias vuelve a ser posible por la puerta
  -- de atrás. Corre como el dueño: acá no es el RLS el que frena, es el privilegio.
  begin
    insert into numeros (rifa_id, numero)
    values ('99999999-9999-9999-9999-999999999993', 4);
    raise exception 'FALLA: se insertó un número sin pasar por vender_numeros';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
    if sqlstate <> '42501' then
      raise exception 'FALLA: el insert directo reventó, pero con sqlstate=% en vez de 42501 (%)',
        sqlstate, sqlerrm;
    end if;
  end;

  reset role;
  raise notice 'Todas las pruebas de venta pasaron.';
end $$;

rollback;
