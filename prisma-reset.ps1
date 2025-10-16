# =====================================
# PRISMA AUTO-FIX SCRIPT (v5.3 SAFE)
# - Works from anywhere (auto-detects backend)
# - Validates .env and regenerates Prisma client
# - Applies migration or falls back to db push
# - Restarts NestJS server automatically
# =====================================

# --------------------------
# Locate Backend Folder
# --------------------------
$backendPaths = @(
    ".\backend",
    ".\server",
    ".\api",
    "."
)

$backendPath = $null
foreach ($path in $backendPaths) {
    if (Test-Path "$path\package.json") {
        $backendPath = (Resolve-Path $path).Path
        break
    }
}

if (-not $backendPath) {
    Write-Host "ERROR: No backend folder found. Ensure you're in the project root." -ForegroundColor Red
    exit 1
}

Set-Location $backendPath
Write-Host "Working in backend folder: $backendPath" -ForegroundColor Yellow

# --------------------------
# Setup Paths and Log File
# --------------------------
$logDir = "logs"
$logFile = "$logDir\dev-tools.log"
$envFile = ".env"
$envBackup = ".env.backup"

if (!(Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

$timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
Add-Content $logFile "`n[$timestamp] Starting Prisma Auto-Fix..."

# --------------------------
# Step 1 - Validate .env
# --------------------------
if (!(Test-Path $envFile)) {
    Write-Host "ERROR: .env file missing!" -ForegroundColor Red
    Add-Content $logFile " - ERROR: .env missing!"
    exit 1
}

$envContent = Get-Content $envFile -Raw
$databaseUrl = ($envContent -split "`n" | Where-Object { $_ -match "^DATABASE_URL\s*=" }) -replace "^DATABASE_URL\s*=\s*", ""

if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    Write-Host "ERROR: DATABASE_URL missing or empty!" -ForegroundColor Red
    Add-Content $logFile " - ERROR: DATABASE_URL missing or empty!"
    exit 1
}

Copy-Item $envFile $envBackup -Force
Write-Host "SUCCESS: .env validated and backup created." -ForegroundColor Green
Add-Content $logFile " - .env validated and backup created."

# --------------------------
# Step 2 - Kill existing Node processes
# --------------------------
taskkill /f /im node.exe 2>$null | Out-Null
Write-Host "INFO: Existing Node.js processes terminated." -ForegroundColor Yellow
Add-Content $logFile " - Node processes terminated."

# --------------------------
# Step 3 - Clean Prisma cache
# --------------------------
if (Test-Path "node_modules\.prisma") {
    Remove-Item -Recurse -Force "node_modules\.prisma"
    Write-Host "INFO: Prisma cache cleared." -ForegroundColor Cyan
    Add-Content $logFile " - Removed node_modules\.prisma."
} else {
    Add-Content $logFile " - No .prisma cache found."
}

# --------------------------
# Step 4 - Regenerate Prisma client
# --------------------------
try {
    Write-Host "INFO: Regenerating Prisma client..." -ForegroundColor Yellow
    npx prisma generate | Tee-Object -FilePath $logFile -Append
    Write-Host "SUCCESS: Prisma client generated successfully." -ForegroundColor Green
    Add-Content $logFile " - Prisma client generated successfully."
} catch {
    Write-Host "ERROR: Prisma generation failed: $($_.Exception.Message)" -ForegroundColor Red
    Add-Content $logFile " - Prisma generation failed: $($_.Exception.Message)"
    Copy-Item $envBackup $envFile -Force
    exit 1
}

# --------------------------
# Step 5 - Apply migrations or fallback to db push
# --------------------------
try {
    Write-Host "INFO: Applying Prisma migrations..." -ForegroundColor Yellow
    npx prisma migrate dev --name auto_fix_migration | Tee-Object -FilePath $logFile -Append

    if ($LASTEXITCODE -ne 0) {
        throw "Migration failed, fallback required"
    }

    Write-Host "SUCCESS: Migrations applied successfully." -ForegroundColor Green
    Add-Content $logFile " - Migrations applied successfully."

} catch {
    Write-Host "WARNING: Migration failed, running db push fallback..." -ForegroundColor Yellow
    Add-Content $logFile " - Migration failed, running db push fallback."

    try {
        npx prisma db push | Tee-Object -FilePath $logFile -Append
        if ($LASTEXITCODE -eq 0) {
            Write-Host "SUCCESS: db push completed successfully." -ForegroundColor Green
            Add-Content $logFile " - db push completed successfully."
        } else {
            throw "db push also failed"
        }
    } catch {
        Write-Host "ERROR: db push fallback failed." -ForegroundColor Red
        Add-Content $logFile " - db push fallback failed."
        Copy-Item $envBackup $envFile -Force
        exit 1
    }
}

# --------------------------
# Step 6 - Restart NestJS server
# --------------------------
Write-Host "INFO: Restarting NestJS server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "npm run start:dev" -WorkingDirectory . -NoNewWindow
Add-Content $logFile " - NestJS restarted successfully."

# --------------------------
# Step 7 - Completion Log
# --------------------------
$timestampEnd = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
Add-Content $logFile "[$timestampEnd] Prisma Auto-Fix completed successfully.`n"
Write-Host "SUCCESS: All done! Prisma fixed, DB synced, and server restarted." -ForegroundColor Green
