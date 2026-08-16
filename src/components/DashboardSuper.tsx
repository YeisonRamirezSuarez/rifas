import { useEffect, useState } from 'react';
import { nube } from '../nube';
import { formatearPrecio } from '../rifa';

type Fila = {
  rifa_id: string;
  slug: string;
  creada_en: string;
  email: string;
  nombre: string | null;
  estado: string;
  titulo: string;
  premio: string;
  precio: number;
  total_numeros: number;
  finalizado: boolean;
  vendidos: number;
  pendientes: number;
  efectivo: number;
  transferencia: number;
  cobrado: number;
  ultima_venta: string | null;
};

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—';

/** Control general: todas las rifas de todos los usuarios, con sus cifras. */
export function DashboardSuper() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orden, setOrden] = useState<'ventas' | 'fecha'>('ventas');

  const cargar = async () => {
    setCargando(true);
    const { data, error: fallo } = await nube!.from('panel_superadmin').select('*');
    // Un fallo dejaba la tabla vacía, y vacía este panel dice «cero usuarios, cero
    // boletas, cero cobrado»: la lectura que menos conviene equivocar.
    if (fallo) setError(fallo.message);
    else {
      setError(null);
      setFilas((data ?? []) as Fila[]);
    }
    setCargando(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  const ordenadas = [...filas].sort((a, b) =>
    orden === 'ventas'
      ? b.vendidos - a.vendidos
      : new Date(b.creada_en).getTime() - new Date(a.creada_en).getTime(),
  );

  const usuarios = new Set(filas.map((f) => f.email)).size;
  const totalVendidos = filas.reduce((s, f) => s + Number(f.vendidos), 0);
  const totalCobrado = filas.reduce((s, f) => s + Number(f.cobrado), 0);
  const porCobrar = filas.reduce((s, f) => s + Number(f.pendientes) * Number(f.precio), 0);

  return (
    <aside className="panel">
      <div className="misrifas__cabecera">
        <h2 className="panel__titulo">Control general</h2>
        <button type="button" onClick={cargar}>
          Actualizar
        </button>
      </div>

      {error && (
        <p className="dialogo__error" role="alert">
          No se pudieron traer las cifras: {error}.
          {filas.length > 0 && ' Las de abajo son las de la última carga que sí funcionó.'}
        </p>
      )}

      {/* Sin filas y con error, las cifras serían todas cero: justo la lectura falsa que
          este panel no puede dar. Mejor no mostrar nada que mostrar un negocio vacío. */}
      {(!error || filas.length > 0) && (
        <>
          <dl className="panel__resumen">
            <div>
              <dt>Usuarios</dt>
              <dd>{usuarios}</dd>
            </div>
            <div>
              <dt>Rifas</dt>
              <dd>{filas.length}</dd>
            </div>
            <div>
              <dt>Boletas</dt>
              <dd>{totalVendidos}</dd>
            </div>
          </dl>

          <table className="panel__caja">
            <tbody>
              <tr className="panel__caja-total">
                <th scope="row">Cobrado en total</th>
                <td>{formatearPrecio(totalCobrado, 'COP')}</td>
              </tr>
              <tr>
                <th scope="row">Por cobrar</th>
                <td>{formatearPrecio(porCobrar, 'COP')}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      <div className="panel__nav" role="tablist" aria-label="Orden">
        {(['ventas', 'fecha'] as const).map((o) => (
          <button
            key={o}
            type="button"
            role="tab"
            aria-selected={orden === o}
            className={`panel__tab${orden === o ? ' panel__tab--activa' : ''}`}
            onClick={() => setOrden(o)}
          >
            {o === 'ventas' ? 'Más vendidas' : 'Más recientes'}
          </button>
        ))}
      </div>

      {cargando ? (
        <p className="panel__nota">Cargando…</p>
      ) : ordenadas.length === 0 ? (
        <p className="panel__nota">Todavía no hay rifas creadas.</p>
      ) : (
        <ul className="cuentas">
          {ordenadas.map((f) => {
            const pct = f.total_numeros ? Math.round((f.vendidos / f.total_numeros) * 100) : 0;
            return (
              <li key={f.rifa_id} className="cuentas__fila">
                <div>
                  <strong>{f.titulo}</strong>
                  <span>
                    {f.nombre || f.email} · {f.estado}
                  </span>
                  <span>
                    {f.vendidos}/{f.total_numeros} boletas · {formatearPrecio(Number(f.cobrado), 'COP')} cobrado
                  </span>
                  <span>
                    efectivo {f.efectivo} · transferencia {f.transferencia} · pendiente {f.pendientes}
                  </span>
                  <span>
                    creada {fecha(f.creada_en)} · última venta {fecha(f.ultima_venta)}
                    {f.finalizado ? ' · finalizada' : ''}
                  </span>
                </div>
                <div className="barra" aria-label={`${pct}% vendido`}>
                  <span style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
