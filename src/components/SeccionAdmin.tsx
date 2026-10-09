import { enviarCorreo } from '../correos';
import type { useCuentas } from '../useCuentas';
import { DashboardSuper } from './DashboardSuper';
import { PanelSuperadmin } from './PanelSuperadmin';

type Props = {
  cuentas: ReturnType<typeof useCuentas>;
  confirmar: (
    titulo: string,
    o?: { texto?: string; aceptar?: string; peligro?: boolean },
  ) => Promise<boolean>;
};

/** La pestaña del superadmin: aprobar cuentas y ver el tablero de la plataforma. */
export function SeccionAdmin({ cuentas, confirmar }: Props) {
  return (
    <div className="app__columna">
      <PanelSuperadmin
        cuentas={cuentas}
        confirmar={confirmar}
        decidir={async (id, estado, pago) => {
          const err = await cuentas.actualizarCuenta(id, { estado, ...pago });
          if (err) return err;
          const p = cuentas.lista.find((c) => c.id === id);
          if (!p || estado === 'pendiente') return null;
          const fallo = await enviarCorreo(estado === 'aprobado' ? 'aprobada' : 'rechazada', {
            nombre: p.nombre ?? '',
            email: p.email,
          });
          // Aviso y no error: la decisión ya quedó guardada. Llamarlo «falló»
          // lleva al superadmin a reintentar una operación que sí funcionó.
          return fallo ? `Cuenta actualizada, pero el aviso por correo no salió: ${fallo}` : null;
        }}
      />
      <DashboardSuper />
    </div>
  );
}
