# ⚠️ PIXEL EVENTS — REGLA INAMOVIBLE — NUNCA CAMBIAR

El sistema de eventos Meta Pixel replica exactamente Releasit COD Form en Shopify.
Esta configuración NUNCA se toca. No importa qué fix, qué optimización ni qué deploy.

## FLUJO EXACTO (igual a Releasit COD + Shopify)

1. **ViewContent** → DOMContentLoaded + setTimeout 800ms (browser + CAPI)
2. **AddToCart** → clic en `[data-open-modal]` o `[data-scroll-form]` (browser only)
3. **InitiateCheckout** → primer focus en cualquier input del formulario, una sola vez por sesión (browser only)
4. **Purchase** → CAPI server-side únicamente, en el endpoint al recibir el lead (NUNCA en browser)

## REGLAS

- AddToCart y InitiateCheckout NUNCA se disparan al mismo tiempo
- InitiateCheckout NUNCA se dispara al submit — ya es tarde
- Purchase NUNCA se duplica en browser y server
- Esta configuración aplica a TODAS las landings nuevas sin excepción

Si algo se rompe: `git log` → encontrar el commit bueno → revertir solo el archivo afectado.

## Patrón canónico — DCANP (`[data-open-modal]`, `#dcanp-form` o `#modal-form`)

```javascript
// AddToCart — dentro de openModal()
function openModal() {
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  try { DV.trackAddToCart(PRODUCT); } catch (_) {}
}

// InitiateCheckout — primer focus en el form (una sola vez)
let _icFired = false;
document.querySelectorAll('#dcanp-form input, #dcanp-form textarea').forEach(function(inp) {
  inp.addEventListener('focus', function() {
    if (!_icFired) { _icFired = true; try { DV.trackInitiateCheckout(PRODUCT, null, 1); } catch (_) {} }
  }, { once: true });
});
```

## Patrón canónico — Normal / WhatsApp (`[data-scroll-form]`, `#modal-form`)

```javascript
// AddToCart — al abrir modal
document.querySelectorAll('[data-scroll-form]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    try { DV.trackAddToCart(PRODUCT); } catch(_) {}
  });
});

// InitiateCheckout — primer focus en el form (una sola vez)
var _icFired = false;
document.querySelectorAll('#modal-form input, #modal-form textarea').forEach(function(inp) {
  inp.addEventListener('focus', function() {
    if (!_icFired) { _icFired = true; try { DV.trackInitiateCheckout(PRODUCT, null, 1); } catch (_) {} }
  }, { once: true });
});
```

## Estado actual (2026-09-20)

Implementado en todas las landings activas:

| Landing | Tipo | AddToCart | InitiateCheckout |
|---|---|---|---|
| estante-aluminio-bano | DCANP | `openModal()` | primer focus `#dcanp-form` |
| tabla-marmol | DCANP | MutationObserver modal | primer focus `#modal-form` |
| talonera-gel | DCANP | `openModal()` | primer focus `#dcanp-form` |
| interruptor-control-remoto | DCANP | `openModal()` | primer focus `#dcanp-form` |
| esquinero-aluminio | DCANP | `openModal()` | primer focus `#dcanp-form` |
| cadena | Normal | `[data-scroll-form]` click | primer focus `#modal-form` |
| reloj | Normal | `[data-scroll-form]` click | primer focus `#modal-form` |
| proyector-astronauta-sistema-solar | Normal | `[data-scroll-form]` click | primer focus `#modal-form` |
| luna-mini-vibrador-bala-recargable | Normal | `[data-scroll-form]` click | primer focus `#modal-form` |
