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
  const [hayCambios, setHayCambios] = useState(false);

  // Cada tecla dispararía una consulta; a 50 filas por página eso es ruido puro.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(busqueda.trim()), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  // Descarta respuestas viejas: cambiar de pestaña rápido hacía que la anterior
  // llegara después y pisara la lista buena.
  const pedido = useRef(0);

  // El callback del canal vive tanto como la suscripción: sin refs leería el
  // primer valor de estas dos para siempre.
  const primeraPaginaRef = useRef(true);
  const busquedaRef = useRef('');
  const recargarRef = useRef(() => {});

  useEffect(() => {
    // Solo el largo de la lista dice si alguien paginó. Con `cursor === null` también
    // contaba como primera página el *final* de la lista —ahí ya no hay cursor—, así
    // que al llegar abajo el siguiente evento en vivo recargaba y devolvía las 250
    // filas paginadas a las primeras 50: justo lo que este guardia evita.
    primeraPaginaRef.current = lista.length <= PAGINA;
    busquedaRef.current = debounced;
  }, [lista.length, debounced]);

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

      // Un fallo no debe tocar cursor ni lista: si no, un corte de red trunca la
      // lista donde iba y esconde el botón de seguir, sin forma de reintentar.
      if (fallo) {
        setError(fallo.message);
        setCargando(false);
        return;
      }

      const filas = (data ?? []) as Perfil[];
      setError(null);
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
    const { count, error: fallo } = await nube
      .from('perfiles')
      .select('*', { count: 'exact', head: true })
      .neq('id', usuarioId)
      .eq('estado', 'pendiente');
    // Con el conteo caído, poner cero apaga el aviso de solicitudes por revisar y
    // el superadmin deja gente esperando sin saberlo. Mejor dejar el número viejo.
    if (fallo || count === null) return;
    setPendientes(count);
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

  const mas = useCallback(() => {
    if (cursor) traer(cursor);
  }, [cursor, traer]);

  const recargar = useCallback(() => {
    setHayCambios(false);
    setLista([]);
    setCursor(null);
    traer(null);
    contarPendientes();
  }, [traer, contarPendientes]);

  // Una ref se asigna después de que existe lo que guarda.
  useEffect(() => {
    recargarRef.current = recargar;
  }, [recargar]);

  const actualizarCuenta = useCallback(
    async (id: string, cambios: Cambios): Promise<string | null> => {
      if (!nube) return 'Sin conexión.';
      const previa = lista.find((c) => c.id === id);
      const fila: Record<string, unknown> = {};
      if (cambios.estado !== undefined) {
        fila.estado = cambios.estado;
        // Se sella solo al aprobar de verdad —alta nueva o tras un rechazo—. Reenviar
        // el estado actual mientras se edita otra cosa no debe mover la fecha, y
        // rechazar no debe borrarla: es el registro de cuándo se dio el acceso.
        if (cambios.estado === 'aprobado' && previa?.estado !== 'aprobado')
          fila.aprobado_en = new Date().toISOString();
      }
      if (cambios.rol !== undefined) fila.rol = cambios.rol;
      if (cambios.pagadoEn !== undefined) fila.pagado_en = cambios.pagadoEn;
      if (cambios.pagoNota !== undefined) fila.pago_nota = cambios.pagoNota;

      const { error: fallo } = await nube.from('perfiles').update(fila).eq('id', id);
      if (fallo) return fallo.message;
      // Recargar entero devolvía la lista a la primera página: quien había bajado 250
      // cuentas para aprobar una de las últimas las perdía todas. Se parchea la fila y,
      // si el cambio la saca de la pestaña que se está mirando, se quita. Buscando no
      // se filtra por estado, igual que en `traer`.
      setLista((l) =>
        l.flatMap((c) => {
          if (c.id !== id) return [c];
          const actualizada = { ...c, ...fila } as Perfil;
          return !debounced && actualizada.estado !== filtro ? [] : [actualizada];
        }),
      );
      contarPendientes();
      return null;
    },
    [lista, debounced, filtro, contarPendientes],
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
    hayCambios,
  };
}
