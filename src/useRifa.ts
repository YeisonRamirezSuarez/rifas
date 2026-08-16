import { useCallback, useEffect, useRef, useState } from 'react';
import { nube } from './nube';
import { veniaDeRecuperacion } from './sesion';
import { mensajeVenta } from './ventas';
import {
  CONFIG_INICIAL,
  ESTADO_INICIAL,
  finalizar as finalizarPuro,
  guardarConfig,
  liberar as liberarPuro,
  marcarPago as marcarPagoPuro,
  reabrir as reabrirPuro,
  slugificar,
  venderVarios as venderPuro,
  type Config,
  type Estado,
  type Pago,
  type Ticket,
} from './rifa';

const CLAVE = 'rifa:v2';
const CLAVE_VIEJA = 'rifa:v1';
// Un `localStorage` y no `sessionStorage`: la sesión del enlace también vive en
// localStorage y sobrevive a cerrar la pestaña. Con marca por pestaña, abrir la PWA
// o volver a abrir la app entraba al tablero con la contraseña vieja todavía puesta.
const MARCA_RECUPERACION = 'recuperando';

/** Una rifa en la lista del panel. */
export type ResumenRifa = { id: string; slug: string; titulo: string; premio: string };

/** Qué mostrarle al dueño sobre su último guardado de configuración. */
export type EstadoGuardado = 'quieto' | 'guardando' | 'guardado' | 'fallo';

type Almacen = { rifas: Record<string, Estado>; actual: string };

function nuevoId(): string {
  return crypto.randomUUID();
}

function normalizar(estado: Estado): Estado {
  const tickets = Object.fromEntries(
    Object.entries(estado.tickets ?? {}).map(([n, t]) => [n, { ...t, pago: t.pago ?? 'pendiente' }]),
  );
  return { config: { ...CONFIG_INICIAL, ...estado.config }, tickets };
}

function almacenNuevo(): Almacen {
  const id = nuevoId();
  return { rifas: { [id]: ESTADO_INICIAL }, actual: id };
}

/** Lee el almacén local; migra la rifa única de la versión anterior. */
function leerLocal(): Almacen {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) {
      const guardado = JSON.parse(crudo) as Almacen;
      const rifas = Object.fromEntries(
        Object.entries(guardado.rifas ?? {}).map(([id, e]) => [id, normalizar(e)]),
      );
      const ids = Object.keys(rifas);
      if (!ids.length) return almacenNuevo();
      return { rifas, actual: rifas[guardado.actual] ? guardado.actual : ids[0] };
    }
    const viejo = localStorage.getItem(CLAVE_VIEJA);
    if (viejo) {
      const id = nuevoId();
      return { rifas: { [id]: normalizar(JSON.parse(viejo) as Estado) }, actual: id };
    }
  } catch {
    /* almacén corrupto: se arranca de cero */
  }
  return almacenNuevo();
}

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : 'Error desconocido';
}

/** Slug de la rifa que se está viendo, si el link trae uno. */
function slugDelLink(): string | null {
  return new URLSearchParams(location.search).get('r');
}

/** Lee una rifa de la nube. Los datos del comprador solo llegan si es tuya. */
async function leerNube(rifaId: string, propia: boolean): Promise<Estado> {
  const bd = nube!;
  const [fila, vendidos, compradores] = await Promise.all([
    bd.from('rifas').select('config').eq('id', rifaId).maybeSingle(),
    bd.from('numeros').select('numero, pago, vendido_en').eq('rifa_id', rifaId),
    propia
      ? bd.from('compradores').select('numero, nombre, telefono').eq('rifa_id', rifaId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // Sin esto, una lectura fallida devolvía una rifa en blanco —título por defecto,
  // cien números, cero ventas— y la pantalla la mostraba como si fuera la de verdad.
  // El daño no era solo visual: el siguiente guardado escribía esa config vacía
  // encima de la buena.
  const fallo = fila.error ?? vendidos.error ?? compradores.error;
  if (fallo) throw new Error(fallo.message);

  const datos = new Map(
    ((compradores.data ?? []) as { numero: number; nombre: string; telefono: string }[]).map((c) => [
      c.numero,
      c,
    ]),
  );

  const tickets: Record<number, Ticket> = {};
  for (const n of (vendidos.data ?? []) as { numero: number; pago: Pago; vendido_en: string }[]) {
    const d = datos.get(n.numero);
    tickets[n.numero] = {
      numero: n.numero,
      comprador: d?.nombre ?? '',
      telefono: d?.telefono ?? '',
      pago: n.pago,
      vendidoEn: n.vendido_en,
    };
  }

  return { config: { ...CONFIG_INICIAL, ...(fila.data?.config as Config | undefined) }, tickets };
}

const resumen = (id: string, slug: string, e: Estado): ResumenRifa => ({
  id,
  slug,
  titulo: e.config.titulo,
  premio: e.config.premio,
});

/**
 * Estado de la rifa. Con VITE_SUPABASE_* hay cuentas y varias rifas por persona,
 * sincronizadas en vivo; sin ellas, todo vive en localStorage sin login.
 */
export function useRifa() {
  const [almacen, setAlmacen] = useState<Almacen>(() => (nube ? { rifas: {}, actual: '' } : leerLocal()));
  const [lista, setLista] = useState<ResumenRifa[]>([]);
  const [slugs, setSlugs] = useState<Record<string, string>>({});
  const [admin, setAdmin] = useState<string | null>(null); // id del usuario
  const [cargando, setCargando] = useState(!!nube);
  const [sesionLista, setSesionLista] = useState(!nube);
  // El evento PASSWORD_RECOVERY llega una vez y no se repite: tras canjear el hash,
  // supabase-js lo borra de la URL y en el siguiente arranque ya no hay nada que
  // delate que veníamos de un enlace de recuperación. Sin persistirlo, cerrar y
  // reabrir la pestaña (o la PWA instalada) entra a la app con la contraseña vieja
  // todavía puesta. La marca se limpia en `entrar`, `cambiarClave` y `salir` — si
  // falta en alguno de los tres, o queda encerrado sin salida (falta en `salir`),
  // o alguien que nunca cambió la clave y luego entra normal queda atrapado en
  // este formulario (falta en `entrar`).
  // Sin nube (modo local) no hay ruta de Supabase que dispare esto: sin el `!!nube`
  // una URL con `type=recovery` abriría NuevaClave y su `cambiarClave` reventaría
  // en el `nube!` del que no hay nada detrás.
  const [recuperando, setRecuperando] = useState(
    () => !!nube && veniaDeRecuperacion(location.hash, localStorage.getItem(MARCA_RECUPERACION)),
  );
  const configPendiente = useRef(false);
  const temporizador = useRef<ReturnType<typeof setTimeout>>();
  // El `clearTimeout` desduplica el agendado, no la llegada: con red lenta hay dos
  // `subirConfig` en vuelo y gana el que responde último, no el más nuevo. Sin este
  // turno, un guardado viejo que vuelve bien pisa el fallo del nuevo y la pantalla
  // dice «Guardado.» con el último cambio sin guardar.
  const secuencia = useRef(0);
  // La escritura de config que ya salió y todavía no aterriza. `clearTimeout` no la
  // alcanza: lo único que sirve contra ella es esperarla.
  const enVuelo = useRef<Promise<string | null> | null>(null);
  const [guardado, setGuardado] = useState<EstadoGuardado>('quieto');
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  // Mientras esté puesto, lo que hay en pantalla no es lo que hay en la base, así que
  // no se deja editar: guardar sobre datos que no se pudieron leer los reemplaza.
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  // Lo último que se intentó guardar, para poder reintentarlo sin que el dueño
  // tenga que volver a teclear.
  const ultimaConfig = useRef<{ id: string; config: Config } | null>(null);

  const olvidarRecuperacion = useCallback(() => {
    localStorage.removeItem(MARCA_RECUPERACION);
    setRecuperando(false);
  }, []);

  const actual = almacen.actual;
  const estado = almacen.rifas[actual] ?? ESTADO_INICIAL;
  const propia = !nube || lista.some((r) => r.id === actual);

  const ponerEstado = useCallback(
    (id: string, e: Estado) => setAlmacen((a) => ({ rifas: { ...a.rifas, [id]: e }, actual: a.actual })),
    [],
  );

  /**
   * Toca solo los tickets, y sobre el estado del momento en vez del que se leyó antes
   * de la petición. `ponerEstado` reemplaza la rifa entera: si mientras la venta iba y
   * volvía llegó por realtime un número vendido desde otro dispositivo, ese número
   * desaparecía del tablero hasta el siguiente evento.
   */
  const parchearTickets = useCallback(
    (id: string, cambio: (t: Record<number, Ticket>) => Record<number, Ticket>) =>
      setAlmacen((a) => {
        const previo = a.rifas[id];
        if (!previo) return a;
        return {
          actual: a.actual,
          rifas: { ...a.rifas, [id]: { ...previo, tickets: cambio(previo.tickets) } },
        };
      }),
    [],
  );

  // Sesión.
  useEffect(() => {
    if (!nube) return;
    nube.auth
      .getSession()
      .then(({ data }) => setAdmin(data.session?.user.id ?? null))
      // Aunque falle hay que seguir: quedarse esperando deja la app en blanco.
      .finally(() => setSesionLista(true));
    const { data } = nube.auth.onAuthStateChange((e, sesion) => {
      // El enlace del correo abre sesión por su cuenta. Sin atrapar el evento, el
      // usuario entra al tablero sin haber puesto contraseña nueva.
      if (e === 'PASSWORD_RECOVERY') {
        localStorage.setItem(MARCA_RECUPERACION, '1');
        setRecuperando(true);
      }
      setAdmin(sesion?.user.id ?? null);
      setSesionLista(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Lista de rifas propias + elección de cuál mostrar.
  useEffect(() => {
    if (!nube) return;
    let vivo = true;
    if (admin) setCargando(true);

    (async () => {
      const consulta = admin
        ? await nube!.from('rifas').select('id, slug, config').eq('dueno', admin).order('creada_en')
        : { data: [], error: null };
      if (!vivo) return;
      // Un fallo acá vaciaba la lista, y la lista vacía es justo la señal de «todavía
      // no tienes ninguna rifa»: al dueño se le decía que sus rifas no existen.
      if (consulta.error) {
        setErrorCarga(consulta.error.message);
        setCargando(false);
        return;
      }
      setErrorCarga(null);
      const propias = consulta.data ?? [];

      const mapa: Record<string, string> = {};
      const resumenes = (propias as { id: string; slug: string; config: Config }[]).map((r) => {
        mapa[r.id] = r.slug;
        return resumen(r.id, r.slug, { config: { ...CONFIG_INICIAL, ...r.config }, tickets: {} });
      });
      setLista(resumenes);
      setSlugs((s) => ({ ...s, ...mapa }));

      // Prioridad: el slug del link, luego la primera rifa propia.
      const slug = slugDelLink();
      let elegida = resumenes[0]?.id ?? '';
      if (slug) {
        const porSlug = resumenes.find((r) => r.slug === slug);
        if (porSlug) elegida = porSlug.id;
        else {
          const { data } = await nube!.from('rifas').select('id').eq('slug', slug).maybeSingle();
          if (data?.id) elegida = data.id;
        }
      }
      if (!vivo) return;
      setAlmacen((a) => ({ rifas: a.rifas, actual: elegida }));
      // Si la rifa elegida es la que ya estaba, el efecto que la carga no se
      // vuelve a disparar: hay que apagar la espera aquí o se queda colgada.
      if (!elegida || elegida === actual) setCargando(false);
    })();

    return () => {
      vivo = false;
    };
  }, [admin]);

  // Carga de la rifa activa + realtime acotado a ella.
  useEffect(() => {
    if (!nube || !actual) return;
    let vivo = true;
    const refrescar = () =>
      leerNube(actual, propia)
        .then((nuevo) => {
          if (!vivo) return;
          setErrorCarga(null);
          // No pisar la config que se está escribiendo ahora mismo.
          setAlmacen((a) => {
            const previo = a.rifas[actual];
            return {
              actual: a.actual,
              rifas: {
                ...a.rifas,
                [actual]: {
                  config: configPendiente.current && previo ? previo.config : nuevo.config,
                  tickets: nuevo.tickets,
                },
              },
            };
          });
        })
        // Dejar en pantalla lo último que sí se leyó. Antes esta promesa no tenía
        // salida de error: reventaba sin que nadie se enterara.
        .catch((e) => vivo && setErrorCarga(mensaje(e)))
        .finally(() => vivo && setCargando(false));

    refrescar();
    const bd = nube;
    const filtro = `rifa_id=eq.${actual}`;
    const canal = bd
      .channel(`rifa-${actual}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'numeros', filter: filtro }, refrescar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rifas', filter: `id=eq.${actual}` }, refrescar)
      .subscribe();

    return () => {
      vivo = false;
      bd.removeChannel(canal);
    };
  }, [actual, propia]);

  // Persistencia local solo cuando no hay nube.
  useEffect(() => {
    if (!nube) localStorage.setItem(CLAVE, JSON.stringify(almacen));
  }, [almacen]);

  const subirConfig = useCallback(async (id: string, config: Config) => {
    if (!nube) return null;
    const { error } = await nube.from('rifas').update({ config }).eq('id', id);
    return error?.message ?? null;
  }, []);

  /* ---------- rifas ---------- */

  const crearRifa = useCallback(
    async (titulo: string): Promise<string | null> => {
      const nombre = titulo.trim() || 'Nueva rifa';
      const config: Config = { ...CONFIG_INICIAL, titulo: nombre.toUpperCase() };
      if (!nube) {
        const id = nuevoId();
        setAlmacen((a) => ({ rifas: { ...a.rifas, [id]: { config, tickets: {} } }, actual: id }));
        return null;
      }
      const slug = slugificar(nombre);
      const { data, error } = await nube
        .from('rifas')
        .insert({ slug, config })
        .select('id, slug')
        .single();
      if (error) return error.message;
      setLista((l) => [...l, resumen(data.id, data.slug, { config, tickets: {} })]);
      setSlugs((s) => ({ ...s, [data.id]: data.slug }));
      setAlmacen((a) => ({ rifas: { ...a.rifas, [data.id]: { config, tickets: {} } }, actual: data.id }));
      return null;
    },
    [],
  );

  const seleccionarRifa = useCallback(
    (id: string) => {
      // Elegir la rifa que ya está activa no vuelve a disparar el efecto que la
      // carga —depende de `actual`—, y el único `setCargando(false)` vive dentro
      // de ese efecto. Sin este corte, encender la espera acá la deja girando
      // para siempre, y como la espera reemplaza al panel entero, tampoco se
      // puede editar la rifa. Mismo caso que el guardia de la línea 221.
      if (id === actual) return;
      setCargando(!!nube);
      setAlmacen((a) => ({ rifas: a.rifas, actual: id }));
    },
    [actual],
  );

  const eliminarRifa = useCallback(
    async (id: string): Promise<string | null> => {
      if (nube) {
        const { error } = await nube.from('rifas').delete().eq('id', id); // cascade borra números y compradores
        if (error) return error.message;
        setLista((l) => l.filter((r) => r.id !== id));
      }
      setAlmacen((a) => {
        const { [id]: _fuera, ...resto } = a.rifas;
        const siguiente = a.actual === id ? Object.keys(resto)[0] ?? '' : a.actual;
        return { rifas: resto, actual: siguiente };
      });
      return null;
    },
    [],
  );

  /* ---------- números ---------- */

  const vender = useCallback(
    async (numeros: number[], comprador: string, telefono: string, pago: Pago = 'pendiente') => {
      try {
        const lote = [...new Set(numeros)];
        const siguiente = venderPuro(estado, lote, comprador, telefono, pago); // valida el lote entero
        if (!nube) {
          ponerEstado(actual, siguiente);
          return null;
        }
        // El ticket ya viene normalizado (nombre recortado, teléfono solo dígitos):
        // eso es lo que debe llegar al RPC, no los valores crudos del formulario.
        const normalizado = siguiente.tickets[lote[0]];
        // Una sola llamada: la base inserta el número y su comprador en la misma
        // transacción. Antes eran dos escrituras con un deshacer manual que solo corría
        // si el navegador seguía vivo.
        const { data, error } = await nube.rpc('vender_numeros', {
          p_rifa: actual,
          p_numeros: lote,
          p_nombre: normalizado.comprador,
          p_telefono: normalizado.telefono,
          p_pago: pago,
        });
        if (error) return mensajeVenta(error.code, error.message, lote.length);
        // Pintar acá y no esperar el realtime: si ese mensaje se pierde, la venta entró
        // pero el dueño no la ve y puede intentar venderla otra vez. La hora sí la manda
        // la base, que es la autoridad sobre cuándo se vendió.
        const filas = (data ?? []) as { numero: number; vendido_en: string }[];
        const vendidos: Record<number, Ticket> = {};
        for (const f of filas) {
          const t = siguiente.tickets[f.numero];
          if (t) vendidos[f.numero] = { ...t, vendidoEn: f.vendido_en };
        }
        parchearTickets(actual, (t) => ({ ...t, ...vendidos }));
        return null;
      } catch (e) {
        return mensaje(e);
      }
    },
    [estado, actual, ponerEstado, parchearTickets],
  );

  const marcarPago = useCallback(
    async (numero: number, pago: Pago): Promise<string | null> => {
      try {
        const siguiente = marcarPagoPuro(estado, numero, pago);
        if (!nube) {
          ponerEstado(actual, siguiente);
          return null;
        }
        const { error } = await nube
          .from('numeros')
          .update({ pago })
          .eq('rifa_id', actual)
          .eq('numero', numero);
        if (error) return error.message;
        // Pintar acá y no esperar el realtime: si ese mensaje se pierde, el pago quedó
        // marcado en la base pero el dueño lo sigue viendo pendiente. Mismo motivo que en `vender`.
        parchearTickets(actual, (t) => (t[numero] ? { ...t, [numero]: { ...t[numero], pago } } : t));
        return null;
      } catch (e) {
        return mensaje(e);
      }
    },
    [estado, actual, ponerEstado, parchearTickets],
  );

  const liberar = useCallback(
    async (numero: number): Promise<string | null> => {
      const siguiente = liberarPuro(estado, numero);
      if (!nube) {
        ponerEstado(actual, siguiente);
        return null;
      }
      const { error } = await nube
        .from('numeros')
        .delete()
        .eq('rifa_id', actual)
        .eq('numero', numero); // cascade borra al comprador
      if (error) return error.message;
      // Pintar acá y no esperar el realtime: si ese mensaje se pierde, el número quedó
      // libre en la base pero el dueño lo sigue viendo vendido. Mismo motivo que en `vender`.
      parchearTickets(actual, ({ [numero]: _libre, ...resto }) => resto);
      return null;
    },
    [estado, actual, ponerEstado, parchearTickets],
  );

  /* ---------- configuración ---------- */

  /**
   * Cancela el guardado con retraso que dejó el tecleo. Toda escritura de config que
   * no venga de `configurar` tiene que llamar a esto primero: si no, el guardado
   * agendado vuelve con la config de hace 600 ms y borra lo que se acaba de hacer
   * —cerrar el sorteo, por ejemplo, con su número ganador—. El estado local sigue
   * mostrando la rifa cerrada, así que nadie se entera hasta recargar.
   */
  const cancelarGuardadoPendiente = useCallback(async () => {
    clearTimeout(temporizador.current);
    // Sube el turno para que una llamada ya en vuelo no vuelva a tocar el estado.
    secuencia.current += 1;
    configPendiente.current = false;
    // Esa llamada en vuelo ya no va a apagar el cartel: hacerlo acá. Un `'fallo'`
    // anterior se respeta, que tiene que quedarse hasta que algo se guarde bien.
    setGuardado((g) => (g === 'guardando' ? 'quieto' : g));
    // Cancelar no alcanza si la petición ya salió: aterrizaría después de la nuestra
    // y dejaría la config vieja como la última escrita.
    await enVuelo.current;
  }, []);

  /**
   * Anota el resultado del último intento de guardar config. Lo tienen que llamar
   * *todos* los caminos que escriben config, no solo el tecleo: el botón de reintentar
   * reenvía lo anotado acá, y si se queda con una config anterior al cierre del sorteo,
   * reintentar lo reabre y borra el número ganador.
   */
  const anotarGuardado = useCallback((id: string, config: Config, err: string | null) => {
    ultimaConfig.current = { id, config };
    // Mientras el guardado siga fallando el realtime no puede pisar la config local:
    // le borraría al dueño del formulario lo que escribió, dejándole el botón de
    // reintentar puesto sobre unos cambios que ya no puede ver.
    configPendiente.current = !!err;
    setErrorGuardado(err);
    setGuardado(err ? 'fallo' : 'guardado');
  }, []);

  const configurar = useCallback(
    (config: Config): void => {
      const siguiente = guardarConfig(estado, config);
      const id = actual;
      ponerEstado(id, siguiente);
      setLista((l) =>
        l.map((r) => (r.id === id ? { ...r, titulo: siguiente.config.titulo, premio: siguiente.config.premio } : r)),
      );
      if (!nube) return;
      // Se escribe mientras se teclea: se agrupa para no mandar una petición por letra.
      configPendiente.current = true;
      ultimaConfig.current = { id, config: siguiente.config };
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(async () => {
        const turno = ++secuencia.current;
        setGuardado('guardando');
        enVuelo.current = subirConfig(id, siguiente.config);
        const err = await enVuelo.current;
        if (turno !== secuencia.current) return;
        anotarGuardado(id, siguiente.config, err);
      }, 600);
    },
    [estado, actual, ponerEstado, subirConfig, anotarGuardado],
  );

  const reintentarGuardado = useCallback(async () => {
    const pendiente = ultimaConfig.current;
    if (!pendiente) return;
    const turno = ++secuencia.current;
    setGuardado('guardando');
    enVuelo.current = subirConfig(pendiente.id, pendiente.config);
    const err = await enVuelo.current;
    if (turno !== secuencia.current) return;
    anotarGuardado(pendiente.id, pendiente.config, err);
  }, [subirConfig, anotarGuardado]);

  // El cartel de «Guardado.» se apaga solo. El de fallo no: ese tiene que quedarse
  // hasta que un guardado salga bien, o el dueño se va con un cambio perdido.
  useEffect(() => {
    if (guardado !== 'guardado') return;
    const t = setTimeout(() => setGuardado('quieto'), 2000);
    return () => clearTimeout(t);
  }, [guardado]);

  const finalizar = useCallback(
    async (numeroGanador: number): Promise<string | null> => {
      try {
        const siguiente = finalizarPuro(estado, numeroGanador); // valida el rango
        await cancelarGuardadoPendiente();
        ponerEstado(actual, siguiente);
        const err = await subirConfig(actual, siguiente.config);
        anotarGuardado(actual, siguiente.config, err);
        return err;
      } catch (e) {
        return mensaje(e);
      }
    },
    [estado, actual, ponerEstado, subirConfig, cancelarGuardadoPendiente, anotarGuardado],
  );

  const reabrir = useCallback(async (): Promise<string | null> => {
    const siguiente = reabrirPuro(estado);
    await cancelarGuardadoPendiente();
    ponerEstado(actual, siguiente);
    const err = await subirConfig(actual, siguiente.config);
    anotarGuardado(actual, siguiente.config, err);
    return err;
  }, [estado, actual, ponerEstado, subirConfig, cancelarGuardadoPendiente, anotarGuardado]);

  /**
   * Vacía el tablero y empieza de nuevo con la misma configuración. Reabre a
   * propósito: si se vacía un sorteo cerrado y el cierre se queda puesto, la
   * rifa muestra un ganador cuyo puesto ya no existe.
   */
  const vaciarTablero = useCallback(async (): Promise<string | null> => {
    const siguiente = reabrirPuro({ ...estado, tickets: {} });
    await cancelarGuardadoPendiente();
    if (!nube) {
      ponerEstado(actual, siguiente);
      return null;
    }
    const { error } = await nube.from('numeros').delete().eq('rifa_id', actual);
    if (error) return error.message;
    ponerEstado(actual, siguiente);
    const err = await subirConfig(actual, siguiente.config);
    anotarGuardado(actual, siguiente.config, err);
    return err;
  }, [estado, actual, ponerEstado, subirConfig, cancelarGuardadoPendiente, anotarGuardado]);

  /* ---------- cuenta ---------- */

  const entrar = useCallback(async (email: string, clave: string): Promise<string | null> => {
    const { error } = await nube!.auth.signInWithPassword({ email, password: clave });
    if (!error) {
      // Entró con su contraseña de siempre: si había pedido un enlace y no lo usó,
      // la marca se quedaría puesta y lo atraparía en "Pon tu contraseña nueva"
      // sin venir de ningún enlace.
      olvidarRecuperacion();
      return null;
    }
    // Solo la clave mala se traduce. Lo demás (proveedor de correo apagado en
    // Supabase, límite de intentos, correo sin confirmar) se muestra tal cual:
    // taparlo todo con "contraseña incorrecta" manda a buscar donde no es.
    return error.code === 'invalid_credentials'
      ? 'Correo o contraseña incorrectos.'
      : `No se pudo entrar: ${error.message}`;
  }, [olvidarRecuperacion]);

  const recuperarClave = useCallback(async (email: string): Promise<string | null> => {
    const { error } = await nube!.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}${location.pathname}`,
    });
    return error ? error.message : null;
  }, []);

  const cambiarClave = useCallback(async (nueva: string): Promise<string | null> => {
    const { error } = await nube!.auth.updateUser({ password: nueva });
    if (error) return error.message;
    olvidarRecuperacion();
    return null;
  }, [olvidarRecuperacion]);

  const registrarse = useCallback(
    async (email: string, clave: string, nombre: string): Promise<string | null> => {
      const { data, error } = await nube!.auth.signUp({
        email,
        password: clave,
        options: { data: { nombre } },
      });
      if (error) return error.message;
      // Supabase no delata qué correos existen: si ya hay cuenta responde bien,
      // pero sin identidades. Sin esto se culpaba a la confirmación de correo.
      if (data.user && data.user.identities?.length === 0)
        return 'Ya existe una cuenta con ese correo. Entra con tu contraseña o recupérala.';
      // Sin sesión = el proyecto todavía tiene *Confirm email* activo en Supabase.
      // Con esa opción puesta no hay token, y sin token no sale el correo de
      // Brevo ni se registra la solicitud: hay que apagarla en el panel.
      return data.session
        ? null
        : 'Cuenta creada, pero falta confirmar el correo desde el mensaje de Supabase. Avísale al administrador para desactivar esa confirmación.';
    },
    [],
  );

  const salir = useCallback(async () => {
    // Antes del signOut: si esa llamada lanza, igual queda una salida y no atrapado
    // en "Pon tu contraseña nueva" sin sesión con la que reenviarla.
    olvidarRecuperacion();
    await nube!.auth.signOut();
    setLista([]);
    setAlmacen({ rifas: {}, actual: '' });
  }, [olvidarRecuperacion]);

  const linkPublico = useCallback(
    (id: string): string => `${location.origin}${location.pathname}?r=${slugs[id] ?? ''}`,
    [slugs],
  );

  return {
    estado,
    cargando: cargando || !sesionLista,
    // Con la carga fallada lo de la pantalla no es lo que hay en la base: editar
    // encima de eso guarda una rifa vacía sobre la buena.
    puedeEditar: !nube || (!!admin && propia && !errorCarga),
    hayNube: !!nube,
    haySesion: !nube || !!admin,
    usuarioId: admin,
    rifas: nube ? lista : Object.entries(almacen.rifas).map(([id, e]) => resumen(id, '', e)),
    rifaActual: actual,
    errorCarga,
    // Con la lista sin traer, «no tienes ninguna rifa» es mentira, no un dato.
    sinRifas: !!nube && !!admin && lista.length === 0 && !errorCarga,
    linkPublico,
    crearRifa,
    seleccionarRifa,
    eliminarRifa,
    vender,
    marcarPago,
    liberar,
    configurar,
    guardado,
    errorGuardado,
    reintentarGuardado,
    finalizar,
    reabrir,
    vaciarTablero,
    entrar,
    recuperarClave,
    registrarse,
    salir,
    recuperando,
    cambiarClave,
  };
}
