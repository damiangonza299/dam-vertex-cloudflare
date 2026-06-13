---
name: whatsapp-closing
description: "Skill operacional para cierre de ventas via WhatsApp en Paraguay. Cubre flujo Central vs Interior, reglas de pago, delivery, manejo de leads vencidos/cancelados y rol de la IA como coordinador logístico. Cargar cuando se trabaja en flujo de cierre o atención post-lead."
allowed-tools: Read Glob
metadata:
  type: skill
  version: "1.0"
  author: DAM Vertex AI System
---

# WhatsApp Closing — Flujo de Cierre Paraguay

WhatsApp no es un canal opcional. Es el canal de cierre principal del negocio. El algoritmo de Meta optimiza para llevar leads aquí. Todo el trabajo de landing y CAPI culmina en esta conversación.

---

## Cuándo Usar Este Skill

- Definir o revisar mensajes de cierre WhatsApp
- Configurar texto pre-cargado del botón CTA
- Diseñar flujo de respuesta a leads
- Resolver situaciones con leads vencidos que re-contactan
- Definir reglas de delivery por zona

---

## Arquitectura del Flujo

```
Meta Ad
  ↓
Landing (damvertex.com/reloj/, /cadena/, etc.)
  ↓
CTA "Pedí al WhatsApp" → abre wa.me/{número} con texto pre-cargado
  ↓
WhatsApp → Operador (o respuesta manual/coordinada)
  ↓
Pedido tomado → Admin Panel → status='pending'
  ↓ [QualifiedLead CAPI dispara aquí, al insertar en D1]
Delivery coordinado
  ↓
Entrega confirmada → Admin Panel → "Confirmar compra" → status='purchased'
  ↓ [Purchase CAPI dispara aquí]
```

---

## Central vs Interior — Reglas de Pago y Delivery

### Central (Asunción + Gran Asunción)

- **Pago:** al recibir — no pedir adelanto
- **Delivery:** motorizado propio o tercero, mismo día o día siguiente
- **Garantía de entrega:** alta — no enviar datos bancarios al cliente
- **Mensaje:** nunca mencionar transferencia bancaria a clientes de Central

### Interior (resto del país)

- **Pago:** adelantado o transferencia previa requerida antes de enviar
- **Delivery:** encomienda (Libus, Jet, o equivalente)
- **Tiempo:** 1–3 días hábiles según ciudad
- **Mensaje:** explicar la condición de pago antes de confirmar

### Cómo Identificar la Zona

La landing captura `location_city` vía el picker de ubicación. Si es:
- Asunción, Luque, San Lorenzo, Lambaré, Fernando de la Mora, Capiatá, Mariano Roque Alonso, etc. → **Central**
- Cualquier otra ciudad → **Interior** (confirmar con el cliente)

---

## Texto Pre-Cargado de WhatsApp

El texto pre-cargado en el CTA de la landing debe incluir:
1. Nombre del producto
2. Variante elegida (si aplica)
3. Ciudad del cliente (para identificar zona rápido)

Ejemplo:
```
Hola! Quiero pedir un Reloj Blackout Minimal, color Negro. Estoy en Asunción.
```

No incluir precio en el texto pre-cargado — puede cambiar y genera confusión.

---

## Rol de la IA — Coordinador Logístico

La IA no cierra ventas autónomamente. El cierre es humano. La IA actúa como:

1. **Preparador de mensajes:** drafts de respuesta para cada etapa (saludo, confirmación, delivery)
2. **Detector de zona:** clasifica Central vs Interior según `location_city` en D1
3. **Coordinador de stock:** verifica disponibilidad antes de confirmar pedido
4. **Alerta de stale:** notifica cuando un lead lleva > 2h sin respuesta en horario hábil
5. **No automatizador de decisiones de precio o descuento** sin autorización explícita

---

## Reglas de Atención

### No Bombardear

- Máximo 2 mensajes seguidos sin respuesta del cliente
- Esperar al menos 2h antes de reintento fuera de horario pico
- No enviar el mismo mensaje dos veces — siempre variar el ángulo

### Horario Hábil Paraguay

- Lunes a viernes: 8h–20h (America/Asuncion)
- Sábados: 8h–14h
- Domingos y feriados: sin contacto salvo que el cliente inicie

### Escalamiento Urgente

Si un lead de alto valor (>= Gs. 199.000) no responde en 4h en horario hábil:
1. Reintento con ángulo diferente (urgencia de stock, no de precio)
2. Si sigue sin respuesta → marcar como `stale` en Admin Panel
3. No cancelar automáticamente — puede reactivarse

---

## Manejo de Leads Vencidos que Vuelven

Cuando un lead `status='cancelled'` o `status='pending-stale'` escribe de nuevo:

1. **No crear lead nuevo** — buscar el original en Admin Panel por teléfono
2. **Reactivar el lead original**: cambiar `status='pending'`, actualizar notas
3. **No disparar QualifiedLead CAPI de nuevo** — el evento ya se disparó; duplicarlo contamina Meta
4. Si el cliente quiere comprar algo diferente: confirmar el nuevo producto antes de actualizar `product_name`
5. Si ya pasaron > 30 días del lead original: analizar si crear uno nuevo tiene más sentido para el historial D1

---

## Mensajes Clave por Etapa

### Saludo inicial (respuesta a WhatsApp incoming)

```
Hola [nombre si lo tienen]! Gracias por escribirnos 🙌
Te confirmo que tenemos stock disponible del [producto].
¿Desde qué ciudad nos escribís?
```

### Confirmación de pedido

```
Perfecto, anoto tu pedido:
📦 [Producto] — [Variante]
📍 [Ciudad]
💰 Gs. [precio] — [condición de pago según zona]

¿Te parece bien? Confirmamos y coordinamos la entrega.
```

### Delivery coordinado (Central)

```
Listo, tu pedido está confirmado ✅
Te llega hoy/mañana en horario [hora].
Pagás cuando lo recibís — Gs. [precio].
```

### Delivery Interior

```
Confirmado ✅ Te mandamos por [encomienda].
Primero necesitamos el pago por adelantado:
[No enviar datos bancarios aquí — coordinar por llamada o mensaje privado seguro]
Tiempo estimado: [X días] a [ciudad].
```

---

## Anti-Patrones

- **NO** enviar datos bancarios por WhatsApp a clientes de Central (innecesario, genera confusión)
- **NO** mencionar precios antes de confirmar la zona — Interior puede tener envío
- **NO** crear lead nuevo si ya existe uno activo del mismo teléfono
- **NO** confirmar stock sin verificar D1 primero — confirmar-purchase.js lo rechazará si no hay stock
- **NO** usar WhatsApp para anunciar descuentos no autorizados — escala de precios la define el operador
- **NO** dejar leads en `status='pending'` más de 48h sin acción — impacta el score real del sistema
