/**
 * Comprueba que el proyecto de Supabase quedó bien conectado.
 * Uso: node verificar-nube.mjs
 * Lee VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY de .env.
 */
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
const cabeceras = { apikey: key, Authorization: `Bearer ${key}` };

const check = (ok, texto, extra = '') =>
  console.log(`${ok ? '  ok  ' : ' FALLA'}  ${texto}${extra ? ` — ${extra}` : ''}`);

if (!url || !key) {
  console.log(' FALLA  faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env');
  process.exit(1);
}
console.log(`\nProyecto: ${url}\n`);

let fallas = 0;
const probar = async (tabla) => {
  const r = await fetch(`${url}/rest/v1/${tabla}?select=*&limit=1`, { headers: cabeceras });
  const cuerpo = await r.json().catch(() => null);
  const existe = r.status !== 404;
  check(existe, `tabla "${tabla}"`, existe ? `lectura ${r.status}` : cuerpo?.message);
  if (!existe) fallas++;
  return { status: r.status, cuerpo };
};

await probar('rifas');
await probar('numeros');

// `compradores` no debe ser legible sin sesión: ahí viven nombre y teléfono.
const comp = await fetch(`${url}/rest/v1/compradores?select=*&limit=1`, { headers: cabeceras });
const datos = await comp.json().catch(() => null);
const tapado = comp.status === 404 ? null : Array.isArray(datos) && datos.length === 0;
if (comp.status === 404) {
  check(false, 'tabla "compradores"', datos?.message);
  fallas++;
} else {
  check(tapado === true, 'compradores NO es legible sin sesión (privacidad)', `status ${comp.status}`);
  if (tapado !== true) fallas++;
}

// Escribir sin sesión debe ser rechazado por RLS.
const escritura = await fetch(`${url}/rest/v1/rifas`, {
  method: 'POST',
  headers: { ...cabeceras, 'Content-Type': 'application/json' },
  body: JSON.stringify({ slug: `prueba-${Date.now()}`, config: {} }),
});
const bloqueado = escritura.status === 401 || escritura.status === 403;
check(bloqueado, 'un anónimo NO puede crear rifas (RLS)', `status ${escritura.status}`);
if (!bloqueado) fallas++;

const ajustes = await (await fetch(`${url}/auth/v1/settings`, { headers: cabeceras })).json();
check(ajustes.external?.email === true, 'registro por correo habilitado');
console.log(
  `        confirmación por correo: ${ajustes.mailer_autoconfirm ? 'NO exigida' : 'exigida (hay que confirmar antes de entrar)'}`,
);

console.log(fallas ? `\n${fallas} punto(s) por resolver.\n` : '\nTodo conectado.\n');
process.exit(fallas ? 1 : 0);
