import { useState } from 'react';
import type { ResumenRifa } from '../useRifa';

type Props = {
  rifas: ResumenRifa[];
  actual: string;
  hayNube: boolean;
  linkPublico: (id: string) => string;
  seleccionar: (id: string) => void;
  crear: (titulo: string) => Promise<string | null>;
  eliminar: (id: string) => Promise<string | null>;
  salir: () => void;
  confirmar: (titulo: string, o?: { texto?: string; aceptar?: string; peligro?: boolean }) => Promise<boolean>;
};

/** Lista de rifas de la cuenta: cambiar entre ellas, crear, borrar y copiar el link. */
export function MisRifas({
  rifas,
  actual,
  hayNube,
  linkPublico,
  seleccionar,
  crear,
  eliminar,
  salir,
  confirmar,
}: Props) {
  const [titulo, setTitulo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(linkPublico(actual));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError('No se pudo copiar. Copia el link desde la barra del navegador.');
    }
  };

  return (
    <aside className="panel misrifas">
      <div className="misrifas__cabecera">
        <h2 className="panel__titulo">Mis rifas</h2>
        {hayNube && (
          <button type="button" onClick={salir}>
            Salir
          </button>
        )}
      </div>

      <ul className="misrifas__lista">
        {rifas.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              aria-current={r.id === actual}
              className={`misrifas__item${r.id === actual ? ' misrifas__item--activa' : ''}`}
              onClick={() => seleccionar(r.id)}
            >
              <strong>{r.titulo}</strong>
              {r.premio && <span>{r.premio}</span>}
            </button>
          </li>
        ))}
      </ul>

      <form
        className="misrifas__nueva"
        onSubmit={async (ev) => {
          ev.preventDefault();
          setOcupado(true);
          setError(await crear(titulo));
          setOcupado(false);
          setTitulo('');
        }}
      >
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Nombre de la rifa nueva"
          aria-label="Nombre de la rifa nueva"
        />
        <button type="submit" className="boton--primario" disabled={ocupado}>
          Crear
        </button>
      </form>

      {actual && (
        <div className="dialogo__acciones">
          {hayNube && (
            <button type="button" onClick={copiar}>
              {copiado ? '¡Link copiado!' : 'Copiar link público'}
            </button>
          )}
          <button
            type="button"
            className="boton--peligro"
            disabled={rifas.length <= 1}
            title={rifas.length <= 1 ? 'Debe quedar al menos una rifa' : undefined}
            onClick={async () => {
              const ok = await confirmar('¿Borrar esta rifa?', {
                texto: 'Se pierden todos sus números vendidos. No se puede deshacer.',
                aceptar: 'Borrar rifa',
                peligro: true,
              });
              if (ok) setError(await eliminar(actual));
            }}
          >
            Borrar rifa
          </button>
        </div>
      )}

      {error && <p className="dialogo__error">{error}</p>}
    </aside>
  );
}
