-- Dam Vertex — Migración segura v2
-- Solo crea tabla products y seed inicial.
-- No toca leads ni columnas existentes.
-- Ejecutar: wrangler d1 execute dam-vertex-leads --remote --file=migrate2.sql

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
