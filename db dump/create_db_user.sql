-- ================================================================
--  Fix #14: Create a dedicated low-privilege MySQL user
--  Run this once in phpMyAdmin or MySQL shell, then update
--  DB_USER and DB_PASS in backend/config/db.php to match.
-- ================================================================

-- 1. Create the user (change 'StrongPassword123!' to something secure)
CREATE USER IF NOT EXISTS 'uiu_app'@'localhost' IDENTIFIED BY 'StrongPassword123!';

-- 2. Grant only the permissions the app actually needs
GRANT SELECT, INSERT, UPDATE, DELETE ON uiu_flc.* TO 'uiu_app'@'localhost';

-- 3. Apply the changes
FLUSH PRIVILEGES;
