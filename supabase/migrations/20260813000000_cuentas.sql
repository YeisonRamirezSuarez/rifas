-- Pago del acceso, salida del rol 'cliente' e índices para la lista del superadmin.

-- El pago de $15.000 entra por fuera de la app (transferencia, efectivo). Aquí solo
-- queda la nota de que llegó: quién, cuándo y por qué medio, escrito a mano.
alter table perfiles
  add column if not exists pagado_en timestamptz,
  add column if not exists pago_nota text;

alter table perfiles drop constraint if exists perfiles_pago_nota_largo;
alter table perfiles add constraint perfiles_pago_nota_largo
  check (pago_nota is null or length(pago_nota) <= 200);

-- 'cliente' se declaró "para después" y nunca tuvo permisos propios. Un rol que no
-- hace nada se confunde con uno que sí, y cada consulta tiene que acordarse de él.
update perfiles set rol = 'admin' where rol = 'cliente';
update accesos_previos set rol = 'admin' where rol = 'cliente';

alter table perfiles drop constraint if exists perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check
  check (rol in ('superadmin', 'admin'));

alter table accesos_previos drop constraint if exists accesos_previos_rol_check;
alter table accesos_previos add constraint accesos_previos_rol_check
  check (rol in ('superadmin', 'admin'));

-- El orden de columnas debe calcar el `order by` de la consulta paginada
-- (estado, creado_en desc, id desc) o el planificador no usa el índice.
create index if not exists perfiles_estado_creado
  on perfiles (estado, creado_en desc, id desc);

-- La búsqueda es `ilike '%texto%'`. Un índice de patrón por prefijo no la atiende;
-- el trigrama sí.
create extension if not exists pg_trgm;
create index if not exists perfiles_email_busqueda
  on perfiles using gin (email gin_trgm_ops);
