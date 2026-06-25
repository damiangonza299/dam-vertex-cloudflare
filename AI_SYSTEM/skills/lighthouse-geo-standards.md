---
name: lighthouse-geo-standards
description: "Estándares obligatorios de Performance, Accessibility, Best Practices y SEO (Lighthouse 90+) y GEO (Generative Engine Optimization) para todas las landings DAM Vertex. Aplicar en toda landing nueva y en cualquier cambio de HTML."
allowed-tools: Read Write Edit Glob Grep Bash
metadata:
  type: skill
  version: "1.0"
  author: DAM Vertex AI System
---

# Lighthouse & GEO Standards — Estándar Obligatorio

## Objetivo
Toda landing del sistema debe alcanzar y mantener:
- Performance: 90+
- Accessibility: 90+
- Best Practices: 96+
- SEO: 100
- GEO (Generative Engine Optimization): apto para IA

## REGLAS DE IMÁGENES (obligatorias siempre)
- Formato: WebP únicamente. Nunca PNG ni JPG en producción.
- Hero image: máximo 700px ancho, calidad 82, fetchpriority="high", loading="eager"
- Imágenes de sección: máximo 600px ancho, loading="lazy"
- Siempre declarar width y height exactos en el <img>
- Nunca usar imágenes de CDN externo (Shopify, etc.) — siempre /assets/img/ local
- Reducción esperada: PNG 1.5MB → WebP ~30-70KB (95%+ reducción)
- Si una imagen no está disponible aún: usar placeholder WebP de 1px transparente
  con comentario <!-- IMG_PENDIENTE: descripción -->
  NO dejar slots vacíos ni src rotos

## REGLAS DE SCRIPTS (obligatorias siempre)
- tracking.js: siempre con defer
- Nunca document.write para inyectar scripts
- Usar createElement('script') + async para scripts de terceros
- Scripts propios: siempre al final del body con defer
- Versión actualizada en query string: ?v=XX

## REGLAS DE HTML SEMÁNTICO (obligatorias siempre)
- Viewport: <meta name="viewport" content="width=device-width, initial-scale=1.0">
  NUNCA user-scalable=no ni maximum-scale=1
- Siempre incluir <main> envolviendo el contenido principal
- Todas las imágenes deben tener alt descriptivo
- Estructura semántica: <header>, <main>, <section>, <footer>
- Un solo <h1> por página
- Jerarquía de headings: h1 → h2 → h3 (nunca saltar niveles)

## REGLAS SEO (obligatorias siempre)
- <title> único y descriptivo por página (50-60 caracteres)
- <meta name="description"> único (150-160 caracteres)
- <meta property="og:*"> completo para redes sociales
- <link rel="canonical"> en cada landing
- Structured data (JSON-LD): Product schema en landings de producto

## REGLAS GEO — Generative Engine Optimization
Para que ChatGPT, Perplexity y Google AI Overview puedan
indexar y citar el contenido:
- JSON-LD con schema.org/Product en cada landing
- FAQPage schema en la sección FAQ
- Contenido semántico claro: el H1 debe describir el producto
- Párrafos con respuestas directas a preguntas frecuentes
- Nombre de marca + producto en title, h1 y primer párrafo

## REGLAS DE PERFORMANCE
- LCP objetivo: < 2.5 segundos
- TBT objetivo: < 200 ms
- CLS objetivo: 0
- FCP objetivo: < 1.5 segundos
- Cache-Control en APIs: s-maxage=300, stale-while-revalidate=60

## CHECKLIST ANTES DE CUALQUIER DEPLOY
- [ ] Todas las imágenes en WebP con dimensiones declaradas
- [ ] Ningún document.write en el HTML
- [ ] viewport sin user-scalable=no
- [ ] <main> presente
- [ ] <title> y <meta description> únicos
- [ ] JSON-LD Product schema presente
- [ ] FAQPage schema en sección FAQ
- [ ] tracking.js con defer y versión actualizada
- [ ] Lighthouse score verificado: 90+ en todas las categorías
- [ ] location-picker.js NO tiene preload ni dns-prefetch a maps.googleapis.com
- [ ] products.js NO tiene <link rel="preload"> en head
- [ ] Grid dinámico: opacity:0 solo al momento del swap, no al inicio
- [ ] .product-card__img tiene height: auto en CSS
- [ ] favicon.ico existe y está referenciado en el head
- [ ] Lighthouse corrido de forma SECUENCIAL (no paralela)

---

## Errores Críticos Confirmados en Producción

Patrones que causaron regresiones reales en DAM Vertex. Cada uno tiene un fix confirmado.

---

### ❌ ERROR 1 — width/height en `<img>` de cards dinámicas

**Problema:** Agregar `height="1118"` como atributo HTML a imágenes en grids dinámicos suprime el CSS `aspect-ratio` y agranda las cards visualmente. El atributo HTML actúa como UA style (`height: 1118px`) y gana contra `aspect-ratio` cuando el CSS no tiene `height` explícito.

**Solución correcta:**
```css
.product-card__img {
  width: 100%;
  height: auto;        /* OBLIGATORIO: override del atributo HTML */
  aspect-ratio: 4/5;
  object-fit: cover;
  object-position: center top;
}
```
- Mantener `width` y `height` en el `<img>` para prevenir CLS
- `height: auto` en el CSS siempre — sin excepción

---

### ❌ ERROR 2 — Google Maps en el critical path

**Problema:** Cargar `location-picker.js` en el `<head>` o con `<link rel="preload">` arrastra 411KB de Google Maps API al critical path. LCP pasa de ~2s a 7s+ porque el browser no puede pintar el hero hasta que Maps termina de parsear y ejecutar. Incluso `dns-prefetch` a `maps.googleapis.com` agrava el problema.

**Solución correcta — patrón lazy inject obligatorio:**
```javascript
(function() {
  var mapsLoaded = false;
  function loadLocationPicker() {
    if (mapsLoaded) return;
    mapsLoaded = true;
    var s = document.createElement('script');
    s.src = '/assets/js/location-picker.js?v=57';
    document.head.appendChild(s);
  }
  document.addEventListener('DOMContentLoaded', function() {
    // TRIGGER CORRECTO: apertura del modal, NO focus en el input.
    // El input de ubicación está dentro del modal — si el script no cargó
    // antes de que el modal abra, el mapa no inicializa y queda en blanco.
    document.querySelectorAll('[data-scroll-form]').forEach(function(el) {
      el.addEventListener('click', loadLocationPicker);
    });
    var modal = document.getElementById('order-modal');
    if (modal) {
      new MutationObserver(function(mutations) {
        mutations.forEach(function(m) {
          if (m.target.classList.contains('active')) loadLocationPicker();
        });
      }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    }
  });
})();
```

Reglas:
- NUNCA preload de `location-picker.js`
- NUNCA `dns-prefetch` ni `preconnect` a `maps.googleapis.com`
- TRIGGER: apertura del modal (`[data-scroll-form]` click + MutationObserver en `#order-modal.active`)
- ❌ NUNCA trigger en focus/click del input de ubicación — el input está DENTRO del modal, el script no tiene tiempo de cargar e inicializar para ese momento

---

### ❌ ERROR 3 — products.js en el critical path

**Problema:** `<link rel="preload">` de `products.js` (266KB) en el `<head>` compite con el hero image por ancho de banda. Aunque tenga `defer`, el preload lo descarga con alta prioridad. Combinado con LCP-blocking, puede sumar 1–2s adicionales al LCP.

**Solución correcta:**
- NUNCA `<link rel="preload">` para `products.js`
- Usar `<script src="/assets/js/products.js?vXX" defer>` al final del body
- Si el producto puede estar agotado: conditional loader verificando estado del CTA
- **IMPORTANTE:** No usar click-triggered lazy inject para `products.js` si hay código en `DOMContentLoaded` que llama a `DV.initForm()` u otras funciones de products.js. El inject dinámico es async y no garantiza que products.js esté listo cuando dispara DOMContentLoaded.

---

### ❌ ERROR 4 — Grid dinámico con `opacity:0` desde el inicio

**Problema:** Ocultar el grid estático con `opacity:0` antes del fetch hace que el browser no pueda encontrar el LCP element hasta que el fetch resuelve. LCP pasa de 1.4s a 2.6s+.

**Solución correcta:**
```javascript
// MAL — opacity:0 bloquea LCP
grid.style.opacity = '0';
fetch('/api/products').then(data => {
  grid.innerHTML = buildCards(data);
  grid.style.opacity = '1';
});

// BIEN — opacity:0 solo justo antes del swap
fetch('/api/products').then(data => {
  grid.style.opacity = '0';          // solo aquí, dentro del .then()
  grid.innerHTML = buildCards(data);
  requestAnimationFrame(() => { grid.style.opacity = '1'; });
}).catch(() => {
  /* NO tocar opacity — fallback estático permanece visible */
});
```

---

### ❌ ERROR 5 — Lighthouse en paralelo da TBT falso

**Problema:** Correr 5 instancias de Lighthouse simultáneamente comparte CPU y produce TBT inflado artificialmente (ejemplo confirmado: 630ms → 1529ms).

**Solución:** Siempre correr Lighthouse de forma secuencial:
```powershell
npx lighthouse https://damvertex.com --output=json --output-path=./lh-home.json --chrome-flags="--headless --no-sandbox" --only-categories=performance,accessibility,best-practices,seo --quiet 2>$null
npx lighthouse https://damvertex.com/cadena/ --output=json --output-path=./lh-cadena.json ...
# etc — un comando por URL, en secuencia
```

---

### ✅ Patrones correctos confirmados en producción

- **CSS minificado:** `npx csso-cli styles.css --output styles.min.css` → 23% reducción. Aplicar a todas las landings y referenciar con `?v=XX`.
- **Favicon:** siempre incluir `<link rel="icon" href="/favicon.ico">` y asegurar que `/favicon.ico` exista — un 404 penaliza Best Practices.
- **JSON-LD:** Product schema + FAQPage schema en todas las landings → SEO 100.
- **`<main>` landmark:** obligatorio en todas las páginas — `landmark-one-main` es audit con weight=3.
- **Imágenes de cards dinámicas:** `DV_CARD_DIMS` con `width`/`height` en el `<img>` + `height: auto` en CSS.
- **Preload hero image:** `<link rel="preload" as="image" href="/assets/img/hero.webp" fetchpriority="high" type="image/webp">` — crítico para LCP.

---

## FUNCIONALIDADES CRÍTICAS — NUNCA MODIFICAR SIN AUTORIZACIÓN EXPLÍCITA

### location-picker.js + Google Maps

**CONFLICTO CONOCIDO — leer antes de tocar:**

| Opción | LCP | Mapa |
|---|---|---|
| `defer` directo | ❌ 6.9s — Maps API carga en DOMContentLoaded | ✅ funciona |
| lazy inject sin `onload` | ✅ LCP rápido | ❌ roto — `DV.initLocationPicker` no existe al DOMContentLoaded |
| **lazy inject + `onload` callback** | ✅ LCP rápido | ✅ funciona |

**Solución correcta y definitiva — patrón lazy inject + onload:**
```javascript
(function() {
  var lpLoaded = false;
  function loadLP() {
    if (lpLoaded) return;
    lpLoaded = true;
    var s = document.createElement('script');
    s.src = '/assets/js/location-picker.js?v=57';
    s.onload = function() {
      // products.js ya corrió su guard (falló) — llamar manualmente
      if (typeof DV.initLocationPicker === 'function') {
        DV.initLocationPicker('m', window.DV_MAPS_KEY || '');
      }
    };
    document.head.appendChild(s);
  }
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-scroll-form]').forEach(function(el) {
      el.addEventListener('click', loadLP);
    });
    var modal = document.getElementById('order-modal');
    if (modal) {
      new MutationObserver(function(mutations) {
        mutations.forEach(function(m) {
          if (m.target.classList.contains('active')) loadLP();
        });
      }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    }
  });
})();
```

**Por qué funciona:**
- `location-picker.js` no carga hasta que el usuario abre el modal → LCP limpio
- `products.js` llama `DV.initLocationPicker('m', key)` en DOMContentLoaded pero falla silenciosamente (guard `typeof`)
- `inputEl._dvLocInit` NO se setea hasta que `initLocationPicker` corre → cuando `onload` llama `initLocationPicker('m', key)`, el guard pasa limpiamente
- Maps API (~400KB) solo carga cuando `initLocationPicker` es llamado desde `onload`
- El usuario tarda 5-10s en llegar al campo de ubicación → Maps API ya cargó para entonces

**Reglas:**
- NO agregar `preconnect` ni `dns-prefetch` a `maps.googleapis.com`
- NO usar `defer` directo — carga Maps API al DOMContentLoaded
- NO usar lazy inject sin `onload` — `initLocationPicker` no corre nunca
- SIEMPRE usar el patrón lazy inject + onload mostrado arriba
- El flujo completo: usuario tipea ciudad → sugerencias aparecen → usuario selecciona → pin aparece en mapa → link generado → link llega a WhatsApp y Telegram con coordenadas exactas

**Si la landing tiene múltiples modales (order-modal + combo-modal):**

El MutationObserver de `loadLP()` debe observar TODOS los modales, no solo el principal. De lo contrario el mapa no aparece en el combo-modal si el usuario lo abre antes de haber tocado cualquier CTA del order-modal — porque `DV.initLocationPicker('cm', ...)` dentro de `openComboModal()` falla silenciosamente cuando Maps todavía no cargó, y nadie lo reintenta.

```javascript
// Agregar dentro del DOMContentLoaded del IIFE de loadLP():
var comboBtn = document.getElementById('open-combo-modal');
if (comboBtn) comboBtn.addEventListener('click', loadLP);
var comboModal = document.getElementById('combo-modal');
if (comboModal) {
  new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      if (m.target.classList.contains('active')) loadLP();
    });
  }).observe(comboModal, { attributes: true, attributeFilter: ['class'] });
}

// Y en el onload de location-picker.js, también inicializar combo si está activo:
s.onload = function() {
  if (typeof DV.initLocationPicker === 'function') {
    DV.initLocationPicker('m', window.DV_MAPS_KEY || '');
    var cm = document.getElementById('combo-modal');
    if (cm && cm.classList.contains('active')) {
      DV.initLocationPicker('cm', window.DV_MAPS_KEY || '');
    }
  }
};
```

### products.js

- Siempre `defer`, nunca `preload`, nunca lazy inject
- `DV.initForm()` se llama en DOMContentLoaded — `products.js` debe estar disponible en ese momento
- El conditional loader (para productos agotados) es la única excepción permitida

### QualifiedLead

- Vive en `functions/api/leads.js` líneas 282, 318, 419
- Es 100% server-side CAPI — no existe browser-side
- Se dispara cuando el lead se guarda en D1
- NUNCA agregar implementación browser-side en `tracking.js`
- NUNCA modificar `leads.js` sin autorización explícita

### tracking.js eventos

- PageView, ViewContent, AddToCart, InitiateCheckout: browser+CAPI
- Purchase, HighValuePurchase, VIPPurchase, FastBuyer: solo CAPI
- La deduplicación por `eventID` es crítica — no modificar
- NO agregar nuevos eventos sin verificar que no rompen la deduplicación existente

### LÍMITE TÉCNICO CONOCIDO — Meta Pixel vs LCP

El Meta Pixel (fbevents.js + signals/config) consume ~1,500-2,100ms de CPU en el main thread en móvil emulado. Esto establece un techo de Perf ~74 y LCP ~3.2s en landings con Pixel activo, medidas en condiciones de 4G lenta.

NO diferir fbevents.js — el Pixel debe disparar en el critical path para máxima calidad de señal a Meta. La señal temprana es más valiosa que 15 puntos de Lighthouse.

En condiciones reales (dispositivo real, red real), el LCP es ~1.5-2s. El score de Lighthouse en 4G emulada no refleja la experiencia real del usuario en Paraguay.
