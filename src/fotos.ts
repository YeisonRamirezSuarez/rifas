import { nube } from './nube';

export const BUCKET = 'fotos';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
/** Más de esto tarda en subir con datos del celular y no mejora el PNG de 1080px. */
const MAX_BYTES = 3 * 1024 * 1024;

/**
 * El nombre que llega del celular no se usa: lleva espacios, tildes y hasta
 * `../`. Solo se conserva la extensión, y la carpeta es el id de la rifa, que
 * es lo que mira la política de RLS.
 */
export function rutaFoto(rifaId: string, nombre: string, ahora = Date.now()): string {
  const ext = nombre.toLowerCase().match(/\.(jpe?g|png|webp)$/)?.[1] ?? 'jpg';
  // La hora sola se repite: dos subidas en el mismo milisegundo dan la misma
  // ruta y, con `upsert: false`, la segunda falla sin razón visible.
  const azar = Math.random().toString(36).slice(2, 8);
  return `${rifaId}/${ahora}-${azar}.${ext === 'jpeg' ? 'jpg' : ext}`;
}

export async function subirFoto(
  rifaId: string,
  archivo: File,
): Promise<{ url?: string; error?: string }> {
  if (!nube) return { error: 'Sin nube no se pueden guardar fotos.' };
  if (!rifaId) return { error: 'Abre una rifa antes de subir fotos.' };
  if (!TIPOS.includes(archivo.type)) return { error: 'La foto debe ser JPG, PNG o WEBP.' };
  if (archivo.size > MAX_BYTES) return { error: 'La foto pesa más de 3 MB. Usa una más liviana.' };

  const ruta = rutaFoto(rifaId, archivo.name);
  const { error } = await nube.storage.from(BUCKET).upload(ruta, archivo, { upsert: false });
  // El mensaje de Supabase viene en inglés: se deja al final, para poder diagnosticar.
  if (error) return { error: `No se pudo subir la foto. Intenta de nuevo. (${error.message})` };
  return { url: nube.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl };
}

const PUBLICA = `/storage/v1/object/public/${BUCKET}/`;

/** La ruta dentro del bucket, o `null` si la URL no es de este bucket. */
export function rutaDeUrl(url: string): string | null {
  const i = url.indexOf(PUBLICA);
  if (i < 0) return null;
  const ruta = url.slice(i + PUBLICA.length).split('?')[0];
  // Sin archivo al final (`.../fotos/<rifa>/`) no hay nada que borrar: es la carpeta.
  return ruta && !ruta.endsWith('/') ? decodeURIComponent(ruta) : null;
}

/**
 * Borra la foto del bucket. No devuelve el error a propósito: un archivo que no
 * se pudo borrar es un huérfano que no le estorba a nadie, y quien lo pidió ya
 * siguió con lo suyo. Una URL que no sea de este bucket no se toca.
 */
export async function borrarFoto(url: string): Promise<void> {
  const ruta = url ? rutaDeUrl(url) : null;
  if (!nube || !ruta) return;
  await nube.storage.from(BUCKET).remove([ruta]);
}
