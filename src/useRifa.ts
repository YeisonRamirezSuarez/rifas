import { useCallback, useEffect, useRef, useState } from 'react';
import { nube } from './nube';
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

/** Una rifa en la lista del panel. */
export type ResumenRifa = { id: string; slug: string; titulo: string; premio: string };

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
      : Promise.resolve({ data: [] }),
  ]);

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
  const configPendiente = useRef(false);
  const temporizador = useRef<ReturnType<typeof setTimeout>>();

  const actual = almacen.actual;
  const estado = almacen.rifas[actual] ?? ESTADO_INICIAL;
  const propia = !nube || lista.some((r) => r.id === actual);

  const ponerEstado = useCallback(
    (id: string, e: Estado) => setAlmacen((a) => ({ rifas: { ...a.rifas, [id]: e }, actual: a.actual })),
    [],
  );

  // Sesión.
  useEffect(() => {
    if (!nube) return;
    nube.auth.getSession().then(({ data }) => setAdmin(data.session?.user.id ?? null));
    const { data } = nube.auth.onAuthStateChange((_e, sesion) => setAdmin(sesion?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  // Lista de rifas propias + elección de cuál mostrar.
  useEffect(() => {
    if (!nube) return;
    let vivo = true;

    (async () => {
      const propias = admin
        ? ((
            await nube!.from('rifas').select('id, slug, config').eq('dueno', admin).order('creada_en')
          ).data ?? [])
        : [];
      if (!vivo) return;

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
      if (!elegida) setCargando(false);
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

  const seleccionarRifa = useCallback((id: string) => {
    setCargando(!!nube);
    setAlmacen((a) => ({ rifas: a.rifas, actual: id }));
  }, []);

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
        const t = siguiente.tickets[lote[0]];
        // Un solo insert con todas las filas: en Postgres es una sentencia, así que
        // o entran todos los números o no entra ninguno.
        const { error } = await nube
          .from('numeros')
          .insert(lote.map((numero) => ({ rifa_id: actual, numero, pago })));
        // 23505 = choque de primary key: alguien más lo vendió primero.
        if (error) {
          return error.code === '23505'
            ? lote.length > 1
              ? 'Alguno de esos números ya está vendido.'
              : 'Ese número ya está vendido.'
            : error.message;
        }
        const dato = await nube
          .from('compradores')
          .insert(lote.map((numero) => ({ rifa_id: actual, numero, nombre: t.comprador, telefono: t.telefono })));
        if (dato.error) {
          await nube.from('numeros').delete().eq('rifa_id', actual).in('numero', lote); // deshacer venta a medias
          return dato.error.message;
        }
        return null;
      } catch (e) {
        return mensaje(e);
      }
    },
    [estado, actual, ponerEstado],
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
        return error?.message ?? null;
      } catch (e) {
        return mensaje(e);
      }
    },
    [estado, actual, ponerEstado],
  );

  const liberar = useCallback(
    async (numero: number): Promise<string | null> => {
      if (!nube) {
        ponerEstado(actual, liberarPuro(estado, numero));
        return null;
      }
      const { error } = await nube
        .from('numeros')
        .delete()
        .eq('rifa_id', actual)
        .eq('numero', numero); // cascade borra al comprador
      return error?.message ?? null;
    },
    [estado, actual, ponerEstado],
  );

  /* ---------- configuración ---------- */

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
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(async () => {
        await subirConfig(id, siguiente.config);
        // El tablero va de 0 a total-1, por eso gte y no gt.
        await nube!.from('numeros').delete().eq('rifa_id', id).gte('numero', siguiente.config.totalNumeros);
        configPendiente.current = false;
      }, 600);
    },
    [estado, actual, ponerEstado, subirConfig],
  );

  const finalizar = useCallback(
    async (numeroGanador: number): Promise<string | null> => {
      try {
        const siguiente = finalizarPuro(estado, numeroGanador); // valida el rango
        ponerEstado(actual, siguiente);
        return await subirConfig(actual, siguiente.config);
      } catch (e) {
        return mensaje(e);
      }
    },
    [estado, actual, ponerEstado, subirConfig],
  );

  const reabrir = useCallback(async (): Promise<string | null> => {
    const siguiente = reabrirPuro(estado);
    ponerEstado(actual, siguiente);
    return subirConfig(actual, siguiente.config);
  }, [estado, actual, ponerEstado, subirConfig]);

  /**
   * Vacía el tablero y empieza de nuevo con la misma configuración. Reabre a
   * propósito: si se vacía un sorteo cerrado y el cierre se queda puesto, la
   * rifa muestra un ganador cuyo puesto ya no existe.
   */
  const vaciarTablero = useCallback(async (): Promise<string | null> => {
    const siguiente = reabrirPuro({ ...estado, tickets: {} });
    if (!nube) {
      ponerEstado(actual, siguiente);
      return null;
    }
    const { error } = await nube.from('numeros').delete().eq('rifa_id', actual);
    if (error) return error.message;
    ponerEstado(actual, siguiente);
    return subirConfig(actual, siguiente.config);
  }, [estado, actual, ponerEstado, subirConfig]);

  /* ---------- cuenta ---------- */

  const entrar = useCallback(async (email: string, clave: string): Promise<string | null> => {
    const { error } = await nube!.auth.signInWithPassword({ email, password: clave });
    return error ? 'Correo o contraseña incorrectos.' : null;
  }, []);

  const registrarse = useCallback(
    async (email: string, clave: string, nombre: string): Promise<string | null> => {
      const { data, error } = await nube!.auth.signUp({
        email,
        password: clave,
        options: { data: { nombre } },
      });
      if (error) return error.message;
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
    await nube!.auth.signOut();
    setLista([]);
    setAlmacen({ rifas: {}, actual: '' });
  }, []);

  const linkPublico = useCallback(
    (id: string): string => `${location.origin}${location.pathname}?r=${slugs[id] ?? ''}`,
    [slugs],
  );

  return {
    estado,
    cargando,
    /** Sin nube todo es editable (uso local). Con nube, solo el dueño de la rifa. */
    puedeEditar: !nube || (!!admin && propia),
    hayNube: !!nube,
    haySesion: !nube || !!admin,
    usuarioId: admin,
    rifas: nube ? lista : Object.entries(almacen.rifas).map(([id, e]) => resumen(id, '', e)),
    rifaActual: actual,
    sinRifas: !!nube && !!admin && lista.length === 0,
    linkPublico,
    crearRifa,
    seleccionarRifa,
    eliminarRifa,
    vender,
    marcarPago,
    liberar,
    configurar,
    finalizar,
    reabrir,
    vaciarTablero,
    entrar,
    registrarse,
    salir,
  };
}
