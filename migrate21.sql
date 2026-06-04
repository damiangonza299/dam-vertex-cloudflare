-- DAM Vertex — Migration 21: shipping_history table
-- Registra los costos de envío ingresados por el delivery por día.
-- UNIQUE en date: aplicar el mismo día reemplaza la entrada anterior (idempotente).
--
-- Ejecutar: wrangler d1 execute dam-vertex-leads --remote --file=migrate21.sql

CREATE TABLE IF NOT EXISTS shipping_history (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  date              TEXT    NOT NULL UNIQUE,
  delivery_amount   INTEGER NOT NULL DEFAULT 0,
  encomienda_amount INTEGER NOT NULL DEFAULT 0,
  total_shipping    INTEGER NOT NULL DEFAULT 0,
  purchased_count   INTEGER NOT NULL DEFAULT 0,
  per_sale          INTEGER NOT NULL DEFAULT 0,
  dam_finanzas_count INTEGER NOT NULL DEFAULT 0,
  applied_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Verificar post-ejecución:
-- wrangler d1 execute dam-vertex-leads --remote --command "SELECT * FROM shipping_history ORDER BY date DESC LIMIT 10;"
