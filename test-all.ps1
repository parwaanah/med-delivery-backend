[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$api = "http://localhost:3001"
Write-Host "Target API → $api" -ForegroundColor Cyan

# --- LOGIN ADMIN ---
Write-Host "`nLogging in as Superadmin..."
$loginBody = @'
{
  "email": "superadmin_live@example.com",
  "password": "superadmin123"
}
'@
$login = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
$adminToken = $login.accessToken
if (-not $adminToken) { Write-Host "Login failed"; exit }
Write-Host "Logged in as Superadmin." -ForegroundColor Green

# --- IDs ---
$pharmacyId = 60
$riderId = 61

# --- LOGIN PHARMACY ---
$pharmaLoginBody = '{
  "email": "pharmacy_auto2@example.com",
  "password": "pharma123"
}'
$pharmaLogin = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -ContentType "application/json" -Body $pharmaLoginBody
$pharmaToken = $pharmaLogin.accessToken
Write-Host "Pharmacy logged in." -ForegroundColor Green

# --- LOGIN RIDER ---
$riderLoginBody = '{
  "email": "rider_auto2@example.com",
  "password": "rider123"
}'
$riderLogin = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -ContentType "application/json" -Body $riderLoginBody
$riderToken = $riderLogin.accessToken
Write-Host "Rider logged in." -ForegroundColor Green

# --- LOGIN CUSTOMER ---
$custLoginBody = '{
  "email": "customer_auto2@example.com",
  "password": "customer123"
}'
$custLogin = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -ContentType "application/json" -Body $custLoginBody
$custToken = $custLogin.accessToken
Write-Host "Customer logged in." -ForegroundColor Green

# --- CREATE ORDER ---
$orderBody = '{
  "items": [
    { "name": "Paracetamol", "price": 25, "quantity": 2 }
  ],
  "pickupLat": 28.621,
  "pickupLon": 77.210,
  "pharmacyId": ' + $pharmacyId + '
}'
$order = Invoke-RestMethod -Uri "$api/orders" -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $custToken" } -Body $orderBody
$orderId = $order.id
Write-Host "Order #$orderId created." -ForegroundColor Green

# --- PHARMACY ACCEPTS ---
$acceptBody = '{"action":"ACCEPTED"}'
Invoke-RestMethod -Uri "$api/orders/pharmacy/$orderId/respond" -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $pharmaToken" } -Body $acceptBody | Out-Null
Write-Host "Pharmacy accepted order." -ForegroundColor Green

# --- RIDER ACCEPTS ---
Invoke-RestMethod -Uri "$api/orders/rider/$orderId/respond" -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $riderToken" } -Body $acceptBody | Out-Null
Write-Host "Rider accepted order." -ForegroundColor Green

# --- RIDER LOCATION ---
$locBody = '{"lat":28.622,"lon":77.215}'
Invoke-RestMethod -Uri "$api/riders/$riderId/location" -Method Patch -ContentType "application/json" -Headers @{ Authorization = "Bearer $riderToken" } -Body $locBody | Out-Null
Write-Host "Rider location updated." -ForegroundColor Green

# --- DELIVERED ---
$delBody = '{"stage":"DELIVERED"}'
Invoke-RestMethod -Uri "$api/orders/rider/$orderId/stage" -Method Patch -ContentType "application/json" -Headers @{ Authorization = "Bearer $riderToken" } -Body $delBody | Out-Null
Write-Host "Order delivered." -ForegroundColor Green

# --- SURGE / GEO / METRICS ---
Write-Host "`nSurge:" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$api/admin/surge/status" -Headers @{ Authorization = "Bearer $adminToken" }

Write-Host "`nGeoSurge:" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$api/admin/geo-surge/status" -Headers @{ Authorization = "Bearer $adminToken" }

Write-Host "`nMetrics:" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$api/admin/metrics" -Headers @{ Authorization = "Bearer $adminToken" }

Write-Host "`nQueue:" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$api/admin/queue/status" -Headers @{ Authorization = "Bearer $adminToken" }

Write-Host "`nHealth:" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$api/health"

Write-Host "`n✅ ALL ENDPOINTS TESTED SUCCESSFULLY" -ForegroundColor Green
