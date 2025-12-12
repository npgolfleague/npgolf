# PowerShell script to build and push multi-architecture Docker images
# Supports both AMD64 (Windows/Linux desktop) and ARM64 (Raspberry Pi)

Write-Host "Setting up Docker buildx for multi-architecture builds..." -ForegroundColor Cyan

# Create and use a new builder instance if it doesn't exist
$builderExists = docker buildx ls | Select-String "multiarch"
if (-not $builderExists) {
    Write-Host "Creating new buildx builder 'multiarch'..." -ForegroundColor Yellow
    docker buildx create --name multiarch --use
} else {
    Write-Host "Using existing buildx builder 'multiarch'..." -ForegroundColor Green
    docker buildx use multiarch
}

# Bootstrap the builder
Write-Host "Bootstrapping builder..." -ForegroundColor Cyan
docker buildx inspect --bootstrap

# Build and push multi-architecture image
Write-Host "Building and pushing multi-arch image for linux/amd64 and linux/arm64..." -ForegroundColor Cyan
docker buildx build --platform linux/amd64,linux/arm64 `
  -t crj001xx/npgolf:latest `
  --push .

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSuccess! Multi-architecture image pushed to Docker Hub" -ForegroundColor Green
    Write-Host "Image supports: linux/amd64 (Windows/Linux desktop) and linux/arm64 (Raspberry Pi)" -ForegroundColor Green
    Write-Host "`nTo deploy on Raspberry Pi:" -ForegroundColor Cyan
    Write-Host "  1. SSH into your Raspberry Pi" -ForegroundColor White
    Write-Host "  2. Clone the repository: git clone <your-repo-url>" -ForegroundColor White
    Write-Host "  3. Run: docker-compose pull && docker-compose up -d" -ForegroundColor White
} else {
    Write-Host "`nBuild failed! Check the error messages above." -ForegroundColor Red
    exit 1
}
