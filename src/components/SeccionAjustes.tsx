import type { usePerfil } from '../usePerfil';
import type { useRifa } from '../useRifa';
import { MiCuenta } from './MiCuenta';
import { MisRifas } from './MisRifas';
import { PanelConfig } from './PanelConfig';

type Props = {
  rifa: ReturnType<typeof useRifa>;
  cuenta: ReturnType<typeof usePerfil>;
  confirmar: (
    titulo: string,
    o?: { texto?: string; aceptar?: string; peligro?: boolean },
  ) => Promise<boolean>;
};

/** La pestaña de administrar: mi cuenta, mis rifas y la configuración de la rifa abierta. */
export function SeccionAjustes({ rifa, cuenta, confirmar }: Props) {
  return (
    <div className="app__columna">
      {rifa.hayNube && cuenta.perfil && (
        <MiCuenta perfil={cuenta.perfil} guardarNombre={cuenta.guardarNombre} />
      )}
      <MisRifas
        rifas={rifa.rifas}
        actual={rifa.rifaActual}
        hayNube={rifa.hayNube}
        linkPublico={rifa.linkPublico}
        seleccionar={rifa.seleccionarRifa}
        crear={rifa.crearRifa}
        eliminar={rifa.eliminarRifa}
        confirmar={confirmar}
      />
      {rifa.rifaActual && rifa.puedeEditar && (
        <PanelConfig
          rifaId={rifa.rifaActual}
          estado={rifa.estado}
          configurar={rifa.configurar}
          guardado={rifa.guardado}
          errorGuardado={rifa.errorGuardado}
          reintentarGuardado={rifa.reintentarGuardado}
          finalizar={rifa.finalizar}
          reabrir={rifa.reabrir}
          vaciarTablero={rifa.vaciarTablero}
          confirmar={confirmar}
        />
      )}
    </div>
  );
}
