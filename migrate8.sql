-- Migration 8: Persistir dirección de entrega y método de pago del lead
-- Ejecutar: wrangler d1 execute dam-vertex-leads --remote --file=migrate8.sql
-- NOTA: ALTER TABLE falla si la columna ya existe — eso es esperado en segunda ejecución.

ALTER TABLE leads ADD COLUMN address        TEXT;
ALTER TABLE leads ADD COLUMN payment_method TEXT;
