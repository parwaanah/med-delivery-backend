UPDATE "User"
SET
  "password" = '',
  "status" = 'APPROVED',
  "approvedBy" = NULL
WHERE "email" = 'superadmin_live@example.com';
