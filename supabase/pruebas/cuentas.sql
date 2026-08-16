-- Pruebas de humo del sistema de cuentas. Corre completo y no deja nada:
--   psql "$DATABASE_URL" -f supabase/pruebas/cuentas.sql
-- o pegar en el SQL Editor de Supabase. Si algo falla, revienta con el mensaje.
--
-- Cada bloque que espera una excepción no solo comprueba que algo reventó: revisa
-- que el mensaje sea el de la protección que se está probando. Un `when others`
-- que se conforma con cualquier excepción tapa el caso en que la protección
-- correcta está rota pero otra, distinta, revienta por casualidad primero.
begin;

-- Tres usuarios de mentira. El trigger de alta les crea su perfil solo. Ana
-- existe solo para poder probar el candado con DOS superadmins a la vez (un
-- update que los toque a los dos de una sentencia); queda degradada a 'admin'
-- antes de que el resto del archivo empiece, así que de ahí en más Jefe vuelve a
-- ser el único superadmin, como esperan las pruebas de más abajo.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', 'jefe@prueba.test', '{"nombre":"Jefe"}'),
  ('22222222-2222-2222-2222-222222222222', 'pepe@prueba.test', '{"nombre":"Pepe"}'),
  ('44444444-4444-4444-4444-444444444444', 'ana@prueba.test', '{"nombre":"Ana"}');

update perfiles set rol = 'superadmin', estado = 'aprobado'
where id = '11111111-1111-1111-1111-111111111111';
update perfiles set estado = 'aprobado'
where id = '22222222-2222-2222-2222-222222222222';
update perfiles set rol = 'superadmin', estado = 'aprobado'
where id = '44444444-4444-4444-4444-444444444444';

insert into rifas (id, slug, dueno, config)
values ('33333333-3333-3333-3333-333333333333', 'rifa-prueba',
        '22222222-2222-2222-2222-222222222222', '{"titulo":"Prueba"}');
insert into numeros (rifa_id, numero, pago)
values ('33333333-3333-3333-3333-333333333333', 1, 'efectivo');

do $$
declare
  n int;
begin
  -------------------------------------------- candado "al menos un superadmin"
  -- Corre con el rol de la conexión (sin `set local role` todavía), fuera de
  -- RLS: lo que se prueba es el trigger en sí, no si una policy lo protege antes
  -- de llegar a él.

  -- El candado mira TODA la tabla, no solo los usuarios de mentira: si esto
  -- corre contra una base con datos reales (que es justo el caso de uso de este
  -- archivo), puede haber un superadmin real aprobado de antes. Sin este paso,
  -- "degradar a los dos superadmins de mentira" no vacía nada — el real sigue
  -- sosteniendo el conteo — y las pruebas de abajo darían falso verde por la
  -- razón equivocada. Se destierra aquí dentro de la misma transacción, que
  -- termina en rollback: no es un cambio real.
  update perfiles set rol = 'admin'
  where rol = 'superadmin'
    and id not in ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444');

  -- Multi-fila: degradar a Jefe y Ana (los dos superadmins de mentira, ahora los
  -- únicos aprobados de la tabla) en una sola sentencia tiene que reventar. Si
  -- esto pasa de largo, el candado no está viendo los cambios de la propia
  -- sentencia (I2a reabierto).
  begin
    update perfiles set rol = 'admin'
    where id in ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444');
    raise exception 'FALLA: un update multi-fila dejó la tabla sin superadmins';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
    if sqlerrm !~ 'Debe quedar al menos un superadmin aprobado' then
      raise exception 'FALLA: el multi-fila reventó, pero por el motivo equivocado: %', sqlerrm;
    end if;
  end;

  -- Control positivo: degradar a UNO de los dos (Ana) sí tiene que permitirse.
  -- Si esto revienta, el candado bloquea de más.
  update perfiles set rol = 'admin' where id = '44444444-4444-4444-4444-444444444444';
  select count(*) into n from perfiles where rol = 'superadmin' and estado = 'aprobado';
  if n <> 1 then
    raise exception 'FALLA: degradar a un superadmin de dos no dejó exactamente 1 (dio %)', n;
  end if;

  -- Con Jefe como único superadmin, bajarle el ESTADO (sin tocar el rol)
  -- también tiene que reventar: el candado mira rol Y estado (I1).
  begin
    update perfiles set estado = 'rechazado'
    where id = '11111111-1111-1111-1111-111111111111';
    raise exception 'FALLA: se pudo rechazar al único superadmin aprobado';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
    if sqlerrm !~ 'Debe quedar al menos un superadmin aprobado' then
      raise exception 'FALLA: el bloqueo por estado reventó, pero por el motivo equivocado: %', sqlerrm;
    end if;
  end;

  ---------------------------------------------------------------- usuario común
  set local role authenticated;
  set local request.jwt.claims =
    '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

  -- No revienta: no hay policy de update para el usuario común, así que RLS no
  -- deja error, simplemente no encuentra fila que actualizar. Lo que prueba que
  -- la escritura fue bloqueada es row_count = 0, no un select posterior: Pepe no
  -- puede ver la fila de Jefe (ni falta que hace, es la suya propia), así que un
  -- select después solo confirmaría que RLS también oculta lectura, no que la
  -- escritura no pasó.
  update perfiles set rol = 'superadmin'
  where id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FALLA: un usuario común cambió su propio rol';
  end if;

  update perfiles set estado = 'rechazado'
  where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FALLA: un usuario común escribió el estado de otro';
  end if;

  perform actualizar_mi_nombre('  Pepe Nuevo  ');
  if (select nombre from perfiles where id = '22222222-2222-2222-2222-222222222222')
     <> 'Pepe Nuevo' then
    raise exception 'FALLA: actualizar_mi_nombre no guardó ni recortó el nombre';
  end if;

  -- El tope de 100 caracteres (I3) tiene que rechazar, no truncar en silencio.
  begin
    perform actualizar_mi_nombre(repeat('x', 101));
    raise exception 'FALLA: actualizar_mi_nombre aceptó un nombre de 101 caracteres';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
    if sqlerrm !~ 'muy largo' then
      raise exception 'FALLA: el rechazo del nombre largo fue por el motivo equivocado: %', sqlerrm;
    end if;
  end;

  ------------------------------------------------------------------ superadmin
  set local request.jwt.claims =
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

  begin
    update perfiles set rol = 'admin'
    where id = '11111111-1111-1111-1111-111111111111';
    raise exception 'FALLA: el superadmin se degradó a sí mismo';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
    if sqlerrm !~ 'No puedes cambiar tu propio rol' then
      raise exception 'FALLA: la auto-degradación reventó, pero por el motivo equivocado: %', sqlerrm;
    end if;
  end;

  begin
    update perfiles set pago_nota = repeat('x', 201)
    where id = '22222222-2222-2222-2222-222222222222';
    raise exception 'FALLA: pago_nota aceptó 201 caracteres';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
    if sqlerrm !~ 'perfiles_pago_nota_largo' then
      raise exception 'FALLA: el rechazo de pago_nota fue por el motivo equivocado: %', sqlerrm;
    end if;
  end;

  update perfiles set estado = 'aprobado', pagado_en = now(), pago_nota = 'Nequi'
  where id = '22222222-2222-2222-2222-222222222222';

  --------------------------------------------------------------------- anónimo
  set local role anon;
  set local request.jwt.claims = '{"role":"anon"}';

  select count(*) into n from rifas
  where id = '33333333-3333-3333-3333-333333333333';
  if n <> 1 then
    raise exception 'FALLA: la rifa de un dueño aprobado no se lee como anónimo';
  end if;

  reset role;
  update perfiles set estado = 'rechazado'
  where id = '22222222-2222-2222-2222-222222222222';

  set local role anon;
  set local request.jwt.claims = '{"role":"anon"}';
  select count(*) into n from rifas
  where id = '33333333-3333-3333-3333-333333333333';
  if n <> 0 then
    raise exception 'FALLA: la rifa de un dueño rechazado sigue siendo pública';
  end if;

  -- I4: el superadmin sí la sigue viendo — es la pantalla desde donde se audita
  -- justo a las cuentas que están rechazadas.
  set local role authenticated;
  set local request.jwt.claims =
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

  select count(*) into n from rifas
  where id = '33333333-3333-3333-3333-333333333333';
  if n <> 1 then
    raise exception 'FALLA: el superadmin dejó de ver la rifa de una cuenta rechazada';
  end if;

  select count(*) into n from numeros
  where rifa_id = '33333333-3333-3333-3333-333333333333';
  if n <> 1 then
    raise exception 'FALLA: el superadmin dejó de ver los números de una cuenta rechazada';
  end if;

  reset role;

  ------------------------------------------- el alta aguanta un nombre largo
  -- Un tope cosmético no puede tumbar un registro: `manejar_usuario_nuevo`
  -- recorta. Si en cambio dejara reventar el check, el insert en `auth.users`
  -- se aborta entero y el visitante se queda sin cuenta viendo un error de
  -- base. Por eso acá se recorta en silencio y en `actualizar_mi_nombre` se
  -- rechaza con mensaje: allá hay alguien mirando la pantalla a quien avisarle.
  begin
    insert into auth.users (id, email, raw_user_meta_data)
    values ('55555555-5555-5555-5555-555555555555', 'largo@prueba.test',
            jsonb_build_object('nombre', repeat('z', 250)));
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
    raise exception 'FALLA: el alta con un nombre de 250 caracteres murió en vez de recortar: %', sqlerrm;
  end;

  select length(nombre) into n from perfiles
  where id = '55555555-5555-5555-5555-555555555555';
  if n is distinct from 100 then
    raise exception 'FALLA: el alta con nombre de 250 caracteres no quedó recortada a 100 (dio %)', n;
  end if;

  -- El alta y `actualizar_mi_nombre` tienen que normalizar igual: si una recorta
  -- espacios y la otra no, el mismo nombre queda distinto según dónde se escriba.
  insert into auth.users (id, email, raw_user_meta_data)
  values ('66666666-6666-6666-6666-666666666666', 'espacios@prueba.test',
          jsonb_build_object('nombre', '   Ana Sosa   '));

  if (select nombre from perfiles where id = '66666666-6666-6666-6666-666666666666')
     is distinct from 'Ana Sosa' then
    raise exception 'FALLA: el alta no recortó los espacios del nombre (quedó [%])',
      (select nombre from perfiles where id = '66666666-6666-6666-6666-666666666666');
  end if;

  ------------------------------------ un superadmin rechazado no lee de más
  -- `es_superadmin()` ignora el estado, así que sin el `and esta_aprobado()`
  -- de las policies un superadmin desactivado conservaría la lectura global.
  -- Ana vuelve a superadmin solo para que rechazar a Jefe no dispare el
  -- candado del último superadmin, que es otra protección y taparía ésta.
  update perfiles set rol = 'superadmin', estado = 'aprobado'
  where id = '44444444-4444-4444-4444-444444444444';
  update perfiles set estado = 'rechazado'
  where id = '11111111-1111-1111-1111-111111111111';

  set local role authenticated;
  set local request.jwt.claims =
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

  -- El dueño de la rifa sigue rechazado, así que la lectura pública también da
  -- 0: lo que se mide acá es que ser superadmin ya no agregue nada.
  select count(*) into n from rifas
  where id = '33333333-3333-3333-3333-333333333333';
  if n <> 0 then
    raise exception 'FALLA: un superadmin rechazado sigue viendo la rifa de una cuenta desactivada';
  end if;

  select count(*) into n from numeros
  where rifa_id = '33333333-3333-3333-3333-333333333333';
  if n <> 0 then
    raise exception 'FALLA: un superadmin rechazado sigue viendo los números de una cuenta desactivada';
  end if;

  reset role;
  raise notice 'Todas las pruebas de cuentas pasaron.';
end $$;

rollback;
