import { useEffect, useRef, useState } from 'react';
import { compartir, descargar, sePuedeCompartir, type Imagen } from '../exportar';

type Props = { imagen: Imagen | null; onCerrar: () => void };

/** Muestra el PNG ya generado para verlo, compartirlo o abrirlo en otra pestaña. */
export function DialogoImagen({ imagen, onCerrar }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [medidas, setMedidas] = useState<string>('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    setError(null);
    setMedidas('');
    if (!imagen) d.close();
    else if (!d.open) d.showModal();
  }, [imagen]);

  return (
    <dialog ref={ref} className="dialogo dialogo--imagen" onClose={onCerrar}>
      {imagen && (
        <>
          <h2 className="dialogo__titulo">Imagen lista</h2>
          <img
            className="dialogo__imagen"
            src={imagen.url}
            alt="Imagen generada del sorteo"
            onLoad={(e) =>
              setMedidas(`${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}`)
            }
          />

          <div className="dialogo__cuerpo">
            {sePuedeCompartir(imagen) && (
              <button
                type="button"
                className="boton--primario"
                onClick={async () => setError(await compartir(imagen))}
              >
                Compartir
              </button>
            )}
            <div className="dialogo__acciones">
              <a className="boton" href={imagen.url} target="_blank" rel="noreferrer">
                Abrir en pestaña nueva
              </a>
              <button type="button" onClick={() => descargar(imagen)}>
                Descargar
              </button>
            </div>
            {error && <p className="dialogo__error">{error}</p>}
            <p className="dialogo__etiqueta">
              {medidas && `${medidas} · `}listo para estado de WhatsApp.
            </p>
          </div>

          <button type="button" className="dialogo__cerrar" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </>
      )}
    </dialog>
  );
}
