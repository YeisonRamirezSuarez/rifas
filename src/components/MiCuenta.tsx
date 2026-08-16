import { useEffect, useState, type FormEvent } from 'react';
import { LARGO_MAXIMO } from '../cuentas';
import type { Perfil } from '../usePerfil';

type Props = {
  perfil: Perfil;
  guardarNombre: (nuevo: string) => Promise<string | null>;
};

const ESTADO: Record<Perfil['estado'], string> = {
  pendiente: 'En revisión',
  aprobado: 'Activa',
  rechazado: 'Desactivada',
};


const ID_ERROR = 'mi-cuenta-error';

/** El perfil propio. El correo no se edita aquí: cambiarlo es otro trámite. */
export function MiCuenta({ perfil, guardarNombre }: Props) {
  const [nombre, setNombre] = useState(perfil.nombre ?? '');
  const [aviso, setAviso] = useState<string | null>(null);
  // 'vacio' y no un booleano: guardar solo espacios borra el nombre en el
  // servidor (nullif(trim(...), '')) y eso no es el mismo aviso que guardar
  // un nombre de verdad, aunque técnicamente la operación haya salido bien.
  const [guardado, setGuardado] = useState<'nombre' | 'vacio' | null>(null);
  const [enviando, setEnviando] = useState(false);

  // El servidor guarda con trim (y limpia el nombre si queda vacío): sin este
  // efecto el campo se quedaba mostrando lo que se escribió, no lo que quedó
  // realmente guardado.
  useEffect(() => {
    setNombre(perfil.nombre ?? '');
  }, [perfil.nombre]);

  const sucio = nombre.trim() !== (perfil.nombre ?? '').trim();

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    const quedaVacio = nombre.trim() === '';
    setEnviando(true);
    const err = await guardarNombre(nombre);
    setAviso(err);
    setGuardado(err ? null : quedaVacio ? 'vacio' : 'nombre');
    setEnviando(false);
  };

  return (
    <form className="panel" onSubmit={enviar}>
      <h2 className="panel__titulo">Mi cuenta</h2>
      <p className="panel__nota">
        {perfil.email} · {ESTADO[perfil.estado]}
      </p>

      <label>
        Tu nombre
        <input
          value={nombre}
          maxLength={LARGO_MAXIMO}
          disabled={enviando}
          aria-invalid={!!aviso}
          aria-describedby={aviso ? ID_ERROR : undefined}
          onChange={(e) => {
            setNombre(e.target.value);
            setGuardado(null);
            setAviso(null);
          }}
        />
      </label>

      {aviso && (
        <>
          <p id={ID_ERROR} className="dialogo__error" role="alert">
            No pudimos guardar el nombre. Intenta de nuevo.
          </p>
          {/* Detalle técnico, para soporte y no para asustar al resto. */}
          <p className="panel__nota">{aviso}</p>
        </>
      )}
      {guardado === 'nombre' && (
        <p className="panel__nota" role="status">
          Listo, nombre guardado.
        </p>
      )}
      {guardado === 'vacio' && (
        <p className="panel__nota" role="status">
          Guardado sin nombre: quedó en blanco.
        </p>
      )}

      <button type="submit" disabled={!sucio || enviando}>
        {enviando ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}
