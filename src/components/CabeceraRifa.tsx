import { avance, formatearFecha, formatearPrecio, type Estado } from '../rifa';

/**
 * En qué va la rifa, arriba del tablero: qué se rifa, cuándo juega, a cuánto y
 * cuánto se ha vendido. La foto del premio es opcional: sin foto la cabecera se
 * ve completa, sin marco vacío ni hueco. Va como fondo del marco y no en un
 * `<img>` para que una URL caída no deje el icono roto ni mueva la maqueta.
 */
export function CabeceraRifa({ estado }: { estado: Estado }) {
  const c = estado.config;
  const pct = avance(estado);

  return (
    <section className="cab" aria-label="Resumen de la rifa">
      {c.fotoPremio && (
        <div
          className="cab__foto"
          style={{ backgroundImage: `url("${c.fotoPremio}")` }}
          role="img"
          aria-label="Foto del premio"
        />
      )}
      <div className="cab__datos">
        {/* Párrafo y no `<h2>`: el póster que va debajo abre con un `<h1>`, y un
            h2 antes del h1 deja el recorrido de encabezados al revés. */}
        <p className="cab__premio">{c.premio || c.titulo}</p>
        <p className="cab__linea">
          Juega el {formatearFecha(c.fechaJuego)}
          {c.loteria && ` · ${c.loteria}`}
        </p>
        <p className="cab__linea">
          <strong>{formatearPrecio(c.precio, c.moneda)}</strong> por número
        </p>
        <div className="cab__barra" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="cab__pct">{pct}% vendido</p>
      </div>
    </section>
  );
}
