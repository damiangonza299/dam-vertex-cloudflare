---
name: product-studio
description: "Skill operacional para gestión completa del ciclo de vida de productos en DAM Vertex. Cubre creación, configuración, activación, Blueprint V3 de landing e instrumentación InSync. Cargar cuando se trabaja en productos nuevos o edición de existentes."
allowed-tools: Read Write Edit Glob Grep Bash
metadata:
  type: skill
  version: "1.0"
  author: DAM Vertex AI System
---

# Product Studio — Constructor Comercial Real

Product Studio no es un mockup. Es el constructor que determina qué se vende, cómo se vende y con qué landing se convierte. Un producto mal configurado en PS implica stock mal rastreado, ventas manuales rotas y CAPI sin datos.

---

## Cuándo Usar Este Skill

- Crear un producto nuevo
- Editar configuración de un producto existente
- Generar landing Blueprint V3 desde el brief
- Instrumentar InSync en una landing nueva o existente
- Investigar proveedor o referencia de producto desde PS
- Sincronizar producto con Dam Finanzas

---

## Reglas Antes de Tocar Product Studio

1. Verificar si el producto ya existe en D1: `SELECT * FROM products WHERE slug = ?`
2. No editar archivos de landing manualmente si el producto está en `status='draft'` en PS
3. No activar un producto sin completar los 11 puntos del checklist
4. No usar texto crudo de Alibaba/proveedor como copy final — siempre adaptar al mercado paraguayo
5. No crear variantes sin definir el `variants_json` correctamente en D1

---

## Flujo Obligatorio — 7 Tabs

```
Tab 1: Producto
  → Nombre, slug, descripción, precio, categoría
  → Status = 'draft', active = 0 al crear
  → No activar hasta completar todos los tabs

Tab 2: Inventario
  → stock_total, variants_json
  → Formato variants_json: { "Negro": 10, "Blanco": 8 }
  → variants_meta_json: { "Negro": { "variantId": "v1" } }

Tab 3: Estrategia
  → Precio con envío, precio express, precio combo
  → Umbrales de clasificación (alto valor, VIP)
  → Argumento diferenciador principal

Tab 4: Visual
  → Referencias de imagen
  → Paleta, tono visual, tipo de creative

Tab 5: Investigación (opcional)
  → Pegar URL de proveedor → PS analiza specs
  → Nunca copiar el copy del proveedor directamente

Tab 6: Sync
  → "Sincronizar con DAM Finanzas" → llama a importProductFromVertex
  → "Activar producto" → active = 1, status = 'active'
  → Verificar que onAdminSale esté mapeado en Dam Finanzas

Tab 7: Landing
  → Generar Blueprint V3 desde el brief estructurado
  → Blueprint es la fuente de verdad para la landing
```

---

## Skills Visuales — Obligatorias Antes de Generar HTML

Antes de escribir o modificar cualquier landing, cargar y aplicar estas 4 skills:

| Skill | Archivo | Propósito |
|---|---|---|
| Frontend Design | `AI_SYSTEM/skills/frontend-design.md` | Grid, tipografía, espaciado, performance |
| UI/UX Pro Max | `AI_SYSTEM/skills/ui-ux-pro-max.md` | CRO, flujo de decisión, modal, CTAs |
| Animate | `AI_SYSTEM/skills/animate.md` | Scroll fade-in, hover, microinteracciones |
| Web Design Guidelines | `AI_SYSTEM/skills/web-design-guidelines.md` | Consistencia visual, tokens, temas |

**Regla:** Ninguna landing nueva se genera sin haber consultado estas 4 skills.

---

## Blueprint V3 — Estructura de Landing Profesional

Blueprint V3 define exactamente qué va en cada sección. No improvisar.

### Secciones Obligatorias (en orden)

```
1. HERO
   - Headline: promesa principal (beneficio concreto, no feature)
   - Subheadline: mecanismo o diferenciador
   - Imagen/video del producto
   - CTA primario a WhatsApp (visible sin scroll)
   - Indicador de urgencia o escasez si aplica

2. PROBLEMA
   - Agitar el dolor sin que el cliente lo haya nombrado
   - No usar lenguaje genérico ("te sentís mal")
   - Específico al mercado paraguayo

3. SOLUCIÓN / MECANISMO
   - Cómo el producto resuelve, no qué es el producto
   - Comparativa implícita con alternativas

4. PRUEBA SOCIAL
   - Testimonios reales o casos de uso
   - En Paraguay: vecindad, ciudad, contexto recognoscible
   - No inventar testimonios

5. OFERTA
   - Precio claro, sin letra chica
   - Variantes si aplica
   - Envío: gratuito a Central, Interior con condición
   - Garantía si existe

6. CTA FINAL
   - WhatsApp con texto pre-cargado
   - No más de un CTA por fold

7. FAQ
   - Máximo 4-5 preguntas
   - Las reales que ya aparecen en WhatsApp
```

### Reglas de Copy para Paraguay

- Corto > largo. El cliente paraguayo no lee bloques.
- "Pagás cuando recibís" si es Central — aclararlo siempre
- Precio en Gs. siempre (no USD)
- No usar anglicismos innecesarios
- CTA directo: "Pedí al WhatsApp" no "Contáctenos"

---

## InSync — Instrumentación Obligatoria (triple atributo)

Regla completa: `AI_SYSTEM/execution/landing-insync-instrumentation.md`

Referencia canónica: `public/reloj-imperial-verde/index.html`

Toda sección visible debe tener los tres atributos antes del primer deploy:

```html
<section id="section-hero" data-insync-section="hero">
  <button data-scroll-form data-insync-cta="hero">Elegir mi modelo →</button>
</section>

<section id="section-beneficios" data-insync-section="beneficios">
  <button data-scroll-form data-insync-cta="beneficios">Quiero el mío →</button>
</section>

<section id="section-faq" data-insync-section="faq">...</section>

<section id="section-cierre" data-insync-section="cierre">
  <button data-scroll-form data-insync-cta="cierre">Pedí al WhatsApp →</button>
</section>
```

**Reglas:**
- `id="section-{nombre}"` — InSync observa vía `section[id]`
- `data-insync-section="{nombre}"` — define el nombre exacto en `behavior_events.section`
- `data-insync-cta="{nombre}"` — debe coincidir con `data-insync-section` de la sección que lo contiene. Si no coincide, el CTA enrichment del Structure Engine queda roto.
- Excepciones: `data-insync-cta="nav"` (navbar) y `data-insync-cta="sticky"` (sticky bar) son válidos fuera de secciones.
- **NO** usar `data-insync-cta="oferta"` — valor genérico que no mapea a ninguna sección.

Para leer datos InSync post-lanzamiento → cargar `skills/insync-cro.md`.

---

## Checklist de Activación — No Activar Sin Completar

| # | Punto | Automatizado |
|---|---|---|
| 1 | Existe en Admin Panel | ✅ PS lo crea |
| 2 | Existe en venta manual WhatsApp | ✅ automático al activar |
| 3 | Existe en inventario DAM Vertex | ✅ PS lo crea |
| 4 | Existe en inventario Dam Finanzas | Tab Sync → "Sincronizar" |
| 5 | Existe en mapeo producto/variante (variants_json) | Tab Inventario |
| 6 | Existe en webhook hacia Dam Finanzas (onAdminSale) | Tab Sync → verificar |
| 7 | Existe en reportes financieros | ✅ automático si synced |
| 8 | Existe en descuentos de stock (confirm-purchase.js slug map) | ✅ automático por slug |
| 9 | Existe en combos si aplica (product_type='combo') | Tab Producto |
| 10 | Landing desplegada y funcionando | `public/{slug}/index.html` + deploy manual |
| 11 | Landing completamente instrumentada para InSync | Triple atributo en cada sección |

**Regla permanente: ningún producto está terminado hasta pasar el PRODUCT_COMPLETION_CHECKLIST completo.**

Ver: `AI_SYSTEM/execution/PRODUCT_COMPLETION_CHECKLIST.md`

---

## Archivos Clave a Verificar Antes de Tocar PS

```
functions/api/confirm-purchase.js   → getProductSlug() MAP — agregar slug nuevo si es necesario
functions/api/product-stock.js      → cómo se sirven productos activos
public/admin/index.html             → MANUAL_PRODUCTS: dinámico desde /api/product-stock?active_only=1
```

---

## Anti-Patrones

- **NO** activar producto sin landing desplegada
- **NO** usar texto del proveedor sin adaptar
- **NO** crear variantes sin `variants_json` correcto — stock queda sin control
- **NO** editar landing manual mientras producto está en draft — usar Tab Landing
- **NO** sincronizar con Dam Finanzas más de una vez el mismo producto (duplica inventario)
- **NO** cambiar el slug de un producto activo — rompe confirm-purchase.js y Dam Finanzas
- **NO** usar modal con colores genéricos sin override — cada landing define `.theme-{producto}` con la paleta del producto
- **NO** crear modal con solo 2 combos — 3 combos es el estándar: 1 unidad / 2 unidades "Más elegido" / 3 unidades "Mayor ahorro" (ver PRODUCT_COMPLETION_CHECKLIST, punto 6b)

---

## Checklist Pre-Código — Obligatorio antes de escribir HTML

Antes de crear o modificar cualquier landing, ejecutar en orden:

```
1. Leer el brief completo — nombre, precio, specs, variantes, restricciones
2. Verificar estado del producto en D1: active, stock_total, variants
3. Revisar landings existentes relevantes (mismo producto o categoría)
4. Consultar InSync histórico si hay datos suficientes (> 50 sesiones)
5. Extraer patrones ganadores — función comercial, no contenido literal
6. Proponer brevemente:
   - Ángulo principal recomendado (TRANSFORMACION / REGALO / STATUS / PRECIO)
   - Secciones a incluir y su orden
   - Secciones a evitar según InSync o lógica comercial
   - Referencias usadas y por qué
7. Esperar aprobación o proceder si el cambio es claramente seguro
8. Recién después escribir o modificar HTML
```

**No saltar directo a escribir código. Pasos 1-7 son obligatorios.**

### Prueba social — regla de testimonios

- **No inventar testimonios** con nombres, ciudades o "pedido verificado" falsos
- Si no hay testimonios reales: usar prueba social genérica no falsificable:
  - "Pedidos activos · Entrega en el día"
  - "Clientes en Asunción, Central e Interior"
  - "Pago al recibir en Central"
  - Contadores de pedidos si los datos lo respaldan
- Si hay testimonios reales: incluir nombre real, ciudad y resultado específico
- "Excelente producto" sin resultado no vende y no va

### Identidad visual — regla por producto

Cada landing nueva parte del producto actual, no de una landing anterior:

1. Color y material del producto → paleta base
2. Percepción deseada (premium/casual/masculino/funcional) → tono visual
3. Precio y audiencia → densidad visual y ritmo
4. NO usar fondo negro por defecto — justificar si se elige
5. NO copiar look de otra landing salvo que el producto lo justifique explícitamente
