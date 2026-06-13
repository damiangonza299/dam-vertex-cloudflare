---
name: tracking-capi
description: "Skill operacional para Meta Pixel y Conversions API (CAPI). Cubre arquitectura de eventos, user_data, deduplicación, fbc/fbp, y auditoría obligatoria antes de modificar cualquier evento. LEER ESTE SKILL ANTES DE TOCAR CUALQUIER ARCHIVO DE TRACKING."
allowed-tools: Read Glob Grep
metadata:
  type: skill
  version: "1.0"
  author: DAM Vertex AI System
---

# Tracking CAPI — Meta Pixel + Conversions API

**Regla crítica:** No modificar ningún archivo de tracking sin leer este skill completo primero. Un cambio en CAPI incorrecto puede contaminar el aprendizaje del algoritmo Meta durante 7–14 días.

---

## Cuándo Usar Este Skill

- Modificar eventos de Pixel o CAPI
- Agregar un evento nuevo
- Modificar user_data de cualquier evento
- Diagnosticar cobertura de matching
- Verificar deduplicación Pixel↔CAPI
- Auditar fbc/fbp/user_data

---

## Arquitectura del Sistema

```
EVENTO              FRONTEND (fbq)          BACKEND (CAPI)          ARCHIVO BACKEND
────────────────────────────────────────────────────────────────────────────────────
ViewContent       → fbq('ViewContent')   → /api/meta-event        meta-event.js
AddToCart         → fbq('AddToCart')     → /api/meta-event        meta-event.js
InitiateCheckout  → fbq('Checkout')      → /api/meta-event        meta-event.js
QualifiedLead     → [sin fbq]            → /api/leads             leads.js
Purchase          → [sin fbq]            → /api/confirm-purchase  confirm-purchase.js
HighValuePurchase → [sin fbq]            → /api/confirm-purchase  confirm-purchase.js
VIPPurchase       → [sin fbq]            → /api/confirm-purchase  confirm-purchase.js
FastBuyer         → [sin fbq]            → /api/confirm-purchase  confirm-purchase.js
ComboBuyer        → [sin fbq]            → /api/confirm-purchase  confirm-purchase.js
```

Los eventos duales (ViewContent, AddToCart, InitiateCheckout) se deduplicán via `event_id` idéntico entre fbq y CAPI.

---

## Archivos Clave

```
public/assets/js/tracking.js        ← Pixel init + sendCAPI frontend
public/assets/js/products.js        ← form handler, construcción de capiLead
functions/api/meta-event.js         ← proxy CAPI para eventos duales
functions/api/leads.js              ← QualifiedLead CAPI
functions/api/confirm-purchase.js   ← Purchase + todos los eventos derivados
```

---

## Cobertura de user_data por Evento

Estado actual (post-fix 2026-06-12):

| Campo | ViewContent | AddToCart | InitiateCheckout | QualifiedLead | Purchase |
|---|:---:|:---:|:---:|:---:|:---:|
| em | ❌ | ❌ | ❌ | ❌ | ❌ |
| ph | ❌ | ❌ | ✅ | ✅ | ✅ |
| fn | ❌ | ❌ | ✅ | ✅ | ✅ |
| ln | ❌ | ❌ | ⚠️ | ⚠️ | ⚠️ |
| ct | ❌ | ❌ | ⚠️ | ⚠️ | ⚠️ |
| country | ❌ | ❌ | ✅ | ✅ | ✅ |
| external_id | ❌ | ❌ | ✅ | ✅ | ✅ |
| client_ip_address | ✅ | ✅ | ✅ | ✅ | ✅ |
| client_user_agent | ✅ | ✅ | ✅ | ✅ | ✅ |
| fbc | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| fbp | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| event_id | ✅ | ✅ | ✅ | ✅ | ✅ |

✅ SIEMPRE | ⚠️ A VECES | ❌ NUNCA

**Brecha conocida:** `em` (email) es 0% en todos los eventos. El formulario no recoge email por decisión de no aumentar fricción. Pendiente de evaluación futura.

---

## Deduplicación Pixel ↔ CAPI

El `event_id` debe ser idéntico entre el `fbq()` del browser y el payload CAPI del servidor.

### Formatos de event_id por evento

```
ViewContent:       vc_{slug}_{ts}_{rnd4}
AddToCart:         atc_{slug}_{ts}_{rnd4}
InitiateCheckout:  ic_{slug}_{ts}_{rnd4}
QualifiedLead:     ql_{slug}_{ts}_{rnd4}
Purchase:          pur_{lead.id}_{ts}_{rnd4}
HighValuePurchase: hvp_{lead.id}_{ts}       ← sin random
VIPPurchase:       vip_{lead.id}_{ts}       ← sin random
FastBuyer:         fb_{lead.id}_{ts}        ← sin random
ComboBuyer:        cb_{lead.id}_{ts}        ← sin random
```

El `rnd4` = 4 chars de `Math.random().toString(36)`. Los eventos derivados (hvp, vip, fb, cb) son solo CAPI — no tienen contraparte fbq — por eso no necesitan random para deduplicación.

**Nunca cambiar el formato de event_id sin actualizar también el frontend.**

---

## fbc y fbp — Origen y Comportamiento

### _fbp (Meta browser ID)

- Generado por el Pixel de Meta al primer pageview
- Almacenado en cookie `_fbp` con dominio `.damvertex.com`
- Capturado en frontend: `document.cookie` → `getCookie('_fbp')`
- Enviado en cada `sendCAPI()` call via objeto `client`

### _fbc (Click ID)

- Generado cuando `fbclid` está en la URL al arribar
- Formato: `fb.1.{timestamp}.{fbclid}`
- Si no hay `fbclid`, `_fbc` no se genera → `fbc` no se envía
- Almacenado en localStorage `dv_attr` con TTL 90 días
- La función `getFbc()` en tracking.js lo construye desde `fbclid` o lo recupera de localStorage

### Attribution System

Archivo: `public/assets/js/tracking.js` (función `initAttribution`)

```javascript
// Jerarquía de atribución (7-day TTL)
// 1. fbclid en URL actual → más reciente gana
// 2. UTM params en URL actual
// 3. Atribución existente en localStorage (si tiene fbclid)
// 4. Atribución existente en localStorage (si tiene UTM)
```

---

## Normalización — Reglas Exactas

### Teléfono — formato Paraguay

Función: `normalizePhone` / `normPhone` / `normalizePhoneQL`
Resultado: `595XXXXXXXXX` (12 dígitos, prefijo 595)

```javascript
// Lógica idéntica en los 3 backends:
const d = (raw || '').replace(/\D/g, '');
if (!d) return '';
if (d.startsWith('595')) return d.slice(0, 12);
if (d.startsWith('0'))   return '595' + d.slice(1);
return '595' + d;
```

### Texto PII (nombre, ciudad)

Función: `normalizeForMeta` / `normForMetaQL`

```javascript
(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
```

NFD separa los diacríticos del carácter base. El regex elimina el rango U+0300–U+036F. Resultado: "García" → "garcia", "Asunción" → "asuncion".

### SHA256 — hashing

```javascript
async function sha256(str) {
  if (!str) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str.trim().toLowerCase()));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
```

**Todos los campos PII se hashean antes de enviar a Meta.** Nunca enviar PII en texto claro.

---

## Checklist de Auditoría — Obligatorio Antes de Modificar Tracking

1. Identificar exactamente qué evento y qué campo se va a tocar
2. Leer el archivo fuente completo (no solo la función)
3. Verificar que el event_id no cambia de formato
4. Verificar que la deduplicación Pixel↔CAPI sigue intacta
5. Verificar que ph y external_id siguen siendo el mismo hash
6. Verificar que fbc/fbp no se omiten cuando existen
7. Si se toca Purchase: confirmar que stock_deduction y Dam Finanzas notify siguen en el mismo try/catch scope
8. Post-deploy: verificar en Meta Events Manager que los eventos llegan y no se duplican

---

## Reglas Críticas — NO Tocar Sin Auditoría

- **Purchase** (`confirm-purchase.js`): cualquier cambio afecta stock, CAPI, Dam Finanzas y Telegram en la misma función
- **QualifiedLead** (`leads.js`): se dispara una vez por lead — errores no se recuperan
- **event_id format**: cambiar el formato rompe la deduplicación retroactivamente para los eventos en vuelo
- **normalizePhone**: el formato 595XXXXXXXXX es el acordado con Meta para Paraguay — no cambiar sin validación

---

## Anti-Patrones

- **NO** enviar user_data con strings vacíos (`''`) — Meta los recibe y generan ruido; omitir si nulo
- **NO** duplicar eventos de Pixel y CAPI sin mismo event_id
- **NO** usar `event_id` estático o sin componente temporal — colisionan entre múltiples leads
- **NO** hashear el teléfono sin normalizar primero a 595XXXXXXXXX
- **NO** incluir `em` vacío — mejor no incluir el campo si email no está disponible
- **NO** tocar Purchase sin leer confirm-purchase.js completo, incluyendo secciones de stock y DAM Finanzas
