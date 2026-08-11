import { forwardRef } from 'react';
import { Florituras } from '../fondos';
import { etiqueta, formatearFecha, ganador, taparNombre, type Estado } from '../rifa';

type Props = { estado: Estado; verNombre: boolean };

/** Tarjeta de anuncio del ganador, pensada para exportar y publicar. */
export const Ganador = forwardRef<HTMLElement, Props>(function Ganador({ estado, verNombre }, ref) {
  const c = estado.config;
  if (c.numeroGanador === null) return null;
  const premiado = ganador(estado);

  return (
    <article className="poster ganador" ref={ref}>
      <Florituras id={c.fondo} />

      <header className="poster__cabecera">
        <p className="ganador__antetitulo">
          {c.titulo} · {formatearFecha(c.fechaJuego)}
        </p>
        <h1 className="ganador__titulo">¡Tenemos ganador!</h1>
      </header>

      <div className="ganador__cuerpo">
        <p className="ganador__label">Número ganador</p>
        <p className="ganador__numero">{etiqueta(c.numeroGanador, c.totalNumeros)}</p>

        {premiado ? (
          <p className="ganador__nombre">
            {verNombre ? premiado.comprador : taparNombre(premiado.comprador)}
          </p>
        ) : (
          <p className="ganador__nombre ganador__nombre--vacio">Número sin vender</p>
        )}

        {c.premio && <p className="ganador__premio">se lleva {c.premio}</p>}
      </div>

      <footer className="poster__pie">
        {c.loteria && <p className="poster__loteria">{c.loteria}</p>}
        <p className="ganador__gracias">¡Gracias a todos por participar!</p>
        <p className="poster__contacto">
          {c.etiquetaContacto}: {c.contacto}
        </p>
      </footer>
    </article>
  );
});
