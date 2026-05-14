# Push Notifications con Firebase Cloud Messaging

Para PWAs que necesitan notificaciones push en Android (e iOS con limitaciones).

---

## Stack requerido

- **Firebase Cloud Messaging (FCM)** — servicio de push
- **Service Worker** (`firebase-messaging-sw.js`) — recibe mensajes en background
- **Cloud Functions callable** — envía push desde backend
- **Permisos en Google Cloud** — necesarios para que Functions pueda usar FCM

---

## Archivos clave

Cuando haya un problema con push, revisar en este orden:

1. `manifest.json` — `gcm_sender_id` debe estar si se usa GCM legacy
2. `sw.js` o service worker principal — ¿está registrado correctamente?
3. `firebase-messaging-sw.js` — inicialización de Firebase y handler de mensajes
4. Permisos en Google Cloud Console — Cloud Messaging API habilitada
5. Token del dispositivo — ¿se está guardando y actualizando?

---

## Flujo de implementación

### 1. Obtener permiso y token
```js
const permission = await Notification.requestPermission();
if (permission === 'granted') {
  const token = await getToken(messaging, { vapidKey: VAPID_KEY });
  // Guardar token en Firestore asociado al usuario/dispositivo
}
```

### 2. Guardar token por usuario/dispositivo
- Guardar en Firestore: `users/{uid}/tokens/{tokenId}`
- Actualizar token si cambia (FCM puede rotar tokens)
- Eliminar tokens inválidos cuando FCM los rechaza

### 3. Enviar desde Cloud Functions
```js
await admin.messaging().send({
  token: deviceToken,
  notification: { title, body },
  data: { /* payload custom */ }
});
```

### 4. Recibir en background (service worker)
```js
// firebase-messaging-sw.js
messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/icon-192.png'
  });
});
```

---

## Permisos en Google Cloud

Para que Cloud Functions pueda enviar push:
- Habilitar **Firebase Cloud Messaging API** en Google Cloud Console
- La service account de Functions necesita el rol `Firebase Cloud Messaging Admin`
- Si falla con 403: verificar roles en IAM → Service Accounts

---

## Limitaciones iOS

- iOS solo soporta push en PWAs instaladas desde Safari (iOS 16.4+)
- El usuario debe instalar la PWA ("Agregar a pantalla de inicio") antes de poder recibir push
- No funciona en Safari sin instalación
- Mostrar instrucciones de instalación antes de pedir permiso de notificaciones en iOS
- Probar en dispositivo iOS real — el simulador no reproduce el comportamiento

---

## Diagnóstico

Si los push no llegan:
1. ¿El service worker está registrado? → DevTools → Application → Service Workers
2. ¿El token se está guardando en Firestore?
3. ¿La Cloud Function está ejecutándose sin errores? → Firebase Console → Functions → Logs
4. ¿El usuario dio permiso de notificaciones? → DevTools → Application → Notifications
5. ¿FCM API está habilitada en Google Cloud Console?
6. En iOS: ¿la PWA está instalada?
