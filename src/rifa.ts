/** Núcleo de la rifa: tipos puros + reglas. Sin React, sin DOM. */

/** Un solo campo en vez de `pagado` + `metodo`: no existe "pagó pero sin método". */
export type Pago = 'pendiente' | 'efectivo' | 'transferencia';

export const METODOS: Exclude<Pago, 'pendiente'>[] = ['efectivo', 'transferencia'];

export type Ticket = {
  numero: number;
  comprador: string;
  telefono: string;
  pago: Pago;
  vendidoEn: string; // ISO
};

export type Config = {
  titulo: string;
  premio: string;
  loteria: string;
  fechaJuego: string; // YYYY-MM-DD
  precio: number;
  moneda: string;
  etiquetaContacto: string;
  contacto: string;
  responsable: string;
  mensaje: string;
  totalNumeros: number;
  ocultarVendidos: boolean; // "tapado": esconde el número vendido
  marca: string; // icono que reemplaza al número tapado
  estiloCelda: string;
  fondo: string;
  paleta: string;
  tipografia: string;
  plantillaApartado: string;
  plantillaPagado: string;
  finalizado: boolean;
  numeroGanador: number | null;
};

export type Estado = { config: Config; tickets: Record<number, Ticket> };

/** libre → sin dueño. apartado → vendido sin pagar. pagado → cobrado. */
export type EstadoNumero = 'libre' | 'apartado' | 'pagado';

/** Lo que se puede escribir entre llaves en las plantillas de mensaje. */
export const VARIABLES = [
  'nombre',
  'numero',
  'titulo',
  'premio',
  'fecha',
  'loteria',
  'precio',
  'metodo',
  'contacto',
] as const;

export const PLANTILLA_APARTADO =
  'Hola {nombre}, tu número en el {titulo} es el {numero}.\n' +
  'Queda APARTADO. Pago pendiente de {precio}.\n' +
  'Se rifa: {premio}.\n' +
  'Juega el {fecha} con la {loteria}.\n' +
  '¡Mucha suerte!';

export const PLANTILLA_PAGADO =
  'Hola {nombre}, tu número en el {titulo} es el {numero}.\n' +
  'Pago CONFIRMADO de {precio} por {metodo}. ¡Gracias!\n' +
  'Se rifa: {premio}.\n' +
  'Juega el {fecha} con la {loteria}.\n' +
  '¡Mucha suerte!';

export const CONFIG_INICIAL: Config = {
  titulo: 'GRAN SORTEO',
  premio: 'Una moto Honda XR 150',
  loteria: 'Lotería de Bogotá',
  fechaJuego: '2026-04-15',
  precio: 5000,
  moneda: 'COP',
  etiquetaContacto: 'contacto',
  contacto: '3162123456',
  responsable: '',
  mensaje: 'gracias por tu compra',
  totalNumeros: 100,
  ocultarVendidos: true,
  marca: 'corazon',
  estiloCelda: 'solido',
  fondo: 'botanico',
  paleta: 'rosa',
  tipografia: 'clasica',
  plantillaApartado: PLANTILLA_APARTADO,
  plantillaPagado: PLANTILLA_PAGADO,
  finalizado: false,
  numeroGanador: null,
};

export const ESTADO_INICIAL: Estado = { config: CONFIG_INICIAL, tickets: {} };

/** Con 100 números: 0 -> "00", 99 -> "99". Ancho según el número más alto. */
export function etiqueta(n: number, total: number): string {
  return String(n).padStart(String(total - 1).length, '0');
}

/** Los tableros van de 00 a 99: gana por las dos últimas cifras de la lotería. */
export function dentroDelRango(numero: number, total: number): boolean {
  return Number.isInteger(numero) && numero >= 0 && numero < total;
}

export function soloDigitos(v: string): string {
  return v.replace(/\D/g, '');
}

/** 3162123456 -> "316***3456". Menos de 6 dígitos: todo tapado. */
export function taparTelefono(tel: string): string {
  const d = soloDigitos(tel);
  if (d.length < 6) return '*'.repeat(d.length);
  return d.slice(0, 3) + '*'.repeat(d.length - 7 > 0 ? d.length - 7 : 1) + d.slice(-4);
}

/** "Leidy Gómez" -> "L. G." */
export function taparNombre(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + '.')
    .join(' ');
}

export function formatearPrecio(precio: number, moneda: string): string {
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: moneda,
      maximumFractionDigits: 0,
    }).format(precio);
  } catch {
    return `$${precio.toLocaleString('es-CO')}`;
  }
}

export function formatearFecha(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long' })
    .format(d)
    .toUpperCase();
}

export function numeros(total: number): number[] {
  return Array.from({ length: total }, (_, i) => i);
}

export function estadoNumero(estado: Estado, numero: number): EstadoNumero {
  const t = estado.tickets[numero];
  if (!t) return 'libre';
  return t.pago === 'pendiente' ? 'apartado' : 'pagado';
}

/** Cuadre de caja: cuánto entró por cada método y cuánto falta cobrar. */
export function reporte(estado: Estado) {
  const precio = estado.config.precio;
  const todos = Object.values(estado.tickets);
  const cuenta = (p: Pago) => todos.filter((t) => t.pago === p).length;

  const efectivo = cuenta('efectivo');
  const transferencia = cuenta('transferencia');
  const pendientes = cuenta('pendiente');

  return {
    total: estado.config.totalNumeros,
    vendidos: todos.length,
    disponibles: estado.config.totalNumeros - todos.length,
    pendientes,
    efectivo,
    transferencia,
    montoEfectivo: efectivo * precio,
    montoTransferencia: transferencia * precio,
    cobrado: (efectivo + transferencia) * precio,
    porCobrar: pendientes * precio,
  };
}

/** Valida y vende. Devuelve estado nuevo o lanza Error con mensaje para el usuario. */
export function vender(
  estado: Estado,
  numero: number,
  comprador: string,
  telefono: string,
  pago: Pago = 'pendiente',
): Estado {
  if (estado.config.finalizado) {
    throw new Error('El sorteo ya está cerrado. Reábrelo para seguir vendiendo.');
  }
  if (!dentroDelRango(numero, estado.config.totalNumeros)) {
    throw new Error('Número fuera de rango.');
  }
  if (estado.tickets[numero]) throw new Error('Ese número ya está vendido.');
  const nombre = comprador.trim();
  const tel = soloDigitos(telefono);
  if (nombre.length < 2) throw new Error('Escribe el nombre del comprador.');
  if (tel.length < 7) throw new Error('Teléfono inválido (mínimo 7 dígitos).');
  return {
    ...estado,
    tickets: {
      ...estado.tickets,
      [numero]: { numero, comprador: nombre, telefono: tel, pago, vendidoEn: new Date().toISOString() },
    },
  };
}

/**
 * Varios números para el mismo comprador, en una sola venta. Se valida todo o
 * nada: si uno del lote está ocupado, no se vende ninguno y sale el error.
 */
export function venderVarios(
  estado: Estado,
  numeros: number[],
  comprador: string,
  telefono: string,
  pago: Pago = 'pendiente',
): Estado {
  if (!numeros.length) throw new Error('Elige al menos un número.');
  return numeros.reduce((e, n) => vender(e, n, comprador, telefono, pago), estado);
}

export function marcarPago(estado: Estado, numero: number, pago: Pago): Estado {
  const t = estado.tickets[numero];
  if (!t) throw new Error('Ese número no está vendido.');
  return { ...estado, tickets: { ...estado.tickets, [numero]: { ...t, pago } } };
}

export function liberar(estado: Estado, numero: number): Estado {
  const { [numero]: _quitado, ...resto } = estado.tickets;
  return { ...estado, tickets: resto };
}

/** Cierra la rifa con un ganador. El número debe existir en el tablero. */
export function finalizar(estado: Estado, numeroGanador: number): Estado {
  const total = estado.config.totalNumeros;
  if (!dentroDelRango(numeroGanador, total)) {
    throw new Error(
      `El número ganador debe estar entre ${etiqueta(0, total)} y ${etiqueta(total - 1, total)}.`,
    );
  }
  return { ...estado, config: { ...estado.config, finalizado: true, numeroGanador } };
}

export function reabrir(estado: Estado): Estado {
  return { ...estado, config: { ...estado.config, finalizado: false, numeroGanador: null } };
}

export function ganador(estado: Estado): Ticket | null {
  const n = estado.config.numeroGanador;
  return n === null ? null : estado.tickets[n] ?? null;
}

/** Descarta tickets fuera del nuevo total al cambiar la configuración. */
export function guardarConfig(estado: Estado, config: Config): Estado {
  const total = Math.max(1, Math.min(1000, Math.trunc(config.totalNumeros) || 1));
  // Un ganador fuera del nuevo rango deja de tener sentido: se cae junto con el cierre.
  const ganadorValido =
    config.numeroGanador !== null && dentroDelRango(config.numeroGanador, total)
      ? config.numeroGanador
      : null;
  const limpia: Config = {
    ...config,
    totalNumeros: total,
    precio: Math.max(0, config.precio || 0),
    numeroGanador: ganadorValido,
    finalizado: config.finalizado && ganadorValido !== null,
  };
  const tickets = Object.fromEntries(
    Object.entries(estado.tickets).filter(([n]) => dentroDelRango(Number(n), total)),
  );
  return { config: limpia, tickets };
}

/** Texto legible para el link público: "Rifa de la Moto" -> "rifa-de-la-moto-4f2a". */
export function slugificar(texto: string): string {
  const base = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // tildes ya separadas por NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const sufijo = Math.random().toString(36).slice(2, 6);
  return `${base || 'rifa'}-${sufijo}`;
}

// ponytail: indicativo fijo de Colombia. Si vendes fuera del país, pásalo a la config.
const INDICATIVO = '57';

/** Los celulares colombianos son de 10 dígitos; más largo ya trae indicativo. */
function conIndicativo(telefono: string): string {
  const d = soloDigitos(telefono);
  return d.length > 10 ? d : INDICATIVO + d;
}

/** Reemplaza {variable}. Lo que no reconoce lo deja tal cual: un typo se ve, no desaparece. */
export function rellenar(plantilla: string, valores: Record<string, string>): string {
  return plantilla.replace(/\{(\w+)\}/g, (original, clave: string) => valores[clave] ?? original);
}

/** Mensaje de control que el organizador le manda al comprador. */
export function mensajeComprador(estado: Estado, numero: number): string {
  const c = estado.config;
  const t = estado.tickets[numero];
  if (!t) throw new Error('Ese número no está vendido.');

  // Config guardada antes de existir las plantillas: no tumbar el panel por eso.
  const plantilla =
    t.pago === 'pendiente'
      ? c.plantillaApartado || PLANTILLA_APARTADO
      : c.plantillaPagado || PLANTILLA_PAGADO;
  return rellenar(plantilla, {
    nombre: t.comprador.trim().split(/\s+/)[0] || '',
    numero: etiqueta(numero, c.totalNumeros),
    titulo: c.titulo,
    premio: c.premio,
    fecha: formatearFecha(c.fechaJuego),
    loteria: c.loteria,
    precio: formatearPrecio(c.precio, c.moneda),
    metodo: t.pago,
    contacto: `${c.etiquetaContacto}: ${c.contacto}`,
  }).trim();
}

/** Vista previa para la configuración: sin ticket real, con datos de ejemplo. */
export function ejemploMensaje(config: Config, pago: Pago): string {
  const ficticio: Estado = {
    config,
    tickets: {
      0: {
        numero: 0,
        comprador: 'Ana Ruiz',
        telefono: '3001112233',
        pago,
        vendidoEn: new Date().toISOString(),
      },
    },
  };
  return mensajeComprador(ficticio, 0);
}

/** Abre WhatsApp con el mensaje listo hacia el teléfono del comprador. */
export function linkComprador(estado: Estado, numero: number): string {
  const t = estado.tickets[numero];
  return `https://wa.me/${conIndicativo(t?.telefono ?? '')}?text=${encodeURIComponent(
    mensajeComprador(estado, numero),
  )}`;
}

export type Cliente = { nombre: string; telefono: string };

/**
 * Quienes ya compraron en esta rifa, sin repetir. Sirve para no volver a teclear
 * nombre y teléfono cuando la misma persona pide un segundo o tercer puesto.
 * Un teléfono = una persona: si cambió el nombre, manda el de la venta más nueva.
 */
export function clientes(estado: Estado): Cliente[] {
  const porTelefono = new Map<string, Cliente>();
  const ventas = Object.values(estado.tickets).sort((a, b) => a.vendidoEn.localeCompare(b.vendidoEn));
  for (const t of ventas) {
    if (t.comprador.trim().length < 2 || !t.telefono) continue;
    porTelefono.set(t.telefono, { nombre: t.comprador.trim(), telefono: t.telefono });
  }
  return [...porTelefono.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
