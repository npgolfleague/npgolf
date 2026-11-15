#!/bin/bash
# Refresh schema.sql (structure only, no data) from the MySQL container.
# Run from the project root after applying migrations:  bash scripts/export-schema.sh
# Override the container with MYSQL_CONTAINER=npgolf-mysql-pi on the Pi.

MYSQL_CONTAINER="${MYSQL_CONTAINER:-npgolf-mysql}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-root}"
DB_NAME="${DB_NAME:-npgolf}"
OUTPUT_FILE="schema.sql"

echo "Exporting schema of $DB_NAME from $MYSQL_CONTAINER..."

{
  echo "-- npgolf schema snapshot (structure only). Regenerate with scripts/export-schema.sh."
  docker exec -e MYSQL_PWD="$DB_PASS" "$MYSQL_CONTAINER" mysqldump \
    -u"$DB_USER" \
    --no-data \
    --skip-comments \
    --skip-add-drop-table \
    --no-tablespaces \
    --set-gtid-purged=OFF \
    "$DB_NAME" | sed -E 's/ AUTO_INCREMENT=[0-9]+//'
} > "$OUTPUT_FILE"

echo "Schema exported to $OUTPUT_FILE"
