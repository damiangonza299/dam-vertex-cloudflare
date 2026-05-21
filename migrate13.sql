-- Migration 13: Attribution quality + Paraguay operational date
-- Agrega dos columnas para mejorar análisis de attribution y timestamps operativos.
-- Todas las columnas son nullable — leads existentes no se ven afectados.
--
-- Ejecutar:
--   wrangler d1 execute dam-vertex-leads --remote --file=migrate13.sql
--
-- NOTA: ALTER TABLE falla si la columna ya existe — eso es esperado en segunda ejecución.

-- Fecha operativa en Paraguay (America/Asuncion, YYYY-MM-DD).
-- Difiere de created_at (UTC) para leads creados entre 8pm-midnight Paraguay.
-- Ejemplo: lead creado a las 10pm Paraguay del 20/05 → operational_date_py = '2026-05-20',
--          pero created_at = '2026-05-21 02:00' UTC.
ALTER TABLE leads ADD COLUMN operational_date_py TEXT;

-- Confianza de la attribution capturada al crear el lead:
--   'high'     → campaign_id + ad_id presentes (click de Meta con UTMs completos)
--   'medium'   → campaign_id presente, ad_id ausente
--   'fbc_only' → solo fbclid o cookie _fbc (click de Meta, UTMs perdidos)
--   'utm_only' → utm_source/utm_campaign presente, sin IDs numéricos
--   'none'     → sin ningún dato de attribution (orgánico, directo, manual WA)
ALTER TABLE leads ADD COLUMN attribution_confidence TEXT;

-- Crear índice para filtrar por fecha operativa Paraguay (análisis diario)
CREATE INDEX IF NOT EXISTS idx_leads_operational_date ON leads(operational_date_py);
