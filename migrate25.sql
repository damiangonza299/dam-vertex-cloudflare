-- DAM Vertex — Migration 25: Backfill product_briefs for legacy products
-- These products existed before migrate23 (product_briefs table) and were never
-- onboarded through Product Studio. This migration creates minimal briefs so the
-- InSync Recommendation Engine can include them in CAPA A pattern analysis.
--
-- IMPORTANT: There is no create_brief API endpoint — this is the correct and only
-- mechanism for retroactive brief creation. See product-registry.js NOTE.
--
-- INSERT OR IGNORE makes this safe to re-run: skips if product_slug already exists.
--
-- Ejecutar remoto: wrangler d1 execute dam-vertex-leads --remote --file=migrate25.sql
-- Verificar:       wrangler d1 execute dam-vertex-leads --remote --command "SELECT product_slug, status, landing_status, json_extract(op_json,'$.category') AS category FROM product_briefs ORDER BY product_slug;"

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
  'cadena',
  '{"name":"Cadena Apex","type":"simple","category":"Joyería"}',
  '{"desire_type":[]}',
  '{}',
  '[]',
  '{"insync":null,"landing_intelligence":null}',
  'draft',
  'active',
  datetime('now'),
  datetime('now')
);

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
  'cepillo',
  '{"name":"Cepillo Eléctrico Recargable (4 Cabezales)","type":"simple","category":"Higiene Personal"}',
  '{"desire_type":[]}',
  '{}',
  '[]',
  '{"insync":null,"landing_intelligence":null}',
  'draft',
  'active',
  datetime('now'),
  datetime('now')
);

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
  'lentes',
  '{"name":"Lentes Anti Luz Azul Rojos","type":"simple","category":"Lentes"}',
  '{"desire_type":[]}',
  '{}',
  '[]',
  '{"insync":null,"landing_intelligence":null}',
  'draft',
  'active',
  datetime('now'),
  datetime('now')
);

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
  'reloj',
  '{"name":"Reloj Blackout Minimal","type":"simple","category":"Relojes"}',
  '{"desire_type":[]}',
  '{}',
  '[]',
  '{"insync":null,"landing_intelligence":null}',
  'draft',
  'active',
  datetime('now'),
  datetime('now')
);
