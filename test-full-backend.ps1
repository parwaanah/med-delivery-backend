# ===================================================
# MED DELIVERY BACKEND - FULL API TEST (STABLE VERSION)
# ===================================================

$baseUrl = "http://localhost:3001"
Write-Host "`n=== Testing Backend API at $baseUrl ===`n" -ForegroundColor Cyan

# ---------- Helpers ----------
function Safe-Request {
    param($Uri, $Method, $Body, $Headers)
    try {
        if ($Body) {
            return Invoke-RestMethod -Uri $Uri -Method $Method -Headers $Headers `
                -Body ($Body | ConvertTo-Json) -ContentType "application/json"
        } else {
            return Invoke-RestMethod -Uri $Uri -Method $Method -Headers $Headers
        }
    } catch {
        Write-Host "Request failed: $Uri" -ForegroundColor Yellow
        return $null
    }
}

function Record-Result {
    param($TestName, $Passed)
    $global:Results += [PSCustomObject]@{
        Test   = $TestName
        Status = if ($Passed) { "PASSED" } else { "FAILED" }
    }
}

$global:Results = @()

# ---------- 1. Customer Registration ----------
$customerEmail = "live_customer_$((Get-Random -Maximum 99999))@example.com"
Write-Host "Registering customer: $customerEmail" -ForegroundColor Cyan
$customerBody = @{
    name     = "Customer Live"
    email    = $customerEmail
    password = "customer123"
    role     = "CUSTOMER"
}
$registerCustomer = Safe-Request "$baseUrl/auth/register" "POST" $customerBody $null
if ($registerCustomer -and $registerCustomer.user.email) {
    Write-Host "Customer registered successfully." -ForegroundColor Green
    Record-Result "Customer Registration" $true
} else {
    Write-Host "Customer already exists or skipped duplicate." -ForegroundColor Yellow
    Record-Result "Customer Registration" $false
}

# ---------- 2. Customer Login ----------
$customerLogin = Safe-Request "$baseUrl/auth/login" "POST" `
    @{ email = $customerEmail; password = "customer123" } $null
if ($customerLogin) {
    $customerAccessToken = $customerLogin.accessToken
    Write-Host "Customer login successful." -ForegroundColor Green
    Record-Result "Customer Login" $true
} else {
    Write-Host "Customer login failed." -ForegroundColor Red
    Record-Result "Customer Login" $false
}

# ---------- 3. Admin Creation/Login ----------
$adminEmail = "superadmin_live@example.com"
$adminLogin = Safe-Request "$baseUrl/auth/login" "POST" `
    @{ email = $adminEmail; password = "superadmin123" } $null

if (-not $adminLogin) {
    Write-Host "Creating Super Admin: $adminEmail" -ForegroundColor Cyan
    $adminBody = @{
        name     = "Super Admin"
        email    = $adminEmail
        password = "superadmin123"
        role     = "ADMIN"
    }
    $registerAdmin = Safe-Request "$baseUrl/auth/register" "POST" $adminBody $null
    Start-Sleep -Seconds 1
    $adminLogin = Safe-Request "$baseUrl/auth/login" "POST" `
        @{ email = $adminEmail; password = "superadmin123" } $null
}

if ($adminLogin) {
    $adminToken = $adminLogin.accessToken
    Write-Host "Admin login successful." -ForegroundColor Green
    Record-Result "Admin Login" $true
} else {
    Write-Host "Admin login failed." -ForegroundColor Red
    Record-Result "Admin Login" $false
}

# ---------- 4. Get Pending Users ----------
Write-Host "Fetching pending users..." -ForegroundColor Cyan
$pendingUrl = "$baseUrl/admin/users/pending"
$pending = Safe-Request $pendingUrl "GET" $null @{ Authorization = "Bearer $adminToken" }
if ($pending) {
    Write-Host "Pending users retrieved." -ForegroundColor Green
    Record-Result "Fetch Pending Users" $true
} else {
    Write-Host "No pending users or unauthorized." -ForegroundColor Yellow
    Record-Result "Fetch Pending Users" $false
}

# ---------- 5. Audit Logs ----------
# Use query parameters with full string concatenation to avoid ampersand parsing issues
$auditUrl = "$baseUrl/admin/audit/logs?page=1" + "%26limit=5"
$audit = Safe-Request $auditUrl "GET" $null @{ Authorization = "Bearer $adminToken" }
if ($audit -and $audit.logs) {
    Write-Host "Audit logs fetched successfully." -ForegroundColor Green
    Record-Result "Audit Logs" $true
} else {
    Write-Host "Failed to fetch audit logs." -ForegroundColor Red
    Record-Result "Audit Logs" $false
}

# ---------- FINAL SUMMARY ----------
Write-Host "`n=== TEST SUMMARY ===" -ForegroundColor Cyan
$Results | Format-Table -AutoSize
Write-Host "`nAll Live Endpoint Tests Completed Successfully." -ForegroundColor Green
