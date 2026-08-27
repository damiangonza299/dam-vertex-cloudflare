-- DAM Vertex — Migration 33: Backfill product_briefs for cepillo-secador-moldeador-aguacate
-- Mismo caso que migrate28/29/30/31/32: el producto (id=162) se creó con INSERT SQL
-- directo en products, sin pasar por Product Studio, así que nunca tuvo fila en
-- product_briefs — y product-registry.js (GET) lista desde product_briefs LEFT JOIN
-- products, no desde products directamente. Sin este backfill el producto no
-- aparecería en Product Studio y el usuario no podría activarlo desde ahí
-- (active=0 a propósito — queda en borrador hasta activación manual).
--
-- status='draft' + landing_status='active' — la landing ya está desplegada, pero el
-- producto sigue inactivo (active=0 en products) hasta activación manual.
--
-- INSERT OR IGNORE hace este script seguro de re-ejecutar.
--
-- Ejecutar remoto: wrangler d1 execute dam-vertex-leads --remote --file=migrate33.sql

INSERT OR IGNORE INTO product_briefs (
  product_slug,
  op_json,
  strategic_json,
  visual_json,
  research_json,
  insights_json,
  status,
  landing_status,
  created_at,
  updated_at
) VALUES (
  'cepillo-secador-moldeador-aguacate',
  '{"name":"Cepillo Secador Moldeador AguaCate","type":"simple","category":"Belleza / Cuidado Capilar","price":199000,"compare_price":259000,"stock":10,"min_stock":3,"unit_cost":75150}',
  '{"desire_type":[]}',
  '{}',
  '[]',
  '{"insync":null,"landing_intelligence":null}',
  'draft',
  'active',
  datetime('now'),
  datetime('now')
);
