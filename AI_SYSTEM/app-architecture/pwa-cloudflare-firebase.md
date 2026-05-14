# PWA + Cloudflare + Firebase — Arquitectura Base

Para proyectos: DAM Finanzas, Turno Axis y futuras PWAs de Damián.

---

## Stack estándar

| Capa | Tecnología |
|---|---|
| Frontend/Hosting | Cloudflare Pages |
| Auth | Firebase Authentication |
| Base de datos | Firestore (source of truth) |
| Caché offline | IndexedDB |
| Backend opcional | Cloudflare Workers o Firebase Functions |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| Formato | PWA mobile-first |

---

## Principios de arquitectura

### Cloudflare Pages
- Deploy desde repo Git
- Variables de entorno configuradas en el dashboard, no en código
- Assets estáticos servidos desde edge — fast por defecto
- Workers para lógica server-side si es necesario

### Firebase Auth
- Proveedor principal: Google o email/password según el proyecto
- Token de Firebase como credencial para operaciones en Firestore
- No manejar sesiones manualmente — Firebase lo gestiona
- Persistencia de sesión: `LOCAL` para apps que se usan diario

### Firestore
- Source of truth: lo que está en Firestore es lo correcto
- Estructura de datos: colecciones planas > sub-colecciones profundas cuando sea posible
- Reglas de seguridad: siempre configuradas, nunca `allow read, write: if true`
- Offline persistence habilitada para apps que lo necesiten

### IndexedDB
- Caché local para operaciones offline o para no re-fetch en cada render
- Sincronizar con Firestore cuando hay conexión
- No usar como fuente de verdad — solo como caché
- Limpiar datos stale regularmente

---

## Estructura de módulos

- Separar por feature, no por tipo de archivo
- Ejemplo: `/finanzas/`, `/turnos/`, `/auth/` — no `/utils/`, `/helpers/`, `/services/`
- No crear abstracciones hasta que haya al menos 3 usos iguales del patrón

---

## PWA mobile-first

- `manifest.json` completo: nombre, iconos, theme_color, display standalone
- Service worker para caché de assets y offline fallback
- Instalable desde browser en Android (iOS tiene limitaciones)
- Probar en iOS Safari explícitamente — comportamiento diferente a Chrome

---

## Lo que NO hacer

- No acoplar lógica de negocio al componente UI directamente
- No mezclar lógica de Firebase con lógica de render
- No romper UX existente al agregar features nuevas
- No hacer refactoring sin pedido explícito del usuario
- No tocar DAM Finanzas o Turno Axis si la tarea es de DAM Vertex

---

## Antes de modificar una app

1. Leer los archivos actuales del proyecto específico
2. Entender la estructura real, no asumir
3. Hacer el cambio mínimo necesario
4. Verificar que funciona en iOS si toca PWA/service worker
