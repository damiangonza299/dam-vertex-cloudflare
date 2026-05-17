# Meta Marketing API — Arquitectura READ-ONLY
## DAM Vertex Cloudflare

> Estado: PLAN TÉCNICO — sin implementar. No hay token activo. No se tocó producción.

---

## 1. Contexto del proyecto

El sistema actual ya tiene integración con Meta en **dirección de salida** (CAPI):

```
Landing → Cloudflare Worker (/api/meta-event, /api/confirm-purchase)
        → Meta Pixel + Conversions API
        → Meta (recibe eventos: ViewContent, Purchase, etc.)
```

Lo que se propone es una integración en **dirección de lectura** (Marketing API):

```
Meta (campañas, anuncios, métricas)
  → Meta Marketing API (Graph API)
  → Cloudflare Worker (/api/meta/campaigns, /api/meta/insights, etc.)
  → Admin interno / Claude Code (análisis, reportes)
```

Las dos integraciones son **completamente independientes** y usan tokens diferentes.

---

## 2. Tokens: CAPI vs Marketing API — son distintos

| Token | Variable actual | Scope | Uso |
|---|---|---|---|
| CAPI Token | `META_ACCESS_TOKEN` | `pages_show_list`, eventos | Enviar eventos a Meta (CAPI) |
| Marketing Token | `META_MARKETING_TOKEN` *(nuevo)* | `ads_read`, `read_insights` | Leer campañas/métricas de Meta |

**Regla crítica:** nunca mezclar estos tokens. El token de CAPI ya está funcionando en producción — no tocarlo.

---

## 3. Flujo de la integración READ-ONLY

```
Claude Code / Admin Panel
       │
       │  GET /api/meta/campaigns
       │  GET /api/meta/ads
       │  GET /api/meta/insights
       ▼
Cloudflare Worker (funciones protegidas con ADMIN_PASSWORD)
       │
       │  GET graph.facebook.com/v21.0/act_{AD_ACCOUNT_ID}/campaigns
       │  GET graph.facebook.com/v21.0/act_{AD_ACCOUNT_ID}/ads
       │  GET graph.facebook.com/v21.0/act_{AD_ACCOUNT_ID}/insights
       ▼
Meta Marketing API
       │
       │  Responde con JSON: campañas, métricas, anuncios
       ▼
Worker → devuelve JSON limpio al admin/Claude
```

---

## 4. Permisos mínimos necesarios

Para leer campañas y métricas sin riesgo de modificación:

| Permiso | Para qué sirve | ¿Requerido? |
|---|---|---|
| `ads_read` | Leer campañas, conjuntos, anuncios | Sí |
| `read_insights` | Leer métricas: impresiones, clics, gasto, ROAS | Sí |
| `ads_management` | Crear/modificar/pausar campañas | NO — no agregar ahora |
| `business_management` | Gestión de Business Manager | NO — no agregar ahora |

Con solo `ads_read` + `read_insights` el token es **read-only por diseño** — incluso si el token se filtra, nadie puede hacer cambios.

---

## 5. Por qué empezar solo lectura

1. **Riesgo cero de modificar campañas activas.** Un bug en el código no puede pausar ni editar anuncios.
2. **Si el token se filtra:** el daño máximo es que alguien vea tus métricas. Sin `ads_management`, no pueden tocar nada.
3. **Aprendizaje sin consecuencias:** se puede iterar en el diseño de los endpoints sin arriesgar el aprendizaje del algoritmo.
4. **Menos revisión de Meta:** tokens con scope mínimo tienen menos probabilidad de generar alertas de seguridad en el Business Manager.

---

## 6. Qué NO hacer — riesgo de baneo o pérdida de datos

| Acción prohibida | Riesgo |
|---|---|
| Guardar el token en el código fuente | Exposición pública si el repo es público |
| Guardar el token en variables de entorno del frontend | JS del cliente puede leerlo |
| Hacer scraping del Ads Manager (Puppeteer, Playwright) | Viola TOS de Meta — riesgo de baneo de cuenta |
| Llamar a la Marketing API desde el frontend directamente | Expone el token al navegador |
| Usar el token CAPI (`META_ACCESS_TOKEN`) para Marketing API | Son tokens distintos — no mezclar |
| Modificar campañas sin `ads_management` explícito | Meta puede rechazar el request y generar alertas |
| Hacer requests en loop rápido sin rate limiting | Meta tiene límites — superar genera throttling o baneo temporal |
| Almacenar métricas en D1 sin análisis de privacidad | Las métricas de Meta incluyen datos agregados de usuarios |

---

## 7. Cómo guardar el token de forma segura

**Flujo correcto en Cloudflare:**

```
1. Crear el token en Meta Business Manager
   (Meta Business Suite > Configuración > Usuarios del sistema > Token)

2. En Cloudflare Pages Dashboard:
   Settings > Environment Variables > Production
   Agregar: META_MARKETING_TOKEN = [token]
             META_AD_ACCOUNT_ID  = act_XXXXXXXXXX

3. En wrangler.toml NO se pone el valor del token, solo el binding si es un secret:
   [vars]
   META_AD_ACCOUNT_ID = "act_XXXXXXXXXX"   ← no es secreto, es un ID
   # META_MARKETING_TOKEN → configurar SOLO en el dashboard, nunca en wrangler.toml
```

**El Worker lo lee via `env`:**
```javascript
const token     = env.META_MARKETING_TOKEN;   // no expuesto al frontend
const accountId = env.META_AD_ACCOUNT_ID;      // no expuesto al frontend
```

---

## 8. Endpoints de Marketing API recomendados (fase 1)

Todos son `GET`. Ninguno modifica nada.

### 8.1 Campañas activas
```
GET https://graph.facebook.com/v21.0/act_{AD_ACCOUNT_ID}/campaigns
  ?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time
  &filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE","PAUSED"]}]
  &access_token={META_MARKETING_TOKEN}
```

### 8.2 Anuncios por campaña
```
GET https://graph.facebook.com/v21.0/act_{AD_ACCOUNT_ID}/ads
  ?fields=id,name,status,creative{id,name,thumbnail_url},campaign_id,adset_id
  &access_token={META_MARKETING_TOKEN}
```

### 8.3 Métricas / Insights
```
GET https://graph.facebook.com/v21.0/act_{AD_ACCOUNT_ID}/insights
  ?fields=impressions,reach,clicks,spend,cpc,cpm,ctr,actions,action_values,cost_per_action_type
  &time_range={"since":"2025-05-01","until":"2025-05-17"}
  &level=campaign
  &access_token={META_MARKETING_TOKEN}
```

### 8.4 Creativos con thumbnails (fase 2, no prioritario)
```
GET https://graph.facebook.com/v21.0/{ad_creative_id}
  ?fields=id,name,thumbnail_url,body,title,image_url
  &access_token={META_MARKETING_TOKEN}
```

---

## 9. Estructura de Workers propuesta

```
functions/
  api/
    meta-event.js          ← CAPI existente — NO TOCAR
    confirm-purchase.js    ← Purchase existente — NO TOCAR
    admin-leads.js         ← Admin existente — NO TOCAR
    leads.js               ← Leads existente — NO TOCAR
    product-stock.js       ← Stock existente — NO TOCAR
    meta/                  ← NUEVO — completamente aislado
      campaigns.js         ← lee campañas activas
      ads.js               ← lee anuncios por campaña
      insights.js          ← lee métricas de rendimiento
```

**Los archivos en `meta/` son independientes.** No importan ni modifican nada de los archivos existentes.

---

## 10. Secrets a configurar (cuando se active)

| Variable | Dónde configurar | Ejemplo |
|---|---|---|
| `META_MARKETING_TOKEN` | Cloudflare Dashboard > Settings > Env Vars (Production) | `EAAxxxx...` |
| `META_AD_ACCOUNT_ID` | Cloudflare Dashboard > Settings > Env Vars | `act_123456789` |
| `ADMIN_PASSWORD` | Ya existe — reutilizar para proteger los nuevos endpoints | — |

**`META_MARKETING_TOKEN` NUNCA en:**
- wrangler.toml
- código fuente
- frontend JS
- commits de git

---

## 11. MVP seguro — orden de ejecución

```
Fase 0 (actual): Plan y documentación ← estamos aquí
Fase 1: Crear Meta App en Business Manager con scope mínimo
Fase 2: Generar token de Sistema con ads_read + read_insights
Fase 3: Configurar secret en Cloudflare Dashboard
Fase 4: Implementar campaigns.js (el más simple)
Fase 5: Probar en local con wrangler dev
Fase 6: Implementar ads.js e insights.js
Fase 7: Conectar con panel admin interno para visualización
Fase 8 (futuro): Evaluar si agregar ads_management para automatizaciones seguras
```

---

## 12. Qué archivos habría que crear

| Archivo | Acción |
|---|---|
| `functions/api/meta/campaigns.js` | CREAR (stub listo, sin token activo) |
| `functions/api/meta/ads.js` | CREAR (stub listo, sin token activo) |
| `functions/api/meta/insights.js` | CREAR (stub listo, sin token activo) |
| `META_API_ARCHITECTURE.md` | CREADO (este archivo) |

**Archivos que NO se tocan:**
- `functions/api/meta-event.js` — CAPI, no tocar
- `functions/api/confirm-purchase.js` — Purchase, no tocar
- `functions/api/admin-leads.js` — Admin, no tocar
- `functions/api/leads.js` — Leads, no tocar
- `functions/api/product-stock.js` — Stock, no tocar
- `wrangler.toml` — no se agrega el token aquí, solo el AD_ACCOUNT_ID cuando sea el momento
- Cualquier archivo del frontend / landing — no tocar
- D1 — no se escribe nada desde estos Workers

---

## 13. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Token filtrado en código | Usar solo env secrets en Cloudflare Dashboard |
| Token con scope excesivo | Crear token específico con mínimos permisos |
| Rate limiting de Meta | Implementar cache en Worker (KV) para no repetir requests |
| Confusión CAPI token vs Marketing token | Variables con nombres distintos, no mezclar |
| Endpoints accesibles públicamente | Proteger todos con ADMIN_PASSWORD header |
| Llamadas concurrentes excesivas | Cloudflare Worker tiene límites propios de rate |

---

_Archivo de arquitectura — solo documentación. Ningún cambio de producción._
_Última revisión: 2026-05-17_
