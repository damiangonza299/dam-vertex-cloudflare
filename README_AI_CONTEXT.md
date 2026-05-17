# AI Context — DAM Vertex Cloudflare

Este proyecto contiene su propio sistema de instrucciones interno para AI (Claude Code / CloudCode).
No depende de ningún proyecto externo.

---

## Punto de entrada obligatorio

**Siempre leer primero:** [`GEMINI.md`](./GEMINI.md)

Este archivo define el protocolo de inicio de tarea, las prioridades del proyecto y la estructura del sistema AI.

---

## Sistema de skills (`AI_SYSTEM/`)

Después de leer `GEMINI.md`, el router decide qué archivos cargar según el tipo de tarea:

```
AI_SYSTEM/
  router/
    skill-router.md              ← leer siempre después de GEMINI.md
  core/
    dam-vertex-core.md           ← contexto del negocio y stack técnico
  sales/
    hormozi-offers.md
    dan-kennedy-direct-response.md
  copywriting/
    eugene-schwartz-awareness.md
    paraguay-hooks.md
  landing-cro/
    peep-laja-cro.md
    mobile-first-conversion.md
  meta-ads/
    meta-creative-testing.md
    andrew-foxwell-meta-ads.md
    ezra-firestone-ecommerce.md  ← cubre ecommerce también
  app-architecture/
    pwa-cloudflare-firebase.md
    performance-indexeddb.md
    push-notifications.md
  execution/
    cloudcode-execution-rules.md ← leer antes de modificar cualquier código
```

---

## Reglas de uso

- Cargar **máximo 4 skills** por tarea (ver router para decidir cuáles)
- `core/dam-vertex-core.md` se lee siempre si la tarea toca el proyecto principal
- `execution/cloudcode-execution-rules.md` se lee siempre antes de modificar código
- No cargar todo el sistema en cada sesión — solo lo necesario según la tarea

---

## Qué NO tocar sin análisis previo

Antes de cualquier cambio, leer `GEMINI.md` y los skills relevantes.

Las siguientes áreas están protegidas y **no deben modificarse** sin pedido explícito y análisis previo:

| Área protegida | Motivo |
|---|---|
| Pixel / Meta Pixel (`fbq` calls) | Romper eventos destruye el aprendizaje de Meta |
| Conversions API (CAPI) | Duplicar/perder eventos = datos corruptos |
| Evento Purchase | Solo dispara cuando el pedido está confirmado |
| Links de WhatsApp | Canal principal de cierre de ventas |
| Lógica de stock/admin | Afecta operación real del negocio |
| Base de datos (D1 / KV) | Sin backup explícito, no hacer cambios destructivos |
| Cloudflare Functions / Workers | Backend en producción |
| Deployments | No deployar sin aprobación explícita |

---

## Flujo correcto de trabajo

```
1. Leer GEMINI.md
2. Leer AI_SYSTEM/router/skill-router.md
3. Cargar 2-4 skills según la tarea
4. Leer AI_SYSTEM/execution/cloudcode-execution-rules.md si hay cambios de código
5. Analizar archivos reales del proyecto
6. Proponer cambio y confirmar antes de ejecutar
```

---

_Sistema autónomo — no depende de proyectos externos. Última verificación de integridad: 2026-05-17._
