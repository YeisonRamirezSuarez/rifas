import { useState } from 'react';
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
import { FONDOS } from '../fondos';
import { ESTILOS_CELDA, estiloPorId, Icono, MARCAS } from '../marcas';
import { PALETAS, TIPOGRAFIAS } from '../temas';
import { CampoNumero } from './CampoNumero';

type Props = {
  estado: Estado;
  configurar: (config: Config) => void;
  finalizar: (numeroGanador: number) => Promise<string | null>;
  reabrir: () => Promise<string | null>;
  vaciarTablero: () => Promise<string | null>;
  exportarPoster: () => void;
  exportarGanador: () => void;
  exportando: string | null;
  confirmar: (titulo: string, o?: { texto?: string; aceptar?: string; peligro?: boolean }) => Promise<boolean>;
};

const PESTANAS = [
  { id: 'sorteo', titulo: 'Sorteo' },
  { id: 'diseno', titulo: 'Diseño' },
  { id: 'mensaje', titulo: 'Mensaje' },
  { id: 'caja', titulo: 'Caja' },
  { id: 'cierre', titulo: 'Cierre' },
] as const;

type Pestana = (typeof PESTANAS)[number]['id'];

export function PanelConfig({
  estado,
  configurar,
  finalizar,
  reabrir,
  vaciarTablero,
  exportarPoster,
  exportarGanador,
  exportando,
  confirmar,
}: Props) {
  const c = estado.config;
  const r = reporte(estado);
  const [pestana, setPestana] = useState<Pestana>('sorteo');
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
            aria-selected={pestana === p.id}
            className={`panel__tab${pestana === p.id ? ' panel__tab--activa' : ''}`}
            onClick={() => setPestana(p.id)}
          >
            {p.titulo}
          </button>
        ))}
      </nav>

      {pestana === 'sorteo' && (
        <section className="panel__seccion">
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
            <CampoNumero
              valor={c.totalNumeros}
              min={1}
              max={1000}
              onCambio={(v) => set('totalNumeros', v)}
            />
          </label>
          <p className="panel__nota">Los campos numéricos se aplican al salir del campo.</p>
        </section>
      )}

      {pestana === 'diseno' && (
        <section className="panel__seccion">
          <label>
            Título
            <input value={c.titulo} onChange={(e) => set('titulo', e.target.value)} />
          </label>
          <label>
            Mensaje del pie
            <input value={c.mensaje} onChange={(e) => set('mensaje', e.target.value)} />
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
            <>
              <p className="panel__etiqueta">Marca del puesto vendido</p>
              <div className="panel__marcas">
                {MARCAS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    title={m.nombre}
                    aria-label={m.nombre}
                    aria-pressed={c.marca === m.id}
                    className={`marca${c.marca === m.id ? ' marca--activa' : ''}`}
                    onClick={() => set('marca', m.id)}
                  >
                    <Icono id={m.id} />
                  </button>
                ))}
              </div>
            </>
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

          <div className="panel__muestra">
            {(['libre', 'apartado', 'pagado'] as const).map((situacion, i) => (
              <span
                key={situacion}
                className={`celda celda--${situacion} celda--${estiloPorId(c.estiloCelda)}`}
              >
                {situacion === 'libre' || !c.ocultarVendidos ? (
                  etiqueta(i, c.totalNumeros)
                ) : (
                  <Icono id={c.marca} className="celda__marca" />
                )}
              </span>
            ))}
          </div>
          <p className="panel__nota">Muestra: libre · apartado · pagado</p>

          <p className="panel__etiqueta">Fondo decorativo</p>
          <div className="panel__fondos">
            {FONDOS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={c.fondo === f.id}
                className={`panel__opcion${c.fondo === f.id ? ' panel__opcion--activa' : ''}`}
                onClick={() => set('fondo', f.id)}
              >
                {f.nombre}
              </button>
            ))}
          </div>

          <p className="panel__etiqueta">Paleta de colores</p>
          <div className="panel__paletas">
            {PALETAS.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.nombre}
                aria-label={p.nombre}
                aria-pressed={c.paleta === p.id}
                className={`paleta${c.paleta === p.id ? ' paleta--activa' : ''}`}
                style={{ background: p.fondo }}
                onClick={() => set('paleta', p.id)}
              >
                <span style={{ background: p.acento }} />
                <span style={{ background: p.claro }} />
              </button>
            ))}
          </div>

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
          <button type="button" onClick={exportarPoster}>
            {exportando === 'poster' ? 'Generando…' : 'Descargar póster (estado de WhatsApp)'}
          </button>
        </section>
      )}

      {pestana === 'mensaje' && (
        <section className="panel__seccion">
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

      {pestana === 'caja' && (
        <section className="panel__seccion">
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
            Toca un número apartado en el tablero para registrar el pago o avisarle al comprador.
          </p>
        </section>
      )}

      {pestana === 'cierre' && (
        <section className="panel__seccion">
          {c.finalizado && c.numeroGanador !== null ? (
            <>
              <p className="panel__nota">
                Sorteo cerrado. Ganador: <strong>{etiqueta(c.numeroGanador, c.totalNumeros)}</strong>
              </p>
              <button type="button" className="boton--primario" onClick={exportarGanador}>
                {exportando === 'ganador' ? 'Generando…' : 'Descargar imagen del ganador'}
              </button>
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
              const ok = await confirmar('¿Vaciar el tablero?', {
                texto: 'Se liberan todos los números vendidos. La configuración se conserva.',
                aceptar: 'Vaciar',
                peligro: true,
              });
              if (ok) vaciarTablero();
            }}
          >
            Vaciar tablero
          </button>
        </section>
      )}
    </aside>
  );
}
