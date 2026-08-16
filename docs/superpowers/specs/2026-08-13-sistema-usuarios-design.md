# Sistema de usuarios — diseño

Fecha: 2026-08-13
Rama: `usuarios-completo`
Estado: aprobado en brainstorming, pendiente de plan de implementación

## Punto de partida

El sistema de cuentas actual funciona y es seguro en lo esencial: RLS con
`esta_aprobado()` sobre toda escritura, y el endpoint de correo verifica el token
de sesión contra Supabase antes de mandar nada. Lo que falta es el **ciclo de vida
de la cuenta**.

Piezas de hoy:

| Archivo | Papel |
| --- | --- |
| `src/nube.ts` | Cliente Supabase. `null` = modo local sin cuentas. |
| `src/useRifa.ts` | Dueño de la sesión: `getSession`, `onAuthStateChange`, `entrar`, `registrarse`, `salir`. |
| `src/usePerfil.ts` | Perfil, rol, estado de aprobación, solicitudes, realtime de la propia fila, `decidir`. |
| `src/App.tsx` | Cuatro compuertas encadenadas que eligen pantalla. |
| `src/components/Onboarding.tsx` | Entrar / crear cuenta. |
| `src/components/EnEspera.tsx` | Pendiente, rechazado, o perfil no cargado. |
| `src/components/PanelSuperadmin.tsx` | Aprueba y rechaza. |
| `src/components/DashboardSuper.tsx` | Vista `panel_superadmin`. |
| `src/correos.ts` + `api/_correo.ts` | Avisos por Brevo, con token de sesión verificado. |
| `supabase/migrations/…_roles.sql` | `perfiles`, `accesos_previos`, trigger de alta, RLS. |

Flujo: `signUp` → trigger crea `perfiles` (pendiente, salvo lista blanca) → correo al
usuario y al superadmin → superadmin aprueba → `UPDATE perfiles` → realtime despierta
la sesión del usuario → entra.

## Problemas que resuelve este diseño

1. Sin recuperar contraseña.
2. El rol solo se asigna por SQL.
3. Sin registro del pago de $15.000 que vende el onboarding.
4. El usuario no puede editar su propio perfil.
5. Rol `cliente` declarado y muerto.
6. Sin forma de desactivar una cuenta ya aprobada.
7. Desactivar no apaga los links públicos del usuario.
8. `select *` de todos los perfiles, sin paginar.
9. La lista del superadmin no tiene realtime.
10. El fallo del correo de aprobado/rechazado se ignora.
11. `usePerfil.decidir` usa `nube!`.
12. `perfiles.email` nunca se resincroniza con `auth.users`.
13. `supabase.sql` en la raíz está obsoleto y el README manda pegarlo.
14. Correo personal incrustado en la migración y en `api/_correo.ts`.
15. Las compuertas de sesión en `App.tsx` mezclan cinco flags de dos hooks.

## Decisiones tomadas

- **Pago**: nota manual del superadmin. Sin pasarela, sin webhook.
- **Eliminar cuentas**: solo desactivar. Nada de borrado real, ningún endpoint con
  `SUPABASE_SERVICE_ROLE_KEY`.
- **Escala**: se diseña para miles de cuentas — cursor keyset, búsqueda por trigrama,
  índices. Si la realidad resulta ser decenas, esto es la mitad del bloque B de más;
  recortarlo es cambiar la consulta a filtro por estado y lista completa.

## Fuera de alcance

- Pasarela de pago, webhooks, conciliación.
- Borrado real de cuentas en `auth.users`.
- Cambio de correo desde la app (`auth.updateUser({ email })` y su doble confirmación).
- Campo de monto del pago; la nota libre lo cubre.
- Limpiar el correo personal del historial de git (exige reescribir git; se pide aparte).
- Refactor no relacionado con el sistema de usuarios.

---

## Sección 1 · Base de datos

Migración nueva: `supabase/migrations/20260813000000_cuentas.sql`. No destructiva.

### Columnas de pago

```sql
alter table perfiles
  add column if not exists pagado_en timestamptz,
  add column if not exists pago_nota text;

alter table perfiles add constraint perfiles_pago_nota_largo
  check (pago_nota is null or length(pago_nota) <= 200);
```

### Rol `cliente` fuera (#5)

```sql
update perfiles set rol = 'admin' where rol = 'cliente';
update accesos_previos set rol = 'admin' where rol = 'cliente';
alter table perfiles drop constraint perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check check (rol in ('superadmin','admin'));
alter table accesos_previos drop constraint accesos_previos_rol_check;
alter table accesos_previos add constraint accesos_previos_rol_check check (rol in ('superadmin','admin'));
```

Los nombres de constraint son los que Postgres genera para un `check` en línea. Hay
que confirmarlos contra `\d perfiles` antes de escribir la migración; si difieren, el
`drop constraint` falla y la migración no corre.

El tipo `Rol` en `usePerfil.ts` queda `'superadmin' | 'admin'`.

### Índices (#8)

Sirven al keyset y a la búsqueda de la Sección 3. El orden de columnas tiene que
coincidir con el `order by` de la consulta o el índice no se usa.

```sql
create index if not exists perfiles_estado_creado
  on perfiles (estado, creado_en desc, id desc);

create extension if not exists pg_trgm;
create index if not exists perfiles_email_busqueda
  on perfiles using gin (email gin_trgm_ops);
```

Trigrama y no `text_pattern_ops`: la búsqueda es `ilike '%texto%'`, y un índice de
patrón por prefijo no la atiende.

### Sincronizar correo (#12)

Trigger `after update of email on auth.users` que copia el valor a `perfiles.email`.
El de `insert` ya existe (`al_crear_usuario`).

### Editar el nombre propio (#4)

```sql
create or replace function public.actualizar_mi_nombre(nuevo text) returns void
language sql security definer set search_path = public as $$
  update perfiles set nombre = nullif(trim(nuevo), '') where id = auth.uid();
$$;
```

Por qué una función y no una policy: RLS no restringe columnas, y un
`grant update (nombre) on perfiles to authenticated` actúa a nivel de rol — le
quitaría al superadmin la escritura de `estado` y `rol`, porque también es
`authenticated`. La alternativa sería policy nueva más trigger guardián más grants
por columna. Una función de una línea sale más barata y deja `perfiles` sin ninguna
policy de `update` para el usuario común.

### Candado anti-encierro

Trigger `before update on perfiles` que aborta si:

- alguien cambia su propio `rol` (`new.rol <> old.rol and old.id = auth.uid()`), o
- el cambio deja la tabla sin ningún superadmin.

Sin esto, un clic te deja fuera de tu propia plataforma y solo se arregla entrando
por SQL. Es protección contra pérdida de acceso, no adorno: se queda aunque la UI
también lo impida.

### Links públicos siguen al dueño (#7)

```sql
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

Desactivar una cuenta apaga sus links en el mismo movimiento. Es búsqueda por clave
primaria; no pesa.

**Sin policies de `delete`** y sin endpoint con service key: desactivar es
`estado = 'rechazado'`, que ya corta la escritura vía `esta_aprobado()` y ahora
también la lectura pública.

### Verificación

`supabase/pruebas/cuentas.sql` — script de humo con `set local role`:

- usuario normal no puede cambiar su propio `rol`;
- usuario normal no puede escribir `estado`, `pagado_en` ni `pago_nota`;
- superadmin no puede degradarse a sí mismo;
- no se puede dejar la tabla sin superadmin;
- rifa de un dueño rechazado no se lee como anónimo;
- `pago_nota` de 201 caracteres revienta.

`pg` ya está en devDependencies.

---

## Sección 2 · Bloque A — recuperar contraseña y perfil propio

### Recuperar contraseña (#1)

`useRifa.ts`, junto a `entrar` / `registrarse` / `salir`:

```ts
const recuperarClave = useCallback(async (email: string): Promise<string | null> => {
  const { error } = await nube!.auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}${location.pathname}`,
  });
  return error ? error.message : null;
}, []);
```

`Onboarding.tsx`: el estado `modo` pasa de `'entrar' | 'crear'` a
`'entrar' | 'crear' | 'recuperar'`, con enlace "¿Olvidaste tu contraseña?" en modo
entrar. El aviso de éxito es siempre el mismo — "Si existe una cuenta con ese correo,
te llega un enlace" — para no delatar qué correos están registrados, igual que ya
hace `registrarse` con el truco de `identities`.

Ese correo lo manda **Supabase Auth, no Brevo**: sale con la plantilla genérica de
Supabase. Se corrige apuntando el SMTP de Supabase a Brevo desde el panel; es
configuración, no código, y no forma parte de este trabajo.

### Poner la clave nueva

Al volver del enlace, supabase-js canjea el hash solo y dispara
`onAuthStateChange`. Hoy `useRifa.ts:147` solo lee `sesion?.user.id`, así que **ese
enlace entraría directo al tablero sin pedir clave nueva**. Hay que atrapar el evento:

```ts
const { data } = nube.auth.onAuthStateChange((e, sesion) => {
  if (e === 'PASSWORD_RECOVERY') setRecuperando(true);
  setAdmin(sesion?.user.id ?? null);
  setSesionLista(true);
});
```

`App.tsx` antepone esa compuerta a todas las demás: con `rifa.recuperando` se muestra
`NuevaClave` y nada más.

`NuevaClave.tsx` — clave y repetir, `minLength 6`, llama `cambiarClave(nueva)` →
`nube!.auth.updateUser({ password })`. Al guardar, `recuperando` vuelve a `false` y el
flujo sigue normal, ya con sesión.

El input con ojo de mostrar/ocultar se repetiría en dos sitios, así que sale a
`src/components/CampoClave.tsx` y lo usan `Onboarding` y `NuevaClave`. Mismo patrón
que `CampoNumero.tsx`, misma carpeta.

### Perfil propio (#4)

`MiCuenta.tsx`, primero en la columna del panel: correo en solo lectura, estado de la
cuenta, y el nombre editable.

```ts
const guardarNombre = useCallback(async (nuevo: string) => {
  const { error } = await nube!.rpc('actualizar_mi_nombre', { nuevo });
  if (!error) await cargarPerfil(true);
  return error?.message ?? null;
}, [cargarPerfil]);
```

### Archivos

`useRifa.ts`, `usePerfil.ts`, `App.tsx`, `Onboarding.tsx`, `styles.css`.
Nuevos: `NuevaClave.tsx`, `MiCuenta.tsx`, `CampoClave.tsx`.

### Verificación

La decisión de qué pantalla mostrar — ahora con `recuperando` encima — se testea en
`src/sesion.test.ts` (Sección 5). De esta sección: prueba manual del enlace de
recuperación, y el script SQL de la Sección 1 para el RPC del nombre.

---

## Sección 3 · Bloque B — administración de cuentas

### `usePerfil` se divide

Hoy hace dos trabajos, y el segundo se carga en toda sesión aunque no seas superadmin.

- `usePerfil.ts` — perfil propio, `aprobado`, `esSuperadmin`, `guardarNombre`, canal de
  la propia fila. Encoge.
- `useCuentas.ts` — nuevo. Listado, filtro, búsqueda, cursor, conteo de pendientes,
  realtime, `actualizarCuenta`. `App.tsx` solo lo monta si `cuenta.esSuperadmin`.

### Paginación por cursor (#8)

Keyset, no `.range()`:

```ts
const PAGINA = 50;
let q = nube.from('perfiles').select('*')
  .neq('id', usuarioId)
  .order('creado_en', { ascending: false })
  .order('id', { ascending: false })
  .limit(PAGINA);
q = busqueda ? q.ilike('email', `%${busqueda}%`) : q.eq('estado', filtro);
if (cursor) q = q.or(filtroCursor(cursor));
```

El segundo `order` por `id` es el desempate: sin él, dos altas del mismo instante se
repiten o se pierden entre páginas.

Offset se desordena justo cuando más se usa — apruebas una cuenta, se cae de la
pestaña "pendiente", y la página siguiente salta filas. El cursor no.

Buscar ignora la pestaña de estado a propósito: se busca un correo, no un correo
*dentro de rechazados*. Debounce de 300 ms.

### Realtime de la lista (#9)

Canal sobre toda la tabla `perfiles`, solo para superadmin. Con paginación no puede
recargar a lo bruto: en la página 3, o buscando, un evento movería la lista bajo el
dedo. Regla: en primera página y sin búsqueda, recarga; si no, enciende un aviso
"hay cambios nuevos" con botón.

El contador de pendientes deja de derivarse de la lista — ya no la tiene entera — y
pasa a `select('*', { count: 'exact', head: true }).eq('estado','pendiente')`,
refrescado por el mismo canal.

### Cambiar rol (#2)

`<select>` de rol en cada fila, oculto en la fila propia. Promover a superadmin pasa
por `useConfirmar`. El trigger de la Sección 1 es la red de verdad: si algo se salta
la UI, la base aborta y el mensaje del trigger se muestra tal cual.

### Desactivar (#6)

Sin estado nuevo: sigue siendo `rechazado`. Cambia la palabra según el caso —
"Rechazar" para pendientes, "Desactivar" para activas — y el diálogo de confirmación
avisa que **también apaga sus links públicos**, que es la consecuencia nueva de la
Sección 1 y no se ve venir.

### Aviso de correo fallido (#10)

Hoy `App.tsx:283` se traga el error. Pasa a:

```ts
const err = await cuenta.actualizarCuenta(id, { estado });
if (err) return err;
const p = cuenta.lista.find((s) => s.id === id);
const fallo =
  p && estado !== 'pendiente'
    ? await enviarCorreo(estado === 'aprobado' ? 'aprobada' : 'rechazada', {
        nombre: p.nombre ?? '',
        email: p.email,
      })
    : null;
return fallo ? `Cuenta actualizada, pero el aviso por correo no salió: ${fallo}` : null;
```

`actualizarCuenta` se define en la Sección 4, que funde `decidir`, `cambiarRol` y el
guardado del pago en una sola escritura.

Se pinta como aviso, no como error: la decisión ya quedó guardada, y decirle "falló"
al superadmin lo llevaría a reintentar de más.

### `nube!` (#11)

`useCuentas` corta con `if (!nube) return 'Sin conexión.'` al entrar a
`actualizarCuenta`. Se acaba el `nube!` de `usePerfil.decidir`.

### Archivos

`usePerfil.ts` (adelgaza), `PanelSuperadmin.tsx` (reescrito), `App.tsx`, `styles.css`.
Nuevos: `useCuentas.ts`, `src/cuentas.ts`, `src/cuentas.test.ts`.

### Verificación

`filtroCursor(cursor)` y `siguienteCursor(filas)` salen como funciones puras a
`src/cuentas.ts` y se testean en `src/cuentas.test.ts`: empates de `creado_en`,
página vacía, última página. Es el punto que se rompe en silencio y solo se nota como
filas duplicadas semanas después.

---

## Sección 4 · Bloque C — pago

### Aprobar pide el pago (#3)

El botón "Aprobar" abre un formulario en la misma fila: fecha (por defecto hoy) y nota
libre — medio y referencia, "Nequi 300…", "efectivo el sábado". Un solo `update`
guarda `estado`, `aprobado_en`, `pagado_en` y `pago_nota`.

**Aprobar sin pago sigue existiendo**: cortesías, pruebas, el que paga después. Deja
`pagado_en` en null y la fila queda marcada **"Sin pago registrado"**, visible en la
lista. Si no se viera, aprobar gratis y aprobar cobrado quedarían idénticos y el dato
no serviría de nada.

**Editable después**: el pago que llega tarde es el caso normal, no la excepción. Las
filas ya aprobadas llevan "Registrar pago" / "Editar pago" con el mismo formulario.

### Una sola función de escritura

`decidir` y `cambiarRol` se funden con el guardado del pago:

```ts
actualizarCuenta(
  id: string,
  cambios: { estado?: EstadoCuenta; rol?: Rol; pagadoEn?: string | null; pagoNota?: string | null },
): Promise<string | null>
```

Un `update`, un camino de error, un sitio donde derivar `aprobado_en` de `estado`.
Tres funciones que escriben la misma fila con la misma policy no ganaban nada
separadas.

### Archivos

`useCuentas.ts`, `PanelSuperadmin.tsx`, `styles.css`.

### Verificación

Lo cubre el script SQL de la Sección 1: que un usuario normal no pueda escribir
`pagado_en`, y que la nota de 201 caracteres revienta.

---

## Sección 5 · Bloque D — higiene

### `supabase.sql` (#13)

No es solo un archivo viejo: trae `create policy "rifas lectura publica" … using (true)`
precedido de su `drop policy if exists`. Quien siga el `README.md:136` y lo pegue
**revierte en silencio el #7**, los links de las cuentas desactivadas vuelven a
encenderse, y nada lo avisa.

Se borra. Fuente única: `supabase/migrations/`. `README.md:136` pasa a `supabase db push`,
o pegar las migraciones en orden.

### Correo personal (#14)

`api/_correo.ts` pierde los defaults:

```ts
const remitente = process.env.BREVO_REMITENTE;
const superadmin = process.env.SUPERADMIN_EMAIL;
if (!remitente || !superadmin)
  return { estado: 500, datos: { error: 'Falta BREVO_REMITENTE o SUPERADMIN_EMAIL en el servidor.' } };
```

Mismo trato que `BREVO_API_KEY`. Fallar ruidoso es mejor que mandarle las solicitudes
al buzón de otra persona sin que nadie se entere.

La semilla de `accesos_previos` sale a `supabase/semilla.example.sql` con un correo de
ejemplo, y el README explica correr el insert con el correo propio. **La migración
`…_roles.sql` no se toca**: ya corrió, y reescribir una migración aplicada no deshace
nada mientras rompe a quien la tenga registrada.

Alcance honesto: el correo sigue en el historial de git y la fila sigue en la base de
producción. Lo que se gana es que la próxima instalación no siembre el correo de otro.

### Compuertas de `App.tsx` (#15)

Hoy son cuatro ramas con cuatro flags de dos hooks, y la Sección 2 mete un quinto.
Sale a función pura, `src/sesion.ts`:

```ts
export type Pantalla =
  | 'recuperar' | 'onboarding' | 'publico' | 'perfil-cargando' | 'espera' | 'app';

export function pantalla(e: {
  recuperando: boolean;
  haySesion: boolean;
  hayNube: boolean;
  hayRifa: boolean;
  perfilCargando: boolean;
  aprobado: boolean;
}): Pantalla;
```

Orden de evaluación: `recuperar` → `onboarding` (sin sesión y sin rifa) → `publico`
(sin sesión, con rifa) → `perfil-cargando` (con nube) → `espera` (con nube, sin
aprobar) → `app`.

`App.tsx` queda con un `switch`. `rifa.cargando` **no** entra en la función: hoy el
spinner se pinta *dentro* de cada rama, no encima, y subirlo cambiaría lo que ve el
usuario.

`src/sesion.test.ts` recorre la matriz de combinaciones. Es el único sitio donde un
orden mal puesto se ve antes que en producción — visitante con link viendo la pantalla
de espera, o cuenta rechazada colándose al tablero.

---

## Orden de ejecución

1. **D · #13 y #14** — minutos, sin dependencias, y quita la trampa del `.sql` antes
   de que alguien la pise.
2. **Sección 1 · migración** — base de A, B y C.
3. **D · #15 `pantalla()`** — todavía sin `recuperar`; deja el `switch` limpio antes de
   que A y B escriban ahí.
4. **A** — recuperar contraseña y perfil propio. Añade `'recuperar'` al switch y su test.
5. **B** — administración de cuentas. Reescribe `PanelSuperadmin` y deja
   `actualizarCuenta` puesta.
6. **C** — pago, encima de `actualizarCuenta`. Va último a propósito: al revés, C
   escribiría en un `PanelSuperadmin` que B tira a la basura.

## Pruebas del conjunto

- `npm test` — `src/sesion.test.ts` y `src/cuentas.test.ts` nuevos, `src/rifa.test.ts`
  sigue verde.
- `supabase/pruebas/cuentas.sql` — RLS, triggers y constraints.
- Manual: enlace de recuperación de contraseña de punta a punta, y desactivar una
  cuenta aprobada comprobando que su link público deja de responder.

## Nota para el plan de implementación

Los seis pasos del orden de ejecución son entregables independientes y verificables
por separado. Si el plan de implementación queda demasiado largo para una sola
sesión, se parte por ahí — nunca a mitad de un bloque, porque B deja `actualizarCuenta`
puesta y C depende de ella.
