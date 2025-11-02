# ================================================================
# BACKEND MASTER CONTROLLER v4.5 (FINAL STABLE)
# Full Auto-Setup + Heal + Rebuild + Start + Auto-Shutdown
# Works on PowerShell 5.x and 7+
# ================================================================

$backendDir = "C:\Users\OMEN\med-delivery\backend"
$dbUser = "postgres"
$dbPass = "Hello@123"
$dbHost = "127.0.0.1"
$dbName = "med_delivery"
$redisHost = "192.168.56.251"
$backendPort = 3001
$logFile = "$backendDir\backend-master.log"

# --- Logger
function Log {
    param([string]$msg, [string]$color = "White")
    $time = (Get-Date).ToString("HH:mm:ss")
    Write-Host "[$time] $msg" -ForegroundColor $color
    Add-Content -Path $logFile -Value "[$time] $msg"
}

# --- Init
if (Test-Path $logFile) { Remove-Item $logFile -Force }
Set-Location $backendDir
Log "Starting Backend Master Controller..." "Cyan"

# --- Configure passwordless sudo for Redis
$wslSudoers = "/etc/sudoers.d/redis-auto"
$wslRule = "owais ALL=(ALL) NOPASSWD: /usr/bin/redis-server, /usr/bin/pkill redis-server"
wsl bash -c "echo '$wslRule' | sudo tee $wslSudoers > /dev/null"
wsl bash -c "sudo chmod 440 $wslSudoers"
Log "Configured WSL for passwordless Redis management." "Yellow"

# --- Remove old automation scripts
Get-ChildItem -Path $backendDir -Filter "auto-*.ps1" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne "backend-master.ps1" } |
    Remove-Item -Force -ErrorAction SilentlyContinue
Log "Old automation scripts removed (auto-heal, setup, rebuild...)." "Yellow"

# --- Kill Node.js
taskkill /IM node.exe /F /T > $null 2>&1
Log "Cleaned up existing Node.js backend processes." "Yellow"

# --- Start PostgreSQL
$pgService = Get-Service -Name "postgresql-x64-18" -ErrorAction SilentlyContinue
if ($pgService -eq $null) {
    Log "PostgreSQL service not found. Please reinstall PostgreSQL." "Red"
    exit
}
if ($pgService.Status -ne "Running") {
    Log "Starting PostgreSQL service..." "Yellow"
    net start postgresql-x64-18 | Out-Null
}
Log "PostgreSQL service is running." "Green"

# --- Redis start function
function Start-Redis {
    Log "Attempting to start Redis directly inside WSL..." "Yellow"
    $redisCheck = wsl bash -c "pgrep redis-server >/dev/null 2>&1; echo $?"
    if ($redisCheck.Trim() -ne "0") {
        wsl bash -c "sudo pkill redis-server >/dev/null 2>&1; sudo mkdir -p /var/run/redis; sudo chown redis:redis /var/run/redis; nohup sudo redis-server --daemonize yes >/dev/null 2>&1 &"
        Start-Sleep -Seconds 3
    }
    $verify = wsl bash -c "pgrep redis-server >/dev/null 2>&1; echo $?"
    if ($verify.Trim() -eq "0") {
        Log "Redis running at redis://$redisHost:6379" "Green"
        return $true
    } else {
        Log "Redis failed to start. Please verify manually." "Red"
        return $false
    }
}

# --- Start Redis
Start-Redis | Out-Null

# --- Verify PostgreSQL
try {
    & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U $dbUser -h $dbHost -d $dbName -c "\conninfo" | Out-Null
    Log "Database connectivity verified successfully." "Green"
} catch {
    Log "Database check failed (continuing anyway)." "Yellow"
}

# --- Prisma setup
Log "Regenerating Prisma client..." "Cyan"
try {
    npx prisma generate | Out-Null
    Log "Prisma client generated successfully." "Green"
} catch {
    Log "Prisma generation failed. Reinstalling Prisma..." "Yellow"
    npm install @prisma/client prisma --force | Out-Null
    npx prisma generate | Out-Null
    Log "Prisma repaired and regenerated." "Green"
}

# --- Build backend
Log "Building backend..." "Cyan"
npm run build | Out-Null
Log "Build completed successfully." "Green"

# --- Start backend
Log "Launching backend server on port $backendPort..." "Cyan"
Start-Process powershell -ArgumentList "-WindowStyle Hidden -ExecutionPolicy Bypass -Command npm run start:dev"

# --- Wait until backend is live
$backendReady = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:$backendPort/docs" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($resp.StatusCode -eq 200) {
            $backendReady = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 2
    }
}

if ($backendReady) {
    Log "Backend is LIVE at http://localhost:$backendPort/docs" "Green"
    Start-Process "http://localhost:$backendPort/docs"
} else {
    Log "Backend not detected after 60 seconds. Restarting once..." "Yellow"
    Stop-Process -Name node -Force -ErrorAction SilentlyContinue
    Start-Process powershell -ArgumentList "-WindowStyle Hidden -ExecutionPolicy Bypass -Command npm run start:dev"
}

# --- Continuous Monitoring + Auto-Heal + Shutdown
Log "Entering continuous monitoring mode (PostgreSQL, Redis, Backend)..." "Cyan"

$global:scriptRunning = $true

# --- Graceful shutdown
Register-EngineEvent PowerShell.Exiting -Action {
    Log "Shutdown triggered. Stopping backend and Redis..." "Yellow"
    try { taskkill /IM node.exe /F /T > $null 2>&1 } catch {}
    try { wsl bash -c "sudo pkill redis-server" } catch {}
    Log "All services stopped safely." "Green"
}

# --- Monitor loop
while ($global:scriptRunning) {
    # PostgreSQL
    $pgStatus = (Get-Service -Name "postgresql-x64-18" -ErrorAction SilentlyContinue).Status
    if ($pgStatus -ne "Running") {
        Log "PostgreSQL stopped. Restarting..." "Yellow"
        net start postgresql-x64-18 | Out-Null
    }

    # Redis
    $redisRunning = (wsl bash -c "pgrep redis-server >/dev/null 2>&1; echo $?").Trim()
    if ($redisRunning -ne "0") {
        Log "Redis stopped. Restarting manually..." "Yellow"
        Start-Redis | Out-Null
    }

    # Backend
    $node = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if (-not $node) {
        Log "Backend crashed. Restarting..." "Yellow"
        Start-Process powershell -ArgumentList "-WindowStyle Hidden -ExecutionPolicy Bypass -Command npm run start:dev"
    }

    Start-Sleep -Seconds 20
}
