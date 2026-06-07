# deploy-production.ps1
# Deploy seguro para DAM Vertex (Cloudflare Pages)
# Uso: .\scripts\deploy-production.ps1
#
# Protecciones:
#   - Verifica que wrangler.toml define pages_build_output_dir = "public"
#   - Bloquea deploy si el directorio no es public/
#   - Usa siempre --branch=dam-vertex-cloudflare (produccion, no preview)
#   - Verifica rutas criticas post-deploy
#   - NO deploya node_modules ni raiz del repo

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  DAM VERTEX - Deploy Seguro a Produccion" -ForegroundColor Cyan
Write-Host "  Proyecto: dam-vertex-cloudflare" -ForegroundColor Cyan
Write-Host "  Branch:   dam-vertex-cloudflare (produccion)" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# Navegar a la raiz del proyecto (un nivel arriba de scripts/)
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
Write-Host "[INFO] Directorio del proyecto: $projectRoot" -ForegroundColor Yellow

# ---- PASO 1: Verificar wrangler.toml ----
Write-Host ""
Write-Host "PASO 1/4: Verificando wrangler.toml..." -ForegroundColor Cyan

$tomlPath = Join-Path $projectRoot "wrangler.toml"
if (-not (Test-Path $tomlPath)) {
    Write-Host "ERROR: wrangler.toml no encontrado en $tomlPath" -ForegroundColor Red
    exit 1
}

$toml = Get-Content $tomlPath -Raw
if ($toml -notmatch 'pages_build_output_dir\s*=\s*"public"') {
    Write-Host ""
    Write-Host "DEPLOY BLOQUEADO" -ForegroundColor Red
    Write-Host "wrangler.toml no tiene pages_build_output_dir = `"public`"" -ForegroundColor Red
    Write-Host "Revisar wrangler.toml antes de continuar." -ForegroundColor Red
    exit 1
}

Write-Host "  [OK] pages_build_output_dir = `"public`"" -ForegroundColor Green

# ---- PASO 2: Verificar directorio public/ ----
$publicPath = Join-Path $projectRoot "public"
if (-not (Test-Path $publicPath -PathType Container)) {
    Write-Host "ERROR: directorio public/ no existe en $projectRoot" -ForegroundColor Red
    exit 1
}

$publicFiles = (Get-ChildItem $publicPath -Recurse -File).Count
Write-Host "  [OK] public/ existe ($publicFiles archivos)" -ForegroundColor Green

# Verificar que no hay node_modules en public/
if (Test-Path (Join-Path $publicPath "node_modules")) {
    Write-Host "ADVERTENCIA: public/node_modules encontrado - esto es inusual" -ForegroundColor Yellow
}

# ---- PASO 3: Deploy ----
Write-Host ""
Write-Host "PASO 2/4: Ejecutando deploy a produccion..." -ForegroundColor Cyan
Write-Host "  Comando: wrangler pages deploy public --project-name=dam-vertex-cloudflare --branch=dam-vertex-cloudflare --commit-dirty=true" -ForegroundColor Yellow
Write-Host ""

$npx = "C:\Program Files\nodejs\npx.cmd"
if (-not (Test-Path $npx)) {
    $npx = "npx"
}

& $npx wrangler pages deploy public --project-name=dam-vertex-cloudflare --branch=dam-vertex-cloudflare --commit-dirty=true

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "DEPLOY FALLIDO (codigo $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "  [OK] Deploy ejecutado" -ForegroundColor Green

# ---- PASO 4: Esperar propagacion y verificar rutas ----
Write-Host ""
Write-Host "PASO 3/4: Esperando propagacion (10 segundos)..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

Write-Host ""
Write-Host "PASO 4/4: Verificando rutas criticas..." -ForegroundColor Cyan
Write-Host ""

$routes = @(
    @{ Url = "https://damvertex.com";                          Label = "damvertex.com (home)" },
    @{ Url = "https://damvertex.com/reloj/";                   Label = "/reloj/" },
    @{ Url = "https://damvertex.com/cadena/";                  Label = "/cadena/" },
    @{ Url = "https://damvertex.com/admin/";                   Label = "/admin/" },
    @{ Url = "https://damvertex.com/intelligence/";            Label = "/intelligence/" },
    @{ Url = "https://dam-vertex-cloudflare.pages.dev";        Label = "pages.dev (home)" },
    @{ Url = "https://dam-vertex-cloudflare.pages.dev/reloj/"; Label = "pages.dev /reloj/" },
    @{ Url = "https://dam-vertex-cloudflare.pages.dev/cadena/"; Label = "pages.dev /cadena/" },
    @{ Url = "https://dam-vertex-cloudflare.pages.dev/admin/"; Label = "pages.dev /admin/" },
    @{ Url = "https://dam-vertex-cloudflare.pages.dev/intelligence/"; Label = "pages.dev /intelligence/" }
)

$allOk = $true
$failedRoutes = @()

foreach ($route in $routes) {
    try {
        $response = Invoke-WebRequest -Uri $route.Url -Method GET -UseBasicParsing -TimeoutSec 20 -ErrorAction Stop
        $status = $response.StatusCode
        if ($status -eq 200) {
            Write-Host "  [200 OK] $($route.Label)" -ForegroundColor Green
        } else {
            Write-Host "  [$status FAIL] $($route.Label)" -ForegroundColor Red
            $allOk = $false
            $failedRoutes += $route.Label
        }
    } catch {
        $errMsg = $_.Exception.Message -replace "`n", " "
        Write-Host "  [ERROR] $($route.Label) - $errMsg" -ForegroundColor Red
        $allOk = $false
        $failedRoutes += $route.Label
    }
}

# ---- Resultado final ----
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan

if ($allOk) {
    Write-Host "  DEPLOY EXITOSO" -ForegroundColor Green
    Write-Host "  Todas las rutas responden 200" -ForegroundColor Green
    Write-Host "  Produccion: https://damvertex.com" -ForegroundColor Green
    Write-Host "  Pages.dev:  https://dam-vertex-cloudflare.pages.dev" -ForegroundColor Green
} else {
    Write-Host "  ADVERTENCIA: El deploy se ejecuto pero algunas rutas fallaron" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Rutas con fallo:" -ForegroundColor Red
    foreach ($r in $failedRoutes) {
        Write-Host "    - $r" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "  NO declarar deploy exitoso hasta corregir las rutas falladas." -ForegroundColor Red
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

if (-not $allOk) { exit 1 }
