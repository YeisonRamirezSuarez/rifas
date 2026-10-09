-- Nadie llama por RPC lo que no es un RPC.
--
-- Todas estas funciones se crearon sin tocar sus permisos, así que quedaron con
-- el `execute` que Postgres le da a PUBLIC: cualquiera con la clave anónima las
-- podía invocar por `/rest/v1/rpc/<nombre>`, incluidas las de trigger y la de
-- event trigger, que son `security definer` y corren como `postgres`.
--
-- Las funciones de trigger no necesitan `execute` para dispararse: el permiso se
-- comprueba al crear el trigger, no cada vez que la fila cambia. Se verificó en
-- la base real antes de escribir esta migración: con el `execute` revocado, un
-- `update` en `rifas` hecho con el rol `authenticated` disparó `al_bajar_total`
-- igual (la prueba corrió dentro de un bloque que terminaba en `raise`, así que
-- no dejó nada).
--
-- No toca ninguna tabla con datos: solo permisos. Se puede correr más de una vez.

-- Funciones de trigger y de event trigger: no se llaman nunca a mano.
revoke all on function public.manejar_usuario_nuevo()      from public, anon, authenticated, service_role;
revoke all on function public.sincronizar_correo()         from public, anon, authenticated, service_role;
revoke all on function public.proteger_perfiles()          from public, anon, authenticated, service_role;
revoke all on function public.proteger_ultimo_superadmin() from public, anon, authenticated, service_role;
revoke all on function public.proteger_total_numeros()     from public, anon, authenticated, service_role;
revoke all on function public.rls_auto_enable()            from public, anon, authenticated, service_role;

-- `al_crear_usuario` y `al_cambiar_correo` cuelgan de `auth.users`, que mueve
-- `supabase_auth_admin`. El permiso explícito sobra mientras el trigger ya exista,
-- pero lo deja en claro para quien vuelva a crearlo.
grant execute on function public.manejar_usuario_nuevo() to supabase_auth_admin;
grant execute on function public.sincronizar_correo()    to supabase_auth_admin;

-- Ayudantes de las políticas: el rol que evalúa la política necesita `execute`,
-- y nadie más. Se quita el permiso de PUBLIC y se concede rol por rol.
--
-- `dueno_aprobado` se queda con `anon` a propósito: las políticas de lectura
-- pública de `rifas` y `numeros` la llaman, y el link público del póster entra
-- sin sesión. Sin ella, la rifa compartida deja de cargar.
revoke all on function public.dueno_aprobado(uuid) from public;
grant execute on function public.dueno_aprobado(uuid) to anon, authenticated, service_role;

-- Estas tres solo salen en políticas de `authenticated`.
revoke all on function public.esta_aprobado()  from public, anon;
grant execute on function public.esta_aprobado()  to authenticated, service_role;

revoke all on function public.es_superadmin()  from public, anon;
grant execute on function public.es_superadmin()  to authenticated, service_role;

revoke all on function public.es_mia(uuid)     from public, anon;
grant execute on function public.es_mia(uuid)     to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Rollback: devolver el `execute` a PUBLIC, que es como estaban.
--
--   grant execute on function public.manejar_usuario_nuevo()      to public;
--   grant execute on function public.sincronizar_correo()         to public;
--   grant execute on function public.proteger_perfiles()          to public;
--   grant execute on function public.proteger_ultimo_superadmin() to public;
--   grant execute on function public.proteger_total_numeros()     to public;
--   grant execute on function public.rls_auto_enable()            to public;
--   grant execute on function public.dueno_aprobado(uuid)         to public;
--   grant execute on function public.esta_aprobado()              to public;
--   grant execute on function public.es_superadmin()              to public;
--   grant execute on function public.es_mia(uuid)                 to public;
-- ---------------------------------------------------------------------------
