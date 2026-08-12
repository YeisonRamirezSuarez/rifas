import { estiloPorId, Icono, IconoUI } from '../marcas';
import { estadoNumero, etiqueta, numeros, type Estado } from '../rifa';

type Props = {
  estado: Estado;
  onSeleccionar: (numero: number) => void;
  /** Números marcados para venderlos juntos. */
  elegidos?: number[];
};

const TEXTO: Record<string, string> = {
  libre: 'disponible',
  apartado: 'apartado, pago pendiente',
  pagado: 'vendido y pagado',
};

export function Tablero({ estado, onSeleccionar, elegidos = [] }: Props) {
  const { totalNumeros, ocultarVendidos, numeroGanador, marca } = estado.config;
  const estilo = estiloPorId(estado.config.estiloCelda);

  return (
    <div className="tablero" role="grid" aria-label="Números de la rifa">
      {numeros(totalNumeros).map((n) => {
        const situacion = estadoNumero(estado, n);
        const esGanador = n === numeroGanador;
        const tapado = situacion !== 'libre' && ocultarVendidos;
        const elegido = elegidos.includes(n);
        return (
          <button
            key={n}
            type="button"
            role="gridcell"
            className={`celda celda--${situacion} celda--${estilo}${
              esGanador ? ' celda--ganadora' : ''
            }${elegido ? ' celda--elegida' : ''}`}
            aria-pressed={elegidos.length ? elegido : undefined}
            aria-label={`Número ${etiqueta(n, totalNumeros)}, ${TEXTO[situacion]}${
              esGanador ? ', ganador' : ''
            }${elegido ? ', elegido' : ''}`}
            onClick={() => onSeleccionar(n)}
          >
            {esGanador ? (
              <IconoUI id="trofeo" className="celda__ganadora" />
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
