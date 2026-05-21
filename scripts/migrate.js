require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const MIGRATIONS_TABLE = 'schema_migrations';

const parseArgs = () => {
  const args = process.argv.slice(2);
  return {
    baseline: args.includes('--baseline'),
    status: args.includes('--status')
  };
};

const ensureMigrationsTable = async (connection) => {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );
};

const getAppliedMigrations = async (connection) => {
  const [rows] = await connection.query(
    `SELECT filename FROM ${MIGRATIONS_TABLE} ORDER BY filename ASC`
  );
  return new Set(rows.map((row) => row.filename));
};

async function run() {
  const options = parseArgs();

  const files = fs.readdirSync(path.join(__dirname, '..', 'migrations'))
    .filter(f => /^\d+.*\.sql$/.test(f) && !f.endsWith('_old.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found in migrations/');
    return;
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || ''
    ,
    database: process.env.DB_NAME || 'npgolf',
    multipleStatements: true
  });

  await ensureMigrationsTable(connection);
  const applied = await getAppliedMigrations(connection);

  if (options.baseline) {
    let marked = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      await connection.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES (?)`,
        [file]
      );
      marked++;
    }
    console.log(`Baseline complete. Marked ${marked} migration(s) as applied.`);
    await connection.end();
    return;
  }

  const pending = files.filter((file) => !applied.has(file));

  if (options.status) {
    console.log(`Applied: ${applied.size}`);
    console.log(`Pending: ${pending.length}`);
    pending.forEach((file) => console.log(` - ${file}`));
    await connection.end();
    return;
  }

  if (pending.length === 0) {
    console.log('No pending migrations.');
    await connection.end();
    return;
  }

  for (const file of pending) {
    const full = path.join(__dirname, '..', 'migrations', file);
    const sql = fs.readFileSync(full, 'utf8');
    console.log('Running migration:', file);
    try {
      await connection.query(sql);
      await connection.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES (?)`,
        [file]
      );
    } catch (err) {
      console.error('Migration failed:', file, err);
      await connection.end();
      process.exit(1);
    }
  }

  console.log('Migrations applied.');
  await connection.end();
}

if (require.main === module) run().catch(err => { console.error(err); process.exit(1); });
