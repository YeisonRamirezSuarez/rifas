-- La venta solo entra por `vender_numeros`.
--
-- Hasta acá, `anon` y `authenticated` tenían `insert` sobre las dos tablas y lo único
-- que los frenaba era el RLS (es el default de Supabase). Quitando el `insert`, la
-- venta a medias deja de ser improbable y pasa a ser imposible: no queda ningún camino
-- que meta un número sin su comprador.
--
-- Se conservan `update` (marcar el pago) y `delete` (liberar un número): las dos son
-- atómicas de por sí, y el `delete` cascadea al comprador, que es lo correcto.

revoke insert on numeros from anon, authenticated;
revoke insert on compradores from anon, authenticated;

-- `truncate` y `references` venían en el grant por defecto de Supabase y nadie los
-- quiso: el RLS no filtra `truncate` —vacía la tabla entera, de todas las rifas— y
-- una foránea ajena impide borrar filas propias. Hoy PostgREST no los alcanza, pero
-- «no queda ningún camino» solo es cierto si tampoco están concedidos.
revoke truncate, references on numeros, compradores from anon, authenticated;
