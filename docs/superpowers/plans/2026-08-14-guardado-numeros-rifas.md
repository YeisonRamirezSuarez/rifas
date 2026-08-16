# Guardado de números y rifas — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development
> (recomendada) o superpowers:executing-plans para ejecutar tarea por tarea. Los pasos
> usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** que un número no pueda quedar vendido sin comprador, que bajar el total no
borre ventas, y que un guardado fallido deje de ser invisible.

**Arquitectura:** la venta se muda a un RPC de Postgres que hace las dos escrituras en
una transacción, y se le quita a los clientes el `insert` directo sobre `numeros` y
`compradores`. Un trigger sobre `rifas` impide bajar `totalNumeros` por debajo de lo
vendido, lo que elimina del cliente el `delete` que hoy borra ventas. El guardado de
config expone su estado en pantalla.

**Stack:** React 18 + TypeScript + Vite, Vitest (solo lógica pura), Supabase
(Postgres 17.6, RLS, Realtime, PostgREST).

**Spec:** `docs/superpowers/specs/2026-08-14-guardado-numeros-rifas-design.md`

## Restricciones globales

- **NUNCA `git commit` ni `git add`.** Regla absoluta del usuario. Este plan **no tiene
  pasos de commit** a propósito: la plantilla de la skill los pide y se omiten. Todo
  queda en el árbol de trabajo.
- La base tiene **sorteos en curso con dinero real**. Ningún ensayo termina en `commit`:
  se prueba dentro de `begin`…`rollback`.
- Identificadores, texto de interfaz y comentarios en **español**. Los comentarios
  explican el **porqué**, nunca el qué.
- `tsconfig.json` tiene `noUnusedLocals: true`: una variable sin usar rompe el build.
- Modo local: cuando `nube === null` la app funciona en memoria. Todo lo que toque la
  nube debe degradar limpio.
- Tests de cliente: Vitest de lógica pura. **No hay jsdom ni `@testing-library/react`**:
  no se pueden renderizar componentes en test. Lo que necesite prueba se extrae a una
  función pura.
- El tablero es de base cero: los números van de `0` a `totalNumeros - 1`.
- `rifas.config` es de tipo `json`, no `jsonb`: hay que castear para operar.

## Verificación al terminar cada tarea

`npx tsc --noEmit` limpio, `npm test` verde (línea base **40** tests), `npm run build`
correcto. Las tareas de base además corren su ensayo con `rollback`.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/20260814000000_venta_atomica.sql` | RPC `vender_numeros` |
| `supabase/migrations/20260814000100_candado_total.sql` | Trigger que impide bajar el total |
| `supabase/migrations/20260814000200_cerrar_escritura_directa.sql` | `revoke insert`; va **última** |
| `supabase/pruebas/ventas.sql` | Suite de humo de venta y candado |
| `src/ventas.ts` | Traducción pura de los errores de venta |
| `src/ventas.test.ts` | Sus tests |
| `src/useRifa.ts` | `vender` por RPC; estado de guardado; se le quita el `delete` |
| `src/components/PanelConfig.tsx` | Indicador de guardado y botón de reintento |
| `src/styles.css` | Estilos del indicador |

**Orden obligatorio:** la Task 7 (`revoke insert`) va después de las tareas de cliente.
Si se aplica antes, un cliente todavía sin desplegar deja de poder vender.

---

### Task 1: El RPC de venta atómica

**Files:**
- Create: `supabase/migrations/20260814000000_venta_atomica.sql`

**Interfaces:**
- Consume: `numeros`, `compradores`, `rifas`, y los ayudantes `es_mia(uuid)` y
  `esta_aprobado()` de `20260811010000_roles.sql`.
- Produce: `public.vender_numeros(uuid, int[], text, text, text) returns setof numeros`,
  que consume la Task 5 desde el cliente vía
  `nube.rpc('vender_numeros', { p_rifa, p_numeros, p_nombre, p_telefono, p_pago })`.

- [ ] **Paso 1: Escribir la migración**

Crear `supabase/migrations/20260814000000_venta_atomica.sql`:

```sql
-- La venta, en una sola transacción.
--
-- Antes eran dos escrituras desde el navegador —primero `numeros`, después
-- `compradores`— con un borrado manual si la segunda fallaba. Ese deshacer solo corre
-- si el navegador sigue vivo: cerrando la pestaña o cortándose la red entre las dos,
-- el número quedaba vendido sin comprador, y la clave primaria impedía revenderlo.

create or replace function public.vender_numeros(
  p_rifa     uuid,
  p_numeros  int[],
  p_nombre   text,
  p_telefono text,
  p_pago     text default 'pendiente'
) returns setof numeros
language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_max   int;
  v_min   int;
begin
  -- `security definer` apaga el RLS: sin esta comprobación cualquier usuario
  -- autenticado vendería en la rifa de otro. Es la seguridad entera de la función.
  if not (es_mia(p_rifa) and esta_aprobado()) then
    raise exception 'Esta rifa no es tuya, o tu cuenta todavía no está aprobada.'
      using errcode = '42501';
  end if;

  if p_numeros is null or array_length(p_numeros, 1) is null then
    raise exception 'No hay números que vender.' using errcode = '22023';
  end if;

  if array_length(p_numeros, 1) <> (select count(distinct n) from unnest(p_numeros) n) then
    raise exception 'La lista de números trae repetidos.' using errcode = '22023';
  end if;

  -- Se valida acá y no solo con los `check` de `compradores` para que el dueño lea un
  -- mensaje y no el nombre de una constraint.
  if length(trim(coalesce(p_nombre, ''))) < 2 then
    raise exception 'El nombre del comprador necesita al menos 2 letras.'
      using errcode = '22023';
  end if;

  if coalesce(p_telefono, '') !~ '^[0-9]{7,15}$' then
    raise exception 'El teléfono debe tener entre 7 y 15 dígitos, sin espacios ni signos.'
      using errcode = '22023';
  end if;

  -- `for update` bloquea la fila de la rifa, que es la misma que bloquea el trigger
  -- que baja el total. Sin esto, una pestaña baja el total mientras otra vende por
  -- encima y ninguna de las dos comprobaciones ve a la otra.
  select coalesce((config ->> 'totalNumeros')::int, 0) into v_total
  from rifas where id = p_rifa for update;

  select min(n), max(n) into v_min, v_max from unnest(p_numeros) n;

  -- El tablero va de 0 a total-1, por eso `>=` y no `>`.
  if v_min < 0 or v_max >= v_total then
    raise exception 'Los números de esta rifa van del 0 al %; llegó el %.', v_total - 1, v_max
      using errcode = '22003';
  end if;

  -- Un insert por sentencia: o entran todas las filas o no entra ninguna. El choque de
  -- clave primaria sale como 23505 y significa que alguien lo vendió primero.
  insert into numeros (rifa_id, numero, pago)
  select p_rifa, n, p_pago from unnest(p_numeros) n;

  insert into compradores (rifa_id, numero, nombre, telefono)
  select p_rifa, n, trim(p_nombre), p_telefono from unnest(p_numeros) n;

  return query
    select * from numeros where rifa_id = p_rifa and numero = any(p_numeros);
end $$;

revoke all on function public.vender_numeros(uuid, int[], text, text, text) from public, anon;
grant execute on function public.vender_numeros(uuid, int[], text, text, text) to authenticated;
```

- [ ] **Paso 2: Ensayar contra la base, con rollback**

Correr, adaptando el script de ensayo existente:

```
node <scratchpad>/aplicar.mjs 20260814000000_venta_atomica.sql --probar
```

Esperado: `PROBADA OK (revertida)`. Si falla, el error sale con su posición.

- [ ] **Paso 3: Probar los caminos, siempre dentro de `begin`…`rollback`**

Con la migración aplicada dentro de la transacción, y `set local role authenticated` +
`request.jwt.claims` del dueño de una rifa de prueba, comprobar uno por uno:

| Caso | Esperado |
|---|---|
| Venta normal de dos números | Devuelve 2 filas; `compradores` tiene 2 |
| El mismo número otra vez | Falla con `23505` |
| Número `>= totalNumeros` | Falla con `22003` |
| Lote con repetidos | Falla con `22023` |
| Nombre de 1 letra | Falla con `22023` |
| Teléfono con letras | Falla con `22023` |
| Como otro usuario | Falla con `42501` |

Anotar en el reporte el código devuelto en cada caso: son los que consume la Task 4.

---

### Task 2: El candado del total

**Files:**
- Create: `supabase/migrations/20260814000100_candado_total.sql`

**Interfaces:**
- Consume: `rifas`, `numeros`.
- Produce: el trigger `al_bajar_total` y el código de error `RIF01`, que la Task 4
  consume desde el cliente.

- [ ] **Paso 1: Escribir la migración**

Crear `supabase/migrations/20260814000100_candado_total.sql`:

```sql
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
```

- [ ] **Paso 2: Ensayar con rollback**

```
node <scratchpad>/aplicar.mjs 20260814000100_candado_total.sql --probar
```

- [ ] **Paso 3: Probar los tres casos dentro de `begin`…`rollback`**

Con las dos migraciones aplicadas en la transacción, sobre una rifa de prueba con
números vendidos hasta el 78 y `totalNumeros` en 100:

| Caso | Esperado |
|---|---|
| Bajar a 50 | Falla con `RIF01` y el mensaje nombra el 78 |
| Bajar a 79 | Pasa: el 78 sigue dentro |
| Subir a 200 | Pasa, sin consultar `numeros` |
| Cambiar solo el título | Pasa |
| Bajar el total de una rifa sin ventas | Pasa |

---

### Task 3: La suite de pruebas de venta

**Files:**
- Create: `supabase/pruebas/ventas.sql`

**Interfaces:**
- Consume: `vender_numeros` (Task 1) y `al_bajar_total` (Task 2).

Sigue el patrón de `supabase/pruebas/cuentas.sql`: abre con `begin`, arma usuarios de
utilería insertando en `auth.users` (el trigger de alta les crea el perfil), corre las
aserciones dentro de un bloque `do $$`, termina en `rollback`.

- [ ] **Paso 1: Leer la suite existente**

Leer `supabase/pruebas/cuentas.sql` entero antes de escribir. Copiar su forma: cada
bloque que espera una excepción comprueba **también el código o el mensaje** de la
protección concreta, porque un `when others` que se conforma con cualquier excepción
tapa el caso en que la protección correcta está rota y otra revienta por casualidad.

- [ ] **Paso 2: Escribir las aserciones**

Siete, una por protección:

1. Vender en una rifa ajena falla con `42501`.
2. Vender un número fuera de rango falla con `22003`.
3. Vender un número ya vendido falla con `23505`.
4. Una venta que falla a mitad no deja números sin comprador: forzar el fallo con un
   teléfono inválido y comprobar después que `numeros` no tiene la fila.
5. Bajar el total por debajo de lo vendido falla con `RIF01`.
6. Bajar el total por encima de lo vendido se permite (control positivo: sin esto, un
   candado que bloquea siempre pasaría la prueba).
7. Una venta correcta deja tantas filas en `compradores` como en `numeros`.

Terminar con `raise notice 'Todas las pruebas de venta pasaron.';`.

- [ ] **Paso 3: Probar por mutación**

Una suite verde no prueba nada. Adaptar el script de mutación existente y comprobar que
cada protección, al desactivarse, pone la suite **roja señalando la correcta**:

| Mutación | Debe poner roja |
|---|---|
| Quitar la comprobación `es_mia … esta_aprobado` del RPC | Aserción 1 |
| Quitar la validación de rango | Aserción 2 |
| Quitar la validación de teléfono | Aserción 4 |
| Quitar el `raise` del trigger | Aserción 5 |
| Ninguna (control) | Verde |

**El script de mutación debe reventar si una mutación no encuentra su cadena de
búsqueda.** Ya pasó una vez en este repo: una mutación quedó inerte al cambiar el
código y la suite pasó en verde por la razón equivocada.

---

### Task 4: La traducción de errores, en funciones puras

**Files:**
- Create: `src/ventas.ts`
- Test: `src/ventas.test.ts`

**Interfaces:**
- Produce: `mensajeVenta(codigo: string | undefined, mensaje: string, cantidad: number): string`,
  que consume la Task 5.

- [ ] **Paso 1: Escribir el test que falla**

Crear `src/ventas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mensajeVenta } from './ventas';

describe('mensajeVenta', () => {
  it('distingue un número vendido de varios', () => {
    expect(mensajeVenta('23505', 'duplicate key', 1)).toBe('Ese número ya está vendido.');
    expect(mensajeVenta('23505', 'duplicate key', 3)).toBe(
      'Alguno de esos números ya está vendido.',
    );
  });

  it('no muestra el mensaje crudo de Postgres cuando la rifa no es tuya', () => {
    const m = mensajeVenta('42501', 'permission denied for function vender_numeros', 1);
    expect(m).not.toContain('permission denied');
    expect(m).toContain('no es tuya');
  });

  it('deja pasar tal cual los mensajes que la base redacta para el dueño', () => {
    const rango = 'Los números de esta rifa van del 0 al 99; llegó el 120.';
    expect(mensajeVenta('22003', rango, 1)).toBe(rango);
    const total = 'No se puede bajar a 50: hay números vendidos hasta el 78.';
    expect(mensajeVenta('RIF01', total, 1)).toBe(total);
  });

  it('ante un código desconocido muestra el mensaje en vez de tragárselo', () => {
    expect(mensajeVenta('08006', 'connection failure', 1)).toBe('connection failure');
    expect(mensajeVenta(undefined, 'algo raro', 1)).toBe('algo raro');
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

`npx vitest run src/ventas.test.ts` — falla con «Cannot find module './ventas'».

- [ ] **Paso 3: Escribir el módulo**

Crear `src/ventas.ts`:

```ts
/**
 * Traducción de los errores de `vender_numeros`.
 *
 * Se rama por el **código** de Postgres y nunca por el texto del mensaje: un mensaje se
 * reescribe cualquier día y la rama se rompería en silencio.
 */
export function mensajeVenta(
  codigo: string | undefined,
  mensaje: string,
  cantidad: number,
): string {
  switch (codigo) {
    // Choque de clave primaria: alguien lo vendió primero.
    case '23505':
      return cantidad > 1
        ? 'Alguno de esos números ya está vendido.'
        : 'Ese número ya está vendido.';
    // La base dice "permission denied for function", que no le sirve a nadie.
    case '42501':
      return 'Esta rifa no es tuya, o tu cuenta todavía no está aprobada.';
    // El resto ya viene redactado para el dueño: pasa tal cual. Incluye 22003 (fuera de
    // rango), 22023 (lote o comprador inválidos) y RIF01 (el candado del total).
    default:
      return mensaje;
  }
}
```

- [ ] **Paso 4: Correr los tests**

`npm test` — 44 tests en verde (40 de línea base + 4 nuevos).

---

### Task 5: La venta del cliente pasa por el RPC

**Files:**
- Modify: `src/useRifa.ts` (la función `vender`, hoy alrededor de la línea 339)

**Interfaces:**
- Consume: `vender_numeros` (Task 1) y `mensajeVenta` (Task 4).

- [ ] **Paso 1: Añadir el import**

En el bloque de imports de `src/useRifa.ts`, después del import de `./sesion`:

```ts
import { mensajeVenta } from './ventas';
```

- [ ] **Paso 2: Reemplazar el cuerpo de `vender`**

Sustituir la función `vender` entera por:

```ts
  const vender = useCallback(
    async (numeros: number[], comprador: string, telefono: string, pago: Pago = 'pendiente') => {
      try {
        const lote = [...new Set(numeros)];
        const siguiente = venderPuro(estado, lote, comprador, telefono, pago); // valida el lote entero
        if (!nube) {
          ponerEstado(actual, siguiente);
          return null;
        }
        // Una sola llamada: la base inserta el número y su comprador en la misma
        // transacción. Antes eran dos escrituras con un deshacer manual que solo corría
        // si el navegador seguía vivo.
        const { data, error } = await nube.rpc('vender_numeros', {
          p_rifa: actual,
          p_numeros: lote,
          p_nombre: comprador,
          p_telefono: telefono,
          p_pago: pago,
        });
        if (error) return mensajeVenta(error.code, error.message, lote.length);
        // Pintar acá y no esperar el realtime: si ese mensaje se pierde, la venta entró
        // pero el dueño no la ve y puede intentar venderla otra vez. La hora sí la manda
        // la base, que es la autoridad sobre cuándo se vendió.
        const filas = (data ?? []) as { numero: number; vendido_en: string }[];
        const tickets = { ...siguiente.tickets };
        for (const f of filas) {
          const t = tickets[f.numero];
          if (t) tickets[f.numero] = { ...t, vendidoEn: f.vendido_en };
        }
        ponerEstado(actual, { ...siguiente, tickets });
        return null;
      } catch (e) {
        return mensaje(e);
      }
    },
    [estado, actual, ponerEstado],
  );
```

- [ ] **Paso 3: Verificar**

`npx tsc --noEmit` limpio, `npm test` 44 verdes, `npm run build` correcto.

Comprobar a mano que ya no quedan referencias al camino viejo:

```
grep -n "deshacer venta a medias" src/useRifa.ts
```

Esperado: sin resultados.

---

### Task 6: El guardado que habla

**Files:**
- Modify: `src/useRifa.ts` (la función `configurar`, hoy alrededor de la línea 416)
- Modify: `src/components/PanelConfig.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produce: `guardado: EstadoGuardado`, `errorGuardado: string | null` y
  `reintentarGuardado: () => Promise<void>` en lo que devuelve `useRifa`, que
  `App.tsx` pasa a `PanelConfig`.

- [ ] **Paso 1: El estado en `useRifa`**

Junto a los otros `useState` del hook, añadir:

```ts
  const [guardado, setGuardado] = useState<EstadoGuardado>('quieto');
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  // Lo último que se intentó guardar, para poder reintentarlo sin que el dueño
  // tenga que volver a teclear.
  const ultimaConfig = useRef<{ id: string; config: Config } | null>(null);
```

Y el tipo, exportado, cerca del principio del archivo:

```ts
/** Qué mostrarle al dueño sobre su último guardado de configuración. */
export type EstadoGuardado = 'quieto' | 'guardando' | 'guardado' | 'fallo';
```

- [ ] **Paso 2: Reemplazar el cierre de `configurar`**

Sustituir el bloque del temporizador por:

```ts
      configPendiente.current = true;
      ultimaConfig.current = { id, config: siguiente.config };
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(async () => {
        setGuardado('guardando');
        const err = await subirConfig(id, siguiente.config);
        configPendiente.current = false;
        setErrorGuardado(err);
        setGuardado(err ? 'fallo' : 'guardado');
      }, 600);
```

**Se elimina la línea del `delete`**, la que hoy corre
`nube!.from('numeros').delete().eq('rifa_id', id).gte('numero', siguiente.config.totalNumeros)`.
El trigger de la Task 2 ya impide llegar al estado que esa línea limpiaba, y mientras
exista sigue borrando ventas.

- [ ] **Paso 3: El reintento**

```ts
  const reintentarGuardado = useCallback(async () => {
    const pendiente = ultimaConfig.current;
    if (!pendiente) return;
    setGuardado('guardando');
    const err = await subirConfig(pendiente.id, pendiente.config);
    setErrorGuardado(err);
    setGuardado(err ? 'fallo' : 'guardado');
  }, [subirConfig]);
```

Añadir `guardado`, `errorGuardado` y `reintentarGuardado` a lo que el hook devuelve.

- [ ] **Paso 4: El indicador en `PanelConfig`**

Importar el tipo, junto a los otros imports del archivo:

```ts
import type { EstadoGuardado } from '../useRifa';
```

Añadir a `Props`:

```ts
  guardado: EstadoGuardado;
  errorGuardado: string | null;
  reintentarGuardado: () => Promise<void>;
```

Y renderizarlo justo después de `</nav>`, antes de la primera sección:

```tsx
      <p className="panel__guardado" role="status" aria-live="polite">
        {guardado === 'guardando' && 'Guardando…'}
        {guardado === 'guardado' && 'Guardado.'}
        {guardado === 'fallo' && (
          <>
            <span className="panel__guardado--mal">
              No se pudo guardar{errorGuardado ? `: ${errorGuardado}` : '.'}
            </span>{' '}
            <button type="button" className="boton" onClick={reintentarGuardado}>
              Reintentar
            </button>
          </>
        )}
      </p>
```

Si falla, **no se toca lo que el dueño escribió**: el texto queda en pantalla tal como
lo tecleó. Revertir a lo último guardado sería quitarle el trabajo por un corte de red.

- [ ] **Paso 5: Pasar las props desde `App.tsx`**

En los sitios donde se monta `<PanelConfig …>`, añadir las tres props tomándolas de
`rifa`. `noUnusedLocals` no lo señala, pero TypeScript sí se queja de props faltantes.

- [ ] **Paso 6: Los estilos**

En `src/styles.css`, junto al resto de `.panel__` (hoy alrededor de la línea 1306,
donde está `.panel__nota`), añadir `.panel__guardado` —texto pequeño y discreto, del
mismo tamaño que `.panel__nota`— y `.panel__guardado--mal`, en el color de error que ya
usa la hoja. Reutilizar las variables existentes; no introducir colores nuevos.

El botón de reintentar usa `className="boton"`, que ya existe. **No inventar
`boton--texto` ni variantes nuevas**: la hoja solo define `boton`, `boton--primario` y
`boton--peligro`.

- [ ] **Paso 7: Verificar**

`npx tsc --noEmit` limpio, `npm test` 44 verdes, `npm run build` correcto. Y comprobar
que el `delete` se fue:

```
grep -n "gte('numero'" src/useRifa.ts
```

Esperado: sin resultados.

---

### Task 7: Cerrar la escritura directa

**Va última.** Si se aplica antes que las tareas de cliente, un cliente todavía sin
desplegar deja de poder vender.

**Files:**
- Create: `supabase/migrations/20260814000200_cerrar_escritura_directa.sql`

- [ ] **Paso 1: Escribir la migración**

```sql
-- La venta solo entra por `vender_numeros`.
--
-- Hasta acá, `anon` y `authenticated` tenían `insert` sobre las dos tablas y lo único
-- que los frenaba era el RLS (es el default de Supabase). Quitando el `insert`, la
-- venta a medias deja de ser improbable y pasa a ser imposible: no queda ningún camino
-- que meta un número sin su comprador.
--
-- Se conservan `update` (marcar el pago) y `delete` (liberar un número): las dos son
-- atómicas de por sí, y el `delete` cascadea al comprador, que es lo correcto.

revoke insert on numeros from anon, authenticated;
revoke insert on compradores from anon, authenticated;
```

- [ ] **Paso 2: Ensayar con rollback y comprobar los dos lados**

Dentro de `begin`…`rollback`, con las tres migraciones aplicadas y el rol del dueño:

| Caso | Esperado |
|---|---|
| `insert into numeros …` directo | Denegado por permisos |
| `insert into compradores …` directo | Denegado por permisos |
| `vender_numeros(…)` | Funciona |
| `update numeros set pago = …` | Funciona |
| `delete from numeros where …` | Funciona |

- [ ] **Paso 3: Correr la suite entera**

`supabase/pruebas/ventas.sql` y `supabase/pruebas/cuentas.sql`, las dos dentro de su
`rollback`. Las dos tienen que terminar en su `notice` de «todas pasaron».

---

## Aplicación a producción

**No la hace el ejecutor del plan.** Al terminar las siete tareas, avisar al usuario y
esperar su decisión, igual que se hizo con las migraciones del sistema de cuentas.

Cuando lo autorice: las tres en orden de nombre, cada una dentro de `begin`/`commit`
con `lock_timeout` corto, verificando los datos entre cada una. La 200 solo después de
que el cliente nuevo esté desplegado.
