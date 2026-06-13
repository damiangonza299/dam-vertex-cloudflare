---
name: stock-inventory
description: "Skill operacional para gestión de stock e inventario en DAM Vertex. Cubre productos, variantes, stock_total, variants_json, flujo de descuento en confirm-purchase, ventas manuales WhatsApp y reglas de auditoría. No tocar stock sin auditoría previa."
allowed-tools: Read Glob Grep
metadata:
  type: skill
  version: "1.0"
  author: DAM Vertex AI System
---

# Stock e Inventario — DAM Vertex

El stock es la fuente de verdad física del negocio. Un error en stock implica ventas de productos que no existen, o bloqueo de ventas de productos disponibles. Ambos son críticos.

---

## Cuándo Usar Este Skill

- Consultar stock actual de un producto o variante
- Entender cómo se descuenta el stock al confirmar una compra
- Diagnosticar errores de "Sin stock" en el flujo de compra
- Agregar stock (nuevo ingreso de mercadería)
- Configurar variantes de un producto
- Auditar discrepancias entre stock D1 y stock físico real

---

## Regla Antes de Tocar Stock

**No modificar stock directamente vía SQL sin auditoría previa.**

Verificar siempre:
1. El stock actual en D1: `SELECT slug, stock_total, variants_json FROM products WHERE slug = ?`
2. Las compras recientes del producto: `SELECT COUNT(*) FROM leads WHERE product_slug = ? AND status = 'purchased' AND purchased_at > datetime('now', '-24 hours')`
3. Si hay discrepancia entre D1 y conteo físico: documentar antes de corregir

---

## Tabla products en D1

```sql
-- Campos relevantes para stock
slug          TEXT PRIMARY KEY      -- identificador único del producto
name          TEXT                  -- nombre completo
stock_total   INTEGER               -- unidades totales disponibles (todas las variantes)
variants_json TEXT                  -- JSON: { "Color": cantidad }
variants_meta_json TEXT             -- JSON: { "Color": { "variantId": "..." } }
active        INTEGER               -- 0 = inactivo, 1 = activo en venta
status        TEXT                  -- 'draft' | 'active'
```

### Formato variants_json

```json
{
  "Negro": 8,
  "Plata": 5,
  "Dorado": 3
}
```

`stock_total` debe ser siempre la suma de todos los valores de `variants_json`.
Si no hay variantes: `variants_json = null` y `stock_total = N`.

---

## Flujo de Descuento de Stock — confirm-purchase.js

Al confirmar una compra desde el Admin Panel, `confirm-purchase.js` ejecuta en este orden:

```
1. Verificar stock ANTES de disparar CAPI Purchase
   → Si sin stock: error 409, no se confirma, no se dispara CAPI

2. Marcar lead como 'purchased' en D1

3. Descontar stock:
   → Producto simple: stock_total -= quantity; variants_json[color] -= 1
   → Combo: reloj stock_total -= 1, cadena stock_total -= 1

4. Notificar Dam Finanzas (webhook)

5. Enviar factura Telegram (si invoice_requested)
```

**El stock se descuenta después del UPDATE de status, no antes.** Si el UPDATE de status falla, el stock no se descuenta. Esto está diseñado para evitar descuentos huérfanos.

---

## Productos y Slugs — Mapping

Los slugs son el identificador canónico en todo el sistema. No cambiarlos en productos activos.

```javascript
// confirm-purchase.js — getProductSlug() MAP
{
  'Reloj Blackout Minimal':                       'reloj',
  'Cepillo Eléctrico Recargable (4 Cabezales)':   'cepillo',
  'Lentes Anti Luz Azul Rojos':                   'lentes',
  'Cadena Apex':                                  'cadena',
  'Combo Reloj Blackout Minimal + Cadena Apex':   'combo-reloj-cadena',
}
```

Si se agrega un producto nuevo, verificar que su slug esté en este MAP. Si no está, `confirm-purchase.js` intentará `slugify(name)` como fallback — puede funcionar, pero no es garantizado para nombres con caracteres especiales.

---

## Combo — Lógica Especial

El combo `combo-reloj-cadena` descuenta stock de DOS productos distintos:

```javascript
// confirm-purchase.js — isCombo flow
[comboRelojRow, comboCadenaRow] = await Promise.all([
  DB.prepare('SELECT * FROM products WHERE slug = ?').bind('reloj').first(),
  DB.prepare('SELECT * FROM products WHERE slug = ?').bind('cadena').first(),
]);
// → si alguno tiene stock_total < 1: error 409
// → si variante solicitada tiene 0: error 409
// Descuento: reloj stock_total -= 1, cadena stock_total -= 1
```

Si hay stock de reloj pero no de cadena: el combo se bloquea correctamente.

---

## Ventas Manuales WhatsApp — Impacto en Stock

Las ventas manuales se confirman desde el Admin Panel usando el mismo botón "Confirmar compra". No hay flujo separado. El descuento de stock ocurre vía `confirm-purchase.js` en todos los casos.

**No existe un flujo de descuento de stock manual que omita confirm-purchase.js.**

Si alguien descuenta stock directamente en D1 por fuera del sistema, Dam Finanzas no recibe el webhook y el inventario financiero queda desincronizado.

---

## Devolución de Stock — Eliminación Interna

Si una compra confirmada se cancela por error (devolución física):

1. **No revertir el `status='purchased'` del lead directamente** — crea inconsistencia en CAPI (Meta ya registró el Purchase)
2. Ajustar stock manualmente via SQL documentado:
   ```sql
   UPDATE products SET stock_total = stock_total + 1 WHERE slug = 'reloj';
   -- Si tiene variante:
   UPDATE products SET variants_json = json_set(variants_json, '$.Negro', json_extract(variants_json, '$.Negro') + 1) WHERE slug = 'reloj';
   ```
3. Documentar la devolución en notas internas
4. Notificar a Dam Finanzas manualmente si afecta el reporte del día

---

## Consultas de Diagnóstico

### Stock actual por producto

```sql
SELECT slug, name, stock_total, active, variants_json
FROM products
ORDER BY active DESC, slug;
```

### Ventas recientes por producto

```sql
SELECT product_slug, product_name, COUNT(*) as ventas, SUM(value) as total
FROM leads
WHERE status = 'purchased'
  AND purchased_at > datetime('now', '-7 days')
GROUP BY product_slug
ORDER BY ventas DESC;
```

### Discrepancia stock vs ventas (últimos 30 días)

```sql
SELECT p.slug, p.stock_total as stock_actual, COUNT(l.id) as ventas_mes
FROM products p
LEFT JOIN leads l ON l.product_slug = p.slug
  AND l.status = 'purchased'
  AND l.purchased_at > datetime('now', '-30 days')
GROUP BY p.slug;
```

---

## Anti-Patrones

- **NO** cambiar `stock_total` directamente sin actualizar también `variants_json` — quedan inconsistentes
- **NO** cambiar el slug de un producto activo — rompe el MAP en `confirm-purchase.js`, `notifyDamFinanzasSale`, y el inventario de Dam Finanzas
- **NO** agregar stock sin verificar qué ocurrió con el stock anterior (puede haber habido conteo incorrecto)
- **NO** descontar stock manualmente por ventas WhatsApp que después se confirman via Admin Panel — el confirm-purchase.js descuenta de nuevo, quedando con stock negativo
- **NO** crear productos con `active=1` sin pasar por Product Studio — el checklist de 11 puntos protege la consistencia
