import { useEffect } from 'react';
import { paletaPorId, tipografiaPorId, urlGoogleFonts } from './temas';

/**
 * Vuelca la paleta y la tipografía elegidas en las variables CSS de :root, y
 * carga solo la familia de fuentes que se está usando.
 */
export function useTema(paletaId: string, tipografiaId: string) {
  useEffect(() => {
    const p = paletaPorId(paletaId);
    const raiz = document.documentElement.style;
    raiz.setProperty('--vino', p.fondo);
    raiz.setProperty('--vino-oscuro', p.fondoOscuro);
    raiz.setProperty('--rosa', p.acento);
    raiz.setProperty('--rosa-claro', p.acentoClaro);
    raiz.setProperty('--crema', p.claro);
  }, [paletaId]);

  useEffect(() => {
    const t = tipografiaPorId(tipografiaId);
    const raiz = document.documentElement.style;
    raiz.setProperty('--serif', t.titulos);
    raiz.setProperty('--sans', t.texto);

    const id = 'fuentes-rifa';
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      // Sin crossorigin la exportación a PNG no puede leer las reglas e incrustar la fuente.
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }
    link.href = urlGoogleFonts(t);
  }, [tipografiaId]);
}
