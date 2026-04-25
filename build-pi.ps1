# Build script for multi-platform Docker images
# This creates images that work on both Windows (AMD64) and Raspberry Pi (ARM64)

$docker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"

Write-Host "Building multi-platform Docker images..." -ForegroundColor Green

# Ensure buildx is set up
& $docker buildx create --name multibuilder --use 2>$null
& $docker buildx inspect --bootstrap

# Build the application image for both AMD64 and ARM64
Write-Host "`nBuilding npgolf application for AMD64 and ARM64..." -ForegroundColor Cyan
& $docker buildx build --platform linux/amd64,linux/arm64 --tag crj001xx/npgolf:latest --file Dockerfile --push .

if ($LASTEXITCODE -eq 0) {
    Write-Host "Successfully built and pushed crj001xx/npgolf:latest (multi-platform)" -ForegroundColor Green
} else {
    Write-Host "Failed to build npgolf image" -ForegroundColor Red
    exit 1
}

Write-Host "`nNote: MySQL image (mysql:8.0) already supports both platforms." -ForegroundColor Yellow
Write-Host "`nDone! Images ready for both Windows and Raspberry Pi deployment." -ForegroundColor Green
