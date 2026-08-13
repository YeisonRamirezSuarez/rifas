import { useCallback, useState } from 'react';
import { IconoUI, type Simbolo } from '../marcas';
import { ESTADO_INICIAL, type Estado, type Pago } from '../rifa';
import { Poster } from './Poster';

type Props = {
  entrar: (email: string, clave: string) => Promise<string | null>;
  registrarse: (email: string, clave: string, nombre: string) => Promise<string | null>;
};

const VENTAJAS: { icono: Simbolo; titulo: string; texto: string }[] = [
  { icono: 'boleta', titulo: 'Rifas ilimitadas', texto: 'Lleva todas las que quieras al tiempo, cada una con su propio tablero y su link.' },
  { icono: 'compartir', titulo: 'Comparte y vende', texto: 'Link público para tus compradores y póster listo para estado de WhatsApp.' },
  { icono: 'dinero', titulo: 'Cuadre de caja', texto: 'Efectivo, transferencia y lo que falta cobrar, siempre al día.' },
  { icono: 'candado', titulo: 'Datos protegidos', texto: 'Los teléfonos de tus compradores solo los ves tú. Nadie más.' },
  { icono: 'pincel', titulo: 'A tu estilo', texto: 'Paletas, tipografías, fondos e íconos. Tu rifa con tu cara.' },
  { icono: 'trofeo', titulo: 'Cierre con ganador', texto: 'Anuncia al ganador con una imagen lista para publicar.' },
];

/**
 * La lámina de la portada. Es el póster de verdad, con el mismo componente que
 * exporta el PNG: la promesa de la página se veía descrita en texto y en ningún
 * lado se veía el producto. Con puestos vendidos para que se lea el tablero.
 */
const VENDIDOS: [number, Pago][] = [
  [3, 'efectivo'],
  [17, 'pendiente'],
  [24, 'efectivo'],
  [41, 'transferencia'],
  [58, 'pendiente'],
  [66, 'efectivo'],
  [79, 'transferencia'],
  [92, 'efectivo'],
];

const MUESTRA: Estado = {
  config: ESTADO_INICIAL.config,
  tickets: Object.fromEntries(
    VENDIDOS.map(([numero, pago]) => [
      numero,
      { numero, comprador: '', telefono: '', pago, vendidoEn: '' },
    ]),
  ),
};

export function Onboarding({ entrar, registrarse }: Props) {
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const crear = modo === 'crear';

  // inert por ref: la muestra tiene cien botones dentro y sin esto el tabulador
  // se los recorre todos antes de llegar al formulario.
  const lamina = useCallback((el: HTMLDivElement | null) => {
    if (el) el.inert = true;
  }, []);

  return (
    <div className="onb">
      <section className="onb__pitch">
        <p className="onb__marca">
          <img src="/logo.svg" alt="" className="onb__logo" />
          Rifas
        </p>
        <h1 className="onb__titulo">
          Tu rifa,
          <span> organizada de verdad</span>
        </h1>
        <p className="onb__bajada">
          Deja el cuaderno y los mensajes sueltos. Tablero en vivo, control de pagos y el póster
          listo para publicar.
        </p>

        <p className="onb__precio">
          <span className="onb__precio-cifra">$15.000</span>
          <span className="onb__precio-nota">pago único · acceso de por vida</span>
        </p>
        <p className="onb__precio-detalle">Sin mensualidades. Sin comisión por boleta.</p>

        <ul className="onb__ventajas">
          {VENTAJAS.map((v) => (
            <li key={v.titulo}>
              <IconoUI id={v.icono} className="onb__ventaja-icono" />
              <div>
                <strong>{v.titulo}</strong>
                <p>{v.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="onb__lado">
        <form
          className="panel onb__form"
          onSubmit={async (ev) => {
            ev.preventDefault();
            setEnviando(true);
            setAviso(crear ? await registrarse(email, clave, nombre) : await entrar(email, clave));
            setEnviando(false);
          }}
        >
          <h2 className="panel__titulo">{crear ? 'Crear mi cuenta' : 'Entrar'}</h2>
          <p className="panel__nota">
            {crear
              ? 'Revisamos cada solicitud a mano. Te avisamos apenas quede activa.'
              : 'Para ver un tablero no hace falta cuenta: basta el link que te compartieron.'}
          </p>

          {crear && (
            <label>
              Tu nombre
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </label>
          )}
          <label>
            Correo
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Contraseña
            <span className="campo-clave">
              <input
                type={verClave ? 'text' : 'password'}
                autoComplete={crear ? 'new-password' : 'current-password'}
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                required
                minLength={6}
                aria-describedby={crear ? 'pista-clave' : undefined}
              />
              <button
                type="button"
                className="campo-clave__ojo"
                onClick={() => setVerClave((v) => !v)}
                aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={verClave}
              >
                <IconoUI id={verClave ? 'ojoTapado' : 'ojo'} />
              </button>
            </span>
          </label>
          {/* La regla se dice antes de escribir, no después de que el envío falle. */}
          {crear && (
            <p className="panel__nota" id="pista-clave">
              Mínimo 6 caracteres.
            </p>
          )}

          {aviso && (
            <p className="dialogo__error" role="alert">
              {aviso}
            </p>
          )}

          <button type="submit" className="boton--primario onb__cta" disabled={enviando}>
            {enviando ? 'Un momento…' : crear ? 'Solicitar mi acceso' : 'Entrar'}
          </button>
          <button
            type="button"
            className="onb__cambio"
            onClick={() => {
              setModo(crear ? 'entrar' : 'crear');
              setAviso(null);
            }}
          >
            {crear ? 'Ya tengo cuenta' : 'Quiero una cuenta'}
          </button>
        </form>

        {/* La prueba: el póster de verdad, no una captura ni una promesa escrita. */}
        <figure className="onb__muestra">
          <div className="onb__lamina" ref={lamina} aria-hidden="true">
            <Poster estado={MUESTRA} onSeleccionar={() => {}} />
          </div>
          <figcaption>Así sale tu póster, listo para el estado de WhatsApp.</figcaption>
        </figure>
      </div>
    </div>
  );
}
