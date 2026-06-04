-- DAM Vertex — Migration 19: variants_meta_json
-- Columna paralela para IDs estables de variantes — solo productos con variantes
-- reales que el cliente elige.
--
-- Cadena Apex (cadena): excluida — stock total sin variantes.
-- Cepillo (cepillo): pendiente para migración futura.
--
-- NO toca variants_json. NO toca stock_total. NO afecta confirm-purchase,
-- CAPI, manual-whatsapp-sale ni ningún endpoint existente.
--
-- Ejecutar: wrangler d1 execute dam-vertex-leads --remote --file=migrate19.sql
-- NOTA: ALTER TABLE falla si la columna ya existe — eso es esperado en segunda ejecución.

ALTER TABLE products ADD COLUMN variants_meta_json TEXT;

-- Reloj Blackout Minimal — 6 variantes actuales (per migrate10)
UPDATE products
SET variants_meta_json = '{"Negro Total":{"variantId":"reloj_negro_total"},"Negro Dorado":{"variantId":"reloj_negro_dorado"},"Negro Rosa":{"variantId":"reloj_negro_rosa"},"Plateado Negro":{"variantId":"reloj_plateado_negro"},"Negro Cobre":{"variantId":"reloj_negro_cobre"},"Negro Dorado Sutil":{"variantId":"reloj_negro_dorado_sutil"}}'
WHERE slug = 'reloj';

-- Verificar post-ejecución:
-- wrangler d1 execute dam-vertex-leads --remote --command "SELECT slug, variants_json, variants_meta_json FROM products;"
