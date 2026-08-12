import { describe, it, expect } from 'vitest';
import { FONDOS, fondoPorId } from './fondos';
import { estiloPorId, marcaPorId, MARCAS } from './marcas';
import { PALETAS, TIPOGRAFIAS } from './temas';
import {
  clientes,
  ESTADO_INICIAL,
  estadoNumero,
  etiqueta,
  finalizar,
  formatearPrecio,
  ganador,
  guardarConfig,
  liberar,
  linkComprador,
  marcarPago,
  mensajeComprador,
  numeros,
  reabrir,
  rellenar,
  reporte,
  slugificar,
  taparNombre,
  taparTelefono,
  vender,
  venderVarios,
  ventas,
} from './rifa';

const conVenta = (n: number, nombre = 'Ana') => vender(ESTADO_INICIAL, n, nombre, '3162123456');

describe('rifa', () => {
  it('el tablero va de 00 a 99, no de 1 a 100', () => {
    const n = numeros(100);
    expect(n).toHaveLength(100);
    expect(n[0]).toBe(0);
    expect(n.at(-1)).toBe(99);
    expect(etiqueta(0, 100)).toBe('00');
    expect(etiqueta(99, 100)).toBe('99');
    expect(etiqueta(7, 1000)).toBe('007');
  });

  it('vende varios números a la misma persona, o ninguno', () => {
    const e = venderVarios(ESTADO_INICIAL, [4, 8, 15], 'Ana Ruiz', '3162123456', 'efectivo');
    expect(Object.keys(e.tickets)).toEqual(['4', '8', '15']);
    expect(e.tickets[15].comprador).toBe('Ana Ruiz');
    expect(e.tickets[8].pago).toBe('efectivo');

    // Uno ocupado tumba el lote entero: nada a medias.
    expect(() => venderVarios(e, [20, 8], 'Beto', '3009998877')).toThrow('ya está vendido');
    expect(() => venderVarios(ESTADO_INICIAL, [], 'Beto', '3009998877')).toThrow('al menos un número');
  });

  it('lista los clientes de la rifa sin repetir', () => {
    let e = vender(ESTADO_INICIAL, 1, 'Ana Ruiz', '3162123456');
    e = vender(e, 2, 'Ana Ruiz', '3162123456'); // mismo cliente, segundo puesto
    e = vender(e, 3, 'Beto Paz', '3009998877');
    expect(clientes(e)).toEqual([
      { nombre: 'Ana Ruiz', telefono: '3162123456' },
      { nombre: 'Beto Paz', telefono: '3009998877' },
    ]);
    expect(clientes(liberar(e, 3))).toHaveLength(1);
  });

  it('tapa datos del comprador', () => {
    expect(taparTelefono('3162123456')).toBe('316***3456');
    expect(taparTelefono('12345')).toBe('*****');
    expect(taparNombre('Leidy del Puesto')).toBe('L. D. P.');
  });

  it('vende y libera', () => {
    const s = conVenta(42, 'Leidy');
    expect(s.tickets[42].telefono).toBe('3162123456');
    expect(ESTADO_INICIAL.tickets[42]).toBeUndefined(); // inmutable
    expect(liberar(s, 42).tickets[42]).toBeUndefined();
  });

  it('rechaza entradas inválidas', () => {
    expect(() => vender(ESTADO_INICIAL, -1, 'Ana', '3162123456')).toThrow();
    expect(() => vender(ESTADO_INICIAL, 100, 'Ana', '3162123456')).toThrow(); // el tope es 99
    expect(vender(ESTADO_INICIAL, 0, 'Ana', '3162123456').tickets[0]).toBeDefined(); // el 00 sí existe
    expect(() => vender(ESTADO_INICIAL, 5, 'A', '3162123456')).toThrow();
    expect(() => vender(ESTADO_INICIAL, 5, 'Ana', '123')).toThrow();
    expect(() => vender(conVenta(5), 5, 'Beto', '3009998877')).toThrow();
  });

  it('al reducir el total descarta los números que ya no existen', () => {
    const r = guardarConfig(conVenta(80), { ...ESTADO_INICIAL.config, totalNumeros: 50 });
    expect(r.tickets[80]).toBeUndefined();
    expect(r.config.totalNumeros).toBe(50);
  });

  it('vender deja el número apartado hasta que se cobra', () => {
    const s = conVenta(3);
    expect(estadoNumero(s, 3)).toBe('apartado');
    expect(estadoNumero(marcarPago(s, 3, 'efectivo'), 3)).toBe('pagado');
    expect(estadoNumero(s, 4)).toBe('libre');
    expect(() => marcarPago(s, 4, 'efectivo')).toThrow();
  });

  it('el reporte separa efectivo, transferencia y lo que falta cobrar', () => {
    let s = conVenta(1);
    s = vender(s, 2, 'Beto', '3009998877');
    s = vender(s, 3, 'Ciro', '3001112233');
    s = marcarPago(s, 1, 'efectivo');
    s = marcarPago(s, 2, 'transferencia');

    const r = reporte(s); // precio 5000
    expect(r).toMatchObject({
      vendidos: 3,
      disponibles: 97,
      pendientes: 1,
      efectivo: 1,
      transferencia: 1,
      montoEfectivo: 5000,
      montoTransferencia: 5000,
      cobrado: 10000,
      porCobrar: 5000,
    });
  });

  it('el mensaje al comprador refleja si pagó o solo apartó', () => {
    const s = vender(ESTADO_INICIAL, 23, 'Leidy del Puesto', '3162123456');
    expect(mensajeComprador(s, 23)).toContain('Hola Leidy');
    expect(mensajeComprador(s, 23)).toContain('el 23');
    expect(mensajeComprador(s, 23)).toContain('APARTADO');

    const pagado = marcarPago(s, 23, 'efectivo');
    expect(mensajeComprador(pagado, 23)).toContain('CONFIRMADO');
    expect(mensajeComprador(pagado, 23)).toContain('por efectivo');
    expect(linkComprador(pagado, 23)).toContain('wa.me/573162123456'); // agrega indicativo
    expect(() => mensajeComprador(s, 24)).toThrow();
  });

  it('usa la plantilla editada y deja intactas las variables que no existen', () => {
    const base = vender(ESTADO_INICIAL, 8, 'Ana Ruiz', '3001112233');
    const s = {
      ...base,
      config: { ...base.config, plantillaApartado: 'Hola {nombre}: {numero} por {precio}. {nada}' },
    };
    // formatearPrecio usa espacio duro tras el $, por eso no se escribe literal aquí.
    expect(mensajeComprador(s, 8)).toBe(
      `Hola Ana: 08 por ${formatearPrecio(5000, 'COP')}. {nada}`,
    );
  });

  it('rellenar no toca las llaves desconocidas', () => {
    expect(rellenar('{a}-{b}', { a: '1' })).toBe('1-{b}');
  });

  it('marca y estilo desconocidos caen al valor por defecto', () => {
    // Una config guardada antes de existir estos campos generaría `celda--undefined`.
    expect(estiloPorId('rayas')).toBe('rayas');
    expect(estiloPorId(undefined as unknown as string)).toBe('solido');
    expect(estiloPorId('inventado')).toBe('solido');
    expect(marcaPorId('estrella').id).toBe('estrella');
    expect(marcaPorId('inventada').id).toBe('corazon');
    expect(fondoPorId('lunares').id).toBe('lunares');
    expect(fondoPorId('inventado').id).toBe('botanico');
  });

  it('el slug limpia tildes y símbolos, y no se repite entre rifas', () => {
    expect(slugificar('Rifa de la Moto Ñoña')).toMatch(/^rifa-de-la-moto-nona-[a-z0-9]{4}$/);
    expect(slugificar('  ¡¡¡  ')).toMatch(/^rifa-[a-z0-9]{4}$/);
    expect(slugificar('Moto')).not.toBe(slugificar('Moto')); // sufijo aleatorio
  });

  it('los ids del catálogo no se repiten', () => {
    // Dos fondos con el mismo id romperían el selector en silencio.
    const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
    for (const lista of [FONDOS, MARCAS, PALETAS, TIPOGRAFIAS]) {
      expect(new Set(ids(lista)).size).toBe(lista.length);
    }
  });

  it('finaliza con ganador y valida el rango', () => {
    const s = finalizar(conVenta(42, 'Leidy'), 42);
    expect(s.config.finalizado).toBe(true);
    expect(ganador(s)?.comprador).toBe('Leidy');
    expect(reabrir(s).config.numeroGanador).toBeNull();
    expect(finalizar(s, 0).config.numeroGanador).toBe(0); // el 00 puede ganar
    expect(() => finalizar(s, -1)).toThrow();
    expect(() => finalizar(s, 100)).toThrow();
  });

  it('finalizar con un número sin vender cierra la rifa pero sin ganador', () => {
    const s = finalizar(ESTADO_INICIAL, 42);
    expect(s.config.finalizado).toBe(true);
    expect(ganador(s)).toBeNull();
  });

  it('reducir el total por debajo del ganador reabre la rifa', () => {
    const s = finalizar(conVenta(80), 80);
    const r = guardarConfig(s, { ...s.config, totalNumeros: 50 });
    expect(r.config.numeroGanador).toBeNull();
    expect(r.config.finalizado).toBe(false);
  });

  it('con el sorteo cerrado no se puede vender', () => {
    const cerrado = finalizar(ESTADO_INICIAL, 7);
    expect(() => vender(cerrado, 12, 'Ana', '3162123456')).toThrow(/cerrado/i);
    expect(() => vender(reabrir(cerrado), 12, 'Ana', '3162123456')).not.toThrow();
  });

  it('agrupa los números por comprador y pone primero al que debe', () => {
    let e = venderVarios(ESTADO_INICIAL, [5, 12], 'Ana Ruiz', '3001112233', 'efectivo');
    e = vender(e, 7, 'Beto Páez', '3004445566'); // pendiente
    e = vender(e, 3, 'Ana Ruiz', '3001112233'); // pendiente, mismo teléfono

    const lista = ventas(e);
    expect(lista.map((v) => v.nombre)).toEqual(['Ana Ruiz', 'Beto Páez']);
    expect(lista[0].numeros).toEqual([3, 5, 12]);
    expect(lista[0].pendientes).toBe(1);
    expect(lista[1].pendientes).toBe(1);

    // Cobrado el 3, Ana ya no debe nada y cae debajo de Beto.
    expect(ventas(marcarPago(e, 3, 'efectivo')).map((v) => v.nombre)).toEqual([
      'Beto Páez',
      'Ana Ruiz',
    ]);
  });
});
