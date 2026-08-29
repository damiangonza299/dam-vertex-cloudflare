-- migrate34.sql — columna express_amount en leads
-- Guarda el extra de envío express (Gs. 10.000 fijo hoy) sumado al `value`
-- del lead, para poder separar subtotal producto vs. envío express en el
-- mensaje de factura (functions/api/confirm-purchase.js → sendTelegramInvoice).
-- 0 = sin express (default). Ver CLAUDE.md / incidente factura+express 2026-08.

ALTER TABLE leads ADD COLUMN express_amount INTEGER DEFAULT 0;
