# backend-auto-start.ps1
$script = Join-Path $PSScriptRoot "backend-master-v4.ps1"
if (-not (Test-Path $script)) {
    Write-Error "backend-master-v4.ps1 not found at $script"
    exit 1
}
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$script`"" -WindowStyle Hidden
Write-Output "backend auto-start invoked."
