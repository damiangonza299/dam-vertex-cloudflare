-- DAM Vertex — Blacklist de clientes problemáticos
-- migration 18: blocked_customers table

CREATE TABLE IF NOT EXISTS blocked_customers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id      INTEGER,
  name         TEXT,
  phone        TEXT,
  ip           TEXT,
  user_agent   TEXT,
  fbp          TEXT,
  fbc          TEXT,
  session_id   TEXT,
  reason       TEXT,
  notes        TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  unblocked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_bc_phone  ON blocked_customers(phone);
CREATE INDEX IF NOT EXISTS idx_bc_ip     ON blocked_customers(ip);
CREATE INDEX IF NOT EXISTS idx_bc_active ON blocked_customers(active);
