-- DAM Vertex — Migration 26: DAM Product Radar tables
-- product_candidates: candidatos con score >= 70 (alertan a Telegram)
-- candidate_watchlist: candidatos con score 50-69 (monitoreo)
-- radar_run_log: historial de ejecuciones del scanner
--
-- Ejecutar remoto:
--   wrangler d1 execute dam-vertex-leads --remote --file=migrate26.sql
-- Verificar:
--   wrangler d1 execute dam-vertex-leads --remote --command "SELECT COUNT(*) FROM product_candidates; SELECT COUNT(*) FROM candidate_watchlist;"

CREATE TABLE IF NOT EXISTS product_candidates (
  id                   TEXT PRIMARY KEY,
  source               TEXT NOT NULL,
  source_id            TEXT,
  source_url           TEXT,
  name                 TEXT NOT NULL,
  description          TEXT,
  category             TEXT,
  image_url            TEXT,
  signals_json         TEXT,
  signal_strength      INTEGER DEFAULT 0,
  opportunity_score    INTEGER DEFAULT 0,
  score_breakdown_json TEXT,
  status               TEXT DEFAULT 'new',
  status_note          TEXT,
  estimated_sale_gs    INTEGER,
  supplier_url         TEXT,
  supplier_price_usd   REAL,
  name_hash            TEXT,
  first_seen_at        TEXT DEFAULT (datetime('now')),
  last_seen_at         TEXT DEFAULT (datetime('now')),
  alert_sent_at        TEXT,
  alert_count          INTEGER DEFAULT 0,
  updated_at           TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_radar_candidates_score  ON product_candidates(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_radar_candidates_status ON product_candidates(status);
CREATE INDEX IF NOT EXISTS idx_radar_candidates_source ON product_candidates(source);
CREATE INDEX IF NOT EXISTS idx_radar_candidates_hash   ON product_candidates(name_hash);

CREATE TABLE IF NOT EXISTS candidate_watchlist (
  id                   TEXT PRIMARY KEY,
  source               TEXT NOT NULL,
  source_id            TEXT,
  source_url           TEXT,
  name                 TEXT NOT NULL,
  description          TEXT,
  image_url            TEXT,
  signals_json         TEXT,
  opportunity_score    INTEGER DEFAULT 0,
  score_breakdown_json TEXT,
  name_hash            TEXT,
  first_seen_at        TEXT DEFAULT (datetime('now')),
  last_seen_at         TEXT DEFAULT (datetime('now')),
  promoted_at          TEXT,
  updated_at           TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_watchlist_score ON candidate_watchlist(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_hash  ON candidate_watchlist(name_hash);

CREATE TABLE IF NOT EXISTS radar_run_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  run_at         TEXT NOT NULL,
  source         TEXT DEFAULT 'manual',
  candidates_new INTEGER DEFAULT 0,
  candidates_upd INTEGER DEFAULT 0,
  watchlist_new  INTEGER DEFAULT 0,
  alerts_sent    INTEGER DEFAULT 0,
  dry_run        INTEGER DEFAULT 0
);
