import { useRef, useState } from 'react';
import { DashboardSuper } from './components/DashboardSuper';
import { DialogoImagen } from './components/DialogoImagen';
import { EnEspera } from './components/EnEspera';
import { DialogoNumero } from './components/DialogoNumero';
import { Ganador } from './components/Ganador';
import { Leyenda } from './components/Leyenda';
import { MisRifas } from './components/MisRifas';
import { Onboarding } from './components/Onboarding';
import { PanelConfig } from './components/PanelConfig';
import { PanelSuperadmin } from './components/PanelSuperadmin';
import { Poster } from './components/Poster';
import { generarPng, type Imagen } from './exportar';
import { enviarCorreo } from './correos';
import { useConfirmar } from './useConfirmar';
import { usePerfil } from './usePerfil';
import { useRifa } from './useRifa';
import { useTema } from './useTema';

export default function App() {
  const rifa = useRifa();
  const cuenta = usePerfil(rifa.usuarioId);
  const { confirmar, dialogo: dialogoConfirmar } = useConfirmar();
  useTema(rifa.estado.config.paleta, rifa.estado.config.tipografia);

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

  // Visitante con el link: solo el tablero. Sin sesión y sin link: presentación.
  if (!rifa.haySesion && !rifa.rifaActual) {
    return (
      <main className="app app--onb">
        {rifa.cargando ? (
          <p className="app__cargando">Cargando…</p>
        ) : (
          <Onboarding
            entrar={rifa.entrar}
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

  // Cuenta creada pero todavía sin aprobar por un superadmin.
  if (rifa.haySesion && rifa.hayNube && !cuenta.cargando && !cuenta.aprobado) {
    return (
      <main className="app">
        <EnEspera perfil={cuenta.perfil} salir={rifa.salir} />
      </main>
    );
  }

  return (
    <main className={`app${mostrarPanel ? ' app--panel' : ''}`}>
      {rifa.haySesion && cuenta.aprobado && (
        <div className="app__barra">
          <img src="/logo.svg" alt="Rifas" className="app__logo" />
          <button type="button" onClick={() => setPanelAbierto((v) => !v)}>
            {panelAbierto ? 'Ocultar configuración' : 'Configurar rifa'}
          </button>
          {/* Aquí y no dentro del panel: con la configuración oculta no quedaba
              ninguna forma de cerrar sesión. */}
          {rifa.hayNube && (
            <button type="button" className="app__salir" onClick={rifa.salir}>
              Cerrar sesión
            </button>
          )}
        </div>
      )}

      {mostrarPanel && (
        <div className="app__columna">
          {cuenta.esSuperadmin && (
            <>
              <PanelSuperadmin
                solicitudes={cuenta.solicitudes}
                decidir={async (id, estado) => {
                  const err = await cuenta.decidir(id, estado);
                  if (!err) {
                    const p = cuenta.solicitudes.find((s) => s.id === id);
                    if (p && estado !== 'pendiente') {
                      await enviarCorreo(estado === 'aprobado' ? 'aprobada' : 'rechazada', {
                        nombre: p.nombre ?? '',
                        email: p.email,
                      });
                    }
                  }
                  return err;
                }}
                recargar={cuenta.recargarSolicitudes}
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
              finalizar={rifa.finalizar}
              reabrir={rifa.reabrir}
              vaciarTablero={rifa.vaciarTablero}
              confirmar={confirmar}
            />
          )}
        </div>
      )}

      {rifa.cargando ? (
        <p className="app__cargando">Cargando rifa…</p>
      ) : rifa.sinRifas ? (
        <p className="app__cargando">Crea tu primera rifa para empezar.</p>
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
                  {exportando === 'ganador'
                    ? 'Generando…'
                    : 'Descargar imagen del ganador (estado de WhatsApp)'}
                </button>
              )}
            </div>
          ) : (
            <div className="app__poster">
              <Poster
                ref={posterRef}
                estado={rifa.estado}
                onSeleccionar={tocarNumero}
                elegidos={elegidos ?? []}
              />
              <Leyenda config={rifa.estado.config} />
              {rifa.puedeEditar && (
                <div className="app__multiple">
                  <button type="button" onClick={() => setElegidos((e) => (e ? null : []))}>
                    {elegidos ? 'Salir de selección múltiple' : 'Vender varios a la misma persona'}
                  </button>
                  {elegidos && elegidos.length > 0 && (
                    <button
                      type="button"
                      className="boton--primario"
                      onClick={() => setVenta(elegidos)}
                    >
                      Vender {elegidos.length} {elegidos.length === 1 ? 'número' : 'números'}
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
                  {exportando === 'poster'
                    ? 'Generando…'
                    : 'Descargar póster (estado de WhatsApp)'}
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
        onCerrar={() => {
          setVenta([]);
          // Al cerrar se limpia lo marcado pero el modo sigue puesto: casi
          // siempre viene otro comprador con otro puñado de números.
          if (elegidos?.length) setElegidos([]);
        }}
      />

      {dialogoConfirmar}
    </main>
  );
}
