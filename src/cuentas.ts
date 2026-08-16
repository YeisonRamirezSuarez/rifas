/** Lógica pura de cuentas: lo que no depende de React ni de la nube. */

/**
 * Tope del nombre, el mismo que impone `perfiles_nombre_largo`.
 *
 * Vive acá y no en una pantalla porque lo topan dos: el alta (`Onboarding`) y la
 * edición del perfil (`MiCuenta`). Escrito en cada una, se desincroniza.
 */
export const LARGO_MAXIMO = 100;

/**
 * Paginación por cursor de la lista de cuentas.
 *
 * Keyset y no `offset`: el superadmin aprueba mientras pagina, la fila sale de la
 * pestaña, y con `offset` la página siguiente arranca corrida y se salta cuentas.
 */
export type Cursor = { creadoEn: string; id: string };

/** Condición para `.or()` de PostgREST: lo estrictamente posterior al cursor. */
export function filtroCursor(c: Cursor): string {
  return `creado_en.lt.${c.creadoEn},and(creado_en.eq.${c.creadoEn},id.lt.${c.id})`;
}

/** `null` = no hay más páginas. */
export function siguienteCursor(
  filas: { creado_en: string; id: string }[],
  pagina: number,
): Cursor | null {
  if (filas.length < pagina) return null;
  const ultima = filas[filas.length - 1];
  return { creadoEn: ultima.creado_en, id: ultima.id };
}
