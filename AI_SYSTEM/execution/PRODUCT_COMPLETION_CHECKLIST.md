# PRODUCT COMPLETION CHECKLIST — DAM Vertex

## Regla permanente

**Ningún producto nuevo está terminado hasta pasar este checklist completo.**

No declarar "producto terminado", "listo para activar", ni "listo para deploy" sin verificar cada punto.

---

## 1. Archivo y slug

- [ ] `public/{slug}/index.html` existe como archivo físico
- [ ] El slug en el archivo coincide con el slug en D1 `products.slug`
- [ ] El slug es único — no existe otra landing ni producto con ese slug
- [ ] Slug en minúsculas, sin espacios, solo letras, números y guiones

---

## 2. PRODUCT object en la landing

```javascript
const PRODUCT = {
  name:  'Nombre Público del Producto',
  slug:  'slug-del-producto',   // ← debe coincidir con D1
  price: 000000,                // ← precio base en Gs.
};
```

- [ ] `name` coincide con `products.name` en D1
- [ ] `slug` coincide con `products.slug` en D1
- [ ] `price` coincide con `products.default_price` en D1
- [ ] `PRODUCT` se pasa a `DV.trackViewContent(PRODUCT)` y `DV.initForm(PRODUCT)` en `DOMContentLoaded`

---

## 3. InSync — carga del script

- [ ] `<script defer src="/assets/js/insync.js?vX">` está en el HTML antes de `</body>`

---

## 4. InSync — instrumentación de secciones (triple atributo)

Regla completa: `AI_SYSTEM/execution/landing-insync-instrumentation.md`

- [ ] Cada sección visible tiene `id="section-{nombre}"`
- [ ] Cada sección visible tiene `data-insync-section="{nombre}"`
- [ ] Ambos usan el mismo `{nombre}` descriptivo (hero, beneficios, faq, cierre — no genéricos)
- [ ] Ningún `<section>` sin `id` y `data-insync-section` (excepto `display:none`)

Secciones estándar:

- [ ] Hero: `id="section-hero"` / `data-insync-section="hero"`
- [ ] Secciones de contenido medio (transformacion, producto, beneficios, etc.)
- [ ] FAQ: `id="section-faq"` / `data-insync-section="faq"`
- [ ] Cierre: `id="section-cierre"` / `data-insync-section="cierre"`

---

## 5. InSync — CTAs instrumentados

- [ ] Todo CTA principal dentro de una sección tiene `data-insync-cta="{nombre}"` donde `{nombre}` = `data-insync-section` de la sección que lo contiene
- [ ] No existe `data-insync-cta="oferta"` ni ningún valor genérico que no matchee una sección
- [ ] CTA de navegación: `data-insync-cta="nav"` (permitido — cross-section)
- [ ] Sticky bar: `data-insync-cta="sticky"` (permitido — cross-section)

---

## 6. Modal

- [ ] `<div id="order-modal">` existe en el HTML
- [ ] Modal abre al click en cualquier `[data-scroll-form]`
- [ ] Modal cierra con botón ✕ y con click fuera
- [ ] `<form id="modal-form" novalidate>` existe dentro del modal
- [ ] Campos del formulario: nombre, teléfono, variante (si aplica), cantidad (si aplica)
- [ ] `<button id="modal-submit-btn">` existe

---

## 7. WhatsApp

- [ ] Link de WhatsApp tiene número correcto de DAM Vertex
- [ ] Texto pre-cargado incluye nombre del producto
- [ ] Link funciona en mobile (abre app de WhatsApp)

---

## 8. Lead — Telegram y backend

- [ ] Submit del modal llama a `/api/leads` con `product_slug` correcto
- [ ] Respuesta 200 de `/api/leads` confirma lead guardado en D1
- [ ] Lead aparece en Admin Panel después del submit
- [ ] Notificación Telegram se dispara al recibir lead (verificar en chat)

---

## 9. Tracking

- [ ] `<script src="/assets/js/tracking.js?vX" defer>` está en el HTML
- [ ] `DV.trackViewContent(PRODUCT)` se llama en `DOMContentLoaded`
- [ ] `DV.initForm(PRODUCT)` se llama en `DOMContentLoaded`

---

## 10. InitiateCheckout

- [ ] `InitiateCheckout` se dispara al abrir el modal (via `tracking.js` + `DV.initForm`)
- [ ] El evento llega a Pixel (verificar con Meta Pixel Helper o Events Manager)

---

## 11. QualifiedLead

- [ ] Verificar si el flujo actual activa `QualifiedLead` para este producto
- [ ] Si aplica: confirmar que se dispara cuando el lead entra al Admin Panel

---

## 12. Purchase manual

- [ ] Admin Panel muestra este producto en el selector de "Confirmar venta"
- [ ] Confirmar venta desde Admin descuenta stock correctamente
- [ ] El evento `Purchase` (manual) se registra en D1 correctamente

---

## 13. CAPI

- [ ] `ViewContent` llega a CAPI con `event_source_url` de esta landing
- [ ] `InitiateCheckout` llega a CAPI al abrir modal
- [ ] `user_data` incluye teléfono (hasheado), IP y user_agent
- [ ] No se disparan eventos CAPI incorrectos o inexistentes para este producto

---

## 14. Product Registry

- [ ] Producto existe en D1 `products`: `active=1`, `stock_total > 0`, `default_price > 0`
- [ ] `product_briefs` existe: `op_json`, `strategic_json`, `visual_json` completos
- [ ] `dam_finanzas_status = 'linked'`
- [ ] `status = 'active'`

---

## 15. Admin

- [ ] Producto aparece en dropdown de filtros del Admin Panel
- [ ] Venta manual WhatsApp funciona para este producto
- [ ] Variantes aparecen en venta manual (si aplica)
- [ ] Filtro de leads por producto funciona

---

## 16. Dam Finanzas

- [ ] Producto en inventario Dam Finanzas (`dam_finanzas_status = 'linked'`)
- [ ] `onAdminSale` webhook envía payload con `productSlug` correcto
- [ ] Venta test en Admin → reporte creado en Dam Finanzas
- [ ] Stock descuenta en Dam Finanzas al confirmar venta
- [ ] Ganancia se calcula en el reporte
- [ ] Notificación push de venta se dispara

---

## 17. Stock

- [ ] `confirm-purchase.js` reconoce el slug (dinámico para productos simples — no requiere hardcode)
- [ ] Stock se descuenta en D1 al confirmar compra
- [ ] Stock mínimo (`min_stock`) configurado en D1
- [ ] Alerta de stock bajo llega a Admin/Telegram si aplica

---

## 18. Home `/`

- [ ] Producto aparece en el grid de Home cuando `active=1` (carga dinámica via `/api/product-stock`)
- [ ] `DV_CARD_IMAGES['{slug}']` está definido en `public/index.html` con URL de imagen correcta
- [ ] `DV_SLUG_ORDER` en `public/index.html` incluye el slug en la posición deseada
- [ ] Fallback HTML estático en `public/index.html` incluye card del producto

---

## 19. `/productos/`

- [ ] Producto aparece en el grid de `/productos/` cuando `active=1` (carga dinámica)
- [ ] `DV_CARD_IMAGES['{slug}']` está definido en `public/productos/index.html`
- [ ] `DV_SLUG_ORDER` en `public/productos/index.html` incluye el slug
- [ ] Fallback HTML estático en `public/productos/index.html` incluye card del producto

---

## 20. Intelligence

- [ ] Producto aparece en selector de Intelligence (dinámico desde API)
- [ ] `behavior_events` puede recibir eventos de esta landing (instrumentación ← punto 4 y 5)
- [ ] `/api/insync/structure-patterns?category={cat}` incluye el slug de esta landing

---

## 21. Activation check

Correr: `GET /api/product-activation-check?slug={slug}`

- [ ] Ningún punto con status `FAIL` crítico
- [ ] `tracking_viewcontent` PASS
- [ ] `tracking_initform` PASS
- [ ] `modal_exists` PASS
- [ ] `landing_exists` PASS
- [ ] `dam_finanzas_status` PASS

---

## 22. Auditoría final

- [ ] Abrir landing en mobile — carga correcta, sin errores de consola
- [ ] Abrir landing en desktop — carga correcta
- [ ] Click en CTA → modal abre
- [ ] Completar formulario → lead en Admin Panel
- [ ] InSync registra `page_view` y `section_view` en `behavior_events` (verificar D1 o logs)
- [ ] No hay errores en console (F12 → Console)

---

## Resumen de archivos que requieren edición manual para cada producto nuevo

Estos archivos tienen hardcodes y deben editarse con cada producto nuevo:

| Archivo | Qué agregar |
|---|---|
| `public/index.html` | `DV_CARD_IMAGES['{slug}']`, `DV_SLUG_ORDER`, fallback HTML card |
| `public/productos/index.html` | Ídem (archivo duplicado — deben sincronizarse) |
| `public/{slug}/index.html` | Crear desde cero con brief completo |

---

*Establecido: 2026-06-13. Aplica a todos los productos nuevos desde esta fecha.*
