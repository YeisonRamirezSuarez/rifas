import { afterEach, describe, expect, it, vi } from 'vitest';

// `nube.ts` lee `location.origin` al importarse y vitest corre en node.
// El getter deja cambiar `nube` por prueba: fotos.ts lo lee en cada llamada.
const mock = vi.hoisted(() => ({ nube: null as unknown }));
vi.mock('./nube', () => ({
  get nube() {
    return mock.nube;
  },
}));

import { rutaDeUrl, rutaFoto, subirFoto } from './fotos';

describe('rutaFoto', () => {
  const rifa = '11111111-2222-3333-4444-555555555555';

  const ruta = (nombre: string, ahora: number) =>
    // El azar del final no se compara: es lo que evita que dos subidas del mismo
    // milisegundo den la misma ruta.
    rutaFoto(rifa, nombre, ahora).replace(/-[a-z0-9]+\./, '.');

  it('guarda la foto en la carpeta de la rifa', () => {
    expect(ruta('moto.jpg', 1700000000000)).toBe(`${rifa}/1700000000000.jpg`);
  });

  it('conserva png y webp', () => {
    expect(ruta('premio.PNG', 1)).toBe(`${rifa}/1.png`);
    expect(ruta('premio.webp', 1)).toBe(`${rifa}/1.webp`);
  });

  it('un nombre raro cae en jpg y no arrastra el nombre original', () => {
    expect(ruta('foto final (1).HEIC', 1)).toBe(`${rifa}/1.jpg`);
    expect(ruta('../../otra-rifa/x', 1)).toBe(`${rifa}/1.jpg`);
  });

  it('dos subidas del mismo milisegundo no dan la misma ruta', () => {
    expect(rutaFoto(rifa, 'a.jpg', 1)).not.toBe(rutaFoto(rifa, 'a.jpg', 1));
  });
});

describe('subirFoto: validaciones que no tocan la red', () => {
  const rifa = '11111111-2222-3333-4444-555555555555';
  const foto = (bytes: number, type: string) =>
    new File([new Uint8Array(bytes)], 'foto.jpg', { type });

  afterEach(() => {
    mock.nube = null;
  });

  it('sin nube no se pueden guardar fotos', async () => {
    expect(await subirFoto(rifa, foto(10, 'image/jpeg'))).toEqual({
      error: 'Sin nube no se pueden guardar fotos.',
    });
  });

  it('rechaza un tipo que no es JPG, PNG ni WEBP', async () => {
    mock.nube = {}; // basta con que exista: la validación corta antes de usarla
    expect(await subirFoto(rifa, foto(10, 'image/gif'))).toEqual({
      error: 'La foto debe ser JPG, PNG o WEBP.',
    });
  });

  it('rechaza una foto de más de 3 MB', async () => {
    mock.nube = {};
    expect(await subirFoto(rifa, foto(3 * 1024 * 1024 + 1, 'image/jpeg'))).toEqual({
      error: 'La foto pesa más de 3 MB. Usa una más liviana.',
    });
  });
});

describe('rutaDeUrl', () => {
  const rifa = '11111111-2222-3333-4444-555555555555';
  const base = `https://abc.supabase.co/storage/v1/object/public/fotos/${rifa}`;

  it('saca la ruta dentro del bucket', () => {
    expect(rutaDeUrl(`${base}/1700000000000.jpg`)).toBe(`${rifa}/1700000000000.jpg`);
  });

  it('ignora el query que agrega el navegador y descodifica el nombre', () => {
    expect(rutaDeUrl(`${base}/1.jpg?t=99`)).toBe(`${rifa}/1.jpg`);
    expect(rutaDeUrl(`${base}/mi%20foto.jpg`)).toBe(`${rifa}/mi foto.jpg`);
  });

  it('una URL que no es de este bucket no da ruta', () => {
    expect(rutaDeUrl('https://ejemplo.com/foto.jpg')).toBeNull();
    expect(rutaDeUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(rutaDeUrl(`https://abc.supabase.co/storage/v1/object/public/otro/${rifa}/1.jpg`)).toBeNull();
    expect(rutaDeUrl(`${base}/`)).toBeNull();
  });
});
