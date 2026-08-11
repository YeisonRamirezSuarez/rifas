import { useCallback, useEffect, useRef, useState } from 'react';

type Pregunta = {
  titulo: string;
  texto?: string;
  aceptar?: string;
  peligro?: boolean;
  resolver: (ok: boolean) => void;
};

/**
 * Confirmación con el modal de la app en vez del `confirm()` del navegador.
 * Devuelve una promesa, así el código que la usa se lee igual que antes.
 */
export function useConfirmar() {
  const [pregunta, setPregunta] = useState<Pregunta | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (pregunta && !d.open) d.showModal();
    if (!pregunta && d.open) d.close();
  }, [pregunta]);

  const confirmar = useCallback(
    (titulo: string, opciones: { texto?: string; aceptar?: string; peligro?: boolean } = {}) =>
      new Promise<boolean>((resolver) => setPregunta({ titulo, ...opciones, resolver })),
    [],
  );

  const responder = (ok: boolean) => {
    pregunta?.resolver(ok);
    setPregunta(null);
  };

  const dialogo = (
    <dialog
      ref={ref}
      className="dialogo dialogo--confirmar"
      onCancel={(e) => {
        e.preventDefault();
        responder(false);
      }}
    >
      {pregunta && (
        <>
          <h2 className="dialogo__titulo">{pregunta.titulo}</h2>
          {pregunta.texto && <p className="dialogo__etiqueta">{pregunta.texto}</p>}
          <div className="dialogo__acciones">
            <button
              type="button"
              className={pregunta.peligro ? 'boton--peligro' : 'boton--primario'}
              onClick={() => responder(true)}
              autoFocus
            >
              {pregunta.aceptar ?? 'Aceptar'}
            </button>
            <button type="button" onClick={() => responder(false)}>
              Cancelar
            </button>
          </div>
        </>
      )}
    </dialog>
  );

  return { confirmar, dialogo };
}
