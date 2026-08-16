import { useState } from 'react';
import { IconoUI } from '../marcas';

type Props = {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  autoComplete: 'new-password' | 'current-password';
  id?: string;
  /** id del texto de ayuda que describe el campo, para lectores de pantalla. */
  describedBy?: string;
};

/** Input de contraseña con ojo. Cada pantalla que pide clave necesita el mismo. */
export function CampoClave({ etiqueta, valor, onCambio, autoComplete, id, describedBy }: Props) {
  const [ver, setVer] = useState(false);

  return (
    <label>
      {etiqueta}
      <span className="campo-clave">
        <input
          id={id}
          type={ver ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          required
          minLength={6}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className="campo-clave__ojo"
          onClick={() => setVer((v) => !v)}
          aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={ver}
        >
          <IconoUI id={ver ? 'ojoTapado' : 'ojo'} />
        </button>
      </span>
    </label>
  );
}
