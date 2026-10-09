import type { Simbolo } from './marcas';

export type Pestana = 'tablero' | 'ventas' | 'compartir' | 'ajustes' | 'admin';

export type Entrada = { id: Pestana; titulo: string; icono: Simbolo };

const TODAS: Entrada[] = [
  { id: 'tablero', titulo: 'Tablero', icono: 'boleta' },
  { id: 'ventas', titulo: 'Ventas', icono: 'dinero' },
  { id: 'compartir', titulo: 'Compartir', icono: 'compartir' },
  { id: 'ajustes', titulo: 'Ajustes', icono: 'ajustes' },
  { id: 'admin', titulo: 'Admin', icono: 'candado' },
];

/**
 * Ventas y Compartir son del dueño de la rifa: a una rifa ajena se entra a
 * mirar. Ajustes se queda siempre, porque ahí se crea la primera rifa y se
 * cambia de rifa.
 */
export function pestanas({
  esSuperadmin,
  puedeEditar,
}: {
  esSuperadmin: boolean;
  puedeEditar: boolean;
}): Entrada[] {
  return TODAS.filter((p) => {
    if (p.id === 'admin') return esSuperadmin;
    if (p.id === 'ventas' || p.id === 'compartir') return puedeEditar;
    return true;
  });
}

/**
 * La pestaña abierta puede desaparecer en vivo: el rol cambia, la rifa cambia.
 * Cae a la primera visible, no a Tablero a ciegas: dar por sentado que Tablero
 * está en la lista deja la app sin ninguna sección pintada si algún día no lo está.
 */
export function pestanaValida(actual: Pestana, visibles: Entrada[]): Pestana {
  if (visibles.some((p) => p.id === actual)) return actual;
  return visibles[0]?.id ?? 'tablero';
}
