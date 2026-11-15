# Refresh schema.sql (structure only, no data) from the MySQL container.
# Run from the project root after applying migrations:  .\scripts\export-schema.ps1
# On the Pi pass -Container npgolf-mysql-pi.

param(
  [string]$Container = "npgolf-mysql",
  [string]$DbUser = "root",
  [string]$DbPass = "root",
  [string]$DbName = "npgolf"
)

$OutputFile = "schema.sql"
Write-Host "Exporting schema of $DbName from $Container..." -ForegroundColor Green

$dump = docker exec -e MYSQL_PWD=$DbPass $Container mysqldump `
  -u"$DbUser" `
  --no-data `
  --skip-comments `
  --skip-add-drop-table `
  --no-tablespaces `
  --set-gtid-purged=OFF `
  "$DbName"

$header = "-- npgolf schema snapshot (structure only). Regenerate with scripts/export-schema.ps1."
$body = ($dump | ForEach-Object { $_ -replace ' AUTO_INCREMENT=\d+', '' })
@($header) + $body | Set-Content -Encoding utf8 $OutputFile

Write-Host "Schema exported to $OutputFile" -ForegroundColor Green
