import { useEffect, useRef, useState } from 'react';
import { IconoUI } from '../marcas';
import {
  clientes,
  etiqueta,
  linkComprador,
  METODOS,
  soloDigitos,
  taparNombre,
  taparTelefono,
  type Estado,
  type Pago,
} from '../rifa';

type Props = {
  estado: Estado;
  numero: number | null;
  puedeEditar: boolean;
  onCerrar: () => void;
  vender: (numero: number, comprador: string, telefono: string, pago: Pago) => Promise<string | null>;
  marcarPago: (numero: number, pago: Pago) => Promise<string | null>;
  liberar: (numero: number) => Promise<string | null>;
  confirmar: (titulo: string, o?: { texto?: string; aceptar?: string; peligro?: boolean }) => Promise<boolean>;
};

const NOMBRE_PAGO: Record<Pago, string> = {
  pendiente: 'Pendiente',
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
};

export function DialogoNumero({
  estado,
  numero,
  puedeEditar,
  onCerrar,
  vender,
  marcarPago,
  liberar,
  confirmar,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [comprador, setComprador] = useState('');
  const [telefono, setTelefono] = useState('');
  const [pago, setPago] = useState<Pago>('pendiente');
  const [error, setError] = useState<string | null>(null);
  const [destapado, setDestapado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (numero === null) {
      d.close();
      return;
    }
    setComprador('');
    setTelefono('');
    setPago('pendiente');
    setError(null);
    setDestapado(false);
    if (!d.open) d.showModal();
  }, [numero]);

  const ticket = numero !== null ? estado.tickets[numero] : undefined;
  const total = estado.config.totalNumeros;

  // Quien ya compró en esta rifa. Al escribir el nombre o los primeros dígitos
  // del teléfono, el navegador sugiere, y al elegir se llena el otro campo.
  const conocidos = clientes(estado);
  // Dos personas con el mismo nombre y distinto teléfono: en la lista de nombres va una.
  const porNombre = conocidos.filter((c, i) => conocidos.findIndex((o) => o.nombre === c.nombre) === i);

  return (
    <dialog ref={ref} className="dialogo" onClose={onCerrar}>
      {numero !== null && (
        <>
          <h2 className="dialogo__titulo">
            Número <strong>{etiqueta(numero, total)}</strong>
          </h2>

          {ticket ? (
            <div className="dialogo__cuerpo">
              {ticket.comprador ? (
                <>
                  <p className="dialogo__etiqueta">Comprador</p>
                  <p className="dialogo__dato">
                    {destapado ? ticket.comprador : taparNombre(ticket.comprador)}
                  </p>
                  <p className="dialogo__etiqueta">Teléfono</p>
                  <p className="dialogo__dato">
                    {destapado ? ticket.telefono : taparTelefono(ticket.telefono)}
                  </p>
                </>
              ) : (
                <p className="dialogo__dato">Este número ya está vendido.</p>
              )}

              <p className="dialogo__etiqueta">Pago</p>
              {puedeEditar ? (
                <div className="dialogo__pagos">
                  {(['pendiente', ...METODOS] as Pago[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={ticket.pago === p ? 'boton--primario' : ''}
                      onClick={async () => setError(await marcarPago(numero, p))}
                    >
                      {NOMBRE_PAGO[p]}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="dialogo__dato">
                  {ticket.pago === 'pendiente' ? 'Apartado' : 'Pagado'}
                </p>
              )}

              {puedeEditar && ticket.telefono && (
                <a
                  className="boton boton--primario"
                  href={linkComprador(estado, numero)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Avisarle al comprador por WhatsApp
                </a>
              )}

              {puedeEditar && (
                <div className="dialogo__acciones">
                  {ticket.comprador && (
                    <button type="button" onClick={() => setDestapado((v) => !v)}>
                      {destapado ? 'Tapar' : 'Destapar'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="boton--peligro"
                    onClick={async () => {
                      const ok = await confirmar(`¿Liberar el número ${etiqueta(numero, total)}?`, {
                        texto: 'Vuelve a quedar disponible y se borran los datos del comprador.',
                        aceptar: 'Liberar',
                        peligro: true,
                      });
                      if (!ok) return;
                      const err = await liberar(numero);
                      if (err) setError(err);
                      else onCerrar();
                    }}
                  >
                    Liberar
                  </button>
                </div>
              )}
              {error && <p className="dialogo__error">{error}</p>}
            </div>
          ) : puedeEditar ? (
            <form
              className="dialogo__cuerpo"
              onSubmit={async (ev) => {
                ev.preventDefault();
                setEnviando(true);
                const err = await vender(numero, comprador, telefono, pago);
                setEnviando(false);
                if (err) setError(err);
                else onCerrar();
              }}
            >
              <label>
                Nombre del comprador
                <input
                  value={comprador}
                  list="clientes-nombre"
                  onChange={(e) => {
                    const v = e.target.value;
                    setComprador(v);
                    const c = conocidos.find((x) => x.nombre === v.trim());
                    if (c) setTelefono(c.telefono);
                  }}
                  autoFocus
                />
              </label>
              <label>
                Teléfono
                <input
                  value={telefono}
                  list="clientes-telefono"
                  onChange={(e) => {
                    const v = e.target.value;
                    setTelefono(v);
                    const c = conocidos.find((x) => x.telefono === soloDigitos(v));
                    if (c) setComprador(c.nombre);
                  }}
                  inputMode="tel"
                  placeholder="3162123456"
                />
              </label>
              <datalist id="clientes-nombre">
                {porNombre.map((c) => (
                  <option key={c.telefono} value={c.nombre}>
                    {c.telefono}
                  </option>
                ))}
              </datalist>
              <datalist id="clientes-telefono">
                {conocidos.map((c) => (
                  <option key={c.telefono} value={c.telefono}>
                    {c.nombre}
                  </option>
                ))}
              </datalist>
              <label>
                Pago
                <select value={pago} onChange={(e) => setPago(e.target.value as Pago)}>
                  <option value="pendiente">Apartado, sin pagar</option>
                  <option value="efectivo">Pagó en efectivo</option>
                  <option value="transferencia">Pagó por transferencia</option>
                </select>
              </label>
              {error && <p className="dialogo__error">{error}</p>}
              <div className="dialogo__acciones">
                <button type="submit" className="boton--primario" disabled={enviando}>
                  {enviando ? 'Vendiendo…' : 'Vender'}
                </button>
                <button type="button" onClick={onCerrar}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="dialogo__cuerpo">
              <p className="dialogo__dato">Disponible</p>
              <p className="dialogo__etiqueta">
                Para apartarlo, comunícate con {estado.config.etiquetaContacto}:{' '}
                {estado.config.contacto}
              </p>
            </div>
          )}

          <button type="button" className="dialogo__cerrar" onClick={onCerrar} aria-label="Cerrar">
            <IconoUI id="cerrar" />
          </button>
        </>
      )}
    </dialog>
  );
}
