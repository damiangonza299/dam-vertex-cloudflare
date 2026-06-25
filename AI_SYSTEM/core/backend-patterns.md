# Backend Patterns — Cloudflare Pages Functions

## ctx.waitUntil() — operaciones no bloqueantes

SIEMPRE usar `waitUntil()` para operaciones que no necesitan
completar antes de responder al cliente:
- Notificaciones (Telegram, WhatsApp)
- Tracking externo (Meta CAPI, Firebase)
- Webhooks y analytics

SOLO bloquear con `await` cuando el resultado es necesario
para la respuesta: writes en D1, lecturas de DB, validaciones.

### Patrón obligatorio — /api/leads y similares

```javascript
// ✅ CORRECTO
export async function onRequestPost({ request, env, waitUntil }) {
  await escribirD1(...)                    // único await obligatorio

  waitUntil((async () => {
    if (!env.TELEGRAM_TOKEN) return;
    try { await fetch(telegramAPI) } catch (e) { console.error(e) }
  })());

  waitUntil((async () => {
    if (!env.META_PIXEL_ID) return;
    try { await fetch(metaCAPI) } catch (_) {}
  })());

  return Response.json({ ok: true })       // respuesta inmediata
}

// ❌ MAL — bloquea al cliente
await fetch(telegramAPI)
await fetch(metaCAPI)
return Response.json({ ok: true })         // llega 1-3s tarde
```

### Implementado en

- `functions/api/leads.js` — Telegram y CAPI corren en background desde 2026-06-25

---

## fetchWithTimeout — siempre en el frontend

Todo `fetch` en `products.js` debe tener timeout con AbortController.
Sin timeout = spinner infinito si la API cae.

```javascript
function fetchWithTimeout(url, options, ms) {
  ms = ms || 8000;
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, ms);
  return fetch(url, Object.assign({}, options, { signal: controller.signal }))
    .finally(function() { clearTimeout(timer); });
}
```

| Endpoint | Timeout |
|---|---|
| `/api/product-stock` | 5000ms |
| `/api/leads` | 8000ms (default) |

### Implementado en

- `public/assets/js/products.js` — desde 2026-06-25
