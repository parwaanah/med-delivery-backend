-- Clear table
DELETE FROM "User";

-- Seed Super Admin
INSERT INTO "User" 
("id", "name", "email", "password", "role", "status", "latitude", "longitude", "createdAt", "updatedAt")
VALUES
(1, 'Super Admin', 'superadmin_live@example.com',
 '$2b$10$dcZ8pZxJ1fO0jZq9hO7b2ehW7iMEPuB1bqOYJr3z9xsTvaEwH80nG',
 'ADMIN', 'ACTIVE', 19.0760, 72.8777, NOW(), NOW());

-- Seed Pharmacy
INSERT INTO "User" 
("id", "name", "email", "password", "role", "status", "latitude", "longitude", "createdAt", "updatedAt")
VALUES
(2, 'Test Pharmacy', 'pharmacy@example.com',
 '$2b$10$dcZ8pZxJ1fO0jZq9hO7b2ehW7iMEPuB1bqOYJr3z9xsTvaEwH80nG',
 'PHARMACY', 'ACTIVE', 19.1180, 72.9050, NOW(), NOW());

-- Seed Rider
INSERT INTO "User" 
("id", "name", "email", "password", "role", "status", "latitude", "longitude", "createdAt", "updatedAt")
VALUES
(3, 'Test Rider', 'rider@example.com',
 '$2b$10$dcZ8pZxJ1fO0jZq9hO7b2ehW7iMEPuB1bqOYJr3z9xsTvaEwH80nG',
 'RIDER', 'AVAILABLE', 19.1020, 72.9000, NOW(), NOW());

-- Seed Customer
INSERT INTO "User" 
("id", "name", "email", "password", "role", "status", "latitude", "longitude", "createdAt", "updatedAt")
VALUES
(4, 'Test Customer', 'customer@example.com',
 '$2b$10$dcZ8pZxJ1fO0jZq9hO7b2ehW7iMEPuB1bqOYJr3z9xsTvaEwH80nG',
 'CUSTOMER', 'ACTIVE', 19.0900, 72.8700, NOW(), NOW());
