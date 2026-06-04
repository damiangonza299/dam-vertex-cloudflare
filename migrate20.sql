-- DAM Vertex — Migration 20: financial metadata columns on products
-- Additive: no modifica datos existentes, no afecta confirm-purchase, CAPI, stock logic.
-- Permite que DAM Finanzas lea unitCost/defaultPrice/minStock al importar productos.
--
-- Ejecutar: wrangler d1 execute dam-vertex-leads --remote --file=migrate20.sql
-- NOTA: ALTER TABLE falla si la columna ya existe — esperado en segunda ejecución.

ALTER TABLE products ADD COLUMN unit_cost     INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN default_price INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN min_stock     INTEGER DEFAULT 0;

-- Verificar post-ejecución:
-- wrangler d1 execute dam-vertex-leads --remote --command "SELECT slug, unit_cost, default_price, min_stock FROM products;"
