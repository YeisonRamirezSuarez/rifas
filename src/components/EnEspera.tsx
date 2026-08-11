import { IconoUI } from '../marcas';
import type { Perfil } from '../usePerfil';

type Props = { perfil: Perfil | null; salir: () => void };

/** Pantalla para la cuenta creada pero todavía sin aprobar. */
export function EnEspera({ perfil, salir }: Props) {
  const rechazada = perfil?.estado === 'rechazado';

  return (
    <section className="panel espera">
      <IconoUI id={rechazada ? 'bloqueado' : 'reloj'} className="espera__icono" />
      <h1 className="panel__titulo">
        {rechazada ? 'Solicitud no aprobada' : 'Tu cuenta está en revisión'}
      </h1>

      {rechazada ? (
        <p className="espera__texto">
          No pudimos activar esta cuenta. Si crees que es un error, escríbenos y la revisamos.
        </p>
      ) : (
        <>
          <p className="espera__texto">
            Recibimos tu solicitud con el correo <strong>{perfil?.email}</strong>. Revisamos cada
            una a mano para cuidar la plataforma.
          </p>
          <p className="espera__texto">
            Apenas quede activa podrás entrar con la misma contraseña y crear todas tus rifas.
          </p>
          <p className="espera__precio">Acceso de por vida · pago único de $15.000</p>
        </>
      )}

      <button type="button" onClick={salir}>
        Salir
      </button>
    </section>
  );
}
