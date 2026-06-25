# Deploy Architecture — Dam Vertex

## Proyecto padre
dam-vertex-cloudflare/ es el único proyecto que se deploya.
Todo vive aquí. Nunca crear proyectos paralelos que dependan
de este repo sin documentarlo aquí.

## COMANDO DE DEPLOY — dam-vertex-cloudflare
SIEMPRE deployar con este comando exacto, sin variaciones:

& "C:\Program Files\nodejs\npx.cmd" wrangler pages deploy public --project-name=dam-vertex-cloudflare --branch=dam-vertex-cloudflare --commit-dirty=true

Después del deploy a Cloudflare, SIEMPRE pushear a GitHub:

git add .
git commit -m "update"
git push origin main

NUNCA usar otro comando de deploy para este proyecto.
NUNCA omitir el --branch=dam-vertex-cloudflare.
NUNCA omitir el --commit-dirty=true.
El orden es siempre: primero Cloudflare, después GitHub.

## Qué se deploya
pages_build_output_dir = "public"
→ TODO public/ se deploya a Cloudflare Pages
→ AI_SYSTEM/ NUNCA se deploya — es contexto solo para Claude Code
→ functions/ se deploya como Cloudflare Pages Functions

## Estructura de carpetas en escritorio
ADMIN Y DAM/
  ├── dam-vertex-cloudflare/ (acceso directo) ← PADRE
  └── Dam Finanzas/ (acceso directo)

## VS Code
Abrir con: ADMIN Y DAM/DAM-workspace.code-workspace
Muestra ambos proyectos en el mismo workspace sin mezclarlos.

## REGLA
Nunca mover product-studio/ fuera de public/.
Si se mueve, deja de deployarse con el resto del sitio.
product-studio vive en public/product-studio/index.html — así debe quedarse.

---

## Proyectos en el workspace — reglas de deploy

### dam-vertex-cloudflare (PADRE)
Ver "## COMANDO DE DEPLOY — dam-vertex-cloudflare" al inicio del archivo.

### dam-product-research (PROYECTO INDEPENDIENTE)
Este proyecto tiene su PROPIO deploy, separado de dam-vertex-cloudflare.
NUNCA deployar dam-product-research con el comando de dam-vertex-cloudflare.
Cuando se trabaje en dam-product-research, usar el comando de deploy
específico de ese proyecto.

REGLA: Claude Code siempre verifica en qué carpeta está trabajando
antes de ejecutar cualquier deploy.
