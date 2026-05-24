---
name: guion-ad-podcast
description: "Escribe scripts de ad de podcast host-read y pre-producidos con puntos de integración natural y URLs de tracking. Úsalo cuando crees spots publicitarios de podcast o reads de sponsorship."
allowed-tools: Read Write Glob
metadata:
  author: Imperio Digital
  version: "1.0"
---

# Guión de Ad de Podcast

## Principio Fundamental

EL MEJOR AD DE PODCAST SUENA COMO EL HOST RECOMENDANDO ALGO GENUINAMENTE A UN AMIGO — NO LEYENDO UN SCRIPT CORPORATIVO.

---

## Cuándo Usar Este Skill

- Escribir scripts de ad host-read para sponsorships de podcast
- Crear spots de podcast pre-producidos (announcer-read)
- Desarrollar scripts de ad para colocaciones pre-roll, mid-roll o post-roll
- Producir variaciones múltiples de script para diferentes shows de podcast

**NO USES** este skill para outlines de episodios de podcast, show notes, o comerciales de radio. Esto es específicamente para scripts publicitarios de podcast.

---

## Fase 1: Brief

### Inputs Requeridos

| Input | Qué Preguntar | Default |
|---|---|---|
| **Producto/servicio** | "¿Qué estás anunciando?" | Sin default — debe ser proporcionado |
| **Tipo de ad** | "¿Host-read o pre-producido?" | Host-read |
| **Colocación** | "¿Pre-roll (60s), mid-roll (60-90s), o post-roll (30s)?" | Mid-roll (60 segundos) |
| **Oferta/CTA** | "¿Cuál es la oferta? (código de descuento, URL, prueba gratis)" | Sin default — debe ser proporcionado |
| **Puntos clave** | "¿Qué 2-3 puntos DEBEN mencionarse?" | Sin default — debe ser proporcionado |
| **Género de podcast** | "¿Qué tipo de podcast? (negocio, comedia, crimen real, salud)" | Negocio/emprendimiento |

**PUNTO DE CONTROL: No procedas hasta que el producto, oferta y puntos clave estén confirmados.**

---

## Fase 2: Framework de Script

Selecciona el framework basado en tipo de ad y colocación.

### Estructura Host-Read (Mid-Roll 60s)

```
## Script Host-Read — Mid-Roll 60 segundos

[TRANSICIÓN NATURAL — 5 segundos]
"Antes de continuar, quiero contarles sobre algo que [relevancia personal del host al producto]..."

[PRESENTACIÓN PERSONAL — 10 segundos]
"[Nombre del producto] es [descripción simple en términos del host]."

[PUNTO CLAVE 1 — 10 segundos]
"Lo que me gusta es que [beneficio 1 — en voz del host]."

[PUNTO CLAVE 2 — 10 segundos]
"Además, [beneficio 2 o diferenciador — natural, no corporativo]."

[PRUEBA / CREDIBILIDAD — 5 segundos]
"[Resultado, número de usuarios, garantía, o experiencia personal del host]."

[OFERTA — 10 segundos]
"[Nombre del producto] está ofreciendo a los oyentes de [nombre del podcast] [oferta específica]."

[CTA — 10 segundos]
"Ve a [URL de tracking] — eso es [URL deletreada lentamente].
Usa el código [CÓDIGO] para [beneficio del código].
El link está también en las notas del episodio."
```

### Estructura Host-Read (Pre-Roll 30-45s)

```
## Script Host-Read — Pre-Roll 30-45 segundos

[APERTURA DIRECTA — 5 segundos]
"Este episodio está patrocinado por [Producto]."

[QUÉ ES + BENEFICIO PRINCIPAL — 15 segundos]
"[Producto] es [descripción de una línea]. [Beneficio principal que le importa a la audiencia del podcast]."

[OFERTA — 10 segundos]
"Consigue [oferta] en [URL de tracking] usando el código [CÓDIGO]."

[CIERRE — 5 segundos]
"Ahora, al episodio."
```

### Estructura Pre-Producido (Announcer-Read)

```
## Script Pre-Producido — 30 segundos

[HOOK DE APERTURA — 5 segundos]
"[Pregunta de dolor o afirmación que detiene al oyente]"

[SOLUCIÓN — 10 segundos]
"[Nombre del producto] [cómo resuelve exactamente ese dolor]."

[DIFERENCIADOR — 8 segundos]
"[Una cosa específica que los hace únicos — sin hipérboles]."

[CTA — 7 segundos]
"Visita [URL corta y memorable]. [URL deletreada]."

[Instrucciones de producción]:
- Tono: [Energético / Calmado / Autoridad / Conversacional]
- Música de fondo: [Sí/No, tipo de mood]
- SFX: [Si aplica]
- Velocidad de locución: [Normal / Ligeramente rápido]
```

---

## Fase 3: Versiones por Género de Podcast

### Adaptación por Audiencia

| Género | Tono del Script | Qué Resonará | Evitar |
|---|---|---|---|
| Negocio/Emprendimiento | Directo, práctico, ROI-focused | Resultados, ahorro de tiempo, eficiencia | Lenguaje emocional excesivo |
| Salud/Fitness | Motivacional, aspiracional | Transformación, energía, hábitos | Promesas médicas, hipérboles |
| Comedia | Casual, auto-deprecante, humor sutil | Hook gracioso, promesa con humor | Tono corporativo, rigidez |
| Crimen Real / Misterio | Narrativo, intrigante | Historia alrededor del producto | Interrupciones bruscas al tono |
| Tecnología | Detallado, técnico, features | Specs, integraciones, pro tips | Lenguaje vago o genérico |

---

## Fase 4: URLs de Tracking y Medición

### Framework de Tracking para Podcast Ads

```
## Setup de Tracking

**URL de tracking:** [domain.com/podcast] o [domain.com/[nombreshow]]
**Código de descuento único:** [PODCAST / NOMBRESHOW / CODIGO]
**Pixel o UTM:** utm_source=podcast&utm_medium=sponsorship&utm_campaign=[show]

**Métricas a medir:**
- Visitas a URL de tracking (vanity URL)
- Uso de código de descuento
- Comparar CVR de tráfico podcast vs otros canales
- Revenue atribuido a código de podcast

**Ventana de atribución:** 7-30 días post-episodio
(Los oyentes a veces actúan días después de escuchar)
```

---

## Anti-Patrones

- **NO** escribir copy que suene como un anuncio de TV — el podcast es íntimo, conversacional
- **NO** incluir más de 2-3 puntos clave — el oyente está en movimiento, no puede procesar una lista larga
- **NO** usar jerga corporativa — "soluciones innovadoras", "de clase mundial", "ecosistema"
- **NO** dar URL complicadas o muy largas — si no se puede deletrear fácilmente, no funcionará
- **NO** olvidar deletrear la URL lentamente — los oyentes van en el auto, no pueden leer
- **NO** asumir que el host lo mejorará — entrega el script completo, pueden adaptarlo

---

## Outputs Esperados

Al completar este skill, el usuario tiene:
1. Script completo de host-read o pre-producido según colocación
2. Versión adaptada al género/tono del podcast
3. Setup de tracking con URL y código únicos
4. Instrucciones de producción si es pre-producido
5. Variación A/B si se solicitan pruebas de mensaje
