import { useState } from 'react';
import { estadoNumero, etiqueta, formatearPrecio, ventas, type Estado } from '../rifa';

type Props = {
  estado: Estado;
  /** Abre la ficha del número: ahí se cobra, se avisa por WhatsApp o se libera. */
  onNumero: (numero: number) => void;
};

/**
 * Quién compró qué. Es la vista para cobrar: se busca a la persona por nombre y
 * se toca su número, en vez de rastrearlo en la cuadrícula.
 */
export function ListaVentas({ estado, onNumero }: Props) {
  const [busca, setBusca] = useState('');
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

  const lista = compradores.filter(
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
      <ul className="ventas">
        {lista.map((v) => (
          <li key={v.telefono || v.nombre} className="ventas__fila">
            <div className="ventas__quien">
              <strong>{v.nombre}</strong>
              <span>{v.telefono}</span>
            </div>
            <span className={`ventas__estado${v.pendientes ? ' ventas__estado--debe' : ''}`}>
              {v.pendientes ? `Debe ${formatearPrecio(v.pendientes * precio, moneda)}` : 'Al día'}
            </span>
            <div className="ventas__nums">
              {v.numeros.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`ventas__num ventas__num--${estadoNumero(estado, n)}`}
                  onClick={() => onNumero(n)}
                  title={`Número ${etiqueta(n, totalNumeros)}`}
                >
                  {etiqueta(n, totalNumeros)}
                </button>
              ))}
            </div>
          </li>
        ))}
        {!lista.length && <li className="panel__nota">Nadie coincide con «{busca}».</li>}
      </ul>
    </>
  );
}
