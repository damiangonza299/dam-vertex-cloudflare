/* =========================================================
   POST /api/intelligence/ping-telegram
   Envía mensaje de prueba de conectividad al grupo DAM INTELLIGENCE.

   Uso: verificar que TELEGRAM_BOT_TOKEN + TELEGRAM_INTELLIGENCE_CHAT_ID
   están correctamente configurados y el bot tiene permisos en el grupo.

   Variables requeridas:
     ADMIN_PASSWORD
     TELEGRAM_BOT_TOKEN
     TELEGRAM_INTELLIGENCE_CHAT_ID
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost({ request, env }) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!env.ADMIN_PASSWORD || token !== env.ADMIN_PASSWORD.trim()) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  if (!env.TELEGRAM_BOT_TOKEN) {
    return json({ ok: false, error: 'TELEGRAM_BOT_TOKEN no configurado' }, 500);
  }
  if (!env.TELEGRAM_INTELLIGENCE_CHAT_ID) {
    return json({ ok: false, error: 'TELEGRAM_INTELLIGENCE_CHAT_ID no configurado' }, 500);
  }

  const chatId = env.TELEGRAM_INTELLIGENCE_CHAT_ID.replace(/^﻿/, '').trim();

  const text = `🚀 DAM INTELLIGENCE ONLINE\n\nPrueba de conectividad exitosa.`;

  try {
    // Obtener username del bot para diagnóstico
    let botUsername = null;
    try {
      const meRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`);
      const meData = await meRes.json();
      botUsername = meData.result?.username || null;
    } catch (_) {}

    const res = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          chat_id:                  chatId,
          text,
          disable_web_page_preview: true,
        }),
      }
    );

    const tgResult = await res.json();

    if (!res.ok) {
      return json({
        ok:    false,
        error: `Telegram respondió HTTP ${res.status}`,
        telegram_error: tgResult,
        bot_username:   botUsername,
        chat_id:        chatId,
        hint:           botUsername
          ? `Agrega @${botUsername} al grupo DAM INTELLIGENCE con el chat_id indicado`
          : 'Verifica que TELEGRAM_BOT_TOKEN sea válido',
      }, 502);
    }

    return json({
      ok:           true,
      message:      'Mensaje de prueba enviado al grupo DAM INTELLIGENCE',
      chat_id:      chatId,
      message_id:   tgResult.result?.message_id,
      bot_username: botUsername,
    });

  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
