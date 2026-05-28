-- Migration 14: Google Maps / Places location fields
-- Agrega columnas de ubicación exacta capturada desde el location picker.
-- Todas las columnas son nullable — leads existentes no se ven afectados.
--
-- Ejecutar:
--   wrangler d1 execute dam-vertex-leads --remote --file=migrate14.sql
--
-- NOTA: ALTER TABLE falla si la columna ya existe — eso es esperado en segunda ejecución.

-- Dirección formateada por Google Places (ej: "Biggie, San Lorenzo, Paraguay")
ALTER TABLE leads ADD COLUMN location_address TEXT;

-- Ciudad/localidad detectada automáticamente desde address_components de Google
ALTER TABLE leads ADD COLUMN location_city TEXT;

-- Latitud (ej: -25.5389)
ALTER TABLE leads ADD COLUMN location_lat REAL;

-- Longitud (ej: -57.5661)
ALTER TABLE leads ADD COLUMN location_lng REAL;

-- Google Maps URL con pin exacto: https://www.google.com/maps?q=lat,lng
ALTER TABLE leads ADD COLUMN location_maps_url TEXT;

-- Google Places place_id (si disponible, para deduplicación futura)
ALTER TABLE leads ADD COLUMN location_place_id TEXT;

-- Crear índice para buscar leads con ubicación confirmada
CREATE INDEX IF NOT EXISTS idx_leads_location_city ON leads(location_city);
