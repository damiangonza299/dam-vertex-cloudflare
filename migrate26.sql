-- DAM Vertex — Migration 26: Extra product fields on leads
-- Permite adjuntar un producto adicional opcional a un lead antes de confirmar.
-- Ejecutar: wrangler d1 execute dam-vertex-leads --remote --file=migrate26.sql
ALTER TABLE leads ADD COLUMN extra_product_slug    TEXT;
ALTER TABLE leads ADD COLUMN extra_product_variant TEXT;
ALTER TABLE leads ADD COLUMN extra_product_qty     INTEGER DEFAULT 1;
