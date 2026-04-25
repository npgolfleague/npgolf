# Raspberry Pi 5 Deployment Guide

## Prerequisites on Raspberry Pi
1. Docker installed: `curl -fsSL https://get.docker.com | sh`
2. Add user to docker group: `sudo usermod -aG docker $USER`
3. Log out and back in

## Building Images for Raspberry Pi (from Windows)

Run the build script:
```powershell
.\build-pi.ps1
```

This will:
- Build the application image for ARM64 architecture
- Push it to Docker Hub as `crj001xx/npgolf-pi:latest`

**Note:** MySQL 8.0 already supports ARM64, so we use the official image directly.

## Deploying to Raspberry Pi

### 1. Copy files to your Pi
```powershell
# Replace with your Pi's IP address
scp docker-compose-pi.yml pi@<pi-ip-address>:~/npgolf/
scp npgolf_backup_*.sql pi@<pi-ip-address>:~/npgolf/
```

### 2. SSH into your Pi
```powershell
ssh pi@<pi-ip-address>
```

### 3. Start the containers
```bash
cd ~/npgolf
docker compose -f docker-compose-pi.yml up -d
```

### 4. Restore the database backup
```bash
cd ~/npgolf
cat npgolf_backup_*.sql | docker exec -i npgolf-mysql-pi mysql -uroot -proot npgolf
```

### 5. Verify deployment
```bash
docker ps
curl http://localhost:3000/api/players
```

## Accessing the Application

- From the Pi: http://localhost:3000
- From network: http://<pi-ip-address>:3000

## Updating the Application

### On Windows (build new image):
```powershell
.\build-pi.ps1
```

### On Raspberry Pi (pull and restart):
```bash
cd ~/npgolf
docker compose -f docker-compose-pi.yml pull
docker compose -f docker-compose-pi.yml up -d
```

## Troubleshooting

View logs:
```bash
docker logs npgolf-app-pi
docker logs npgolf-mysql-pi
```

Restart containers:
```bash
docker compose -f docker-compose-pi.yml restart
```

Stop containers:
```bash
docker compose -f docker-compose-pi.yml down
```
