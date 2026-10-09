import { useEffect, useRef, useState } from 'react';
import { DialogoImagen } from './components/DialogoImagen';
import { DialogoNumero } from './components/DialogoNumero';
import { EnEspera } from './components/EnEspera';
import { Ganador } from './components/Ganador';
import { Navegacion } from './components/Navegacion';
import { NuevaClave } from './components/NuevaClave';
import { Onboarding } from './components/Onboarding';
import { Poster } from './components/Poster';
import { SeccionAdmin } from './components/SeccionAdmin';
import { SeccionAjustes } from './components/SeccionAjustes';
import { SeccionCompartir } from './components/SeccionCompartir';
import { SeccionTablero } from './components/SeccionTablero';
import { SeccionVentas } from './components/SeccionVentas';
import { enviarCorreo } from './correos';
import type { Imagen } from './exportar';
import { IconoUI } from './marcas';
import { pestanaValida, pestanas, type Pestana } from './pestanas';
import { pantalla } from './sesion';
import { useConfirmar } from './useConfirmar';
import { useCuentas } from './useCuentas';
import { usePerfil } from './usePerfil';
import { useRifa } from './useRifa';
import { useTema } from './useTema';

/** Espera de la app. El logo ya trae su propia animación dentro del SVG. */
function Cargando({ texto }: { texto: string }) {
  return (
    <p className="app__cargando" role="status" aria-live="polite">
      <img src="/logo.svg" alt="" className="app__cargando-logo" />
      {texto}
    </p>
  );
}

export default function App() {
  const rifa = useRifa();
  const cuenta = usePerfil(rifa.usuarioId);
  const cuentas = useCuentas(rifa.usuarioId, cuenta.esSuperadmin);
  const vista = pantalla({
    recuperando: rifa.recuperando,
    haySesion: rifa.haySesion,
    hayNube: rifa.hayNube,
    hayRifa: !!rifa.rifaActual,
    perfilCargando: cuenta.cargando,
    aprobado: cuenta.aprobado,
  });
  const { confirmar, dialogo: dialogoConfirmar } = useConfirmar();
  useTema(rifa.estado.config.paleta, rifa.estado.config.tipografia);

  useEffect(() => {
    const titulo = rifa.estado.config.titulo.trim();
    document.title = rifa.rifaActual && titulo ? `${titulo} · Rifas` : 'Rifas';
  }, [rifa.estado.config.titulo, rifa.rifaActual]);

  // Números abiertos en el diálogo de venta. Vacío = diálogo cerrado.
  const [venta, setVenta] = useState<number[]>([]);
  // null = tocar un número lo abre. Lista = modo "varios para la misma persona".
  const [elegidos, setElegidos] = useState<number[] | null>(null);
  const [pestana, setPestana] = useState<Pestana>('tablero');
  const [imagenes, setImagenes] = useState<Imagen[]>([]);
  // Si la hoja 2 falló, el aviso viaja con los PNG: el diálogo es modal y tapa Compartir.
  const [fallaImagenes, setFallaImagenes] = useState<string>();

  const visibles = pestanas({
    esSuperadmin: cuenta.esSuperadmin,
    puedeEditar: rifa.puedeEditar,
  });
  // La pestaña abierta puede dejar de existir en vivo: cambiar a una rifa ajena
  // se lleva Ventas y Compartir, y perder el rol se lleva Admin.
  const activa = pestanaValida(pestana, visibles);
  const cerrado = rifa.estado.config.finalizado && rifa.estado.config.numeroGanador !== null;

  // La que hace scroll es la ventana: sin esto, cambiar de pestaña aterriza a media vista.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activa]);

  // Sin esto la pestaña muerta sigue en el estado, y recuperar el rol o volver
  // a la rifa propia devuelve al usuario de un salto a una sección que ya dejó.
  useEffect(() => {
    if (pestana !== activa) setPestana(activa);
  }, [pestana, activa]);

  // `mostradas` es dueña de lo que hay en pantalla: cualquier tanda nueva libera
  // la anterior. Sin esto los PNG se quedan en memoria, y también si se sale de
  // Compartir a media generación y se vuelve a descargar: la segunda tanda
  // pisaría a la primera sin revocarla.
  const mostradas = useRef<Imagen[]>([]);
  const mostrarImagenes = (nuevas: Imagen[], falla?: string) => {
    mostradas.current.forEach((i) => URL.revokeObjectURL(i.url));
    mostradas.current = nuevas;
    setImagenes(nuevas);
    setFallaImagenes(falla);
  };
  const cerrarImagenes = () => mostrarImagenes([]);

  // Si la sesión se cae con el diálogo abierto, `App` se va con los PNG dentro.
  useEffect(() => () => mostradas.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  if (vista === 'recuperar') {
    return (
      <main className="app">
        <NuevaClave cambiarClave={rifa.cambiarClave} salir={rifa.salir} />
      </main>
    );
  }

  // Visitante con el link: solo el tablero. Sin sesión y sin link: presentación.
  if (vista === 'onboarding') {
    return (
      <main className="app app--onb">
        {rifa.cargando ? (
          <Cargando texto="Cargando…" />
        ) : (
          <Onboarding
            entrar={rifa.entrar}
            recuperarClave={rifa.recuperarClave}
            registrarse={async (email, clave, nombre) => {
              const err = await rifa.registrarse(email, clave, nombre);
              // El correo es un aviso, no el trámite: si falla, la cuenta ya quedó creada.
              if (!err) await enviarCorreo('solicitud', { nombre, email });
              return err;
            }}
          />
        )}
      </main>
    );
  }

  // Link público: quien lo abre viene a mirar la lámina, no a operar la rifa.
  // Se ve como el PNG que se comparte —el tablero no se ensancha, así conserva
  // su proporción a cualquier ancho— y se repinta sola con cada venta, porque
  // el canal de realtime ya está suscrito a esta rifa aunque no haya sesión.
  if (vista === 'publico') {
    return (
      <main className="app app--publico">
        {rifa.cargando ? (
          <Cargando texto="Cargando rifa…" />
        ) : rifa.errorCarga ? (
          // Sin esto el visitante veía una rifa en blanco, con el título por defecto
          // y cero números vendidos, como si fuera la rifa de verdad.
          <p className="dialogo__error" role="alert">
            No se pudo cargar la rifa: {rifa.errorCarga}. Vuelve a abrir el enlace.
          </p>
        ) : (
          <>
            {cerrado ? (
              <Ganador estado={rifa.estado} verNombre={false} />
            ) : (
              <Poster estado={rifa.estado} onSeleccionar={(n) => setVenta([n])} />
            )}
            <p className="publico__vivo">
              Esta página se actualiza sola: los números se marcan apenas se venden.
            </p>
          </>
        )}

        <DialogoNumero
          estado={rifa.estado}
          numeros={venta}
          puedeEditar={false}
          vender={rifa.vender}
          marcarPago={rifa.marcarPago}
          liberar={rifa.liberar}
          confirmar={confirmar}
          onCerrar={() => setVenta([])}
        />
      </main>
    );
  }

  // Con sesión pero sin saber todavía quién es: ni app ni sala de espera.
  // También cubre el reintento desde EnEspera, que si no parpadeaba al tablero.
  if (vista === 'perfil-cargando') {
    return (
      <main className="app">
        <Cargando texto="Cargando…" />
      </main>
    );
  }

  // Cuenta creada pero todavía sin aprobar por un superadmin.
  if (vista === 'espera') {
    return (
      <main className="app">
        <EnEspera
          perfil={cuenta.perfil}
          error={cuenta.error}
          reintentar={() => cuenta.recargarPerfil()}
          salir={rifa.salir}
        />
      </main>
    );
  }

  // Sin rifas no hay tablero, ventas ni link que mostrar; Ajustes sí, porque ahí
  // se crea la primera.
  const vacio = rifa.sinRifas && activa !== 'ajustes' && activa !== 'admin';

  return (
    <main className="app app--pestanas">
      <header className="app__barra">
        <span className="app__marca">
          <img src="/logo.svg" alt="" className="app__logo" />
          Rifas
          {rifa.rifaActual && <small>{rifa.estado.config.titulo}</small>}
        </span>
        {rifa.hayNube && (
          <button type="button" className="app__salir" onClick={rifa.salir}>
            <IconoUI id="cerrar" />
            <span>Cerrar sesión</span>
          </button>
        )}
      </header>

      <Navegacion visibles={visibles} activa={activa} onElegir={setPestana} />

      <div className="app__contenido">
        {/* La edición queda bloqueada mientras esto se vea: el tablero de la
            pantalla puede no ser el de la base, y guardar encima lo reemplazaría. */}
        {rifa.errorCarga && (
          <p className="dialogo__error" role="alert">
            No se pudo cargar la rifa: {rifa.errorCarga}. Lo que ves puede estar
            desactualizado; vuelve a intentarlo antes de editar.
          </p>
        )}

        {rifa.cargando ? (
          <Cargando texto="Cargando rifa…" />
        ) : vacio ? (
          <div className="app__vacio">
            <p>Todavía no tienes ninguna rifa.</p>
            <button
              type="button"
              className="boton--primario"
              onClick={() => setPestana('ajustes')}
            >
              Crear mi primera rifa
            </button>
          </div>
        ) : (
          <>
            {activa === 'tablero' && (
              <SeccionTablero
                estado={rifa.estado}
                puedeEditar={rifa.puedeEditar}
                cerrado={cerrado}
                elegidos={elegidos}
                setElegidos={setElegidos}
                abrir={setVenta}
              />
            )}
            {activa === 'ventas' && (
              /* `key`: el buscador y el filtro son de la rifa que se estaba
                 mirando; al cambiar de rifa arrancan de cero. */
              <SeccionVentas
                key={rifa.rifaActual}
                estado={rifa.estado}
                onNumeros={setVenta}
              />
            )}
            {activa === 'compartir' && (
              <SeccionCompartir
                estado={rifa.estado}
                cerrado={cerrado}
                link={rifa.linkPublico(rifa.rifaActual)}
                hayNube={rifa.hayNube}
                onImagenes={mostrarImagenes}
              />
            )}
            {activa === 'ajustes' && (
              <SeccionAjustes rifa={rifa} cuenta={cuenta} confirmar={confirmar} />
            )}
            {activa === 'admin' && <SeccionAdmin cuentas={cuentas} confirmar={confirmar} />}
          </>
        )}
      </div>

      <DialogoImagen imagenes={imagenes} falla={fallaImagenes} onCerrar={cerrarImagenes} />

      <DialogoNumero
        estado={rifa.estado}
        numeros={venta}
        puedeEditar={rifa.puedeEditar}
        vender={rifa.vender}
        marcarPago={rifa.marcarPago}
        liberar={rifa.liberar}
        confirmar={confirmar}
        onCerrar={() => setVenta([])}
      />

      {dialogoConfirmar}
    </main>
  );
}
