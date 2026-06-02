-- DAM inSync V1 — Revenue Attribution
-- migration 17: add session_id to leads for exact session→lead→purchase correlation

ALTER TABLE leads ADD COLUMN session_id TEXT;
CREATE INDEX IF NOT EXISTS idx_leads_session_id ON leads(session_id);
