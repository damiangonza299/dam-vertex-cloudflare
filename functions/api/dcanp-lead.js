/* =========================================================
   /api/dcanp-lead — Pedidos de landings DCANP GROUP
   Escribe en D1 (source='dcanp') → aparece en Admin Panel.
   También notifica Telegram + Meta CAPI Purchase + Google Sheets.
   El cliente ve pantalla .dcanp-success (no WhatsApp).
   City check: client-side via city-check.js (redirige a WA si ciudad no cubierta).
   ========================================================= */

/* Nombres cortos por slug — solo para Telegram. No tocar. */
const PRODUCT_SHORT_NAMES = {
  'estante-aluminio-bano':      '🧴 Estante Organizador Winsen de Aluminio',
  'talonera-gel':               'TALONERA EN GEL',
  'tabla-marmol':               'TABLA DE PICAR DE MARMOL OVALADO 38X27CM',
  'interruptor-control-remoto': '💡 Interruptor Inalámbrico',
  'esquinero-aluminio':         '🔲 Esquinero',
  'dispensador-aceite-2en1':    'Dispensador Inteligente de Aceite 2 en 1',
  'reloj-imperial-verde':       'Reloj Imperial Verde',
  'reloj-blackout-minimal':     'Reloj Blackout Minimal',
  'manguera-led-multicolor':        'Manguera LED Multicolor',
  'rodillera-tecnologia-termica':   'Rodillera Térmica',
  'proyector-led-navideno':         'proyector navideño',
};

/* Nombres exactos Kangaroo (DCAMP GROUP) — solo para Google Sheets.
   Si el slug no está acá, cae a safeProd (Telegram name o product_name). */
const PRODUCT_DCAMP_GROUP_NAMES = {
  // Productos legacy DAM VERTEX
  'estante-aluminio-bano':           '🧴 Estante Organizador Winsen de Aluminio',
  'talonera-gel':                    'TALONERA EN GEL',
  'tabla-marmol':                    'TABLA DE PICAR DE MARMOL OVALADO 38X27CM',
  'interruptor-control-remoto':      '💡 Interruptor Inalámbrico',
  'esquinero-aluminio':              'Esquinero de Baño Avelino en Aluminio | AvelCorner',
  'dispensador-aceite-2en1':         'Dispensador Inteligente de Aceite 2 en 1',
  'manguera-led-multicolor':         'Manguera LED Multicolor',
  // LOTE 1
  'tabla-de-picar-inox-pro-304':     '🔵✅TABLA DE PICAR - INOX PRO 304',
  'guante-3en1-bano-perros':         '🔵Guante 3 en 1 para baño de perros',
  'huevera-electrica-gallinita':     'HUEVERA ELECTRCA EN FORMA DE GALLINITA',
  'retinal-shot-booster':            'Retinal Shot Booster es un potente tratamiento facial',
  'cepillo-9en1':                    'CEPILLO 9 EN 1',
  'avion-acrobatico-360':            '🔵✅Avión Acrobático 360° Jet Starfighter®',
  'estante-organizador-winsen':      '🧴 Estante Organizador Winsen de Aluminio',
  'gps-rastreador':                  'Mini GPS INFIEL',
  'audifono-amplificador-sonido':    '🔵Audífono Amplificador de Sonidos',
  'plantillas-deportivas':           '🔵Plantillas Deportivas con Absorción de Impacto',
  // LOTE 2 (slugs reales + alias)
  'mini-camara-espia':               'MINI CAMARA',
  'mini-camara-seguridad':           'MINI CAMARA',
  'cable-cargador-soporte-240w':     '🔵Cable Cargador con Soporte Invisible – Carga Rápida 240W Tipo C',
  'cable-cargador-soporte':          '🔵Cable Cargador con Soporte Invisible – Carga Rápida 240W Tipo C',
  'tobillera-compresion':            'TOBILLERA DE COMPRESIÓN',
  'cuchillo-pelador-madera':         '🔵Cuchillo Pelador con Manga de Madera',
  'cuchillo-pelador-manga-madera':   '🔵Cuchillo Pelador con Manga de Madera',
  'molino-carne-multifuncional':     '🔵Molino de Carne Multifuncional',
  'bases-elevadoras-ajustables':     '🔵Bases Elevadoras Ajustables',
  'guante-quitapelos-mascotas':      'FurClean™ – Guante Quitapelos para Mascotas 🐾',
  'furclean-guante-quitapelos':      'FurClean™ – Guante Quitapelos para Mascotas 🐾',
  'soplador-alto-impacto':           'SOPLADOR DE ALTO IMPACTO',
  'pistola-masajeadora':             'PISTOLA MASAJEADORA',
  'rodillera-tecnologia-termica':    '🔵 Rodillera con Tecnología Térmica',
  // LOTE 3
  'espatula-skinpulse-ultrasonica':  'Espátula SkinPulse Depuradora Ultrasónica – BLUMIN',
  'baston-plegable-luz-led':         '🔵Bastón Plegable con Luz Led',
  'protector-juanete':               'PROTECTOR DE JUANETE',
  'rodillera-neenca':                'RODILLERA NEENCA',
  'luz-led-clip-solar':              '🔵 Luz Led con Clip Solar y Recargable USB',
  // LOTE 4
  'kit-ejercitador-antebrazo':       '🔵 Kit Ejercitador_Antebrazo',
  'linterna-potente-zoom':           'LINTERNA POTENTE CON ZOOM',
  'plancha-vapor-portatil':          'PLANCHA A VAPOR PORTATIL',
  'mini-gps-rastreador':             'Mini GPS INFIEL',
  'lumifest-luces-navidad':          'LumiFest 10M™ La iluminación que transforma tu Navidad.',
  'taza-mezcladora-magnetica':       'taza mezcladora magnetica',
  'encendedor-poker-royal':          '🔵Encendedor Póker Royal',
  'mascara-led-facial':              '🔵Máscara LED Facial Inalámbrica',
  'molino-cafe-sokany':              'Molino de café sokany',
  // LOTE 5
  'lampara-medusa-multicolor':       '🔵Lámpara Medusa – Multicolor',
  'juguete-abejita-bailarina':       '🔵Juguete Abejita Bailarina con Música y Luces LED',
  'manguera-expansiva-premium':      '🔵✅Manguera Expasinva Premium',
  'oven-cleaner-grasa':              'OVEN CLEANER• Removedor de grasa y carbonillas',
  'pimer-mixer-licuadora-3en1':      'PIMER MIXER LICUADORA DE MANO 3 EN 1',
  'batidora-mano-400w':              'BATIDORA DE MANO 400W 6 CUCHILLAS',
  'mini-licuadora-portatil':         'MINI LICUADORA PORTATIL',
  // LOTE 6
  'cortador-verduras-9en1':          'CORTADOR DE VERDURAS 9 EN 1',
  'wild-tornado-desatascador':       'WILD TORNADO',
  'veneno-abeja-crema':              'VENENO DE ABEJA',
  'soporte-magnetico-cuello':        '🔵✅SOPORTE MAGNÉTICO MULTIÁNGULO DE CUELLO',
  'gel-masculino-vigor':             'Gel existente masculino',
  'linterna-frontal-recargable':     'LINTERNA FRONTAL',
  'mini-camara-spy':                 'MINI CAMARA SPY',
  'drone-pro-hd':                    'Drone Pro Hd',
  // LOTE 7
  'irrigador-bucal-inalambrico':     'Irrigador Bucal Inalámbrico Portátil👨‍⚕️',
  'encendedor-electrico-usb':        'Encendedor Eléctrico Recargable Usb',
  'pizarra-led-luminosa':            '🔵✅PIZARRA LED LUMINOSA ✨',
  'repelente-ultrasonico':           '🔵Repelente Ultrasónico',
  'huevo-dragon-antistres':          '🔵Huevo de Drangon Antiestrés 3D',
  'maquina-hacer-pororo':            '¡Máquina para hacer Pororo',
  'aspiradora-robot-inteligente':    'Aspiradora Robot Inteligente',
  'picador-carnes-verduras':         'PICADOR DE CARNES Y VERDURAS 5LITROS',
  'corrector-postura':               'CORRECTOR DE POSTURA',
  // LOTE 8
  'ducha-portatil-recargable':       '🔵Ducha Portátil Recargable',
  'cepillo-masajeador-capilar':      '🔵Cepillo Masajeador Capilar (Cod. 1234)',
  'molino-electrico-200w':           'MOLINO ELECTRICO 200W',
  'dr-rashel-crema-blanqueadora':    'DR RASHEL CREMA BLANQUEADORA',
  'smart-camara-wifi':               'SMART CAMARA',
  'pack-medias-terapeuticas':        '💙🦶 Pack Bienestar: 2 Pares de Medias Terapéuticas',
  'pinza-destapadora-tuberias':      '🔵 PINZA DESTAPADORA DE TUVERIAS',
  // LOTE 9
  'snake-venom-crema':               'SNAKE VENOM',
  'linterna-titanium-pro':           'LINTERNA TITANIUM PRO',
  'linterna-tactica-militar':        '🔵Linterna Táctica Militar Recargable',
  'prensa-francesa-cafe':            'PRENSA FRANCESA',
  'resortera-laser-precision':       '🔵RESORTERA DE PRECISIÓN CON LÁSER + 50 BALINES',
  'cortina-smart-led':               '🔵✅Cortina Smart LED Inteligente',
  'cortador-verduras-multifuncional':'CORTADOR DE VERDURAS 9 EN 1 MULTIFUNCIONAL',
  // LOTE 10
  'mini-nebulizador-portatil':       '🔵MINI NEBULIZADOR PORTATIL',
  'tren-magico-navidad':             '🔵Tren Mágico EXPRESS de Navidad',
  'tabla-picar-marmol-ovalado':      'TABLA DE PICAR DE MARMOL OVALADO 38X27CM',
  'tabla-picar-marmol-natural':      'TABLA DE PICAR DE MARMOL NATURAL',
  'maquina-peladora-electrica':      '🔵✅Máquina Peladora Eléctrica',
  'secador-zapatos-portatil':        '🔵SECADOR DE ZAPATOS PORTATIL',
  'proyector-led-navideno':          '🔵✅Proyector LED Navideño con 12 Diseños Mágicos',
};

/* Normalización de ciudad — comparación sin tildes y case-insensitive.
   Si la ciudad no está en el mapa se usa el texto limpio tal como vino. */
const CITY_NORMALIZE = {
  // ══ CENTRAL ══
  'asuncion': 'Asunción', 'asu': 'Asunción',
  'lambare': 'Lambaré', 'lamb': 'Lambaré',
  'san lorenzo': 'San Lorenzo', 'sl': 'San Lorenzo',
  'fernando de la mora': 'Fernando de la Mora', 'fdm': 'Fernando de la Mora',
  'fdo de la mora': 'Fernando de la Mora', 'fdo mora': 'Fernando de la Mora',
  'fernando mora': 'Fernando de la Mora',
  'luque': 'Luque',
  'capiata': 'Capiatá',
  'nemby': 'Ñemby', 'nembi': 'Ñemby',
  'villa elisa': 'Villa Elisa',
  'mariano roque alonso': 'Mariano Roque Alonso', 'mra': 'Mariano Roque Alonso',
  'mariano': 'Mariano Roque Alonso',
  'limpio': 'Limpio',
  'san antonio': 'San Antonio',
  'itaugua': 'Itauguá',
  'aregua': 'Areguá',
  'guarambare': 'Guarambaré',
  'ita': 'Itá',
  'villeta': 'Villeta',
  'ypane': 'Ypané',
  'j augusto saldivar': 'J. Augusto Saldívar',
  'j. augusto saldivar': 'J. Augusto Saldívar',
  'augusto saldivar': 'J. Augusto Saldívar', 'saldivar': 'J. Augusto Saldívar',

  // ══ ALTO PARANÁ ══
  'ciudad del este': 'Ciudad del Este', 'cde': 'Ciudad del Este',
  'hernandarias': 'Hernandarias',
  'minga guazu': 'Minga Guazu', 'minga': 'Minga Guazu',
  'presidente franco': 'Presidente Franco', 'pfranco': 'Presidente Franco',
  'colonia yguazu': 'Colonia Yguazu',
  'santa rita': 'Santa Rita',
  'san alberto': 'San Alberto',
  'juan leon mallorquin': 'Juan Leon Mallorquin',
  'yguazu': 'Yguazu',

  // ══ CAAGUAZÚ ══
  'coronel oviedo': 'Coronel Oviedo', 'cnel oviedo': 'Coronel Oviedo', 'oviedo': 'Coronel Oviedo',
  'caaguazu': 'Caaguazú',
  'repatriacion': 'Repatriación', 'repa': 'Repatriación',
  'natalicio talavera': 'Natalicio Talavera',
  'felix perez cardozo': 'Félix Pérez Cardozo',
  'mauricio jose troche': 'Mauricio José Troche',
  'san jose de los arroyos': 'San José de los Arroyos',
  'yataity del norte': 'Yataity del Norte',

  // ══ CORDILLERA ══
  'caacupe': 'Caacupé',
  'san bernardino': 'San Bernardino', 'san berni': 'San Bernardino',
  'ypacarai': 'Ypacaraí',
  'altos': 'Altos',
  'atyra': 'Atyrá',
  'emboscada': 'Emboscada',
  'eusebio ayala': 'Eusebio Ayala',
  'itacurubi de la cordillera': 'Itacurubí de la Cordillera',
  'karaguatay': 'Karaguatay',
  'loma grande': 'Loma Grande',
  'nueva italia': 'Nueva Italia',
  'piribebuy': 'Piribebuy',
  'santa elena': 'Santa Elena',
  'tobati': 'Tobatí',

  // ══ PARAGUARÍ ══
  'paraguari': 'Paraguarí',
  'yaguaron': 'Yaguarón',
  'carapegua': 'Carapeguá',
  'escobar': 'Escobar',
  'general bernardino caballero': 'General Bernardino Caballero',
  'gral bernardino caballero': 'General Bernardino Caballero',
  'pirayu': 'Pirayú',
  'sapucai': 'Sapucaí',

  // ══ GUAIRÁ ══
  'villarrica': 'Villarrica',
  'mbocayaty': 'Mbocayaty',

  // ══ PRESIDENTE HAYES ══
  'villa hayes': 'Villa Hayes',
  'benjamin aceval': 'Benjamín Aceval',
  'remansito': 'Remansito',

  // ══ AMAMBAY ══
  'pedro juan caballero': 'Pedro Juan Caballero', 'pjc': 'Pedro Juan Caballero',
};

/* Ciudad → departamento — para línea en Telegram */
const CITY_TO_DEPT = (() => {
  const raw = {
    'Asunción':        ['Asunción'],
    'Central':         ['Areguá','Capiatá','Fernando de la Mora','Guarambaré','Itá','Itauguá','J. Augusto Saldívar','Lambaré','Limpio','Luque','Mariano Roque Alonso','Ñemby','Nueva Italia','San Antonio','San Lorenzo','Villa Elisa','Villeta','Ypané'],
    'Alto Paraná':     ['Ciudad del Este','Colonia Yguazú','Domingo Martínez de Irala','Hernandarias','Iruña',"Juan E. O'Leary",'Juan León Mallorquín','Los Cedrales','Mbaracayú','Minga Guazú','Minga Porã','Naranjal','Presidente Franco','San Alberto','San Cristóbal','Santa Fe del Paraná','Santa Rita','Santa Rosa del Monday','Tavapy','Ñacunday','Yguazú'],
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
  const m = {};
  for (const [dept, cities] of Object.entries(raw)) {
    for (const c of cities) m[c] = dept;
  }
  return m;
})();

function normalizarTelefono(raw) {
  if (!raw) return raw;
  let tel = String(raw).replace(/[\s\-\(\)\.]/g, '');
  if (tel.startsWith('+595'))      tel = '0' + tel.slice(4);
  else if (tel.startsWith('595'))  tel = '0' + tel.slice(3);
  else if (tel.startsWith('59') && tel.length > 10) tel = '0' + tel.slice(2);
  return tel;
}

function cleanCityInput(raw) {
  if (!raw) return raw;
  return raw.split(/[,\-]|zona |barrio |sector |b°/i)[0].trim();
}

function normalizeCity(raw) {
  if (!raw) return raw;
  const cleaned = cleanCityInput(raw);
  const normalized = cleaned.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return CITY_NORMALIZE[normalized] || cleaned;
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost({ request, env, waitUntil }) {
  try {
    const body = await request.json();
    const {
      name, phone, city, street, referencia, nota, payment,
      quantity, product_slug, product_name, value,
      fbp, fbc, event_id,
      express, invoice, invoice_ruc, invoice_name, invoice_email,
    } = body;

    const sanitize = (s, maxLen) => (s || '').toString().replace(/[<>"'\\/]/g, '').trim().slice(0, maxLen);
    const safeName  = sanitize(name, 100);
    const safeCity  = normalizeCity(sanitize(city, 100));
    const shortName = PRODUCT_SHORT_NAMES[(product_slug || '').trim()];
    const safeProd  = shortName || sanitize(product_name || product_slug, 100);
    const sheetProd = PRODUCT_DCAMP_GROUP_NAMES[(product_slug || '').trim()] || safeProd;

    if (!safeName || !phone?.trim()) {
      return json({ ok: false, error: 'Campos requeridos: name, phone' }, 400);
    }

    const ip = request.headers.get('CF-Connecting-IPv6') || request.headers.get('CF-Connecting-IP') || '';
    const ua = request.headers.get('User-Agent') || '';
    const qty = parseInt(quantity) || 1;
    const amount = Number(value) || 0;
    const effectiveAmount = amount;
    const fmtNum = n => Number(n || 0).toLocaleString('es-PY');

    const phoneTrim = normalizarTelefono(phone) || '';
    const slugTrim  = (product_slug || '').trim();

    /* ── Bloqueo de clientes — D1 blocked_customers. Si está bloqueado: no se
       registra nada (ni Telegram ni Sheets ni CAPI). El cliente ve la pantalla
       de agradecimiento igual. Best-effort: un fallo de D1 no corta el flujo. ── */
    try {
      if (env.DB && phoneTrim) {
        const blocked = await env.DB
          .prepare('SELECT active FROM blocked_customers WHERE phone = ? AND active = 1')
          .bind(phoneTrim)
          .first();
        if (blocked) {
          console.log('DCANP_BLOCKED', phoneTrim);
          return json({ ok: true, message: '¡Pedido recibido!' });
        }
      }
    } catch (e) {
      console.error('DCANP_BLOCK_CHECK_SKIP', e.message);
    }

    /* ── Filtro de duplicados — mismo teléfono + slug en los últimos 30 min (KV).
       Si ya existe: marcar como duplicado y continuar — Telegram y Sheets reciben
       el pedido completo igual, solo se agrega la nota "⚠️ POSIBLE DUPLICADO". ── */
    let isDuplicate = false;
    try {
      if (env.COUNTER_KV && phoneTrim && slugTrim) {
        const dupKey = `dcanp_dup_${phoneTrim}_${slugTrim}`;
        if (await env.COUNTER_KV.get(dupKey)) {
          isDuplicate = true;
        } else {
          await env.COUNTER_KV.put(dupKey, '1', { expirationTtl: 1800 });
        }
      }
    } catch (e) {
      console.error('DCANP_DUP_CHECK_SKIP', e.message);
    }

    /* ── Telegram — background, no bloquea la respuesta ── */
    waitUntil((async () => {
      if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
      try {
        const text = [
          isDuplicate ? '⚠️ POSIBLE DUPLICADO — NUEVO PEDIDO DAM VERTEX ✅' : 'NUEVO PEDIDO DAM VERTEX ✅',
          `Total: Gs. ${fmtNum(effectiveAmount)}`,
          ...(express ? ['🚀 Envío express: +Gs. 10.000'] : []),
          `Producto: ${safeProd}`,
          `Nombre: ${safeName}`,
          `Teléfono: ${phoneTrim}`,
          ...(safeCity ? [`Ciudad: ${safeCity}`] : []),
          ...(safeCity && CITY_TO_DEPT[safeCity] ? [`Departamento: ${CITY_TO_DEPT[safeCity]}`] : []),
          ...(street ? [`Calle: ${sanitize(street, 150)}`] : []),
          ...(referencia ? [`Referencia: ${sanitize(referencia, 150)}`] : []),
          `Cantidad: ${qty}`,
          ...(nota ? [`Nota: ${sanitize(nota, 300)}`] : []),
          ...(payment ? [`Método: ${sanitize(payment, 50)}`] : []),
          ...(invoice ? [
            '🧾 Factura: Sí',
            ...(invoice_ruc   ? [`RUC: ${sanitize(invoice_ruc, 50)}`]           : []),
            ...(invoice_name  ? [`Razón social: ${sanitize(invoice_name, 100)}`] : []),
            ...(invoice_email ? [`Email: ${sanitize(invoice_email, 100)}`]       : []),
          ] : []),
        ].join('\n');
        const tgRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
        });
        if (!tgRes.ok) {
          const tgErr = await tgRes.json();
          console.error('TELEGRAM_ERROR', tgErr);
        }
      } catch (e) {
        console.error('DCANP_TELEGRAM_ERROR', e.message);
      }
    })());

    /* ── Meta CAPI Purchase — background, no bloquea la respuesta ── */
    waitUntil((async () => {
      if (!env.META_PIXEL_ID || !env.META_ACCESS_TOKEN) return;
      try {
        const ts  = Math.floor(Date.now() / 1000);
        const rnd = Math.random().toString(36).slice(2, 6);
        const purId = event_id || `pur_dcanp_${product_slug || 'lead'}_${ts}_${rnd}`;
        const ud = {};
        if (ip) ud.client_ip_address = ip;
        if (ua) ud.client_user_agent = ua;
        if (fbp) ud.fbp = fbp;
        if (fbc) ud.fbc = fbc;

        const phQL = normalizePhoneQL(phone.trim());
        if (phQL) {
          const phHash = await sha256QL(phQL);
          ud.ph          = [phHash];
          ud.external_id = [phHash];
        }
        const nameParts = safeName.split(/\s+/);
        if (nameParts[0])         ud.fn = [await sha256QL(normForMeta(nameParts[0]))];
        if (nameParts.length > 1) ud.ln = [await sha256QL(normForMeta(nameParts.slice(1).join(' ')))];
        if (safeCity) ud.ct = [await sha256QL(normForMeta(safeCity))];
        ud.country = [await sha256QL('py')];

        await fetch(
          `https://graph.facebook.com/v20.0/${env.META_PIXEL_ID}/events?access_token=${env.META_ACCESS_TOKEN}`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: [{
                event_name:       'Purchase',
                event_id:         purId,
                event_time:       ts,
                action_source:    'website',
                event_source_url: 'https://damvertex.com',
                user_data:        ud,
                custom_data: {
                  content_name: safeProd,
                  content_ids:  [product_slug || ''],
                  content_type: 'product',
                  value:        effectiveAmount,
                  currency:     'PYG',
                  num_items:    qty,
                },
              }],
              ...(env.META_TEST_EVENT_CODE && { test_event_code: env.META_TEST_EVENT_CODE }),
            }),
          }
        );
      } catch (e) {
        console.error('DCANP_CAPI_ERROR', e.message);
      }
    })());

    /* ── D1 leads — insertar en tabla leads para Admin Panel (best-effort, background).
       source='dcanp' identifica el origen en los filtros del Admin Panel.
       Campos DCANP sin equivalente en leads (referencia, nota) se omiten silenciosamente. ── */
    waitUntil((async () => {
      if (!env.DB) return;
      try {
        const leadDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion' }).format(new Date());
        await env.DB.prepare(`
          INSERT INTO leads (
            product_name, name, phone, city, value, currency,
            fbp, fbc, user_agent, ip, quantity,
            address, payment_method, product_slug,
            operational_date_py, attribution_confidence,
            invoice_requested, invoice_ruc, invoice_name, invoice_email,
            source
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          safeProd,
          safeName,
          phoneTrim,
          safeCity || null,
          effectiveAmount,
          'PYG',
          fbp || null,
          fbc || null,
          ua,
          ip,
          qty,
          street   ? sanitize(street, 150)        : null,
          payment  ? sanitize(payment, 50)         : null,
          slugTrim || null,
          leadDate,
          'low',
          invoice ? 1 : 0,
          invoice_ruc   ? sanitize(invoice_ruc, 50)   : null,
          invoice_name  ? sanitize(invoice_name, 100) : null,
          invoice_email ? sanitize(invoice_email, 100): null,
          'dcanp',
        ).run();
      } catch (e) {
        console.error('DCANP_D1_INSERT_ERROR', e.message);
      }
    })());

    /* ── Google Sheets — vía webhook (Apps Script), awaited para que la
       verificación de la fila sea confiable, pero nunca rompe la respuesta.
       Orden exacto de columnas: Fecha | Nombre | Teléfono | Ciudad | Producto |
       Cantidad | Referencia | Calle | Monto | Nota del pedido. */
    const webhookUrl = env.DCANP_SHEETS_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const sheetsRes = await fetch(webhookUrl, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          redirect: 'follow',
          signal:  AbortSignal.timeout(12000),
          body: JSON.stringify({
            fecha:      new Date().toLocaleString('es-PY'),
            nombre:     safeName,
            telefono:   phone.trim(),
            ciudad:     safeCity,
            producto:   sheetProd,
            cantidad:   qty,
            referencia: referencia ? sanitize(referencia, 150) : '',
            calle:      street ? sanitize(street, 150) : '',
            monto:      'Gs. ' + fmtNum(effectiveAmount),
            nota:       nota ? sanitize(nota, 300) : '',
            ruc:          invoice_ruc   ? sanitize(invoice_ruc, 50)    : '',
            razon_social: invoice_name  ? sanitize(invoice_name, 100) : '',
            email:        invoice_email ? sanitize(invoice_email, 100) : '',
          }),
        });
        console.error('DCANP_SHEETS_STATUS', sheetsRes.status, sheetsRes.url?.slice(0, 80));
      } catch (e) {
        console.error('DCANP_SHEETS_ERROR', e.message);
      }
    } else {
      console.error('DCANP_SHEETS_ERROR: env.DCANP_SHEETS_WEBHOOK_URL no configurada');
    }

    return json({ ok: true, message: '¡Pedido recibido!' });
  } catch (err) {
    console.error('DCANP_LEAD_ERROR', err.message);
    return json({ ok: true, message: '¡Pedido recibido!' });
  }
}

/* ── Helpers — duplicados a propósito (endpoint independiente, ver header) ── */
function normalizePhoneQL(raw) {
  const d = (raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('595')) return d.slice(0, 12);
  if (d.startsWith('0'))   return '595' + d.slice(1);
  return '595' + d;
}

function normForMeta(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

async function sha256QL(str) {
  if (!str) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
