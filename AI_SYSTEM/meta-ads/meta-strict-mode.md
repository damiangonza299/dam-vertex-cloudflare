# META_ANALYSIS_MODE=STRICT

Modo obligatorio para cualquier análisis de campañas, anuncios, presupuestos, delivery o ROAS.

---

## Activación automática

Activar cuando el usuario mencione cualquiera de:

```
Meta Ads | campañas | anuncios | ROAS | CTR | CPM | CPC
presupuesto | delivery | compras | escalado | pausa | activar campaña
resultados | métricas | creativos | leads Meta | atribución
```

---

## Regla 1 — PROHIBIDO analizar sin endpoints reales

ANTES de cualquier análisis, CloudCode DEBE consultar:

**Mínimo obligatorio:**

| Endpoint | Propósito |
|---|---|
| `/api/meta/campaigns` | Estados actuales ACTIVE/PAUSED reales |
| `/api/meta/deep-insights` | Métricas profundas: spend, delivery, funnel completo |

**Opcional según caso:**

| Endpoint | Cuándo usarlo |
|---|---|
| `/api/meta/ads?campaign_id=X` | Copy/hook por anuncio |
| `/api/meta/ads?status=ARCHIVED` | Creativos históricos |
| `/api/meta/report` | Solo producción o `--remote` — cruza Meta + D1 |
| `/api/meta/insights` | Alternativa básica cuando deep-insights no aplica |

**Si NO consultó endpoints:**

```
ABORTAR análisis.

Responder: "NO puedo hacer análisis real porque no consulté
endpoints actuales. Ejecutá el dev server o dame acceso a Meta API."
```

---

## Regla 2 — Invalidar contexto viejo automáticamente

Al iniciar cualquier análisis Meta Ads:

- DESCARTAR toda campaña mencionada en conversaciones anteriores
- DESCARTAR estados ON/OFF anteriores
- DESCARTAR presupuestos anteriores
- DESCARTAR métricas anteriores
- DESCARTAR spend anterior

**La única fuente válida: endpoints consultados en la sesión actual.**

No existe "probablemente sigue activa". No existe "antes tenía X de presupuesto". No existe "creo que estaba pausada".

---

## Regla 3 — Validación antes de recomendar

Antes de recomendar pausar, activar, escalar o modificar cualquier campaña, CloudCode DEBE confirmar explícitamente:

```
✓ Endpoint consultado: [URL + params usados]
✓ Timestamp de datos: [fecha/hora de la consulta]
✓ Campañas ACTIVE reales: [lista]
✓ Campañas PAUSED reales: [lista]
✓ Spend real del período: [valor]
✓ Delivery real: [impressions / reach]
✓ Presupuesto real: [daily_budget]
✓ Anuncios activos reales: [lista si aplica]
```

Sin esa validación: **NO recomendar.**

---

## Regla 4 — FAIL HARD MODE

Si cualquiera de estas condiciones ocurre:

- Endpoint no responde
- Auth falla (401/403)
- Meta API devuelve error
- Dev server no está corriendo
- No hay datos para el período consultado

CloudCode DEBE:

1. Detener el análisis
2. Explicar la limitación exacta (URL que falló, error exacto)
3. Proveer el curl exacto para que el usuario lo ejecute
4. NO improvisar
5. NO completar huecos con contexto textual
6. NO seguir el análisis "en base a lo que sé"

---

## Regla 5 — Lectura mínima de contexto

Cuando la tarea involucra Meta Ads:

**Leer SOLO:**
- Skills Meta: `meta-ads/`
- Este archivo
- Endpoints Meta en GEMINI.md
- Core del proyecto: `core/dam-vertex-core.md`

**NO leer:**
- Secciones de landing/CSS/HTML
- Firebase / PWA / IndexedDB
- WhatsApp flows / Telegram
- Stock / productos / diseño visual
- Skills de copywriting salvo que el análisis lo requiera explícitamente

Objetivo: minimizar consumo de contexto y evitar contaminación contextual de sesiones anteriores.

---

## Acceso directo a Meta API — método preferido

CloudCode puede llamar Meta API directamente desde Bash sin necesitar dev server ni ADMIN_PASSWORD.

```bash
# Paso 1: leer credenciales de .dev.vars
# META_MARKETING_TOKEN = token real de producción
# META_AD_ACCOUNT_ID = act_992345752726304

# Paso 2a: estados actuales de campañas
curl -s "https://graph.facebook.com/v21.0/act_992345752726304/campaigns?fields=id,name,status,effective_status,daily_budget,start_time&access_token=TOKEN_REAL"

# Paso 2b: métricas profundas (ajustar fechas)
curl -s "https://graph.facebook.com/v21.0/act_992345752726304/insights?fields=campaign_id,campaign_name,spend,impressions,reach,frequency,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,actions,action_values,cost_per_action_type&time_range={\"since\":\"YYYY-MM-DD\",\"until\":\"YYYY-MM-DD\"}&level=campaign&access_token=TOKEN_REAL"

# Paso 2c: copies/hooks (si se necesitan creativos)
curl -s "https://graph.facebook.com/v21.0/act_992345752726304/ads?fields=id,name,status,campaign_id,creative{body,title}&access_token=TOKEN_REAL"
```

**Nota sobre `/api/meta/report`:**
Falla localmente con `D1_ERROR: no such table: leads`. Solo funciona en producción (`damvertex.com`) o con `wrangler pages dev --remote`.

**Nota sobre dev server local (`:8788`):**
ADMIN_PASSWORD en `.dev.vars` es placeholder (`PONER_PASSWORD_AQUI`). Solo funciona si el usuario está corriendo `wrangler pages dev` localmente con ese valor como contraseña.

---

## PROHIBIDO sin verificación real

- Recomendar apagar o pausar campañas sin verificar `effective_status` actual
- Recomendar subir presupuesto sin ver spend real del período
- Dar CTR, CPM, ROAS sin consultar datos reales
- Mezclar métricas de campañas históricas con campañas actuales
- Inventar o estimar métricas faltantes
- Asumir que una campaña "sigue" en el estado mencionado en una conversación anterior

---

## Flujo estándar — "analizá esta campaña"

```
1. Activar META_ANALYSIS_MODE=STRICT
2. Leer .dev.vars → obtener META_MARKETING_TOKEN real
3. GET /campaigns → campañas activas reales ahora
4. GET /deep-insights?since=X&until=Y → métricas del período real
5. GET /ads?campaign_id=X → copies/hooks (si aplica)
6. GET /report → D1 cruzado (solo si producción disponible)
7. Invalidar cualquier dato de sesiones anteriores
8. Confirmar validación (ver Regla 3)
9. Analizar con datos reales únicamente
10. Recomendar solo sobre lo verificado
```
