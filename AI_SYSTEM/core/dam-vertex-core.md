# DAM Vertex Cloudflare — Core Context

Este es el proyecto principal. Tiene prioridad sobre cualquier otro proyecto de Damián.

---

## Qué es

Ecommerce de productos físicos para el mercado paraguayo.
Funnel principal: Meta Ads → Landing/Tienda → WhatsApp → Pedido → Entrega.
Infraestructura: Cloudflare Pages + Workers + D1/KV para el frontend y lógica de negocio.

---

## Contexto de mercado

- **País:** Paraguay (principalmente Asunción y Gran Asunción, con Interior)
- **Cliente:** visual, poco lector, sensible al precio, decide rápido o no decide
- **Canal de cierre:** WhatsApp (no checkout clásico)
- **Pago Central:** acepta pago al recibir
- **Pago Interior:** puede requerir pago adelantado o transferencia previa
- **Dispositivo:** mayoría mobile, conexión variable, muchos en 4G

---

## Prioridades del proyecto (en orden)

1. Ventas reales y pedidos confirmados
2. Conversión de la landing
3. ROAS positivo en Meta Ads
4. Tracking confiable (Pixel + CAPI)
5. Experiencia WhatsApp sin fricción
6. Velocidad de carga mobile
7. Estabilidad técnica del sistema

---

## Principios de diseño

- Conversión antes que estética
- Mobile-first siempre
- Claridad antes que creatividad
- Velocidad antes que animaciones
- CTA a WhatsApp visible y directo
- Texto mínimo, impacto máximo

---

## Tracking

- Meta Pixel activo en frontend
- Conversions API (CAPI) en backend/Workers
- Evento Purchase solo cuando el pedido está confirmado
- No contaminar eventos con clics, vistas o interacciones que no son conversión real
- No tocar la configuración de Purchase salvo que sea parte explícita de la tarea

---

## Meta Ads

- El tráfico entra desde campañas de Meta
- Meta segmenta por creativos, no por intereses (broad targeting)
- Los anuncios crean audiencias, no al revés
- Test agresivo con múltiples campañas por producto
- Evaluación por compras reales + intención + costo, no solo CTR/CPC

---

## Stack técnico

- **Frontend:** HTML/CSS/JS vanilla + Cloudflare Pages
- **Backend:** Cloudflare Workers + D1 (SQLite) + KV
- **Auth/DB apps:** Firebase Auth + Firestore (en proyectos de app)
- **WhatsApp:** links directos con mensaje pre-armado
- **Admin:** panel interno para gestión de pedidos y stock

---

## Proyectos relacionados (secundarios)

- **DAM Finanzas:** app PWA de finanzas personales, Firebase + IndexedDB
- **Turno Axis:** app de gestión de turnos, misma arquitectura base
- No tocar estos proyectos salvo pedido explícito del usuario
