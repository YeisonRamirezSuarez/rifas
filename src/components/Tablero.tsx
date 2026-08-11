import { estiloPorId, Icono } from '../marcas';
import { estadoNumero, etiqueta, numeros, type Estado } from '../rifa';

type Props = { estado: Estado; onSeleccionar: (numero: number) => void };

const TEXTO: Record<string, string> = {
  libre: 'disponible',
  apartado: 'apartado, pago pendiente',
  pagado: 'vendido y pagado',
};

export function Tablero({ estado, onSeleccionar }: Props) {
  const { totalNumeros, ocultarVendidos, numeroGanador, marca } = estado.config;
  const estilo = estiloPorId(estado.config.estiloCelda);

  return (
    <div className="tablero" role="grid" aria-label="Números de la rifa">
      {numeros(totalNumeros).map((n) => {
        const situacion = estadoNumero(estado, n);
        const esGanador = n === numeroGanador;
        const tapado = situacion !== 'libre' && ocultarVendidos;
        return (
          <button
            key={n}
            type="button"
            role="gridcell"
            className={`celda celda--${situacion} celda--${estilo}${
              esGanador ? ' celda--ganadora' : ''
            }`}
            aria-label={`Número ${etiqueta(n, totalNumeros)}, ${TEXTO[situacion]}${
              esGanador ? ', ganador' : ''
            }`}
            onClick={() => onSeleccionar(n)}
          >
            {esGanador ? (
              <span className="celda__ganadora">★</span>
            ) : tapado ? (
              <Icono id={marca} className="celda__marca" />
            ) : (
              etiqueta(n, totalNumeros)
            )}
          </button>
        );
      })}
    </div>
  );
}
