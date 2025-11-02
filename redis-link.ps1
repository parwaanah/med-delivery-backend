# redis-link.ps1 — keep Redis connection stable between WSL & Windows

# Get current WSL IP
$wslIp = wsl hostname -I | ForEach-Object { $_.Trim() } | Select-String -Pattern '(\d+\.\d+\.\d+\.\d+)' | ForEach-Object { $_.Matches.Value }

if (-not $wslIp) {
    Write-Host "❌ Could not detect WSL IP."
    exit
}

# Update backend .env
$envFile = "C:\Users\OMEN\med-delivery\backend\.env"
$content = Get-Content $envFile
$newContent = $content -replace 'REDIS_URL=.*', "REDIS_URL=redis://$wslIp`:6379"
$newContent = $newContent -replace 'REDIS_HOST=.*', "REDIS_HOST=$wslIp"
Set-Content -Path $envFile -Value $newContent

Write-Host "✅ Updated Redis IP to $wslIp in .env"

# Restart backend (optional)
npm run start:dev
