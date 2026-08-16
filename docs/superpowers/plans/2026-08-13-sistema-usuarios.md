# Sistema de usuarios — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el ciclo de vida de la cuenta en la app de rifas — recuperar contraseña, perfil propio, administración de cuentas con roles y desactivación, registro manual del pago — y limpiar la higiene que hoy revierte la seguridad en silencio.

**Architecture:** Tres migraciones nuevas de Supabase ponen la base (columnas de pago, RPC del nombre propio, triggers de sincronización y de anti-encierro, y policies de lectura pública atadas al estado del dueño). Del lado del cliente, `usePerfil` se parte en dos —perfil propio y administración de cuentas— y la elección de pantalla en `App.tsx` sale a una función pura testeable. La seguridad real vive en la base: RLS y triggers, no la UI.

**Tech Stack:** React 18 + TypeScript + Vite, Supabase (Postgres + Auth + Realtime), Vitest, funciones serverless de Vercel (edge runtime).

**Spec:** `docs/superpowers/specs/2026-08-13-sistema-usuarios-design.md`

## Global Constraints

- **NUNCA hacer `git commit` ni `git add`.** El usuario lleva su historial a mano. Ninguna tarea de este plan termina en commit; terminan en verificación. Si una skill de ejecución pide commitear, saltarse ese paso y decirlo.
- Idioma del código: español. Nombres de variables, funciones, tipos, comentarios y textos de UI en español, como el resto del repositorio (`nube`, `perfiles`, `esta_aprobado`, `puedeEditar`).
- Los comentarios explican **por qué**, no qué. Es el estilo del repo: cada comentario existente justifica una decisión o un bug pasado. No agregar comentarios descriptivos.
- La app debe seguir funcionando en **modo local** (`nube === null`, sin variables `VITE_SUPABASE_*`): todo lo de cuentas se esconde, nada revienta.
- Tests: Vitest. `npm test` corre todo. Solo se testea lógica pura — el repo no tiene React Testing Library y este plan no la agrega.
- Migraciones: una migración ya aplicada **nunca se reescribe**. Los cambios van en archivos nuevos.
- Roles válidos tras este plan: `'superadmin' | 'admin'`. `'cliente'` desaparece.
- Estados de cuenta: `'pendiente' | 'aprobado' | 'rechazado'`. No se agrega ninguno.

---

## Estructura de archivos

**Se crean:**

| Archivo | Responsabilidad |
| --- | --- |
| `supabase/migrations/20260813000000_cuentas.sql` | Columnas de pago, salida del rol `cliente`, índices. |
| `supabase/migrations/20260813000100_perfil_propio.sql` | Sync de correo, RPC del nombre propio, candado anti-encierro. |
| `supabase/migrations/20260813000200_lectura_publica.sql` | `dueno_aprobado()` y policies de lectura pública. |
| `supabase/pruebas/cuentas.sql` | Pruebas de humo de RLS, triggers y constraints. Corre en transacción con `rollback`. |
| `supabase/semilla.example.sql` | Semilla de `accesos_previos` con correo de ejemplo. |
| `src/sesion.ts` | Función pura `pantalla()`: qué pantalla toca según el estado de sesión. |
| `src/sesion.test.ts` | Matriz de combinaciones de `pantalla()`. |
| `src/cuentas.ts` | Funciones puras del cursor keyset. |
| `src/cuentas.test.ts` | Tests del cursor. |
| `src/useCuentas.ts` | Hook de administración de cuentas: listado, cursor, búsqueda, realtime, escritura. |
| `src/components/CampoClave.tsx` | Input de contraseña con ojo de mostrar/ocultar. |
| `src/components/NuevaClave.tsx` | Pantalla de fijar contraseña tras el enlace de recuperación. |
| `src/components/MiCuenta.tsx` | Panel del perfil propio. |

**Se modifican:**

| Archivo | Cambio |
| --- | --- |
| `src/useRifa.ts` | `recuperarClave`, `cambiarClave`, estado `recuperando`, captura de `PASSWORD_RECOVERY`. |
| `src/usePerfil.ts` | Adelgaza: se le quita todo lo del listado. Gana `guardarNombre`. `Rol` sin `'cliente'`. |
| `src/App.tsx` | Pasa a `switch` sobre `pantalla()`. Monta `useCuentas` solo para superadmin. |
| `src/components/Onboarding.tsx` | Modo `'recuperar'`, usa `CampoClave`. |
| `src/components/PanelSuperadmin.tsx` | Reescrito: búsqueda, paginación, rol, desactivar, pago. |
| `src/styles.css` | Clases nuevas. |
| `api/_correo.ts` | Sin correos personales por defecto. |
| `README.md` | Instrucciones de base de datos y semilla. |

**Se borra:** `supabase.sql`.

**Desviación del spec (justificada):** el spec habla de *una* migración `20260813000000_cuentas.sql`. Se parte en tres porque son tres cambios que un revisor puede aceptar o rechazar por separado, y porque las policies de lectura pública son las de mayor riesgo — conviene que vivan en un archivo que se pueda mirar solo.

---

## Fase D-1 · Higiene (sin tocar la app)

### Task 1: Borrar `supabase.sql` y arreglar el arranque de la base

`supabase.sql` no es solo un archivo viejo. Contiene:

```sql
drop policy if exists "rifas lectura publica" on rifas;
create policy "rifas lectura publica" on rifas for select using (true);
```

Quien siga el README y lo pegue **revierte la Task 5** de este plan sin que nada lo avise: los links públicos de las cuentas desactivadas se vuelven a encender. Se borra antes de construir nada encima.

**Files:**
- Delete: `supabase.sql`
- Create: `supabase/semilla.example.sql`
- Modify: `README.md:136`, y la sección de arranque de base de datos

**Interfaces:**
- Consumes: nada.
- Produces: nada que consuma otra tarea. Es limpieza independiente.

- [ ] **Step 1: Comprobar que nada más referencia `supabase.sql`**

Run:
```bash
grep -rn "supabase.sql" --include=*.md --include=*.json --include=*.ts --include=*.mjs --include=*.yml . --exclude-dir=node_modules --exclude-dir=dist
```
Expected: una sola línea, `README.md:136`. Si aparece otra —un script de CI, un `package.json`— hay que arreglarla también en esta tarea.

- [ ] **Step 2: Borrar el archivo**

```bash
rm supabase.sql
```

- [ ] **Step 3: Crear la semilla de ejemplo**

Crear `supabase/semilla.example.sql`:

```sql
-- Semilla del primer superadmin. Copiar, cambiar el correo por el tuyo y correr
-- una sola vez en el SQL Editor DESPUÉS de aplicar las migraciones.
--
-- No va dentro de una migración a propósito: el correo del dueño es dato de cada
-- instalación, no del esquema. Con él en la migración, cualquiera que clone el
-- repositorio siembra el correo de otra persona como superadmin de su base.
insert into accesos_previos (email, rol)
values ('tu-correo@ejemplo.com', 'superadmin')
on conflict (email) do update set rol = excluded.rol;
```

- [ ] **Step 4: Arreglar el README**

En `README.md`, reemplazar la línea 136:

```
   O pegar `supabase.sql` y los archivos de `supabase/migrations/` en el **SQL Editor**.
```

por:

```
   O pegar los archivos de `supabase/migrations/` en el **SQL Editor**, en orden de nombre.

3. Sembrar el primer superadmin: copiar `supabase/semilla.example.sql`, cambiar el
   correo por el tuyo y correrlo una vez. Sin esto no hay quien apruebe cuentas.
```

Y renumerar los pasos que seguían (el actual `3.` de *Confirm email* pasa a `4.`).

- [ ] **Step 5: Verificar**

Run:
```bash
ls supabase.sql; grep -rn "supabase.sql" README.md
```
Expected: `ls` responde "No such file or directory" y el `grep` no devuelve nada.

Run:
```bash
npm run build
```
Expected: compila sin errores. No se tocó código, es la red de seguridad.

**No commitear.**

---

### Task 2: Sacar los correos personales del servidor

`api/_correo.ts:22-25` usa el gmail personal del autor como valor por defecto del remitente y del destinatario de avisos. En una instalación sin esas variables de entorno, las solicitudes de acceso le llegan a un tercero y nadie se entera, porque Brevo responde 201 igual.

**Files:**
- Modify: `api/_correo.ts:19-25`, `api/_correo.ts:148-181` (la función `manejarCorreo`)
- Modify: `README.md` (tabla de variables de entorno)

**Interfaces:**
- Consumes: nada.
- Produces: nada. `manejarCorreo` conserva su firma
  `(cuerpo: Peticion, token: string | null, origen: string) => Promise<{ estado: number; datos: unknown }>`.

- [ ] **Step 1: Quitar las constantes con valor por defecto**

En `api/_correo.ts`, borrar:

```ts
const REMITENTE = {
  name: 'Rifas',
  email: process.env.BREVO_REMITENTE || 'yeisonfabianramirezsuarez@gmail.com',
};
const SUPERADMIN = process.env.SUPERADMIN_EMAIL || 'yeisonfabianramirezsuarez@gmail.com';
```

Conservar el comentario que está justo encima —explica por qué Brevo exige remitente verificado— y ponerlo sobre el nuevo uso dentro de `enviar`.

- [ ] **Step 2: Pasar el remitente como argumento a `enviar`**

Reemplazar la función `enviar`:

```ts
// Brevo solo entrega desde un remitente verificado en la cuenta. Con un dominio
// sin verificar acepta la llamada (201) pero el correo cae en spam o se pierde.
async function enviar(apiKey: string, remitente: string, para: string, asunto: string, html: string) {
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Rifas', email: remitente },
      to: [{ email: para }],
      subject: asunto,
      htmlContent: html,
    }),
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
```

- [ ] **Step 3: Exigir las variables en `manejarCorreo`**

En `manejarCorreo`, justo debajo del chequeo de `BREVO_API_KEY`:

```ts
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { estado: 500, datos: { error: 'Falta BREVO_API_KEY en el servidor.' } };
  // Sin estas dos, los avisos salen desde —o van a— el buzón de quien escribió el
  // código. Fallar ruidoso: un correo perdido no se nota hasta que alguien reclama.
  const remitente = process.env.BREVO_REMITENTE;
  const superadmin = process.env.SUPERADMIN_EMAIL;
  if (!remitente || !superadmin)
    return {
      estado: 500,
      datos: { error: 'Falta BREVO_REMITENTE o SUPERADMIN_EMAIL en el servidor.' },
    };
```

Y actualizar las dos llamadas del bloque `try`:

```ts
  try {
    await enviar(apiKey, remitente, destino, paraUsuario.asunto, paraUsuario.html);
    if (paraSuperadmin)
      await enviar(apiKey, remitente, superadmin, paraSuperadmin.asunto, paraSuperadmin.html);
    return { estado: 200, datos: { ok: true } };
  } catch (e) {
    return { estado: 502, datos: { error: e instanceof Error ? e.message : 'Error enviando.' } };
  }
```

- [ ] **Step 4: Documentar `SUPERADMIN_EMAIL` en el README**

En la tabla de variables de entorno, debajo de `BREVO_REMITENTE`, agregar:

```
| `SUPERADMIN_EMAIL` | solo servidor | Buzón que recibe los avisos de solicitud nueva |
```

Si existe `.env.example`, agregar ahí también `SUPERADMIN_EMAIL=`. Comprobar con `ls -a | grep env`.

- [ ] **Step 5: Verificar**

Run:
```bash
grep -rn "yeisonfabianramirezsuarez" api/ src/ README.md
```
Expected: sin resultados. (En `supabase/migrations/20260811010000_roles.sql` sigue apareciendo y **se queda**: esa migración ya corrió y reescribirla no deshace nada mientras rompe a quien la tenga registrada.)

Run:
```bash
npm run build
```
Expected: compila sin errores de TypeScript.

**No commitear.**

---

## Fase 1 · Base de datos

### Task 3: Migración de columnas de pago, rol e índices

**Files:**
- Create: `supabase/migrations/20260813000000_cuentas.sql`

**Interfaces:**
- Consumes: tablas `perfiles` y `accesos_previos` de `20260811010000_roles.sql`.
- Produces: columnas `perfiles.pagado_en timestamptz` y `perfiles.pago_nota text`; el check de `rol` sin `'cliente'`; índices `perfiles_estado_creado` y `perfiles_email_busqueda`. La Task 12 depende de esos índices y la Task 16 de esas columnas.

- [ ] **Step 1: Confirmar los nombres reales de las constraints**

Los `check` en línea los nombra Postgres solo, y si el nombre no coincide el `drop constraint` aborta la migración entera. Correr en el SQL Editor de Supabase:

```sql
select conrelid::regclass as tabla, conname
from pg_constraint
where conrelid in ('perfiles'::regclass, 'accesos_previos'::regclass)
  and contype = 'c';
```
Expected: `perfiles_rol_check`, `perfiles_estado_check`, `accesos_previos_rol_check`. Si algún nombre difiere, usar el real en el paso siguiente.

- [ ] **Step 2: Escribir la migración**

Crear `supabase/migrations/20260813000000_cuentas.sql`:

```sql
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

alter table perfiles drop constraint perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check
  check (rol in ('superadmin', 'admin'));

alter table accesos_previos drop constraint accesos_previos_rol_check;
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
```

- [ ] **Step 3: Aplicar la migración**

Run:
```bash
npx supabase db push --db-url "$DATABASE_URL" --yes
```
(o pegar el archivo en el SQL Editor de Supabase)
Expected: corre sin error. Si falla en un `drop constraint`, el nombre del Step 1 no era el correcto.

- [ ] **Step 4: Verificar el resultado en la base**

Correr en el SQL Editor:

```sql
select column_name from information_schema.columns
where table_name = 'perfiles' and column_name in ('pagado_en', 'pago_nota');

select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'perfiles'::regclass and conname like '%rol%';

select indexname from pg_indexes
where tablename = 'perfiles' and indexname like 'perfiles_%';
```
Expected: dos columnas nuevas; el check de rol muestra solo `superadmin` y `admin`; aparecen `perfiles_estado_creado` y `perfiles_email_busqueda`.

- [ ] **Step 5: Comprobar que el índice se usa de verdad**

```sql
explain analyze
select * from perfiles
where estado = 'pendiente'
order by creado_en desc, id desc
limit 50;
```
Expected: el plan menciona `perfiles_estado_creado`. Con la tabla casi vacía Postgres puede preferir `Seq Scan` — eso es correcto y no es un fallo; lo que importa es que el índice exista para cuando la tabla crezca.

**No commitear.**

---

### Task 4: Migración de perfil propio y candados

Tres cosas que van juntas porque las tres protegen la fila del propio usuario: que pueda editar su nombre sin abrirle `update` a toda la tabla, que su correo no se desincronice, y que nadie —ni él ni un superadmin distraído— se deje a sí mismo fuera.

**Files:**
- Create: `supabase/migrations/20260813000100_perfil_propio.sql`

**Interfaces:**
- Consumes: `perfiles`, `auth.users`, y la función `es_superadmin()` de `20260811010000_roles.sql`.
- Produces: la función RPC `public.actualizar_mi_nombre(nuevo text) returns void`, que la Task 10 llama desde el cliente vía `nube.rpc('actualizar_mi_nombre', { nuevo })`.

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/20260813000100_perfil_propio.sql`:

```sql
-- Perfil propio editable, correo sincronizado y candado contra quedarse sin acceso.

-- Cambiar el nombre propio por función y no por policy: RLS no restringe columnas, y
-- un `grant update (nombre) to authenticated` actúa por rol — le quitaría al
-- superadmin la escritura de `estado` y `rol`, porque él también es `authenticated`.
-- Así `perfiles` no necesita ninguna policy de update para el usuario común.
create or replace function public.actualizar_mi_nombre(nuevo text) returns void
language sql security definer set search_path = public as $$
  update perfiles set nombre = nullif(trim(nuevo), '') where id = auth.uid();
$$;

revoke all on function public.actualizar_mi_nombre(text) from public, anon;
grant execute on function public.actualizar_mi_nombre(text) to authenticated;

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

  if old.rol = 'superadmin' and new.rol is distinct from 'superadmin'
     and not exists (
       select 1 from perfiles
       where rol = 'superadmin' and id <> old.id
     ) then
    raise exception 'Debe quedar al menos un superadmin.';
  end if;

  return new;
end $$;

drop trigger if exists al_editar_perfil on perfiles;
create trigger al_editar_perfil
before update on perfiles
for each row execute function public.proteger_perfiles();
```

- [ ] **Step 2: Aplicar la migración**

Run:
```bash
npx supabase db push --db-url "$DATABASE_URL" --yes
```
Expected: corre sin error.

- [ ] **Step 3: Escribir las pruebas de humo**

Crear `supabase/pruebas/cuentas.sql`. Corre entero dentro de una transacción que se
deshace al final, así se puede correr contra la base real sin dejar rastro:

```sql
-- Pruebas de humo del sistema de cuentas. Corre completo y no deja nada:
--   psql "$DATABASE_URL" -f supabase/pruebas/cuentas.sql
-- o pegar en el SQL Editor de Supabase. Si algo falla, revienta con el mensaje.
begin;

-- Dos usuarios de mentira. El trigger de alta les crea su perfil solo.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', 'jefe@prueba.test', '{"nombre":"Jefe"}'),
  ('22222222-2222-2222-2222-222222222222', 'pepe@prueba.test', '{"nombre":"Pepe"}');

update perfiles set rol = 'superadmin', estado = 'aprobado'
where id = '11111111-1111-1111-1111-111111111111';
update perfiles set estado = 'aprobado'
where id = '22222222-2222-2222-2222-222222222222';

insert into rifas (id, slug, dueno, config)
values ('33333333-3333-3333-3333-333333333333', 'rifa-prueba',
        '22222222-2222-2222-2222-222222222222', '{"titulo":"Prueba"}');

do $$
declare
  n int;
begin
  ---------------------------------------------------------------- usuario común
  set local role authenticated;
  set local request.jwt.claims =
    '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

  begin
    update perfiles set rol = 'superadmin'
    where id = '22222222-2222-2222-2222-222222222222';
    raise exception 'FALLA: un usuario común cambió su propio rol';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
  end;

  -- No revienta: RLS no da error, simplemente no encuentra fila que actualizar.
  update perfiles set estado = 'rechazado'
  where id = '11111111-1111-1111-1111-111111111111';
  select count(*) into n from perfiles
  where id = '11111111-1111-1111-1111-111111111111' and estado = 'rechazado';
  if n <> 0 then
    raise exception 'FALLA: un usuario común escribió el estado de otro';
  end if;

  perform actualizar_mi_nombre('  Pepe Nuevo  ');
  if (select nombre from perfiles where id = '22222222-2222-2222-2222-222222222222')
     <> 'Pepe Nuevo' then
    raise exception 'FALLA: actualizar_mi_nombre no guardó ni recortó el nombre';
  end if;

  ------------------------------------------------------------------ superadmin
  set local request.jwt.claims =
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

  begin
    update perfiles set rol = 'admin'
    where id = '11111111-1111-1111-1111-111111111111';
    raise exception 'FALLA: el superadmin se degradó a sí mismo';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
  end;

  begin
    update perfiles set pago_nota = repeat('x', 201)
    where id = '22222222-2222-2222-2222-222222222222';
    raise exception 'FALLA: pago_nota aceptó 201 caracteres';
  exception when others then
    if sqlerrm like 'FALLA:%' then raise; end if;
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

  reset role;
  raise notice 'Todas las pruebas de cuentas pasaron.';
end $$;

rollback;
```

Los dos últimos bloques dependen de la Task 5 y **van a fallar ahora**. Es lo correcto: se escriben aquí para que la Task 5 tenga su prueba lista antes de existir.

- [ ] **Step 4: Correr las pruebas y ver exactamente las dos fallas esperadas**

Run:
```bash
psql "$DATABASE_URL" -f supabase/pruebas/cuentas.sql
```
Expected: falla con `FALLA: la rifa de un dueño rechazado sigue siendo pública`. Todo lo anterior —rol propio, escritura ajena, `actualizar_mi_nombre`, auto-degradación, largo de la nota— tiene que haber pasado ya. Si revienta antes de esa línea, el fallo es real y hay que arreglar esta tarea antes de seguir.

**No commitear.**

---

### Task 5: Los links públicos siguen al estado del dueño

Hoy `rifas lectura publica` es `using (true)`: desactivar una cuenta le corta la escritura pero sus tableros siguen abiertos para cualquiera con el link. Esta tarea cierra ese hueco y hace pasar las dos últimas pruebas de la Task 4.

**Files:**
- Create: `supabase/migrations/20260813000200_lectura_publica.sql`

**Interfaces:**
- Consumes: `perfiles`, `rifas`, `numeros`.
- Produces: `public.dueno_aprobado(d uuid) returns boolean`. Nada del cliente la llama directo; vive dentro de las policies.

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/20260813000200_lectura_publica.sql`:

```sql
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
```

`compradores` no se toca: nunca tuvo lectura pública y así sigue.

- [ ] **Step 2: Aplicar la migración**

Run:
```bash
npx supabase db push --db-url "$DATABASE_URL" --yes
```
Expected: corre sin error.

- [ ] **Step 3: Correr las pruebas de humo completas**

Run:
```bash
psql "$DATABASE_URL" -f supabase/pruebas/cuentas.sql
```
Expected: `NOTICE: Todas las pruebas de cuentas pasaron.` y ningún error. La transacción termina en `rollback`, así que la base queda igual que antes.

- [ ] **Step 4: Comprobar que la app pública sigue viva**

Run:
```bash
node verificar-nube.mjs
```
Expected: las comprobaciones de `rifas` y `numeros` siguen en `ok`. Si ahora fallan, es que el dueño de las rifas de prueba no está `aprobado` — comprobarlo antes de tocar las policies.

**No commitear.**

---

## Fase D-2 · La elección de pantalla, en un solo sitio

### Task 6: Extraer `pantalla()` de `App.tsx`

`App.tsx:200-260` decide qué mostrar con cuatro ramas encadenadas que mezclan `haySesion`, `hayNube`, `cuenta.cargando` y `cuenta.aprobado`. La Task 9 mete un quinto flag. Un orden mal puesto ahí manda a un visitante con link a la sala de espera, o cuela una cuenta rechazada al tablero, y nada lo detecta hasta producción.

Esta tarea **no cambia comportamiento**: es la misma lógica, movida a una función pura con tests.

**Files:**
- Create: `src/sesion.ts`, `src/sesion.test.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type Pantalla = 'onboarding' | 'publico' | 'perfil-cargando' | 'espera' | 'app'`
  - `function pantalla(e: EstadoSesion): Pantalla`
  - `type EstadoSesion = { haySesion: boolean; hayNube: boolean; hayRifa: boolean; perfilCargando: boolean; aprobado: boolean }`

  La Task 9 le agrega el campo `recuperando` y el valor `'recuperar'`.

- [ ] **Step 1: Escribir los tests, que fallan**

Crear `src/sesion.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pantalla, type EstadoSesion } from './sesion';

const base: EstadoSesion = {
  haySesion: false,
  hayNube: true,
  hayRifa: false,
  perfilCargando: false,
  aprobado: false,
};

describe('pantalla', () => {
  it('sin sesión y sin rifa muestra la presentación', () => {
    expect(pantalla(base)).toBe('onboarding');
  });

  it('sin sesión pero con link a una rifa muestra la lámina pública', () => {
    expect(pantalla({ ...base, hayRifa: true })).toBe('publico');
  });

  it('el visitante con link nunca cae en la sala de espera', () => {
    // aprobado=false es lo normal para quien no tiene cuenta: no debe pesar.
    expect(pantalla({ ...base, hayRifa: true, aprobado: false })).toBe('publico');
  });

  it('con sesión y el perfil aún sin resolver, espera', () => {
    expect(pantalla({ ...base, haySesion: true, perfilCargando: true })).toBe('perfil-cargando');
  });

  it('con sesión y cuenta sin aprobar, sala de espera', () => {
    expect(pantalla({ ...base, haySesion: true })).toBe('espera');
  });

  it('con sesión y cuenta aprobada, la app', () => {
    expect(pantalla({ ...base, haySesion: true, aprobado: true })).toBe('app');
  });

  it('en modo local no hay cuentas: siempre la app', () => {
    // Sin nube, useRifa ya reporta haySesion=true y usePerfil aprobado=true.
    expect(
      pantalla({ ...base, hayNube: false, haySesion: true, aprobado: true }),
    ).toBe('app');
  });

  it('sin nube nunca se pide perfil, aunque el flag venga encendido', () => {
    expect(
      pantalla({ ...base, hayNube: false, haySesion: true, aprobado: true, perfilCargando: true }),
    ).toBe('app');
  });
});
```

- [ ] **Step 2: Correr los tests y verlos fallar**

Run: `npx vitest run src/sesion.test.ts`
Expected: FAIL — `Failed to resolve import "./sesion"`.

- [ ] **Step 3: Escribir `src/sesion.ts`**

```ts
/**
 * Qué pantalla toca. Vivía como cuatro `if` encadenados dentro de `App`, donde el
 * orden entre ellos era invisible y cada flag nuevo multiplicaba las ramas.
 *
 * `cargando` de la rifa no entra aquí a propósito: su spinner se pinta *dentro* de
 * cada pantalla, no encima, y subirlo cambiaría lo que ve el usuario.
 */
export type Pantalla = 'onboarding' | 'publico' | 'perfil-cargando' | 'espera' | 'app';

export type EstadoSesion = {
  haySesion: boolean;
  hayNube: boolean;
  hayRifa: boolean;
  perfilCargando: boolean;
  aprobado: boolean;
};

export function pantalla(e: EstadoSesion): Pantalla {
  if (!e.haySesion) return e.hayRifa ? 'publico' : 'onboarding';
  // Sin nube no hay cuentas que resolver ni que aprobar.
  if (!e.hayNube) return 'app';
  if (e.perfilCargando) return 'perfil-cargando';
  return e.aprobado ? 'app' : 'espera';
}
```

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `npx vitest run src/sesion.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Cablear `App.tsx` a la función**

En `App.tsx`, tras `const cuenta = usePerfil(rifa.usuarioId);`, agregar:

```ts
  const vista = pantalla({
    haySesion: rifa.haySesion,
    hayNube: rifa.hayNube,
    hayRifa: !!rifa.rifaActual,
    perfilCargando: cuenta.cargando,
    aprobado: cuenta.aprobado,
  });
```

Importar `import { pantalla } from './sesion';`.

Cambiar **solo la línea de la condición** de las cuatro salidas tempranas. El cuerpo
de cada bloque —el `return (…)` con su JSX— no se toca ni una línea:

| Línea actual | Condición de hoy | Condición nueva |
| --- | --- | --- |
| `App.tsx:163` | `if (!rifa.haySesion && !rifa.rifaActual) {` | `if (vista === 'onboarding') {` |
| `App.tsx:187` | `if (!rifa.haySesion) {` | `if (vista === 'publico') {` |
| `App.tsx:221` | `if (rifa.haySesion && rifa.hayNube && cuenta.cargando) {` | `if (vista === 'perfil-cargando') {` |
| `App.tsx:230` | `if (rifa.haySesion && rifa.hayNube && !cuenta.cargando && !cuenta.aprobado) {` | `if (vista === 'espera') {` |

Los cuerpos ocupan `163-186`, `187-220`, `221-229` y `230-242`; el `return` final de la
app completa va de `243` a `432` y queda igual. Si al terminar el `git diff` de `App.tsx`
muestra algo más que esas cuatro líneas, el import, y el bloque `const vista = …`, se
cambió de más.

Los hooks (`useState`, `useEffect`, `useRef`) tienen que seguir todos **arriba** de la primera salida temprana, como ya están. Mover uno debajo rompe las reglas de hooks.

- [ ] **Step 6: Verificar que nada cambió**

Run: `npm test`
Expected: PASS, incluidos `src/rifa.test.ts` y `src/sesion.test.ts`.

Run: `npm run build`
Expected: compila sin errores.

Run: `npm run dev` y comprobar a mano las cuatro pantallas:
1. Sin sesión y sin `?r=` en la URL → presentación.
2. Sin sesión y con `?r=<slug>` de una rifa real → lámina pública.
3. Con sesión de cuenta aprobada → la app.
4. Con sesión de cuenta pendiente → sala de espera.

**No commitear.**

---

## Fase A · Contraseña y perfil propio

### Task 7: Extraer `CampoClave`

Prepara el terreno para la Task 9, que necesita el mismo input con ojo. Refactor puro, sin cambio visible.

**Files:**
- Create: `src/components/CampoClave.tsx`
- Modify: `src/components/Onboarding.tsx`

**Interfaces:**
- Consumes: `IconoUI` de `src/marcas.tsx` (símbolos `ojo` y `ojoTapado`, ya existen).
- Produces:
  ```ts
  function CampoClave(props: {
    etiqueta: string;
    valor: string;
    onCambio: (v: string) => void;
    autoComplete: 'new-password' | 'current-password';
    id?: string;
    describedBy?: string;
  }): JSX.Element
  ```
  La Task 9 lo usa en `NuevaClave.tsx`.

- [ ] **Step 1: Crear el componente**

Crear `src/components/CampoClave.tsx`:

```tsx
import { useState } from 'react';
import { IconoUI } from '../marcas';

type Props = {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  autoComplete: 'new-password' | 'current-password';
  id?: string;
  /** id del texto de ayuda que describe el campo, para lectores de pantalla. */
  describedBy?: string;
};

/** Input de contraseña con ojo. Cada pantalla que pide clave necesita el mismo. */
export function CampoClave({
  etiqueta,
  valor,
  onCambio,
  autoComplete,
  id,
  describedBy,
}: Props) {
  const [ver, setVer] = useState(false);

  return (
    <label>
      {etiqueta}
      <span className="campo-clave">
        <input
          id={id}
          type={ver ? 'text' : 'password'}
          autoComplete={autoComplete}
          aria-describedby={describedBy}
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          required
          minLength={6}
        />
        <button
          type="button"
          className="campo-clave__ojo"
          onClick={() => setVer((v) => !v)}
          aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={ver}
        >
          <IconoUI id={ver ? 'ojoTapado' : 'ojo'} />
        </button>
      </span>
    </label>
  );
}
```

- [ ] **Step 2: Usarlo en `Onboarding`**

En `Onboarding.tsx`, reemplazar el bloque `<label>Contraseña …</label>` completo (desde `<label>` hasta su `</label>`, incluido el `<span className="campo-clave">`) por:

```tsx
          <CampoClave
            etiqueta="Contraseña"
            valor={clave}
            onCambio={setClave}
            autoComplete={crear ? 'new-password' : 'current-password'}
            describedBy={crear ? 'pista-clave' : undefined}
          />
```

`describedBy` conserva la asociación con el `<p id="pista-clave">Mínimo 6 caracteres.</p>`
que ya está debajo. Sin ella, ese texto queda huérfano y el lector de pantalla deja de
anunciar el requisito al enfocar el campo.

Agregar `import { CampoClave } from './CampoClave';` y borrar el estado `verClave` —`const [verClave, setVerClave] = useState(false);`— que ya no se usa.

- [ ] **Step 3: Verificar**

Run: `npm run build`
Expected: compila. Si TypeScript se queja de `verClave` sin usar, es que quedó la declaración: borrarla.

Run: `npm run dev` y en la pantalla de entrar comprobar que el ojo sigue mostrando y ocultando la contraseña, en modo entrar y en modo crear.

**No commitear.**

---

### Task 8: Pedir el enlace de recuperación

**Files:**
- Modify: `src/useRifa.ts` (junto a `entrar`, cerca de la línea 437), `src/components/Onboarding.tsx`

**Interfaces:**
- Consumes: `nube` de `src/nube.ts`.
- Produces: `useRifa()` devuelve además
  `recuperarClave: (email: string) => Promise<string | null>` — `null` si salió bien, el mensaje de error si no.

- [ ] **Step 1: Agregar `recuperarClave` a `useRifa`**

En `src/useRifa.ts`, justo debajo de `entrar`:

```ts
  const recuperarClave = useCallback(async (email: string): Promise<string | null> => {
    const { error } = await nube!.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}${location.pathname}`,
    });
    return error ? error.message : null;
  }, []);
```

Y exponerla en el objeto que retorna el hook, junto a `entrar`:

```ts
    entrar,
    recuperarClave,
    registrarse,
    salir,
```

- [ ] **Step 2: Agregar el modo `recuperar` a `Onboarding`**

Cambiar la firma de props:

```ts
type Props = {
  entrar: (email: string, clave: string) => Promise<string | null>;
  registrarse: (email: string, clave: string, nombre: string) => Promise<string | null>;
  recuperarClave: (email: string) => Promise<string | null>;
};
```

Cambiar el estado de modo y agregar el de éxito:

```ts
  const [modo, setModo] = useState<'entrar' | 'crear' | 'recuperar'>('entrar');
  const [listo, setListo] = useState(false);
  const crear = modo === 'crear';
  const recuperar = modo === 'recuperar';
```

- [ ] **Step 3: Ramificar el envío del formulario**

Reemplazar el `onSubmit` del formulario:

```tsx
          onSubmit={async (ev) => {
            ev.preventDefault();
            setEnviando(true);
            if (recuperar) {
              const err = await recuperarClave(email);
              setAviso(err);
              // Se confirma el envío pase lo que pase con el correo: decir "ese
              // correo no existe" es delatar quién tiene cuenta aquí.
              setListo(!err);
            } else {
              setAviso(crear ? await registrarse(email, clave, nombre) : await entrar(email, clave));
            }
            setEnviando(false);
          }}
```

- [ ] **Step 4: Ajustar título, nota y campos**

Título y nota:

```tsx
          <h2 className="panel__titulo">
            {recuperar ? 'Recuperar contraseña' : crear ? 'Crear mi cuenta' : 'Entrar'}
          </h2>
          <p className="panel__nota">
            {recuperar
              ? 'Te mandamos un enlace para poner una contraseña nueva.'
              : crear
                ? 'Revisamos cada solicitud a mano. Te avisamos apenas quede activa.'
                : 'Para ver un tablero no hace falta cuenta: basta el link que te compartieron.'}
          </p>
```

El campo de nombre solo en modo crear (ya es así: `{crear && …}`). El campo de contraseña se esconde en modo recuperar — envolver el `<CampoClave …/>` de la Task 7:

```tsx
          {!recuperar && (
            <CampoClave
              etiqueta="Contraseña"
              valor={clave}
              onCambio={setClave}
              autoComplete={crear ? 'new-password' : 'current-password'}
              describedBy={crear ? 'pista-clave' : undefined}
            />
          )}
```

- [ ] **Step 5: Mensaje de éxito y botones**

Encima del `{aviso && …}` existente:

```tsx
          {listo && (
            <p className="panel__nota" role="status">
              Si existe una cuenta con ese correo, ya va en camino el enlace. Revisa también
              la carpeta de spam.
            </p>
          )}
```

Botón de envío:

```tsx
          <button type="submit" className="boton--primario onb__cta" disabled={enviando}>
            {enviando
              ? 'Un momento…'
              : recuperar
                ? 'Mandarme el enlace'
                : crear
                  ? 'Solicitar mi acceso'
                  : 'Entrar'}
          </button>
```

Y debajo, reemplazar el botón `onb__cambio` por dos:

```tsx
          <button
            type="button"
            className="onb__cambio"
            onClick={() => {
              setModo(crear || recuperar ? 'entrar' : 'crear');
              setAviso(null);
              setListo(false);
            }}
          >
            {crear || recuperar ? 'Ya tengo cuenta' : 'Quiero una cuenta'}
          </button>
          {!crear && !recuperar && (
            <button
              type="button"
              className="onb__cambio"
              onClick={() => {
                setModo('recuperar');
                setAviso(null);
                setListo(false);
              }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
```

- [ ] **Step 6: Pasar la prop desde `App.tsx`**

En el bloque `vista === 'onboarding'`:

```tsx
          <Onboarding
            entrar={rifa.entrar}
            recuperarClave={rifa.recuperarClave}
            registrarse={async (email, clave, nombre) => { /* sin cambios */ }}
          />
```

- [ ] **Step 7: Verificar**

Run: `npm run build`
Expected: compila sin errores.

Run: `npm test`
Expected: PASS.

Run: `npm run dev` y comprobar:
1. En "Entrar" aparece "¿Olvidaste tu contraseña?".
2. Al pulsarlo desaparece el campo de contraseña y el botón dice "Mandarme el enlace".
3. Con un correo registrado, sale el mensaje de confirmación y llega el correo.
4. Con un correo **no** registrado sale exactamente el mismo mensaje. Si sale un error distinto, la app está delatando qué correos existen: arreglarlo antes de seguir.

**No commitear.**

---

### Task 9: Fijar la contraseña nueva

El agujero de verdad: al volver del enlace, supabase-js canjea el hash y abre sesión solo. `useRifa.ts:147` solo mira `sesion?.user.id`, así que **hoy ese enlace entraría directo al tablero sin pedir nada**. Quien reciba el correo entra sin saber la contraseña y sin cambiarla.

**Files:**
- Modify: `src/useRifa.ts:126-152` y el objeto de retorno, `src/sesion.ts`, `src/sesion.test.ts`, `src/App.tsx`
- Create: `src/components/NuevaClave.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `CampoClave` de la Task 7; `pantalla()` de la Task 6.
- Produces:
  - `useRifa()` devuelve además `recuperando: boolean` y
    `cambiarClave: (nueva: string) => Promise<string | null>`.
  - `EstadoSesion` gana el campo `recuperando: boolean` y `Pantalla` el valor `'recuperar'`.

- [ ] **Step 1: Ampliar los tests de `pantalla()`, que fallan**

En `src/sesion.test.ts`, agregar `recuperando: false` a `base` y estos tests dentro del `describe`:

```ts
  it('el enlace de recuperación manda a fijar la clave, por encima de todo', () => {
    expect(pantalla({ ...base, recuperando: true })).toBe('recuperar');
  });

  it('recuperar gana aunque ya haya sesión y cuenta aprobada', () => {
    // supabase-js abre sesión al canjear el hash: sin esta prioridad, el enlace
    // entraría al tablero sin pedir contraseña nueva.
    expect(
      pantalla({ ...base, recuperando: true, haySesion: true, aprobado: true }),
    ).toBe('recuperar');
  });

  it('recuperar gana también sobre la lámina pública', () => {
    expect(pantalla({ ...base, recuperando: true, hayRifa: true })).toBe('recuperar');
  });
```

- [ ] **Step 2: Correr los tests y verlos fallar**

Run: `npx vitest run src/sesion.test.ts`
Expected: FAIL — TypeScript se queja de `recuperando` en `EstadoSesion`, y los tres tests nuevos dan `'onboarding'` / `'app'` / `'publico'` en vez de `'recuperar'`.

- [ ] **Step 3: Ampliar `src/sesion.ts`**

```ts
export type Pantalla =
  | 'recuperar'
  | 'onboarding'
  | 'publico'
  | 'perfil-cargando'
  | 'espera'
  | 'app';

export type EstadoSesion = {
  recuperando: boolean;
  haySesion: boolean;
  hayNube: boolean;
  hayRifa: boolean;
  perfilCargando: boolean;
  aprobado: boolean;
};

export function pantalla(e: EstadoSesion): Pantalla {
  // Primero de todo: el enlace de recuperación llega con sesión ya abierta, así que
  // cualquier otra rama lo dejaría entrar sin cambiar la contraseña.
  if (e.recuperando) return 'recuperar';
  if (!e.haySesion) return e.hayRifa ? 'publico' : 'onboarding';
  if (!e.hayNube) return 'app';
  if (e.perfilCargando) return 'perfil-cargando';
  return e.aprobado ? 'app' : 'espera';
}
```

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `npx vitest run src/sesion.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Capturar `PASSWORD_RECOVERY` en `useRifa`**

Agregar el estado junto a los demás (cerca de `const [sesionLista, setSesionLista] = useState(!nube);`):

```ts
  const [recuperando, setRecuperando] = useState(false);
```

Y en el efecto de sesión:

```ts
    const { data } = nube.auth.onAuthStateChange((e, sesion) => {
      // El enlace del correo abre sesión por su cuenta. Sin atrapar el evento, el
      // usuario entra al tablero sin haber puesto contraseña nueva.
      if (e === 'PASSWORD_RECOVERY') setRecuperando(true);
      setAdmin(sesion?.user.id ?? null);
      setSesionLista(true);
    });
```

Agregar `cambiarClave` junto a `recuperarClave`:

```ts
  const cambiarClave = useCallback(async (nueva: string): Promise<string | null> => {
    const { error } = await nube!.auth.updateUser({ password: nueva });
    if (error) return error.message;
    setRecuperando(false);
    return null;
  }, []);
```

Y exponer las dos cosas en el retorno:

```ts
    recuperando,
    cambiarClave,
```

- [ ] **Step 6: Crear `NuevaClave.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { IconoUI } from '../marcas';
import { CampoClave } from './CampoClave';

type Props = {
  cambiarClave: (nueva: string) => Promise<string | null>;
  salir: () => void;
};

/** Se llega aquí desde el enlace del correo, ya con sesión abierta pero sin clave. */
export function NuevaClave({ cambiarClave, salir }: Props) {
  const [clave, setClave] = useState('');
  const [repetir, setRepetir] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const guardar = async (ev: FormEvent) => {
    ev.preventDefault();
    if (clave !== repetir) {
      setAviso('Las dos contraseñas no coinciden.');
      return;
    }
    setEnviando(true);
    setAviso(await cambiarClave(clave));
    setEnviando(false);
  };

  return (
    <form className="panel espera" onSubmit={guardar}>
      <IconoUI id="candado" className="espera__icono" />
      <h1 className="panel__titulo">Pon tu contraseña nueva</h1>
      <p className="espera__texto">
        Entraste desde el enlace del correo. Elige una contraseña y sigues directo a tus rifas.
      </p>

      <CampoClave
        etiqueta="Contraseña nueva"
        valor={clave}
        onCambio={setClave}
        autoComplete="new-password"
        describedBy="pista-clave-nueva"
      />
      <CampoClave
        etiqueta="Repítela"
        valor={repetir}
        onCambio={setRepetir}
        autoComplete="new-password"
        describedBy="pista-clave-nueva"
      />
      <p className="panel__nota" id="pista-clave-nueva">
        Mínimo 6 caracteres.
      </p>

      {aviso && (
        <p className="dialogo__error" role="alert">
          {aviso}
        </p>
      )}

      <button type="submit" className="boton--primario" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar y entrar'}
      </button>
      <button type="button" onClick={salir}>
        Salir
      </button>
    </form>
  );
}
```

- [ ] **Step 7: Cablear en `App.tsx`**

Agregar `recuperando: rifa.recuperando,` al objeto que se le pasa a `pantalla()`, y como **primera** salida temprana, antes de la de `'onboarding'`:

```tsx
  if (vista === 'recuperar') {
    return (
      <main className="app">
        <NuevaClave cambiarClave={rifa.cambiarClave} salir={rifa.salir} />
      </main>
    );
  }
```

Importar `NuevaClave`.

- [ ] **Step 8: Estilos**

En `src/styles.css`, tras el bloque `.espera__acciones` (cerca de la línea 384):

```css
/* La pantalla de clave nueva reusa .espera pero es un formulario: los campos
   necesitan ocupar el ancho, que .espera centra todo. */
.espera label {
  width: 100%;
  text-align: left;
}
```

- [ ] **Step 9: Verificar**

Run: `npm test`
Expected: PASS, 11 tests en `sesion.test.ts`.

Run: `npm run build`
Expected: compila.

Run: `npm run dev` y hacer el recorrido entero:
1. "¿Olvidaste tu contraseña?" con un correo real → llega el enlace.
2. Abrir el enlace → **tiene que salir "Pon tu contraseña nueva"**, no el tablero. Si sale el tablero, el evento `PASSWORD_RECOVERY` no se está capturando.
3. Poner dos contraseñas distintas → "Las dos contraseñas no coinciden."
4. Poner la misma dos veces → guarda y entra a la app.
5. Cerrar sesión y entrar con la contraseña nueva.

**No commitear.**

---

### Task 10: Perfil propio editable

**Files:**
- Modify: `src/usePerfil.ts`, `src/App.tsx`, `src/styles.css`
- Create: `src/components/MiCuenta.tsx`

**Interfaces:**
- Consumes: la función RPC `actualizar_mi_nombre` de la Task 4.
- Produces: `usePerfil()` devuelve además
  `guardarNombre: (nuevo: string) => Promise<string | null>`.
  Además el tipo `Rol` queda `'superadmin' | 'admin'`.

- [ ] **Step 1: Quitar `'cliente'` del tipo**

En `src/usePerfil.ts`:

```ts
export type Rol = 'superadmin' | 'admin';
```

- [ ] **Step 2: Agregar `guardarNombre`**

La Task 12 ya se llevó `decidir`, `solicitudes` y `cargarSolicitudes` a `useCuentas`,
así que `usePerfil` llega aquí adelgazado. `guardarNombre` va junto a `cargarPerfil`,
que es lo que queda:

```ts
  const guardarNombre = useCallback(
    async (nuevo: string): Promise<string | null> => {
      if (!nube) return null;
      const { error: fallo } = await nube.rpc('actualizar_mi_nombre', { nuevo });
      if (fallo) return fallo.message;
      await cargarPerfil(true);
      return null;
    },
    [cargarPerfil],
  );
```

Y exponerla en el retorno del hook, junto a `recargarPerfil`.

- [ ] **Step 3: Crear `MiCuenta.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import type { Perfil } from '../usePerfil';

type Props = {
  perfil: Perfil;
  guardarNombre: (nuevo: string) => Promise<string | null>;
};

const ESTADO: Record<Perfil['estado'], string> = {
  pendiente: 'En revisión',
  aprobado: 'Activa',
  rechazado: 'Desactivada',
};

/** El perfil propio. El correo no se edita aquí: cambiarlo es otro trámite. */
export function MiCuenta({ perfil, guardarNombre }: Props) {
  const [nombre, setNombre] = useState(perfil.nombre ?? '');
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const sucio = nombre.trim() !== (perfil.nombre ?? '').trim();

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setEnviando(true);
    const err = await guardarNombre(nombre);
    setAviso(err);
    setGuardado(!err);
    setEnviando(false);
  };

  return (
    <form className="panel" onSubmit={enviar}>
      <h2 className="panel__titulo">Mi cuenta</h2>
      <p className="panel__nota">
        {perfil.email} · {ESTADO[perfil.estado]}
      </p>

      <label>
        Tu nombre
        <input
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value);
            setGuardado(false);
            setAviso(null);
          }}
        />
      </label>

      {aviso && (
        <p className="dialogo__error" role="alert">
          {aviso}
        </p>
      )}
      {guardado && (
        <p className="panel__nota" role="status">
          Listo, nombre guardado.
        </p>
      )}

      <button type="submit" disabled={!sucio || enviando}>
        {enviando ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Montarlo en `App.tsx`**

Dentro de `{mostrarPanel && (<div className="app__columna">…)}`, como primer hijo, antes del bloque de `cuenta.esSuperadmin`:

```tsx
          {rifa.hayNube && cuenta.perfil && (
            <MiCuenta perfil={cuenta.perfil} guardarNombre={cuenta.guardarNombre} />
          )}
```

La guarda de `rifa.hayNube` es la que mantiene el modo local intacto: sin nube no hay perfil que mostrar.

- [ ] **Step 5: Verificar**

Run: `npm run build`
Expected: compila. Si TypeScript señala un `'cliente'` sobrante en algún `Record<Rol, …>`, quitarlo ahí también.

Run: `npm test`
Expected: PASS.

Run: `npm run dev` y comprobar:
1. Con sesión aprobada, "Mi cuenta" aparece arriba del panel con el correo y "Activa".
2. El botón "Guardar" arranca deshabilitado y se habilita al escribir.
3. Guardar un nombre nuevo → "Listo, nombre guardado", y al recargar la página el nombre sigue.
4. Guardar `"  Ana  "` (con espacios) → se guarda `"Ana"`, porque el RPC hace `trim`.
5. Quitar `VITE_SUPABASE_URL` del `.env`, reiniciar y comprobar que la app sigue corriendo en modo local sin el panel de "Mi cuenta". Devolver la variable después.

**No commitear.**

---

## Fase B · Administración de cuentas

### Task 11: El cursor, en funciones puras

Es el punto que se rompe en silencio: un cursor mal armado no da error, duplica filas o se salta cuentas, y solo se nota semanas después cuando alguien reclama que su solicitud "nunca llegó".

**Files:**
- Create: `src/cuentas.ts`, `src/cuentas.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type Cursor = { creadoEn: string; id: string }`
  - `function filtroCursor(c: Cursor): string` — condición para `.or()` de PostgREST.
  - `function siguienteCursor(filas: { creado_en: string; id: string }[], pagina: number): Cursor | null`

  La Task 12 los usa dentro de `useCuentas`.

- [ ] **Step 1: Escribir los tests, que fallan**

Crear `src/cuentas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { filtroCursor, siguienteCursor, type Cursor } from './cuentas';

const fila = (creado_en: string, id: string) => ({ creado_en, id });

describe('filtroCursor', () => {
  it('pide lo anterior al cursor, con el id como desempate', () => {
    const c: Cursor = { creadoEn: '2026-08-13T10:00:00Z', id: 'abc' };
    expect(filtroCursor(c)).toBe(
      'creado_en.lt.2026-08-13T10:00:00Z,and(creado_en.eq.2026-08-13T10:00:00Z,id.lt.abc)',
    );
  });
});

describe('siguienteCursor', () => {
  it('con la página llena, apunta a la última fila', () => {
    const filas = [fila('2026-08-13T10:00:00Z', 'a'), fila('2026-08-13T09:00:00Z', 'b')];
    expect(siguienteCursor(filas, 2)).toEqual({ creadoEn: '2026-08-13T09:00:00Z', id: 'b' });
  });

  it('con la página a medias, no hay más', () => {
    // Menos filas que el tamaño de página = se acabaron los datos.
    expect(siguienteCursor([fila('2026-08-13T10:00:00Z', 'a')], 2)).toBeNull();
  });

  it('sin filas, no hay más', () => {
    expect(siguienteCursor([], 2)).toBeNull();
  });

  it('con dos altas del mismo instante, el id decide', () => {
    // Sin el desempate por id, la página siguiente repetiría o se saltaría una de
    // las dos: `creado_en.lt` sola descarta las dos o ninguna.
    const mismo = '2026-08-13T10:00:00Z';
    const filas = [fila(mismo, 'zz'), fila(mismo, 'aa')];
    expect(siguienteCursor(filas, 2)).toEqual({ creadoEn: mismo, id: 'aa' });
  });
});
```

- [ ] **Step 2: Correr los tests y verlos fallar**

Run: `npx vitest run src/cuentas.test.ts`
Expected: FAIL — `Failed to resolve import "./cuentas"`.

- [ ] **Step 3: Escribir `src/cuentas.ts`**

```ts
/**
 * Paginación por cursor de la lista de cuentas.
 *
 * Keyset y no `offset`: el superadmin aprueba mientras pagina, la fila sale de la
 * pestaña, y con `offset` la página siguiente arranca corrida y se salta cuentas.
 */
export type Cursor = { creadoEn: string; id: string };

/** Condición para `.or()` de PostgREST: lo estrictamente posterior al cursor. */
export function filtroCursor(c: Cursor): string {
  return `creado_en.lt.${c.creadoEn},and(creado_en.eq.${c.creadoEn},id.lt.${c.id})`;
}

/** `null` = no hay más páginas. */
export function siguienteCursor(
  filas: { creado_en: string; id: string }[],
  pagina: number,
): Cursor | null {
  if (filas.length < pagina) return null;
  const ultima = filas[filas.length - 1];
  return { creadoEn: ultima.creado_en, id: ultima.id };
}
```

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `npx vitest run src/cuentas.test.ts`
Expected: PASS, 5 tests.

Run: `npm test`
Expected: PASS, todo el conjunto.

**No commitear.**

---

### Task 12: El hook `useCuentas`

`usePerfil` hace hoy dos trabajos: el perfil propio y el listado del superadmin. El segundo se carga en toda sesión aunque no seas superadmin, y con paginación, búsqueda y conteo pesa más que el primero. Se separan.

**Files:**
- Create: `src/useCuentas.ts`
- Modify: `src/usePerfil.ts` (quitar `solicitudes`, `cargarSolicitudes`, `decidir`), `src/App.tsx`

**Interfaces:**
- Consumes: `filtroCursor`, `siguienteCursor`, `Cursor` de la Task 11; los tipos `Perfil`, `Rol`, `EstadoCuenta` de `src/usePerfil.ts`; los índices de la Task 3.
- Produces:
  ```ts
  type Cambios = {
    estado?: EstadoCuenta;
    rol?: Rol;
    pagadoEn?: string | null;
    pagoNota?: string | null;
  };

  function useCuentas(usuarioId: string | null, activo: boolean): {
    lista: Perfil[];
    filtro: EstadoCuenta;
    setFiltro: (e: EstadoCuenta) => void;
    busqueda: string;
    setBusqueda: (b: string) => void;
    pendientes: number;
    cargando: boolean;
    error: string | null;
    hayMas: boolean;
    mas: () => void;
    recargar: () => void;
    actualizarCuenta: (id: string, cambios: Cambios) => Promise<string | null>;
  };
  ```
  La Task 13 le agrega `hayCambios` y la Task 14 lo consume desde `PanelSuperadmin`.

- [ ] **Step 1: Escribir `src/useCuentas.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { filtroCursor, siguienteCursor, type Cursor } from './cuentas';
import { nube } from './nube';
import type { EstadoCuenta, Perfil, Rol } from './usePerfil';

const PAGINA = 50;

export type Cambios = {
  estado?: EstadoCuenta;
  rol?: Rol;
  pagadoEn?: string | null;
  pagoNota?: string | null;
};

/**
 * Lista de cuentas para el superadmin. `activo` la apaga entera: montarla para
 * quien no es superadmin sería pedir una tabla que su RLS devuelve vacía.
 */
export function useCuentas(usuarioId: string | null, activo: boolean) {
  const [lista, setLista] = useState<Perfil[]>([]);
  const [filtro, setFiltro] = useState<EstadoCuenta>('pendiente');
  const [busqueda, setBusqueda] = useState('');
  const [debounced, setDebounced] = useState('');
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada tecla dispararía una consulta; a 50 filas por página eso es ruido puro.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(busqueda.trim()), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  // Descarta respuestas viejas: cambiar de pestaña rápido hacía que la anterior
  // llegara después y pisara la lista buena.
  const pedido = useRef(0);

  const traer = useCallback(
    async (desde: Cursor | null) => {
      if (!nube || !usuarioId || !activo) return;
      setCargando(true);
      const mioPedido = ++pedido.current;

      let q = nube
        .from('perfiles')
        .select('*')
        .neq('id', usuarioId)
        .order('creado_en', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGINA);
      // Buscando se ignora la pestaña: se busca un correo, no un correo *dentro
      // de rechazados*.
      q = debounced ? q.ilike('email', `%${debounced}%`) : q.eq('estado', filtro);
      if (desde) q = q.or(filtroCursor(desde));

      const { data, error: fallo } = await q;
      if (mioPedido !== pedido.current) return;

      const filas = (data ?? []) as Perfil[];
      setError(fallo ? fallo.message : null);
      setLista((previa) => (desde ? [...previa, ...filas] : filas));
      const siguiente = siguienteCursor(filas, PAGINA);
      setCursor(siguiente);
      setHayMas(!!siguiente);
      setCargando(false);
    },
    [usuarioId, activo, filtro, debounced],
  );

  const contarPendientes = useCallback(async () => {
    if (!nube || !usuarioId || !activo) return;
    const { count } = await nube
      .from('perfiles')
      .select('*', { count: 'exact', head: true })
      .neq('id', usuarioId)
      .eq('estado', 'pendiente');
    setPendientes(count ?? 0);
  }, [usuarioId, activo]);

  // Cambiar de pestaña o de búsqueda vuelve al principio: seguir con el cursor
  // viejo pediría la página 2 de una lista que ya no es la misma.
  useEffect(() => {
    setLista([]);
    setCursor(null);
    traer(null);
  }, [traer]);

  useEffect(() => {
    contarPendientes();
  }, [contarPendientes]);

  const mas = useCallback(() => {
    if (cursor) traer(cursor);
  }, [cursor, traer]);

  const recargar = useCallback(() => {
    setLista([]);
    setCursor(null);
    traer(null);
    contarPendientes();
  }, [traer, contarPendientes]);

  const actualizarCuenta = useCallback(
    async (id: string, cambios: Cambios): Promise<string | null> => {
      if (!nube) return 'Sin conexión.';
      const fila: Record<string, unknown> = {};
      if (cambios.estado !== undefined) {
        fila.estado = cambios.estado;
        fila.aprobado_en = cambios.estado === 'aprobado' ? new Date().toISOString() : null;
      }
      if (cambios.rol !== undefined) fila.rol = cambios.rol;
      if (cambios.pagadoEn !== undefined) fila.pagado_en = cambios.pagadoEn;
      if (cambios.pagoNota !== undefined) fila.pago_nota = cambios.pagoNota;

      const { error: fallo } = await nube.from('perfiles').update(fila).eq('id', id);
      if (fallo) return fallo.message;
      recargar();
      return null;
    },
    [recargar],
  );

  return {
    lista,
    filtro,
    setFiltro,
    busqueda,
    setBusqueda,
    pendientes,
    cargando,
    error,
    hayMas,
    mas,
    recargar,
    actualizarCuenta,
  };
}
```

- [ ] **Step 2: Adelgazar `usePerfil`**

En `src/usePerfil.ts`, borrar:
- el estado `const [solicitudes, setSolicitudes] = useState<Perfil[]>([]);`
- la función `cargarSolicitudes` entera
- la función `decidir` entera
- la línea `if (mio?.rol === 'superadmin') cargarSolicitudes();` dentro de `cargarPerfil`
- `setSolicitudes([]);` del efecto de limpieza
- las claves `solicitudes`, `decidir` y `recargarSolicitudes` del objeto de retorno
- la dependencia `cargarSolicitudes` del `useCallback` de `cargarPerfil`

Actualizar el comentario de cabecera del hook, que hoy menciona las solicitudes:

```ts
/**
 * Perfil de la cuenta activa: rol y estado de aprobación.
 * Sin nube no hay cuentas: se trabaja como admin aprobado.
 */
```

- [ ] **Step 3: Montar `useCuentas` en `App.tsx`**

Junto a `const cuenta = usePerfil(rifa.usuarioId);`:

```ts
  const cuentas = useCuentas(rifa.usuarioId, cuenta.esSuperadmin);
```

`cuenta.esSuperadmin` como `activo`: mientras sea falso el hook no consulta nada.

- [ ] **Step 4: Verificar la compilación**

Run: `npm run build`
Expected: falla en `App.tsx` porque `PanelSuperadmin` sigue esperando `solicitudes`, `decidir` y `recargar`. **Es lo esperado**: lo arregla la Task 14. Para no dejar el árbol roto entre tareas, comentar temporalmente el bloque `<PanelSuperadmin … />` de `App.tsx` con un `{/* … */}` y una nota `// Task 14 lo devuelve`.

Run: `npm run build`
Expected ahora: compila.

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Comprobar el hook contra la base**

Con `npm run dev` y sesión de superadmin, abrir la consola del navegador y confirmar que en la pestaña Network aparecen dos peticiones a `perfiles` —una con `estado=eq.pendiente&limit=50` y otra con `head=true` para el conteo— y **ninguna** cuando se entra con una cuenta que no es superadmin.

**No commitear.**

---

### Task 13: Realtime de la lista

Sin esto el superadmin no se entera de una solicitud nueva hasta que le da a "Actualizar". Con paginación no puede recargar a lo bruto: en la página 3, o buscando, un evento movería la lista bajo el dedo justo al ir a pulsar "Aprobar".

**Files:**
- Modify: `src/useCuentas.ts`

**Interfaces:**
- Consumes: lo de la Task 12.
- Produces: `useCuentas()` devuelve además `hayCambios: boolean`. La Task 14 lo pinta como aviso.

- [ ] **Step 1: Agregar el estado y el canal**

En `useCuentas`, junto a los demás estados:

```ts
  const [hayCambios, setHayCambios] = useState(false);
```

Y tras el `useEffect` del conteo:

```ts
  // La tabla `perfiles` ya está en la publicación de realtime desde la migración
  // de roles. El superadmin ve todas las filas por RLS, así que recibe todo evento.
  useEffect(() => {
    if (!nube || !usuarioId || !activo) return;
    const bd = nube;
    const canal = bd
      .channel('cuentas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles' }, () => {
        // Recargar sin más movería la lista bajo el dedo de quien está paginando o
        // buscando. Ahí solo se avisa; recarga quien quiera.
        if (primeraPaginaRef.current && !busquedaRef.current) {
          recargarRef.current();
        } else {
          setHayCambios(true);
        }
      })
      .subscribe();
    return () => {
      bd.removeChannel(canal);
    };
    // Sin `recargar` en las dependencias a propósito: cambia con cada filtro y con
    // cada tecla de la búsqueda, y tenerlo aquí tumbaría y recrearía el canal cada
    // vez. Se llega a él por ref.
  }, [usuarioId, activo]);
```

- [ ] **Step 2: Agregar las refs que el canal necesita**

El callback del canal se crea una vez y capturaría valores viejos. Junto a `const pedido = useRef(0);`:

```ts
  // El callback del canal vive tanto como la suscripción: sin refs leería el
  // primer valor de estas dos para siempre.
  const primeraPaginaRef = useRef(true);
  const busquedaRef = useRef('');
  const recargarRef = useRef(() => {});
```

Y mantenerlas al día, después del `useEffect` del debounce:

```ts
  useEffect(() => {
    primeraPaginaRef.current = cursor === null || lista.length <= PAGINA;
    busquedaRef.current = debounced;
  }, [cursor, lista.length, debounced]);
```

Y otra, **debajo** de la declaración de `recargar` (una ref se asigna después de que
existe lo que guarda):

```ts
  useEffect(() => {
    recargarRef.current = recargar;
  }, [recargar]);
```

- [ ] **Step 3: Apagar el aviso al recargar**

Dentro de `recargar`, como primera línea:

```ts
    setHayCambios(false);
```

- [ ] **Step 4: Exponerlo**

Agregar `hayCambios,` al objeto de retorno.

- [ ] **Step 5: Verificar**

Run: `npm run build`
Expected: compila.

Run: `npm test`
Expected: PASS.

Prueba manual con dos navegadores:
1. Navegador A con sesión de superadmin, en la pestaña "Pendiente", primera página.
2. Navegador B (o ventana de incógnito): crear una cuenta nueva.
3. En A la solicitud tiene que aparecer sola, sin tocar nada.
4. Repetir con A **buscando** algo en el campo de búsqueda: ahora la lista no se mueve y `hayCambios` queda en `true` (la Task 14 lo pinta; por ahora se comprueba con React DevTools o un `console.log` temporal que se borra al terminar el paso).

**No commitear.**

---

### Task 14: Reescribir `PanelSuperadmin`

**Files:**
- Modify: `src/components/PanelSuperadmin.tsx` (reescrito entero), `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: todo lo que devuelve `useCuentas` (Tasks 12 y 13); `useConfirmar` de `src/useConfirmar.tsx`, cuya firma es
  `confirmar(titulo: string, opciones?: { texto?: string; aceptar?: string; peligro?: boolean }): Promise<boolean>`.
- Produces: el componente
  ```ts
  function PanelSuperadmin(props: {
    cuentas: ReturnType<typeof useCuentas>;
    confirmar: (titulo: string, opciones?: { texto?: string; aceptar?: string; peligro?: boolean }) => Promise<boolean>;
    decidir: (id: string, estado: EstadoCuenta) => Promise<string | null>;
  }): JSX.Element
  ```
  `decidir` la arma `App.tsx` para poder mandar el correo (Task 15). La Task 16 le agrega el formulario de pago.

- [ ] **Step 1: Reescribir el componente**

Reemplazar `src/components/PanelSuperadmin.tsx` entero:

```tsx
import { useState } from 'react';
import type { useCuentas } from '../useCuentas';
import type { EstadoCuenta, Rol } from '../usePerfil';

type Props = {
  cuentas: ReturnType<typeof useCuentas>;
  confirmar: (
    titulo: string,
    opciones?: { texto?: string; aceptar?: string; peligro?: boolean },
  ) => Promise<boolean>;
  decidir: (id: string, estado: EstadoCuenta) => Promise<string | null>;
};

const ETIQUETA: Record<EstadoCuenta, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Activa',
  rechazado: 'Desactivada',
};

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-CO');

/** Solo para superadmin: acepta, desactiva y cambia el rol de las cuentas. */
export function PanelSuperadmin({ cuentas, confirmar, decidir }: Props) {
  const [aviso, setAviso] = useState<string | null>(null);

  const quitar = async (id: string, nombre: string, estado: EstadoCuenta) => {
    const activa = estado === 'aprobado';
    const ok = await confirmar(activa ? `¿Desactivar a ${nombre}?` : `¿Rechazar a ${nombre}?`, {
      // La consecuencia menos obvia: no es solo que deje de entrar.
      texto: activa
        ? 'Deja de poder entrar y los links públicos de sus rifas dejan de abrir.'
        : 'Podrás activarla después si cambia la cosa.',
      aceptar: activa ? 'Desactivar' : 'Rechazar',
      peligro: true,
    });
    if (ok) setAviso(await decidir(id, 'rechazado'));
  };

  const cambiarRol = async (id: string, nombre: string, rol: Rol) => {
    if (rol === 'superadmin') {
      const ok = await confirmar(`¿Hacer superadmin a ${nombre}?`, {
        texto: 'Podrá aprobar, desactivar y cambiar el rol de cualquier cuenta menos la suya.',
        aceptar: 'Hacer superadmin',
      });
      if (!ok) return;
    }
    setAviso(await cuentas.actualizarCuenta(id, { rol }));
  };

  return (
    <aside className="panel">
      <div className="misrifas__cabecera">
        <h2 className="panel__titulo">
          Cuentas
          {cuentas.pendientes > 0 && <span className="panel__globo">{cuentas.pendientes}</span>}
        </h2>
        <button type="button" onClick={cuentas.recargar}>
          Actualizar
        </button>
      </div>

      <label className="cuentas__buscar">
        Buscar por correo
        <input
          type="search"
          value={cuentas.busqueda}
          onChange={(e) => cuentas.setBusqueda(e.target.value)}
          placeholder="ana@correo.com"
        />
      </label>

      {/* Buscando, la pestaña no aplica: se busca en todas las cuentas. */}
      {!cuentas.busqueda.trim() && (
        <nav className="panel__nav" role="tablist" aria-label="Estado de las cuentas">
          {(['pendiente', 'aprobado', 'rechazado'] as EstadoCuenta[]).map((e) => (
            <button
              key={e}
              type="button"
              role="tab"
              aria-selected={cuentas.filtro === e}
              className={`panel__tab${cuentas.filtro === e ? ' panel__tab--activa' : ''}`}
              onClick={() => cuentas.setFiltro(e)}
            >
              {ETIQUETA[e]}
            </button>
          ))}
        </nav>
      )}

      {cuentas.hayCambios && (
        <button type="button" className="cuentas__novedad" onClick={cuentas.recargar}>
          Hay cambios nuevos · actualizar
        </button>
      )}

      {cuentas.cargando && cuentas.lista.length === 0 ? (
        <p className="panel__nota">Cargando…</p>
      ) : cuentas.lista.length === 0 ? (
        <p className="panel__nota">
          {cuentas.busqueda.trim() ? 'Ningún correo coincide.' : 'No hay cuentas en este estado.'}
        </p>
      ) : (
        <ul className="cuentas">
          {cuentas.lista.map((c) => (
            <li key={c.id} className="cuentas__fila">
              <div>
                <strong>{c.nombre || c.email}</strong>
                {c.nombre && <span>{c.email}</span>}
                <span>
                  {ETIQUETA[c.estado]} · {fecha(c.creado_en)}
                </span>
              </div>

              <label className="cuentas__rol">
                Rol
                <select
                  value={c.rol}
                  onChange={(e) => cambiarRol(c.id, c.nombre || c.email, e.target.value as Rol)}
                >
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </label>

              <div className="cuentas__acciones">
                {c.estado !== 'aprobado' && (
                  <button
                    type="button"
                    className="boton--primario"
                    onClick={async () => setAviso(await decidir(c.id, 'aprobado'))}
                  >
                    Aprobar
                  </button>
                )}
                {c.estado !== 'rechazado' && (
                  <button
                    type="button"
                    className="boton--peligro"
                    onClick={() => quitar(c.id, c.nombre || c.email, c.estado)}
                  >
                    {c.estado === 'aprobado' ? 'Desactivar' : 'Rechazar'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {cuentas.hayMas && (
        <button type="button" onClick={cuentas.mas} disabled={cuentas.cargando}>
          {cuentas.cargando ? 'Cargando…' : 'Ver más'}
        </button>
      )}

      {(aviso || cuentas.error) && (
        <p className="dialogo__error" role="alert">
          {aviso ?? cuentas.error}
        </p>
      )}
    </aside>
  );
}
```

El `<select>` de rol **no** se esconde en la fila propia porque la consulta ya excluye al propio usuario con `.neq('id', usuarioId)`. Si aun así llegara, el trigger de la Task 4 aborta y el mensaje sale en el aviso.

- [ ] **Step 2: Devolver el bloque a `App.tsx`**

La Task 12 dejó tres cosas comentadas o apuntaladas para que el árbol compilara sin
`PanelSuperadmin`: el bloque JSX, el `import { PanelSuperadmin }` y una línea
`void cuentas;` que existe solo para callar a `noUnusedLocals` de `tsconfig.json`.
**Las tres se deshacen aquí**: descomentar el import, borrar el `void cuentas;`, y
reemplazar el `{/* … */}` por:

```tsx
              <PanelSuperadmin
                cuentas={cuentas}
                confirmar={confirmar}
                decidir={async (id, estado) => cuentas.actualizarCuenta(id, { estado })}
              />
```

El correo lo vuelve a cablear la Task 15.

- [ ] **Step 3: Estilos**

En `src/styles.css`, tras `.cuentas__acciones button` (cerca de la línea 447):

```css
.cuentas__buscar {
  display: grid;
  gap: 0.25rem;
  font-size: 0.75rem;
  margin-bottom: 0.5rem;
}

.cuentas__rol {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.72rem;
  opacity: 0.85;
}

.cuentas__rol select {
  flex: 1;
  font-size: 0.75rem;
}

/* Aviso de que llegaron cambios mientras se paginaba o buscaba: recargar solo
   movería la lista bajo el dedo. */
.cuentas__novedad {
  width: 100%;
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
  border-color: var(--acento);
}
```

- [ ] **Step 4: Verificar**

Run: `npm run build`
Expected: compila.

Run: `npm test`
Expected: PASS.

Prueba manual con sesión de superadmin:
1. Pestañas Pendiente / Activa / Desactivada filtran.
2. Escribir en "Buscar por correo" esconde las pestañas y busca entre todas las cuentas.
3. Borrar la búsqueda devuelve las pestañas y la pestaña que estaba.
4. Aprobar una cuenta pendiente → sale de la pestaña y el globo del contador baja.
5. Desactivar una activa → el diálogo avisa de los links públicos.
6. Con la cuenta desactivada, abrir su link público en incógnito → no carga la rifa (es la Task 5 funcionando de punta a punta).
7. Cambiar un rol a Superadmin → pide confirmación y se guarda.
8. Con más de 50 cuentas, "Ver más" trae la página siguiente sin repetir ninguna.

**No commitear.**

---

### Task 15: Avisar cuando el correo no sale

Hoy `App.tsx` llama a `enviarCorreo` y tira el resultado. Si Brevo está caído o falta una variable de entorno, el superadmin aprueba una cuenta convencido de que el usuario ya fue avisado, y el usuario se queda esperando un correo que nunca salió.

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `enviarCorreo` de `src/correos.ts`, cuya firma es
  `(tipo: 'solicitud' | 'aprobada' | 'rechazada', datos?: { nombre?: string; email?: string }) => Promise<string | null>`;
  `actualizarCuenta` de la Task 12.
- Produces: nada nuevo.

- [ ] **Step 1: Componer decisión y correo**

Reemplazar la prop `decidir` que la Task 14 dejó provisional:

```tsx
                decidir={async (id, estado) => {
                  const err = await cuentas.actualizarCuenta(id, { estado });
                  if (err) return err;
                  const p = cuentas.lista.find((c) => c.id === id);
                  if (!p || estado === 'pendiente') return null;
                  const fallo = await enviarCorreo(
                    estado === 'aprobado' ? 'aprobada' : 'rechazada',
                    { nombre: p.nombre ?? '', email: p.email },
                  );
                  // Aviso y no error: la decisión ya quedó guardada. Llamarlo "falló"
                  // lleva al superadmin a reintentar una operación que sí funcionó.
                  return fallo ? `Cuenta actualizada, pero el aviso por correo no salió: ${fallo}` : null;
                }}
```

- [ ] **Step 2: Verificar**

Run: `npm run build`
Expected: compila.

Run: `npm test`
Expected: PASS.

Prueba manual del camino de fallo, que es el que importa:
1. En el `.env` del entorno de desarrollo, borrar `BREVO_API_KEY`.
2. Reiniciar y aprobar una cuenta.
3. Expected: la cuenta **se aprueba** (sale de la pestaña Pendiente) y debajo aparece "Cuenta actualizada, pero el aviso por correo no salió: Falta BREVO_API_KEY en el servidor."
4. Devolver la variable y aprobar otra → sin aviso, y el correo llega.

**No commitear.**

---

## Fase C · Pago

### Task 16: Registrar el pago al aprobar

El onboarding vende "acceso de por vida por $15.000" y hoy no queda ni rastro de quién pagó. El superadmin aprueba a ciegas y a los tres meses no hay forma de saber si una cuenta pagó o entró de cortesía.

**Files:**
- Modify: `src/components/PanelSuperadmin.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `actualizarCuenta(id, { estado, pagadoEn, pagoNota })` de la Task 12; las columnas de la Task 3.
- Produces: nada nuevo hacia afuera.

- [ ] **Step 1: Ampliar el tipo `Perfil`**

En `src/usePerfil.ts`, agregar al tipo:

```ts
export type Perfil = {
  id: string;
  email: string;
  nombre: string | null;
  rol: Rol;
  estado: EstadoCuenta;
  creado_en: string;
  pagado_en: string | null;
  pago_nota: string | null;
};
```

- [ ] **Step 2: Agregar el formulario de pago a `PanelSuperadmin`**

Junto al estado `aviso`:

```ts
  // id de la fila con el formulario de pago abierto. null = ninguna.
  const [cobrando, setCobrando] = useState<string | null>(null);
  const [fecha_, setFecha] = useState('');
  const [nota, setNota] = useState('');

  const abrirPago = (id: string, pagadoEn: string | null, pagoNota: string | null) => {
    setCobrando(id);
    setFecha((pagadoEn ?? new Date().toISOString()).slice(0, 10));
    setNota(pagoNota ?? '');
    setAviso(null);
  };

  const guardarPago = async (id: string, aprobar: boolean) => {
    const err = aprobar
      ? await decidir(id, 'aprobado', { pagadoEn: fecha_ || null, pagoNota: nota.trim() || null })
      : await cuentas.actualizarCuenta(id, {
          pagadoEn: fecha_ || null,
          pagoNota: nota.trim() || null,
        });
    setAviso(err);
    if (!err) setCobrando(null);
  };
```

- [ ] **Step 3: Ampliar la firma de `decidir`**

En `Props` de `PanelSuperadmin`:

```ts
  decidir: (
    id: string,
    estado: EstadoCuenta,
    pago?: { pagadoEn: string | null; pagoNota: string | null },
  ) => Promise<string | null>;
```

Y en `App.tsx`, la prop:

```tsx
                decidir={async (id, estado, pago) => {
                  const err = await cuentas.actualizarCuenta(id, { estado, ...pago });
                  if (err) return err;
                  const p = cuentas.lista.find((c) => c.id === id);
                  if (!p || estado === 'pendiente') return null;
                  const fallo = await enviarCorreo(
                    estado === 'aprobado' ? 'aprobada' : 'rechazada',
                    { nombre: p.nombre ?? '', email: p.email },
                  );
                  return fallo ? `Cuenta actualizada, pero el aviso por correo no salió: ${fallo}` : null;
                }}
```

- [ ] **Step 4: Pintar el estado del pago y el formulario en cada fila**

Dentro del `<li>`, tras el bloque `<div>` de los datos:

```tsx
              <span className={`cuentas__pago${c.pagado_en ? '' : ' cuentas__pago--falta'}`}>
                {c.pagado_en
                  ? `Pagó ${fecha(c.pagado_en)}${c.pago_nota ? ` · ${c.pago_nota}` : ''}`
                  : 'Sin pago registrado'}
              </span>
```

Y reemplazar el botón "Aprobar" por la apertura del formulario:

```tsx
                {c.estado !== 'aprobado' && cobrando !== c.id && (
                  <button
                    type="button"
                    className="boton--primario"
                    onClick={() => abrirPago(c.id, c.pagado_en, c.pago_nota)}
                  >
                    Aprobar
                  </button>
                )}
                {c.estado === 'aprobado' && cobrando !== c.id && (
                  <button
                    type="button"
                    onClick={() => abrirPago(c.id, c.pagado_en, c.pago_nota)}
                  >
                    {c.pagado_en ? 'Editar pago' : 'Registrar pago'}
                  </button>
                )}
```

Y tras el `<div className="cuentas__acciones">`, el formulario:

```tsx
              {cobrando === c.id && (
                <div className="cuentas__cobro">
                  <label>
                    Fecha del pago
                    <input type="date" value={fecha_} onChange={(e) => setFecha(e.target.value)} />
                  </label>
                  <label>
                    Medio y referencia
                    <input
                      value={nota}
                      onChange={(e) => setNota(e.target.value)}
                      maxLength={200}
                      placeholder="Nequi 300…"
                    />
                  </label>
                  <div className="cuentas__acciones">
                    <button
                      type="button"
                      className="boton--primario"
                      onClick={() => guardarPago(c.id, c.estado !== 'aprobado')}
                    >
                      {c.estado === 'aprobado' ? 'Guardar pago' : 'Aprobar con pago'}
                    </button>
                    {c.estado !== 'aprobado' && (
                      // Cortesías, pruebas, el que paga después: aprobar sin cobrar
                      // tiene que ser un clic, no un rodeo.
                      <button
                        type="button"
                        onClick={async () => {
                          setAviso(
                            await decidir(c.id, 'aprobado', { pagadoEn: null, pagoNota: null }),
                          );
                          setCobrando(null);
                        }}
                      >
                        Aprobar sin pago
                      </button>
                    )}
                    <button type="button" onClick={() => setCobrando(null)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
```

- [ ] **Step 5: Estilos**

En `src/styles.css`, tras `.cuentas__novedad`:

```css
.cuentas__pago {
  font-size: 0.72rem;
  opacity: 0.8;
}

/* Aprobar cobrado y aprobar de cortesía tienen que distinguirse de un vistazo, o
   el dato no sirve para nada. */
.cuentas__pago--falta {
  color: var(--peligro);
  opacity: 1;
}

.cuentas__cobro {
  display: grid;
  gap: 0.4rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--borde);
  font-size: 0.72rem;
}
```

- [ ] **Step 6: Verificar**

Run: `npm run build`
Expected: compila.

Run: `npm test`
Expected: PASS.

Run: `psql "$DATABASE_URL" -f supabase/pruebas/cuentas.sql`
Expected: `Todas las pruebas de cuentas pasaron.` — cubre que un usuario común no pueda escribir `pagado_en` y que la nota de 201 caracteres reviente.

Prueba manual:
1. Aprobar una cuenta pendiente con fecha y nota → queda "Pagó 13/08/2026 · Nequi 300…".
2. Aprobar otra con "Aprobar sin pago" → queda "Sin pago registrado" en rojo.
3. En una cuenta ya activa, "Registrar pago" guarda y la etiqueta cambia.
4. Pegar 250 caracteres en la nota → el `maxLength` corta en 200 y el guardado pasa.
5. Recargar la página: los pagos siguen ahí.

**No commitear.**

---

## Cierre

Al terminar las 16 tareas, correr todo junto:

```bash
npm test
npm run build
psql "$DATABASE_URL" -f supabase/pruebas/cuentas.sql
node verificar-nube.mjs
```

Expected: tests en verde (`rifa.test.ts`, `sesion.test.ts`, `cuentas.test.ts`), build limpio, pruebas de humo de la base con `Todas las pruebas de cuentas pasaron.`, y `verificar-nube.mjs` sin fallas.

Y el recorrido completo a mano, que es el que cubre lo que ningún test toca:

1. Crear cuenta nueva → llega el correo de solicitud → sale la sala de espera.
2. Como superadmin, aprobarla con pago → llega el correo de activación → la otra ventana pasa sola de la sala de espera a la app (realtime del perfil propio, que ya existía).
3. La cuenta nueva crea una rifa y comparte su link público → abre en incógnito.
4. El superadmin la desactiva → el link público deja de abrir y la sesión de esa cuenta vuelve a la sala de espera.
5. Recuperar contraseña de esa cuenta → el enlace pide clave nueva, no entra directo.
6. Quitar `VITE_SUPABASE_URL` del `.env` → la app corre en modo local, sin cuentas, sin panel de "Mi cuenta" ni de superadmin.

**Recordatorio final: nada de `git add` ni `git commit` en ningún momento.**
