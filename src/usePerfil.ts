import { useCallback, useEffect, useState } from 'react';
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
  const [cargando, setCargando] = useState(!!nube);

  const cargarSolicitudes = useCallback(async () => {
    if (!nube) return;
    const { data } = await nube
      .from('perfiles')
      .select('*')
      .neq('id', usuarioId ?? '')
      .order('creado_en', { ascending: false });
    setSolicitudes((data ?? []) as Perfil[]);
  }, [usuarioId]);

  useEffect(() => {
    if (!nube) {
      setCargando(false);
      return;
    }
    if (!usuarioId) {
      setPerfil(null);
      setSolicitudes([]);
      setCargando(false);
      return;
    }
    let vivo = true;
    setCargando(true);
    (async () => {
      const { data } = await nube!.from('perfiles').select('*').eq('id', usuarioId).maybeSingle();
      if (!vivo) return;
      const mio = (data ?? null) as Perfil | null;
      setPerfil(mio);
      setCargando(false);
      if (mio?.rol === 'superadmin') cargarSolicitudes();
    })();
    return () => {
      vivo = false;
    };
  }, [usuarioId, cargarSolicitudes]);

  const decidir = useCallback(
    async (id: string, estado: EstadoCuenta): Promise<string | null> => {
      const { error } = await nube!
        .from('perfiles')
        .update({ estado, aprobado_en: estado === 'aprobado' ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) return error.message;
      await cargarSolicitudes();
      return null;
    },
    [cargarSolicitudes],
  );

  return {
    perfil,
    cargando,
    solicitudes,
    esSuperadmin: perfil?.rol === 'superadmin',
    /** Sin nube no hay aprobación: se usa la app directamente. */
    aprobado: !nube || perfil?.estado === 'aprobado',
    decidir,
    recargarSolicitudes: cargarSolicitudes,
  };
}
