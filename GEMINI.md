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
