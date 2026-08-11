import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** null = modo local (localStorage, sin cuentas). La app funciona igual sola. */
export const nube = url && anon ? createClient(url, anon) : null;
