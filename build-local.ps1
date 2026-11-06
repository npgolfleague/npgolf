# Build and start the app locally in Docker Desktop, with version details
# (git commit, branch, build time) stamped into the image.
# Usage: powershell -ExecutionPolicy Bypass -File .\build-local.ps1

$env:GIT_COMMIT = (git rev-parse --short HEAD).Trim()
$env:GIT_BRANCH = (git rev-parse --abbrev-ref HEAD).Trim()
if (git status --porcelain) { $env:GIT_COMMIT = "$($env:GIT_COMMIT)-dirty" }
$env:BUILD_TIME = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

Write-Host "Building $($env:GIT_BRANCH) @ $($env:GIT_COMMIT), $($env:BUILD_TIME)" -ForegroundColor Cyan
docker compose up -d --build
