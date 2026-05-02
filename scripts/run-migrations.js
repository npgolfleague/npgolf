// Migration Runner - Automatically applies unapplied migrations
// Usage: node scripts/run-migrations.js

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3308,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'root',
  database: process.env.DB_NAME || 'npgolf',
  multipleStatements: true
};

async function ensureMigrationTable(connection) {
  console.log('Ensuring schema_migrations table exists...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_migration_name (migration_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function getAppliedMigrations(connection) {
  const [rows] = await connection.query(
    'SELECT migration_name FROM schema_migrations ORDER BY migration_name'
  );
  return rows.map(row => row.migration_name);
}

async function getPendingMigrations(appliedMigrations) {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = await fs.readdir(migrationsDir);
  
  const sqlFiles = files
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  const pending = sqlFiles.filter(f => !appliedMigrations.includes(f));
  return pending;
}

async function applyMigration(connection, filename) {
  console.log(`Applying migration: ${filename}`);
  
  const migrationsDir = path.join(__dirname, '../migrations');
  const filepath = path.join(migrationsDir, filename);
  const sql = await fs.readFile(filepath, 'utf8');
  
  try {
    // Execute the migration
    await connection.query(sql);
    
    // Record in migrations table
    await connection.query(
      'INSERT INTO schema_migrations (migration_name) VALUES (?)',
      [filename]
    );
    
    console.log(`✓ Successfully applied: ${filename}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to apply: ${filename}`);
    console.error(error.message);
    throw error;
  }
}

async function runMigrations() {
  console.log('=== NPGolf Migration Runner ===\n');
  
  let connection;
  try {
    // Connect to database
    console.log(`Connecting to ${config.host}:${config.port}/${config.database}...`);
    connection = await mysql.createConnection(config);
    console.log('Connected!\n');
    
    // Ensure migration tracking table exists
    await ensureMigrationTable(connection);
    
    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations(connection);
    console.log(`Applied migrations: ${appliedMigrations.length}`);
    
    // Get pending migrations
    const pendingMigrations = await getPendingMigrations(appliedMigrations);
    console.log(`Pending migrations: ${pendingMigrations.length}\n`);
    
    if (pendingMigrations.length === 0) {
      console.log('No pending migrations. Database is up to date!');
      return;
    }
    
    console.log('Pending migrations:');
    pendingMigrations.forEach(m => console.log(`  - ${m}`));
    console.log('');
    
    // Apply each pending migration
    for (const migration of pendingMigrations) {
      await applyMigration(connection, migration);
    }
    
    console.log('\n✓ All migrations applied successfully!');
    
  } catch (error) {
    console.error('\n✗ Migration failed:');
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runMigrations };
