# stop-backend.ps1
# Gracefully stop Node backend and monitoring jobs

Write-Host "`n🛑 Stopping backend and monitor..." -ForegroundColor Yellow

# stop node processes
try {
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "✔ Node backend stopped." -ForegroundColor Green
} catch {
    Write-Host "⚠ Node not found or already stopped."
}

# stop backend monitor jobs (if any)
try {
    Get-Job | Where-Object { $_.Name -like "*backend*" -or $_.Command -match "backend-master" } |
        Stop-Job -Force -ErrorAction SilentlyContinue
    Get-Job | Where-Object { $_.Name -like "*backend*" -or $_.Command -match "backend-master" } |
        Remove-Job -Force -ErrorAction SilentlyContinue
    Write-Host "✔ Background monitor jobs stopped." -ForegroundColor Green
} catch {
    Write-Host "⚠ No monitor jobs found or already stopped."
}

Write-Host "`n✅ Backend fully stopped." -ForegroundColor Cyan
