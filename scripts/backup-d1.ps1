# ============================================================
#  DAM Vertex — Backup D1 Database
#  Usa wrangler d1 export para crear un dump SQL
#  Ejecutar manualmente o programar con Task Scheduler
# ============================================================

$ErrorActionPreference = "Stop"

# Nombre de la base de datos D1 (como aparece en wrangler.toml)
$DB_NAME = "dam-vertex-leads"

# Directorio de backups
$BACKUP_DIR = Join-Path $PSScriptRoot "..\backups"

# Crear directorio si no existe
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null
}

# Generar nombre con timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$filename = "d1_backup_${timestamp}.sql"
$filepath = Join-Path $BACKUP_DIR $filename

Write-Host "=== DAM Vertex — D1 Backup ===" -ForegroundColor Cyan
Write-Host "Base de datos: $DB_NAME"
Write-Host "Archivo:       $filepath"
Write-Host ""

try {
    # Ejecutar export
    & "C:\Program Files\nodejs\npx.cmd" wrangler d1 export $DB_NAME --remote --output $filepath
    
    if ($LASTEXITCODE -ne 0) {
        throw "wrangler d1 export fallo con codigo $LASTEXITCODE"
    }
    
    # Verificar que el archivo se creo
    if (Test-Path $filepath) {
        $size = (Get-Item $filepath).Length
        $sizeKB = [math]::Round($size / 1024, 1)
        Write-Host ""
        Write-Host "OK Backup creado: $filename ($sizeKB KB)" -ForegroundColor Green
    } else {
        throw "El archivo de backup no se creo"
    }
    
    # Limpiar backups antiguos (mantener ultimos 30)
    $backups = Get-ChildItem $BACKUP_DIR -Filter "d1_backup_*.sql" | Sort-Object LastWriteTime -Descending
    if ($backups.Count -gt 30) {
        $toDelete = $backups | Select-Object -Skip 30
        $toDelete | Remove-Item -Force
        Write-Host "Limpieza: eliminados $($toDelete.Count) backups antiguos" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host ""
    Write-Host "ERROR: $_" -ForegroundColor Red
    Write-Host "Asegurate de tener wrangler instalado y estar autenticado." -ForegroundColor Yellow
    exit 1
}
