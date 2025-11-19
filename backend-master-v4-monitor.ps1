# =====================================================================
# BACKEND MASTER WATCHDOG v4 — DOCKER REDIS + BACKEND AUTO-HEALER
# =====================================================================

$backendDir     = "C:\Users\OMEN\med-delivery\backend"
$backendPort    = 3001
$redisContainer = "med_redis"
$logFile        = Join-Path $backendDir "backend-monitor.log"

# Logging helper
function Log {
    param($msg, $color = "Gray")
    $time = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "[$time] $msg"
    Write-Host $line -ForegroundColor $color
    Add-Content -Path $logFile -Value $line
}

# Write fresh header
"==== BACKEND WATCHDOG STARTED $(Get-Date) ====" | Out-File $logFile

Log "🔍 Watchdog running..." "Cyan"

# Ensure backend directory
Set-Location $backendDir

# ------------------------------- HELPERS -------------------------------

function Check-Redis {
    try {
        $running = docker ps --filter "name=$redisContainer" --format "{{.Names}}"
        if ($running -eq $redisContainer) {
            return $true
        }

        $exists = docker ps -a --filter "name=$redisContainer" --format "{{.Names}}"
        if ($exists -eq $redisContainer) {
            Log "⚠️ Redis stopped — attempting restart..." "Yellow"
            docker start $redisContainer | Out-Null
            Start-Sleep 2
            return $true
        }

        Log "❌ Redis container missing — rebuilding via docker-compose..." "Red"
        docker compose up -d | Out-Null
        Start-Sleep 3
        return $true
    }
    catch {
        Log "Redis check failed: $($_.Exception.Message)" "Red"
        return $false
    }
}

function Check-Postgres {
    try {
        $svc = Get-Service -Name "postgresql-x64-18" -ErrorAction SilentlyContinue
        if ($svc -and $svc.Status -ne "Running") {
            Log "⚠️ PostgreSQL down — restarting..." "Yellow"
            net start postgresql-x64-18 | Out-Null
        }
        return $true
    }
    catch {
        Log "PostgreSQL check error: $($_.Exception.Message)" "Red"
        return $false
    }
}

function Check-Backend {
    try {
        # Check if backend is responding
        $r = Invoke-WebRequest -Uri "http://localhost:$backendPort/health" -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { return $true }
    }
    catch {}

    # If not responding — check if Node even exists
    $node = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if (-not $node) {
        Log "⚠️ Backend dead — restarting backend..." "Red"

        Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$backendDir`" && npm run start:dev" `
            -WorkingDirectory $backendDir -WindowStyle Hidden

        Start-Sleep 4
        return $true
    }

    # Node is running but backend API is dead — restart Node
    Log "⚠️ Node running but backend unhealthy — restarting..." "Yellow"
    $node | Stop-Process -Force
    Start-Sleep 1

    Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$backendDir`" && npm run start:dev" `
        -WorkingDirectory $backendDir -WindowStyle Hidden

    Start-Sleep 4
    return $true
}

# ----------------------------- MAIN LOOP ------------------------------

while ($true) {
    Log "🔎 Health check..." "DarkGray"

    # Redis
    if (Check-Redis) {
        Log "✔ Redis OK" "Green"
    } else {
        Log "❌ Redis failed repeatedly" "Red"
    }

    # PostgreSQL
    if (Check-Postgres) {
        Log "✔ PostgreSQL OK" "Green"
    }

    # Backend (Node.js)
    if (Check-Backend) {
        Log "✔ Backend OK" "Green"
    }

    # Sleep between rounds
    Start-Sleep -Seconds 15
}
