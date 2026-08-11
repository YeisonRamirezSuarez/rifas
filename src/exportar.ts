import { toPng } from 'html-to-image';

const ANCHO_EXPORT = 1080; // estado de WhatsApp: 1080x1920

export type Imagen = { url: string; blob: Blob; nombre: string };

/**
 * Genera el PNG de un nodo. Fuerza 9:16 mientras dura la captura para que la
 * imagen sirva de estado de WhatsApp sin bordes.
 *
 * Devuelve una URL de Blob, no un `data:`: Chrome bloquea abrir data: URLs en
 * una pestaña nueva, y son las que dejan compartir el archivo de verdad.
 */
export async function generarPng(
  nodo: HTMLElement,
  nombre: string,
): Promise<{ imagen?: Imagen; error?: string }> {
  const alturaPrevia = nodo.style.minHeight;
  const distribucionPrevia = nodo.style.justifyContent;
  nodo.style.minHeight = `${(nodo.offsetWidth * 16) / 9}px`;
  nodo.style.justifyContent = 'space-between';

  try {
    // Si acaban de cambiar la tipografía, esperar a que cargue: si no, el PNG
    // sale con la fuente de respaldo.
    await document.fonts.ready;
    const dataUrl = await toPng(nodo, {
      pixelRatio: ANCHO_EXPORT / nodo.offsetWidth,
      cacheBust: true,
    });
    const blob = await (await fetch(dataUrl)).blob();
    return { imagen: { url: URL.createObjectURL(blob), blob, nombre } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se pudo generar la imagen.' };
  } finally {
    nodo.style.minHeight = alturaPrevia;
    nodo.style.justifyContent = distribucionPrevia;
  }
}

export function descargar({ url, nombre }: Imagen): void {
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `${nombre}.png`;
  enlace.click();
}

function archivo({ blob, nombre }: Imagen): File {
  return new File([blob], `${nombre}.png`, { type: 'image/png' });
}

export function sePuedeCompartir(imagen: Imagen): boolean {
  return !!navigator.canShare?.({ files: [archivo(imagen)] });
}

/** Compartir nativo: en el celular abre WhatsApp y demás directamente. */
export async function compartir(imagen: Imagen): Promise<string | null> {
  try {
    await navigator.share({ files: [archivo(imagen)], title: imagen.nombre });
    return null;
  } catch (e) {
    // El usuario cerró la hoja de compartir: no es un error que valga mostrar.
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    return e instanceof Error ? e.message : 'No se pudo compartir.';
  }
}
