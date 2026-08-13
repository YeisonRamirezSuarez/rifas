import { useCallback, useEffect, useRef, useState } from 'react';
import { nube } from './nube';

export type Rol = 'superadmin' | 'admin' | 'cliente';
export type EstadoCuenta = 'pendiente' | 'aprobado' | 'rechazado';

export type Perfil = {
  id: string;
  email: string;
  nombre: string | null;
  rol: Rol;
  estado: EstadoCuenta;
  creado_en: string;
};

/**
 * Perfil de la cuenta activa y, si es superadmin, las solicitudes por revisar.
 * Sin nube no hay cuentas: se trabaja como admin aprobado.
 */
export function usePerfil(usuarioId: string | null) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [solicitudes, setSolicitudes] = useState<Perfil[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resuelto, setResuelto] = useState<string | null>(null);
  const cargando = !!nube && !!usuarioId && resuelto !== usuarioId;

  const cargarSolicitudes = useCallback(async () => {
    if (!nube || !usuarioId) return;
    const { data } = await nube
      .from('perfiles')
      .select('*')
      .neq('id', usuarioId)
      .order('creado_en', { ascending: false });
    setSolicitudes((data ?? []) as Perfil[]);
  }, [usuarioId]);

  // Descarta la respuesta de una consulta que ya quedó vieja: al cambiar de
  // cuenta la anterior puede llegar después y pisar el perfil bueno.
  const pedido = useRef(0);

  /** `silencioso` refresca sin pantalla de espera: lo usa el canal en vivo. */
  const cargarPerfil = useCallback(
    async (silencioso = false) => {
      if (!nube || !usuarioId) return;
      // Volver a "sin resolver" mientras se pide: si no, el reintento no se
      // nota en pantalla y el botón parece muerto.
      if (!silencioso) setResuelto(null);
      const mioPedido = ++pedido.current;
      const { data, error: fallo } = await nube
        .from('perfiles')
        .select('*')
        .eq('id', usuarioId)
        .maybeSingle();
      if (mioPedido !== pedido.current) return;
      const mio = (data ?? null) as Perfil | null;
      setPerfil(mio);
      // Sin fila y con la consulta caída se ve igual desde fuera —perfil nulo—,
      // pero el primero es un problema de datos y el segundo se reintenta. Sin
      // distinguirlos la cuenta quedaba encerrada en la pantalla de espera.
      setError(
        fallo
          ? fallo.message
          : mio
            ? null
            : 'No encontramos el perfil de esta cuenta. Escríbenos para activarla.',
      );
      setResuelto(usuarioId);
      if (mio?.rol === 'superadmin') cargarSolicitudes();
    },
    [usuarioId, cargarSolicitudes],
  );

  useEffect(() => {
    if (!nube || !usuarioId) {
      setPerfil(null);
      setSolicitudes([]);
      setError(null);
      // Sin esto, volver a entrar con la misma cuenta daba el perfil por
      // resuelto antes de pedirlo y asomaba la pantalla de error.
      setResuelto(null);
      return;
    }
    cargarPerfil();
  }, [usuarioId, cargarPerfil]);

  // El superadmin aprueba desde otro navegador: sin esto la cuenta se queda
  // mirando "en revisión" hasta que se le ocurra recargar a mano.
  useEffect(() => {
    if (!nube || !usuarioId) return;
    const bd = nube;
    const canal = bd
      .channel(`perfil-${usuarioId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'perfiles',
          filter: `id=eq.${usuarioId}`,
        },
        () => cargarPerfil(true),
      )
      .subscribe();
    return () => {
      bd.removeChannel(canal);
    };
  }, [usuarioId, cargarPerfil]);

  const decidir = useCallback(
    async (id: string, estado: EstadoCuenta): Promise<string | null> => {
      const { error: fallo } = await nube!
        .from('perfiles')
        .update({
          estado,
          aprobado_en: estado === 'aprobado' ? new Date().toISOString() : null,
        })
        .eq('id', id);
      if (fallo) return fallo.message;
      await cargarSolicitudes();
      return null;
    },
    [cargarSolicitudes],
  );

  return {
    perfil,
    cargando,
    error,
    solicitudes,
    esSuperadmin: perfil?.rol === 'superadmin',
    /** Sin nube no hay aprobación: se usa la app directamente. */
    aprobado: !nube || perfil?.estado === 'aprobado',
    decidir,
    recargarPerfil: cargarPerfil,
    recargarSolicitudes: cargarSolicitudes,
  };
}
