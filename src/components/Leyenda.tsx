import { estiloPorId, Icono } from '../marcas';
import { etiqueta, type Config } from '../rifa';

const ESTADOS = [
  { id: 'libre', nombre: 'Libre' },
  { id: 'apartado', nombre: 'Apartado' },
  { id: 'pagado', nombre: 'Pagado' },
] as const;

/**
 * Los tres estados con la casilla de verdad: mismo estilo, marca y paleta que
 * el tablero. Vive fuera del póster para no salir en el PNG.
 */
export function Leyenda({ config }: { config: Config }) {
  const estilo = estiloPorId(config.estiloCelda);

  return (
    <ul className="leyenda">
      {ESTADOS.map((e, i) => (
        <li key={e.id}>
          <span className={`celda celda--${e.id} celda--${estilo}`}>
            {e.id === 'libre' || !config.ocultarVendidos ? (
              etiqueta(i, config.totalNumeros)
            ) : (
              <Icono id={config.marca} className="celda__marca" />
            )}
          </span>
          {e.nombre}
        </li>
      ))}
    </ul>
  );
}
