-- DAM Vertex — Migration 31: Backfill product_briefs for mascara-led-facial
-- Mismo caso que migrate28/29/30 (lampara/depilador/proyector): el producto (id=154)
-- se creó con INSERT SQL directo en products, sin pasar por Product Studio, así que
-- nunca tuvo fila en product_briefs — y product-registry.js (GET) lista desde
-- product_briefs LEFT JOIN products, no desde products directamente. Sin este backfill
-- el producto no aparecería en Product Studio y el usuario no podría activarlo desde ahí
-- (active=0 a propósito — queda en borrador hasta que lo activen manualmente).
--
-- status='draft' + landing_status='active' — la landing ya está desplegada, pero el
-- producto sigue inactivo (active=0 en products) hasta activación manual.
--
-- INSERT OR IGNORE hace este script seguro de re-ejecutar.
--
-- Ejecutar remoto: wrangler d1 execute dam-vertex-leads --remote --file=migrate31.sql

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
  'mascara-led-facial',
  '{"name":"Máscara LED Facial","type":"simple","category":"Belleza / Cuidado Facial","price":289000,"compare_price":379000,"stock":15,"min_stock":3,"unit_cost":69800}',
  '{"desire_type":[]}',
  '{}',
  '[]',
  '{"insync":null,"landing_intelligence":null}',
  'draft',
  'active',
  datetime('now'),
  datetime('now')
);
