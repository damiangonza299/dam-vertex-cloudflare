/* Selector de ciudad para modales DCANP — lista completa de Paraguay con departamento.
   Exporta: window.CIUDADES_PY (array) + window.initDcanpCitySelector(inputId, suggId). */
(function () {
  var RAW = {
    'Asunción':        ['Asunción'],
    'Central':         ['Areguá','Capiatá','Fernando de la Mora','Guarambaré','Itá','Itauguá','J. Augusto Saldívar','Lambaré','Limpio','Luque','Mariano Roque Alonso','Ñemby','Nueva Italia','San Antonio','San Lorenzo','Villa Elisa','Villeta','Ypané'],
    'Alto Paraná':     ['Ciudad del Este','Colonia Yguazú','Domingo Martínez de Irala','Hernandarias','Iruña','Juan E. O\'Leary','Juan León Mallorquín','Los Cedrales','Mbaracayú','Minga Guazú','Minga Porã','Naranjal','Presidente Franco','San Alberto','San Cristóbal','Santa Fe del Paraná','Santa Rita','Santa Rosa del Monday','Tavapy','Ñacunday','Yguazú'],
    'Caaguazú':        ['Caaguazú','Carayaó','Coronel Oviedo','Dr. Cecilio Báez','Dr. Eulogio Estigarribia','Dr. Juan Manuel Frutos','Félix Pérez Cardozo','José Domingo Ocampos','La Pastora','Mauricio José Troche','Mbutuy','Natalicio Talavera','Nueva Londres','R.I. 3 Corrales','Raúl Arsenio Oviedo','Repatriación','San Joaquín','San José de los Arroyos','Santa Rosa del Mbutuy','Simón Bolívar','Tembiaporã','Vaquería','Yhú','Yataity del Norte'],
    'Cordillera':      ['Altos','Arroyos y Esteros','Atyrá','Caacupé','Caraguatay','Emboscada','Eusebio Ayala','Isla Pucú','Itacurubí de la Cordillera','Juan de Mena','Loma Grande','Mbocayaty del Yhaguy','Nueva Colombia','Piribebuy','Primero de Marzo','San Bernardino','San José Obrero','Santa Elena','Tobatí','Ypacaraí'],
    'Paraguarí':       ['Acahay','Caapucú','Carapeguá','Escobar','General Bernardino Caballero','La Colmena','Mbuyapey','Paraguarí','Pirayú','Quiindy','Quyquyhó','San Roque González de Santa Cruz','Sapucaí','Tebicuarymí','Ybycuí','Yaguarón','Ñumi'],
    'Guairá':          ['Borja','Colonia Independencia','Dr. Bottrell','Félix Pérez Cardozo','General Eugenio A. Garay','Iturbe','Mbocayaty','Natalicio Talavera','Ñumí','Pedro P. Peña','San Salvador','Step','Tebicuary','Villarrica','Yataity'],
    'Itapúa':          ['Alto Verá','Bella Vista Sur','Cambyretá','Capitán Meza','Capitán Miranda','Carlos Antonio López','Carmen del Paraná','Coronel Bogado','Edelira','Encarnación','Fram','General Artigas','General Delgado','Hohenau','Itapúa Poty','Jesús','José Leandro Oviedo','Kolonia Volendam','La Paz','Mayor Otaño','Natalio','Nueva Alborada','Obligado','Pirapó','San Cosme y Damián','San Juan del Paraná','San Pedro del Paraná','Santa María de Fe','Tomás Romero Pereira','Trinidad','Yatytay'],
    'Misiones':        ['Ayolas','San Ignacio','San Juan Bautista','San Miguel','San Patricio','Santa María','Santa Rosa','Santiago','Villa Florida','Yabebyry'],
    'Caazapá':         ['Abaí','Buena Vista','Caazapá','Dr. Moisés Bertoni','Fulgencio Yegros','Gral. Higinio Morínigo','Maciel','San Juan Nepomuceno','Tavaí','Yuty','3 de Mayo'],
    'Ñeembucú':        ['Alberdi','Cerrito','Desmochados','General José Eduvigis Díaz','Guazú Cuá','Humaitá','Isla Umbú','Laureles','Mayor Martínez','Paso de Patria','Pilar','San Juan Bautista del Ñeembucú','Tacuaras','Villa Franca','Villa Oliva','Villalbín'],
    'Amambay':         ['Bella Vista Norte','Capitán Bado','Pedro Juan Caballero','Zanja Pytã'],
    'Concepción':      ['Azotey','Belén','Concepción','Horqueta','Loreto','Paso Barreto','San Alfredo','San Carlos del Apa','San Lázaro','Sargento José Félix López','Yby Yaú'],
    'San Pedro':       ['Antequera','Capiibary','Choré','General Elizardo Aquino','Guayaibí','Itacurubí del Rosario','Lima','Nueva Germania','Río Verde','San Estanislao','San Pedro del Ycuamandyyú','San Pablo','Santa Rosa del Aguaray','Tacuatí','Unión','Villa del Rosario','Yataity del Norte','Yrybucuá','Yvyrarovana'],
    'Canindeyú':       ['Corpus Christi','Curuguaty','Itanará','Katueté','La Paloma','Nueva Esperanza','Salto del Guairá','Villa Ygatimí','Ypejhú','Yby Pytã','Yby Pororô','Yvypytã'],
    'Presidente Hayes':['Benjamín Aceval','Nanawa','Puerto Pinasco','Remansito','Villa Hayes'],
    'Alto Paraguay':   ['Bahía Negra','Carmelo Peralta','Fuerte Olimpo','Puerto Casado'],
    'Boquerón':        ['Doctor Pedro P. Peña','Filadelfia','Loma Plata','Mariscal José Félix Estigarribia'],
  };

  var list = [];
  Object.keys(RAW).forEach(function (dept) {
    RAW[dept].forEach(function (ciudad) { list.push({ ciudad: ciudad, depto: dept }); });
  });
  window.CIUDADES_PY = list;

  function norm(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  window.initDcanpCitySelector = function (inputId, suggId) {
    var input = document.getElementById(inputId);
    var sugg  = document.getElementById(suggId);
    if (!input || !sugg) return;

    function hide() { sugg.classList.remove('open'); sugg.innerHTML = ''; }

    function show(matches) {
      sugg.innerHTML = '';
      matches.forEach(function (item) {
        var el = document.createElement('div');
        el.className = 'city-suggestions__item';
        el.textContent = item.ciudad + ' (' + item.depto + ')';
        function pick() { input.value = item.ciudad; hide(); }
        var ty = null, tm = false;
        el.addEventListener('touchstart', function (e) { ty = e.touches[0].clientY; tm = false; el.classList.add('touch-active'); }, { passive: true });
        el.addEventListener('touchmove',  function (e) { if (Math.abs(e.touches[0].clientY - ty) > 8) { tm = true; el.classList.remove('touch-active'); } }, { passive: true });
        el.addEventListener('touchend',   function (e) { el.classList.remove('touch-active'); if (!tm) { e.preventDefault(); pick(); } ty = null; });
        el.addEventListener('touchcancel',function ()  { el.classList.remove('touch-active'); ty = null; });
        el.addEventListener('mousedown',  function (e) { e.preventDefault(); pick(); });
        sugg.appendChild(el);
      });
      sugg.classList.add('open');
    }

    function onInput() {
      var typed = input.value.trim();
      if (!typed) { hide(); return; }
      var q = norm(typed);
      var matches = window.CIUDADES_PY.filter(function (c) {
        return norm(c.ciudad).indexOf(q) === 0;
      }).slice(0, 8);
      if (matches.length) show(matches); else hide();
    }

    input.addEventListener('input',  onInput);
    input.addEventListener('focus',  onInput);
    document.addEventListener('click', function (e) {
      if (e.target !== input && !sugg.contains(e.target)) hide();
    });
  };
})();
