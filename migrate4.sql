-- Dam Vertex — Migración 4 — Agregar Cadena Apex al stock
-- Ejecutar: wrangler d1 execute dam-vertex-leads --remote --file=migrate4.sql
-- INSERT OR IGNORE: no hace nada si el producto ya existe (no resetea stock).

INSERT OR IGNORE INTO products (slug, name, stock_total, variants_json, active) VALUES
  ('cadena', 'Cadena Apex', 100, NULL, 1);
