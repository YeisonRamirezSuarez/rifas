import { nube } from './nube';

export type TipoCorreo = 'solicitud' | 'aprobada' | 'rechazada';

/**
 * Pide al servidor que mande un correo por Brevo. La API key vive allá;
 * aquí solo va el token de sesión para que el endpoint no quede abierto.
 * Si falla no se interrumpe el flujo: el correo es un aviso, no el trámite.
 */
export async function enviarCorreo(
  tipo: TipoCorreo,
  datos: { nombre?: string; email?: string } = {},
): Promise<string | null> {
  if (!nube) return null;
  try {
    const { data } = await nube.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return 'Sin sesión para enviar el correo.';

    const r = await fetch('/api/correo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tipo, ...datos }),
    });
    if (!r.ok) return ((await r.json().catch(() => null))?.error as string) ?? `Error ${r.status}`;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'No se pudo enviar el correo.';
  }
}
