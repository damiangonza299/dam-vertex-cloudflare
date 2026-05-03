-- Dam Vertex — Migración para base de datos existente
-- Ejecutar UNA sola vez:
--   wrangler d1 execute dam-vertex-leads --file=migrate.sql
--
-- NOTA: Los ALTER TABLE pueden fallar si las columnas ya existen — eso es OK.

ALTER TABLE leads ADD COLUMN quantity INTEGER DEFAULT 1;
ALTER TABLE leads ADD COLUMN variant  TEXT;

CREATE TABLE IF NOT EXISTS products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  stock_total   INTEGER NOT NULL DEFAULT 0,
  variants_json TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO products (slug, name, stock_total, variants_json) VALUES
  ('cepillo', 'Cepillo Eléctrico Recargable (4 Cabezales)', 0, '{"Negro":0,"Blanco":0}'),
  ('lentes',  'Lentes Anti Luz Azul Rojos',                 0, NULL),
  ('reloj',   'Reloj Blackout Minimal',                     0, NULL);
