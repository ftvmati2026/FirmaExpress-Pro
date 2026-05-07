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

git fetch origin
git checkout stable
git merge --ff-only origin/main
git push origin stable

Write-Host "OK: stable ahora apunta a origin/main"

