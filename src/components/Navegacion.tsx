import { IconoUI } from '../marcas';
import type { Entrada, Pestana } from '../pestanas';

type Props = {
  visibles: Entrada[];
  activa: Pestana;
  onElegir: (p: Pestana) => void;
};

/**
 * La misma navegación en los dos tamaños: barra fija abajo en celular, donde
 * llega el pulgar, y columna a la izquierda en escritorio. El CSS la mueve; el
 * marcado es uno solo para que no haya dos listas que se desincronicen.
 */
export function Navegacion({ visibles, activa, onElegir }: Props) {
  return (
    <nav className="nav" aria-label="Secciones del panel">
      {visibles.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-current={activa === p.id ? 'page' : undefined}
          className={`nav__item${activa === p.id ? ' nav__item--activo' : ''}`}
          onClick={() => onElegir(p.id)}
        >
          <IconoUI id={p.icono} className="nav__icono" />
          <span>{p.titulo}</span>
        </button>
      ))}
    </nav>
  );
}
