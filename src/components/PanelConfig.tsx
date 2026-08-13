import { useState, type ReactNode } from 'react';
import {
  ejemploMensaje,
  etiqueta,
  formatearPrecio,
  PLANTILLA_APARTADO,
  PLANTILLA_PAGADO,
  reporte,
  VARIABLES,
  type Config,
  type Estado,
} from '../rifa';
import { FONDOS, Florituras } from '../fondos';
import { estiloPorId, ESTILOS_CELDA, Icono, MARCAS } from '../marcas';
import { PALETAS, TIPOGRAFIAS } from '../temas';
import { CampoNumero } from './CampoNumero';
import { Leyenda } from './Leyenda';
import { ListaVentas } from './ListaVentas';

type Props = {
  estado: Estado;
  configurar: (config: Config) => void;
  finalizar: (numeroGanador: number) => Promise<string | null>;
  reabrir: () => Promise<string | null>;
  vaciarTablero: () => Promise<string | null>;
  /** Abre la ficha de un número desde la lista de compradores. */
  onNumero: (numero: number) => void;
  confirmar: (titulo: string, o?: { texto?: string; aceptar?: string; peligro?: boolean }) => Promise<boolean>;
};

const PESTANAS = [
  { id: 'sorteo', titulo: 'Sorteo' },
  { id: 'diseno', titulo: 'Diseño' },
  { id: 'colores', titulo: 'Colores' },
  { id: 'mensaje', titulo: 'Mensaje' },
  { id: 'compradores', titulo: 'Compradores' },
  { id: 'caja', titulo: 'Caja' },
  { id: 'cierre', titulo: 'Cierre' },
] as const;

type Pestana = (typeof PESTANAS)[number]['id'];

/** Cuántas opciones se ven antes de tener que pedir el resto. */
const A_LA_VISTA = 6;

type Opcion = { id: string; nombre: string; vista: ReactNode };

/**
 * Galería de opciones con su dibujo de verdad.
 *
 * Antes los fondos eran once botones de puro texto: para saber qué era
 * «Art déco» había que ponerlo, bajar la vista al póster y volver. Y las
 * paletas solo llevaban el nombre en `title`, que en un celular no existe
 * porque no hay hover.
 *
 * Cerrada muestra seis; el resto se pide. Con dieciséis fondos, catorce
 * paletas y dieciséis marcas, verlas todas de una convierte el panel en un
 * muro y empuja el resto de la pestaña fuera de la pantalla.
 */
function Galeria({
  etiqueta,
  opciones,
  activo,
  clase,
  onElegir,
}: {
  etiqueta: string;
  opciones: Opcion[];
  activo: string;
  clase: string;
  onElegir: (id: string) => void;
}) {
  const [todas, setTodas] = useState(false);
  const primeras = opciones.slice(0, A_LA_VISTA);
  const elegida = opciones.find((o) => o.id === activo);
  // La que está puesta nunca puede quedar fuera: si no, al abrir la pestaña
  // parece que no hay nada elegido.
  const visibles = todas
    ? opciones
    : elegida && !primeras.includes(elegida)
      ? [...primeras.slice(0, A_LA_VISTA - 1), elegida]
      : primeras;
  const ocultas = opciones.length - visibles.length;

  return (
    <div className="galeria">
      <p className="panel__etiqueta">{etiqueta}</p>
      <div className={`galeria__rejilla galeria__rejilla--${clase}`}>
        {visibles.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={o.id === activo}
            className={`galeria__op${o.id === activo ? ' galeria__op--activa' : ''}`}
            onClick={() => onElegir(o.id)}
          >
            <span className="galeria__vista">{o.vista}</span>
            <span className="galeria__nombre">{o.nombre}</span>
          </button>
        ))}
      </div>
      {ocultas > 0 && (
        <button type="button" className="galeria__mas" onClick={() => setTodas(true)}>
          + {ocultas} más
        </button>
      )}
      {todas && (
        <button type="button" className="galeria__mas" onClick={() => setTodas(false)}>
          Ver menos
        </button>
      )}
    </div>
  );
}

export function PanelConfig({
  estado,
  configurar,
  finalizar,
  reabrir,
  vaciarTablero,
  confirmar,
  onNumero,
}: Props) {
  const c = estado.config;
  const r = reporte(estado);
  const [pestana, setPestana] = useState<Pestana>('sorteo');
  const [intentoTotal, setIntentoTotal] = useState(0);
  const [ganadorTexto, setGanadorTexto] = useState('');
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Config>(campo: K, valor: Config[K]) =>
    configurar({ ...c, [campo]: valor });

  const dinero = (v: number) => formatearPrecio(v, c.moneda);

  return (
    <aside className="panel">
      <nav className="panel__nav" role="tablist" aria-label="Secciones de configuración">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            id={`tab-${p.id}`}
            aria-controls={`panel-${p.id}`}
            aria-selected={pestana === p.id}
            className={`panel__tab${pestana === p.id ? ' panel__tab--activa' : ''}`}
            onClick={() => setPestana(p.id)}
          >
            {p.titulo}
          </button>
        ))}
      </nav>

      {pestana === 'sorteo' && (
        <section
          className="panel__seccion"
          role="tabpanel"
          id={`panel-${pestana}`}
          aria-labelledby={`tab-${pestana}`}
        >
          <label>
            Qué se rifa
            <input
              value={c.premio}
              onChange={(e) => set('premio', e.target.value)}
              placeholder="Una moto Honda XR 150"
            />
          </label>
          <label>
            Lotería que juega
            <input value={c.loteria} onChange={(e) => set('loteria', e.target.value)} />
          </label>
          <label>
            Fecha del sorteo
            <input
              type="date"
              value={c.fechaJuego}
              onChange={(e) => set('fechaJuego', e.target.value)}
            />
          </label>
          <div className="panel__fila">
            <label>
              Precio por boleta
              <CampoNumero
                valor={c.precio}
                min={0}
                step={100}
                onCambio={(v) => set('precio', v)}
              />
            </label>
            <label>
              Moneda
              <select value={c.moneda} onChange={(e) => set('moneda', e.target.value)}>
                <option value="COP">COP</option>
                <option value="USD">USD</option>
                <option value="MXN">MXN</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
          </div>
          <label>
            Cantidad de números
            {/* Achicar el tablero borra lo vendido que quede fuera del rango, y
                eso hasta ahora pasaba sin avisar: un 5 de más al teclear «50»
                se llevaba medio tablero por delante. */}
            <CampoNumero
              key={`total-${c.totalNumeros}-${intentoTotal}`}
              valor={c.totalNumeros}
              min={1}
              max={1000}
              onCambio={async (v) => {
                const afuera = Object.keys(estado.tickets).filter((n) => Number(n) >= v).length;
                if (afuera) {
                  const ok = await confirmar(`¿Dejar el tablero en ${v} números?`, {
                    texto:
                      afuera === 1
                        ? 'Un número vendido queda fuera del nuevo rango: se borra junto con los datos de su comprador.'
                        : `${afuera} números vendidos quedan fuera del nuevo rango: se borran junto con los datos de sus compradores.`,
                    aceptar: 'Cambiar el tablero',
                    peligro: true,
                  });
                  if (!ok) {
                    setIntentoTotal((i) => i + 1);
                    return;
                  }
                }
                set('totalNumeros', v);
              }}
            />
          </label>
          <p className="panel__nota">Los campos numéricos se aplican al salir del campo.</p>
        </section>
      )}

      {pestana === 'diseno' && (
        <section
          className="panel__seccion"
          role="tabpanel"
          id={`panel-${pestana}`}
          aria-labelledby={`tab-${pestana}`}
        >
          <label>
            Título
            <input value={c.titulo} onChange={(e) => set('titulo', e.target.value)} />
          </label>
          <label>
            Mensaje del pie
            <input value={c.mensaje} onChange={(e) => set('mensaje', e.target.value)} />
          </label>
          <label>
            Nombre del responsable
            <input
              value={c.responsable}
              onChange={(e) => set('responsable', e.target.value)}
              placeholder="Leidy Gómez"
            />
          </label>
          <div className="panel__fila">
            <label>
              Etiqueta del contacto
              <input
                value={c.etiquetaContacto}
                onChange={(e) => set('etiquetaContacto', e.target.value)}
                placeholder="contacto / Nequi"
              />
            </label>
            <label>
              Número de contacto
              <input
                value={c.contacto}
                inputMode="tel"
                onChange={(e) => set('contacto', e.target.value)}
              />
            </label>
          </div>
          <label className="panel__check">
            <input
              type="checkbox"
              checked={c.ocultarVendidos}
              onChange={(e) => set('ocultarVendidos', e.target.checked)}
            />
            Tapar los números vendidos
          </label>

          {c.ocultarVendidos && (
            // La muestra es la casilla de verdad, no el icono suelto sobre
            // blanco: lo que se elige es cómo queda el puesto en el tablero.
            <Galeria
              etiqueta="Marca del puesto vendido"
              clase="marcas"
              activo={c.marca}
              onElegir={(id) => set('marca', id)}
              opciones={MARCAS.map((m) => ({
                id: m.id,
                nombre: m.nombre,
                vista: (
                  <span className={`celda celda--pagado celda--${estiloPorId(c.estiloCelda)} vista-marca`}>
                    <Icono id={m.id} className="celda__marca" />
                  </span>
                ),
              }))}
            />
          )}

          <label>
            Estilo de la casilla
            <select value={c.estiloCelda} onChange={(e) => set('estiloCelda', e.target.value)}>
              {ESTILOS_CELDA.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>

          <Leyenda config={c} />
        </section>
      )}

      {pestana === 'colores' && (
        <section
          className="panel__seccion"
          role="tabpanel"
          id={`panel-${pestana}`}
          aria-labelledby={`tab-${pestana}`}
        >
          {/* Cada fondo dibuja el suyo, con el color de la paleta puesta. */}
          <Galeria
            etiqueta="Fondo decorativo"
            clase="fondos"
            activo={c.fondo}
            onElegir={(id) => set('fondo', id)}
            opciones={FONDOS.map((f) => ({
              id: f.id,
              nombre: f.nombre,
              vista: (
                <span className="vista-fondo">
                  <Florituras id={f.id} />
                </span>
              ),
            }))}
          />

          <Galeria
            etiqueta="Paleta de colores"
            clase="paletas"
            activo={c.paleta}
            onElegir={(id) => set('paleta', id)}
            opciones={PALETAS.map((p) => ({
              id: p.id,
              nombre: p.nombre,
              vista: (
                <span className="vista-paleta" style={{ background: p.fondo }}>
                  <span style={{ background: p.acento }} />
                  <span style={{ background: p.claro }} />
                </span>
              ),
            }))}
          />

          <label>
            Tipografía
            <select value={c.tipografia} onChange={(e) => set('tipografia', e.target.value)}>
              {TIPOGRAFIAS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      {pestana === 'mensaje' && (
        <section
          className="panel__seccion"
          role="tabpanel"
          id={`panel-${pestana}`}
          aria-labelledby={`tab-${pestana}`}
        >
          <p className="panel__nota">
            Variables disponibles: {VARIABLES.map((v) => `{${v}}`).join('  ')}
          </p>

          <label>
            Cuando está apartado (sin pagar)
            <textarea
              rows={5}
              value={c.plantillaApartado}
              onChange={(e) => set('plantillaApartado', e.target.value)}
            />
          </label>
          <p className="panel__previo">{ejemploMensaje(c, 'pendiente')}</p>

          <label>
            Cuando ya pagó
            <textarea
              rows={5}
              value={c.plantillaPagado}
              onChange={(e) => set('plantillaPagado', e.target.value)}
            />
          </label>
          <p className="panel__previo">{ejemploMensaje(c, 'efectivo')}</p>

          <button
            type="button"
            onClick={() =>
              configurar({
                ...c,
                plantillaApartado: PLANTILLA_APARTADO,
                plantillaPagado: PLANTILLA_PAGADO,
              })
            }
          >
            Restaurar mensajes por defecto
          </button>
        </section>
      )}

      {pestana === 'compradores' && (
        <section
          className="panel__seccion"
          role="tabpanel"
          id={`panel-${pestana}`}
          aria-labelledby={`tab-${pestana}`}
        >
          <ListaVentas estado={estado} onNumero={onNumero} />
        </section>
      )}

      {pestana === 'caja' && (
        <section
          className="panel__seccion"
          role="tabpanel"
          id={`panel-${pestana}`}
          aria-labelledby={`tab-${pestana}`}
        >
          <dl className="panel__resumen">
            <div>
              <dt>Disponibles</dt>
              <dd>{r.disponibles}</dd>
            </div>
            <div>
              <dt>Apartados</dt>
              <dd>{r.pendientes}</dd>
            </div>
            <div>
              <dt>Pagados</dt>
              <dd>{r.efectivo + r.transferencia}</dd>
            </div>
          </dl>
          <table className="panel__caja">
            <tbody>
              <tr>
                <th scope="row">Efectivo</th>
                <td>{r.efectivo}</td>
                <td>{dinero(r.montoEfectivo)}</td>
              </tr>
              <tr>
                <th scope="row">Transferencia</th>
                <td>{r.transferencia}</td>
                <td>{dinero(r.montoTransferencia)}</td>
              </tr>
              <tr className="panel__caja-total">
                <th scope="row">Cobrado</th>
                <td>{r.efectivo + r.transferencia}</td>
                <td>{dinero(r.cobrado)}</td>
              </tr>
              <tr>
                <th scope="row">Por cobrar</th>
                <td>{r.pendientes}</td>
                <td>{dinero(r.porCobrar)}</td>
              </tr>
            </tbody>
          </table>
          <p className="panel__nota">
            Para cobrar, busca a la persona en Compradores y toca su número.
          </p>
        </section>
      )}

      {pestana === 'cierre' && (
        <section
          className="panel__seccion"
          role="tabpanel"
          id={`panel-${pestana}`}
          aria-labelledby={`tab-${pestana}`}
        >
          {c.finalizado && c.numeroGanador !== null ? (
            <>
              <p className="panel__nota">
                Sorteo cerrado. Ganador: <strong>{etiqueta(c.numeroGanador, c.totalNumeros)}</strong>
              </p>
              <button type="button" onClick={() => reabrir()}>
                Reabrir sorteo
              </button>
            </>
          ) : (
            <form
              className="panel__fila panel__fila--fin"
              onSubmit={async (ev) => {
                ev.preventDefault();
                setError(await finalizar(Number(ganadorTexto)));
              }}
            >
              <label>
                Número ganador ({etiqueta(0, c.totalNumeros)}–
                {etiqueta(c.totalNumeros - 1, c.totalNumeros)})
                <input
                  type="number"
                  min={0}
                  max={c.totalNumeros - 1}
                  value={ganadorTexto}
                  onChange={(e) => setGanadorTexto(e.target.value)}
                  required
                />
              </label>
              <button type="submit" className="boton--primario">
                Finalizar sorteo
              </button>
            </form>
          )}
          {error && <p className="dialogo__error">{error}</p>}

          <button
            type="button"
            className="boton--peligro"
            onClick={async () => {
              const ok = await confirmar('¿Empezar de nuevo?', {
                texto:
                  'Se liberan todos los números y, si estaba cerrado, el sorteo vuelve a abrirse. La configuración se conserva.',
                aceptar: 'Empezar de nuevo',
                peligro: true,
              });
              if (ok) vaciarTablero();
            }}
          >
            Vaciar tablero y empezar de nuevo
          </button>
        </section>
      )}
    </aside>
  );
}
