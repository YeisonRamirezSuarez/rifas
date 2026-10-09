import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** null = modo local (localStorage, sin cuentas). La app funciona igual sola. */
export const nube = url && anon ? createClient(url, anon) : null;

/**
 * Dirección pública del sitio, sin barra final. Se configura con VITE_SITIO_URL
 * porque los enlaces que salen por correo (recuperar contraseña) y el link que
 * se comparte de una rifa tienen que apuntar al dominio de verdad, no al
 * localhost desde donde se pidieron. Sin la variable vale el origen actual.
 */
export const sitio = (import.meta.env.VITE_SITIO_URL || location.origin).replace(/\/+$/, '');
