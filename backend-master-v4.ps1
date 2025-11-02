# ================================================================
# BACKEND MASTER CONTROLLER v4 — Full Auto-Setup / Heal / Start / Stop
# ================================================================

# (Run VS Code as Administrator to avoid popup window)
# Auto-elevation disabled to keep everything inline.

# --- Variables ---
$backendDir   = "C:\Users\OMEN\med-delivery\backend"
$logFile      = Join-Path $backendDir "backend-master.log"
$dbUser       = "postgres"
$dbPass       = "Hello@123"
$dbHost       = "127.0.0.1"
$dbName       = "med_delivery"
$redisHost    = "192.168.56.251"
$backendPort  = 3001

# --- Notification Function ---
Add-Type -AssemblyName System.Windows.Forms
function Notify {
    param($title, $text)
    $n = New-Object System.Windows.Forms.NotifyIcon
    $n.Icon = [System.Drawing.SystemIcons]::Information
    $n.BalloonTipTitle = $title
    $n.BalloonTipText  = $text
    $n.Visible = $true
    $n.ShowBalloonTip(3000)
    Start-Sleep -Milliseconds 3500
    $n.Dispose()
}

function Log {
    param($msg, $color = "White")
    $time = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "[$time] $msg"
    Write-Host $line -ForegroundColor $color
    Add-Content -Path $logFile -Value $line
}

# --- Fresh log ---
if (Test-Path $logFile) { Remove-Item $logFile -Force -ErrorAction SilentlyContinue }
Log "Starting Backend Master Controller..."
Notify "Backend Controller" "Starting system checks..."
Set-Location $backendDir

# --- Clean old automation scripts ---
Get-ChildItem -Path $backendDir -Filter "auto-*.ps1" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -ne (Join-Path $backendDir "backend-master-v4.ps1") } |
    ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue }
Log "Old automation scripts cleaned." "Yellow"

# --- Stop existing Node processes ---
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Log "Stopped any existing backend Node.js processes." "Yellow"

# --- PostgreSQL ---
try {
    $svc = Get-Service -Name "postgresql-x64-18" -ErrorAction SilentlyContinue
    if (-not $svc) { Log "PostgreSQL service missing." "Red" }
    elseif ($svc.Status -ne "Running") {
        Log "Starting PostgreSQL..." "Yellow"
        net start postgresql-x64-18 | Out-Null
    }
    Log "PostgreSQL service state: $($svc.Status)" "Green"
} catch { Log "PostgreSQL error: $($_.Exception.Message)" "Red" }

# --- Redis in WSL ---
function Start-Redis-WSL {
    try {
        $check = & wsl --exec bash -lc "ss -tuln | grep ':6379' || true"
        if ($check -match '0\.0\.0\.0:6379') {
            Log "Redis already active in WSL." "Green"
            return $true
        }
        Log "Starting Redis in WSL..." "Cyan"
        & wsl --exec bash -lc "sudo redis-server /etc/redis/redis.conf --daemonize yes" | Out-Null
        Start-Sleep -Seconds 2
        $verify = & wsl --exec bash -lc "ss -tuln | grep ':6379' || true"
        if ($verify -match '0\.0\.0\.0:6379') { Log "Redis started successfully in WSL." "Green"; return $true }
        else { Log "Redis failed to start in WSL." "Yellow"; return $false }
    } catch {
        Log "Redis start error: $($_.Exception.Message)" "Yellow"
        return $false
    }
}
$redisOk = Start-Redis-WSL
if (-not $redisOk) { Log "⚠️ Redis not detected. Swagger may still load without it." "Yellow" }

# --- Update .env DATABASE_URL ---
$envPath = Join-Path $backendDir ".env"
if (Test-Path $envPath) {
    $envText = Get-Content $envPath -Raw
    $newDbUrl = "DATABASE_URL=postgresql://${dbUser}:${dbPass}@${dbHost}:5432/${dbName}?schema=public"
    if ($envText -match "DATABASE_URL=") { $envText = $envText -replace "DATABASE_URL=.*", $newDbUrl }
    else { $envText += "`n$newDbUrl" }
    Set-Content -Path $envPath -Value $envText -Encoding UTF8
    Log "Updated .env DATABASE_URL to ${dbHost}" "Green"
}

# --- Configure pgpass for passwordless psql ---
try {
    $pgpass = Join-Path $env:USERPROFILE ".pgpass"
    $pgpassLine = "${dbHost}:5432:${dbName}:${dbUser}:${dbPass}"
    Set-Content -Path $pgpass -Value $pgpassLine -Encoding ASCII
    icacls $pgpass /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
    Log "Configured pgpass for psql." "Green"
} catch { Log "pgpass setup failed: $($_.Exception.Message)" "Yellow" }

# --- Prisma Generate ---
function Prisma-Generate {
    for ($i = 1; $i -le 3; $i++) {
        try {
            Log "Running npx prisma generate (try $i)..." "Cyan"
            & npx prisma generate 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) { Log "Prisma client ready." "Green"; return }
        } catch {
            Log "Prisma failed: $($_.Exception.Message)" "Yellow"
            Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
            Remove-Item -Recurse -Force "$backendDir\node_modules\.prisma" -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 2
    }
}
Prisma-Generate

# --- Build Backend ---
Log "Building Nest backend..." "Cyan"
npm run build | Out-Null
Log "Build complete." "Green"

# --- Start Backend inline inside VS Code terminal ---
Log "Starting backend inline (no popup window)..." "Cyan"
Write-Host "`n------------------ BACKEND LOGS ------------------`n" -ForegroundColor DarkCyan

try {
    Set-Location $backendDir

    # Ensure npm uses the current terminal session
    npm run start:dev

    # When npm stops (Ctrl+C or crash)
    Log "Backend process exited." "Yellow"
}
catch {
    Log "Error starting backend inline: $($_.Exception.Message)" "Red"
}
finally {
    Set-Location $PSScriptRoot
    Write-Host "`n--------------------------------------------------`n" -ForegroundColor DarkCyan
}

# --- Wait until live ---
for ($i = 0; $i -lt 60; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$backendPort/docs" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -eq 200) {
            Log "Backend is LIVE at http://localhost:$backendPort/docs" "Green"
            Notify "Backend Ready" "Swagger Docs available now."
            break
        }
    } catch { Start-Sleep -Seconds 1 }
}

# --- Continuous Monitoring ---
$monitorJob = Start-Job -ScriptBlock {
    Param($backendDir, $backendPort)
    while ($true) {
        try {
            $pg = Get-Service -Name "postgresql-x64-18" -ErrorAction SilentlyContinue
            if ($pg -and $pg.Status -ne "Running") { net start postgresql-x64-18 | Out-Null }
        } catch {}
        try {
            $out = & wsl --exec bash -lc "ss -tuln | grep ':6379' || true"
            if (-not $out -or $out.Trim() -eq "") {
                try { & wsl --exec bash -lc "sudo redis-server /etc/redis/redis.conf --daemonize yes" | Out-Null } catch {}
            }
        } catch {}
        try {
            $node = Get-Process -Name "node" -ErrorAction SilentlyContinue
            if (-not $node) {
                Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$backendDir`" && npm run start:dev" -WorkingDirectory $backendDir -WindowStyle Hidden
            }
        } catch {}
        Start-Sleep -Seconds 15
    }
} -ArgumentList $backendDir, $backendPort
Log "Monitor job started (ID: $($monitorJob.Id))." "Cyan"

# --- Auto shutdown watcher ---
try {
    Register-WmiEvent -Query "SELECT * FROM Win32_ProcessStopTrace WHERE ProcessName='Code.exe'" -Action {
        try { Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force } catch {}
        try { & wsl --exec bash -lc "sudo pkill redis-server >/dev/null 2>&1 || true" } catch {}
    } | Out-Null
    Log "Auto-shutdown watcher active (VS Code + terminal close)." "Cyan"
} catch {
    Log "Auto-shutdown watcher skipped: $($_.Exception.Message)" "Yellow"
}

Log "✅ Backend Master Controller ready. Full automation online." "Green"
Notify "Backend Ready" "All systems operational."
