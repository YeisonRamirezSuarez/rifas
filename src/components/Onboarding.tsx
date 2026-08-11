import { useState } from 'react';

type Props = {
  entrar: (email: string, clave: string) => Promise<string | null>;
  registrarse: (email: string, clave: string, nombre: string) => Promise<string | null>;
};

const VENTAJAS = [
  { icono: '🎟️', titulo: 'Rifas ilimitadas', texto: 'Lleva todas las que quieras al tiempo, cada una con su propio tablero y su link.' },
  { icono: '📲', titulo: 'Comparte y vende', texto: 'Link público para tus compradores y póster listo para estado de WhatsApp.' },
  { icono: '💵', titulo: 'Cuadre de caja', texto: 'Efectivo, transferencia y lo que falta cobrar, siempre al día.' },
  { icono: '🔒', titulo: 'Datos protegidos', texto: 'Los teléfonos de tus compradores solo los ves tú. Nadie más.' },
  { icono: '🎨', titulo: 'A tu estilo', texto: 'Paletas, tipografías, fondos e íconos. Tu rifa con tu cara.' },
  { icono: '🏆', titulo: 'Cierre con ganador', texto: 'Anuncia al ganador con una imagen lista para publicar.' },
];

export function Onboarding({ entrar, registrarse }: Props) {
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const crear = modo === 'crear';

  return (
    <div className="onb">
      <section className="onb__pitch">
        <p className="onb__marca">Rifas</p>
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
              <span aria-hidden="true">{v.icono}</span>
              <div>
                <strong>{v.titulo}</strong>
                <p>{v.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

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
          <input
            type="password"
            autoComplete={crear ? 'new-password' : 'current-password'}
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            required
            minLength={6}
          />
        </label>

        {aviso && <p className="dialogo__error">{aviso}</p>}

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
    </div>
  );
}
