/**
 * Traducción de los errores de `vender_numeros`.
 *
 * Se rama por el **código** de Postgres y nunca por el texto del mensaje: un mensaje se
 * reescribe cualquier día y la rama se rompería en silencio.
 */
export function mensajeVenta(
  codigo: string | undefined,
  mensaje: string,
  cantidad: number,
): string {
  switch (codigo) {
    // Choque de clave primaria: alguien lo vendió primero.
    case '23505':
      return cantidad > 1
        ? 'Alguno de esos números ya está vendido.'
        : 'Ese número ya está vendido.';
    // La base dice "permission denied for function", que no le sirve a nadie.
    case '42501':
      return 'Esta rifa no es tuya, o tu cuenta todavía no está aprobada.';
    // El resto ya viene redactado para el dueño: pasa tal cual. Incluye 22003 (fuera de
    // rango) y 22023 (lote, comprador, pago o sorteo cerrado).
    default:
      return mensaje;
  }
}
