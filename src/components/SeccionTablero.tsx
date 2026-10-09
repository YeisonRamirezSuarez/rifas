import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { IconoUI } from '../marcas';
import { dentroDelRango, etiqueta, formatearPrecio, reporte, type Estado } from '../rifa';
import { CabeceraRifa } from './CabeceraRifa';
import { Ganador } from './Ganador';
import { Leyenda } from './Leyenda';
import { Poster } from './Poster';

/**
 * Cabecera de trabajo: en qué va la rifa y cómo llegar a un número.
 * Antes las cifras vivían dos toques adentro (Ajustes › Caja) y el número se
 * cazaba a ojo entre cien casillas.
 */
function BarraTablero({ estado, abrir }: { estado: Estado; abrir: (n: number) => void }) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const r = reporte(estado);
  const total = estado.config.totalNumeros;

  const buscar = (ev: FormEvent) => {
    ev.preventDefault();
    const n = Number(texto.trim());
    if (texto.trim() === '' || !dentroDelRango(n, total)) {
      setError(`Escribe un número entre ${etiqueta(0, total)} y ${etiqueta(total - 1, total)}.`);
      return;
    }
    setError(null);
    setTexto('');
    abrir(n);
  };

  return (
    <section className="tbar" aria-label="Estado de la rifa">
      <dl className="tbar__cifras">
        <div>
          <dt>Libres</dt>
          <dd>{r.disponibles}</dd>
        </div>
        <div>
          <dt>Apartados</dt>
          <dd className={r.pendientes ? 'tbar__debe' : undefined}>{r.pendientes}</dd>
        </div>
        <div>
          <dt>Pagados</dt>
          <dd>{r.efectivo + r.transferencia}</dd>
        </div>
        <div className="tbar__cobrar">
          <dt>Por cobrar</dt>
          <dd className={r.porCobrar ? 'tbar__debe' : undefined}>
            {formatearPrecio(r.porCobrar, estado.config.moneda)}
          </dd>
        </div>
      </dl>

      <form className="tbar__ir" onSubmit={buscar}>
        <label htmlFor="ir-numero">Ir al número</label>
        <div className="tbar__ir-campo">
          <input
            id="ir-numero"
            inputMode="numeric"
            autoComplete="off"
            placeholder={etiqueta(total - 1, total)}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setError(null);
            }}
          />
          <button type="submit" className="boton--primario">
            <IconoUI id="buscar" />
            <span>Abrir</span>
          </button>
        </div>
        {error && <p className="dialogo__error">{error}</p>}
      </form>
    </section>
  );
}

type Props = {
  estado: Estado;
  puedeEditar: boolean;
  cerrado: boolean;
  elegidos: number[] | null;
  setElegidos: Dispatch<SetStateAction<number[] | null>>;
  /** Abre la ficha de esos números. */
  abrir: (numeros: number[]) => void;
};

/** La pestaña de trabajo: ver el tablero y vender. */
export function SeccionTablero({
  estado,
  puedeEditar,
  cerrado,
  elegidos,
  setElegidos,
  abrir,
}: Props) {
  // En modo múltiple los libres se marcan y se desmarcan; uno ya vendido abre
  // su ficha como siempre, que es la única forma de cobrarlo o liberarlo.
  const tocar = (n: number) => {
    if (elegidos && !estado.tickets[n]) {
      // Con el valor del render en vez de la función, dos toques seguidos leen
      // la misma lista y el segundo se come al primero.
      setElegidos((e) =>
        (e ?? []).includes(n)
          ? (e ?? []).filter((x) => x !== n)
          : [...(e ?? []), n].sort((a, b) => a - b),
      );
      return;
    }
    abrir([n]);
  };

  // Cerrado el sorteo sobran el tablero y el póster: lo que queda es el anuncio
  // del ganador. La descarga vive en la pestaña Compartir.
  if (cerrado) {
    return (
      <div className="app__poster app__poster--solo">
        <Ganador estado={estado} verNombre={puedeEditar} />
      </div>
    );
  }

  return (
    <div className="app__poster">
      <CabeceraRifa estado={estado} />
      {puedeEditar && <BarraTablero estado={estado} abrir={(n) => abrir([n])} />}
      <Poster estado={estado} onSeleccionar={tocar} elegidos={elegidos ?? []} />
      <Leyenda config={estado.config} />
      {puedeEditar && (
        // Mientras se marcan números la barra se pega abajo: si no, cada lote
        // obliga a bajar a confirmar y volver a subir a seguir marcando.
        <div className={`app__multiple${elegidos ? ' app__multiple--marcando' : ''}`}>
          <button type="button" onClick={() => setElegidos((e) => (e ? null : []))}>
            {elegidos ? 'Salir de selección múltiple' : 'Vender varios a la misma persona'}
          </button>
          {elegidos && (
            <button
              type="button"
              className="boton--primario"
              disabled={elegidos.length === 0}
              // Se limpia al abrir: los números ya viven en el diálogo, que los
              // muestra en el título, y así abrir la ficha de un número vendido
              // no se lleva por delante lo que se estaba marcando.
              onClick={() => {
                abrir(elegidos);
                setElegidos([]);
              }}
            >
              {elegidos.length === 0
                ? 'Toca los números en el tablero'
                : `Vender ${elegidos.length} ${elegidos.length === 1 ? 'número' : 'números'}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
