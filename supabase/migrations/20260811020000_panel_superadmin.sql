-- Vista de control para el superadmin: una fila por rifa con su dueño y sus cifras.
create or replace view panel_superadmin as
select
  r.id           as rifa_id,
  r.slug,
  r.creada_en,
  p.id           as usuario_id,
  p.email,
  p.nombre,
  p.rol,
  p.estado,
  coalesce(r.config ->> 'titulo', 'Sin título')            as titulo,
  coalesce(r.config ->> 'premio', '')                      as premio,
  coalesce((r.config ->> 'precio')::numeric, 0)            as precio,
  coalesce((r.config ->> 'totalNumeros')::int, 0)          as total_numeros,
  coalesce((r.config ->> 'finalizado')::boolean, false)    as finalizado,
  count(n.numero)                                          as vendidos,
  count(n.numero) filter (where n.pago = 'pendiente')      as pendientes,
  count(n.numero) filter (where n.pago = 'efectivo')       as efectivo,
  count(n.numero) filter (where n.pago = 'transferencia')  as transferencia,
  coalesce((r.config ->> 'precio')::numeric, 0) * count(n.numero) filter (where n.pago <> 'pendiente') as cobrado,
  max(n.vendido_en)                                        as ultima_venta
from rifas r
join perfiles p on p.id = r.dueno
left join numeros n on n.rifa_id = r.id
group by r.id, r.slug, r.creada_en, r.config, p.id, p.email, p.nombre, p.rol, p.estado;

alter view panel_superadmin set (security_invoker = on);
revoke all on panel_superadmin from anon, authenticated;
grant select on panel_superadmin to authenticated;
