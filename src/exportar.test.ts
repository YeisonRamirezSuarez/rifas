import { describe, expect, it } from 'vitest';
import { generarVarias, type Imagen } from './exportar';

const nodo = {} as HTMLElement;
const falsa = (nombre: string): Imagen =>
  ({ url: `blob:${nombre}`, blob: new Blob(), nombre }) as Imagen;

describe('generarVarias', () => {
  it('devuelve una imagen por lámina', async () => {
    const r = await generarVarias(
      [
        { nodo, nombre: 'rifa-hoja-1', titulo: 'hoja 1' },
        { nodo, nombre: 'rifa-hoja-2', titulo: 'hoja 2' },
      ],
      async (_n, nombre) => ({ imagen: falsa(nombre) }),
    );
    expect(r.imagenes.map((i) => i.nombre)).toEqual(['rifa-hoja-1', 'rifa-hoja-2']);
    expect(r.error).toBeUndefined();
  });

  it('si la segunda falla, entrega la primera y dice cuál faltó', async () => {
    const r = await generarVarias(
      [
        { nodo, nombre: 'rifa-hoja-1', titulo: 'hoja 1' },
        { nodo, nombre: 'rifa-hoja-2', titulo: 'hoja 2' },
      ],
      async (_n, nombre) =>
        nombre === 'rifa-hoja-2' ? { error: 'canvas lleno' } : { imagen: falsa(nombre) },
    );
    expect(r.imagenes).toHaveLength(1);
    expect(r.error).toBe('No se pudo generar la hoja 2: canvas lleno. La hoja 1 ya está lista.');
  });

  it('una lámina sin montar se salta sin romper', async () => {
    const r = await generarVarias(
      [{ nodo: null, nombre: 'rifa-hoja-2', titulo: 'hoja 2' }],
      async (_n, nombre) => ({ imagen: falsa(nombre) }),
    );
    expect(r.imagenes).toEqual([]);
    expect(r.error).toBeUndefined();
  });

  it('avisa en qué hoja va antes de empezarla, sin contar las no montadas', async () => {
    const pasos: string[] = [];
    await generarVarias(
      [
        { nodo, nombre: 'rifa-hoja-1', titulo: 'hoja 1' },
        { nodo: null, nombre: 'rifa-hoja-2', titulo: 'hoja 2' },
        { nodo, nombre: 'rifa-hoja-3', titulo: 'hoja 3' },
      ],
      async (_n, nombre) => ({ imagen: falsa(nombre) }),
      (n, total) => pasos.push(`${n}/${total}`),
    );
    expect(pasos).toEqual(['1/2', '2/2']);
  });
});
