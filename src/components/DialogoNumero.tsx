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
  /** Los números que abrieron el diálogo. Vacío = cerrado; más de uno = venta en lote. */
  numeros: number[];
  puedeEditar: boolean;
  onCerrar: () => void;
  vender: (numeros: number[], comprador: string, telefono: string, pago: Pago) => Promise<string | null>;
  marcarPago: (numero: number, pago: Pago) => Promise<string | null>;
  liberar: (numero: number) => Promise<string | null>;
  confirmar: (titulo: string, o?: { texto?: string; aceptar?: string; peligro?: boolean }) => Promise<boolean>;
};

const NOMBRE_PAGO: Record<Pago, string> = {
  pendiente: 'Apartado',
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
};

export function DialogoNumero({
  estado,
  numeros,
  puedeEditar,
  onCerrar,
  vender,
  marcarPago,
  liberar,
  confirmar,
}: Props) {
  // Lo vendido y lo que se ve arriba manda el primero; el lote solo importa al vender.
  const numero = numeros[0] ?? null;
  const clave = numeros.join(',');
  const ref = useRef<HTMLDialogElement>(null);
  const [comprador, setComprador] = useState('');
  const [telefono, setTelefono] = useState('');
  const [pago, setPago] = useState<Pago>('pendiente');
  const [error, setError] = useState<string | null>(null);
  const [destapado, setDestapado] = useState(false);
  // Cliente ya escogido de las sugerencias: deja de proponer hasta que se reescriba.
  const [elegido, setElegido] = useState(false);
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
    setElegido(false);
    if (!d.open) d.showModal();
  }, [clave]);

  const ticket = numero !== null ? estado.tickets[numero] : undefined;
  const total = estado.config.totalNumeros;

  // Quien ya compró en esta rifa. Se busca escribiendo el nombre en el mismo
  // campo de la venta: con cincuenta clientes una lista completa no se navega.
  const conocidos = clientes(estado);
  const escrito = comprador.trim().toLowerCase();
  const coinciden =
    escrito.length >= 2 && !elegido
      ? conocidos.filter((c) => c.nombre.toLowerCase().includes(escrito))
      : [];
  const sugerencias = coinciden.slice(0, 6);

  const usarCliente = (nombre: string, telefono: string) => {
    setComprador(nombre);
    setTelefono(telefono);
    setElegido(true);
  };

  return (
    <dialog ref={ref} className="dialogo" onClose={onCerrar}>
      {numero !== null && (
        <>
          <h2 className="dialogo__titulo">
            {numeros.length > 1 ? (
              <>
                {numeros.length} números{' '}
                <strong>{numeros.map((n) => etiqueta(n, total)).join(', ')}</strong>
              </>
            ) : (
              <>
                Número <strong>{etiqueta(numero, total)}</strong>
              </>
            )}
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
                      aria-pressed={ticket.pago === p}
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
                const err = await vender(numeros, comprador, telefono, pago);
                setEnviando(false);
                if (err) setError(err);
                else onCerrar();
              }}
            >
              <label>
                Nombre del comprador
                <input
                  value={comprador}
                  onChange={(e) => {
                    setComprador(e.target.value);
                    setElegido(false);
                  }}
                  autoFocus
                  autoComplete="off"
                  placeholder={conocidos.length ? 'Escribe para buscar o crear' : 'Nombre y apellido'}
                />
              </label>

              {/* Botones y no un datalist: en Safari de iPhone el datalist no existe. */}
              {sugerencias.length > 0 && (
                <ul className="sugerencias">
                  {sugerencias.map((c) => (
                    <li key={c.telefono}>
                      <button
                        type="button"
                        className="sugerencias__op"
                        onClick={() => usarCliente(c.nombre, c.telefono)}
                      >
                        <strong>{c.nombre}</strong>
                        <span>{c.telefono}</span>
                      </button>
                    </li>
                  ))}
                  {coinciden.length > sugerencias.length && (
                    <li className="sugerencias__mas">
                      {coinciden.length - sugerencias.length} más: sigue escribiendo el nombre.
                    </li>
                  )}
                </ul>
              )}
              <label>
                Teléfono
                <input
                  value={telefono}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTelefono(v);
                    // Teclear el número completo de alguien conocido también trae su nombre.
                    const c = conocidos.find((x) => x.telefono === soloDigitos(v));
                    if (c) setComprador(c.nombre);
                  }}
                  inputMode="tel"
                  placeholder="3162123456"
                />
              </label>
              {/* Botones y no un <select>: elegir el pago es lo que más se toca
                  al vender, y un desplegable son dos toques y una lista tapando
                  el formulario. */}
              <div role="group" aria-label="Pago">
                <p className="dialogo__etiqueta">Pago</p>
                <div className="dialogo__pagos">
                  {(['pendiente', ...METODOS] as Pago[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={pago === p}
                      className={pago === p ? 'boton--primario' : ''}
                      onClick={() => setPago(p)}
                    >
                      {NOMBRE_PAGO[p]}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="dialogo__error">{error}</p>}
              <div className="dialogo__acciones">
                <button type="submit" className="boton--primario" disabled={enviando}>
                  {enviando ? 'Vendiendo…' : numeros.length > 1 ? `Vender los ${numeros.length}` : 'Vender'}
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
