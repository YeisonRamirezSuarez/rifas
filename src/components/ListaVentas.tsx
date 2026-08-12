import { useState } from 'react';
import { estadoNumero, etiqueta, formatearPrecio, ventas, type Estado } from '../rifa';

type Props = {
  estado: Estado;
  /** Abre la ficha del número: ahí se cobra, se avisa por WhatsApp o se libera. */
  onNumero: (numero: number) => void;
};

export function ListaVentas({ estado, onNumero }: Props) {
  const [busca, setBusca] = useState('');
  const { totalNumeros, precio, moneda } = estado.config;
  const q = busca.trim().toLowerCase();

  if (!Object.keys(estado.tickets).length) {
    return <p className="panel__nota">Todavía no hay números vendidos.</p>;
  }

  const lista = ventas(estado).filter(
    (v) =>
      !q ||
      v.nombre.toLowerCase().includes(q) ||
      v.telefono.includes(q) ||
      v.numeros.some((n) => etiqueta(n, totalNumeros).includes(q)),
  );

  return (
    <>
      <input
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
            <div className="ventas__nums">
              {v.numeros.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`ventas__num ventas__num--${estadoNumero(estado, n)}`}
                  onClick={() => onNumero(n)}
                >
                  {etiqueta(n, totalNumeros)}
                </button>
              ))}
            </div>
            {v.pendientes > 0 && (
              <span className="ventas__falta">
                Debe {formatearPrecio(v.pendientes * precio, moneda)}
              </span>
            )}
          </li>
        ))}
        {!lista.length && <li className="panel__nota">Nadie coincide con «{busca}».</li>}
      </ul>
    </>
  );
}
