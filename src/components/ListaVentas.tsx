import { useState } from 'react';
import {
  estadoNumero,
  etiqueta,
  filtrarVentas,
  formatearPrecio,
  ventas,
  type Estado,
  type FiltroVentas,
} from '../rifa';

type Props = {
  estado: Estado;
  /** Abre la ficha de esos números: ahí se cobra, se avisa por WhatsApp o se libera. */
  onNumeros: (numeros: number[]) => void;
};

/**
 * Quién compró qué. Es la vista para cobrar: se busca a la persona por nombre y
 * se toca su número, en vez de rastrearlo en la cuadrícula.
 */
export function ListaVentas({ estado, onNumeros }: Props) {
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroVentas>('todas');
  const { totalNumeros, precio, moneda } = estado.config;
  const q = busca.trim().toLowerCase();
  const compradores = ventas(estado);
  const porCobrar = compradores.reduce((n, v) => n + v.pendientes, 0);

  if (!compradores.length) {
    return (
      <p className="panel__nota">
        Todavía no hay números vendidos. Los compradores aparecen aquí en cuanto vendas el primero.
      </p>
    );
  }

  const lista = filtrarVentas(compradores, filtro).filter(
    (v) =>
      !q ||
      v.nombre.toLowerCase().includes(q) ||
      v.telefono.includes(q) ||
      v.numeros.some((n) => etiqueta(n, totalNumeros).includes(q)),
  );

  return (
    <>
      <p className="ventas__resumen">
        {compradores.length} {compradores.length === 1 ? 'persona' : 'personas'} ·{' '}
        {porCobrar > 0 ? (
          <strong>{formatearPrecio(porCobrar * precio, moneda)} por cobrar</strong>
        ) : (
          'todo cobrado'
        )}
      </p>
      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar nombre, teléfono o número"
        aria-label="Buscar comprador"
      />
      <div className="ventas__filtros" role="group" aria-label="Filtrar ventas">
        {(
          [
            { id: 'todas', titulo: 'Todas' },
            { id: 'cobrar', titulo: 'Por cobrar' },
            { id: 'pagadas', titulo: 'Pagadas' },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filtro === f.id}
            className={`ventas__filtro${filtro === f.id ? ' ventas__filtro--activo' : ''}`}
            onClick={() => setFiltro(f.id)}
          >
            {f.titulo}
          </button>
        ))}
      </div>
      <ul className="ventas">
        {lista.map((v) => (
          <li key={`${v.telefono}|${v.nombre}`} className="ventas__fila">
            <div className="ventas__quien">
              <strong>{v.nombre}</strong>
              <span>{v.telefono}</span>
            </div>
            <span className={`ventas__estado${v.pendientes ? ' ventas__estado--debe' : ''}`}>
              {v.pendientes ? `Debe ${formatearPrecio(v.pendientes * precio, moneda)}` : 'Al día'}
            </span>
            <div className="ventas__nums">
              {/* Todos juntos: un solo mensaje de WhatsApp y un solo toque para
                  cobrarle los cinco números a la misma persona. */}
              {v.numeros.length > 1 && (
                <button
                  type="button"
                  className="ventas__num ventas__todos"
                  onClick={() => onNumeros(v.numeros)}
                  title={`Cobrar o avisar los ${v.numeros.length} números de ${v.nombre} en un solo mensaje`}
                >
                  Los {v.numeros.length} juntos
                </button>
              )}
              {v.numeros.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`ventas__num ventas__num--${estadoNumero(estado, n)}`}
                  onClick={() => onNumeros([n])}
                  title={`Número ${etiqueta(n, totalNumeros)}`}
                >
                  {etiqueta(n, totalNumeros)}
                </button>
              ))}
            </div>
          </li>
        ))}
        {!lista.length && !!q && <li className="panel__nota">Nadie coincide con «{busca}».</li>}
      </ul>
      {lista.length === 0 && !q && (
        <p className="panel__nota">Nadie en este filtro. Toca «Todas» para ver a todos.</p>
      )}
    </>
  );
}
