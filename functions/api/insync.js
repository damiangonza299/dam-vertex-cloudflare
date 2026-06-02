/* =========================================================
   POST /api/insync — Behavioral event ingest
   Public, no auth. Fire-and-forget from client.
   Lazy cleanup: 2% of requests delete events > 90 days.
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const CLEANUP_PROB    = 0.02;
const RETENTION_SECS  = 90 * 24 * 3600; // 90 days

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost({ request, env, ctx }) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return ok();
  }

  const { session_id, landing, events } = body || {};

  if (
    !session_id || typeof session_id !== 'string' ||
    !landing    || typeof landing    !== 'string' ||
    !Array.isArray(events) || !events.length
  ) {
    return ok();
  }

  const sid  = session_id.slice(0, 64);
  const land = landing.slice(0, 100);
  const now  = Math.floor(Date.now() / 1000);
  const batch = events.slice(0, 50);

  const stmts = batch.map(ev =>
    env.DB.prepare(
      'INSERT INTO behavior_events (session_id, landing, event_type, section, cta_type, meta, ts) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      sid,
      land,
      String(ev.type || '').slice(0, 50),
      ev.section  ? String(ev.section).slice(0, 50)  : null,
      ev.cta_type ? String(ev.cta_type).slice(0, 30) : null,
      ev.meta     ? String(ev.meta).slice(0, 500)     : null,
      (ev.ts && Number.isFinite(Number(ev.ts))) ? Number(ev.ts) : now,
    )
  );

  try {
    await env.DB.batch(stmts);
  } catch (err) {
    console.error('INSYNC_BATCH_ERROR', err.message);
  }

  /* Lazy cleanup — async, never blocks response */
  if (Math.random() < CLEANUP_PROB) {
    const cutoff = now - RETENTION_SECS;
    ctx.waitUntil(
      env.DB.prepare('DELETE FROM behavior_events WHERE ts < ?').bind(cutoff).run()
        .catch(e => console.error('INSYNC_CLEANUP_ERROR', e.message))
    );
  }

  return ok();
}

function ok() {
  return new Response('{"ok":true}', {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
