# REGLA OPERATIVA — Nuevo Producto DAM Vertex + DAM Finanzas

## Activación

Cuando el usuario diga "quiero agregar un nuevo producto", "nuevo producto", "crear landing para X", o cualquier variante → ejecutar este flujo completo. No preguntar por la arquitectura. Solo pedir los datos del producto que falten.

---

## Paso 0 — Datos obligatorios antes de tocar código

No inventar. Preguntar si no se especificaron:

| Dato | Requerido |
|------|-----------|
| Nombre público del producto | ✓ |
| Slug del producto | ✓ |
| Precio de venta base | ✓ |
| Costo unitario | ✓ |
| Stock inicial total | ✓ |
| Stock mínimo para alerta | ✓ |
| ¿Tiene variantes? | ✓ |
| Si tiene variantes: nombre, stock, precio, costo por variante | si aplica |
| Combos: 1u / 2u / 3u / combo con otro producto | ✓ |
| Landing donde vivirá | ✓ |
| Flujo WhatsApp / forma de pedido | ✓ |
| Pago contraentrega o adelantado | ✓ |
| Lógica especial (si existe) | si aplica |

---

## Paso 1 — DAM Vertex (sistema comercial)

Agregar el producto en TODOS los lugares donde el sistema espera productos:

- [ ] Landing pública (imágenes en WebP — convertir si se recibe JPG/PNG) **→ ver Paso 1B**
- [ ] Landing vELOZ si aplica
- [ ] Modal de compra
- [ ] Combos del modal (preselección desde landing)
- [ ] Selector de producto del Admin Panel
- [ ] Venta manual WhatsApp
- [ ] Flujos de confirmación
- [ ] Sistema de variantes
- [ ] Sistema de stock (Cloudflare D1)
- [ ] Payload enviado a Dam Finanzas vía webhook
- [ ] Mapeo `productSlug` / `productName` / `variantName`
- [ ] Integraciones con `onAdminSale`
- [ ] Documentación interna

Si el reloj aparece en 10 lugares, el nuevo producto debe aparecer en esos mismos 10 lugares.

---

## Paso 1B — Instrumentación InSync (obligatorio antes del primer deploy)

**Regla completa:** `AI_SYSTEM/execution/landing-insync-instrumentation.md`

Toda sección visual de la landing debe tener un `id` único. Sin ID, InSync no puede registrar `section_view` ni `section_time` para esa sección.

Verificar antes de deploy:

- [ ] Hero tiene `id="section-hero"`
- [ ] Cada sección de contenido principal tiene ID descriptivo
- [ ] FAQ tiene `id="section-faq"`
- [ ] Cierre / CTA final tiene `id="section-cierre"`
- [ ] No existe ningún `<section class="...">` sin `id` (salvo secciones ocultas con `display:none`)

**PROHIBIDO hacer deploy de una landing nueva sin completar este paso.**

---

### Combos obligatorios en landing y modal

```
Landing → cliente elige "combo 2 unidades"
→ abre modal
→ modal ya llega preseleccionado con ese combo
→ precio correcto
→ cantidad correcta
→ producto/variante correcta
→ envía a WhatsApp / admin panel sin romper tracking
```

---

## Paso 2 — DAM Finanzas (sistema financiero)

Registrar el producto en inventario con campos mínimos:

```
nombre del producto
costo unitario
precio de venta base
stock general
alerta cuando queden X unidades
variantes (si aplica)
stock por variante (si aplica)
adminProductSlug (para mapeo con DAM Vertex)
```

Si DAM Vertex tiene variantes → DAM Finanzas debe reflejar esas mismas variantes.

---

## Paso 3 — Integración webhook onAdminSale

Toda venta confirmada desde DAM Vertex debe enviar a DAM Finanzas:

```json
{
  "adminOrderId": "único por venta",
  "productSlug": "slug-del-producto",
  "productName": "Nombre Público",
  "variantName": "Negro",
  "quantity": 1,
  "salePrice": 150000,
  "operationalDate": "2026-06-05",
  "purchasedAt": 1780000000000,
  "sourceSystem": "DAM_VERTEX"
}
```

DAM Finanzas debe:
- [ ] Crear reporte con `kind` correcto (no day_summary)
- [ ] Descontar stock (variante correcta)
- [ ] Actualizar Pedidos del día (`shopifyOrdersTotal`)
- [ ] Respetar `operationalDate` en `America/Asuncion` (no UTC)
- [ ] Notificar venta confirmada (push)
- [ ] Evitar duplicados por `adminOrderId`

---

## Paso 4 — Fecha operativa (regla crítica)

**Nunca usar UTC directo para fecha de negocio.**

```javascript
// CORRECTO
new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(new Date())

// INCORRECTO
new Date().toISOString().slice(0, 10)    // UTC, no Paraguay
```

Si una venta cae a las 00:20 PY del 5 de junio → debe registrarse como `2026-06-05`.

---

## Paso 5 — Publicidad del día

`syncMetaDailyAds` escribe automáticamente en:
```
users/{DAM_OWNER_UID}/reports/rds:YYYY-MM-DD
```

Campos requeridos para que la UI lo reconozca:
```javascript
{
  kind: "day_summary",   // OBLIGATORIO — sin esto la UI ignora el documento
  date: "YYYY-MM-DD",    // OBLIGATORIO — para getDaySummaryByDate()
  adsTotal: NUMBER,      // en PYG (cuenta en guaraníes, no convertir)
  _metaCurrency: "PYG",
  _metaRawSpend: NUMBER,
  _metaAutoFilled: true
}
```

**Regla:** No reinventar cálculo financiero que ya existe en DAM Finanzas.

---

## Paso 6 — Pruebas obligatorias antes de entregar

### A. Landing
- [ ] Carga bien
- [ ] Modal abre
- [ ] Combo preselecciona
- [ ] Variante correcta
- [ ] Precio correcto
- [ ] Todas las secciones visibles tienen `id` (verificar con DevTools o grep `<section class=` sin `id=`)

### B. Admin Panel
- [ ] Producto aparece en selector
- [ ] Variante aparece
- [ ] Venta manual WhatsApp funciona
- [ ] Marcar comprado funciona

### C. DAM Finanzas
- [ ] Producto en inventario
- [ ] Variante en inventario (si aplica)
- [ ] Reporte se crea
- [ ] Stock descuenta
- [ ] Pedidos del día sube
- [ ] Ganancia se calcula
- [ ] Publicidad se reparte entre cards
- [ ] Envío se reparte por fecha
- [ ] Notificación push se dispara

### D. Duplicados
- [ ] Repetir mismo `adminOrderId` no genera reporte duplicado

### E. Fecha
- [ ] Venta post-medianoche Paraguay cae en fecha correcta

---

## Paso 7 — Limpieza de pruebas

Nunca dejar pruebas fake vivas.

Si se crearon reportes test:
- Eliminarlos de Firestore
- Reponer stock descontado
- Borrar logs si corresponde
- Documentar qué se limpió

**No hacer pruebas que descuenten stock real sin avisar al usuario.**

---

## Envíos / Delivery

El panel Envíos distribuye entre ventas `purchased` de una fecha:

```
totalShipping / count(ventas compradas del día) = shipping por venta
```

- Siempre respetar la fecha seleccionada (no la fecha actual)
- Hoy / Ayer / fecha manual / Todos para historial

---

## Notificaciones

Cuando `onAdminSale` procesa una venta externa desde DAM Vertex:

```
Título: Venta confirmada
Body: {ProductName} · {VariantName} registrado en Dam Finanzas
```

Reglas:
- Solo ventas externas desde DAM Vertex (`sourceSystem: "DAM_VERTEX"`)
- No notificar si el reporte se crea manualmente dentro de DAM Finanzas
- Evitar duplicados por `adminOrderId` (lease idempotency check)
