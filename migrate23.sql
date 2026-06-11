-- DAM Vertex — Migration 23: Product Studio — Brief system
-- ADDITIVE ONLY. No modification of existing data, indexes, or columns.
-- Does not affect confirm-purchase, CAPI, stock logic, leads, behavior_events,
-- lead_quality, or any existing flow.
--
-- Ejecutar local:  wrangler d1 execute dam-vertex-leads --file=migrate23.sql
-- Ejecutar remoto: wrangler d1 execute dam-vertex-leads --remote --file=migrate23.sql
-- Verificar:       wrangler d1 execute dam-vertex-leads --remote --command "SELECT COUNT(*) FROM product_briefs;"

-- ──────────────────────────────────────────────
-- Extend products with lifecycle columns
-- Existing products get sensible defaults — no behavior change.
-- status='active'       → product is live (compatible with active=1 on existing rows)
-- product_type='simple' → no variants by default
-- compare_price=0       → no crossed-out price by default
-- ──────────────────────────────────────────────
ALTER TABLE products ADD COLUMN status        TEXT    NOT NULL DEFAULT 'active';
ALTER TABLE products ADD COLUMN product_type  TEXT    NOT NULL DEFAULT 'simple';
ALTER TABLE products ADD COLUMN compare_price INTEGER NOT NULL DEFAULT 0;

-- ──────────────────────────────────────────────
-- product_briefs: source of truth for strategic, research, and analytics data
-- Completely separate from the operational `products` table.
-- Queried ONLY by Product Studio and the landing generator.
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_briefs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  product_slug        TEXT    NOT NULL UNIQUE,

  -- Operational mirror (syncs with products table on save)
  op_json             TEXT    NOT NULL DEFAULT '{}',

  -- Strategic positioning: audience, promise, benefits, objections
  strategic_json      TEXT    NOT NULL DEFAULT '{}',

  -- Visual identity: colors, style, material, feel
  visual_json         TEXT    NOT NULL DEFAULT '{}',

  -- Research history: array of URL extraction sessions
  research_json       TEXT    NOT NULL DEFAULT '[]',

  -- Analytics: InSync snapshot now + Landing Intelligence slot (future)
  insights_json       TEXT    NOT NULL DEFAULT '{"insync":null,"landing_intelligence":null}',

  -- Lifecycle state
  -- status: draft | pending_sync | active | archived
  status              TEXT    NOT NULL DEFAULT 'draft',
  -- landing_status: none | draft | active
  landing_status      TEXT    NOT NULL DEFAULT 'none',
  -- landing_html: generated blueprint HTML (stored inline for simplicity)
  landing_html        TEXT,

  -- DAM Finanzas sync
  dam_finanzas_id     TEXT,
  -- dam_finanzas_status: pending | linked | failed
  dam_finanzas_status TEXT    NOT NULL DEFAULT 'pending',
  dam_finanzas_note   TEXT,

  -- Timestamps
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (product_slug) REFERENCES products(slug)
);

CREATE INDEX IF NOT EXISTS idx_pb_slug    ON product_briefs(product_slug);
CREATE INDEX IF NOT EXISTS idx_pb_status  ON product_briefs(status);

-- Verificar post-ejecución:
-- wrangler d1 execute dam-vertex-leads --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='product_briefs';"
-- wrangler d1 execute dam-vertex-leads --remote --command "PRAGMA table_info(products);" -- should show status, product_type, compare_price
