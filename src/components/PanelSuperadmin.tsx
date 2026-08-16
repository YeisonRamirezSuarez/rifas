import { useState } from 'react';
import type { useCuentas } from '../useCuentas';
import type { EstadoCuenta, Rol } from '../usePerfil';

type Props = {
  cuentas: ReturnType<typeof useCuentas>;
  confirmar: (
    titulo: string,
    opciones?: { texto?: string; aceptar?: string; peligro?: boolean },
  ) => Promise<boolean>;
  decidir: (
    id: string,
    estado: EstadoCuenta,
    pago?: { pagadoEn: string | null; pagoNota: string | null },
  ) => Promise<string | null>;
};

const ETIQUETA: Record<EstadoCuenta, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Activa',
  rechazado: 'Desactivada',
};

/** Para instantes de verdad (`creado_en`): se convierte a la hora local y se muestra. */
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-CO');

/**
 * Para `pagado_en`, que es un día suelto escrito como `YYYY-MM-DD` en una columna
 * `timestamptz`: Postgres lo ancla a medianoche UTC, y pasarlo por `new Date` en
 * Colombia (UTC−5) lo corre al día anterior. Se parte el texto en vez de convertirlo.
 */
const fechaDia = (iso: string) => {
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
};

/** Hoy según el reloj de quien mira. `toISOString()` da el día UTC, que en Colombia
 *  después de las 19:00 ya es mañana y prellenaba el cobro con la fecha equivocada. */
const hoyLocal = () => {
  const h = new Date();
  const mes = String(h.getMonth() + 1).padStart(2, '0');
  const dia = String(h.getDate()).padStart(2, '0');
  return `${h.getFullYear()}-${mes}-${dia}`;
};

/** Solo para superadmin: acepta, desactiva y cambia el rol de las cuentas. */
export function PanelSuperadmin({ cuentas, confirmar, decidir }: Props) {
  const [aviso, setAviso] = useState<string | null>(null);
  // id de la fila con el formulario de pago abierto. null = ninguna.
  const [cobrando, setCobrando] = useState<string | null>(null);
  const [fecha_, setFecha] = useState('');
  const [nota, setNota] = useState('');

  const abrirPago = (id: string, pagadoEn: string | null, pagoNota: string | null) => {
    setCobrando(id);
    setFecha(pagadoEn ? pagadoEn.slice(0, 10) : hoyLocal());
    setNota(pagoNota ?? '');
    setAviso(null);
  };

  const guardarPago = async (id: string, aprobar: boolean) => {
    const err = aprobar
      ? await decidir(id, 'aprobado', { pagadoEn: fecha_ || null, pagoNota: nota.trim() || null })
      : await cuentas.actualizarCuenta(id, {
          pagadoEn: fecha_ || null,
          pagoNota: nota.trim() || null,
        });
    setAviso(err);
    if (!err) setCobrando(null);
  };

  const quitar = async (id: string, nombre: string, estado: EstadoCuenta) => {
    const activa = estado === 'aprobado';
    const ok = await confirmar(activa ? `¿Desactivar a ${nombre}?` : `¿Rechazar a ${nombre}?`, {
      // La consecuencia menos obvia: no es solo que deje de entrar.
      texto: activa
        ? 'Deja de poder entrar y los links públicos de sus rifas dejan de abrir.'
        : 'Podrás activarla después si cambia la cosa.',
      aceptar: activa ? 'Desactivar' : 'Rechazar',
      peligro: true,
    });
    if (ok) setAviso(await decidir(id, 'rechazado'));
  };

  const cambiarRol = async (id: string, nombre: string, rol: Rol) => {
    if (rol === 'superadmin') {
      const ok = await confirmar(`¿Hacer superadmin a ${nombre}?`, {
        texto: 'Podrá aprobar, desactivar y cambiar el rol de cualquier cuenta menos la suya.',
        aceptar: 'Hacer superadmin',
      });
      if (!ok) return;
    }
    setAviso(await cuentas.actualizarCuenta(id, { rol }));
  };

  return (
    <aside className="panel">
      <div className="misrifas__cabecera">
        <h2 className="panel__titulo">
          Cuentas
          {cuentas.pendientes > 0 && <span className="panel__globo">{cuentas.pendientes}</span>}
        </h2>
        <button type="button" onClick={cuentas.recargar}>
          Actualizar
        </button>
      </div>

      <label className="cuentas__buscar">
        Buscar por correo
        <input
          type="search"
          value={cuentas.busqueda}
          onChange={(e) => cuentas.setBusqueda(e.target.value)}
          placeholder="ana@correo.com"
        />
      </label>

      {/* Buscando, la pestaña no aplica: se busca en todas las cuentas. */}
      {!cuentas.busqueda.trim() && (
        <nav className="panel__nav" role="tablist" aria-label="Estado de las cuentas">
          {(['pendiente', 'aprobado', 'rechazado'] as EstadoCuenta[]).map((e) => (
            <button
              key={e}
              type="button"
              role="tab"
              aria-selected={cuentas.filtro === e}
              className={`panel__tab${cuentas.filtro === e ? ' panel__tab--activa' : ''}`}
              onClick={() => cuentas.setFiltro(e)}
            >
              {ETIQUETA[e]}
            </button>
          ))}
        </nav>
      )}

      {cuentas.hayCambios && (
        <button type="button" className="cuentas__novedad" onClick={cuentas.recargar}>
          Hay cambios nuevos · actualizar
        </button>
      )}

      {cuentas.cargando && cuentas.lista.length === 0 ? (
        <p className="panel__nota">Cargando…</p>
      ) : cuentas.lista.length === 0 ? (
        <p className="panel__nota">
          {cuentas.busqueda.trim() ? 'Ningún correo coincide.' : 'No hay cuentas en este estado.'}
        </p>
      ) : (
        <ul className="cuentas">
          {cuentas.lista.map((c) => (
            <li key={c.id} className="cuentas__fila">
              <div>
                <strong>{c.nombre || c.email}</strong>
                {c.nombre && <span>{c.email}</span>}
                <span>
                  {ETIQUETA[c.estado]} · {fecha(c.creado_en)}
                </span>
              </div>

              <span className={`cuentas__pago${c.pagado_en ? '' : ' cuentas__pago--falta'}`}>
                {c.pagado_en
                  ? `Pagó ${fechaDia(c.pagado_en)}${c.pago_nota ? ` · ${c.pago_nota}` : ''}`
                  : 'Sin pago registrado'}
              </span>

              <label className="cuentas__rol">
                Rol
                <select
                  value={c.rol}
                  onChange={(e) => cambiarRol(c.id, c.nombre || c.email, e.target.value as Rol)}
                >
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </label>

              <div className="cuentas__acciones">
                {c.estado !== 'aprobado' && cobrando !== c.id && (
                  <button
                    type="button"
                    className="boton--primario"
                    onClick={() => abrirPago(c.id, c.pagado_en, c.pago_nota)}
                  >
                    Aprobar
                  </button>
                )}
                {c.estado === 'aprobado' && cobrando !== c.id && (
                  <button
                    type="button"
                    onClick={() => abrirPago(c.id, c.pagado_en, c.pago_nota)}
                  >
                    {c.pagado_en ? 'Editar pago' : 'Registrar pago'}
                  </button>
                )}
                {c.estado !== 'rechazado' && (
                  <button
                    type="button"
                    className="boton--peligro"
                    onClick={() => quitar(c.id, c.nombre || c.email, c.estado)}
                  >
                    {c.estado === 'aprobado' ? 'Desactivar' : 'Rechazar'}
                  </button>
                )}
              </div>

              {cobrando === c.id && (
                <div className="cuentas__cobro">
                  <label>
                    Fecha del pago
                    <input type="date" value={fecha_} onChange={(e) => setFecha(e.target.value)} />
                  </label>
                  <label>
                    Medio y referencia
                    <input
                      value={nota}
                      onChange={(e) => setNota(e.target.value)}
                      maxLength={200}
                      placeholder="Nequi 300…"
                    />
                  </label>
                  <div className="cuentas__acciones">
                    <button
                      type="button"
                      className="boton--primario"
                      onClick={() => guardarPago(c.id, c.estado !== 'aprobado')}
                    >
                      {c.estado === 'aprobado' ? 'Guardar pago' : 'Aprobar con pago'}
                    </button>
                    {c.estado !== 'aprobado' && (
                      // Cortesías, pruebas, el que paga después: aprobar sin cobrar
                      // tiene que ser un clic, no un rodeo.
                      <button
                        type="button"
                        onClick={async () => {
                          setAviso(
                            await decidir(c.id, 'aprobado', { pagadoEn: null, pagoNota: null }),
                          );
                          setCobrando(null);
                        }}
                      >
                        Aprobar sin pago
                      </button>
                    )}
                    <button type="button" onClick={() => setCobrando(null)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {cuentas.hayMas && (
        <button type="button" onClick={cuentas.mas} disabled={cuentas.cargando}>
          {cuentas.cargando ? 'Cargando…' : 'Ver más'}
        </button>
      )}

      {(aviso || cuentas.error) && (
        <p className="dialogo__error" role="alert">
          {aviso ?? cuentas.error}
        </p>
      )}
    </aside>
  );
}
