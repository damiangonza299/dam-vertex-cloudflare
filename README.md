# Dam Vertex — Cloudflare Pages

Sitio independiente con landings, formulario, CAPI Meta y panel admin.

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

| Variable             | Valor                        |
|----------------------|------------------------------|
| `META_ACCESS_TOKEN`  | Tu token de acceso de Meta   |
| `META_PIXEL_ID`      | `1502854450830084`           |
| `META_TEST_EVENT_CODE` | `TEST8761` (solo en staging) |
| `ADMIN_PASSWORD`     | Contraseña para el panel     |
| `WHATSAPP_NUMBER`    | `595993471550`               |

### 5. Dev local

```bash
npm run dev
```

Visitar: http://localhost:8788

### 6. Deploy

```bash
npm run deploy
```

---

## Estructura

```
public/
  index.html              → Home / grid de productos
  productos/index.html    → Listado productos
  cepillo/index.html      → Landing cepillo eléctrico
  lentes/index.html       → Landing lentes anti luz azul
  reloj/index.html        → Landing reloj Blackout
  admin/index.html        → Panel admin (protegido por password)
  assets/
    css/styles.css        → Estilos globales
    js/tracking.js        → Pixel + CAPI
    js/products.js        → Formulario + WhatsApp
    js/admin.js           → Panel admin
    img/                  → Imágenes locales (agregar acá)

functions/api/
  leads.js                → POST /api/leads (guardar lead)
  meta-event.js           → POST /api/meta-event (CAPI proxy)
  confirm-purchase.js     → POST /api/confirm-purchase (solo admin)
  admin-leads.js          → GET/PATCH /api/admin-leads (solo admin)
```

---

## Flujo completo

```
Meta Ads → Landing
  ↓ [ViewContent - automático al cargar]
  ↓ [AddToCart - al tocar "Quiero este producto"]
  ↓ Formulario visible
  ↓ [InitiateCheckout - al enviar formulario]
  ↓ [Contact - al abrir WhatsApp]
  ↓ Lead guardado en D1
  ↓ WhatsApp abierto con mensaje dinámico
  ↓
Admin confirma venta manualmente
  ↓ [Purchase - SOLO desde /admin]
  ↓ Lead marcado como purchased
```

---

## Imágenes

- `public/assets/img/lentes-placeholder.jpg` → agregar foto real del producto lentes
- Cepillo y Reloj usan CDN de Shopify (ya configurado)

---

## Panel Admin

URL: `tu-dominio.pages.dev/admin/`

- Login con `ADMIN_PASSWORD`
- Tabla de todos los leads
- Buscar por nombre / teléfono / ciudad
- Filtrar por producto y estado
- Confirmar compra → envía Purchase a CAPI
- Cancelar lead

**El evento Purchase NUNCA se envía automáticamente. Solo desde el panel admin.**
