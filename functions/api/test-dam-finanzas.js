/* =========================================================
   /api/test-dam-finanzas
   POST → proxy test payload a DAM Finanzas onAdminSale
   ─────────────────────────────────────────────────────────
   SEGURO: NO toca leads, NO toca stock D1, NO envía Meta CAPI.
   Solo reenvía el payload al webhook de DAM Finanzas.
   Protegido con Authorization: Bearer {ADMIN_PASSWORD}
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost({ request, env }) {
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || token !== env.ADMIN_PASSWORD) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const secret = env.DAM_FINANZAS_WEBHOOK_SECRET || '';
  if (!secret) return json({ ok: false, error: 'DAM_FINANZAS_WEBHOOK_SECRET no configurado' }, 500);

  let body;
  try { body = await request.json(); } catch (_) {
    return json({ ok: false, error: 'JSON inválido' }, 400);
  }

  const { adminOrderId, productSlug, productName, variantName, quantity, salePrice, itemIndex, operationalDate } = body;
  if (!adminOrderId) return json({ ok: false, error: 'adminOrderId requerido' }, 400);
  if (!productSlug)  return json({ ok: false, error: 'productSlug requerido'  }, 400);

  const payload = {
    sourceSystem:    'DAM_VERTEX',
    adminOrderId:    String(adminOrderId),
    productSlug:     String(productSlug),
    productName:     productName || productSlug,
    variantName:     variantName  || null,
    quantity:        Number(quantity)  || 1,
    salePrice:       Number(salePrice) || 0,
    itemIndex:       Number(itemIndex) || 0,
    operationalDate: operationalDate   || getParaguayDate(),
    purchasedAt:     new Date().toISOString(),
  };

  const res = await fetch(
    'https://us-central1-dam-finanzas-cf863.cloudfunctions.net/onAdminSale',
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-dam-vertex-secret': secret },
      body:    JSON.stringify(payload),
    }
  );

  const resBody = await res.json().catch(() => ({}));
  return json({ ok: res.ok, httpStatus: res.status, damFinanzas: resBody, sentPayload: payload });
}

function getParaguayDate() {
  return new Date(Date.now() - 4 * 3_600_000).toISOString().slice(0, 10);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
