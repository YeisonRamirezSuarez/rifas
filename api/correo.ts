import { manejarCorreo, type Peticion } from './_correo';

/** Función serverless de Vercel: POST /api/correo */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 });

  const token = req.headers.get('authorization')?.replace(/^Bearer /i, '') ?? null;
  // El dominio de verdad manda sobre el de la petición: así los botones de los
  // correos no apuntan a una URL de preview de Vercel ni al localhost de dev.
  const origen = (process.env.VITE_SITIO_URL || new URL(req.url).origin).replace(/\/+$/, '');
  const cuerpo = (await req.json()) as Peticion;

  const { estado, datos } = await manejarCorreo(cuerpo, token, origen);
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config = { runtime: 'edge' };
