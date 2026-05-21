-- Migration 12: Stock tracking for manual sales
-- Agrega columnas para rastrear si una venta manual descontó stock.
-- Todas las columnas son nullable/default — leads normales no se ven afectados.
--
-- Ejecutar DESPUÉS de migrate11.sql:
--   wrangler d1 execute dam-vertex-leads --remote --file=migrate12.sql
--
-- NOTA: ALTER TABLE falla si la columna ya existe — eso es esperado en segunda ejecución.

-- 1 = stock descontado, 0 (default) = no descontado
ALTER TABLE leads ADD COLUMN stock_deducted INTEGER DEFAULT 0;

-- Timestamp del descuento (solo si stock_deducted = 1)
ALTER TABLE leads ADD COLUMN stock_deducted_at TEXT;

-- Mensaje de error si el descuento falló (stock_deducted = 0 y hubo intento)
ALTER TABLE leads ADD COLUMN stock_error TEXT;

-- Verificar resultado:
--   wrangler d1 execute dam-vertex-leads --remote --command "PRAGMA table_info(leads);"
