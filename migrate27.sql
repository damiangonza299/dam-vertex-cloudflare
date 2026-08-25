-- DAM Vertex — Migration 27: source column on leads
-- Distingue el canal de captura del lead (ej. 'venta-hipnotica') del producto/product_slug.
-- Usado para excluir leads de la landing Venta Hipnótica de la sección de Leads normal del admin
-- (se gestionan aparte en la sección V.H).
-- Ejecutar: wrangler d1 execute dam-vertex-leads --remote --file=migrate27.sql
ALTER TABLE leads ADD COLUMN source TEXT;
