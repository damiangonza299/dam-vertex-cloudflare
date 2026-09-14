(function() {
  // Solo activar protección en desktop — en mobile no hay DevTools
  var isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)
    || ('ontouchstart' in window && navigator.maxTouchPoints > 1);
  if (isMobile) return; // salir inmediatamente en mobile, sin aplicar nada

  // 1) Deshabilitar clic derecho
  document.addEventListener('contextmenu', function(e) { e.preventDefault(); });

  // 2) Deshabilitar selección de texto
  document.addEventListener('selectstart', function(e) { e.preventDefault(); });

  // 3) Deshabilitar atajos de teclado de DevTools y fuente
  document.addEventListener('keydown', function(e) {
    // F12, Ctrl+U, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+S
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.key === 'u') ||
      (e.ctrlKey && e.shiftKey && ['i','j','c'].includes(e.key.toLowerCase())) ||
      (e.ctrlKey && e.key === 's')
    ) {
      e.preventDefault();
      return false;
    }
  });

  // 4) Detectar DevTools abierto y mostrar overlay
  var devtoolsOpen = false;
  var threshold = 160;
  function checkDevTools() {
    var widthDiff = window.outerWidth - window.innerWidth > threshold;
    var heightDiff = window.outerHeight - window.innerHeight > threshold;
    if (widthDiff || heightDiff) {
      if (!devtoolsOpen) {
        devtoolsOpen = true;
        document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#000;color:#fff;font-size:24px;font-family:sans-serif;">Contenido protegido</div>';
      }
    } else {
      devtoolsOpen = false;
    }
  }
  setInterval(checkDevTools, 1000);

  // 5) Deshabilitar drag de imágenes
  document.addEventListener('dragstart', function(e) { e.preventDefault(); });

})();
