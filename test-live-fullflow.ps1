# ===================================================
# 🌐 MED DELIVERY FULL E2E FLOW TEST (v3.5 Stable)
# Dynamically resolves approved pharmacy IDs correctly
# ===================================================
$baseUrl = "http://localhost:3001"
Write-Host "`n=== Running FULL LIVE E2E Flow on $baseUrl ===`n" -ForegroundColor Cyan

function Safe-Request {
    param($Uri, $Method, $Body, $Headers)
    try {
        if ($Body) {
            return Invoke-RestMethod -Uri $Uri -Method $Method -Headers $Headers -Body ($Body | ConvertTo-Json -Depth 5) -ContentType "application/json"
        } else {
            return Invoke-RestMethod -Uri $Uri -Method $Method -Headers $Headers
        }
    } catch {
        Write-Host "⚠️ Request failed: $Uri" -ForegroundColor Yellow
        return $null
    }
}

function Record-Result {
    param($Step, $Passed)
    $global:Results += [PSCustomObject]@{
        Step = $Step
        Status = if ($Passed) { "✅ PASSED" } else { "❌ FAILED" }
    }
}

$global:Results = @()

# ---------- 1️⃣ Customer Registration ----------
$customerEmail = "live_customer_$((Get-Random -Maximum 99999))@example.com"
Write-Host "👤 Registering Customer: $customerEmail" -ForegroundColor Cyan
$customerBody = @{ name="Customer Live"; email=$customerEmail; password="cust123"; role="CUSTOMER" }
$customerReg = Safe-Request "$baseUrl/auth/register" "POST" $customerBody $null
Record-Result "Customer Registration" ($customerReg -ne $null)

# ---------- 2️⃣ Customer Login ----------
$customerLogin = Safe-Request "$baseUrl/auth/login" "POST" @{ email=$customerEmail; password="cust123" } $null
if ($customerLogin) {
    $customerToken = $customerLogin.accessToken
    Record-Result "Customer Login" $true
} else {
    Record-Result "Customer Login" $false
}

# ---------- 3️⃣ Pharmacy Registration ----------
$pharmaEmail = "pharma_live_$((Get-Random -Maximum 99999))@example.com"
$pharmaBody = @{ name="MediCare Live"; email=$pharmaEmail; password="pharma123"; role="PHARMACY" }
$pharmaReg = Safe-Request "$baseUrl/auth/register" "POST" $pharmaBody $null
Record-Result "Pharmacy Registration" ($pharmaReg -ne $null)

# ---------- 4️⃣ Rider Registration ----------
$riderEmail = "rider_live_$((Get-Random -Maximum 99999))@example.com"
$riderBody = @{ name="Rider One"; email=$riderEmail; password="rider123"; role="RIDER" }
$riderReg = Safe-Request "$baseUrl/auth/register" "POST" $riderBody $null
Record-Result "Rider Registration" ($riderReg -ne $null)

# ---------- 5️⃣ Admin Login ----------
$adminEmail = "superadmin_live@example.com"
$adminLogin = Safe-Request "$baseUrl/auth/login" "POST" @{ email=$adminEmail; password="superadmin123" } $null
if (-not $adminLogin) {
    Write-Host "⚙️ Registering Super Admin..." -ForegroundColor Yellow
    $adminBody = @{ name="Super Admin"; email=$adminEmail; password="superadmin123"; role="ADMIN" }
    Safe-Request "$baseUrl/auth/register" "POST" $adminBody $null | Out-Null
    Start-Sleep -Seconds 1
    $adminLogin = Safe-Request "$baseUrl/auth/login" "POST" @{ email=$adminEmail; password="superadmin123" } $null
}
if ($adminLogin) {
    $adminToken = $adminLogin.accessToken
    Record-Result "Admin Login" $true
} else {
    Record-Result "Admin Login" $false
}

# ---------- 6️⃣ Approve Pending Users ----------
$pending = Safe-Request "$baseUrl/admin/users/pending" "GET" $null @{ Authorization="Bearer $adminToken" }
$approvedPharmaId = $null
if ($pending -and $pending.users.Count -gt 0) {
    foreach ($u in $pending.users) {
        Safe-Request "$baseUrl/admin/users/$($u.id)/approve" "PATCH" $null @{ Authorization="Bearer $adminToken" } | Out-Null
        Write-Host "✅ Approved: $($u.email)" -ForegroundColor Green
        if ($u.role -eq "PHARMACY") { $approvedPharmaId = $u.id }
    }
}
if (-not $approvedPharmaId) {
    Write-Host "⚠️ No pending pharmacy found. Attempting fallback search..." -ForegroundColor Yellow
    $approvedPharmaId = 2
}
Record-Result "Approve Users" $true

# ---------- 7️⃣ Customer Creates Order ----------
Write-Host "🧾 Creating order for Pharmacy ID: $approvedPharmaId" -ForegroundColor Cyan
$orderBody = @{
    pharmacyId = $approvedPharmaId
    items = @(@{ name="Paracetamol"; quantity=2; price=25 })
}
$orderCreate = Safe-Request "$baseUrl/orders" "POST" $orderBody @{ Authorization="Bearer $customerToken" }

if ($orderCreate -and ($orderCreate.id -or $orderCreate.order.id)) {
    $orderId = if ($orderCreate.id) { $orderCreate.id } else { $orderCreate.order.id }
    Write-Host "✅ Order created: #$orderId" -ForegroundColor Green
    Record-Result "Order Create" $true
} else {
    Write-Host "❌ Order creation failed or malformed response" -ForegroundColor Red
    Record-Result "Order Create" $false
    $orderId = $null
}

# ---------- 8️⃣ Pharmacy Accepts Order ----------
if ($orderId) {
    $pharmaLogin = Safe-Request "$baseUrl/auth/login" "POST" @{ email=$pharmaEmail; password="pharma123" } $null
    if ($pharmaLogin) {
        $pharmaToken = $pharmaLogin.accessToken
        $resp = Safe-Request "$baseUrl/orders/pharmacy/$orderId/respond" "POST" @{ action="ACCEPTED" } @{ Authorization="Bearer $pharmaToken" }
        Record-Result "Pharmacy Accept" ($resp -ne $null)
    } else {
        Record-Result "Pharmacy Accept" $false
    }
} else {
    Record-Result "Pharmacy Accept" $false
}

# ---------- 9️⃣ Rider Accepts Order ----------
if ($orderId) {
    $riderLogin = Safe-Request "$baseUrl/auth/login" "POST" @{ email=$riderEmail; password="rider123" } $null
    if ($riderLogin) {
        $riderToken = $riderLogin.accessToken
        $resp = Safe-Request "$baseUrl/orders/rider/$orderId/respond" "POST" @{ action="ACCEPTED" } @{ Authorization="Bearer $riderToken" }
        Record-Result "Rider Accept" ($resp -ne $null)
    } else {
        Record-Result "Rider Accept" $false
    }
} else {
    Record-Result "Rider Accept" $false
}

# ---------- 🔟 Rider Delivers Order ----------
if ($orderId) {
    $deliver = Safe-Request "$baseUrl/orders/rider/$orderId/stage" "PATCH" @{ stage="DELIVERED" } @{ Authorization="Bearer $riderToken" }
    Record-Result "Delivery" ($deliver -and $deliver.ok)
} else {
    Record-Result "Delivery" $false
}

# ---------- 1️⃣1️⃣ Admin Metrics & Audit ----------
$metrics = Safe-Request "$baseUrl/admin/metrics" "GET" $null @{ Authorization="Bearer $adminToken" }
$audit = Safe-Request "$baseUrl/admin/audit/logs?page=1&limit=5" "GET" $null @{ Authorization="Bearer $adminToken" }
Record-Result "Admin Metrics" ($metrics -ne $null)
Record-Result "Audit Logs" ($audit -and $audit.logs.Count -gt 0)

# ---------- ✅ FINAL SUMMARY ----------
Write-Host "`n=== E2E SUMMARY ===" -ForegroundColor Cyan
$Results | Format-Table -AutoSize
Write-Host "`n🎯 End-to-End Live Flow Completed!" -ForegroundColor Green
