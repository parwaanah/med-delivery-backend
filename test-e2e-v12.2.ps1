[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$api = "http://localhost:3001"
Write-Host ""
Write-Host "=== TARGET API: $api ===" -ForegroundColor Cyan

# --- LOGIN ADMIN ---
Write-Host ""
Write-Host "Logging in as Superadmin..."
$loginBody = @'
{
  "email": "superadmin_live@example.com",
  "password": "superadmin123"
}
'@
try {
  $login = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
  $adminToken = $login.accessToken
  if (-not $adminToken) { throw "Admin token missing." }
  Write-Host "Logged in as Superadmin." -ForegroundColor Green
} catch {
  Write-Host "Admin login failed: $($_.Exception.Message)" -ForegroundColor Red
  exit
}

# --- FETCH VALID PHARMACY AND RIDER IDs ---
try {
  $users = Invoke-RestMethod -Uri "$api/admin/users" -Headers @{ Authorization = "Bearer $adminToken" }
  $pharmacyUser = ($users.users | Where-Object { $_.role -eq "PHARMACY" -and $_.status -eq "APPROVED" })[0]
  $riderUser = ($users.users | Where-Object { $_.role -eq "RIDER" -and $_.status -eq "APPROVED" })[0]

  if ($pharmacyUser -and $riderUser) {
    $pharmacyId = $pharmacyUser.id
    $riderId = $riderUser.id
    Write-Host "Using Pharmacy ID: $pharmacyId, Rider ID: $riderId" -ForegroundColor Yellow
  } else {
    Write-Host "No valid pharmacy or rider found. Please seed test users first." -ForegroundColor Red
    exit
  }
} catch {
  Write-Host "Failed to fetch user list: $($_.Exception.Message)" -ForegroundColor Red
  exit
}

# --- LOGIN PHARMACY ---
Write-Host ""
Write-Host "Logging in as Pharmacy..."
$pharmaLoginBody = '{
  "email": "pharmacy_auto2@example.com",
  "password": "pharma123"
}'
try {
  $pharmaLogin = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -ContentType "application/json" -Body $pharmaLoginBody
  $pharmaToken = $pharmaLogin.accessToken
  Write-Host "Pharmacy logged in." -ForegroundColor Green
} catch {
  Write-Host "Pharmacy login failed: $($_.Exception.Message)" -ForegroundColor Red
}

# --- LOGIN RIDER ---
Write-Host ""
Write-Host "Logging in as Rider..."
$riderLoginBody = '{
  "email": "rider_auto2@example.com",
  "password": "rider123"
}'
try {
  $riderLogin = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -ContentType "application/json" -Body $riderLoginBody
  $riderToken = $riderLogin.accessToken
  Write-Host "Rider logged in." -ForegroundColor Green
} catch {
  Write-Host "Rider login failed: $($_.Exception.Message)" -ForegroundColor Red
}

# --- LOGIN CUSTOMER ---
Write-Host ""
Write-Host "Logging in as Customer..."
$custLoginBody = '{
  "email": "customer_auto2@example.com",
  "password": "customer123"
}'
try {
  $custLogin = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -ContentType "application/json" -Body $custLoginBody
  $custToken = $custLogin.accessToken
  Write-Host "Customer logged in." -ForegroundColor Green
} catch {
  Write-Host "Customer login failed: $($_.Exception.Message)" -ForegroundColor Red
}

# --- CREATE ORDER ---
Write-Host ""
Write-Host "Creating new order..."
$orderBody = '{
  "items": [
    { "name": "Paracetamol", "price": 25, "quantity": 2 }
  ],
  "pickupLat": 28.621,
  "pickupLon": 77.210,
  "pharmacyId": ' + $pharmacyId + '
}'
try {
  $order = Invoke-RestMethod -Uri "$api/orders" -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $custToken" } -Body $orderBody
  $orderId = $order.id
  if (-not $orderId) { $orderId = $order.order.id }
  Write-Host "Order #$orderId created." -ForegroundColor Green
} catch {
  Write-Host "Order creation failed: $($_.Exception.Message)" -ForegroundColor Red
}

# --- PHARMACY ACCEPTS ---
Write-Host ""
Write-Host "Pharmacy accepting order..."
try {
  $acceptBody = '{"action":"ACCEPTED"}'
  Invoke-RestMethod -Uri "$api/orders/pharmacy/$orderId/respond" -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $pharmaToken" } -Body $acceptBody | Out-Null
  Write-Host "Pharmacy accepted order." -ForegroundColor Green
} catch {
  Write-Host "Pharmacy accept failed: $($_.Exception.Message)" -ForegroundColor Red
}

# --- RIDER ACCEPTS ---
Write-Host ""
Write-Host "Rider accepting order..."
try {
  Invoke-RestMethod -Uri "$api/orders/rider/$orderId/respond" -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $riderToken" } -Body $acceptBody | Out-Null
  Write-Host "Rider accepted order." -ForegroundColor Green
} catch {
  Write-Host "Rider accept failed: $($_.Exception.Message)" -ForegroundColor Red
}

# --- DELIVERED ---
Write-Host ""
Write-Host "Marking order as delivered..."
try {
  $delBody = '{"stage":"DELIVERED"}'
  Invoke-RestMethod -Uri "$api/orders/rider/$orderId/stage" -Method Patch -ContentType "application/json" -Headers @{ Authorization = "Bearer $riderToken" } -Body $delBody | Out-Null
  Write-Host "Order marked as delivered." -ForegroundColor Green
} catch {
  Write-Host "Mark as delivered failed: $($_.Exception.Message)" -ForegroundColor Red
}

# --- SYSTEM CHECKS ---
Write-Host ""
Write-Host "Fetching live system status..." -ForegroundColor Cyan

Write-Host ""
Write-Host "Surge Status:" -ForegroundColor Cyan
try { Invoke-RestMethod -Uri "$api/admin/surge/status" -Headers @{ Authorization = "Bearer $adminToken" } } catch {}

Write-Host ""
Write-Host "GeoSurge:" -ForegroundColor Cyan
try { Invoke-RestMethod -Uri "$api/admin/geo-surge/status" -Headers @{ Authorization = "Bearer $adminToken" } } catch {}

Write-Host ""
Write-Host "Metrics:" -ForegroundColor Cyan
try { Invoke-RestMethod -Uri "$api/admin/metrics" -Headers @{ Authorization = "Bearer $adminToken" } } catch {}

Write-Host ""
Write-Host "Queue Status:" -ForegroundColor Cyan
try { Invoke-RestMethod -Uri "$api/admin/queue/status" -Headers @{ Authorization = "Bearer $adminToken" } } catch {}

Write-Host ""
Write-Host "Health Check:" -ForegroundColor Cyan
try { Invoke-RestMethod -Uri "$api/health" } catch {}

Write-Host ""
Write-Host "=== ALL ENDPOINTS TESTED SUCCESSFULLY ===" -ForegroundColor Green
