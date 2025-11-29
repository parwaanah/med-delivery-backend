DELETE FROM "User"
WHERE email = 'superadmin_live@example.com';

INSERT INTO "User" (
  name,
  email,
  password,
  role,
  status,
  "createdAt",
  "updatedAt"
) VALUES (
  'Super Admin',
  'superadmin_live@example.com',
  '$2a$10$Q9kU8jVvHmgGkGR501pGxuG7bRxlz5prvQnwvDaVif7NZm04nAoSC',
  'ADMIN',
  'APPROVED',
  NOW(),
  NOW()
);
