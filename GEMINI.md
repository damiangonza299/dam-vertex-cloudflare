# DAM Vertex Cloudflare Context

Este repositorio usa un sistema local de AI Skills en `/AI_SYSTEM`.

---

## Protocolo de inicio de tarea

Antes de cualquier tarea:

1. Leer `/AI_SYSTEM/router/skill-router.md` — decide qué skills cargar
2. Leer `/AI_SYSTEM/core/dam-vertex-core.md` — contexto del proyecto
3. Seleccionar máximo 2 a 4 skills relevantes según la tarea (ver router)
4. Leer `/AI_SYSTEM/execution/cloudcode-execution-rules.md` antes de modificar código
5. Analizar archivos reales del proyecto antes de proponer cambios
6. No tocar código de producción salvo que la tarea lo requiera explícitamente
7. DAM Vertex Cloudflare es prioridad sobre DAM Finanzas, Turno Axis u otros proyectos

---

## META_ANALYSIS_MODE=STRICT — Análisis de campañas Meta Ads

**Reglas completas:** `AI_SYSTEM/meta-ads/meta-strict-mode.md`

**Activación:** automática cuando el usuario menciona Meta Ads, campañas, anuncios, ROAS, CTR, CPM, CPC, presupuesto, delivery, compras o escalado.

### Paso 1 — ABORTAR si no hay endpoints reales

Si CloudCode NO puede consultar endpoints reales en esta sesión:

```
ABORTAR. Responder: "NO puedo hacer análisis real porque no consulté
endpoints actuales."
```

Mínimo obligatorio: `/api/meta/campaigns` + `/api/meta/deep-insights`

### Paso 2 — Invalidar contexto viejo

Al iniciar análisis: descartar toda campaña, estado ON/OFF, presupuesto y métrica de sesiones anteriores. Fuente única válida: endpoints consultados ahora.

### Paso 3 — Acceso directo Meta API (sin servidor, siempre disponible)

```bash
# Leer META_MARKETING_TOKEN y META_AD_ACCOUNT_ID de .dev.vars — luego:

# Campañas actuales
curl -s "https://graph.facebook.com/v21.0/act_992345752726304/campaigns?fields=id,name,status,effective_status,daily_budget,start_time&access_token=TOKEN_DE_DEV_VARS"

# Métricas profundas (ajustar fechas)
curl -s "https://graph.facebook.com/v21.0/act_992345752726304/insights?fields=campaign_id,campaign_name,spend,impressions,reach,frequency,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,actions,action_values,cost_per_action_type&time_range={\"since\":\"YYYY-MM-DD\",\"until\":\"YYYY-MM-DD\"}&level=campaign&access_token=TOKEN_DE_DEV_VARS"

# Copies/hooks (si se necesitan creativos)
curl -s "https://graph.facebook.com/v21.0/act_992345752726304/ads?fields=id,name,status,campaign_id,creative{body,title}&access_token=TOKEN_DE_DEV_VARS"
```

Dev server local `:8788` — auth: `Bearer PONER_PASSWORD_AQUI` (ADMIN_PASSWORD del `.dev.vars`)

Limitación: `/api/meta/report` falla localmente (`D1_ERROR: no such table: leads`). Solo funciona en producción o con `--remote`.

### PROHIBIDO — nunca sin verificación real

- Recomendar apagar o pausar campañas sin verificar `effective_status` actual
- Recomendar subir presupuesto sin ver spend real del período
- Dar CTR, CPM, ROAS sin consultar datos reales
- Mezclar campañas históricas con campañas actuales
- Inventar o estimar métricas faltantes
- Asumir estado basándose en conversaciones anteriores

### Lectura parcial — no leer GEMINI.md completo si no aplica

Tarea Meta Ads → leer SOLO secciones Meta + core. No leer landing, CSS, Firebase, PWA, WhatsApp flows, stock, diseño.

Tarea landing/código → no leer reglas Meta si no aplican.

---

## Prioridades del proyecto

- Conversión de la landing
- Tracking correcto (Pixel + CAPI, sin contaminar Purchase)
- Performance de Meta Ads (ROAS)
- Funnel de WhatsApp sin fricción
- Velocidad mobile
- Estabilidad técnica

---

## Regla de carga de skills

No cargar todo el sistema en cada sesión.
El router indica qué leer según el tipo de tarea.
Máximo 4 skills por tarea.

---

## DAM Vertex AI System

Este repositorio incluye un sistema de memoria operativa para AI en `/AI_SYSTEM/`.

### Estructura

```
/AI_SYSTEM
  /router
    skill-router.md         ← leer primero, decide qué cargar
  /core
    dam-vertex-core.md      ← contexto del proyecto principal
  /sales
    hormozi-offers.md
    dan-kennedy-direct-response.md
  /copywriting
    eugene-schwartz-awareness.md
    paraguay-hooks.md
  /landing-cro
    peep-laja-cro.md
    mobile-first-conversion.md
  /meta-ads
    meta-strict-mode.md       ← LEER PRIMERO en tareas Meta Ads
    meta-creative-testing.md
    andrew-foxwell-meta-ads.md
    ezra-firestone-ecommerce.md
  /app-architecture
    pwa-cloudflare-firebase.md
    performance-indexeddb.md
    push-notifications.md
  /execution
    cloudcode-execution-rules.md
```

### Propósito

Cada archivo contiene principios operativos accionables para tareas específicas.
El sistema evita que la IA invente estructuras, funciones o flujos inexistentes.
Reemplaza el historial de chat como fuente de contexto entre sesiones.

### Qué cubre

| Área | Skills disponibles |
|---|---|
| Ofertas y ventas | `sales/` |
| Copy y hooks | `copywriting/` |
| Landing y conversión | `landing-cro/` |
| Meta Ads | `meta-ads/` |
| Apps PWA/Firebase | `app-architecture/` |
| Ejecución segura | `execution/` |

### Cómo usarlo

Siempre empezar por `skill-router.md`.
El router mapea la tarea al subset de skills a cargar.
No leer todo el sistema — leer solo lo necesario para la tarea actual.
