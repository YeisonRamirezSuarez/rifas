import { useRef, useState } from 'react';
import { generarPng, generarVarias, type Imagen } from '../exportar';
import { IconoUI } from '../marcas';
import type { Estado } from '../rifa';
import { Ganador } from './Ganador';
import { Poster } from './Poster';
import { PosterFotos } from './PosterFotos';

type Props = {
  estado: Estado;
  cerrado: boolean;
  link: string;
  hayNube: boolean;
  onImagenes: (imagenes: Imagen[], falla?: string) => void;
};

/** La pestaña de repartir la rifa: link público, WhatsApp y PNG para el estado. */
export function SeccionCompartir({ estado, cerrado, link, hayNube, onImagenes }: Props) {
  const posterRef = useRef<HTMLElement>(null);
  const ganadorRef = useRef<HTMLElement>(null);
  const fotosRef = useRef<HTMLElement>(null);
  const [generando, setGenerando] = useState(false);
  // En qué hoja va, para el botón. Vacío cuando hay una sola: «Generando hoja 1
  // de 1» no informa de nada.
  const [paso, setPaso] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  // La hoja de fotos se monta con esta misma condición: lo que se ve y lo que
  // se exporta no pueden discrepar.
  const hayFotos = !cerrado && estado.config.fotos.length > 0;

  const bajar = async () => {
    setGenerando(true);
    setPaso('');
    setError(null);
    const { imagenes, error: falla } = await generarVarias(
      cerrado
        ? [{ nodo: ganadorRef.current, nombre: 'rifa-ganador', titulo: 'imagen del ganador' }]
        : [
            { nodo: posterRef.current, nombre: 'rifa-hoja-1', titulo: 'hoja 1' },
            ...(hayFotos
              ? [{ nodo: fotosRef.current, nombre: 'rifa-hoja-2', titulo: 'hoja 2' }]
              : []),
          ],
      generarPng,
      (n, total) => setPaso(total > 1 ? ` hoja ${n} de ${total}` : ''),
    );
    setGenerando(false);
    // El aviso se queda también aquí: el diálogo es modal y lo tapa, pero al
    // cerrarlo no quedaba rastro de que una hoja no salió.
    if (falla) setError(falla);
    if (imagenes.length) onImagenes(imagenes, falla);
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError('No se pudo copiar. Copia el link desde la barra del navegador.');
    }
  };

  const texto = `${estado.config.titulo} — ${link}`;

  return (
    <section className="panel compartir" aria-label="Compartir">
      <h2 className="panel__titulo">Compartir</h2>
      {error && (
        <p className="dialogo__error" role="alert">
          {error}
        </p>
      )}

      {/* Sin nube el link se armaría sin el slug de la rifa: no llevaría a ninguna parte. */}
      {hayNube ? (
        <>
          <p className="panel__nota">
            Quien abra este link ve el tablero en vivo, sin entrar a la app ni crear cuenta.
          </p>
          <div className="compartir__link">
            <input
              readOnly
              value={link}
              aria-label="Link público de la rifa"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button type="button" onClick={copiar}>
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <a
            className="boton"
            href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
            target="_blank"
            rel="noreferrer"
          >
            Enviar el link por WhatsApp
          </a>
        </>
      ) : (
        <p className="panel__nota">
          Sin nube no hay link público: esta rifa vive solo en este dispositivo. Puedes
          compartir la lámina de abajo.
        </p>
      )}

      {/* app__descargar: el icono y el texto del botón se alinean con esa clase,
          la misma que traía la descarga cuando vivía junto a la lámina. */}
      <button
        type="button"
        className="boton--primario app__descargar"
        onClick={bajar}
        disabled={generando}
      >
        <IconoUI id="descargar" />
        <span>
          {generando
            ? `Generando${paso}…`
            : hayFotos
              ? 'Descargar las 2 hojas (2 PNG)'
              : 'Descargar la lámina (1 PNG)'}
        </span>
      </button>
      {/* Dibujar una hoja de 1080x1920 tarda, y en celular tarda más: sin este
          aviso parece que el botón no hizo nada y se vuelve a tocar. */}
      <p className="panel__nota" aria-live="polite">
        {generando
          ? 'Cada hoja tarda unos segundos. Deja la app abierta hasta que salga.'
          : hayFotos
            ? 'Se descargan 2 hojas: la de los cien números y la de las fotos.'
            : cerrado
              ? 'Se descarga 1 sola hoja: la imagen del ganador.'
              : 'Se descarga 1 sola hoja, con los cien números.'}
      </p>

      {/* La lámina se ve aquí a escala: es la misma que sale en el PNG.
          `inert` porque esto es una vista previa, no el tablero: el póster monta
          las casillas como botones de verdad y aquí no venden ni cobran nada.
          Sin esto el vendedor las toca esperando la ficha, y el teclado y el
          lector de pantalla recorren cien controles muertos. No afecta al PNG:
          `generarPng` clona el nodo y lo exporta aparte.
          El spread es por los tipos: `inert` no existe en @types/react 18.3. */}
      <div className="compartir__laminas" {...{ inert: '' }}>
        {cerrado ? (
          <Ganador ref={ganadorRef} estado={estado} verNombre />
        ) : (
          <Poster ref={posterRef} estado={estado} onSeleccionar={() => {}} />
        )}
        {hayFotos && <PosterFotos ref={fotosRef} estado={estado} />}
      </div>
    </section>
  );
}
