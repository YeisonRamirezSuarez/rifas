import { describe, it, expect } from 'vitest';
import { pantalla, veniaDeRecuperacion, type EstadoSesion } from './sesion';

const base: EstadoSesion = {
  recuperando: false,
  haySesion: false,
  hayNube: true,
  hayRifa: false,
  perfilCargando: false,
  aprobado: false,
};

describe('pantalla', () => {
  it('sin sesión y sin rifa muestra la presentación', () => {
    expect(pantalla(base)).toBe('onboarding');
  });

  it('sin sesión pero con link a una rifa muestra la lámina pública', () => {
    expect(pantalla({ ...base, hayRifa: true })).toBe('publico');
  });

  it('el visitante con link nunca cae en la sala de espera', () => {
    // aprobado=false es lo normal para quien no tiene cuenta: no debe pesar.
    expect(pantalla({ ...base, hayRifa: true, aprobado: false })).toBe('publico');
  });

  it('con sesión y el perfil aún sin resolver, espera', () => {
    expect(pantalla({ ...base, haySesion: true, perfilCargando: true })).toBe('perfil-cargando');
  });

  it('con sesión y cuenta sin aprobar, sala de espera', () => {
    expect(pantalla({ ...base, haySesion: true })).toBe('espera');
  });

  it('con sesión y cuenta aprobada, la app', () => {
    expect(pantalla({ ...base, haySesion: true, aprobado: true })).toBe('app');
  });

  it('en modo local no hay cuentas: siempre la app', () => {
    // Sin nube, useRifa ya reporta haySesion=true y usePerfil aprobado=true.
    expect(
      pantalla({ ...base, hayNube: false, haySesion: true, aprobado: true }),
    ).toBe('app');
  });

  it('sin nube nunca se pide perfil, aunque el flag venga encendido', () => {
    expect(
      pantalla({ ...base, hayNube: false, haySesion: true, aprobado: true, perfilCargando: true }),
    ).toBe('app');
  });

  it('el enlace de recuperación manda a fijar la clave, por encima de todo', () => {
    expect(pantalla({ ...base, recuperando: true })).toBe('recuperar');
  });

  it('recuperar gana aunque ya haya sesión y cuenta aprobada', () => {
    // supabase-js abre sesión al canjear el hash: sin esta prioridad, el enlace
    // entraría al tablero sin pedir contraseña nueva.
    expect(
      pantalla({ ...base, recuperando: true, haySesion: true, aprobado: true }),
    ).toBe('recuperar');
  });

  it('recuperar gana también sobre la lámina pública', () => {
    expect(pantalla({ ...base, recuperando: true, hayRifa: true })).toBe('recuperar');
  });
});

describe('veniaDeRecuperacion', () => {
  it('el hash con type=recovery cuenta, aunque no haya marca guardada', () => {
    expect(veniaDeRecuperacion('#access_token=x&type=recovery', null)).toBe(true);
  });

  it('la marca guardada cuenta, aunque supabase ya haya limpiado el hash', () => {
    // Pasa tras un F5: supabase-js borra el hash con history.replaceState y en el
    // siguiente arranque no emite PASSWORD_RECOVERY, solo queda esta marca.
    expect(veniaDeRecuperacion('', '1')).toBe(true);
  });

  it('sin hash de recuperación y sin marca, no venimos de ahí', () => {
    expect(veniaDeRecuperacion('', null)).toBe(false);
  });

  it('una marca con otro valor no cuenta como recuperación', () => {
    expect(veniaDeRecuperacion('', 'cualquier-cosa')).toBe(false);
  });
});
