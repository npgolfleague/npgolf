# Export current database schema to create a consolidated baseline
# Run from project root

$DB_HOST = "localhost"
$DB_PORT = "3308"
$DB_USER = "root"
$DB_PASS = "root"
$DB_NAME = "npgolf"
$OUTPUT_FILE = "schema_consolidated.sql"

Write-Host "Exporting schema from $DB_NAME..." -ForegroundColor Green

# Export schema only (no data) using mysqldump via Docker
docker exec npgolf-mysql-pi mysqldump `
  -u"$DB_USER" `
  -p"$DB_PASS" `
  --no-data `
  --skip-add-drop-table `
  --skip-comments `
  --routines `
  --triggers `
  "$DB_NAME" | Out-File -Encoding UTF8 "$OUTPUT_FILE"

Write-Host ""
Write-Host "Schema exported to $OUTPUT_FILE" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review the consolidated schema file"
Write-Host "2. Archive old migrations:"
Write-Host "   mkdir migrations\archive"
Write-Host "   mv migrations\*.sql migrations\archive\"
Write-Host "3. Create new baseline: migrations\001_baseline_schema.sql"
Write-Host "4. Add migration tracking table (see below)"
Write-Host "5. Add new migrations for multi-league and billing features"
Write-Host ""
Write-Host "Suggested multi-league structure:" -ForegroundColor Cyan
Write-Host "- leagues table (id, name, owner_id, created_at)"
Write-Host "- league_memberships (league_id, player_id, role)"
Write-Host "- subscriptions (league_id, plan, status, billing_date)"
Write-Host "- Update existing tables to add league_id foreign keys"
