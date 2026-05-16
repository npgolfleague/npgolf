-- Promote the owner account to super_admin on already-migrated databases
UPDATE players
SET role = 'super_admin'
WHERE LOWER(email) = 'dalindquists@gmail.com';