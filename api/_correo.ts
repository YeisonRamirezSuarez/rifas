/**
 * Envío de correos por Brevo. Vive en el servidor a propósito: la API key nunca
 * puede viajar al navegador, por eso NO lleva prefijo VITE_.
 *
 * Cada llamada exige el token de sesión de Supabase, así el endpoint no queda
 * abierto para que cualquiera mande correos desde tu cuenta.
 */

export type TipoCorreo = 'solicitud' | 'aprobada' | 'rechazada';

export type Peticion = {
  tipo: TipoCorreo;
  nombre?: string;
  email?: string;
};

const marco = (titulo: string, cuerpo: string, pie = '') => `
<div style="margin:0;padding:32px 16px;background:#4a2123;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#63302f;border-radius:14px;overflow:hidden">
    <div style="padding:28px 32px 8px;text-align:center">
      <p style="margin:0;color:#f2a2a2;font-size:12px;letter-spacing:4px;text-transform:uppercase">Rifas</p>
      <h1 style="margin:8px 0 0;color:#fbefea;font-size:26px;font-weight:700">${titulo}</h1>
    </div>
    <div style="padding:8px 32px 28px;color:#fbefea;font-size:15px;line-height:1.6">
      ${cuerpo}
    </div>
    ${
      pie
        ? `<div style="padding:16px 32px;background:#00000022;color:#f7bdbd;font-size:12px;text-align:center">${pie}</div>`
        : ''
    }
  </div>
</div>`;

const boton = (texto: string, url: string) =>
  `<p style="text-align:center;margin:24px 0 8px">
     <a href="${url}" style="display:inline-block;padding:12px 26px;border-radius:999px;background:#f2a2a2;color:#63302f;font-weight:700;text-decoration:none">${texto}</a>
   </p>`;

function plantilla(tipo: TipoCorreo, nombre: string, email: string, sitio: string) {
  const hola = nombre ? `Hola ${nombre.split(' ')[0]},` : 'Hola,';

  if (tipo === 'solicitud') {
    return {
      paraUsuario: {
        asunto: 'Recibimos tu solicitud · Rifas',
        html: marco(
          'Tu solicitud está en revisión',
          `<p>${hola}</p>
           <p>Recibimos tu solicitud de acceso con el correo <strong>${email}</strong>.
              Revisamos cada cuenta a mano, así que dale unas horas.</p>
           <p>Apenas quede activa te llega otro correo y ya puedes entrar con la misma contraseña.</p>
           <p style="margin-top:20px;padding:14px 16px;background:#00000022;border-radius:10px">
             <strong style="color:#f2a2a2">Acceso de por vida por $15.000</strong><br>
             Pago único. Sin mensualidades ni comisión por boleta.
           </p>`,
          'Si no fuiste tú, ignora este mensaje.',
        ),
      },
      paraSuperadmin: {
        asunto: `Nueva solicitud de acceso: ${email}`,
        html: marco(
          'Nueva solicitud',
          `<p><strong>${nombre || 'Sin nombre'}</strong> pidió acceso.</p>
           <p>Correo: <strong>${email}</strong></p>
           <p>Entra al panel para aprobarla o rechazarla.</p>
           ${boton('Ver solicitudes', sitio)}`,
        ),
      },
    };
  }

  if (tipo === 'aprobada') {
    return {
      paraUsuario: {
        asunto: '¡Tu cuenta ya está activa! · Rifas',
        html: marco(
          '¡Bienvenido!',
          `<p>${hola}</p>
           <p>Tu cuenta quedó activa. Ya puedes entrar y crear todas las rifas que necesites.</p>
           <ul style="padding-left:18px">
             <li>Tablero en vivo con los puestos vendidos</li>
             <li>Control de pagos en efectivo y transferencia</li>
             <li>Póster y anuncio del ganador listos para WhatsApp</li>
           </ul>
           ${boton('Entrar ahora', sitio)}`,
          'Gracias por confiar en nosotros.',
        ),
      },
      paraSuperadmin: null,
    };
  }

  return {
    paraUsuario: {
      asunto: 'Sobre tu solicitud · Rifas',
      html: marco(
        'No pudimos activar tu cuenta',
        `<p>${hola}</p>
         <p>Revisamos tu solicitud con el correo <strong>${email}</strong> y por ahora no pudimos activarla.</p>
         <p>Si crees que es un error, responde a este correo y la miramos de nuevo.</p>`,
      ),
    },
    paraSuperadmin: null,
  };
}

// Brevo solo entrega desde un remitente verificado en la cuenta. Con un dominio
// sin verificar acepta la llamada (201) pero el correo cae en spam o se pierde.
async function enviar(apiKey: string, remitente: string, para: string, asunto: string, html: string) {
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Rifas', email: remitente },
      to: [{ email: para }],
      subject: asunto,
      htmlContent: html,
    }),
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

const supabase = () => ({
  url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  anon: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
});

/** Comprueba contra Supabase que el token sea de una sesión real. */
async function usuarioDelToken(token: string) {
  const { url, anon } = supabase();
  if (!url || !anon) throw new Error('Falta la configuración de Supabase en el servidor.');
  const r = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  return (await r.json()) as { id: string; email: string };
}

/** Solo un superadmin puede avisar de cuentas aprobadas o rechazadas. */
async function esSuperadmin(token: string, id: string): Promise<boolean> {
  const { url, anon } = supabase();
  const r = await fetch(`${url}/rest/v1/perfiles?select=rol&id=eq.${id}`, {
    headers: { apikey: anon!, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return false;
  const filas = (await r.json()) as { rol: string }[];
  return filas[0]?.rol === 'superadmin';
}

export async function manejarCorreo(
  cuerpo: Peticion,
  token: string | null,
  origen: string,
): Promise<{ estado: number; datos: unknown }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { estado: 500, datos: { error: 'Falta BREVO_API_KEY en el servidor.' } };
  // Sin estas dos, los avisos salen desde —o van a— el buzón de quien escribió el
  // código. Fallar ruidoso: un correo perdido no se nota hasta que alguien reclama.
  const remitente = process.env.BREVO_REMITENTE;
  const superadmin = process.env.SUPERADMIN_EMAIL;
  if (!remitente || !superadmin)
    return {
      estado: 500,
      datos: { error: 'Falta BREVO_REMITENTE o SUPERADMIN_EMAIL en el servidor.' },
    };
  if (!token) return { estado: 401, datos: { error: 'Sin sesión.' } };

  const usuario = await usuarioDelToken(token);
  if (!usuario) return { estado: 401, datos: { error: 'Sesión inválida.' } };

  // Para su propia solicitud, el destinatario es siempre el propio usuario:
  // así nadie puede usar el endpoint para escribirle a terceros. Y avisar de
  // una cuenta aprobada o rechazada queda reservado al superadmin.
  if (cuerpo.tipo !== 'solicitud' && !(await esSuperadmin(token, usuario.id))) {
    return { estado: 403, datos: { error: 'Solo un superadmin puede enviar este aviso.' } };
  }

  const destino = cuerpo.tipo === 'solicitud' ? usuario.email : cuerpo.email;
  if (!destino) return { estado: 400, datos: { error: 'Falta el correo de destino.' } };

  const { paraUsuario, paraSuperadmin } = plantilla(
    cuerpo.tipo,
    cuerpo.nombre ?? '',
    destino,
    origen,
  );

  try {
    await enviar(apiKey, remitente, destino, paraUsuario.asunto, paraUsuario.html);
    if (paraSuperadmin)
      await enviar(apiKey, remitente, superadmin, paraSuperadmin.asunto, paraSuperadmin.html);
    return { estado: 200, datos: { ok: true } };
  } catch (e) {
    return { estado: 502, datos: { error: e instanceof Error ? e.message : 'Error enviando.' } };
  }
}
