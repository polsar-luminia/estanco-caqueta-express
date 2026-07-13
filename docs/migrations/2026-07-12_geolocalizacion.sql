-- Migración: Geolocalización de entrega (Fase 1) — release 1.1.0
-- Fecha: 2026-07-12 · BD: polo_dashboard (PostgreSQL 16.14, VPS `ssh polo`)
-- Ref: PLAN-GEOLOCALIZACION.md §3
--
-- Aplicar en el VPS con backup previo (pg_dump). SOLO ADITIVA:
-- columnas nullable + tabla nueva + CHECKs. Sin DROP, sin ALTER de columnas
-- existentes, sin UPDATE masivos. Clientes 1.0.x no notan ningún cambio
-- (todos los campos nuevos son opcionales).
--
--   sudo -u postgres psql polo_dashboard -f 2026-07-12_geolocalizacion.sql

BEGIN;

-- 1. direcciones_cliente: coordenadas del punto de entrega guardado
ALTER TABLE direcciones_cliente
  ADD COLUMN lat                numeric(9,6),
  ADD COLUMN lng                numeric(9,6),
  ADD COLUMN precision_m        numeric(6,1),          -- accuracy GPS en metros; NULL si metodo='pin_mapa' o 'manual'
  ADD COLUMN metodo_ubicacion   text NOT NULL DEFAULT 'manual'
      CHECK (metodo_ubicacion IN ('manual','gps','pin_mapa')),
  ADD COLUMN geocoded_direccion text,                  -- texto del reverse geocode al capturar (solo display)
  ADD COLUMN fuera_zona         boolean,               -- resultado de la validación server-side al guardar
  ADD COLUMN ubicacion_at       timestamptz,           -- cuándo se capturó (retención Ley 1581)
  ADD CONSTRAINT chk_dir_latlng_par CHECK ((lat IS NULL) = (lng IS NULL)),
  ADD CONSTRAINT chk_dir_latlng_rango CHECK (
    lat IS NULL OR (lat BETWEEN -4.5 AND 13.5 AND lng BETWEEN -82 AND -66)  -- sanity: Colombia
  );

-- 2. pedidos: snapshot de la ubicación al momento del pedido
--    (consistente con cómo hoy se copia direccion/barrio como texto)
ALTER TABLE pedidos
  ADD COLUMN lat                numeric(9,6),
  ADD COLUMN lng                numeric(9,6),
  ADD COLUMN precision_m        numeric(6,1),
  ADD COLUMN metodo_ubicacion   text,
  ADD COLUMN geocoded_direccion text,
  ADD COLUMN fuera_zona         boolean,
  ADD CONSTRAINT chk_ped_latlng_par CHECK ((lat IS NULL) = (lng IS NULL));

-- 3. zonas_reparto: un solo polígono editable sin deploy.
--    Hasta que el negocio dibuje el polígono real (geojson.io), el servidor
--    usa el bounding box provisional de Florencia (1.55..1.68 / -75.68..-75.55).
CREATE TABLE zonas_reparto (
  id         serial PRIMARY KEY,
  nombre     text NOT NULL,                 -- 'Florencia'
  poligono   jsonb NOT NULL,                -- [[lat,lng],...] anillo cerrado GeoJSON-like
  activo     boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

COMMIT;
