# Meta Ads Dashboard — Arquitectura de Análisis Cruzado
## DAM Vertex Cloudflare

> Estado: PLAN TÉCNICO — sin implementar. No se toca producción hasta aprobación.

---

## 1. Situación actual

### Lo que ya existe

| Dato | Fuente | Dónde vive |
|---|---|---|
| Campañas activas, gasto, CTR, CPC, CPM | Meta Marketing API | `/api/meta/insights` |
| Leads con atribución completa | D1 (leads table) | `campaign_id`, `campaign_name`, `ad_id`, `ad_name` |
| Confirmaciones reales de compra | D1 (leads.status) | `status = 'purchased'`, `value`, `purchased_at` |
| Admin panel con tabs | Frontend | `/admin/index.html` |
| Tab "Anuncios" (atribución por fila) | Frontend | `ads-section` en admin.js |

### Lo que falta

- Vista agregada: Meta metrics + real metrics **por campaña en la misma fila**
- Cálculo de ROAS real (revenue D1 / gasto Meta)
- Detección automática: curiosos vs compradores reales
- Un endpoint que haga el JOIN en servidor (no en frontend)

---

## 2. La clave del JOIN

El schema ya captura `campaign_id` en cada lead (desde migrate7.sql). Este ID es el mismo que usa la Meta Marketing API. Es la clave de JOIN más confiable porque:

- Es un número único inmutable (no cambia si se renombra la campaña)
- Ya se captura desde el URL de la landing via parámetro `?campaign_id={{campaign.id}}`
- Meta insights devuelve `campaign_id` en cada fila

**JOIN principal:**
```sql
leads.campaign_id  ←→  meta_insights.campaign_id
```

**JOIN de respaldo** (cuando campaign_id no fue capturado):
```sql
leads.campaign_name  ←→  meta_insights.campaign_name  (exact match)
leads.utm_campaign   ←→  meta_insights.campaign_name  (si UTM tiene el nombre)
```

---

## 3. Arquitectura del endpoint de reporte

### Nuevo Worker: `/api/meta/report`

```
GET /api/meta/report?since=YYYY-MM-DD&until=YYYY-MM-DD

Auth: Bearer {ADMIN_PASSWORD}
```

**Flujo interno del Worker:**

```
┌─────────────────────────────────────────────────────┐
│              /api/meta/report Worker                │
│                                                     │
│  1. Verificar auth (ADMIN_PASSWORD)                 │
│  2. Parsear parámetros de fecha                     │
│                                                     │
│  ┌──────────────────┐    ┌──────────────────────┐  │
│  │  Meta Marketing  │    │    D1 Database        │  │
│  │  API (insights)  │    │    (leads grouped)    │  │
│  │                  │    │                       │  │
│  │  campaign_id     │    │  campaign_id          │  │
│  │  campaign_name   │    │  total_leads          │  │
│  │  spend           │    │  purchased_count      │  │
│  │  impressions     │    │  pending_count        │  │
│  │  reach           │    │  revenue_real         │  │
│  │  clicks          │    │  avg_ticket           │  │
│  │  ctr, cpc, cpm   │    │  product_names        │  │
│  │  actions(purchase│    │                       │  │
│  │  action_values   │    │                       │  │
│  └────────┬─────────┘    └──────────┬────────────┘  │
│           │                         │               │
│           └──────────┬──────────────┘               │
│                      ▼                              │
│             JOIN por campaign_id                    │
│                      │                              │
│                      ▼                              │
│          Calcular métricas derivadas:               │
│          - close_rate                               │
│          - roas_meta                                │
│          - roas_real                                │
│          - roas_delta                               │
│          - campaign_quality (clasificación)         │
│                      │                              │
│                      ▼                              │
│          Respuesta JSON con filas combinadas        │
└─────────────────────────────────────────────────────┘
```

**Archivo a crear:** `functions/api/meta/report.js`
**Aislamiento:** No toca CAPI, Purchase, Pixel, admin-leads, leads.js

---

## 4. Query D1 — Agregación por campaña

```sql
SELECT
  campaign_id,
  campaign_name,
  product_name,
  COUNT(*)                                                    AS total_leads,
  SUM(CASE WHEN status = 'purchased' THEN 1 ELSE 0 END)      AS purchased,
  SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END)      AS pending,
  SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)      AS cancelled,
  SUM(CASE WHEN status = 'purchased' THEN value ELSE 0 END)  AS revenue_real,
  AVG(CASE WHEN status = 'purchased' THEN value ELSE NULL END) AS avg_ticket
FROM leads
WHERE created_at >= ?1
  AND created_at < ?2
  AND (campaign_id IS NOT NULL OR campaign_name IS NOT NULL)
GROUP BY campaign_id, campaign_name, product_name
ORDER BY total_leads DESC
```

**Leads sin atribución** (para detectar qué porcentaje no tiene UTMs configurados):
```sql
SELECT COUNT(*) FROM leads
WHERE created_at >= ?1
  AND campaign_id IS NULL
  AND campaign_name IS NULL
  AND utm_campaign IS NULL
  AND fbclid IS NULL
```

---

## 5. Cálculo de ROAS

### ROAS Meta (lo que Meta dice)
```javascript
const roas_meta = meta_spend > 0
  ? meta_purchase_value / meta_spend  // action_values[purchase] / spend
  : null;
```
**Fuente:** Meta Marketing API → `action_values` donde `action_type === 'purchase'`
**Riesgo:** Meta puede atribuir conversiones que no cerraron por WhatsApp (view-through attribution, modelos probabilísticos)

### ROAS Real (lo que realmente pasó)
```javascript
const roas_real = meta_spend > 0
  ? revenue_real / meta_spend  // SUM(leads.value WHERE status='purchased') / meta_spend
  : null;
```
**Fuente:** D1 leads confirmados con `status='purchased'` + `value`
**Por qué es más confiable:** Solo cuenta pedidos que vos confirmaste manualmente. Si Meta dice 5 compras pero vos solo confirmaste 3 en el admin, el ROAS real lo refleja.

### Delta ROAS (diferencia)
```javascript
const roas_delta = (roas_meta !== null && roas_real !== null)
  ? roas_real - roas_meta
  : null;
```
- **Delta positivo:** Meta sub-atribuye (hay más ventas reales que las que Meta registró)
- **Delta negativo:** Meta sobre-atribuye (Meta dice que vendió más de lo que realmente confirmaste)
- **El delta CADENAA APEX según los datos del test:** Meta ROAS = 1.39, si tuviéramos el revenue real confirmado en D1 podríamos calcular cuánto se aleja

---

## 6. Clasificación de calidad de campaña

```javascript
function classifyCampaign(row) {
  const closeRate  = row.leads > 0 ? row.purchased / row.leads : 0;
  const ctr        = parseFloat(row.meta?.ctr || 0);
  const roasDelta  = row.roas_delta ?? 0;
  const spend      = parseFloat(row.meta?.spend || 0);

  // Genera tráfico pero nadie compra → problema de landing/oferta/cierre
  if (closeRate < 0.05 && ctr > 1.5) return 'CURIOSOS';

  // Compra bien → mantener y escalar
  if (closeRate >= 0.25 && row.roas_real >= 1.5) return 'COMPRADOR';

  // Buen ROAS meta pero bajo real → Meta está sobre-atribuyendo
  if (roasDelta < -0.8 && spend > 50000) return 'META_OVERATRIB';

  // Gasta mucho sin cerrar → evaluar corte
  if (spend > 100000 && closeRate < 0.03) return 'QUEMANDO';

  // CTR alto pero sin atribución → UTMs mal configurados
  if (ctr > 1.5 && row.leads === 0) return 'SIN_ATRIB';

  return 'NEUTRAL';
}
```

| Clasificación | Significa | Acción sugerida |
|---|---|---|
| `COMPRADOR` | Lead de calidad, cierra bien | Escalar |
| `CURIOSOS` | CTR bueno, pero no compra | Revisar landing/ángulo |
| `META_OVERATRIB` | Meta dice que vendió más de lo real | Revisar ventana de atribución |
| `QUEMANDO` | Gasto sin cierre | Evaluar pausa |
| `SIN_ATRIB` | Hay tráfico pero no hay leads con campaña | Configurar UTMs en Meta |
| `NEUTRAL` | Datos insuficientes o resultado normal | Observar más tiempo |

---

## 7. Columnas de la tabla final (por campaña)

| Columna | Fuente | Cálculo |
|---|---|---|
| Campaña | Meta | `campaign_name` |
| Producto | D1 | `product_name` más frecuente del grupo |
| Gasto | Meta | `spend` en PYG |
| Impres. | Meta | `impressions` |
| CTR | Meta | `ctr` (%) |
| CPC | Meta | `cpc` |
| CPM | Meta | `cpm` |
| Leads | D1 | `total_leads` del grupo |
| Comprados | D1 | `purchased` del grupo |
| Tasa cierre | Calculada | `purchased / leads * 100` (%) |
| Revenue real | D1 | `revenue_real` en PYG |
| ROAS Meta | Meta | `action_values(purchase) / spend` |
| ROAS Real | Cruzado | `revenue_real / spend` |
| Delta ROAS | Calculado | `roas_real - roas_meta` |
| Calidad | Calculada | `classifyCampaign(row)` |

---

## 8. Detección de patrones específicos

### Anuncios con buen CTR pero mal cierre
```
CTR > 1.5% AND close_rate < 5% AND leads > 3
```
→ El anuncio engancha pero la landing o la oferta no convierte.
→ Revisar coherencia anuncio → landing (skill: ezra-firestone-ecommerce).

### Campañas que generan compradores reales
```
close_rate > 20% AND roas_real > 1.0
```
→ Ángulo que resuena con compradores, no solo curiosos.
→ Candidato para escalar (skill: andrew-foxwell-meta-ads).

### Ángulos que convierten mejor
```
GROUP BY ad_name
ORDER BY close_rate DESC, roas_real DESC
```
→ El nombre del anuncio (`ad_name`) identifica el ángulo creativo.
→ Los datos del test mostraron nombres como "PRECIO DOMINANTE", "PRECIO + OFERTA - GANADOR".

### Productos con mejor calidad de lead
```
GROUP BY product_name
WHERE total_leads > 5
ORDER BY close_rate DESC
```
→ Qué productos tienen clientes que completan el pedido vs los que piden y desaparecen.

---

## 9. MVP visual — Propuesta de pantalla

```
┌──────────────────────────────────────────────────────────────────────┐
│  Admin → Tab: Meta Ads                                               │
│                                                                      │
│  [7 días ▼] [Este mes] [Personalizar]   [↻ Actualizar]              │
│                                                                      │
│  ┌── KPIs rápidos (fila horizontal) ───────────────────────────────┐ │
│  │  Gasto total  │  Leads con atrib.  │  Compras reales  │ ROAS R  │ │
│  │  Gs 1.472.000 │  47                │  13              │ 1.47x   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Tabla por campaña:                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ Campaña          │Prod  │Spend  │CTR  │CPC  │Leads│Comprados│Cierre%│RevReal│ROASm│ROASr│Δ  │
│  ├──────────────────┼──────┼───────┼─────┼─────┼─────┼─────────┼───────┼───────┼─────┼─────┼───┤
│  │ CADENAA APEX     │Apex  │888k   │1.9% │354  │31   │9        │29% ✓  │1.231M │1.39 │1.39 │ 0 │
│  │ STATUS/PRESENCIA │Apex  │159k   │3.0% │479  │8    │1        │12.5%  │381k   │2.39 │2.39 │ 0 │
│  │ DOLOR SOCIAL     │Apex  │134k   │1.5% │1184 │6    │1        │16%    │139k   │1.03 │1.03 │ 0 │
│  │ CEPILLO - LIQ.   │Cep.  │238k   │1.3% │990  │8    │2        │25%    │328k   │1.37 │1.37 │ 0 │
│  │ TRANSFORM. VISUAL│Apex  │51k    │2.7% │652  │5    │0        │0% ✗   │0      │0.00 │0.00 │ 0 │
│  └──────────────────┴──────┴───────┴─────┴─────┴─────┴─────────┴───────┴───────┴─────┴─────┴───┘ │
│                                                                      │
│  ── Alertas de calidad ──────────────────────────────────────────── │
│  ⚠  TRANSFORMACIÓN VISUAL — CTR 2.7% pero 0 compras. Revisar landing. │
│  ✓  CADENAA APEX — 29% cierre, campana principal activa.            │
│  ⚠  DOLOR SOCIAL — CPC alto (1.184). Evaluar si escala.            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 10. Archivos a crear (cuando se apruebe implementación)

| Archivo | Descripción |
|---|---|
| `functions/api/meta/report.js` | Worker que cruza Meta insights + D1 leads |
| `public/assets/js/meta-dashboard.js` | Lógica del tab Meta Ads en el admin |
| Modificar `public/admin/index.html` | Agregar tab "Meta Ads" y su sección |
| Modificar `public/assets/css/styles.css` | Estilos de la tabla cruzada |

**Archivos que NO se tocan:**
- `functions/api/meta-event.js` — CAPI, intocable
- `functions/api/confirm-purchase.js` — Purchase, intocable
- `functions/api/admin-leads.js` — admin base, intocable
- `functions/api/leads.js` — captura de leads, intocable
- Cualquier landing HTML — intocable

---

## 11. Prerrequisitos antes de implementar

1. **UTMs configurados en Meta** — las campañas activas deben enviar `campaign_id`, `campaign_name`, `ad_id`, `ad_name` en la URL. Sin esto, los leads no tienen atribución y el JOIN no funciona.

2. **Verificar cobertura actual** — correr esta query en D1 para saber qué % de leads ya tienen `campaign_id`:
   ```sql
   SELECT
     COUNT(*) AS total,
     SUM(CASE WHEN campaign_id IS NOT NULL THEN 1 ELSE 0 END) AS con_campaign_id,
     ROUND(SUM(CASE WHEN campaign_id IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS pct
   FROM leads
   WHERE created_at >= date('now', '-30 days')
   ```

3. **Confirmar que `status='purchased'` con `value` está bien cargado** — ROAS real solo funciona si el value del lead está en PYG y el confirm-purchase actualiza correctamente.

---

## 12. Riesgos

| Riesgo | Mitigación |
|---|---|
| Leads sin `campaign_id` | Mostrar como "Sin atribución" en la tabla, no ignorarlos |
| Timezone mismatch D1 vs Meta | D1 guarda UTC, Meta devuelve por fecha local — usar rangos conservadores (+/- 1 día) |
| Campañas pausadas sin datos de D1 | JOIN LEFT — mostrar fila con meta_spend pero 0 leads |
| Meta over-attribution (view-through) | Delta ROAS lo hace visible; no corregir, solo informar |
| Performance: D1 + Meta API en paralelo | Promise.all — ambas llamadas corren simultáneamente |
| Token META_MARKETING_TOKEN expira | Long-lived token de usuario del sistema (no expira en 60 días si se genera correctamente) |

---

_Documento de arquitectura — sin cambios de producción._
_Basado en análisis de: schema.sql, migrate7.sql, leads.js, admin.js, admin/index.html, functions/api/meta/insights.js_
_Última revisión: 2026-05-17_
