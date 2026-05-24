---
name: estrategia-descuentos
description: "Planifica campañas de precios promocionales con tipos de descuento, timing, guardarraíles seguros de margen, y calendarios de promoción. Úsalo cuando un usuario quiera ejecutar una venta, crear oferta promocional, o planear descuentos estacionales sin destruir márgenes de ganancia."
allowed-tools: Read Write Glob
metadata:
  author: Imperio Digital
  version: "1.0"
---

# Estrategia de Descuentos

## Principio Fundamental

NUNCA DESCUENTES SIN UN FLOOR DE MARGEN — CADA PROMOCIÓN DEBE TENER UN UMBRAL DE GANANCIA MÍNIMO CALCULADO ANTES DEL LANZAMIENTO.

---

## Cuándo Usar Este Skill

- Usuario quiere ejecutar venta o campaña de precios promocionales
- Usuario necesita elegir entre tipos de descuento
- Usuario está planeando promociones estacionales o de vacaciones
- Usuario está preocupado por descontar demasiado agresivamente y dañar márgenes

---

## Flujo de Trabajo

### Fase 1: Entiende la Economía de Negocio

1. Reúne números baseline:
   - Punto de precio del producto/servicio
   - Costo de bienes vendidos (COGS) o costo de entrega de servicio
   - Porcentaje de margen bruto actual
   - Valor promedio de orden (AOV)
   - Ingresos y volumen mensual

2. Calcula el floor de margen:
   ```
   Floor de margen = Precio × Margen mínimo aceptable (20%)
   Descuento máximo absoluto = Precio − Floor de margen
   ```

3. **PUNTO DE CONTROL: Si margen bruto está bajo 30%, recomienda promociones de valor-añadido (bonuses, bundles) en lugar de cortes de precio.**

---

### Fase 2: Selecciona Tipo de Descuento

| Tipo de Descuento | Mejor Para | Impacto en Margen | Ejemplo |
|---|---|---|---|
| Porcentaje off | Liquidar inventario, ventas estacionales | Medio-Alto | 20% off todos |
| Cantidad en dólares off | Productos AOV más alto | Medio | $15 off órdenes >$75 |
| Descuento en bundle | Aumentar AOV | Bajo | Compra 3, obtén 15% off |
| BOGO/Gift with purchase | Mover stock lento | Medio | Compra shampoo, obtén travel size gratis |
| Free shipping threshold | Aumentar AOV | Bajo | Envío gratis órdenes >$50 |
| Early-bird pricing | Lanzamientos, cursos | Bajo | $197 primeros 50 (regular $297) |
| Tiered discount | Bulk/wholesale | Bajo-Medio | 10% off 2+, 15% off 4+, 20% off 6+ |
| Flash limitado en tiempo | Urgencia, activación de lista | Alto | 40% off 24 horas |

---

### Fase 3: Diseña la Campaña Promocional

#### Framework de Campaña de Descuento

```
## Campaña Promocional — [Nombre]

**Tipo de descuento:** [Porcentaje / Monto fijo / Bundle / etc.]
**Descuento:** [X% / $X off / Condición]
**Precio regular:** $[X]
**Precio promocional:** $[X]
**Margen a precio regular:** [X]%
**Margen a precio promocional:** [X]%
**¿Margen sobre 20%?** [SÍ / NO — si NO, ajustar]

**Duración:** [Fechas exactas de inicio y fin]
**Urgencia real:** [Qué hace que expire — fecha, stock, slots]
**Canal de distribución:** [Email / Ad / Landing / SMS / WhatsApp]

**Copy de oferta:**
Headline: "[Descuento + producto + beneficio]"
Urgencia: "[Por qué ahora — tiempo, stock, razón]"
CTA: "[Acción específica]"
```

---

### Fase 4: Calendario de Promociones

#### Ventanas de Alta Conversión por Tipo de Negocio

| Momento | Por Qué Funciona | Tipos de Descuento Recomendados |
|---|---|---|
| Lanzamiento de producto | Urgencia de early-bird, primeros compradores | Early-bird, cantidad limitada |
| Black Friday / Cyber Monday | Expectativa cultural de descuentos | Porcentaje off, bundle |
| Inicio de año (Enero) | Resoluciones, nuevo comienzo | Porcentaje off, starter kit |
| Temporada alta del producto | Demanda natural elevada | Urgencia suave, valor añadido |
| Aniversario de empresa | Celebración con propósito | Descuento especial clientes leales |
| Flash Sale (sin motivo) | Interrumpe ciclo de compra pasivo | 24-48 horas, urgencia pura |
| Cumpleaños del cliente | Personalización, lealtad | Descuento personalizado, email |

---

### Fase 5: Psicología de Precios Promocionales

#### Técnicas de Presentación de Descuento

| Técnica | Descripción | Cuando Usar |
|---|---|---|
| **Precio tachado** | ~~$197~~ → $127 | Siempre que haya descuento real |
| **Ahorras $X** | "Ahorras $70 hoy" | AOV más alto — el monto en $ parece grande |
| **X% de descuento** | "35% de descuento" | Porcentaje suena mejor cuando precio es bajo |
| **Urgencia de cantidad** | "Solo 12 unidades al precio de oferta" | Stock real limitado |
| **Urgencia de tiempo** | "La oferta termina en: [countdown]" | Fechas de cierre reales |
| **Bonos por acción rápida** | "Compra en las próximas 2h y recibe X gratis" | Activación rápida sin reducir precio base |

---

## Anti-Patrones

- **NUNCA** recomiendes descuento que caiga margen bruto bajo 20% — este es el floor absoluto para negocio sostenible
- No recomiendes descuentos porcentaje-off mayores a 40% a menos que liquides inventario
- **NO** lanzar descuentos sin fecha de cierre clara — sin urgencia, no hay acción
- **NO** descuento permanente de precio de lista — destruye el precio de referencia
- **NO** descuento sin razón comunicada — el cliente necesita una historia por qué
- **NO** superponer múltiples promociones simultáneas — confunde y canibaliza conversión
- **NO** descontar tu mejor producto sin proteger el precio de referencia futuro

---

## Outputs Esperados

Al completar este skill, el usuario tiene:
1. Tipo de descuento seleccionado con justificación de margen
2. Cálculo de precio promocional con verificación de margen mínimo
3. Framework de campaña completo (copy, duración, urgencia, canal)
4. Calendario de promociones para el trimestre/año
5. Técnicas de presentación de precio para maximizar conversión
6. Lista de anti-patrones para evitar errores de margen
