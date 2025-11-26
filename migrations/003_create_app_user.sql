-- 003_create_app_user.sql
-- Create a dedicated database user for the application with limited privileges
USE npgolf;

-- Create the user if it doesn't exist. For local dev the password is 'app_password'.
-- When running migrations in CI/production, supply a secure password or run as root
CREATE USER IF NOT EXISTS 'npgolf_app'@'%' IDENTIFIED BY 'app_password';

-- Grant minimal privileges needed by the app. Adjust as your app evolves.
GRANT SELECT, INSERT, UPDATE ON npgolf.* TO 'npgolf_app'@'%';

FLUSH PRIVILEGES;
