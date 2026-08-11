import { useEffect, useState } from 'react';

type Props = {
  valor: number;
  onCambio: (valor: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

/**
 * Input numérico que se puede dejar vacío mientras se escribe.
 * Confirma al salir del campo, no en cada tecla: `Number('')` es 0, así que
 * escribir "100" pasaría por 1 y 10 — y en "cantidad de números" eso borra ventas.
 */
export function CampoNumero({ valor, onCambio, min, max, step }: Props) {
  const [texto, setTexto] = useState(String(valor));

  useEffect(() => setTexto(String(valor)), [valor]);

  const confirmar = () => {
    if (texto.trim() === '' || Number.isNaN(Number(texto))) {
      setTexto(String(valor)); // vacío al salir: se queda el valor anterior
      return;
    }
    onCambio(Number(texto));
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={step}
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}
