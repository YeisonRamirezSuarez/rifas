import { useEffect, useRef, useState, type FormEvent } from 'react';
import { DashboardSuper } from './components/DashboardSuper';
import { DialogoImagen } from './components/DialogoImagen';
import { EnEspera } from './components/EnEspera';
import { DialogoNumero } from './components/DialogoNumero';
import { Ganador } from './components/Ganador';
import { Leyenda } from './components/Leyenda';
import { MiCuenta } from './components/MiCuenta';
import { MisRifas } from './components/MisRifas';
import { NuevaClave } from './components/NuevaClave';
import { Onboarding } from './components/Onboarding';
import { PanelConfig } from './components/PanelConfig';
import { PanelSuperadmin } from './components/PanelSuperadmin';
import { Poster } from './components/Poster';
import { generarPng, type Imagen } from './exportar';
import { enviarCorreo } from './correos';
import { IconoUI } from './marcas';
import { dentroDelRango, etiqueta, formatearPrecio, reporte, type Estado } from './rifa';
import { pantalla } from './sesion';
import { useConfirmar } from './useConfirmar';
import { useCuentas } from './useCuentas';
import { usePerfil } from './usePerfil';
import { useRifa } from './useRifa';
import { useTema } from './useTema';

/**
 * Cabecera de trabajo: en qué va la rifa y cómo llegar a un número.
 * Antes las cifras vivían dos toques adentro (Ajustes › Caja) y el número se
 * cazaba a ojo entre cien casillas.
 */
function BarraTablero({ estado, abrir }: { estado: Estado; abrir: (n: number) => void }) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const r = reporte(estado);
  const total = estado.config.totalNumeros;

  const buscar = (ev: FormEvent) => {
    ev.preventDefault();
    const n = Number(texto.trim());
    if (texto.trim() === '' || !dentroDelRango(n, total)) {
      setError(`Escribe un número entre ${etiqueta(0, total)} y ${etiqueta(total - 1, total)}.`);
      return;
    }
    setError(null);
    setTexto('');
    abrir(n);
  };

  return (
    <section className="tbar" aria-label="Estado de la rifa">
      <dl className="tbar__cifras">
        <div>
          <dt>Libres</dt>
          <dd>{r.disponibles}</dd>
        </div>
        <div>
          <dt>Apartados</dt>
          <dd className={r.pendientes ? 'tbar__debe' : undefined}>{r.pendientes}</dd>
        </div>
        <div>
          <dt>Pagados</dt>
          <dd>{r.efectivo + r.transferencia}</dd>
        </div>
        <div className="tbar__cobrar">
          <dt>Por cobrar</dt>
          <dd className={r.porCobrar ? 'tbar__debe' : undefined}>
            {formatearPrecio(r.porCobrar, estado.config.moneda)}
          </dd>
        </div>
      </dl>

      <form className="tbar__ir" onSubmit={buscar}>
        <label htmlFor="ir-numero">Ir al número</label>
        <div className="tbar__ir-campo">
          <input
            id="ir-numero"
            inputMode="numeric"
            autoComplete="off"
            placeholder={etiqueta(total - 1, total)}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setError(null);
            }}
          />
          <button type="submit" className="boton--primario">
            <IconoUI id="buscar" />
            <span>Abrir</span>
          </button>
        </div>
        {error && <p className="dialogo__error">{error}</p>}
      </form>
    </section>
  );
}

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
  // Cerrado en móvil: abierto sumaba dos pantallas de formulario antes de
  // llegar al tablero, que es a lo que se entra el 90% de las veces.
  const [panelAbierto, setPanelAbierto] = useState(() => window.innerWidth > 900);
  const [exportando, setExportando] = useState<string | null>(null);
  const [errorExport, setErrorExport] = useState<string | null>(null);
  const [imagen, setImagen] = useState<Imagen | null>(null);
  const posterRef = useRef<HTMLElement>(null);
  const ganadorRef = useRef<HTMLElement>(null);

  // El panel depende de tener sesión, no de ser dueño de la rifa que se está
  // viendo: con cero rifas no hay rifa propia, y antes eso escondía también el
  // botón de crearla y el control del superadmin.
  const mostrarPanel = rifa.haySesion && cuenta.aprobado && panelAbierto;
  const cerrado = rifa.estado.config.finalizado && rifa.estado.config.numeroGanador !== null;

  // En modo múltiple los libres se marcan y se desmarcan; uno ya vendido abre
  // su ficha como siempre, que es la única forma de cobrarlo o liberarlo.
  const tocarNumero = (n: number) => {
    if (elegidos && !rifa.estado.tickets[n]) {
      // Con el valor del render en vez de la función, dos toques seguidos leen
      // la misma lista y el segundo se come al primero.
      setElegidos((e) =>
        (e ?? []).includes(n) ? (e ?? []).filter((x) => x !== n) : [...(e ?? []), n].sort((a, b) => a - b),
      );
      return;
    }
    setVenta([n]);
  };

  const exportar = async (clave: string, nodo: HTMLElement | null, nombre: string) => {
    if (!nodo) return;
    setExportando(clave);
    setErrorExport(null);
    const { imagen: nueva, error } = await generarPng(nodo, nombre);
    setExportando(null);
    if (error) setErrorExport(error);
    else if (nueva) setImagen(nueva);
  };

  const cerrarImagen = () => {
    if (imagen) URL.revokeObjectURL(imagen.url); // sin esto el PNG se queda en memoria
    setImagen(null);
  };

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

  return (
    <main className={`app${mostrarPanel ? ' app--panel' : ''}`}>
      {rifa.haySesion && cuenta.aprobado && (
        <header className="app__barra">
          <span className="app__marca">
            <img src="/logo.svg" alt="" className="app__logo" />
            Rifas
            {rifa.rifaActual && <small>{rifa.estado.config.titulo}</small>}
          </span>
          <button
            type="button"
            className={`app__ajustes${panelAbierto ? ' app__ajustes--activo' : ''}`}
            aria-pressed={panelAbierto}
            onClick={() => setPanelAbierto((v) => !v)}
          >
            <IconoUI id={panelAbierto ? 'cerrar' : 'ajustes'} />
            <span>{panelAbierto ? 'Ocultar ajustes' : 'Ajustes'}</span>
          </button>
          {/* Aquí y no dentro del panel: con la configuración oculta no quedaba
              ninguna forma de cerrar sesión. */}
          {rifa.hayNube && (
            <button type="button" className="app__salir" onClick={rifa.salir}>
              Cerrar sesión
            </button>
          )}
        </header>
      )}

      {mostrarPanel && (
        <div className="app__columna">
          {rifa.hayNube && cuenta.perfil && (
            <MiCuenta perfil={cuenta.perfil} guardarNombre={cuenta.guardarNombre} />
          )}
          {cuenta.esSuperadmin && (
            <>
              <PanelSuperadmin
                cuentas={cuentas}
                confirmar={confirmar}
                decidir={async (id, estado, pago) => {
                  const err = await cuentas.actualizarCuenta(id, { estado, ...pago });
                  if (err) return err;
                  const p = cuentas.lista.find((c) => c.id === id);
                  if (!p || estado === 'pendiente') return null;
                  const fallo = await enviarCorreo(
                    estado === 'aprobado' ? 'aprobada' : 'rechazada',
                    { nombre: p.nombre ?? '', email: p.email },
                  );
                  // Aviso y no error: la decisión ya quedó guardada. Llamarlo "falló"
                  // lleva al superadmin a reintentar una operación que sí funcionó.
                  return fallo ? `Cuenta actualizada, pero el aviso por correo no salió: ${fallo}` : null;
                }}
              />
              <DashboardSuper />
            </>
          )}
          <MisRifas
            rifas={rifa.rifas}
            actual={rifa.rifaActual}
            hayNube={rifa.hayNube}
            linkPublico={rifa.linkPublico}
            seleccionar={rifa.seleccionarRifa}
            crear={rifa.crearRifa}
            eliminar={rifa.eliminarRifa}
            confirmar={confirmar}
          />
          {rifa.rifaActual && rifa.puedeEditar && (
            <PanelConfig
              estado={rifa.estado}
              configurar={rifa.configurar}
              guardado={rifa.guardado}
              errorGuardado={rifa.errorGuardado}
              reintentarGuardado={rifa.reintentarGuardado}
              finalizar={rifa.finalizar}
              reabrir={rifa.reabrir}
              vaciarTablero={rifa.vaciarTablero}
              confirmar={confirmar}
              onNumero={(n) => setVenta([n])}
            />
          )}
        </div>
      )}

      {/* La edición queda bloqueada mientras esto se vea: el tablero de la pantalla
          puede no ser el de la base, y guardar encima lo reemplazaría. */}
      {rifa.errorCarga && (
        <p className="dialogo__error" role="alert">
          No se pudo cargar la rifa: {rifa.errorCarga}. Lo que ves puede estar
          desactualizado; vuelve a intentarlo antes de editar.
        </p>
      )}

      {rifa.cargando ? (
        <Cargando texto="Cargando rifa…" />
      ) : rifa.sinRifas ? (
         <div className="app__vacio">
          <p>Todavía no tienes ninguna rifa.</p>
          {!panelAbierto && (
            <button
              type="button"
              className="boton--primario"
              onClick={() => setPanelAbierto(true)}
            >
              Crear mi primera rifa
            </button>
          )}
        </div>
      ) : (
        <div className="app__laminas">
          {errorExport && <p className="dialogo__error">{errorExport}</p>}

          {/* Cerrado el sorteo sobran el tablero y el póster: lo que se comparte
              es el anuncio del ganador y nada más. */}
          {cerrado ? (
            <div className="app__poster app__poster--solo">
              <Ganador ref={ganadorRef} estado={rifa.estado} verNombre={rifa.puedeEditar} />
              {rifa.puedeEditar && (
                <button
                  type="button"
                  className="boton--primario app__descargar"
                  onClick={() => exportar('ganador', ganadorRef.current, 'rifa-ganador')}
                  disabled={exportando === 'ganador'}
                >
                  <IconoUI id="descargar" />
                  <span>
                    {exportando === 'ganador'
                      ? 'Generando…'
                      : 'Descargar imagen del ganador (estado de WhatsApp)'}
                  </span>
                </button>
              )}
            </div>
          ) : (
            <div className="app__poster">
              {rifa.puedeEditar && <BarraTablero estado={rifa.estado} abrir={(n) => setVenta([n])} />}
              <Poster
                ref={posterRef}
                estado={rifa.estado}
                onSeleccionar={tocarNumero}
                elegidos={elegidos ?? []}
              />
              <Leyenda config={rifa.estado.config} />
              {rifa.puedeEditar && (
                // Mientras se marcan números la barra se pega abajo: si no, cada
                // lote obliga a bajar a confirmar y volver a subir a seguir marcando.
                <div className={`app__multiple${elegidos ? ' app__multiple--marcando' : ''}`}>
                  <button type="button" onClick={() => setElegidos((e) => (e ? null : []))}>
                    {elegidos ? 'Salir de selección múltiple' : 'Vender varios a la misma persona'}
                  </button>
                  {elegidos && (
                    <button
                      type="button"
                      className="boton--primario"
                      disabled={elegidos.length === 0}
                      // Se limpia al abrir: los números ya viven en el diálogo, que los
                      // muestra en el título, y así abrir la ficha de un número vendido
                      // no se lleva por delante lo que se estaba marcando.
                      onClick={() => {
                        setVenta(elegidos);
                        setElegidos([]);
                      }}
                    >
                      {elegidos.length === 0
                        ? 'Toca los números en el tablero'
                        : `Vender ${elegidos.length} ${elegidos.length === 1 ? 'número' : 'números'}`}
                    </button>
                  )}
                </div>
              )}
              {/* Fuera de <Poster>: lo exportado es solo la lámina. */}
              {rifa.puedeEditar && (
                <button
                  type="button"
                  className="boton--primario app__descargar"
                  onClick={() => exportar('poster', posterRef.current, 'rifa')}
                  disabled={exportando === 'poster'}
                >
                  <IconoUI id="descargar" />
                  <span>
                    {exportando === 'poster'
                      ? 'Generando…'
                      : 'Descargar póster (estado de WhatsApp)'}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <DialogoImagen imagen={imagen} onCerrar={cerrarImagen} />

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
