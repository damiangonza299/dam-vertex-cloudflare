# Mobile First Conversion

Reglas de diseño y desarrollo para landing pages optimizadas para mobile en Paraguay.

---

## Above the fold mobile

El primer pantallazo debe contener:
- Qué es el producto (imagen o video)
- Cuál es el deseo o transformación que ofrece
- CTA a WhatsApp visible sin scrollear

Si falta cualquiera de los tres, hay trabajo por hacer.

---

## Botones y CTAs

- Altura mínima de botón: 48px (área táctil segura)
- Ancho: mínimo 80% del viewport en mobile
- Botón de WhatsApp fijo (sticky) en la parte inferior si es posible
- Color con contraste suficiente — no depender del borde para distinguirlo
- Texto legible sin zoom: mínimo 16px

---

## WhatsApp

- Siempre visible
- Link directo con número completo y mensaje pre-armado
- Formato: `https://wa.me/595[número]?text=[mensaje codificado]`
- Texto del botón claro: "Pedí por WhatsApp" o "Consultá disponibilidad"
- No esconder detrás de un accordion ni al final de la página

---

## Imágenes

- Comprimir antes de subir — objetivo < 150KB por imagen visible
- Formato WebP cuando sea posible
- Lazy load para imágenes que no están above the fold
- No usar imágenes decorativas que pesen y no aportan

---

## Scripts y rendimiento

- Evitar scripts de terceros innecesarios en el critical path
- Pixel y CAPI son necesarios — resto evaluarlos
- No cargar librerías JS pesadas para efectos que se pueden hacer en CSS
- Comprobar que la página pasa LCP < 2.5s en mobile con 4G simulado

---

## Animaciones

- Evitar animaciones que bloquean la lectura del contenido
- Scroll animations solo si no afectan la carga
- Parallax pesado = fuera
- Transiciones CSS simples: aceptables
- Regla: si la animación no refuerza el mensaje de venta, no va

---

## Estructura de secciones

1. Hero — producto + deseo + CTA
2. Beneficio clave / diferencial
3. Prueba social (fotos, testimonios, número de pedidos)
4. Detalles de producto (variantes, materiales, tallas si aplica)
5. Oferta + precio + garantía
6. CTA final + respuesta a objeciones frecuentes

Cada sección: corta, título claro, texto mínimo.

---

## Tipografía mobile

- Tamaño mínimo de texto: 16px
- Títulos: 24px a 32px
- Interlineado cómodo para lectura rápida
- No usar fuentes decorativas en texto de cuerpo
- Contraste suficiente sobre cualquier fondo

---

## Validación antes de publicar

- [ ] Abre sin errores en Chrome mobile
- [ ] Botón de WhatsApp funciona
- [ ] Imágenes se ven sin pixelación
- [ ] CTA visible sin scrollear
- [ ] Carga en menos de 3 segundos en red lenta
- [ ] No hay scroll horizontal accidental
