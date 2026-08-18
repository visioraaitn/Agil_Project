param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) {
  throw "pg_restore est introuvable. Installe PostgreSQL client tools ou ajoute pg_restore au PATH."
}

if (-not (Test-Path $BackupFile)) {
  throw "Fichier de sauvegarde introuvable : $BackupFile"
}

$envFile = Join-Path (Get-Location) ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*DATABASE_URL\s*=\s*`"?(.+?)`"?\s*$") {
      $env:DATABASE_URL = $Matches[1]
    }
  }
}

if (-not $env:DATABASE_URL) {
  throw "DATABASE_URL est manquant. Definis-le dans .env ou dans l'environnement."
}

pg_restore --clean --if-exists --no-owner --no-acl --dbname $env:DATABASE_URL $BackupFile
Write-Host "Base restauree depuis : $BackupFile"
