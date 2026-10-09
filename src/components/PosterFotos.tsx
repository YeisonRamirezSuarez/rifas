import { forwardRef } from 'react';
import { Florituras } from '../fondos';
import { Icono } from '../marcas';
import { formatearFecha, formatearPrecio, type Estado } from '../rifa';

/** La lámina se maqueta a 720px: el editor guarda px sobre ese ancho. */
const ANCHO_LAMINA = 720;
const cqi = (px: number) => `${(px / ANCHO_LAMINA) * 100}cqi`;

/**
 * Hoja 2: las fotos del premio, con la identidad de la hoja 1 —mismo fondo,
 * mismo sello, misma cinta— y abajo valor, lotería y contacto, para que sirva
 * sola si alguien solo recibe esta imagen.
 *
 * El collage no se mete en la hoja de números: a 1080px de ancho, con fotos
 * arriba, cada casilla queda de 2 a 3 mm y los números dejan de leerse.
 */
export const PosterFotos = forwardRef<HTMLElement, { estado: Estado }>(function PosterFotos(
  { estado },
  ref,
) {
  const c = estado.config;

  // El encabezado es el de la hoja 1, copiado tal cual, incluidos los tamaños
  // calculados: `.poster__titulo-1` y `.poster__titulo-2` no traen font-size en
  // el CSS, viene de aquí. Se copia en vez de sacar un componente común para no
  // tocar `Poster.tsx`, que tiene que seguir saliendo identico.
  const [primera = '', ...resto] = c.titulo.trim().split(/\s+/);
  const segunda = resto.join(' ');
  const palabraMasLarga = Math.max(...segunda.split(' ').map((p) => p.length), 6);
  const tamano = { fontSize: `${Math.min(25, 170 / palabraMasLarga)}cqi` };
  const tamanoPrimera = { fontSize: `${Math.min(7, 45 / Math.max(primera.length, 4))}cqi` };

  return (
    <article className={`poster poster--fotos poster--fotos-${c.fotos.length}`} ref={ref}>
      <Florituras id={c.fondo} />

      <header className="poster__cabecera">
        <h1 className="poster__titulo">
          <span className="poster__linea-1">
            <Icono id={c.marca} className="poster__sello" />
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

      <div className="fotos">
        {c.fotos.map((f, i) => (
          <figure
            key={i}
            className="fotos__marco"
            style={f.url ? { backgroundImage: `url("${f.url}")` } : undefined}
          >
            {f.texto.trim() && (
              <figcaption
                className={`fotos__texto fotos__texto--${f.color}`}
                style={{
                  fontSize: cqi(f.tam),
                  color: `var(--${f.color})`,
                  transform: `translate(${cqi(f.dx)}, ${cqi(f.dy)})`,
                }}
              >
                {f.texto}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      {/* El pie también es el de la hoja 1, sin la rama del ganador: la hoja 2
          solo se genera con la rifa abierta. */}
      <footer className="poster__pie">
        <p className="poster__valor-label">Valor:</p>
        <p className="poster__valor">
          <span>{formatearPrecio(c.precio, c.moneda)}</span>
          <Icono id={c.marca} className="poster__sello poster__sello--pie" />
        </p>
        <p className="poster__mensaje">{c.mensaje}</p>
        <p className="poster__contacto">
          {c.etiquetaContacto}: {c.contacto}
        </p>
        {c.responsable && <p className="poster__responsable">{c.responsable}</p>}
      </footer>
    </article>
  );
});
