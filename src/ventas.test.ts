import { describe, expect, it } from 'vitest';
import { filtrarVentas, type Venta } from './rifa';
import { mensajeVenta } from './ventas';

describe('mensajeVenta', () => {
  it('distingue un número vendido de varios', () => {
    expect(mensajeVenta('23505', 'duplicate key', 1)).toBe('Ese número ya está vendido.');
    expect(mensajeVenta('23505', 'duplicate key', 3)).toBe(
      'Alguno de esos números ya está vendido.',
    );
  });

  it('no muestra el mensaje crudo de Postgres cuando la rifa no es tuya', () => {
    const m = mensajeVenta('42501', 'permission denied for function vender_numeros', 1);
    expect(m).not.toContain('permission denied');
    expect(m).toContain('no es tuya');
  });

  it('deja pasar tal cual lo que no traduce, en vez de tragárselo', () => {
    const rango = 'Los números de esta rifa van del 0 al 99; llegó el 120.';
    expect(mensajeVenta('22003', rango, 1)).toBe(rango);
  });
});

describe('filtrarVentas', () => {
  const lista: Venta[] = [
    { nombre: 'Ana', telefono: '3001112233', numeros: [1, 2], pendientes: 1 },
    { nombre: 'Beto', telefono: '3004445566', numeros: [3], pendientes: 0 },
  ];

  it('todas devuelve la lista completa', () => {
    expect(filtrarVentas(lista, 'todas')).toHaveLength(2);
  });

  it('cobrar deja solo a quien debe', () => {
    expect(filtrarVentas(lista, 'cobrar').map((v) => v.nombre)).toEqual(['Ana']);
  });

  it('pagadas deja solo a quien ya pagó todo', () => {
    expect(filtrarVentas(lista, 'pagadas').map((v) => v.nombre)).toEqual(['Beto']);
  });
});
