-- Ensure the primary owner account is promoted to super_admin when present
UPDATE players
SET role = 'super_admin'
WHERE LOWER(email) = 'dalindquists@gmail.com';
