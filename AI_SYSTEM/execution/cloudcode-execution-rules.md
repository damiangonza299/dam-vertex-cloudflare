# Reglas de Ejecución Técnica en CloudCode

Leer antes de modificar cualquier archivo de código en este repositorio.

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
