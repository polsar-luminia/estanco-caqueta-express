-- Retención de coordenadas (Ley 1581 de 2012, principio de temporalidad) — Fase 2
-- Ref: PLAN-GEOLOCALIZACION.md §3, §6.3
--
-- Disocia lat/lng de pedidos ENTREGADOS hace más de 12 meses (la factura no
-- necesita coordenadas). Las direcciones guardadas viven mientras exista la
-- cuenta y se borran con DELETE /clientes/me (ya implementado).
--
-- Instalar como cron de sistema MENSUAL en el VPS (no hay pg_cron):
--   0 3 1 * *  cat /root/backups/retencion-ubicacion-12meses.sql | sudo -u postgres psql polo_dashboard >> /var/log/retencion-ubicacion.log 2>&1
--
-- NO urge: la app se lanzó en 2026-07; el primer pedido con pin no cumple 12
-- meses hasta ~2027-07. Instalar antes de esa fecha.

UPDATE pedidos
   SET lat = NULL,
       lng = NULL,
       precision_m = NULL,
       geocoded_direccion = NULL
 WHERE entregado_at < now() - interval '12 months'
   AND lat IS NOT NULL;
