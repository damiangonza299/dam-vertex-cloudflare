-- DAM Vertex — Migration 22: lead_quality table
-- Motor de Calidad de Compradores (Buyer Quality Engine)
-- ADITIVA: no modifica leads, products, behavior_events ni ninguna tabla existente.
-- No afecta QualifiedLead, Purchase, CAPI, Pixel ni flujo del Admin Panel.
--
-- Ejecutar local:  wrangler d1 execute dam-vertex-leads --file=migrate22.sql
-- Ejecutar remoto: wrangler d1 execute dam-vertex-leads --remote --file=migrate22.sql
-- Verificar:       wrangler d1 execute dam-vertex-leads --remote --command "SELECT COUNT(*) FROM lead_quality;"

CREATE TABLE IF NOT EXISTS lead_quality (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Relación con lead original (solo lectura de leads, nunca escritura)
  lead_id               INTEGER NOT NULL UNIQUE,
  session_id            TEXT,
  phone                 TEXT,
  product_slug          TEXT,
  product_name          TEXT,
  city                  TEXT,

  -- Atribución Meta (copiada de leads para análisis aislado)
  campaign_id           TEXT,
  adset_id              TEXT,
  ad_id                 TEXT,
  campaign_name         TEXT,
  adset_name            TEXT,
  ad_name               TEXT,
  attribution_confidence TEXT,

  -- Estado del lead en el momento del snapshot
  status_snapshot       TEXT,  -- purchased / cancelled / blocked / stale / pending

  -- Scoring (0-100, puede ser negativo con penalizaciones)
  quality_score         INTEGER DEFAULT 0,
  quality_label         TEXT,   -- basura / muy_baja / baja / normal / bueno / muy_bueno / excelente
  buyer_type            TEXT,   -- rapido / combo / vip / alto_valor / normal / tardio / vencido / cancelado / bloqueado

  -- Métricas de tiempo
  time_to_purchase_h    REAL,   -- horas desde created_at hasta purchased_at (NULL si no compró)
  lead_age_h            REAL,   -- horas desde created_at hasta el momento del procesamiento

  -- Valor
  total_value           INTEGER,
  is_combo              INTEGER DEFAULT 0,  -- 1 si es combo reloj+cadena
  is_vip                INTEGER DEFAULT 0,  -- 1 si value >= 500.000
  is_fast_buyer         INTEGER DEFAULT 0,  -- 1 si compra en < 24h
  is_high_value         INTEGER DEFAULT 0,  -- 1 si value >= 300.000
  is_dead_lead          INTEGER DEFAULT 0,  -- 1 si venció sin comprar (> 5 días)
  is_cancelled          INTEGER DEFAULT 0,
  is_blocked            INTEGER DEFAULT 0,

  -- Comportamiento (de behavior_events via session_id)
  had_insync_session    INTEGER DEFAULT 0,  -- 1 si hay datos de comportamiento
  scroll_depth          INTEGER,            -- max scroll depth % en la sesión (25/50/75/90)
  cta_clicks            INTEGER DEFAULT 0,
  section_count         INTEGER DEFAULT 0,

  -- Explicación del score
  reason                TEXT,   -- texto libre con la lógica aplicada
  score_version         TEXT DEFAULT 'v1',

  -- Timestamps
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at          TEXT,   -- cuándo el BQE lo evaluó por última vez
  sent_to_meta_at       TEXT,   -- futuro: si se envía evento a Meta

  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- Índices para consultas del Motor de Inteligencia
CREATE INDEX IF NOT EXISTS idx_lq_lead_id       ON lead_quality(lead_id);
CREATE INDEX IF NOT EXISTS idx_lq_ad_id         ON lead_quality(ad_id);
CREATE INDEX IF NOT EXISTS idx_lq_adset_id      ON lead_quality(adset_id);
CREATE INDEX IF NOT EXISTS idx_lq_campaign_id   ON lead_quality(campaign_id);
CREATE INDEX IF NOT EXISTS idx_lq_status        ON lead_quality(status_snapshot);
CREATE INDEX IF NOT EXISTS idx_lq_score         ON lead_quality(quality_score);
CREATE INDEX IF NOT EXISTS idx_lq_processed     ON lead_quality(processed_at);
CREATE INDEX IF NOT EXISTS idx_lq_product       ON lead_quality(product_slug);
CREATE INDEX IF NOT EXISTS idx_lq_buyer_type    ON lead_quality(buyer_type);
CREATE INDEX IF NOT EXISTS idx_lq_is_dead       ON lead_quality(is_dead_lead);

-- Verificar post-ejecución:
-- wrangler d1 execute dam-vertex-leads --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='lead_quality';"
