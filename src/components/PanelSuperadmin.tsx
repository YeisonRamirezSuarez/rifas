import { useState } from 'react';
import type { EstadoCuenta, Perfil } from '../usePerfil';

type Props = {
  solicitudes: Perfil[];
  decidir: (id: string, estado: EstadoCuenta) => Promise<string | null>;
  recargar: () => void;
};

const ETIQUETA: Record<EstadoCuenta, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Activa',
  rechazado: 'Rechazada',
};

/** Solo para superadmin: acepta o rechaza las cuentas que piden acceso. */
export function PanelSuperadmin({ solicitudes, decidir, recargar }: Props) {
  const [filtro, setFiltro] = useState<EstadoCuenta>('pendiente');
  const [error, setError] = useState<string | null>(null);

  const visibles = solicitudes.filter((s) => s.estado === filtro);
  const pendientes = solicitudes.filter((s) => s.estado === 'pendiente').length;

  return (
    <aside className="panel">
      <div className="misrifas__cabecera">
        <h2 className="panel__titulo">
          Cuentas{pendientes > 0 && <span className="panel__globo">{pendientes}</span>}
        </h2>
        <button type="button" onClick={recargar}>
          Actualizar
        </button>
      </div>

      <nav className="panel__nav" role="tablist" aria-label="Estado de las cuentas">
        {(['pendiente', 'aprobado', 'rechazado'] as EstadoCuenta[]).map((e) => (
          <button
            key={e}
            type="button"
            role="tab"
            aria-selected={filtro === e}
            className={`panel__tab${filtro === e ? ' panel__tab--activa' : ''}`}
            onClick={() => setFiltro(e)}
          >
            {ETIQUETA[e]}
          </button>
        ))}
      </nav>

      {visibles.length === 0 ? (
        <p className="panel__nota">No hay cuentas en este estado.</p>
      ) : (
        <ul className="cuentas">
          {visibles.map((s) => (
            <li key={s.id} className="cuentas__fila">
              <div>
                <strong>{s.nombre || s.email}</strong>
                {s.nombre && <span>{s.email}</span>}
                <span>
                  {s.rol} · {new Date(s.creado_en).toLocaleDateString('es-CO')}
                </span>
              </div>
              <div className="cuentas__acciones">
                {s.estado !== 'aprobado' && (
                  <button
                    type="button"
                    className="boton--primario"
                    onClick={async () => setError(await decidir(s.id, 'aprobado'))}
                  >
                    Aprobar
                  </button>
                )}
                {s.estado !== 'rechazado' && (
                  <button
                    type="button"
                    className="boton--peligro"
                    onClick={async () => setError(await decidir(s.id, 'rechazado'))}
                  >
                    Rechazar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="dialogo__error">{error}</p>}
    </aside>
  );
}
