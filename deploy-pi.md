# Deploy to Raspberry Pi

## Prerequisites on Raspberry Pi

1. **Install Docker**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   newgrp docker
   ```

2. **Install Docker Compose**
   ```bash
   sudo apt-get update
   sudo apt-get install -y docker-compose
   ```

3. **Verify Installation**
   ```bash
   docker --version
   docker-compose --version
   ```

## Deploy Application

1. **Clone Repository**
   ```bash
   cd ~
   git clone git@github.com:yourusername/npgolf.git
   cd npgolf
   ```

2. **Pull and Start Containers**
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

3. **Check Status**
   ```bash
   docker-compose ps
   docker logs npgolf-app
   docker logs npgolf-mysql
   ```

4. **Access Application**
   - From Raspberry Pi: `http://localhost:3000`
   - From other devices on network: `http://<raspberry-pi-ip>:3000`
   - To find Pi IP: `hostname -I`

## Update Application

```bash
cd ~/npgolf
git pull
docker-compose pull
docker-compose down
docker-compose up -d
```

## Database Backup on Pi

```bash
# Backup
docker exec npgolf-mysql mysqldump -uroot -proot npgolf > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i npgolf-mysql mysql -uroot -proot npgolf < backup_20241212.sql
```

## Troubleshooting

### Check Logs
```bash
docker logs npgolf-app --tail 50 -f
docker logs npgolf-mysql --tail 50 -f
```

### Restart Services
```bash
docker-compose restart
```

### Clean Start
```bash
docker-compose down -v  # Warning: removes database volume
docker-compose up -d
```

### Check Memory Usage
```bash
docker stats
free -h
```

## Performance Tips for Raspberry Pi

- **Use Raspberry Pi 4 with 4GB+ RAM** for best performance
- **Use SSD instead of SD card** if possible
- **Monitor temperature**: `vcgencmd measure_temp`
- **Consider swap space** if using 2GB RAM model
