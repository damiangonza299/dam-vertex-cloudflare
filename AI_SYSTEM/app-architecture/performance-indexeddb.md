# Performance y IndexedDB — Reglas de Optimización

Para apps PWA que usan IndexedDB como caché local y Firestore como fuente de verdad.

---

## Renders

- Evitar rerenders completos de listas grandes
- Actualizar nodos específicos del DOM cuando cambia un dato
- Usar `document.getElementById` o referencias guardadas, no re-query del DOM entero
- Si se actualiza un ítem de una lista, actualizar ese nodo — no regenerar toda la lista

---

## innerHTML

- Evitar `innerHTML` masivo en respuesta a cada cambio de estado
- `innerHTML` está bien para render inicial
- Para actualizaciones frecuentes: manipulación de nodos específicos
- Si hay que re-renderizar una lista completa frecuentemente, es una señal de arquitectura a revisar

---

## Event listeners

- Evitar agregar el mismo listener múltiples veces
- Remover listeners antes de re-agregar si el elemento se recrea
- Usar event delegation cuando hay listas dinámicas de items
- Verificar si el listener ya existe antes de agregarlo en funciones que se ejecutan varias veces

---

## CSS legacy

- Limpiar clases que ya no se usan cuando se cambia una sección
- No dejar `display: none` como método de "eliminar" — remover el nodo si no se necesita
- Evitar estilos en línea redundantes cuando hay clases CSS disponibles

---

## Operaciones IndexedDB

- Las operaciones son asíncronas — siempre usar `await` o Promise correctamente
- Abrir la conexión una vez, reutilizarla — no abrir/cerrar en cada operación
- Transacciones de escritura: agrupar operaciones relacionadas en una sola transacción
- Leer antes de escribir cuando es necesario validar unicidad
- Manejar errores de IndexedDB explícitamente — fallar silenciosamente rompe la UX

---

## UI después de operaciones

- No bloquear la UI mientras IndexedDB escribe
- Actualizar la UI optimistamente cuando sea seguro, luego confirmar con DB
- Después de guardar/eliminar: no esperar re-fetch completo para actualizar la vista
- Eliminar: remover el nodo del DOM inmediatamente, luego eliminar de DB

---

## Navegación

- Mantener navegación fluida entre vistas
- No recargar la app completa para cambiar de módulo
- Si la navegación se siente lenta, revisar si hay operaciones bloqueantes en el camino
- Las transiciones entre pantallas no deben esperar datos que no son necesarios para render inicial

---

## Sincronización Firestore ↔ IndexedDB

- Estrategia recomendada: cache-first para reads, write-through para writes
- Al iniciar: cargar desde IndexedDB, luego actualizar con Firestore en background
- Mostrar datos locales mientras llegan los remotos — no pantalla en blanco
- Conflictos: Firestore gana sobre IndexedDB (es la fuente de verdad)

---

## Diagnóstico de performance

Si una operación se siente lenta, revisar en orden:
1. ¿Hay re-render innecesario de componentes grandes?
2. ¿Hay operación bloqueante en el critical path?
3. ¿Hay listeners duplicados disparándose?
4. ¿Hay fetch a Firestore que debería venir de caché local?
5. ¿Hay animación CSS costosa corriendo durante la operación?
