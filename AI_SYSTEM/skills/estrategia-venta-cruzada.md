---
name: estrategia-venta-cruzada
description: "Mapea oportunidades de venta cruzada con lógica de emparejamiento de productos, disparadores de temporización y plantillas de mensajes. Úsalo cuando quieras aumentar los ingresos de clientes existentes."
allowed-tools: Read Write Glob
metadata:
  author: Imperio Digital
  version: "1.0"
---

# Estrategia de Venta Cruzada

## Principio Fundamental

LA VENTA CRUZADA NO SE TRATA DE EMPUJAR MÁS PRODUCTOS — SE TRATA DE RECONOCER QUÉ NECESITA EL CLIENTE A CONTINUACIÓN BASÁNDOSE EN LO QUE YA COMPRÓ Y PRESENTARLO COMO UN PASO NATURAL.

---

## Cuándo Usar Este Skill

- Identificar oportunidades de venta cruzada en tu catálogo de productos
- Diseñar lógica de emparejamiento de productos basada en comportamiento de compra
- Crear plantillas de mensajes para emails de venta cruzada y recomendaciones en sitio
- Construir disparadores de temporización que presenten la oferta correcta en el momento correcto

**NO USES** este skill para upselling (versión superior del mismo producto), aumentos de pedido en el checkout, o adquisición de nuevos clientes. Esto es para vender productos complementarios a clientes existentes.

---

## Fase 1: Brief

### Inputs Requeridos

| Input | Qué Preguntar | Default |
|---|---|---|
| **Catálogo de productos** | "Lista todos tus productos/servicios con precios." | Sin default — debe ser proporcionado |
| **Más vendidos** | "¿Qué productos se venden más?" | Sin default — debe ser proporcionado |
| **Datos de clientes** | "¿Sabes qué compran los clientes juntos?" | Conocimiento anecdótico |
| **Canales de comunicación** | "¿Cómo alcanzas a clientes existentes? (email, in-app, SMS)" | Email |
| **Compras promedio** | "¿Cuántos productos compra un cliente típico?" | 1-2 |

**PUNTO DE CONTROL: Confirma antes de mapear oportunidades de venta cruzada.**

---

## Fase 2: Mapa de Venta Cruzada

### Matriz de Emparejamiento de Productos

```
## Emparejamientos de Venta Cruzada

| Producto Comprado | Venta Cruzada Natural | Razón Lógica | Timing Óptimo |
|---|---|---|---|
| [Producto A] | [Producto B] | [Por qué B complementa A] | [X días post-compra] |
| [Producto A] | [Producto C] | [Por qué C complementa A] | [Y días post-compra] |
| [Producto B] | [Producto D] | [Por qué D complementa B] | [Z días post-compra] |
```

### Lógica de Emparejamiento

Los mejores emparejamientos de venta cruzada cumplen al menos uno:
1. **Complemento funcional** — el producto B mejora el uso del producto A
2. **Siguiente paso natural** — el cliente que tiene A lógicamente necesita B después
3. **Problema adyacente** — A resuelve problema 1, B resuelve problema 2 relacionado
4. **Consumible/repuesto** — A requiere B para funcionar o mantenerse

---

## Fase 3: Disparadores de Temporización

### Framework de Timing por Tipo de Producto

| Tipo de Producto Base | Timing de Venta Cruzada | Razón |
|---|---|---|
| Producto físico / consumible | 7-14 días post-entrega | El cliente ya usó el producto, tiene contexto |
| Curso / info-producto | 3-7 días post-acceso | Cuando ya está enganchado y quiere más |
| Servicio / consultoría | Durante o post-servicio | Cuando el valor está fresco |
| Suscripción | 30-60 días post-inicio | Cuando el cliente validó el valor base |
| Producto de uso rápido | 1-3 días post-compra | El cliente ya experimentó y quiere expandir |

---

## Fase 4: Mensajes de Venta Cruzada

### Plantilla de Email de Venta Cruzada

```
## Email Venta Cruzada — [Segmento: Compradores de Producto A]

**Asunto:** "Ya que tienes [Producto A], esto tiene sentido para ti"
(Alternativas: "El siguiente paso natural después de [A]" / "[X] clientes de [A] también tienen [B]")

**Timing:** [X días después de la compra / entrega confirmada]

**Cuerpo del email:**

Hola [Nombre],

[Observación específica sobre su compra — 1 oración personalizada]

[Puente lógico — por qué el producto B tiene sentido dado que ya tienen A]

**[Nombre del Producto B]** [descripción de 1-2 líneas del beneficio específico]

Lo que obtienes:
• [Beneficio 1]
• [Beneficio 2]
• [Beneficio 3]

[Prueba social específica — clientes que tienen A y B obtienen mejor resultado]

→ [CTA: Ver / Agregar / Aprovechar]

[Firma]
```

### Plantilla de Recomendación en Sitio

```
## Widget de Venta Cruzada — Página de Producto / Post-Compra

**Headline:** "Clientes que compraron [Producto A] también llevan:"
(Alternativas: "Completa tu [resultado] con:" / "El siguiente paso:")

**Formato:** 2-3 productos con imagen, nombre, precio y CTA
**CTA por item:** "Agregar" / "Ver más"

**Posición en página:**
- Post-checkout: Página de confirmación de orden
- En producto: Sección "Frecuentemente comprado junto"
- Email post-compra: 7 días después
```

---

## Fase 5: Segmentación de Clientes para Venta Cruzada

### Priorización por Segmento

| Segmento | Potencial de Venta Cruzada | Approach |
|---|---|---|
| **Clientes recientes (0-30 días)** | Alto — están en modo compra | Email directo, en sitio |
| **Clientes satisfechos (revisión positiva)** | Muy alto — confianza establecida | Email personalizado, oferta especial |
| **Clientes de un solo producto** | Alto — sin cross-sell previo | Secuencia educativa + oferta |
| **Clientes multi-producto** | Medio — ya cruzaron, buscar gaps | Recomendación basada en lo que NO tienen |
| **Clientes inactivos (90+ días)** | Bajo — necesitan reactivación primero | Reactivar antes de cross-sell |

---

## Anti-Patrones

- **NO** ofrecer venta cruzada antes de que el cliente haya recibido / usado el producto inicial
- **NO** recomendar productos sin relación lógica — destruye confianza
- **NO** bombardear con múltiples venta cruzadas al mismo tiempo — una por secuencia
- **NO** usar lenguaje de venta agresiva — "necesitas esto también" vs "esto complementa lo que ya tienes"
- **NO** ignorar el contexto de uso — si A y B no se usan juntos naturalmente, no cruzar
- **NO** hacer venta cruzada si el cliente tuvo mala experiencia con la compra inicial — resolver primero

---

## Outputs Esperados

Al completar este skill, el usuario tiene:
1. Mapa de emparejamientos de venta cruzada para todo el catálogo
2. Timing óptimo por tipo de producto
3. Plantillas de email y mensajes en sitio
4. Segmentación de clientes priorizada para outreach
5. Lógica de emparejamiento documentada para automatización futura
