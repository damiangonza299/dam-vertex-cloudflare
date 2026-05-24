---
name: estrategia-retargeting
description: "Diseña campañas de retargeting con segmentación de audiencia, mensajes por etapa del funnel y frequency caps. Úsalo cuando re-engaging visitantes de sitio web que no convirtieron."
allowed-tools: Read Write Glob
metadata:
  author: Imperio Digital
  version: "1.0"
---

# Estrategia de Retargeting

## Principio Fundamental

EL RETARGETING NO ES MOSTRAR EL MISMO AD A TODOS QUE VISITARON TU SITIO — ES ENTREGAR EL MENSAJE CORRECTO BASÁNDOSE EN CUÁN LEJOS LLEGARON EN TU FUNNEL Y POR QUÉ SE DETUVIERON.

---

## Cuándo Usar Este Skill

- Diseñar campañas de retargeting en Meta, Google u otras plataformas de ad
- Segmentar audiencias de retargeting por comportamiento y etapa del funnel
- Crear estrategias de mensajes específicas para donde los prospects se detuvieron
- Establecer frequency caps y exclusiones para evitar fatiga de ad

**NO USES** este skill para targeting de audiencia fría, secuencias de retargeting de email, remarketing orgánico. Esto es para retargeting pagado de visitantes de sitio web y audiencias engaged.

---

## Fase 1: Brief

### Inputs Requeridos

| Input | Qué Preguntar | Default |
|---|---|---|
| **Tráfico de sitio web** | "¿Cuántos visitantes mensuales de sitio web tienes?" | Sin default — debe ser proporcionado |
| **Pixel/tracking** | "¿Tienes Meta Pixel y/o Google Tag instalados?" | Necesita verificación |
| **Acción de conversión** | "¿Qué cuenta como conversión? (compra, signup, booking)" | Compra |
| **Etapas del funnel** | "¿Qué páginas visitan las personas antes de convertir?" | Homepage → Producto → Checkout |
| **Plataformas de ad** | "¿Dónde ejecutarás retargeting? (Meta, Google, ambas)" | Meta (Facebook/Instagram) |
| **Presupuesto para retargeting** | "¿Qué presupuesto puedes asignar específicamente a retargeting?" | 20% del presupuesto total de ad |

**PUNTO DE CONTROL: Confirma antes de diseñar la arquitectura de retargeting.**

---

## Fase 2: Segmentación de Audiencia

### Tiers de Audiencia de Retargeting

| Tier | Segmento | Temperatura | Ventana | Mensaje |
|---|---|---|---|---|
| **Tier 1 — Más caliente** | Abandono de checkout | Muy caliente | 1-7 días | Urgencia directa, objeción específica |
| **Tier 2 — Caliente** | Vio página de producto | Caliente | 1-14 días | Beneficio clave, prueba social |
| **Tier 3 — Tibio** | Visitó sitio, no llegó a producto | Tibio | 7-30 días | Conciencia, educación, reenganche |
| **Tier 4 — Frío retargeting** | Engaged con ad sin clic | Frío-tibio | 1-14 días | Reintroducción del producto |

### Exclusiones Obligatorias

- Compradores de últimos 30 días (no retargetear conversos recientes)
- Clientes existentes (usar campaña separada de retención)
- Visitantes de menos de 10 segundos en sitio (rebote real, no intención)

---

## Fase 3: Mensajes por Etapa del Funnel

### Framework de Mensajes por Tier

**Tier 1 — Abandono de Checkout:**
```
Mensaje: "[Nombre del producto] está esperando en tu carrito"
Ángulo: El costo de NO actuar / recordatorio directo
Objeción a abordar: Precio, confianza, timing
Urgencia: Stock, precio, tiempo
CTA: "Completa tu compra"
```

**Tier 2 — Visitó Producto sin Checkout:**
```
Mensaje: "[Beneficio específico del producto] — exactamente lo que buscas"
Ángulo: Prueba social, testimonios, resultado real
Formato recomendado: Video corto, carousel con beneficios
CTA: "Ver [producto] / Comprar ahora"
```

**Tier 3 — Visitó Sitio sin Ver Producto:**
```
Mensaje: "[Problema que resuelves] — hay una solución más fácil"
Ángulo: Educación, introducción al problema
Formato: Video explicativo o imagen con hook
CTA: "Aprende cómo / Descubre más"
```

---

## Fase 4: Configuración Técnica

### Setup de Audiencias en Meta Ads Manager

```
## Configuración de Audiences — Meta

**Audiencia 1: Abandono Checkout (7 días)**
- Tipo: Custom Audience — Website
- Evento: InitiateCheckout en los últimos 7 días
- Excluir: Purchase en los últimos 30 días
- Tamaño estimado: [X personas]

**Audiencia 2: Vio Producto (14 días)**
- Tipo: Custom Audience — Website
- Evento: ViewContent en los últimos 14 días
- Excluir: InitiateCheckout + Purchase últimos 30 días
- Tamaño estimado: [X personas]

**Audiencia 3: Visitantes Generales (30 días)**
- Tipo: Custom Audience — Website
- Todos los visitantes últimos 30 días
- Excluir: ViewContent + Checkout + Purchase
- Tamaño estimado: [X personas]
```

### Frequency Caps Recomendados

| Tier | Frequency Cap | Por Qué |
|---|---|---|
| Tier 1 (checkout) | 3-5 impresiones/semana | Alta intención — mostrar más sin abrumar |
| Tier 2 (producto) | 2-3 impresiones/semana | Recordatorio sin saturar |
| Tier 3 (visita general) | 1-2 impresiones/semana | Bajo intención — menos exposición |

---

## Fase 5: Secuencia Temporal de Mensajes

### Retargeting Secuencial (si plataforma permite)

```
Día 1-2: [Mensaje de recordatorio directo — "¿Olvidaste algo?"]
Día 3-5: [Prueba social / testimonio — confianza adicional]
Día 6-10: [Objeción específica abordada — precio, garantía, riesgo]
Día 11-14: [Urgencia real si existe — oferta, stock, fecha]
Día 15-30: [Reenganche suave — contenido de valor o nuevo ángulo]
```

---

## Anti-Patrones

- **NO** retargetear a todos los visitantes con el mismo ad — el mensaje genérico no convierte
- **NO** omitir exclusiones de compradores — es molesto y desperdicia presupuesto
- **NO** frequency cap demasiado alto — sobre 7 impresiones/semana activa fatiga y ad hiding
- **NO** retargetear ventanas demasiado largas sin cambiar el mensaje — 60+ días con mismo ad = ignorado
- **NO** usar solo texto en retargeting — el creative visual es aún más importante que en prospecting
- **NO** olvidar excluir audiences de retargeting de campañas de prospecting — se superponen y suben CPM

---

## Outputs Esperados

Al completar este skill, el usuario tiene:
1. Arquitectura de 3-4 tiers de audiencia de retargeting
2. Segmentación por comportamiento y etapa de funnel
3. Framework de mensajes específico por tier
4. Configuración técnica de audiencias en Meta/Google
5. Frequency caps recomendados para evitar fatiga
6. Secuencia temporal de mensajes si el presupuesto lo permite
