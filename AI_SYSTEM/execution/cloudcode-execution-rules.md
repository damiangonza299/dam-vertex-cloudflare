# Reglas de Ejecución Técnica en CloudCode

Leer antes de modificar cualquier archivo de código en este repositorio.

---

## UMBRALES OFICIALES DAM VERTEX

DAM VERTEX Paraguay — clasificación de compradores y eventos Meta CAPI. **Prohibido modificar sin decisión de negocio explícita documentada en CLAUDE.md y GEMINI.md.**

| Clasificación | Umbral | Evento CAPI | buyer_type D1 |
|---|---|---|---|
| Alto valor | >= 199.000 Gs | `HighValuePurchase` | `alto_valor` |
| VIP | >= 300.000 Gs | `HighValuePurchase` + `VIPPurchase` | `vip` |
| Ultra VIP | >= 500.000 Gs | `HighValuePurchase` + `VIPPurchase` (sin CAPI dedicado) | `ultra_vip` |
| Fast Buyer | compra en < 24h | `FastBuyer` (solo server-side CAPI, nunca Pixel) | `rapido` |

**Mapping CAPI ↔ DAM Intelligence:**
- `HighValuePurchase` Meta = Alto Valor DAM VERTEX (>= Gs. 199.000)
- `VIPPurchase` Meta = VIP DAM VERTEX (>= Gs. 300.000)
- `FastBuyer` Meta = Fast Buyer (< 24h) — nunca duplicar en Pixel/browser
- `Purchase` Meta = toda compra confirmada, sin umbral de valor

**Archivos:** `functions/api/intelligence/_bqe-scorer.js` · `functions/api/confirm-purchase.js`

---

## REGLA CRÍTICA DE DEPLOY — DAM VERTEX

> **Incidente 2026-06:** `wrangler pages deploy .` (raíz) subió estáticos bajo `/public/reloj/`, `/public/cadena/` etc. Landings en 404 en producción. `node_modules` incluido. **Este error no puede repetirse.**

### Único comando correcto de producción

```powershell
& "C:\Program Files\nodejs\npx.cmd" wrangler pages deploy public --project-name=dam-vertex-cloudflare --branch=dam-vertex-cloudflare --commit-dirty=true
```

### PROHIBIDO — si se intenta usar, bloquear y corregir

- `wrangler pages deploy .` — deploya desde raíz, rompe todas las rutas estáticas
- `wrangler pages deploy` — sin directorio explícito usa raíz
- `npx wrangler pages deploy .` — ídem
- Deploy sin `--branch=dam-vertex-cloudflare` → va a preview, no producción
- Deploy sin verificar `pages_build_output_dir = "public"` en `wrangler.toml`

### Checklist pre-deploy (10 puntos obligatorios)

1. Leer `wrangler.toml` — confirmar `pages_build_output_dir = "public"`
2. Confirmar directorio a deployar: `public/` (no `.` ni raíz del repo)
3. Confirmar `--branch=dam-vertex-cloudflare`
4. Confirmar branch de producción correcto (no main → preview)
5. Confirmar que `.dev.vars`, `node_modules/`, archivos internos no se suben
6. Confirmar que el Functions bundle se genera correctamente
7. Confirmar que no hay cambios críticos sin commit
8. Confirmar que rutas críticas responderán 200 (no hay renames/moves de archivos)
9. Confirmar que no se está deployando a preview por error
10. Post-deploy: probar las 8 rutas críticas antes de declarar éxito

### Rutas críticas — verificar 200 post-deploy

```
https://damvertex.com                          → 200
https://damvertex.com/reloj/                   → 200
https://damvertex.com/cadena/                  → 200
https://damvertex.com/admin/                   → 200
https://damvertex.com/intelligence/            → 200
/api/admin-leads                               → 200
/api/intelligence/alerts                       → 200
/api/intelligence/ping-telegram                → 200
```

**Si alguna falla → NO declarar deploy exitoso. Detenerse y corregir.**

### Script de deploy seguro

```powershell
.\scripts\deploy-production.ps1
```

Verifica `wrangler.toml`, ejecuta el deploy correcto, prueba rutas automáticamente.

---

## Antes de tocar código

1. **Leer los archivos reales** — no asumir estructura, nombres de funciones o rutas
2. **Identificar el archivo exacto** que corresponde a la tarea
3. **Entender el contexto** — qué hace el archivo, qué toca, qué podría romper
4. **Si hay duda, inspeccionar antes** — nunca adivinar

---

## Cambios

- Hacer el cambio mínimo necesario para cumplir la tarea
- No refactorizar código adyacente que no sea parte del pedido
- No agregar features que no se pidieron
- No cambiar nombres de variables, funciones o archivos sin pedido explícito
- Explicar qué archivo exacto se tocó y en qué línea

---

## Lo que NO tocar nunca (salvo pedido explícito)

| Área | Razón |
|---|---|
| Configuración del Pixel (fbq calls) | Romper eventos destruye el aprendizaje de Meta |
| Conversions API (CAPI) | Duplicar o perder eventos = datos corruptos |
| Evento Purchase | Solo disparar en flujo correcto y completo |
| Links de WhatsApp | Si se rompen, se pierde el canal de cierre |
| Lógica de stock/admin | Afecta operación real del negocio |
| Base de datos (D1/KV) | Sin backup explícito, no hacer cambios destructivos |
| DAM Finanzas o Turno Axis | No tocar si la tarea es de DAM Vertex Cloudflare |

---

## Tracking — reglas específicas

- El Pixel debe disparar en el orden correcto: ViewContent → AddToCart → InitiateCheckout → Purchase
- Purchase solo cuando el pedido está confirmado por el usuario
- No disparar eventos duplicados
- No agregar `fbq()` calls sin revisar qué eventos ya existen en el flujo
- CAPI y Pixel deben estar deduplicados (mismo `event_id`)

---

## WhatsApp — reglas específicas

- Links de WhatsApp con formato: `https://wa.me/595[número]?text=[mensaje codificado]`
- No cambiar el número de teléfono sin confirmación explícita
- No cambiar el mensaje pre-armado sin confirmación explícita
- Verificar que el link funciona después de cualquier cambio en la landing

---

## Mobile — reglas específicas

- Verificar que cualquier cambio de CSS no rompe el layout mobile
- No agregar estilos que solo funcionan en desktop
- Probar scroll, botones y formularios en viewport mobile
- Mantener el botón de WhatsApp visible y funcional

---

## Cuando algo no está claro

- Preguntar antes de asumir
- Mostrar el archivo y la línea específica donde se haría el cambio
- Confirmar con el usuario si el cambio podría tener efectos secundarios
- No hacer cambios "preventivos" que no se pidieron

---

## Formato de respuesta al hacer cambios

Siempre indicar:
- Archivo modificado (ruta exacta)
- Qué se cambió y por qué
- Si hay algo que verificar después del cambio
- Si el cambio toca tracking, WhatsApp o admin — decirlo explícitamente
