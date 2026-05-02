#!/bin/bash
# Export current database schema to create a consolidated baseline

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3308}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-root}"
DB_NAME="${DB_NAME:-npgolf}"
OUTPUT_FILE="schema_consolidated.sql"

echo "Exporting schema from $DB_NAME..."

# Export schema only (no data) using mysqldump
docker exec npgolf-mysql-pi mysqldump \
  -u"$DB_USER" \
  -p"$DB_PASS" \
  --no-data \
  --skip-add-drop-table \
  --skip-comments \
  --compact \
  "$DB_NAME" > "$OUTPUT_FILE"

echo "Schema exported to $OUTPUT_FILE"
echo ""
echo "Next steps:"
echo "1. Review the consolidated schema"
echo "2. Archive old migrations: mkdir migrations/archive && mv migrations/*.sql migrations/archive/"
echo "3. Create new baseline: migrations/001_baseline_schema.sql"
echo "4. Add new migrations for multi-league and billing features"
