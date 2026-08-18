param(
  [string]$OutputDir = "backups"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw "pg_dump est introuvable. Installe PostgreSQL client tools ou ajoute pg_dump au PATH."
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

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $OutputDir "visiora-$stamp.dump"

pg_dump $env:DATABASE_URL --format=custom --no-owner --no-acl --file $target
Write-Host "Sauvegarde creee : $target"
