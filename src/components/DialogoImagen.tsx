import { useEffect, useMemo, useRef, useState } from 'react';
import { compartir, descargar, sePuedeCompartir, type Imagen } from '../exportar';
import { IconoUI } from '../marcas';

type Props = { imagenes: Imagen[]; falla?: string; onCerrar: () => void };

/** Muestra los PNG ya generados para verlos, compartirlos o abrirlos aparte. */
export function DialogoImagen({ imagenes, falla, onCerrar }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    setError(null);
    if (!imagenes.length) d.close();
    else if (!d.open) d.showModal();
  }, [imagenes]);

  const varias = imagenes.length > 1;
  // `canShare` arma un File por imagen: no hace falta repetirlo en cada render.
  const puedeCompartir = useMemo(() => sePuedeCompartir(imagenes), [imagenes]);

  return (
    <dialog ref={ref} className="dialogo dialogo--imagen" onClose={onCerrar}>
      {imagenes.length > 0 && (
        <>
          <h2 className="dialogo__titulo">
            {varias ? 'Dos hojas listas' : falla ? 'Salió solo la hoja 1' : 'Imagen lista'}
          </h2>
          {/* El fallo parcial se nombra aquí: este diálogo tapa el aviso de Compartir. */}
          {falla && (
            <p className="dialogo__error" role="alert">
              {falla}
            </p>
          )}

          <div className="dialogo__hojas">
            {imagenes.map((im, i) => (
              <figure key={im.url} className="dialogo__hoja">
                <img
                  className="dialogo__imagen"
                  src={im.url}
                  alt={varias ? `Hoja ${i + 1} del sorteo` : 'Imagen del sorteo'}
                />
                {/* div y no figcaption: con botones adentro, la figura tomaría un nombre accesible raro. */}
                <div className="dialogo__acciones">
                  <a
                    className="boton"
                    href={im.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={varias ? `Abrir hoja ${i + 1}` : undefined}
                  >
                    Abrir
                  </a>
                  <button type="button" onClick={() => descargar(im)}>
                    {varias ? `Descargar hoja ${i + 1}` : 'Descargar'}
                  </button>
                </div>
              </figure>
            ))}
          </div>

          <div className="dialogo__cuerpo">
            {puedeCompartir && (
              <button
                type="button"
                className="boton--primario"
                onClick={async () => setError(await compartir(imagenes))}
              >
                {varias ? 'Compartir las dos hojas' : 'Compartir'}
              </button>
            )}
            {error && <p className="dialogo__error">{error}</p>}
            <p className="dialogo__etiqueta">1080 × 1920 · listo para estado de WhatsApp.</p>
          </div>

          <button type="button" className="dialogo__cerrar" onClick={onCerrar} aria-label="Cerrar">
            <IconoUI id="cerrar" />
          </button>
        </>
      )}
    </dialog>
  );
}
