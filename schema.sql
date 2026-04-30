-- Dam Vertex — D1 Database Schema
-- Run: wrangler d1 execute dam-vertex-leads --file=schema.sql

CREATE TABLE IF NOT EXISTS leads (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  product_name  TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  phone         TEXT    NOT NULL,
  email         TEXT,
  city          TEXT,
  value         REAL,
  currency      TEXT    NOT NULL DEFAULT 'PYG',
  fbp           TEXT,
  fbc           TEXT,
  user_agent    TEXT,
  ip            TEXT,
  status        TEXT    NOT NULL DEFAULT 'pending',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  purchased_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_status      ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_phone       ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_created_at  ON leads(created_at DESC);
