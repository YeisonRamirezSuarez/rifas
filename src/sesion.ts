/**
 * Qué pantalla toca. Vivía como cuatro `if` encadenados dentro de `App`, donde el
 * orden entre ellos era invisible y cada flag nuevo multiplicaba las ramas.
 *
 * `cargando` de la rifa no entra aquí a propósito: su spinner se pinta *dentro* de
 * cada pantalla, no encima, y subirlo cambiaría lo que ve el usuario.
 */
export type Pantalla =
  | 'recuperar'
  | 'onboarding'
  | 'publico'
  | 'perfil-cargando'
  | 'espera'
  | 'app';

export type EstadoSesion = {
  recuperando: boolean;
  haySesion: boolean;
  hayNube: boolean;
  hayRifa: boolean;
  perfilCargando: boolean;
  aprobado: boolean;
};

/** Veníamos de un enlace de recuperación, aunque supabase ya haya limpiado la URL. */
export function veniaDeRecuperacion(hash: string, marca: string | null): boolean {
  return hash.includes('type=recovery') || marca === '1';
}

export function pantalla(e: EstadoSesion): Pantalla {
  // Primero de todo: el enlace de recuperación llega con sesión ya abierta, así que
  // cualquier otra rama lo dejaría entrar sin cambiar la contraseña.
  if (e.recuperando) return 'recuperar';
  if (!e.haySesion) return e.hayRifa ? 'publico' : 'onboarding';
  // Sin nube no hay cuentas que resolver ni que aprobar.
  if (!e.hayNube) return 'app';
  if (e.perfilCargando) return 'perfil-cargando';
  return e.aprobado ? 'app' : 'espera';
}
