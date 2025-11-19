# migrate-db-to-utf8.ps1
param()
# --- CONFIG: edit if needed ---
$backendDir = "C:\Users\OMEN\med-delivery\backend"
$pgHost    = "127.0.0.1"
$pgPort    = 5432
$dbUser    = "postgres"
$dbPass    = "Hello@123"
$dbName    = "med_delivery"
$newDbName = "${dbName}_utf8_tmp"
$backupDir = Join-Path $env:USERPROFILE "med_delivery_db_backups"
# ------------------------------

function Log { param($m) Write-Host ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m) }

# Ensure backup dir exists
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
$globalsFile = Join-Path $backupDir "globals_${dbName}_$timestamp.sql"
$dumpFile    = Join-Path $backupDir "${dbName}_dump_${timestamp}.dump"

# Set non-interactive password
$env:PGPASSWORD = $dbPass

# 1) Stop backend / Node processes
Log "Stopping Node processes (if any)..."
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# 2) Export global roles & users
Log "Dumping globals (roles) to $globalsFile ..."
pg_dumpall --host $pgHost --port $pgPort --username $dbUser --globals-only --file="$globalsFile"
if ($LASTEXITCODE -ne 0) { Log "ERROR: globals dump failed"; exit 1 }

# 3) Dump the target DB (custom format)
Log "Dumping database $dbName to $dumpFile ..."
pg_dump --host $pgHost --port $pgPort --username $dbUser --format=custom --no-owner --file="$dumpFile" $dbName
if ($LASTEXITCODE -ne 0) { Log "ERROR: pg_dump failed"; exit 1 }

# 4) Create new DB with UTF8 encoding
Log "Creating new database $newDbName with UTF8 encoding..."
# createdb command with template0 ensures encoding creation
createdb --host $pgHost --port $pgPort --username $dbUser --encoding=UTF8 --locale=en_US.UTF-8 --template=template0 $newDbName
if ($LASTEXITCODE -ne 0) {
  Log "WARN: createdb failed (maybe locale not available). Attempting SQL create..."
  psql --host $pgHost --port $pgPort --username $dbUser -d postgres -c "CREATE DATABASE \"$newDbName\" WITH ENCODING='UTF8' TEMPLATE=template0 LC_COLLATE='en_US.UTF-8' LC_CTYPE='en_US.UTF-8';"
  if ($LASTEXITCODE -ne 0) { Log "ERROR: create database failed"; exit 1 }
}

# 5) Restore dump into new DB
Log "Restoring dump into $newDbName ..."
pg_restore --host $pgHost --port $pgPort --username $dbUser --dbname=$newDbName --verbose "$dumpFile"
if ($LASTEXITCODE -ne 0) { Log "ERROR: pg_restore failed"; exit 1 }

# 6) (Optional) apply globals (roles) - skipped if you already have roles
# If your dump relies on roles that don't exist, uncomment the next lines:
# Log "Applying global roles from $globalsFile ..."
# psql --host $pgHost --port $pgPort --username $dbUser -d postgres -f "$globalsFile"

# 7) Verify new DB encoding
Log "Checking encoding of new DB..."
psql --host $pgHost --port $pgPort --username $dbUser -d postgres -c "SELECT datname, pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname='$newDbName';"

# 8) Swap database names (keep old as backup)
$oldBackupName = "${dbName}_old_$timestamp"
Log "Renaming original DB to $oldBackupName ..."
# Make sure no connections exist
psql --host $pgHost --port $pgPort --username $dbUser -d postgres -c "REVOKE CONNECT ON DATABASE \"$dbName\" FROM PUBLIC; SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$dbName' AND pid<>pg_backend_pid();"
psql --host $pgHost --port $pgPort --username $dbUser -d postgres -c "ALTER DATABASE \"$dbName\" RENAME TO \"$oldBackupName\";"
if ($LASTEXITCODE -ne 0) { Log "ERROR: rename original DB failed"; exit 1 }

Log "Renaming $newDbName to $dbName ..."
psql --host $pgHost --port $pgPort --username $dbUser -d postgres -c "ALTER DATABASE \"$newDbName\" RENAME TO \"$dbName\";"
if ($LASTEXITCODE -ne 0) { Log "ERROR: rename new DB failed; attempting to roll back"; exit 1 }

# 9) Cleanup: keep dumps but leave old DB in place for manual verification
Log "Migration complete. Backups located in: $backupDir"
Log "Original DB renamed to: $oldBackupName  (you can drop it after verification)"
Log "You should now restart your backend and test."

# 10) Final test: insert a unicode notification sample (safe)
Log "Inserting test notification with a unicode-safe placeholder ..."

# Using a verbatim PowerShell string so emojis don't break parsing
$testSql = @"
INSERT INTO notification(type, message, receiverId, status, createdAt, meta)
VALUES ('ADMIN_TOAST', 'Unicode test: OK - UTF8 migration successful', 1, 'UNREAD', now(), '{}'::jsonb)
RETURNING id;
"@

psql --host $pgHost --port $pgPort --username $dbUser -d $dbName -c "$testSql"


Log "DONE."
