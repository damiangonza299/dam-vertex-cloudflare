-- Dam Vertex — Migración 5 — Reloj Blackout Minimal: stock + variantes/modelos
-- Actualiza el producto existente. No duplica. No toca otros productos ni leads.
-- Ejecutar: wrangler d1 execute dam-vertex-leads --remote --file=migrate5.sql

INSERT INTO products (slug, name, stock_total, variants_json, active)
VALUES (
  'reloj',
  'Reloj Blackout Minimal',
  100,
  '{"A1 Negro Total":60,"A3 Negro Rose":10,"A4 Negro Gold":10,"A8 Gold Black":10,"A7 Rose Black":5,"A6 Silver Black":5}',
  1
)
ON CONFLICT(slug) DO UPDATE SET
  name          = 'Reloj Blackout Minimal',
  stock_total   = 100,
  variants_json = '{"A1 Negro Total":60,"A3 Negro Rose":10,"A4 Negro Gold":10,"A8 Gold Black":10,"A7 Rose Black":5,"A6 Silver Black":5}',
  active        = 1,
  updated_at    = datetime('now');
