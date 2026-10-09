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

/** Los cuatro colores de la paleta activa que puede llevar el texto de una foto. */
export const COLORES_TEXTO = ['crema', 'vino', 'rosa', 'rosa-claro'] as const;
export type ColorTexto = (typeof COLORES_TEXTO)[number];

/** Cuántas fotos caben en la hoja 2 sin volverla un mosaico. */
export const FOTOS_MAX = 3;
/** Un texto más largo que esto tapa la foto que está rotulando. */
export const LARGO_TEXTO_FOTO = 40;

export type FotoPoster = {
  url: string;
  texto: string;
  /** Tamaño del texto en px sobre la lámina de 720px de ancho. */
  tam: number;
  dx: number;
  dy: number;
  color: ColorTexto;
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
  fotoPremio: string; // vacío = la cabecera va sin foto
  fotos: FotoPoster[]; // vacío = el póster es una sola hoja
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
  marca: 'boleta',
  estiloCelda: 'solido',
  fondo: 'marco',
  paleta: 'institucional',
  tipografia: 'institucional',
  fotoPremio: '',
  fotos: [],
  plantillaApartado: PLANTILLA_APARTADO,
  plantillaPagado: PLANTILLA_PAGADO,
  finalizado: false,
  numeroGanador: null,
};

export const ESTADO_INICIAL: Estado = { config: CONFIG_INICIAL, tickets: {} };

function acotar(v: unknown, min: number, max: number, def: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return def;
  return Math.max(min, Math.min(max, Math.round(v)));
}

export function normalizarFoto(f: Partial<FotoPoster>): FotoPoster {
  return {
    url: typeof f.url === 'string' ? f.url : '',
    // Por caracteres y no por `slice`: un emoji son dos unidades UTF-16, y
    // cortar por la mitad deja un carácter roto además de contar doble.
    texto: [...(typeof f.texto === 'string' ? f.texto : '')]
      .slice(0, LARGO_TEXTO_FOTO)
      .join(''),
    tam: acotar(f.tam, 8, 34, 16),
    dx: acotar(f.dx, -60, 60, 0),
    dy: acotar(f.dy, -70, 70, 0),
    color: COLORES_TEXTO.includes(f.color as ColorTexto) ? (f.color as ColorTexto) : 'crema',
  };
}

/**
 * `config` es un jsonb: puede traer cualquier cosa de una rifa editada a mano o
 * guardada por otra versión. Se acota al entrar, no al pintar.
 */
export function limitarFotos(fotos: unknown): FotoPoster[] {
  if (!Array.isArray(fotos)) return [];
  return fotos
    .filter((f): f is Partial<FotoPoster> => !!f && typeof f === 'object')
    .slice(0, FOTOS_MAX)
    .map(normalizarFoto);
}

/** Config completa a partir de lo guardado: faltantes por defecto, fotos acotadas. */
export function hidratarConfig(c: Partial<Config> | undefined): Config {
  const base = { ...CONFIG_INICIAL, ...c };
  return {
    ...base,
    fotoPremio: typeof base.fotoPremio === 'string' ? base.fotoPremio : '',
    fotos: limitarFotos(base.fotos),
  };
}

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

/**
 * Deja el celular colombiano en 10 dígitos, o null si no lo es. Acepta como lo
 * escribe la gente: con +57, espacios o guiones.
 *
 * Antes bastaban 7 dígitos y entraban números inventados como "22", con los que
 * el WhatsApp del comprador nunca llega.
 */
export function celular(v: string): string | null {
  let d = soloDigitos(v);
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  return /^3\d{9}$/.test(d) ? d : null;
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

/**
 * Qué tanto se vendió, de 0 a 100. Es la barra de la cabecera del tablero.
 * El redondeo no puede mentir en los extremos: 0 y 100 son solo «nada vendido»
 * y «agotada», y con 1000 números una venta suelta no se redondea a 0.
 */
export function avance(estado: Estado): number {
  const total = estado.config.totalNumeros;
  const vendidos = Object.keys(estado.tickets).length;
  if (total <= 0 || vendidos <= 0) return 0;
  if (vendidos >= total) return 100;
  return Math.min(99, Math.max(1, Math.round((vendidos / total) * 100)));
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
  const tel = celular(telefono);
  if (nombre.length < 2) throw new Error('Escribe el nombre del comprador.');
  if (!tel) throw new Error('Escribe un celular colombiano: 10 dígitos que empiecen por 3.');
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

/** Normaliza la configuración al guardarla. Nunca descarta tickets. */
export function guardarConfig(estado: Estado, config: Config): Estado {
  const pedido = Math.max(1, Math.min(1000, Math.trunc(config.totalNumeros) || 1));
  // Achicar el tablero no puede tirar una venta: en la nube la base lo rechaza con
  // RIF01, y en modo local no hay quien lo rechace. El total se frena en el vendido
  // más alto; el tablero es base cero, de ahí el `+ 1`.
  const total = Object.keys(estado.tickets).reduce((t, n) => Math.max(t, Number(n) + 1), pedido);
  // Un ganador fuera del nuevo rango deja de tener sentido: se cae junto con el cierre.
  const ganadorValido =
    config.numeroGanador !== null && dentroDelRango(config.numeroGanador, total)
      ? config.numeroGanador
      : null;
  const limpia: Config = {
    ...config,
    totalNumeros: total,
    fotos: limitarFotos(config.fotos),
    precio: Math.max(0, config.precio || 0),
    numeroGanador: ganadorValido,
    finalizado: config.finalizado && ganadorValido !== null,
  };
  return { config: limpia, tickets: estado.tickets };
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

/** "05", o "05, 12 y 33" cuando la persona lleva varios números en el mismo mensaje. */
function listaNumeros(numeros: number[], total: number): string {
  const e = numeros.map((n) => etiqueta(n, total));
  if (e.length < 2) return e[0] ?? '';
  return `${e.slice(0, -1).join(', ')} y ${e[e.length - 1]}`;
}

/**
 * Mensaje de control que el organizador le manda al comprador. Con una lista de
 * números sale uno solo por toda la compra, no uno por número.
 */
export function mensajeComprador(estado: Estado, numero: number | number[]): string {
  const c = estado.config;
  const nums = Array.isArray(numero) ? numero : [numero];
  const tickets = nums.map((n) => estado.tickets[n]);
  if (!nums.length || tickets.some((t) => !t)) throw new Error('Ese número no está vendido.');
  const t = tickets[0]!;

  // Si queda algo por pagar, el mensaje es de cobro aunque otros números ya estén pagados.
  const pendientes = tickets.filter((x) => x!.pago === 'pendiente');
  const apartado = pendientes.length > 0;
  // Config guardada antes de existir las plantillas: no tumbar el panel por eso.
  const plantilla = apartado
    ? c.plantillaApartado || PLANTILLA_APARTADO
    : c.plantillaPagado || PLANTILLA_PAGADO;
  // {precio} es la plata de la que habla el mensaje: lo que debe, o lo que pagó.
  const cuantos = apartado ? pendientes.length : tickets.length;
  return rellenar(plantilla, {
    nombre: t.comprador.trim().split(/\s+/)[0] || '',
    numero: listaNumeros(nums, c.totalNumeros),
    titulo: c.titulo,
    premio: c.premio,
    fecha: formatearFecha(c.fechaJuego),
    loteria: c.loteria,
    precio: formatearPrecio(c.precio * cuantos, c.moneda),
    metodo: (tickets.find((x) => x!.pago !== 'pendiente') ?? t)!.pago,
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
export function linkComprador(estado: Estado, numero: number | number[]): string {
  const primero = Array.isArray(numero) ? numero[0] : numero;
  const t = estado.tickets[primero];
  return `https://wa.me/${conIndicativo(t?.telefono ?? '')}?text=${encodeURIComponent(
    mensajeComprador(estado, numero),
  )}`;
}

/**
 * Quién es quién dentro de una rifa. Teléfono y nombre juntos: con el teléfono
 * solo, dos personas que comparten celular quedaban como una sola venta y en el
 * tablero aparecía el nombre de la otra.
 */
function llavePersona(telefono: string, nombre: string): string {
  return `${telefono}|${nombre.trim().toLowerCase()}`;
}

export type Cliente = { nombre: string; telefono: string };

/**
 * Quienes ya compraron en esta rifa, sin repetir. Sirve para no volver a teclear
 * nombre y teléfono cuando la misma persona pide un segundo o tercer puesto.
 * Un teléfono puede ser de dos personas (la mamá presta el celular, el negocio
 * tiene uno solo): la llave es teléfono + nombre, y las dos salen en la lista.
 */
export function clientes(estado: Estado): Cliente[] {
  const porPersona = new Map<string, Cliente>();
  const ventas = Object.values(estado.tickets).sort((a, b) => a.vendidoEn.localeCompare(b.vendidoEn));
  for (const t of ventas) {
    const nombre = t.comprador.trim();
    if (nombre.length < 2 || !t.telefono) continue;
    porPersona.set(llavePersona(t.telefono, nombre), { nombre, telefono: t.telefono });
  }
  return [...porPersona.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export type Venta = { nombre: string; telefono: string; numeros: number[]; pendientes: number };

/**
 * Los compradores con todos sus números juntos, para cobrar sin ir número por
 * número en el tablero. Primero quien todavía debe: es a quien hay que buscar.
 */
export function ventas(estado: Estado): Venta[] {
  const porPersona = new Map<string, Venta>();
  const tickets = Object.values(estado.tickets).sort((a, b) => a.numero - b.numero);
  for (const t of tickets) {
    const llave = llavePersona(t.telefono, t.comprador);
    const v = porPersona.get(llave) ?? {
      nombre: t.comprador.trim(),
      telefono: t.telefono,
      numeros: [],
      pendientes: 0,
    };
    v.numeros.push(t.numero);
    if (t.pago === 'pendiente') v.pendientes++;
    porPersona.set(llave, v);
  }
  return [...porPersona.values()].sort(
    (a, b) => b.pendientes - a.pendientes || a.nombre.localeCompare(b.nombre, 'es'),
  );
}

export type FiltroVentas = 'todas' | 'cobrar' | 'pagadas';

/** Esta lista existe para cobrar: «Por cobrar» es el filtro que importa. */
export function filtrarVentas(lista: Venta[], filtro: FiltroVentas): Venta[] {
  if (filtro === 'cobrar') return lista.filter((v) => v.pendientes > 0);
  if (filtro === 'pagadas') return lista.filter((v) => v.pendientes === 0);
  return lista;
}
