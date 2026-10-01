// scripts/export-to-sheets.js
// Vuelca leads históricos de D1 (dam-vertex-leads) al Google Sheet vía webhook.
// Uso: node scripts/export-to-sheets.js [webhookUrl]

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const NPX = 'C:\\Program Files\\nodejs\\npx.cmd';
const FROM_DATE = '2026-09-02';

function getWebhookUrl() {
  if (process.argv[2]) return process.argv[2];
  const devVarsPath = path.join(__dirname, '..', '.dev.vars');
  const content = fs.readFileSync(devVarsPath, 'utf8');
  const match = content.match(/^DCANP_SHEETS_WEBHOOK_URL=(.+)$/m);
  if (!match) throw new Error('DCANP_SHEETS_WEBHOOK_URL no encontrada en .dev.vars');
  return match[1].trim();
}

function fetchLeads() {
  const sql = `SELECT created_at, name, phone, city, product_name, quantity, address, value, observation, invoice_ruc, invoice_name, invoice_email, email FROM leads WHERE created_at >= '${FROM_DATE}' ORDER BY created_at ASC;`;
  const cmd = `"${NPX}" wrangler d1 execute dam-vertex-leads --remote --command="${sql}" --json`;
  const out = execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  const parsed = JSON.parse(out);
  return parsed[0].results;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const webhookUrl = getWebhookUrl();
  const leads = fetchLeads();
  console.log(`Encontrados ${leads.length} leads desde ${FROM_DATE}.`);

  let ok = 0;
  let fail = 0;

  for (const lead of leads) {
    const payload = {
      fecha: lead.created_at || '',
      nombre: lead.name || '',
      telefono: lead.phone || '',
      ciudad: lead.city || '',
      producto: lead.product_name || '',
      cantidad: lead.quantity || 1,
      calle: lead.address || '',
      monto: 'Gs. ' + Number(lead.value || 0).toLocaleString('es-PY'),
      nota: lead.observation || '',
      ruc: lead.invoice_ruc || '',
      razon_social: lead.invoice_name || '',
      email: lead.invoice_email || lead.email || '',
    };

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'follow',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        console.log(`✅ ${payload.nombre} - ${payload.producto}`);
        ok++;
      } else {
        console.log(`❌ ${payload.nombre} - ${payload.producto} (HTTP ${res.status})`);
        fail++;
      }
    } catch (e) {
      console.log(`❌ ${payload.nombre} - ${payload.producto} (${e.message})`);
      fail++;
    }

    await sleep(300);
  }

  console.log(`\nTotal: ${leads.length} | Enviados OK: ${ok} | Fallidos: ${fail}`);
}

main().catch((e) => {
  console.error('ERROR FATAL:', e.message);
  process.exit(1);
});
