-- migrate24.sql: Invoice request fields on leads
ALTER TABLE leads ADD COLUMN invoice_requested INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN invoice_ruc TEXT;
ALTER TABLE leads ADD COLUMN invoice_name TEXT;
ALTER TABLE leads ADD COLUMN invoice_email TEXT;
ALTER TABLE leads ADD COLUMN invoice_status TEXT;
