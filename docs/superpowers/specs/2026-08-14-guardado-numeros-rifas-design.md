# Guardado de números y rifas — diseño

**Fecha:** 2026-08-14
**Estado:** aprobado por secciones, pendiente de revisión final del usuario

## El problema

Tres defectos en el camino de guardado, los tres sobre dinero real y los tres
anteriores al rediseño del sistema de cuentas.

**1. La venta puede quedar a medias.** Vender es hoy dos escrituras separadas desde el
navegador: primero las filas de `numeros`, después las de `compradores`. Si la segunda
falla, el cliente borra la primera a mano. Pero si el navegador se cierra, se corta la
red o se apaga el equipo entre las dos, ese deshacer nunca corre: el número queda
vendido **sin comprador**, y como la clave primaria `(rifa_id, numero)` impide
revenderlo, queda muerto — nadie lo compró y nadie puede comprarlo.

**2. Bajar el total de números borra ventas en silencio.** Al escribir en el campo del
total, 600 ms después corre `delete from numeros where numero >= totalNumeros`. La
clave foránea de `compradores` cascadea. Tecleando un total más chico desaparecen
números vendidos con sus compradores, sin confirmación y sin aviso.

**3. Los fallos de guardado son mudos.** `subirConfig` devuelve el error y nadie lo
mira. Un guardado que falla se ve exactamente igual que uno que funcionó.

Además, contra la nube `vender` no actualiza el estado local: la venta se ve solo
cuando llega el mensaje de realtime. Si ese mensaje se pierde, la venta entró pero el
dueño no la ve.

## Estado de los datos al momento de diseñar

Verificado contra la base de producción, no supuesto:

- No existe ninguna venta a medias: los 81 números vendidos de `brenda-500-000-3w93`
  tienen sus 81 compradores, y las otras dos rifas están igual de sanas.
- No hay números por encima del total configurado en ninguna rifa.
- `anon` y `authenticated` tienen `INSERT`, `UPDATE` y `DELETE` sobre `numeros` y
  `compradores`. Lo único que los frena hoy es el RLS. Es el default de Supabase.

La invariante «todo número vendido tiene comprador y cae dentro del total» **hoy se
cumple**. Este trabajo no repara datos: los vuelve imposibles de romper.

## Decisiones tomadas

| Pregunta | Decisión |
|---|---|
| ¿Dónde vive la atomicidad de la venta? | En un RPC de Postgres, cerrando la escritura directa |
| ¿Bajar el total con vendidos por encima? | Se impide en la base |
| ¿Guardado de config? | Sigue automático, pero muestra su estado |

Se descartó fusionar `compradores` dentro de `numeros` — que haría la venta un solo
insert — porque `numeros` tiene lectura pública: publicaría el nombre y el teléfono de
cada comprador en el tablero anónimo. La separación en dos tablas es lo que hoy
protege esos datos.

---

## Sección 1 · El RPC de venta y el cierre de la puerta

### La función

```sql
vender_numeros(
  p_rifa     uuid,
  p_numeros  int[],
  p_nombre   text,
  p_telefono text,
  p_pago     text default 'pendiente'
) returns setof numeros
```

`language plpgsql security definer set search_path = public`.

En una sola transacción: valida, inserta las filas de `numeros`, inserta las de
`compradores`, y devuelve las filas de `numeros` insertadas.

### La comprobación que sostiene todo

Al ser `security definer`, la función corre con los privilegios de su dueño y **el RLS
deja de protegerla**. Sin la comprobación de propiedad, cualquier usuario autenticado
podría vender números en la rifa de cualquier otro.

Por eso lo primero que hace, antes de tocar nada, es exigir
`es_mia(p_rifa) and esta_aprobado()` y reventar con `42501` si no se cumple. Esa línea
es la seguridad entera del cambio; cualquier revisión debe verificarla primero.

### Validaciones que se mudan a la base

Donde no se pueden esquivar salteando el cliente:

- **Rango**: cada número debe caer entre `0` y `totalNumeros - 1`. El tablero es de
  base cero — de ahí que el código viejo usara `>=` y no `>`. Fuera de rango: `22003`.
- **Lote**: no puede venir vacío ni con repetidos. Inválido: `22023`.
- **Nombre y teléfono**: ya tienen sus `check` en `compradores`
  (`length(trim(nombre)) >= 2`, `telefono ~ '^[0-9]{7,15}$'`). El error se traduce a
  algo legible en vez de mostrar el nombre de la constraint.
- **Ya vendido**: el choque de clave primaria devuelve `23505` de forma natural, sin
  que la función intervenga.

### El bloqueo contra la carrera

Antes de insertar, la función toma la fila de `rifas` con `select … for update`. Eso
serializa la venta contra el `update` del total (Sección 2), que bloquea la misma fila.
Sin esto, una pestaña puede bajar el total mientras otra vende por encima, y ninguna de
las dos comprobaciones ve a la otra.

Es la misma lección del candado de superadmins del trabajo anterior: un chequeo que no
ve lo que pasa en paralelo no es un candado.

### El cierre de la puerta directa

```sql
revoke insert on numeros, compradores from anon, authenticated;
grant execute on function vender_numeros(...) to authenticated;
```

Se conservan `update` (marcar pago) y `delete` (liberar): ambas operaciones son
atómicas de por sí, y el `delete` de liberar cascadea al comprador, que es lo correcto.

Después de esto no queda ningún camino por el que un número entre sin su comprador.

### Fuera de alcance

- El modo local (`nube === null`) sigue con su lógica pura en memoria, sin tocar.
- La lectura pública no cambia: el tablero anónimo sigue viendo números sin compradores.

---

## Sección 2 · El candado del total

### El trigger

`before update` sobre `rifas`. Rechaza que `totalNumeros` baje por debajo del número
vendido más alto. Solo se activa cuando el total **baja**: escribir el título, el premio
o el precio no paga ningún costo.

El mensaje tiene que ser accionable, no un «operación no permitida»:

> No se puede bajar a 50: hay números vendidos hasta el 78. Libéralos primero.

El dueño necesita saber hasta dónde puede bajar sin ir a contar a mano. Viaja con el
código **`RIF01`**.

### `config` es `jsonb`

Así está declarada en `20260811000000_rifas.sql`. El trigger la lee con `->>`, que
devuelve `text`, y castea a `int`. Si el valor viniera ausente o nulo, **no se
bloquea**: se trata como «sin límite declarado». Bloquear por un dato que falta
rompería rifas viejas por un problema que no es del dueño.

### Lo que desaparece del cliente

La línea `delete from numeros where numero >= totalNumeros`, que hoy corre 600 ms
después de teclear, se borra entera. Ya no hay nada que limpiar: el estado que
pretendía limpiar no puede existir.

### La simetría que queda cerrada

La invariante es «todo número vendido cae dentro del total», y ahora la sostienen los
dos lados: el RPC no deja vender por encima del total, el trigger no deja bajar el
total por debajo de lo vendido. Antes no la sostenía nadie — se reparaba a posteriori,
borrando ventas.

---

## Sección 3 · La venta en el cliente

`vender` pasa de dos escrituras a una llamada `nube.rpc('vender_numeros', …)`.
Desaparecen el segundo insert y el `delete` de deshacer: unas quince líneas que
existían solo para limpiar un desastre que ya no puede ocurrir.

### El estado local deja de depender del realtime

Como el RPC devuelve las filas insertadas, el cliente pinta con eso. Hoy la venta
contra la nube no actualiza nada en pantalla y espera el mensaje de realtime; si ese
mensaje se pierde o el canal está caído, la venta entró pero el dueño no la ve y puede
intentar venderla otra vez.

El RPC devuelve `setof numeros` y **nada del comprador**: el nombre y el teléfono los
acaba de escribir el propio cliente, ya los tiene, y devolverlos sería mandar de vuelta
datos personales que nadie necesita. El cliente arma el ticket con las filas que
recibe más lo que envió.

El realtime se queda para lo que es: enterarse de lo que hacen **otros**.

### Códigos para ramificar, mensajes para mostrar

Regla fija: el cliente decide qué hacer mirando el código de error de Postgres, nunca
comparando texto en español. Un mensaje se reescribe cualquier día y rompería la rama
en silencio.

| Código | Significado | Qué hace el cliente |
|---|---|---|
| `23505` | Alguien lo vendió primero | Conserva su traducción actual, que distingue un número de varios |
| `42501` | La rifa no es tuya, o la cuenta no está aprobada | Mensaje propio; no debería pasar por uso normal |
| `22003` | Número fuera del rango de la rifa | Mensaje propio |
| `22023` | Lote vacío o con repetidos | Mensaje propio |
| `RIF01` | El total no puede bajar (Sección 2) | Muestra el mensaje de la base tal cual |

`venderPuro` se queda: es la lógica del modo local y la validación previa que evita el
viaje cuando el lote ya está mal.

---

## Sección 4 · El guardado que habla

Se agrega un estado de guardado con cuatro valores —**quieto**, **guardando**,
**guardado**, **falló**— que el panel muestra con `role="status"` y `aria-live`, igual
que el resto de la app.

Los 600 ms de espera se quedan. No cambia cómo se usa: se escribe y se guarda solo. Lo
que cambia es que deja de ser mudo.

### Si falla, no se revierte lo escrito

El texto del dueño queda en pantalla tal como lo tecleó. Revertir a lo último guardado
sería quitarle el trabajo por un problema de red.

### El reintento es casi siempre automático

Si sigue escribiendo, el próximo ciclo de 600 ms reintenta solo. El botón de reintentar
existe para el caso en que dejó de escribir y el último guardado quedó fallado — que es
exactamente cuando hoy se pierde el cambio sin que nadie se entere.

Se conserva `configPendiente`, la marca que impide que un mensaje de realtime pise la
config que se está escribiendo en ese momento.

---

## Sección 5 · Pruebas y aplicación

### Pruebas

Las aserciones nuevas van a un archivo propio, `supabase/pruebas/ventas.sql`, para que
la suite de cuentas siga siendo sobre cuentas. Valen lo mismo que la existente: **se
prueban por mutación, no por lectura**. Una
aserción que no se pone roja al quitar la protección que dice cubrir no cuenta.

Protecciones que deben quedar cubiertas, cada una con su mutación:

1. Vender en una rifa ajena falla con `42501`.
2. Vender un número fuera de rango falla con `22003`.
3. Vender un número ya vendido falla con `23505`.
4. Una venta que falla a mitad no deja números sin comprador (la transacción revierte).
5. Bajar el total por debajo de lo vendido falla con `RIF01`.
6. Bajar el total por encima de lo vendido se permite.
7. `insert` directo sobre `numeros` desde `authenticated` está denegado.

El script de mutación debe reventar si una mutación no encuentra su cadena de búsqueda.
Ya pasó una vez: una mutación quedó inerte al cambiar el código y la suite pasó en
verde por la razón equivocada.

Del lado del cliente, los tests son Vitest de lógica pura. No hay jsdom ni
`@testing-library/react`: lo que necesite prueba se extrae a una función pura, como se
hizo con `pantalla()` y con el cursor de la paginación.

### Aplicación

Las migraciones entran sobre una base **con ventas vivas**. Por lo tanto:

- Cada migración se aplica dentro de `begin`/`commit`, con `lock_timeout` corto, para
  que una transacción trabada no encole las ventas del sitio detrás suyo.
- Antes de aplicar, se ensaya con `rollback` y se comprueba el resultado.
- El `revoke insert` es el paso sensible: si el cliente nuevo no está desplegado, un
  cliente viejo que intente vender va a fallar. **El código del cliente se despliega
  antes del `revoke`**, o los dos a la vez.
- Nada de este trabajo borra datos. La única operación destructiva del sistema —el
  `delete` al bajar el total— es justamente la que se elimina.

---

## Restricciones globales

- Identificadores, texto de interfaz y comentarios en **español**. Los comentarios
  explican el **porqué**, nunca el qué.
- `tsconfig.json` tiene `noUnusedLocals: true`.
- La app corre en «modo local» cuando `nube === null`; todo lo que toque la nube debe
  degradar limpio.
- Tests de cliente: Vitest de lógica pura, sin jsdom ni renderizado de componentes.
- Roles válidos: `superadmin` y `admin`.
- **Nunca `git commit` ni `git add`.** El usuario lleva su historial a mano.
- La base tiene sorteos en curso con dinero real: ningún ensayo termina en `commit`.

## Fuera de alcance

- El modo local y su lógica pura.
- La lectura pública del tablero.
- El sistema de cuentas, terminado en el trabajo anterior.
- Cualquier funcionamiento sin conexión, aunque la app instale una PWA.
