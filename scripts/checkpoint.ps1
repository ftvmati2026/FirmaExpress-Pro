Param(
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"

function Ensure-Git {
  $git = Get-Command git -ErrorAction SilentlyContinue
  if ($null -eq $git) {
    throw "No se encontro 'git' en PATH. Abrilo desde GitHub Desktop o instala Git for Windows."
  }
}

Ensure-Git

git rev-parse --is-inside-work-tree | Out-Null

$dirty = git status --porcelain
if ($dirty) {
  throw "Hay cambios sin commitear. Hace commit primero (o stash) y volve a correr el script."
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne "main") {
  throw "Estas en '$branch'. Checkout 'main' antes de crear checkpoint."
}

$ts = Get-Date -Format "yyyyMMdd-HHmm"
$tag = "stable-$ts"

if ([string]::IsNullOrWhiteSpace($Message)) {
  $Message = "Checkpoint estable $ts"
}

git tag -a $tag -m $Message
git push origin $tag

Write-Host "OK: creado y pusheado tag $tag"

