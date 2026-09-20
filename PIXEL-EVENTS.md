# ⚠️ PIXEL EVENTS — REGLA INAMOVIBLE — NUNCA CAMBIAR

El sistema de eventos Meta Pixel replica exactamente Releasit COD Form en Shopify.
Esta configuración NUNCA se toca. No importa qué fix, qué optimización ni qué deploy.

## FLUJO EXACTO (igual a Releasit COD + Shopify) — confirmado 2026-09-20

1. **ViewContent** → DOMContentLoaded + setTimeout 800ms (browser + CAPI)
2. **AddToCart** → dentro de `openModal()`, al inicio, inmediato
3. **InitiateCheckout** → dentro de `openModal()`, setTimeout 1500ms después de AddToCart, flag `_icFired`, UNA SOLA VEZ por sesión
4. **Purchase** → CAPI server-side únicamente, en el endpoint al recibir el lead (NUNCA en browser)

## REGLAS

- InitiateCheckout NUNCA en focus/blur listener — siempre setTimeout dentro de openModal()
- InitiateCheckout NUNCA se dispara al submit — ya es tarde
- Purchase NUNCA se duplica en browser y server
- Pixel ID NUNCA hardcodeado en server-side — siempre `env.META_PIXEL_ID` via secret
- Esta configuración aplica a TODAS las landings nuevas sin excepción

Si algo se rompe: `git log` → encontrar el commit bueno → revertir solo el archivo afectado.

## Patrón canónico — TODAS las landings (copiar exactamente)

```javascript
let _icFired = false;
function openModal() {
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  try { DV.trackAddToCart(PRODUCT); } catch(_) {}
  if (!_icFired) {
    _icFired = true;
    setTimeout(() => {
      try { DV.trackInitiateCheckout(PRODUCT, null, 1); } catch(_) {}
    }, 1500);
  }
}
```

**Para combo modal** — mismo patrón con flags propios:
```javascript
var _comboIcFired = false;
function openComboModal() {
  comboOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  if (!_comboAtcFired) { DV.trackAddToCart({ name: COMBO_NAME, slug: COMBO_SLUG, price: COMBO_PRICE }); _comboAtcFired = true; }
  if (!_comboIcFired) { _comboIcFired = true; setTimeout(function() { try { DV.trackInitiateCheckout({ name: COMBO_NAME, slug: COMBO_SLUG, price: COMBO_PRICE }, null, 2); } catch (_) {} }, 1500); }
}
```

**Para tabla-marmol** (modal inline onclick, sin openModal function) — dentro del MutationObserver:
```javascript
var _icFired = false;
new MutationObserver(function() {
  if (_m.style.display === 'flex') {
    try { DV.trackAddToCart(PRODUCT); } catch (_) {}
    if (!_icFired) { _icFired = true; setTimeout(function() { try { DV.trackInitiateCheckout(PRODUCT, null, 1); } catch (_) {} }, 1500); }
  }
}).observe(_m, { attributes: true, attributeFilter: ['style'] });
```

## Estado actual (2026-09-20)

| Landing | Tipo | AddToCart | InitiateCheckout |
|---|---|---|---|
| interruptor-control-remoto | DCANP | `openModal()` | setTimeout 1500ms en `openModal()` |
| estante-aluminio-bano | DCANP | `openModal()` | setTimeout 1500ms en `openModal()` |
| talonera-gel | DCANP | `openModal()` | setTimeout 1500ms en `openModal()` |
| esquinero-aluminio | DCANP | `openModal()` | setTimeout 1500ms en `openModal()` |
| tabla-marmol | DCANP | MutationObserver | setTimeout 1500ms en MutationObserver |
| cadena | Normal | click `[data-scroll-form]` | setTimeout 1500ms en click handler |
| reloj | Normal | click `[data-scroll-form]` | setTimeout 1500ms en click handler |
| proyector-astronauta-sistema-solar | Normal | click `[data-scroll-form]` | setTimeout 1500ms en click handler |
| luna-mini-vibrador-bala-recargable | Normal | click `[data-scroll-form]` | setTimeout 1500ms en click handler |
