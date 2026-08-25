/* =========================================================
   GET /api/maps-key
   Devuelve la Google Maps API key (env.MAPS_KEY) para que las
   landings la carguen dinámicamente en vez de tenerla hardcodeada
   en el HTML (evita alertas de secret scanning de GitHub).

   Nota: esto NO oculta la key de un atacante decidido — cualquier
   cliente HTTP (no solo un browser) puede falsificar el header
   Origin/Referer y pedirla igual. La key de Maps JS API es pública
   por diseño (viaja en la URL de maps.googleapis.com/maps/api/js
   visible en el Network tab de cualquier visitante). El control de
   seguridad real es la restricción por HTTP referrer configurada en
   Google Cloud Console para esta key (restringida a damvertex.com/*).
   Este endpoint solo evita que la key quede versionada en el HTML.
   ========================================================= */

export async function onRequestGet({ request, env }) {
  const origin  = request.headers.get('Origin')  || '';
  const referer = request.headers.get('Referer') || '';
  const allowed = origin.includes('damvertex.com') || referer.includes('damvertex.com');

  if (!allowed) {
    return new Response('forbidden', { status: 403 });
  }

  return new Response(JSON.stringify({ key: env.MAPS_KEY || '' }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin || 'https://damvertex.com',
    },
  });
}
