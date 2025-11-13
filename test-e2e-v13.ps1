# Save as test-e2e-v13.ps1 and run:
# powershell -ExecutionPolicy Bypass -File .\test-e2e-v13.ps1

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$api = "http://localhost:3001"
$ADMIN_EMAIL = "superadmin_live@example.com"
$ADMIN_PASS  = "superadmin123"

# Mode selection:
# Set either "PHARMACY" to place order at specific pharmacyId
# or "MEDICINE" to place order by medicine id (requires inventory)
$MODE = "PHARMACY"   # or "MEDICINE"

# When PHARMACY mode:
$TARGET_PHARMACY_ID = 17    # <- change to a valid pharmacy id in your DB

# When MEDICINE mode:
$TARGET_MEDICINE_ID = 1     # <- change to a medicine id that exists + has stock in pharmacies

# ---------------------------
Function Safe-Invoke($name, $uri, $method="GET", $body=$null, $token=$null) {
  try {
    $headers = @{}
    if ($token) { $headers.Add("Authorization", "Bearer $token") }
    $contentType = "application/json"
    if ($body -ne $null) {
      $resp = Invoke-RestMethod -Uri ($api + $uri) -Method $method -ContentType $contentType -Headers $headers -Body ($body | ConvertTo-Json -Depth 6)
    } else {
      $resp = Invoke-RestMethod -Uri ($api + $uri) -Method $method -ContentType $contentType -Headers $headers
    }
    Write-Host "$name => OK" -ForegroundColor Green
    return $resp
  } catch {
    Write-Host "$name => FAILED : $($_.Exception.Response.StatusCode) `n$($_.Exception.Response.Content)" -ForegroundColor Yellow
    return $null
  }
}

Write-Host "`n=== TARGET API: $api ===`n" -ForegroundColor Cyan

# -- Admin login
Write-Host "Logging in as Superadmin..."
$adminLogin = Safe-Invoke "Admin Login" "/auth/login" "POST" @{ email = $ADMIN_EMAIL; password = $ADMIN_PASS }
$adminToken = $adminLogin?.accessToken ?? $adminLogin?.access_token
if (-not $adminToken) { Write-Host "Admin login failed - abort" -ForegroundColor Red; exit 1 }

# -- Register test users
Write-Host "Registering test users..."
$customerEmail = "auto_customer_v13@example.com"
$pharmacyEmail = "auto_pharmacy_v13@example.com"
$riderEmail    = "auto_rider_v13@example.com"

Safe-Invoke "Register Customer" "/auth/register" "POST" @{ name="Auto Customer"; email=$customerEmail; password="123456"; role="CUSTOMER" }
Safe-Invoke "Register Pharmacy" "/auth/register" "POST" @{ name="Auto Pharmacy"; email=$pharmacyEmail; password="123456"; role="PHARMACY" }
Safe-Invoke "Register Rider" "/auth/register" "POST" @{ name="Auto Rider"; email=$riderEmail; password="123456"; role="RIDER" }

# -- Fetch freshly created users to get IDs
$allUsers = Safe-Invoke "Fetch Admin Users" "/admin/users" "GET" $null $adminToken
$candidateUsers = $allUsers?.users
$cust = $candidateUsers | Where-Object { $_.email -eq $customerEmail }
$pharm = $candidateUsers | Where-Object { $_.email -eq $pharmacyEmail }
$r = $candidateUsers | Where-Object { $_.email -eq $riderEmail }

$cId = $cust?.id; $pId = $pharm?.id; $rId = $r?.id

# If PHARMACY mode, optionally override pId with provided target id
if ($MODE -eq "PHARMACY") {
  if ($TARGET_PHARMACY_ID) { $pId = $TARGET_PHARMACY_ID }
}

Write-Host "Using Pharmacy ID: $pId, Rider ID: $rId, Customer ID: $cId" -ForegroundColor Cyan

# -- Approve test users (admin)
if ($cId) { Safe-Invoke "Approve Customer" "/admin/users/$cId/approve" "PATCH" $null $adminToken }
if ($pId) { Safe-Invoke "Approve Pharmacy" "/admin/users/$pId/approve" "PATCH" $null $adminToken }
if ($rId) { Safe-Invoke "Approve Rider" "/admin/users/$rId/approve" "PATCH" $null $adminToken }

# -- Logins
Write-Host "`nUser logins..."
$custLogin  = Safe-Invoke "Customer Login" "/auth/login" "POST" @{ email = $customerEmail; password = "123456" }
$pharmLogin = Safe-Invoke "Pharmacy Login" "/auth/login" "POST" @{ email = $pharmacyEmail; password = "123456" }
$riderLogin = Safe-Invoke "Rider Login" "/auth/login" "POST" @{ email = $riderEmail; password = "123456" }

$custToken  = $custLogin?.accessToken ?? $custLogin?.access_token
$pharmToken = $pharmLogin?.accessToken ?? $pharmLogin?.access_token
$riderToken = $riderLogin?.accessToken ?? $riderLogin?.access_token

# -- Optionally seed inventory if MEDICINE mode
if ($MODE -eq "MEDICINE") {
  if (-not $TARGET_MEDICINE_ID) { Write-Host "Set TARGET_MEDICINE_ID at top of script" -ForegroundColor Red; exit 1 }
  # create Pharmacy inventory for the target medicine (safe no-op if exists)
  $invBody = @{ pharmacyId = $pId; medicineId = $TARGET_MEDICINE_ID; price = 50; stock = 10 }
  Safe-Invoke "Seed Pharmacy Inventory (idempotent)" "/pharmacies" "POST" $null $adminToken # placeholder - if you have a dedicated endpoint to add inventory, adjust accordingly
  # NOTE: If you don't have a direct inventory endpoint, ensure at least one pharmacy in DB has that medicine stock.
}

# -- Create order (two modes)
Write-Host "`nCreating new order..."
if ($MODE -eq "PHARMACY") {
  $orderBody = @{
    items = @(@{ name="Paracetamol"; price=25; quantity=2 })
    pharmacyId = [int]$pId
    pickupLat = 28.621
    pickupLon = 77.210
  }
} else {
  $orderBody = @{
    items = @(@{ name="Paracetamol"; medicineId = [int]$TARGET_MEDICINE_ID; price=25; quantity=2 })
    pickupLat = 28.621
    pickupLon = 77.210
  }
}

$order = Safe-Invoke "Create Order" "/orders" "POST" $orderBody $custToken
$orderId = $order?.id ?? $order?.order?.id
Write-Host ("Order created ID: " + $orderId) -ForegroundColor Green

# -- Pharmacy respond (ACCEPT)
if ($orderId -and $pharmToken) {
  $respBody = @{ action = "ACCEPTED" }
  Safe-Invoke "Pharmacy Accept" "/orders/pharmacy/$orderId/respond" "POST" $respBody $pharmToken
}

# -- Rider respond (ACCEPT)
if ($orderId -and $riderToken) {
  $respBody = @{ action = "ACCEPTED" }
  Safe-Invoke "Rider Accept" "/orders/rider/$orderId/respond" "POST" $respBody $riderToken
}

# -- Rider stage progression
if ($orderId -and $riderToken) {
  Safe-Invoke "Rider Stage - REACHED_PHARMACY" "/orders/rider/$orderId/stage" "PATCH" @{ stage = "REACHED_PHARMACY"; location = @{ lat=28.62; lng=77.21 } } $riderToken
  Start-Sleep -Seconds 1
  Safe-Invoke "Rider Stage - PICKED_UP" "/orders/rider/$orderId/stage" "PATCH" @{ stage = "PICKED_UP"; location = @{ lat=28.62; lng=77.21 } } $riderToken
  Start-Sleep -Seconds 1
  Safe-Invoke "Rider Stage - DELIVERED" "/orders/rider/$orderId/stage" "PATCH" @{ stage = "DELIVERED"; location = @{ lat=28.63; lng=77.22 } } $riderToken
}

# -- System checks
Safe-Invoke "Health" "/health" "GET"
Safe-Invoke "Admin Metrics" "/admin/metrics" "GET" $null $adminToken
Safe-Invoke "Queue Status" "/admin/queue/status" "GET" $null $adminToken

# -- Cleanup: delete test users (if present)
if ($rId) { Safe-Invoke "Delete Rider" "/admin/users/$rId" "DELETE" $null $adminToken }
if ($pId) { Safe-Invoke "Delete Pharmacy" "/admin/users/$pId" "DELETE" $null $adminToken }
if ($cId) { Safe-Invoke "Delete Customer" "/admin/users/$cId" "DELETE" $null $adminToken }

Write-Host "`n=== E2E TEST COMPLETE ===`n" -ForegroundColor Cyan
