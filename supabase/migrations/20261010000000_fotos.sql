-- Fotos del póster: una carpeta por rifa dentro del bucket `fotos`.
-- El bucket es público porque el link público del póster las muestra sin sesión.
-- Escritura y borrado solo del dueño de la rifa, con la misma función de RLS
-- que ya usan las tablas (`es_mia`). El nombre del archivo empieza por el id de
-- la rifa: `<rifa_id>/<timestamp>.jpg`.
--
-- La carpeta tiene que ser un uuid en forma canónica (8-4-4-4-12, minúsculas)
-- antes del cast a `uuid`: sin la guarda, una carpeta rara hace reventar el cast
-- dentro de la política, y un uuid con los guiones en otro sitio se leería como
-- el de la rifa y crearía una carpeta alias.
--
-- El tamaño y los tipos también se limitan en el bucket, no solo en el
-- navegador: con el token de la sesión y un `curl` el navegador no cuenta. Los
-- dos valores están repetidos en `src/fotos.ts` (`MAX_BYTES` y `TIPOS`): si uno
-- cambia, el otro va en la misma tanda, o el bucket rechaza la subida con un
-- error en inglés que el vendedor no puede interpretar.
--
-- No toca ninguna tabla con datos: solo crea un bucket nuevo y sus políticas.
-- Se puede correr más de una vez (todo es idempotente); si el bucket ya existía,
-- le corrige el límite de tamaño, los tipos permitidos y el acceso público.
--
-- Si ya la corriste antes de este cambio, vuelve a correrla completa: esa
-- primera versión dejó el bucket sin límites y con la política de listado
-- puesta, y nada más las quita.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      -- Un bucket `fotos` privado de antes se queda sin política de lectura y sin
      -- `/object/public/...`: el póster no cargaría ninguna foto y nada diría por qué.
      public = excluded.public;

-- Sin `search_path` propio, `es_mia` resuelve `rifas` con el del servicio que la
-- llama, y el de Storage no trae `public`: la política reventaría en la subida.
alter function public.es_mia(uuid) set search_path = public;

-- Un bucket público sirve sus objetos por `/object/public/...` sin pasar por RLS,
-- así que el póster se ve sin política de lectura. Con ella, en cambio, se habilita
-- la API `list`: cualquiera enumeraría las carpetas de todos los dueños.
drop policy if exists "fotos lectura publica" on storage.objects;

drop policy if exists "fotos escribe el dueno" on storage.objects;
create policy "fotos escribe el dueno" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.es_mia(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "fotos borra el dueno" on storage.objects;
create policy "fotos borra el dueno" on storage.objects for delete to authenticated
  using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.es_mia(((storage.foldername(name))[1])::uuid)
  );

-- ROLLBACK (en dos pasos; pégalos POR SEPARADO en el SQL Editor)
--
-- El SQL Editor corre lo que pegas como una sola transacción: si el borrado del
-- bucket falla (paso 2), también se revierten los `drop policy`. Por eso van
-- en ejecuciones distintas.
--
-- Paso 1: quitar las políticas. Pega y corre solo estas tres líneas.
-- drop policy if exists "fotos lectura publica" on storage.objects;
-- drop policy if exists "fotos escribe el dueno" on storage.objects;
-- drop policy if exists "fotos borra el dueno" on storage.objects;
--
-- El `search_path` de `es_mia` se puede dejar como lo deja esta migración: las
-- políticas de las tablas funcionan igual con él fijado. Si se quiere revertir:
-- -- alter function public.es_mia(uuid) reset search_path;
--
-- Paso 2: borrar el bucket `fotos` desde el panel, no con SQL: Supabase > Storage,
-- vaciar el bucket `fotos` y luego menú de los tres puntos > Delete bucket.
-- Las versiones recientes de Supabase rechazan el `delete` directo sobre las
-- tablas de storage ("Direct deletion from storage tables is not allowed").
-- Referencia, PUEDE FALLAR y no se mezcla con el paso 1. Ojo: `delete from
-- storage.buckets` también borraría un bucket `fotos` que ya existiera antes de
-- esta migración (el `insert ... on conflict do update` no lo distingue, y ya le
-- habrá cambiado el límite de tamaño y los tipos permitidos).
-- -- delete from storage.objects where bucket_id = 'fotos';
-- -- delete from storage.buckets where id = 'fotos';
