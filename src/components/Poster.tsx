import { forwardRef } from 'react';
import { Florituras } from '../fondos';
import { IconoUI } from '../marcas';
import { etiqueta, formatearFecha, formatearPrecio, type Estado } from '../rifa';
import { Tablero } from './Tablero';

type Props = { estado: Estado; onSeleccionar: (numero: number) => void };

export const Poster = forwardRef<HTMLElement, Props>(function Poster(
  { estado, onSeleccionar },
  ref,
) {
  const c = estado.config;
  const [primera = '', ...resto] = c.titulo.trim().split(/\s+/);
  const segunda = resto.join(' ');

  // El título grande se encoge según su palabra más larga: si no, un título de
  // varias palabras se sale del póster y `overflow: hidden` lo recorta.
  const palabraMasLarga = Math.max(...segunda.split(' ').map((p) => p.length), 6);
  const tamano = { fontSize: `${Math.min(25, 170 / palabraMasLarga)}cqi` };
  const tamanoPrimera = { fontSize: `${Math.min(7, 45 / Math.max(primera.length, 4))}cqi` };

  return (
    <article className="poster" ref={ref}>
      <Florituras id={c.fondo} />

      <header className="poster__cabecera">
        <h1 className="poster__titulo">
          <span className="poster__linea-1">
            <IconoUI id="corazon" className="poster__corazon" />
            <span className="poster__titulo-1" style={tamanoPrimera}>
              {primera}
            </span>
          </span>
          <span className="poster__titulo-2" style={tamano}>
            {segunda}
          </span>
        </h1>
        <p className="poster__cinta">Juega el {formatearFecha(c.fechaJuego)}</p>
        {c.premio && <p className="poster__premio">{c.premio}</p>}
        {c.loteria && <p className="poster__loteria">{c.loteria}</p>}
      </header>

      <Tablero estado={estado} onSeleccionar={onSeleccionar} />

      <footer className="poster__pie">
        {c.finalizado && c.numeroGanador !== null ? (
          <p className="poster__ganador">
            Número ganador: <strong>{etiqueta(c.numeroGanador, c.totalNumeros)}</strong>
          </p>
        ) : (
          <>
            <p className="poster__valor-label">Valor:</p>
            <p className="poster__valor">
              <span>{formatearPrecio(c.precio, c.moneda)}</span>
              <IconoUI id="corazon" className="poster__corazon poster__corazon--pie" />
            </p>
          </>
        )}
        <p className="poster__mensaje">{c.mensaje}</p>
        <p className="poster__contacto">
          {c.etiquetaContacto}: {c.contacto}
        </p>
        {c.responsable && <p className="poster__responsable">{c.responsable}</p>}
      </footer>
    </article>
  );
});
