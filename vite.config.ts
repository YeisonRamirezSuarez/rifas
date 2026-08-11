import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** En desarrollo no hay funciones de Vercel: se emula /api/correo con el mismo código. */
function apiCorreo(): Plugin {
  return {
    name: 'api-correo',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/correo', async (req, res) => {
        let cuerpo = '';
        req.on('data', (c) => (cuerpo += c));
        req.on('end', async () => {
          try {
            const modulo = await server.ssrLoadModule('/api/_correo.ts');
            const token = (req.headers.authorization ?? '').replace(/^Bearer /i, '') || null;
            const { estado, datos } = await modulo.manejarCorreo(
              JSON.parse(cuerpo || '{}'),
              token,
              'http://localhost:5173',
            );
            res.statusCode = estado;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(datos));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(e) }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Vite solo expone las VITE_* al cliente; las de servidor (BREVO_API_KEY y
  // demás) hay que meterlas a process.env para que las vea /api en desarrollo.
  // En Vercel esto lo hace la plataforma con sus Environment Variables.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

  return {
    plugins: [react(), apiCorreo()],
    // El punto inicial habilita el dominio y todos sus subdominios: el túnel
    // cambia de subdominio en cada arranque. Solo aplica al servidor de dev.
    server: { allowedHosts: ['.trycloudflare.com'] },
  };
});
