import { toPng } from 'html-to-image';

const ANCHO_EXPORT = 1080; // estado de WhatsApp: 1080x1920
/** Ancho al que se maqueta la lámina. Es el mismo del póster en escritorio. */
const ANCHO_LAMINA = 720;

export type Imagen = { url: string; blob: Blob; nombre: string };

/**
 * Genera el PNG de un nodo. Fuerza 9:16 para que la imagen sirva de estado de
 * WhatsApp sin bordes.
 *
 * Se dibuja sobre una copia de 720px fuera de la vista, no sobre el póster que
 * está en pantalla: en el celular el póster se maqueta más angosto y más alto
 * (tablero al 94%, 1.97 de alto por 1 de ancho), y el PNG salía 1080x2126 —
 * más largo que un estado, así que WhatsApp lo recortaba. A 720px la
 * proporción natural es 1.735 y el `min-height` la estira justo a 9:16.
 *
 * Devuelve una URL de Blob, no un `data:`: Chrome bloquea abrir data: URLs en
 * una pestaña nueva, y son las que dejan compartir el archivo de verdad.
 */
export async function generarPng(
  nodo: HTMLElement,
  nombre: string,
): Promise<{ imagen?: Imagen; error?: string }> {
  const alto = (ANCHO_LAMINA * 16) / 9;
  const jaula = document.createElement('div');
  jaula.className = 'jaula-export';
  const marco = document.createElement('div');
  marco.className = 'marco-export';
  const copia = nodo.cloneNode(true) as HTMLElement;
  copia.classList.add('poster--export');
  copia.style.justifyContent = 'space-between';
  marco.appendChild(copia);
  jaula.appendChild(marco);
  document.body.appendChild(jaula);

  // Un póster con responsable, o con premio y mensaje largos, crece más de
  // 16:9 y ya no cabe estirando: se encoge para entrar entero. Recortarlo se
  // llevaría por delante el título arriba y el contacto abajo.
  const natural = copia.scrollHeight;
  if (natural > alto) {
    copia.style.transform = `scale(${alto / natural})`;
    copia.style.transformOrigin = 'top center';
    marco.style.background = getComputedStyle(copia).backgroundColor;
  } else {
    copia.style.minHeight = `${alto}px`;
  }

  try {
    // Si acaban de cambiar la tipografía, esperar a que cargue: si no, el PNG
    // sale con la fuente de respaldo.
    await document.fonts.ready;
    const dataUrl = await toPng(marco, {
      pixelRatio: ANCHO_EXPORT / ANCHO_LAMINA,
      cacheBust: true,
    });
    const blob = await (await fetch(dataUrl)).blob();
    return { imagen: { url: URL.createObjectURL(blob), blob, nombre } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se pudo generar la imagen.' };
  } finally {
    jaula.remove();
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
