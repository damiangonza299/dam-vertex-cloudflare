---
name: ui-ux-pro-max
description: "UI/UX profesional orientado a conversión para landings DAM Vertex. CRO, jerarquía de atención, flujo de decisión, mobile-first. Referencia luna-mini y reloj-imperial-verde."
allowed-tools: Read Write Edit Glob Grep
metadata:
  type: skill
  version: "1.0"
  author: DAM Vertex AI System
---

# UI/UX Pro Max — Diseño que Convierte

## Cuándo usar este skill

Siempre que se genere o edite una landing de producto. Aplicar junto a `frontend-design.md`, `animate.md` y `web-design-guidelines.md`.

---

## Flujo de decisión del usuario

Cada landing debe guiar al usuario por este camino:

```
Atención (hero) → Interés (problema/mecanismo) → Deseo (prueba social/beneficios) → Acción (CTA)
```

Nunca pedir acción antes de haber generado interés. El primer CTA visible debe estar precedido por al menos una promesa clara.

---

## Hero: principios de conversión

### Above the fold obligatorio

- H1 con promesa de beneficio (no feature) — primera frase
- CTA principal visible sin scroll en mobile (375px viewport)
- Precio o indicador de valor — no ocultar detrás de scroll
- Imagen del producto real — no ilustraciones genéricas

### Estructura de hero (en orden de jerarquía visual)

```
1. Imagen producto (o izquierda en desktop)
2. Overline (eyebrow) — 2-3 palabras en uppercase
3. H1 — promesa principal
4. Subhead — mecanismo o diferenciador (1 línea)
5. Precio
6. Badges de logística (entrega, pago)
7. Prueba social inline (★ + "X pedidos")
8. CTA principal
9. Nota de seguridad ("Sin pago anticipado")
```

---

## CTA: reglas de diseño

- Un solo CTA primario por sección visible
- Texto: verbo + objeto + urgencia → "Quiero la mía hoy →"
- Nunca "Comprar" o "Enviar" solos — demasiado genérico
- Botón primario: fondo sólido de alto contraste, sin gradiente
- Ancho: 100% en mobile, `max-content` en desktop con padding generoso
- Repetir CTA en: hero, sección beneficios/efecto, sección cierre
- Sticky CTA en mobile: visible solo fuera del hero

---

## Modal: estructura obligatoria

```
1. Urgencia (línea roja o neutral) — "🔒 Precio de lanzamiento"
2. Botón cerrar (X)
3. Título — "Hacé tu pedido"
4. Subtítulo — "Estás a un paso de recibir tu {producto}"
5. Selector de oferta — 3 combos OBLIGATORIOS:
   - 1 unidad (sin badge)
   - 2 unidades (badge: "🔥 Más elegido")
   - 3 unidades (badge: "⭐ Mayor ahorro")
6. Campos: nombre, teléfono, ubicación
7. Upsells secundarios (express, factura) — MISMO espaciado entre sí
8. Confirm intent checkbox
9. Submit button
```

El modal define la conversión real. Si el modal está mal, la landing no convierte.

---

## Prueba social: cómo presentarla

### Testimonios (si existen datos reales)

- Nombre + ciudad → credibilidad geográfica
- Resultado específico → no "excelente producto"
- Máximo 3 testimonios por landing
- NO inventar nombres, ciudades o "pedido verificado"

### Prueba social genérica (si no hay datos)

```html
<div class="spi">
  <span class="spi-stars">★★★★★</span>
  <span class="spi-text">+50 pedidos entregados en Gran Asunción</span>
</div>
```

Usar contadores reales de pedidos si están disponibles.

---

## Jerarquía visual por sección

### Sección con imagen + texto (split)

```
[ IMAGEN 4:5 ]  |  Overline
                |  H2 (headline)
                |  Body copy (1-2 párrafos)
                |  Lista de beneficios (✓)
                |  CTA secundario
```

### Sección de grid (3 cols)

```
Overline
H2
[Card 1]  [Card 2]  [Card 3]
```

La overline y el H2 siempre encima del grid, nunca dentro.

---

## Patrones de urgencia y escasez

- Stock limitado: "Stock inicial limitado — pocas unidades"
- Entrega: "Sale hoy · Central" con dot animado
- Precio: "Precio de lanzamiento — sube cuando se agote el stock"
- Demanda: "Alta demanda esta semana" (logistics strip)

Nunca usar urgencia falsa que no pueda sostenerse. Usar solo si es real.

---

## Mobile-first: reglas específicas

- Tap targets: mínimo 44×44px
- Spacing entre elementos clickeables: mínimo 8px
- Evitar texto < 12px en mobile
- Modales: máximo 90vh, scroll interno con `-webkit-overflow-scrolling: touch`
- Imágenes hero en mobile: `aspect-ratio: 1` o `4:5` — nunca `16:9`
- Sticky CTA: visible solo en mobile (oculto en > 700px)

---

## Anti-patrones de UX

- NO mostrar precio sin contexto (siempre acompañar de beneficio)
- NO forms de más de 4 campos visibles (el resto: progresivos)
- NO CTAs que dicen "Ver más" — siempre acción concreta
- NO carruseles — aumentan bounce, disminuyen conversión
- NO pop-ups de entrada — arruinan la primera impresión
- NO pedir email si no hay un email flow conectado
