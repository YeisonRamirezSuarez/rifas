import { describe, expect, it } from 'vitest';
import { pestanas, pestanaValida } from './pestanas';

describe('pestanas', () => {
  it('el dueño de la rifa ve cuatro pestañas, sin Admin', () => {
    const v = pestanas({ esSuperadmin: false, puedeEditar: true });
    expect(v.map((p) => p.id)).toEqual(['tablero', 'ventas', 'compartir', 'ajustes']);
  });

  it('el superadmin ve también Admin', () => {
    const v = pestanas({ esSuperadmin: true, puedeEditar: true });
    expect(v.map((p) => p.id)).toContain('admin');
  });

  it('sin permiso de edición solo quedan Tablero y Ajustes', () => {
    const v = pestanas({ esSuperadmin: false, puedeEditar: false });
    expect(v.map((p) => p.id)).toEqual(['tablero', 'ajustes']);
  });
});

describe('pestanaValida', () => {
  it('deja la pestaña abierta si sigue existiendo', () => {
    const v = pestanas({ esSuperadmin: true, puedeEditar: true });
    expect(pestanaValida('admin', v)).toBe('admin');
  });

  it('cae al tablero si la pestaña abierta desapareció', () => {
    const v = pestanas({ esSuperadmin: false, puedeEditar: true });
    expect(pestanaValida('admin', v)).toBe('tablero');
  });

  it('cae al tablero al pasar a una rifa ajena con Ventas abierta', () => {
    const v = pestanas({ esSuperadmin: false, puedeEditar: false });
    expect(pestanaValida('ventas', v)).toBe('tablero');
  });

  it('sin Tablero en la lista cae a la primera que haya', () => {
    const v = pestanas({ esSuperadmin: false, puedeEditar: true }).filter(
      (p) => p.id !== 'tablero',
    );
    expect(pestanaValida('admin', v)).toBe('ventas');
    expect(pestanaValida('admin', [])).toBe('tablero');
  });
});
