import { describe, it, expect } from 'vitest';
import { filtroCursor, siguienteCursor, type Cursor } from './cuentas';

const fila = (creado_en: string, id: string) => ({ creado_en, id });

describe('filtroCursor', () => {
  it('pide lo anterior al cursor, con el id como desempate', () => {
    const c: Cursor = { creadoEn: '2026-08-13T10:00:00Z', id: 'abc' };
    expect(filtroCursor(c)).toBe(
      'creado_en.lt.2026-08-13T10:00:00Z,and(creado_en.eq.2026-08-13T10:00:00Z,id.lt.abc)',
    );
  });
});

describe('siguienteCursor', () => {
  it('con la página llena, apunta a la última fila', () => {
    const filas = [fila('2026-08-13T10:00:00Z', 'a'), fila('2026-08-13T09:00:00Z', 'b')];
    expect(siguienteCursor(filas, 2)).toEqual({ creadoEn: '2026-08-13T09:00:00Z', id: 'b' });
  });

  it('con la página a medias, no hay más', () => {
    // Menos filas que el tamaño de página = se acabaron los datos.
    expect(siguienteCursor([fila('2026-08-13T10:00:00Z', 'a')], 2)).toBeNull();
  });

  it('sin filas, no hay más', () => {
    expect(siguienteCursor([], 2)).toBeNull();
  });

  it('con dos altas del mismo instante, el id decide', () => {
    // El cursor sale de la ÚLTIMA fila de la página, no de la primera: en el orden
    // descendente 'aa' va después de 'zz', y arrancar la página siguiente desde 'zz'
    // se saltaría 'aa'. La condición SQL del desempate la cubre el test de
    // `filtroCursor`, aquí solo se fija de qué fila se toma.
    const mismo = '2026-08-13T10:00:00Z';
    const filas = [fila(mismo, 'zz'), fila(mismo, 'aa')];
    expect(siguienteCursor(filas, 2)).toEqual({ creadoEn: mismo, id: 'aa' });
  });
});
