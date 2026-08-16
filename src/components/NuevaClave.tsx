import { useState, type FormEvent } from 'react';
import { IconoUI } from '../marcas';
import { CampoClave } from './CampoClave';

type Props = {
  cambiarClave: (nueva: string) => Promise<string | null>;
  salir: () => void;
};

/** Se llega aquí desde el enlace del correo, ya con sesión abierta pero sin clave. */
export function NuevaClave({ cambiarClave, salir }: Props) {
  const [clave, setClave] = useState('');
  const [repetir, setRepetir] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const guardar = async (ev: FormEvent) => {
    ev.preventDefault();
    if (clave !== repetir) {
      setAviso('Las dos contraseñas no coinciden.');
      return;
    }
    setEnviando(true);
    setAviso(await cambiarClave(clave));
    setEnviando(false);
  };

  return (
    <form className="panel espera" onSubmit={guardar}>
      <IconoUI id="candado" className="espera__icono" />
      <h1 className="panel__titulo">Pon tu contraseña nueva</h1>
      <p className="espera__texto">
        Entraste desde el enlace del correo. Elige una contraseña y sigues directo a tus rifas.
      </p>

      <CampoClave
        etiqueta="Contraseña nueva"
        valor={clave}
        onCambio={setClave}
        autoComplete="new-password"
        describedBy="pista-clave-nueva"
      />
      <CampoClave
        etiqueta="Repítela"
        valor={repetir}
        onCambio={setRepetir}
        autoComplete="new-password"
        describedBy="pista-clave-nueva"
      />
      <p className="panel__nota" id="pista-clave-nueva">
        Mínimo 6 caracteres.
      </p>

      {aviso && (
        <p className="dialogo__error" role="alert">
          {aviso}
        </p>
      )}

      <button type="submit" className="boton--primario" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar y entrar'}
      </button>
      {/* La marca de recuperación vive en localStorage y esta pantalla gana sobre todas
          las demás, así que sin este botón un enlace abierto y abandonado deja el
          navegador mostrando el formulario incluso al abrir el link público de una rifa.
          `salir` es lo único que borra la marca sin cambiar la contraseña: que se note. */}
      <button type="button" onClick={salir}>
        No quiero cambiarla ahora
      </button>
    </form>
  );
}
