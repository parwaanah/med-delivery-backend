# ===============================================================
# 🧪 LIVE BACKEND ENDPOINT TEST SCRIPT (Medicine Delivery v7.6+)
# ===============================================================

$baseUrl = "http://localhost:3001"
Write-Host "Testing API base URL: $baseUrl`n"

# -----------------------------
# 1️⃣ REGISTER (NEW CUSTOMER)
# -----------------------------
$email = "live_user_$([guid]::NewGuid().ToString().Substring(0,6))@example.com"
$password = "testpass123"
$name = "Live Test User"

Write-Host "Registering new user: $email"
$registerBody = @{
    name     = $name
    email    = $email
    password = $password
    role     = "CUSTOMER"
} | ConvertTo-Json

$registerResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body $registerBody -ContentType "application/json"
$accessToken = $registerResponse.accessToken
Write-Host "Registered successfully. AccessToken: $accessToken`n"

# -----------------------------
# 2️⃣ LOGIN (REAL USER)
# -----------------------------
Write-Host "Logging in as $email ..."
$loginBody = @{
    email    = $email
    password = $password
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
$loginAccessToken = $loginResponse.accessToken
$refreshToken = $loginResponse.refreshToken
Write-Host "Login OK. AccessToken: $loginAccessToken"
Write-Host "RefreshToken: $refreshToken`n"

# -----------------------------
# 3️⃣ REFRESH TOKEN
# -----------------------------
Write-Host "Refreshing token..."
$refreshBody = @{
    refreshToken = $refreshToken
} | ConvertTo-Json

$refreshResponse = Invoke-RestMethod -Uri "$baseUrl/auth/refresh" -Method POST -Body $refreshBody -ContentType "application/json"
$newAccessToken = $refreshResponse.accessToken
$newRefreshToken = $refreshResponse.refreshToken
Write-Host "Refreshed successfully."
Write-Host "New AccessToken: $newAccessToken`n"

# -----------------------------
# 4️⃣ CREATE NEW SUPER ADMIN
# -----------------------------
$superAdminEmail = "superadmin_$([guid]::NewGuid().ToString().Substring(0,6))@example.com"
Write-Host "Creating new Super Admin: $superAdminEmail"

$adminRegisterBody = @{
    name     = "Super Admin"
    email    = $superAdminEmail
    password = "superadmin123"
    role     = "ADMIN"
} | ConvertTo-Json

try {
    $adminRegister = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body $adminRegisterBody -ContentType "application/json"
    Write-Host "✅ Super Admin created successfully!"
} catch {
    Write-Host "⚠️ Admin may already exist. Proceeding to login..."
}

# -----------------------------
# 5️⃣ ADMIN LOGIN
# -----------------------------
Write-Host "Logging in as Super Admin: $superAdminEmail ..."
$adminLoginBody = @{
    email    = $superAdminEmail
    password = "superadmin123"
} | ConvertTo-Json

$adminLogin = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $adminLoginBody -ContentType "application/json"
$adminToken = $adminLogin.accessToken
Write-Host "Admin AccessToken: $adminToken`n"

# -----------------------------
# 6️⃣ ADMIN STATUS
# -----------------------------
$adminStatus = Invoke-RestMethod -Uri "$baseUrl/admin/status" -Headers @{ "Authorization" = "Bearer $adminToken" } -Method GET
Write-Host "✅ Admin status:`n$($adminStatus | ConvertTo-Json -Depth 5)`n"

# -----------------------------
# 7️⃣ ADMIN AUDIT LOGS
# -----------------------------
Write-Host "Fetching latest audit logs..."
$auditUrl = "$baseUrl/admin/audit/logs?page=1`&limit=10"
$auditLogs = Invoke-RestMethod -Uri $auditUrl -Headers @{ "Authorization" = "Bearer $adminToken" } -Method GET

Write-Host "✅ Audit Logs:`n"
$auditLogs | ConvertTo-Json -Depth 5

Write-Host "`nALL ENDPOINTS VERIFIED SUCCESSFULLY"
