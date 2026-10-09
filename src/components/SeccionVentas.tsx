import type { Estado } from '../rifa';
import { ListaVentas } from './ListaVentas';

type Props = {
  estado: Estado;
  /** Abre la ficha de esos números: ahí se cobra, se avisa por WhatsApp o se libera. */
  onNumeros: (numeros: number[]) => void;
};

/** La pestaña de cobrar: quién compró qué, con buscador y filtros. */
export function SeccionVentas({ estado, onNumeros }: Props) {
  return (
    <section className="panel" aria-label="Ventas">
      <h2 className="panel__titulo">Ventas</h2>
      <ListaVentas estado={estado} onNumeros={onNumeros} />
    </section>
  );
}
