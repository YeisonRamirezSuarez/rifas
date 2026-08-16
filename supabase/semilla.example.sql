-- Semilla del primer superadmin. Copiar, cambiar el correo por el tuyo y correr
-- una sola vez en el SQL Editor DESPUÉS de aplicar las migraciones.
--
-- No va dentro de una migración a propósito: el correo del dueño es dato de cada
-- instalación, no del esquema. Con él en la migración, cualquiera que clone el
-- repositorio siembra el correo de otra persona como superadmin de su base.
insert into accesos_previos (email, rol)
values ('tu-correo@ejemplo.com', 'superadmin')
on conflict (email) do update set rol = excluded.rol;
