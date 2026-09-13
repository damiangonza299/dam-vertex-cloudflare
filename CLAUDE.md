# DAM VERTEX — Instrucciones Claude Code

## CONTEXT LOADING POLICY — Optimización de Tokens

### Regla permanente

Cuando se indique "Lee AI_SYSTEM/INDEX.md" o al iniciar una sesión:
**No cargar automáticamente todo el ecosistema.**
Primero clasificar la tarea. Luego cargar solo lo necesario.

`AI_SYSTEM/INDEX.md` actúa como **router**. Leerlo no implica cargar todo.

### Niveles de tarea

#### Nivel 1 — Tarea pequeña

Señales: mover botones · cambiar colores · spacing · CSS · textos · badges · ajustes visuales · pequeños fixes HTML

Acción:
- Leer `AI_SYSTEM/INDEX.md`
- Identificar si existe skill relacionado
- Cargar solamente lo estrictamente necesario
- No cargar Product Studio, InSync, Dam Finanzas, Meta Ads, Event Flow si no aplican

#### Nivel 2 — Tarea mediana

Señales: nueva funcionalidad aislada · Admin Panel · Product Studio · Dam Finanzas · Activation Check · Dam Intelligence · landing completa · tracking específico

Acción:
- Leer `AI_SYSTEM/INDEX.md`
- Cargar únicamente los skills relacionados con la tarea
- No cargar skills de áreas no involucradas

#### Nivel 3 — Tarea grande

Señales: producto nuevo · auditoría completa · migraciones · InSync Recommendation Engine · Meta CAPI · Event Flow · arquitectura · sistemas cross-module

Acción:
- Leer `AI_SYSTEM/INDEX.md`
- Cargar todos los skills relevantes al alcance de la tarea
- Expandir contexto progresivamente, no de golpe

### Prioridad de principios

1. Precisión
2. Arquitectura correcta
3. Minimización de contexto
4. Minimización de tokens

Nunca sacrificar precisión por ahorrar tokens.
Nunca cargar el ecosistema completo si la tarea puede resolverse con un subconjunto.

---

## META ADS — STRICT MODE

### CHECKLIST PRE-CAMPAÑA — Obligatorio antes de crear o modificar campañas

Antes de cualquier creación o modificación de campaña, ejecutar en orden:

1. Analizar campañas históricas (performance, ROAS, estructura).
2. Analizar ROAS real (D1 `purchased_manual` / gasto Meta — NO Meta Purchase).
3. Analizar Purchase real (ventas confirmadas en admin panel — `status='purchased'` en D1 —, no el evento CAPI, que desde el 27/08/2026 se dispara al crear el lead, no al confirmar. Ver "FLUJO DE EVENTOS META — IMPORTANTE").
4. Analizar leads reales que entraron al Admin Panel (QualifiedLead como evento CAPI fue eliminado el 27/08/2026 — usar conteo de leads en D1).
5. Proponer cambios concretos con justificación en datos reales.
6. Esperar aprobación explícita del usuario antes de ejecutar.

**Nunca ejecutar cambios basados únicamente en métricas de Meta sin contrastar con datos reales de DAM Vertex.**

### Reglas de escritura Meta API

- Lectura: siempre permitida.
- Escritura (crear, modificar, pausar, activar): solo con autorización explícita.
- Si Meta devuelve error (rate limit, throttling, permisos): detenerse, mostrar diagnóstico, esperar instrucciones. No reintentar.

### Reglas de análisis — Strict Mode

1. Leer datos reales antes de recomendar. No actuar sobre hipótesis o memoria de sesiones anteriores.
2. ROAS real = `purchased_manual` en D1 / gasto Meta. No usar Meta Purchase como fuente de verdad.
3. QualifiedLead como evento CAPI fue eliminado (27/08/2026) — usar conteo de leads en D1 en su lugar.
4. `status='purchased'` en D1 sigue siendo manual, vía Admin Panel — pero el evento CAPI `Purchase` ya NO se dispara ahí, se dispara al crear el lead (ver "FLUJO DE EVENTOS META — IMPORTANTE").
5. ~~No mezclar InitiateCheckout con QualifiedLead~~ — regla obsoleta, QualifiedLead ya no existe.
6. No tocar Pixel, CAPI, Purchase, InitiateCheckout sin pedido explícito confirmado.

### Prioridad de fuentes de verdad

1. D1 (admin panel) + `purchased_manual`
2. Meta API (datos de gasto, impresiones, CTR)
3. Nunca: conjetura, estimación o datos de sesiones anteriores

---

## FUENTE DE VERDAD DEL SISTEMA

### DAM Vertex — Responsable de

Leads · Pedidos · Admin Panel · Delivery Panel · Inventario comercial · WhatsApp · Telegram · Meta Ads · Pixel · CAPI · Purchase manual · QualifiedLead · Gestión operativa

### Dam Finanzas — Responsable de

Reportes financieros · Ganancia real · Publicidad del día · CPA promedio · Distribución de publicidad · Distribución de envíos · Inventario financiero · Costos · Utilidad por card · Resúmenes diarios · Resúmenes mensuales

### Regla de separación de responsabilidades

DAM Vertex **nunca** debe recalcular: Ganancia · Utilidad · CPA · Publicidad distribuida · Envíos distribuidos.

DAM Vertex solo envía datos. Dam Finanzas realiza los cálculos.

### Product Studio — flujo de activación (módulo interno)

Ruta: `/product-studio/` (botón "+ Nuevo producto" en Admin Panel → Productos)

**El brief estructurado es la fuente de verdad.** No editar archivos de forma manual mientras el producto esté en Product Studio.

Flujo obligatorio:
1. Crear en Product Studio → `status='draft'`, `active=0` en D1
2. Completar tabs: Producto → Inventario → Estrategia → Visual
3. Tab Investigación (opcional): analizar URLs de proveedores
4. Tab Sync → "Sincronizar con DAM Finanzas" → llama a `importProductFromVertex`
5. Tab Sync → **"Validar Activación Total"** → corre `/api/product-activation-check` (PASS/WARNING/FAIL por check)
6. Tab Sync → "Activar producto" → `active=1`, `status='active'`
7. Landing: generar blueprint desde el brief (Tab Landing) + crear `public/{slug}/index.html` + deploy manual
8. InSync: instrumentar todas las secciones con triple atributo antes del primer deploy:
   - `id="section-{nombre}"` + `data-insync-section="{nombre}"` en cada `<section>`
   - `data-insync-cta="{nombre}"` en cada CTA, donde `{nombre}` = sección que lo contiene
   - Referencia canónica: `public/reloj-imperial-verde/index.html`
   - **REGLA OBLIGATORIA:** `insync.js` siempre debe referenciarse con `?v=4` o la versión más reciente. `FLUSH_MS` en `public/assets/js/insync.js` debe ser `2000`, nunca `8000`. El `page_view` debe dispararse de forma inmediata (`flush()` sin esperar el batch), no solo encolarse.
9. Correr PRODUCT_COMPLETION_CHECKLIST antes de declarar el producto terminado

Una vez activado: aparece automáticamente en:
- Venta manual WhatsApp (MANUAL_PRODUCTS dinámico desde `/api/product-stock?active_only=1`)
- Home `/` y `/productos/` (cargados dinámicamente desde la misma API)
- Filtros Admin: leads, dashboard, ads, meta (poblados en login desde la API)
- Intelligence: selector InSync (poblado desde la API tras auth)
- Ranking de productos del dashboard (slug como clave, sin ambigüedad por includes())

**Regla permanente — Activación Total:**
> Ningún producto nuevo se considera terminado por tener landing y active=1.
> Todo módulo que liste, filtre, mida, reporte o venda productos debe leer Product Registry o una fuente dinámica equivalente.
> Los hardcodes de productos son deuda técnica y deben eliminarse o marcarse como FAIL en la validación.

### Checklist producto nuevo — 11 puntos obligatorios

No se considera terminado hasta verificar:

1. Existe en Admin Panel. ← Product Studio lo crea
2. Existe en venta manual WhatsApp. ← **automático** al activar (MANUAL_PRODUCTS dinámico desde API)
3. Existe en inventario DAM Vertex. ← Product Studio lo crea
4. Existe en inventario Dam Finanzas. ← Tab Sync → "Sincronizar con DAM Finanzas"
5. Existe en el mapeo producto/variante. ← variants_json en D1 via Product Studio
6. Existe en webhook hacia Dam Finanzas. ← `importProductFromVertex` vía `onAdminSale`
7. Existe en reportes financieros. ← automático si DAM Finanzas vinculado
8. Existe en descuentos de stock. ← automático (confirm-purchase.js usa slug)
9. Existe en combos. ← combos nuevos van como `product_type='combo'` en Product Studio
10. Existe en landing y modal. ← Tab Landing → generar blueprint → deploy manual
11. Landing completamente instrumentada para InSync — triple atributo: `id="section-{nombre}"` + `data-insync-section="{nombre}"` + `data-insync-cta="{nombre}"` en CTAs.
12. Pasó Validación de Activación Total sin FAIL crítico. ← `/api/product-activation-check`
13. Aparece en Home y /productos/ sin deploy manual. ← **automático** (carga dinámica desde API)
14. Aparece en filtros Admin sin código manual. ← **automático** (carga dinámica tras login)
15. Aparece en Intelligence/InSync sin código manual. ← **automático** (carga dinámica tras auth)
16. Tiene nombre abreviado en `PRODUCT_SHORT_NAMES` (`functions/api/leads.js` y `public/assets/js/products.js`) — máximo 3 palabras, sin artículos innecesarios. Se usa en el mensaje de Telegram y en el de WhatsApp del cliente; si el slug no está en el mapa, cae al nombre completo como fallback.

### Regla permanente — PRODUCT COMPLETION CHECKLIST

**Ningún producto nuevo está terminado hasta pasar el PRODUCT_COMPLETION_CHECKLIST completo.**

Ver: `AI_SYSTEM/execution/PRODUCT_COMPLETION_CHECKLIST.md`

El checklist cubre 22 áreas: slug, PRODUCT object, InSync instrumentation, modal, WhatsApp, lead/Telegram, tracking, InitiateCheckout, QualifiedLead, Purchase manual, CAPI, Product Registry, Admin, Dam Finanzas, Stock, Home, /productos, Intelligence, activation check, auditoría final.

No declarar "producto terminado", "listo para activar" ni "listo para deploy" sin haber verificado cada punto de ese checklist.

---

### Regla de cambios en lógica financiera

Antes de modificar lógica financiera:

1. Buscar cómo funciona actualmente.
2. Verificar si ya existe cálculo en Dam Finanzas.
3. Reutilizar la lógica existente.
4. No reescribir cálculos que ya funcionaban.
5. No duplicar lógica financiera entre sistemas.

Si un dato ya existe en Dam Finanzas: NO recalcularlo en DAM Vertex. Enviar únicamente la información necesaria.

---

### Regla de Fecha Operativa

Nunca `new Date().toISOString()`. Siempre:
```javascript
new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(new Date())
```

---

## VARIANTES DE COLOR — Regla de consistencia de formato

**El campo que guarda el color en `leads.js`, el que muestra `admin.js` y el que descuenta `confirm-purchase.js` DEBEN usar exactamente el mismo key/nombre y el mismo formato (array JSON serializado, ej. `'["Rosado"]'`). Verificar esto en cada nueva landing que tenga variantes antes de deployar.**

**Incidente 2026-08:** `admin.js` → `submitEditLead()` (función "Editar lead" del panel) leía `lead.variant` ya convertido a texto legible por `fmtVariant()` (ej. `"Rosado + Rosado"` para 2 unidades) y lo reenviaba **tal cual** al guardar, en vez de re-serializarlo como array JSON. `functions/api/admin-leads.js` (PUT) lo guardaba sin normalizar. Resultado: cualquier edición de un lead con más de 1 unidad o color rompía `parseLeadVariants()` en `confirm-purchase.js` — la validación de stock fallaba con "Modelo no encontrado" (bloqueando la confirmación) o, si el operador reescribía el campo a mano, el descuento de stock por color quedaba mal. Corregido re-serializando `elm-variant.value.split('+')` a `JSON.stringify([...])` antes de enviarlo.

**Al agregar o tocar cualquier flujo que lea o escriba `leads.variant`:**
- El valor almacenado en D1 siempre debe ser un array JSON serializado (`'["Color"]'` o `'["Color1","Color2"]'`), nunca texto plano unido con `" + "` u otro separador legible.
- `parseLeadVariants()` (confirm-purchase.js, manual-whatsapp-sale.js) y `fmtVariant()` (admin.js) son las únicas funciones que deben transformar entre formato-array y formato-legible — cualquier código nuevo que edite `variant` debe volver a serializarlo como array antes de guardarlo, nunca guardar la versión legible de vuelta en D1.
- El formulario "Venta manual" (`msf-` en admin.js, vía `msfGetVariantData()`) ya lo hace correctamente (`JSON.stringify(list)`) — usar como referencia.

## UMBRALES OFICIALES DAM VERTEX

DAM VERTEX Paraguay — clasificación interna de compradores (D1 / Dam Intelligence). **Prohibido modificar sin decisión de negocio explícita documentada aquí.**

> **Cambio 27/08/2026:** `HighValuePurchase`, `VIPPurchase` y `FastBuyer` fueron **eliminados como eventos CAPI** — ya no se envían a Meta desde ningún archivo (antes vivían en `confirm-purchase.js`, removidos por completo). Los umbrales siguen usándose **solo para `buyer_type` interno en D1**, sin señal correspondiente a Meta. Ver "FLUJO DE EVENTOS META — IMPORTANTE".

| Clasificación | Umbral | Evento CAPI | buyer_type D1 |
|---|---|---|---|
| Alto valor | >= 199.000 Gs | ~~`HighValuePurchase`~~ eliminado | `alto_valor` |
| VIP | >= 300.000 Gs | ~~`HighValuePurchase` + `VIPPurchase`~~ eliminado | `vip` |
| Ultra VIP | >= 500.000 Gs | ~~sin CAPI dedicado~~ | `ultra_vip` |
| Fast Buyer | compra en < 24h | ~~`FastBuyer`~~ eliminado | `rapido` |

**Justificación (histórica, sigue aplicando al `buyer_type` interno):** Precio base reloj Gs. 189.000. Con envío express: Gs. 199.000 → intención de compra superior → clasificación Alto Valor.

**Archivos que implementan estos umbrales:**
- `functions/api/intelligence/_bqe-scorer.js` — constantes `ALTO_VALOR_PYG`, `VIP_PYG`, `ULTRA_VIP_PYG`, `FAST_BUYER_H` (sin cambios, siguen clasificando en D1)
- `functions/api/confirm-purchase.js` — ya **no** contiene ninguna condición de `HighValuePurchase`/`VIPPurchase` ni ningún envío a Meta

---

## REGLA CRÍTICA DE DEPLOY — DAM VERTEX

> **Incidente 2026-06:** `wrangler pages deploy .` (raíz) subió estáticos bajo `/public/reloj/`, `/public/cadena/` etc. Landings en 404 en producción. `node_modules` incluido en el upload.

### Único comando correcto — producción

```powershell
& "C:\Program Files\nodejs\npx.cmd" wrangler pages deploy public --project-name=dam-vertex-cloudflare --branch=main --commit-dirty=true
```

### PROHIBIDO usar

- `wrangler pages deploy .` — deploya desde raíz, rompe todas las rutas
- `wrangler pages deploy` — sin directorio explícito usa raíz
- `npx wrangler pages deploy .` — ídem
- Deploy sin `--branch=main` → va a preview (`dam-vertex-cloudflare` branch), no producción
- Deploy sin verificar `pages_build_output_dir = "public"` en wrangler.toml

### Checklist pre-deploy

1. Leer `wrangler.toml` — confirmar `pages_build_output_dir = "public"`
2. Confirmar directorio a deployar: `public/` (no `.` ni raíz)
3. Confirmar `--branch=dam-vertex-cloudflare`
4. Confirmar que `.dev.vars`, `node_modules/`, archivos internos no se suben
5. Confirmar que el Functions bundle se genera correctamente

### Rutas críticas — verificar 200 post-deploy

`/` · `/reloj/` · `/cadena/` · `/admin/` · `/intelligence/`
`/api/admin-leads` · `/api/intelligence/alerts` · `/api/intelligence/ping-telegram`

**Si alguna falla → NO declarar deploy exitoso. Detenerse y corregir.**

### Script de deploy seguro

```powershell
.\scripts\deploy-production.ps1
```

Verifica wrangler.toml, ejecuta deploy correcto, prueba rutas automáticamente.

### Account ID Meta

`act_992345752726304` — cuenta en PYG. No multiplicar spend por tasa USD.

---

---

## CACHÉ — importante

`public/_headers` define `Cache-Control: public, max-age=31536000, immutable` (1 año) para:

- `/assets/css/*.css`, `/assets/js/*.js`
- `/*.webp`, `/*.jpg`, `/*.png` (cualquier ruta, incluye imágenes hero que viven dentro de la carpeta de su propia landing, ej. `/lampara-escritorio-plegable/hero-lampara.webp`)
- `/*.woff2`
- `/favicon.ico`

El HTML (`/*`) y `/api/*` quedan siempre en `no-store` — nunca se cachean, ni en el browser ni en el edge de Cloudflare.

**Regla obligatoria — romper caché al cambiar contenido:**

Con `immutable` + 1 año, un archivo servido bajo estas reglas que cambia de contenido pero mantiene el mismo nombre/URL va a seguir sirviéndose viejo — cacheado en el browser del usuario y en el edge de Cloudflare — hasta por 1 año. Al modificar el contenido de un CSS, JS o imagen ya publicado:

- Si el archivo se referencia con query string de versión (ej. `tracking.js?v=59`, `styles.min.css?v=55`) → bumpear el número (`?v=60`). Esto ya es la convención existente en todas las landings.
- Si el archivo se referencia **sin** query string (ej. `hero-lampara.webp`, cualquier imagen hero nueva) → agregar `?v=2` a la referencia en el HTML, o cambiar el nombre del archivo. Nunca sobrescribir el archivo en el mismo path sin uno de los dos.

No aplica a `/*` (HTML) ni `/api/*` — esos nunca se cachean, se sirven siempre frescos.

---

## LANDINGS — REGLA CRÍTICA DE CREACIÓN

### Flujo obligatorio antes de escribir HTML

No se crea una landing solo desde el brief del producto. El flujo correcto:

```
1. Leer brief completo (nombre, precio, specs, variantes, restricciones)
2. Verificar estado del producto en D1: active, stock_total, variants
3. Revisar InSync de landings existentes relevantes (/reloj/, /cadena/, /lentes/, /cepillo/)
4. Extraer patrones ganadores: orden de secciones, bloques que retienen, ubicación de precio/confianza
5. Proponer ángulo principal, secciones y referencias antes de codear
6. Recién después crear o modificar HTML
```

**No saltar directo a escribir código.**

### Patrones = estructura y psicología. No = plantilla visual literal

**Extraer de InSync histórico:**
- Orden de secciones que retuvo mejor
- Bloques con mayor attention_score y menor abandono
- Posición de precio, pago al recibir, entrega en el día, prueba social

**No copiar entre landings:**
- Colores, paleta, fondo
- Imágenes, variantes, testimonios
- Copy literal o diseño exacto

### Jerarquía brief vs InSync

- **Brief manda sobre:** nombre, precio, specs, variantes, material, oferta
- **InSync manda sobre:** orden de secciones, peso de bloques, ubicación de precio/confianza

### Modal — reglas de coherencia visual (obligatorio por landing)

Toda landing nueva debe cumplir estos 4 puntos en su modal de pedido. **No declarar landing terminada si el modal no los cumple.**

1. **Paleta visual coherente** — el modal usa la misma paleta principal/secundaria de la landing vía clase `.theme-{producto}`. No usar colores genéricos sin override.
2. **3 combos por defecto** — siempre incluir:
   - 1 unidad (sin badge)
   - 2 unidades con badge `Más elegido`
   - 3 unidades con badge `Mayor ahorro`
3. **Badges de combo** — colores coherentes con el color de acento de la landing.
4. **Espaciado consistente** — todos los bloques secundarios (Envío express, Necesito factura, futuros upsells) deben tener el mismo margen entre sí. Prohibido `margin-top` distinto por bloque.
5. **Ahorro en Gs. exactos, nunca porcentaje** — en combos de 2 y 3 unidades (mismo producto), el texto de descuento siempre muestra el monto real: `Ahorrás Gs. 32.250`. Prohibido `"25% OFF"` / `"Ahorrás 25%"` en ese tipo de combo. Cálculo: `(precio unitario × cantidad) − precio del combo`, formateado con puntos de miles. No aplica a combos cruzados de productos distintos (ej. Reloj + Cadena) ni a badges de precio de 1 unidad — esos sí pueden usar porcentaje.
6. **Campo "Horario"** — el modal siempre debe incluir el campo `horario` (`<input id="horario" name="horario">`) debajo del teléfono. Opcional, no bloquea el envío. Se lee en `products.js` (`commonData.horario`) y viaja al mensaje de WhatsApp del cliente y al Telegram (`functions/api/leads.js`) después de Ciudad — solo se muestra la línea si el cliente lo completó.
7. **"Ahorrás Gs. X" en línea propia arriba del precio** — en el bloque de precio del hero (y de cualquier otro lugar de la landing que muestre precio tachado + precio final), el texto de ahorro siempre va en su propia línea **arriba** del bloque de precios — nunca en la misma línea que los precios. Esto es psicología de precio: el cliente ve primero el ahorro, luego el precio, lo que hace que el precio final se perciba más chico. Referencia: `public/cepillo-secador-moldeador-aguacate/index.html` (`.price-savings-top`).

---

### Prueba social — prohibido inventar

- No usar nombres falsos ni "pedido verificado" sin datos reales
- Usar prueba social genérica: "Pedidos activos · Entrega en el día", "Clientes en Central e Interior"
- Si hay testimonios reales: incluirlos con nombre y resultado específico

### Identidad visual — parte del producto, no de otra landing

1. Color y material del producto → paleta base
2. Percepción deseada → tono visual
3. No usar fondo negro por defecto — justificar si se elige
4. No copiar look de otra landing sin justificación de negocio

### Archivos de referencia

```
AI_SYSTEM/skills/insync-cro.md         ← extracción de patrones históricos
AI_SYSTEM/skills/product-studio.md     ← checklist pre-código + regla de testimonios
AI_SYSTEM/skills/pagina-ventas.md      ← frameworks de copy + regla patrones vs copia
```

---

## CARGA CRÍTICA — CSS NO BLOQUEANTE (obligatorio en toda landing nueva)

> **Incidente:** al entrar por primera vez a una landing desde un anuncio de Meta Ads, el navegador in-app de Facebook (WebView) mostraba **"Se produjo un problema al cargar este sitio web"**. Al tocar "Reintentar" (segundo intento) cargaba normal. Confirmado en `luna-mini-vibrador-bala-recargable` (resuelto primero) y luego reproducido en `rizador-automatico-giratorio` y `taza-mezcladora-automatica`.

### Causa exacta

Las landings cargaban `/assets/css/styles.min.css` con un `<link rel="stylesheet">` **síncrono y bloqueante para el render**. Aunque hubiera un `<link rel="preload">` adicional, el preload solo adelanta la descarga — no evita que el navegador bloquee el primer paint esperando ese CSS.

En el primer ingreso desde un anuncio, el WebView de Meta arranca sin caché: sin CDN edge cacheado y sin caché del propio navegador in-app. Esa espera bloqueante por el CSS externo puede superar el timeout interno del WebView, que corta la carga y muestra su pantalla nativa de error. En el segundo intento, tanto el edge de Cloudflare como el navegador ya tienen el CSS cacheado → carga instantáneo → sin error. Esto coincide exactamente con el síntoma ("falla la primera vez, funciona la segunda").

`taza-mezcladora-automatica` ya tenía la mitad de la solución (el CSS cargaba async) pero le faltaba el bloque de CSS crítico inline — sin él, el `<nav>` y el bloque de precio no tienen ningún estilo estructural (flex, sticky, tamaños) hasta que el CSS externo termina de aplicar, porque esas reglas viven *solo* en `styles.min.css`.

### El fix — obligatorio en toda landing nueva desde el primer commit

**1. CSS externo siempre async, nunca `<link rel="stylesheet">` directo:**

```html
<!-- CSS no crítico: preload + swap a stylesheet on load (no bloquea el render) -->
<link rel="preload" href="/assets/css/styles.min.css?v=55" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="/assets/css/styles.min.css?v=55"></noscript>
```

**2. Bloque de CSS crítico inline** — al inicio del `<style>` de la landing, antes del CSS del theme propio (copiar tal cual, son tokens genéricos que el theme de cada landing sobreescribe igual porque ambos bloques son inline y se aplican juntos sin espera de red):

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #e2e8f0; -webkit-font-smoothing: antialiased; }
img { max-width: 100%; display: block; }
a { text-decoration: none; color: inherit; }
:root { --accent: #3b82f6; --green: #4ade80; --muted: rgba(255,255,255,.65); --border: rgba(255,255,255,.08); --radius-sm: 6px; }
.nav { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 0 clamp(20px, 5vw, 48px); height: 60px; background: rgba(0,0,0,.88); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
.nav__logo { font-size: 15px; font-weight: 800; letter-spacing: .04em; color: #fff; }
.nav__logo span { opacity: .45; }
.nav__cta { display: inline-flex; align-items: center; gap: 6px; background: var(--accent); color: #fff; font-size: 13px; font-weight: 700; letter-spacing: .02em; padding: 9px 20px; border-radius: var(--radius-sm); transition: opacity .2s; }
.price-block { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px 12px; margin: 24px 0; }
.price-main { font-size: clamp(28px, 5vw, 38px); font-weight: 800; color: #fff; }
.price-compare { font-size: 16px; color: var(--muted); text-decoration: line-through; }
.price-badge { font-size: 12px; font-weight: 700; background: rgba(74,222,128,.15); color: var(--green); border: 1px solid rgba(74,222,128,.25); border-radius: 4px; padding: 3px 8px; }
```

**Referencia canónica:** `public/luna-mini-vibrador-bala-recargable/index.html` (líneas 14-46). También aplicado en `public/rizador-automatico-giratorio/index.html` y `public/taza-mezcladora-automatica/index.html`.

### Prohibido

- `<link rel="stylesheet" href="/assets/css/styles.min.css?...">` directo en el `<head>` de una landing nueva, aunque tenga un `<link rel="preload">` acompañándolo — el preload no lo vuelve no-bloqueante.
- Declarar una landing "terminada" o "lista para deploy" sin el patrón preload+swap+noscript Y el bloque de CSS crítico inline.
- Confundir esto con un problema de Pixel/CAPI — el error es del WebView de Meta cargando la página, no del tracking. No tocar Pixel/CAPI para "solucionar" este síntoma.

### Verificación

Después de aplicar el fix, confirmar que el Pixel (`ViewContent`) y el CAPI (`/api/meta-event`) siguen disparando igual — este fix no toca `tracking.js` ni el orden de esos scripts, solo el CSS.

---

## CTA — BLINDADO CONTRA FALLOS DE RED

> **Incidente 2026-08:** el botón "LO QUIERO - PEDIR POR WHATSAPP" no respondía en algunas redes WiFi (firewall corporativo, WiFi público restrictivo, filtros DNS) pero sí funcionaba con datos móviles.

### Causa exacta

Los botones `[data-scroll-form]` no tenían `href` ni `onclick` nativo — dependían 100% de JS externo:

1. `tracking.js` y `products.js` cargan con `defer`. Si cualquiera de los dos falla en cargar (bloqueado, timeout), `window.DV` queda incompleto o indefinido.
2. El handler `DOMContentLoaded` de cada landing ejecutaba, sin try/catch: `DV.trackViewContent(PRODUCT); DV.initForm(PRODUCT);` — si la primera línea lanza excepción (`DV` o `DV.trackViewContent` no existe), la segunda línea **nunca se alcanza**.
3. `DV.initForm` es la única función que hace `addEventListener('click', ...)` sobre los botones (`products.js`). Si nunca corre, ningún botón de la página tiene handler — sin error visible, simplemente no responde.
4. El botón del nav era `<a href="#">` (navegación nula sin JS); el resto eran `<button>` sin ningún comportamiento nativo.

Con datos móviles el request a Cloudflare pasa directo; en WiFi restrictivo el script se bloquea o cuelga y el botón queda mudo. El fetch a `/api/product-stock` (chequeo de stock) **no es la causa** — es async con `.catch(()=>{})`, no bloquea el `addEventListener`, que ya corrió antes de que esa promesa se resuelva.

### El fix — obligatorio en toda landing nueva

**1. Todo `[data-scroll-form]` debe tener `href` real de WhatsApp como fallback** (nunca `href="#"`, nunca un `<button>` sin comportamiento nativo — usar `<a>` con la clase `.btn`/`.btn-primary`, que ya se ve idéntica a un `<button>`):

```html
<a class="btn btn-primary" data-scroll-form data-insync-cta="hero"
   href="https://wa.me/595993471550?text=%C2%A1Hola!%20Quiero%20pedir%3A%20{Producto}.%20%C2%BFPodemos%20coordinar%20la%20entrega%3F">
  LO QUIERO - PEDIR POR WHATSAPP
</a>
```

Cuando `products.js` carga bien, su `addEventListener` sigue llamando `e.preventDefault()` y abre el modal normalmente — el `href` real solo actúa como red de seguridad cuando el listener nunca se adjuntó.

**2. El `DOMContentLoaded` de cada landing debe aislar cada llamada a `DV.*` en su propio try/catch:**

```js
document.addEventListener('DOMContentLoaded', () => {
  try { DV.trackViewContent(PRODUCT); } catch (_) {}
  try { DV.initForm(PRODUCT); } catch (_) {}
  ...
});
```

Así, si `tracking.js` falla, `products.js` (si sí cargó) igual se ejecuta e inicializa el modal — un script roto no debe tumbar al resto.

### Prohibido

- `<button data-scroll-form>` sin `<a href>` de respaldo.
- `href="#"` en el CTA del nav — debe ser el link real de WhatsApp.
- Encadenar llamadas a `DV.*` sin try/catch en `DOMContentLoaded` — una excepción en la primera línea mata todas las siguientes.
- Confundir esto con un problema de `/api/product-stock` — ese fetch ya es async y no bloqueante, no es la causa de un botón mudo.

Referencia: `public/rizador-automatico-giratorio/index.html`, `public/taza-mezcladora-automatica/index.html`, `public/lampara-escritorio-plegable/index.html`.

---

## STOCK — RE-SYNC AUTOMÁTICO A DAM FINANZAS

> **Incidente 2026-08:** un ajuste manual de stock en D1 (vía Product Studio o el grid de Productos del Admin Panel) dejó Dam Finanzas desalineado (+1 unidad por color) hasta la próxima sincronización manual — ver diagnóstico completo del caso taza-mezcladora-automatica.

### Causa

`mirrorOpToProducts()` (Product Studio, `functions/api/product-registry.js`) y el `PATCH` de `functions/api/product-stock.js` (Admin Panel) escriben `stock_total`/`variants_json` directo en D1, pero nunca avisaban a Dam Finanzas. La única forma de propagar el cambio era apretar manualmente "Sincronizar con DAM Finanzas" en Product Studio.

### El fix

`functions/_lib/damFinanzasSync.js` exporta `autoResyncToFinanzas(slug, env)` — mismo endpoint y payload que el botón manual (`POST importProductFromVertex` con `x-dam-vertex-secret`), pero:

- **Solo si el producto ya está vinculado** (`product_briefs.dam_finanzas_status === 'linked'`) — si nunca se sincronizó, no hace nada; eso sigue siendo una acción manual explícita.
- **En background** (`waitUntil`), nunca bloquea ni hace fallar la respuesta del PATCH que guarda el stock — D1 ya quedó guardado antes de intentar el re-sync, y es la fuente de verdad.
- Si el re-sync falla, marca `dam_finanzas_status='failed'` con una nota (mismo criterio que el sync manual) para que quede visible que hace falta re-sincronizar a mano.

Se llama desde ambos puntos de ajuste manual:
- `product-registry.js` → `onRequestPatch`, cuando el body incluye `op_json` (Product Studio, tab Inventario).
- `product-stock.js` → `onRequestPatch` (Admin Panel, grid de Productos: `updateTotalStock`, `updateVariantStock`, `toggleProductActive` en `admin.js`).

### Prohibido

- Llamar a `autoResyncToFinanzas` de forma bloqueante (sin `waitUntil`) — un stock guardado en D1 no debe esperar ni depender de que Dam Finanzas responda.
- Disparar el re-sync para productos con `dam_finanzas_status` distinto de `'linked'` — crearía un producto nuevo en Dam Finanzas sin que nadie lo haya pedido.
- Duplicar esta lógica en cada endpoint — siempre importar desde `_lib/damFinanzasSync.js`.

---

## DCANP GROUP — Flujo especial

Columna `products.platform` (`DAM_VERTEX` default | `DCANP_GROUP`, `migrate35.sql`) distingue el catálogo normal de los productos del sub-brand DCANP GROUP.

- **Landings DCANP usan `/api/dcanp-lead` — NO `/api/leads`.** Endpoint completamente independiente, no escribe en D1 (ni `leads` ni `products`).
- **Sin admin panel, sin WhatsApp del cliente, con pantalla de agradecimiento** — el modal DCANP no abre WhatsApp al enviar; muestra un bloque `.dcanp-success` en su lugar. Los pedidos DCANP nunca aparecen en el Admin Panel de leads.
- Notificación equivalente a `leads.js` pero con prefijo `[DCANP GROUP]` en Telegram, más Meta CAPI Purchase (mismos campos hasheados) y una fila en Google Sheets.
- **Google Sheets via webhook en variable `DCANP_SHEETS_WEBHOOK_URL`** (Apps Script, no Sheets API v4 + Service Account) — si falta, loguea error y sigue sin romper el flujo; `/api/dcanp-lead` siempre responde `{ ok: true }`.
- **Campo Horario NO aplica en landings DCANP** — el modal DCANP no lo incluye (ver AI_SYSTEM/skills/product-studio.md "Modal — Campo Horario", que sí es obligatorio para el resto del catálogo).
- Product Studio muestra badge `[DCANP]` azul junto al nombre cuando `platform='DCANP_GROUP'`, con filtro por plataforma en el sidebar.
- Referencia: `public/tabla-marmol/index.html` y `public/estante-aluminio-bano/index.html`, `functions/api/dcanp-lead.js`.

---

## PROTECCIÓN DE CONTENIDO EN LANDINGS

Toda landing nueva debe incluir `<script src='/assets/js/protect.js?v=VERSION'></script>` antes de `</body>` (bumpear `VERSION` junto con `site-version.js`).

No agregar este script en `public/admin/` ni en `public/intelligence/` — bloquearía el uso normal de DevTools/clic derecho que esos paneles necesitan para operación interna.

El script de protección solo aplica en desktop — en mobile se desactiva automáticamente por detección de userAgent y touch points.

---

## REGLA CRÍTICA — Señales Meta CAPI en toda landing nueva

Toda landing nueva DEBE cumplir estos requisitos antes de considerarse terminada.

### CHECKLIST DE SEÑALES META

- `tracking.js` cargado antes del submit (via `<script defer>` o antes del cierre de `</body>`)
- `getClientData()` llamado en el momento del submit (no antes — para dar tiempo al pixel de setear `_fbp`)
- `fbp` y `fbc` incluidos en el POST a `/api/leads` (`client.fbp || null` y `client.fbc || null`)
- `ip` y `user_agent` se capturan automáticamente en el servidor — no requieren acción en el frontend
- Si el formulario tiene campo email → incluirlo en el POST; **nunca hardcodear `email: ''`**
- `product_slug` correcto en el POST (debe coincidir con `products.slug` en D1)
- `value` correcto en el POST (precio real seleccionado por el usuario, no `0` ni valor fijo hardcodeado)

### PROHIBIDO

- `email: ''` hardcodeado — si no hay campo email en el formulario, **omitir el campo completamente** del POST
- `fbp: client.fbp || ''` — nunca enviar string vacío; usar `client.fbp || null`
- `fbc: client.fbc || ''` — ídem; usar `client.fbc || null`
- Llamar `getClientData()` al cargar la página o al abrir el modal — debe ser en el submit handler

### Estado actual (2026-06)

- `tracking.js` ya implementa `getCookie('_fbp')`, `getFbc()` y `getClientData()` correctamente
- `products.js` y los submits inline de cadena/reloj ya usan `client.fbp || ''` — **pendiente migrar a `|| null`**
- `functions/api/leads.js` ya guarda `fbp` y `fbc` en D1 con `fbp || null`
- `functions/api/confirm-purchase.js` ya lee fbp/fbc de D1 e incluye en el evento Purchase CAPI

---

## REGLA — Customer Data para ViewContent

Después de cualquier submit exitoso de formulario en una landing:

1. Llamar `DV.saveLeadDataLocal(phone, name, email)` de `tracking.js`.
2. Esto enriquece automáticamente el próximo `ViewContent` de esa persona (vía `lead_hashed` en `/api/meta-event`).
3. **`saveLeadDataLocal` hashea con SHA-256 antes de guardar — nunca persistir phone/name/email en crudo en localStorage.** Solo se guarda el hash; Meta recibe el mismo hash de cualquier forma, así que el match quality es idéntico. Guardar el dato real sin hashear expondría PII de cada visitante ante XSS o browsers compartidos durante 90 días — no hacerlo nunca, sin excepción.
4. Los datos expiran automáticamente a los 90 días.
5. Toda landing nueva debe incluir esta llamada después del submit exitoso — si usa el formulario compartido (`DV.initForm` de `products.js`), ya está cubierto automáticamente y no requiere código adicional por landing.

### Causa real de match quality baja

La calidad de coincidencias en Meta Events Manager puede ser baja por:

1. **Adblocker del usuario** → Meta pixel no carga → `_fbp` cookie no se setea → NULL en D1
2. **Tráfico sin fbclid** (orgánico, directo, WhatsApp) → `_fbc` nunca se genera → NULL en D1
3. **Email no recolectado** → `em` ausente del payload CAPI (impacto alto en match quality)

Estos son límites del modelo de negocio (COD sin email), no bugs de código.

---

## CAPI — user_data obligatorio en todos los eventos

Todo evento enviado a Meta CAPI (`ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`) DEBE incluir al menos un campo de identidad en `user_data` además de `client_ip_address` y `client_user_agent`. IP + user agent solos no le alcanzan a Meta para hacer atribución ni optimización de campaña — un evento sin ningún campo de identidad (`external_id`, `ph`, `em`, `fn`, `ln`) es señal débil y degrada la entrega.

### Por momento del flujo

**Eventos pre-formulario** (`ViewContent`, `AddToCart`, `InitiateCheckout`) — se disparan antes de que el usuario complete el formulario, así que no hay teléfono/nombre/email todavía. Usar:
- `external_id_hashed` — SHA-256 de `_dv_anon_id`, un ID anónimo persistente en `localStorage` generado por `getOrCreateAnonId()` en `tracking.js`
- `lead_hashed` (vía `DV.getLeadDataLocal()`) si el visitante ya completó un formulario en una visita anterior — tiene prioridad sobre el ID anónimo
- `fbp`/`fbc` siempre que estén disponibles — no dependen del formulario, son complementarios a `external_id`, no sustitutos

**`Purchase`** (desde el 27/08/2026, se dispara al crear el lead en `functions/api/leads.js` — ver "FLUJO DE EVENTOS META — IMPORTANTE" más abajo): usa los datos reales del formulario recién enviado, hasheados — teléfono (`ph` + `external_id`), nombre (`fn`/`ln`), ciudad (`ct`), más `anon_id_hashed` como valor adicional de `external_id`.

### Prohibido

- Mandar cualquier evento CAPI con `user_data` que tenga solo `client_ip_address`/`client_user_agent` (± `fbp`/`fbc`) sin ningún campo de identidad, cuando existe una fuente disponible para ese momento del flujo (ID anónimo antes del formulario, datos reales después).
- Confundir esto con la regla de `fbp`/`fbc` de la sección anterior — son señales complementarias, no intercambiables: `external_id`/`lead_hashed` es sobre identidad, `fbp`/`fbc` es sobre atribución de click/sesión.

### Antecedente

Meta marcó el 12/08/2026 que `ViewContent`, `AddToCart` e `InitiateCheckout` se enviaban sin ningún campo de identidad útil (solo IP/UA), degradando atribución y optimización. Corregido el mismo día agregando `external_id_hashed` en `tracking.js` + `functions/api/meta-event.js`. **Aclaración importante:** este problema de señal NO es la causa confirmada de la caída de pedidos del 11-12/08 — esa caída se diagnosticó por separado (cruce Meta Ads + D1 + InSync) y su causa real fue la eliminación de 8 leads de D1 el día 11 antes de poder trabajarlos, no un problema de tracking. No repetir esa asociación causal sin evidencia — son dos hallazgos distintos del mismo período.

---

## FLUJO DE EVENTOS META — IMPORTANTE

**Cambio de flujo crítico, 27/08/2026 — decisión de negocio explícita del usuario, con autorización confirmada tras advertencia de riesgo (Meta va a optimizar por leads en vez de ventas confirmadas; ROAS real vía `purchased_manual` deja de coincidir con lo que Meta ve como "Purchase"; eventos ya enviados a Meta son irreversibles).**

- **`Purchase` se dispara cuando el lead SE CREA**, en `functions/api/leads.js` (al caer el pedido desde la landing) — no más al confirmar entrega. Mismos parámetros que tenía antes en `confirm-purchase.js`: `value`, `currency='PYG'`, `event_id = pur_{slug}_{timestamp}_{random}`, `user_data` con `ph`/`fn`/`ln`/`ct`/`country` hasheados + `external_id` (real si hay teléfono, `anon_id_hashed` como valor adicional). Best-effort en `waitUntil` — si falla, no rompe la creación del lead.
- **`confirm-purchase.js` NO envía ningún evento a Meta.** El botón "Confirmar compra" del Admin Panel sigue existiendo y sigue haciendo todo lo demás — `UPDATE` de `status` en D1, descuento de stock, webhook a Dam Finanzas, desbloqueo de cliente — pero es 100% interno, sin ninguna señal hacia Meta. El texto del `confirm()` del botón en `admin.js` ya no dice "Esto enviará el evento Purchase a Meta" — dice explícitamente que no envía nada.
- **`QualifiedLead` fue eliminado del sistema** — ya no se dispara desde ningún archivo.
- **`HighValuePurchase`, `VIPPurchase`, `FastBuyer`, `ComboBuyer` fueron eliminados del sistema** — ya no se disparan desde ningún archivo. Los umbrales que los definían siguen usándose solo para `buyer_type` interno en D1 (ver "UMBRALES OFICIALES DAM VERTEX").
- **`ViewContent`, `AddToCart`, `InitiateCheckout` no cambiaron** — siguen disparándose igual desde `tracking.js`, con el mismo `event_id` compartido Pixel↔CAPI.

**Consecuencia asumida explícitamente por el usuario:** Meta ahora recibe `Purchase` para el 100% de los leads que caen (incluyendo los que después quedan `pending`, se cancelan o nunca se cobran) — no solo para las ventas confirmadas y entregadas. `status='purchased'` en D1 sigue siendo la única fuente de verdad para ROAS real y reportes — el evento Purchase que le llega a Meta ya no representa lo mismo que esa columna.

**No revertir este código a "Purchase en confirm-purchase.js" sin autorización explícita del usuario** — y si se revierte, tener en cuenta que la cuenta de Meta va a tener mezclados en su historial: eventos Purchase-por-lead (de este período) y eventos Purchase-por-confirmación (de antes y de después de revertir). Cada evento ya enviado a Meta es permanente, sin forma de retirarlo.

---

Para contexto completo del proyecto, skills y routing: leer `gemini.md`.
