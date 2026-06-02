-- DAM inSync V1 — Behavioral Analytics
-- migration 15: behavior_events table

CREATE TABLE IF NOT EXISTS behavior_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT    NOT NULL,
  landing     TEXT    NOT NULL,
  event_type  TEXT    NOT NULL,
  section     TEXT,
  cta_type    TEXT,
  meta        TEXT,
  ts          INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_be_session  ON behavior_events(session_id);
CREATE INDEX IF NOT EXISTS idx_be_type     ON behavior_events(event_type);
CREATE INDEX IF NOT EXISTS idx_be_ts       ON behavior_events(ts DESC);
CREATE INDEX IF NOT EXISTS idx_be_landing  ON behavior_events(landing);
CREATE INDEX IF NOT EXISTS idx_be_section  ON behavior_events(section);
CREATE INDEX IF NOT EXISTS idx_be_cta      ON behavior_events(cta_type);
