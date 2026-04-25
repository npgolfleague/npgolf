#!/bin/bash
# NPGolf Raspberry Pi Performance Monitor
# Logs system and database metrics every 5 minutes

LOG_DIR="$HOME/npgolf/logs"
LOG_FILE="$LOG_DIR/performance-$(date +%Y%m%d).log"

mkdir -p "$LOG_DIR"

# Header with timestamp
echo "=======================================" >> "$LOG_FILE"
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
echo "=======================================" >> "$LOG_FILE"

# 1. Overall Pi CPU and Memory
echo "" >> "$LOG_FILE"
echo "--- SYSTEM RESOURCES ---" >> "$LOG_FILE"
top -bn1 | head -n 5 >> "$LOG_FILE"

# 2. Per-Container CPU and Memory
echo "" >> "$LOG_FILE"
echo "--- DOCKER CONTAINER STATS ---" >> "$LOG_FILE"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}" >> "$LOG_FILE"

# 3. MySQL Database Size
echo "" >> "$LOG_FILE"
echo "--- MYSQL DATABASE SIZE ---" >> "$LOG_FILE"
docker exec npgolf-mysql-pi mysql -u root -p'A6qpNm8hKA&y#8' -e "
SELECT 
    table_schema AS 'Database',
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
FROM information_schema.tables 
WHERE table_schema = 'npgolf'
GROUP BY table_schema;
" 2>/dev/null >> "$LOG_FILE"

# 4. MySQL Disk I/O Stats
echo "" >> "$LOG_FILE"
echo "--- MYSQL I/O STATS ---" >> "$LOG_FILE"
docker exec npgolf-mysql-pi mysql -u root -p'A6qpNm8hKA&y#8' -e "
SELECT 
    FILE_NAME,
    ROUND(SUM_NUMBER_OF_BYTES_READ / 1024 / 1024, 2) AS 'Read (MB)',
    ROUND(SUM_NUMBER_OF_BYTES_WRITE / 1024 / 1024, 2) AS 'Write (MB)'
FROM performance_schema.file_summary_by_instance
WHERE FILE_NAME LIKE '%npgolf%'
LIMIT 10;
" 2>/dev/null >> "$LOG_FILE"

# 5. Active MySQL Connections
echo "" >> "$LOG_FILE"
echo "--- ACTIVE CONNECTIONS ---" >> "$LOG_FILE"
docker exec npgolf-mysql-pi mysql -u root -p'A6qpNm8hKA&y#8' -e "
SHOW STATUS WHERE Variable_name IN ('Threads_connected', 'Threads_running', 'Max_used_connections');
" 2>/dev/null >> "$LOG_FILE"

# 6. Disk Usage
echo "" >> "$LOG_FILE"
echo "--- DISK USAGE ---" >> "$LOG_FILE"
df -h / | tail -n 1 >> "$LOG_FILE"

echo "" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
