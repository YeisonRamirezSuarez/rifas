/**
 * Marcas para los puestos vendidos. Monocromáticas a propósito: pintan con
 * `currentColor`, así heredan el color de la paleta y nunca chocan con ella.
 */

export type Marca = { id: string; nombre: string; path: string };

export const MARCAS: Marca[] = [
  {
    id: 'corazon',
    nombre: 'Corazón',
    path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  },
  {
    id: 'estrella',
    nombre: 'Estrella',
    path: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  },
  {
    id: 'check',
    nombre: 'Visto',
    path: 'M12 2a10 10 0 100 20 10 10 0 000-20zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  },
  {
    id: 'candado',
    nombre: 'Candado',
    path: 'M18 8h-1V6A5 5 0 007 6v2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zM9 6a3 3 0 016 0v2H9V6zm3 12a2 2 0 110-4 2 2 0 010 4z',
  },
  {
    id: 'boleta',
    nombre: 'Boleta',
    path: 'M20 12c0-1.1.9-2 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v4c1.1 0 2 .9 2 2s-.9 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2z',
  },
  {
    id: 'rombo',
    nombre: 'Rombo',
    path: 'M12 2l10 10-10 10L2 12 12 2z',
  },
  {
    id: 'punto',
    nombre: 'Punto',
    path: 'M12 5a7 7 0 100 14 7 7 0 000-14z',
  },
  {
    id: 'equis',
    nombre: 'Equis',
    path: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z',
  },
];

/** Una marca borrada de la lista no debe dejar celdas en blanco. */
export const marcaPorId = (id: string): Marca => MARCAS.find((m) => m.id === id) ?? MARCAS[0];

export const ESTILOS_CELDA = [
  { id: 'solido', nombre: 'Relleno' },
  { id: 'contorno', nombre: 'Contorno' },
  { id: 'rayas', nombre: 'Rayas' },
  { id: 'sello', nombre: 'Sello' },
] as const;

/** Una config vieja sin `estiloCelda` generaría la clase `celda--undefined`. */
export const estiloPorId = (id: string): string =>
  ESTILOS_CELDA.some((e) => e.id === id) ? id : ESTILOS_CELDA[0].id;

export function Icono({ id, className }: { id: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={marcaPorId(id).path} />
    </svg>
  );
}
