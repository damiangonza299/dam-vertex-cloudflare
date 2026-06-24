# Dam Vertex — Cloudflare Pages

Sitio independiente con landings, formularios, CAPI Meta, panel admin, Dam Intelligence y Product Studio.

---

## Setup paso a paso

### 1. Instalar dependencias

```bash
cd dam-vertex-cloudflare
npm install
```

### 2. Crear la base de datos D1

```bash
npm run db:create
```

Copiá el `database_id` que aparece en la consola y pegalo en `wrangler.toml`:

```toml
database_id = "el-id-que-copiaste"
```

### 3. Crear las tablas

```bash
# Local
npm run db:migrate

# Producción (después del primer deploy)
npm run db:migrate:remote
```

### 4. Configurar variables de entorno

En Cloudflare Pages → Settings → Environment variables, agregar:

| Variable               | Valor                        |
|------------------------|------------------------------|
| `META_ACCESS_TOKEN`    | Tu token de acceso de Meta   |
| `META_PIXEL_ID`        | `1502854450830084`           |
| `META_TEST_EVENT_CODE` | `TEST8761` (solo en staging) |
| `ADMIN_PASSWORD`       | Contraseña para el panel     |
| `WHATSAPP_NUMBER`      | `595993471550`               |

### 5. Dev local

```bash
npm run dev
```

Visitar: http://localhost:8788

### 6. Deploy

```powershell
.\scripts\deploy-production.ps1
```

> ⚠️ **NO usar `wrangler pages deploy .`** — deploya desde raíz y rompe todas las rutas. El script verifica automáticamente el directorio correcto (`public/`).

---

## Estructura

```
public/
  index.html                        → Home / grid de productos
  productos/index.html              → Listado productos
  reloj/index.html                  → Landing reloj Blackout
  cadena/index.html                 → Landing cadena Apex
  cepillo/index.html                → Landing cepillo eléctrico
  lentes/index.html                 → Landing lentes anti luz azul
  reloj-imperial-verde/index.html   → Landing reloj Imperial Verde
  luna-mini-vibrador/index.html     → Landing Luna Mini
  admin/index.html                  → Panel admin (protegido por password)
  intelligence/index.html           → Dam Intelligence (scoring, alertas, CRO)
  product-studio/index.html         → Product Studio (workspace de productos)
  privacy/index.html                → Política de privacidad
  404.html                          → Página de error personalizada
  sitemap.xml                       → Sitemap SEO
  robots.txt                        → Robots SEO
  assets/
    css/styles.css                  → Estilos globales
    js/tracking.js                  → Pixel + CAPI
    js/products.js                  → Formulario + WhatsApp
    js/admin.js                     → Panel admin (todos los tabs)
    js/insync.js                    → InSync behavioral analytics
    js/location-picker.js           → Google Places autocomplete
    js/site-version.js              → Versión del sitio (cache busting)
    img/                            → Imágenes locales

functions/api/
  leads.js                          → POST /api/leads (guardar lead)
  meta-event.js                     → POST /api/meta-event (CAPI proxy)
  confirm-purchase.js               → POST /api/confirm-purchase (admin)
  admin-leads.js                    → GET/PATCH /api/admin-leads (admin)
  admin-leads-count.js              → GET /api/admin-leads-count
  manual-whatsapp-sale.js           → POST /api/manual-whatsapp-sale
  product-stock.js                  → GET /api/product-stock
  product-registry.js               → GET/POST/PATCH /api/product-registry
  product-research.js               → POST /api/product-research
  product-activation-check.js       → POST /api/product-activation-check
  blocked-customers.js              → GET/POST/DELETE /api/blocked-customers
  delivery-shipping.js              → GET/POST /api/delivery-shipping
  insync.js                         → POST /api/insync (behavioral events)
  insync-report.js                  → GET /api/insync-report

functions/api/intelligence/
  run-bqe.js                        → POST — Motor de scoring BQE
  stale-scanner.js                  → POST — Detector de leads vencidos
  buyer-quality.js                  → GET — Consulta de compradores
  creative-quality.js               → GET — Calidad de creativos
  recommendations.js                → GET — Recomendaciones
  alerts.js                         → GET — Alertas en tiempo real
  send-alerts.js                    → POST — Envío de alertas a Telegram
  _bqe-scorer.js                    → Módulo compartido BQE
  _alert-engine.js                  → Módulo compartido alertas

functions/api/meta/
  campaigns.js                      → GET — Campañas Meta Ads
  deep-insights.js                  → GET — Insights profundos
  ads.js                            → GET — Anuncios
  insights.js                       → GET — Métricas
  report.js                         → GET — Reporte cruzado D1 + Meta

scripts/
  deploy-production.ps1             → Deploy seguro con validaciones
  backup-d1.ps1                     → Backup automático de D1

AI_SYSTEM/                          → Sistema de memoria operativa para IA
  INDEX.md                          → Router principal
  core/                             → Contexto del negocio
  skills/                           → 14 skills de marketing
  meta-ads/                         → Reglas Meta Ads strict mode
  execution/                        → Reglas de ejecución técnica
```

---

## Flujo completo

```
Meta Ads → Landing
  ↓ [ViewContent - automático al cargar]
  ↓ [AddToCart - al tocar "Quiero este producto"]
  ↓ Formulario visible (modal)
  ↓ [InitiateCheckout - al enviar formulario]
  ↓ [QualifiedLead - CAPI server-side]
  ↓ Lead guardado en D1
  ↓ WhatsApp abierto con mensaje dinámico
  ↓ Notificación Telegram (pedido nuevo)
  ↓
Admin confirma venta manualmente
  ↓ [Purchase - SOLO desde /admin]
  ↓ [HighValuePurchase, VIPPurchase, FastBuyer, ComboBuyer - condicionales]
  ↓ Stock descontado en D1
  ↓ DAM Finanzas notificado (webhook)
  ↓ BQE auto-scoring
```

---

## Paneles internos

### Panel Admin (`/admin/`)
- Login con `ADMIN_PASSWORD`
- 7 tabs: Leads, Productos, Anuncios, Flow, Meta, Block, Envíos
- Confirmar compra → envía Purchase a CAPI
- Venta manual WhatsApp → flujo alterno
- Exportar CSV

### Dam Intelligence (`/intelligence/`)
- Motor de scoring BQE (Buyer Quality Engine)
- Calidad de compradores, creativos, campañas
- Alertas automáticas → Telegram
- InSync behavioral analytics
- Recomendaciones basadas en datos reales D1

### Product Studio (`/product-studio/`)
- 7 tabs: Producto, Inventario, Investigación, Estrategia, Visual, Landing, Sync
- Research engine para analizar URLs de proveedores
- Brief generator para landing pages
- Sync con DAM Finanzas

---

## Integración DAM Finanzas

DAM Finanzas (Firebase) recibe webhooks de cada venta para:
- Crear reporte financiero
- Descontar inventario financiero
- Calcular CPA, utilidad, distribución de publicidad

> **Regla:** DAM Vertex envía datos. DAM Finanzas calcula. No duplicar lógica financiera.

---

## Deploy

**Único comando correcto de producción:**

```powershell
.\scripts\deploy-production.ps1
```

**El evento Purchase NUNCA se envía automáticamente. Solo desde el panel admin.**
