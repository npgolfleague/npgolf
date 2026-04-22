# NPGolf Raspberry Pi Monitoring Guide

## Setup Instructions

### 1. Copy the monitoring script to your Pi
```bash
# From your Windows machine
scp C:\Users\dalin\projects\npgolf\monitor-pi.sh dalin@raspberrypi:~/npgolf/
```

### 2. Make it executable
```bash
# SSH into your Pi
ssh dalin@raspberrypi
cd ~/npgolf
chmod +x monitor-pi.sh
```

### 3. Test the script manually
```bash
./monitor-pi.sh
cat logs/performance-$(date +%Y%m%d).log
```

### 4. Set up automated logging (every 5 minutes)
```bash
# Edit crontab
crontab -e

# Add this line (press 'i' to insert in nano):
*/5 * * * * /home/dalin/npgolf/monitor-pi.sh

# Save and exit (Ctrl+X, then Y, then Enter)
```

### 5. Start monitoring for tomorrow
The cron job will automatically run every 5 minutes. To ensure it's working:
```bash
# Check cron is running
sudo systemctl status cron

# Wait 5 minutes, then check if log file is created
ls -lh ~/npgolf/logs/performance-*.log
```

---

## Quick Manual Check Commands

### Overall System Status
```bash
# CPU and Memory overview
top -bn1 | head -n 15

# Disk space
df -h
```

### Docker Container Stats (Live)
```bash
# All containers summary
docker stats --no-stream

# Continuous monitoring (Ctrl+C to stop)
docker stats
```

### Database Size
```bash
docker exec npgolf-mysql-pi mysql -u root -p'A6qpNm8hKA&y#8' -e "
SELECT 
    table_schema AS 'Database',
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)',
    COUNT(*) AS 'Tables'
FROM information_schema.tables 
WHERE table_schema = 'npgolf'
GROUP BY table_schema;
"
```

### MySQL Connection Count
```bash
docker exec npgolf-mysql-pi mysql -u root -p'A6qpNm8hKA&y#8' -e "
SHOW STATUS WHERE Variable_name IN ('Threads_connected', 'Threads_running');
"
```

### Application Logs (Last 50 lines)
```bash
docker logs npgolf-app-pi --tail 50
```

---

## Viewing Log Files

### View today's performance log
```bash
cat ~/npgolf/logs/performance-$(date +%Y%m%d).log
```

### View specific date (e.g., April 22, 2026)
```bash
cat ~/npgolf/logs/performance-20260422.log
```

### Count how many snapshots were taken
```bash
grep -c "Timestamp:" ~/npgolf/logs/performance-$(date +%Y%m%d).log
```

### View just the summary sections
```bash
# See all Docker stats snapshots
grep -A 4 "DOCKER CONTAINER STATS" ~/npgolf/logs/performance-$(date +%Y%m%d).log

# See all database sizes
grep -A 3 "MYSQL DATABASE SIZE" ~/npgolf/logs/performance-$(date +%Y%m%d).log
```

### Copy log file to Windows for analysis
```bash
# From your Windows PowerShell
scp dalin@raspberrypi:~/npgolf/logs/performance-$(date +%Y%m%d).log C:\Users\dalin\Downloads\
```

---

## What to Look For

### CPU Warning Signs
- **npgolf-app-pi** using >50% CPU consistently = high load, may need optimization
- **npgolf-mysql-pi** using >30% CPU = database queries may be slow

### Memory Warning Signs
- Overall system memory >90% = Pi is struggling
- Swap usage >100MB = system running out of RAM

### Database Warning Signs
- Database size growing >100MB/day = check for unnecessary data retention
- Active connections >20 = possible connection leak

### Disk Warning Signs
- Disk usage >80% = need to clean up old logs or backups

---

## Stop Monitoring

To stop the automated logging:
```bash
# Edit crontab
crontab -e

# Delete or comment out the monitoring line by adding # at the start:
# */5 * * * * /home/dalin/npgolf/monitor-pi.sh

# Save and exit
```

---

## Clean Up Old Logs

```bash
# Delete logs older than 7 days
find ~/npgolf/logs/performance-*.log -mtime +7 -delete

# View total size of log directory
du -sh ~/npgolf/logs/
```
