-- DAM Vertex — Migration 32: columna horario en leads
-- functions/api/leads.js ya recibe "horario" del POST (modal de las landings,
-- ver CLAUDE.md "Campo Horario") pero nunca lo guardaba en D1 — solo viajaba
-- al mensaje de Telegram del momento. Sin esta columna, el botón "Enviar a
-- delivery" del admin no puede incluir el horario porque el dato no existe
-- en el lead una vez guardado.
--
-- Ejecutar remoto: wrangler d1 execute dam-vertex-leads --remote --file=migrate32.sql

ALTER TABLE leads ADD COLUMN horario TEXT;
