/* =========================================================
   _lib/damFinanzasSync.js — Re-sync automático de stock a Dam Finanzas
   Usado por product-registry.js (Product Studio) y product-stock.js
   (Admin Panel) tras un ajuste manual de stock_total/variants_json.

   Mismo endpoint y payload que "Sincronizar con DAM Finanzas" (botón
   manual en Product Studio), pero pensado para llamarse en background
   (waitUntil) — best-effort, nunca lanza. D1 es la fuente de verdad y
   ya quedó guardado por el caller antes de invocar esto; un ajuste de
   stock no debe fallar ni demorarse porque Dam Finanzas esté lento o
   caído. Ver CLAUDE.md "STOCK — RE-SYNC AUTOMÁTICO A DAM FINANZAS".
   ========================================================= */

const DAM_FINANZAS_BASE = 'https://us-central1-dam-finanzas-cf863.cloudfunctions.net';

/**
 * Re-sincroniza un producto a Dam Finanzas solo si ya estaba vinculado
 * (dam_finanzas_status='linked' en product_briefs). Si nunca se sincronizó,
 * no hace nada — eso sigue siendo una acción manual explícita ("Sincronizar
 * con DAM Finanzas" en Product Studio).
 */
export async function autoResyncToFinanzas(slug, env) {
  try {
    const brief = await env.DB.prepare(
      'SELECT dam_finanzas_status FROM product_briefs WHERE product_slug = ?'
    ).bind(slug).first();
    if (!brief || brief.dam_finanzas_status !== 'linked') return;

    const secret = env.DAM_FINANZAS_WEBHOOK_SECRET || '';
    if (!secret) { console.error('AUTO_RESYNC_SKIPPED no_secret', slug); return; }

    const res  = await fetch(`${DAM_FINANZAS_BASE}/importProductFromVertex`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-dam-vertex-secret': secret },
      body:    JSON.stringify({ productSlug: slug }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.productId) {
      const note = data?.error || `HTTP ${res.status}`;
      console.error('AUTO_RESYNC_FAILED', slug, note);
      await env.DB.prepare(
        "UPDATE product_briefs SET dam_finanzas_status='failed', dam_finanzas_note=?, updated_at=datetime('now') WHERE product_slug=?"
      ).bind(`auto-resync: ${note}`, slug).run().catch(() => {});
      return;
    }

    console.log('AUTO_RESYNC_OK', slug, data.action);
    await env.DB.prepare(
      "UPDATE product_briefs SET dam_finanzas_note=?, updated_at=datetime('now') WHERE product_slug=?"
    ).bind(`auto-resync: ${data.action}`, slug).run().catch(() => {});
  } catch (err) {
    console.error('AUTO_RESYNC_ERROR', slug, err.message);
  }
}
