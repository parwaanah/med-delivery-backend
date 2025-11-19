# backend-master-v4.ps1 — Backend Master Controller (fixed & Docker-first)
# Place at: C:\Users\OMEN\med-delivery\backend\backend-master-v4.ps1
# Run as: PowerShell -ExecutionPolicy Bypass -File backend-master-v4.ps1

#region Settings
$backendDir   = "C:\Users\OMEN\med-delivery\backend"
$logFile      = Join-Path $backendDir "backend-master.log"
$dbUser       = "postgres"
$dbPass       = "Hello@123"
$dbHost       = "127.0.0.1"
$dbName       = "med_delivery"
$backendPort  = 3001

# Set to $true to force using WSL redis instead of Docker
$ForceWSLRedis = $false
#endregion

Add-Type -AssemblyName System.Windows.Forms

function Notify {
    param($title, $text)
    try {
        $n = New-Object System.Windows.Forms.NotifyIcon
        $n.Icon = [System.Drawing.SystemIcons]::Information
        $n.BalloonTipTitle = $title
        $n.BalloonTipText  = $text
        $n.Visible = $true
        $n.ShowBalloonTip(3000)
        Start-Sleep -Milliseconds 3500
        $n.Dispose()
    } catch { Write-Host "Notify failed: $($_.Exception.Message)" -ForegroundColor Yellow }
}

function Log {
    param($msg, $color = "White")
    $time = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "[$time] $msg"
    Write-Host $line -ForegroundColor $color
    try { Add-Content -Path $logFile -Value $line -ErrorAction SilentlyContinue } catch {}
}

# Fresh log
if (Test-Path $logFile) { Remove-Item $logFile -Force -ErrorAction SilentlyContinue }
Log "Starting Backend Master Controller..."
Notify "Backend Controller" "Starting system checks..."
Set-Location $backendDir

# Clean old automation scripts (except this one)
Get-ChildItem -Path $backendDir -Filter "auto-*.ps1" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -ne (Join-Path $backendDir "backend-master-v4.ps1") } |
    ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue }
Log "Old automation scripts cleaned." "Yellow"

# Stop existing Node processes
Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object { try { Stop-Process -Id $_.Id -Force } catch {} }
Log "Stopped any existing backend Node.js processes." "Yellow"

# PostgreSQL check
try {
    $svc = Get-Service -Name "postgresql-x64-18" -ErrorAction SilentlyContinue
    if (-not $svc) { Log "PostgreSQL service missing." "Red" }
    elseif ($svc.Status -ne "Running") {
        Log "Starting PostgreSQL..." "Yellow"
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c net start postgresql-x64-18" -NoNewWindow -Wait
    }
    if ($svc) { Log "PostgreSQL service state: $($svc.Status)" "Green" }
} catch { Log "PostgreSQL error: $($_.Exception.Message)" "Red" }

# Update .env DATABASE_URL
$envPath = Join-Path $backendDir ".env"
if (Test-Path $envPath) {
    try {
        $envText = Get-Content $envPath -Raw -ErrorAction SilentlyContinue
        $newDbUrl = "DATABASE_URL=postgresql://${dbUser}:${dbPass}@${dbHost}:5432/${dbName}?schema=public"
        if ($envText -match "DATABASE_URL=") { $envText = $envText -replace "DATABASE_URL=.*", $newDbUrl }
        else { $envText += "`n$newDbUrl" }
        Set-Content -Path $envPath -Value $envText -Encoding UTF8
        Log "Updated .env DATABASE_URL to ${dbHost}" "Green"
    } catch { Log "Failed updating .env: $($_.Exception.Message)" "Yellow" }
} else {
    Log ".env not found; skipping .env edit" "Yellow"
}

# Prisma generate (retry safely)
function Prisma-Generate {
    for ($i = 1; $i -le 3; $i++) {
        try {
            Log "Running npx prisma generate (try $i)..." "Cyan"
            npx prisma generate 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) { Log "Prisma client ready." "Green"; return $true }
        } catch {
            Log "Prisma failed (try $i): $($_.Exception.Message)" "Yellow"
            Start-Sleep -Seconds 1
        }
    }
    return $false
}
Prisma-Generate | Out-Null

# Decide Redis mode: Docker preferred, WSL fallback
function Start-Docker-Redis {
    try {
        if ($ForceWSLRedis) { Log "Docker Redis disabled by $ForceWSLRedis flag." "Yellow"; return $false }
        $dockerExe = (Get-Command docker -ErrorAction SilentlyContinue)
        if (-not $dockerExe) { Log "Docker CLI not found." "Yellow"; return $false }
        # make sure compose file exists
        $composeFile = Join-Path $backendDir "docker-compose.yml"
        if (-not (Test-Path $composeFile)) { Log "docker-compose.yml not found; skipping Docker Redis." "Yellow"; return $false }
        # Remove any conflicting container (non-destructive: only named container conflict)
        try { docker ps -a --format "{{.Names}}" | Select-String -Pattern "^med_delivery_redis$" | ForEach-Object { docker rm -f med_delivery_redis } } catch {}
        Log "Starting Redis via docker-compose..." "Cyan"
        Push-Location $backendDir
        docker compose up -d --quiet-pull
        Pop-Location
        Start-Sleep -Seconds 2
        # Quick check
        try { docker ps --filter "name=med_delivery_redis" --format "{{.Names}}" | Select-String -Pattern "med_delivery_redis" | Out-Null; $ok = $LASTEXITCODE -eq 0 } catch { $ok = $false }
        if ($ok) { Log "Docker Redis started (med_delivery_redis)." "Green"; return $true }
        else { Log "Docker compose started but container not visible." "Yellow"; return $false }
    } catch {
        Log "Docker Redis start error: $($_.Exception.Message)" "Yellow"
        return $false
    }
}

function Start-Redis-WSL {
    try {
        $check = & wsl --exec bash -lc "ss -tuln | grep ':6379' || true"
        if ($check -match 'LISTEN.*:6379|0.0.0.0:6379') {
            Log "Redis already active in WSL." "Green"
            return $true
        }
        Log "Starting Redis in WSL..." "Cyan"
        & wsl --exec bash -lc "sudo redis-server /etc/redis/redis.conf --daemonize yes" | Out-Null
        Start-Sleep -Seconds 2
        $verify = & wsl --exec bash -lc "ss -tuln | grep ':6379' || true"
        if ($verify -match 'LISTEN.*:6379|0.0.0.0:6379') { Log "Redis started successfully in WSL." "Green"; return $true }
        else { Log "Redis failed to start in WSL." "Yellow"; return $false }
    } catch {
        Log "Redis start error (WSL): $($_.Exception.Message)" "Yellow"
        return $false
    }
}

$redisStarted = Start-Docker-Redis
if (-not $redisStarted) {
    Log "Docker Redis not available or failed; trying WSL Redis fallback." "Yellow"
    $redisStarted = Start-Redis-WSL
}
if (-not $redisStarted) { Log "⚠️ Redis not detected. Some features (surge, queues) may fail." "Yellow" }

# Build backend
Log "Building Nest backend..." "Cyan"
npm run build | Out-Null
if ($LASTEXITCODE -ne 0) { Log "Build may have failed (npm exit code $LASTEXITCODE)" "Yellow" } else { Log "Build complete." "Green" }

# Start backend inline (so user sees logs)
Log "Starting backend inline..." "Cyan"
Write-Host "`n------------------ BACKEND LOGS ------------------`n" -ForegroundColor DarkCyan

# Start in current terminal session (will block until stopped)
try {
    Set-Location $backendDir
    npm run start:dev
    Log "Backend process exited." "Yellow"
} catch {
    Log "Error starting backend inline: $($_.Exception.Message)" "Red"
} finally {
    Set-Location $PSScriptRoot
    Write-Host "`n--------------------------------------------------`n" -ForegroundColor DarkCyan
}

# Start a background monitor job to keep things healthy
$monitorJob = Start-Job -ScriptBlock {
    Param($backendDir, $backendPort, $ForceWSL)
    while ($true) {
        try {
            # ensure PostgreSQL is running (best-effort)
            try { $pg = Get-Service -Name "postgresql-x64-18" -ErrorAction SilentlyContinue; if ($pg -and $pg.Status -ne "Running") { Start-Process -FilePath "cmd.exe" -ArgumentList "/c net start postgresql-x64-18" -NoNewWindow -Wait } } catch {}

            # ensure Redis (WSL) running if docker not used
            if (-not $ForceWSL) {
                # check docker container
                try {
                    $out = docker ps --filter "name=med_delivery_redis" --format "{{.Names}}" 2>$null
                    if (-not ($out -match "med_delivery_redis")) {
                        # try starting via compose
                        Push-Location $backendDir
                        docker compose up -d --quiet-pull
                        Pop-Location
                    }
                } catch {}
            } else {
                try {
                    $out = & wsl --exec bash -lc "ss -tuln | grep ':6379' || true"
                    if (-not ($out -match 'LISTEN.*:6379|0.0.0.0:6379')) {
                        & wsl --exec bash -lc "sudo redis-server /etc/redis/redis.conf --daemonize yes" | Out-Null
                    }
                } catch {}
            }

            # ensure backend process is alive (best-effort)
            try {
                $node = Get-Process -Name "node" -ErrorAction SilentlyContinue
                if (-not $node) {
                    Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$backendDir`" && npm run start:dev" -WorkingDirectory $backendDir -WindowStyle Hidden
                }
            } catch {}

        } catch {}
        Start-Sleep -Seconds 15
    }
} -ArgumentList $backendDir, $backendPort, $ForceWSLRedis

Log "Monitor job started (ID: $($monitorJob.Id))." "Cyan"

# Watch for VS Code close to stop background nodes / redis (best-effort)
try {
    Register-WmiEvent -Query "SELECT * FROM Win32_ProcessStopTrace WHERE ProcessName='Code.exe'" -Action {
        try { Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force } catch {}
        try { & wsl --exec bash -lc "sudo pkill redis-server >/dev/null 2>&1 || true" } catch {}
    } | Out-Null
    Log "Auto-shutdown watcher active (VS Code close detection)." "Cyan"
} catch {
    Log "Auto-shutdown watcher skipped: $($_.Exception.Message)" "Yellow"
}

Log "✅ Backend Master Controller ready. Full automation online." "Green"
Notify "Backend Ready" "All systems operational."
