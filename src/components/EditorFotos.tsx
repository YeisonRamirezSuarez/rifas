import { useEffect, useRef, useState } from 'react';
import { borrarFoto, subirFoto } from '../fotos';
import {
  COLORES_TEXTO,
  FOTOS_MAX,
  LARGO_TEXTO_FOTO,
  normalizarFoto,
  type ColorTexto,
  type Config,
  type FotoPoster,
} from '../rifa';

type Props = {
  config: Config;
  configurar: (config: Config) => void;
  rifaId: string;
  confirmar: (titulo: string, o?: { texto?: string; aceptar?: string; peligro?: boolean }) => Promise<boolean>;
  /** Fotos que dejan de usarse. El panel las borra del bucket cuando el guardado confirma. */
  onBorrar: (url: string) => void;
};

const VACIA: FotoPoster = { url: '', texto: '', tam: 16, dx: 0, dy: 0, color: 'crema' };

/**
 * El id del token no dice de qué color sale: cada paleta pinta `vino` a su
 * manera. El lector de pantalla anuncia el papel, que sí es estable.
 */
const NOMBRE_COLOR: Record<ColorTexto, string> = {
  crema: 'claro',
  vino: 'oscuro',
  rosa: 'fuerte',
  'rosa-claro': 'suave',
};

/**
 * Configura el contenido de la hoja 2: cuántas fotos, qué foto, qué dice y
 * dónde. La plantilla, los colores y la grilla no se editan: el cliente arma
 * el contenido, no el diseño.
 */
export function EditorFotos({ config, configurar, rifaId, confirmar, onBorrar }: Props) {
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const guardar = (fotos: FotoPoster[]) => configurar({ ...config, fotos });

  const cambiar = (i: number, parche: Partial<FotoPoster>) =>
    guardar(config.fotos.map((f, n) => (n === i ? normalizarFoto({ ...f, ...parche }) : f)));

  // La subida tarda: al volver, el `cambiar` de este render pisaría lo editado mientras tanto.
  const cambiarVivo = useRef(cambiar);
  cambiarVivo.current = cambiar;

  // Las dos rutas con confirmación guardan después de un `await`, y `guardar`
  // esparce el `config` entero: el de este render ya puede estar viejo.
  const guardarVivo = useRef(guardar);
  guardarVivo.current = guardar;

  // Si el editor se desmonta durante una subida (cambiar de pestaña de ajustes y volver),
  // `cambiarVivo` arma el array con las fotos del editor viejo y resucita el collage quitado.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true; // sin esto, el doble montaje de StrictMode lo deja en false
    return () => {
      montado.current = false;
    };
  }, []);

  const quitarFotos = async () => {
    const ok = await confirmar('¿Quitar la hoja de fotos?', {
      texto: 'Se pierden las fotos, sus textos y su posición. El póster vuelve a una sola hoja.',
      aceptar: 'Quitar las fotos',
      peligro: true,
    });
    if (!ok || !montado.current) return;
    for (const f of config.fotos) onBorrar(f.url);
    guardarVivo.current([]);
  };

  const cuantas = async (n: number) => {
    if (n <= 0) return quitarFotos();
    // Bajar el conteo borra las fotos de sobra con su texto y su posición. Solo
    // pregunta si hay algo que perder: tres marcos vacíos no valen un modal.
    const sobran = config.fotos.slice(n).filter((f) => f.url || f.texto.trim()).length;
    if (sobran) {
      const ok = await confirmar(`¿Dejar ${n} ${n === 1 ? 'foto' : 'fotos'}?`, {
        texto: `Se ${sobran === 1 ? 'pierde una foto' : `pierden ${sobran} fotos`} con su texto y su posición.`,
        aceptar: 'Quitar',
        peligro: true,
      });
      if (!ok || !montado.current) return;
    }
    for (const f of config.fotos.slice(n)) onBorrar(f.url);
    const fotos = [...config.fotos];
    while (fotos.length < n) fotos.push({ ...VACIA });
    guardarVivo.current(fotos.slice(0, n));
  };

  const subir = async (i: number, archivo: File) => {
    setSubiendo(i);
    setError(null);
    const vieja = config.fotos[i]?.url ?? '';
    try {
      const { url, error: falla } = await subirFoto(rifaId, archivo);
      // Si la subida falla, la foto no entra en la config: nada queda a medias.
      if (falla) setError(falla);
      else if (url && montado.current) {
        cambiarVivo.current(i, { url });
        onBorrar(vieja);
      } else if (url) {
        // Llegó con el editor desmontado: la config no la referencia, se va ya.
        void borrarFoto(url);
      }
    } finally {
      setSubiendo(null);
    }
  };

  return (
    <div className="editor">
      <p className="panel__nota">
        Con fotos, el póster se descarga en dos hojas: la hoja 1 con los cien números, igual
        que hoy, y la hoja 2 con las fotos. Sin fotos se descarga una sola hoja.
      </p>
      {error && (
        <p className="dialogo__error" role="alert">
          {error}
        </p>
      )}

      <label>
        Cuántas fotos
        <select
          value={config.fotos.length}
          disabled={subiendo !== null}
          onChange={(e) => void cuantas(Number(e.target.value))}
        >
          <option value={0}>Sin fotos</option>
          {Array.from({ length: FOTOS_MAX }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? 'foto' : 'fotos'}
            </option>
          ))}
        </select>
      </label>

      {config.fotos.map((f, i) => (
        <fieldset key={i} className="editor__foto">
          <legend>Foto {i + 1}</legend>

          {f.url && (
            <div
              className="editor__previo"
              style={{ backgroundImage: `url("${f.url}")` }}
              role="img"
              aria-label={`Foto ${i + 1}`}
            />
          )}
          <label>
            {f.url ? 'Cambiar la foto' : 'Elegir la foto'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={subiendo !== null}
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                e.target.value = '';
                if (archivo) void subir(i, archivo);
              }}
            />
          </label>
          {subiendo === i && (
            <p className="panel__nota" role="status">
              Subiendo…
            </p>
          )}

          <label>
            Texto encima (opcional)
            <input
              value={f.texto}
              maxLength={LARGO_TEXTO_FOTO}
              placeholder="Moto Honda XR 150"
              onChange={(e) => cambiar(i, { texto: e.target.value })}
            />
          </label>

          <label>
            Tamaño del texto: {f.tam}
            <input
              type="range"
              min={8}
              max={34}
              value={f.tam}
              onChange={(e) => cambiar(i, { tam: Number(e.target.value) })}
            />
          </label>

          <label>
            Mover a los lados: {f.dx}
            <input
              type="range"
              min={-60}
              max={60}
              value={f.dx}
              onChange={(e) => cambiar(i, { dx: Number(e.target.value) })}
            />
          </label>

          <label>
            Subir o bajar: {f.dy}
            <input
              type="range"
              min={-70}
              max={70}
              value={f.dy}
              onChange={(e) => cambiar(i, { dy: Number(e.target.value) })}
            />
          </label>

          <p className="panel__etiqueta" id={`color-foto-${i}`}>
            Color del texto
          </p>
          <div className="editor__colores" role="group" aria-labelledby={`color-foto-${i}`}>
            {COLORES_TEXTO.map((color) => (
              <button
                key={color}
                type="button"
                aria-pressed={f.color === color}
                aria-label={NOMBRE_COLOR[color]}
                className={`editor__color${f.color === color ? ' editor__color--activo' : ''}`}
                style={{ background: `var(--${color})` }}
                onClick={() => cambiar(i, { color })}
              />
            ))}
          </div>
        </fieldset>
      ))}

      {config.fotos.length > 0 && (
        <button type="button" disabled={subiendo !== null} onClick={() => void quitarFotos()}>
          Volver al diseño original (sin fotos)
        </button>
      )}
    </div>
  );
}
