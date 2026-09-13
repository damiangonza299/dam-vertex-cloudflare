import { verifyAdminToken } from '../_lib/adminAuth.js';

/* Workers can't run CLI commands, so this endpoint returns the deploy
   command for the user to run locally in PowerShell. */
export async function onRequestGet(ctx) {
  const { request, env } = ctx;

  if (!(await verifyAdminToken(request, env))) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const cmd = `& "C:\\Program Files\\nodejs\\npx.cmd" wrangler pages deploy public --project-name=dam-vertex-cloudflare --branch=dam-vertex-cloudflare --commit-dirty=true`;

  return Response.json({
    ok: true,
    cmd,
    note: 'Ejecutá este comando en PowerShell desde el directorio del proyecto. Los Workers no pueden ejecutar CLI directamente.',
  });
}
