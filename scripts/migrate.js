require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run() {
  const files = fs.readdirSync(path.join(__dirname, '..', 'migrations'))
    .filter(f => f.endsWith('.sql'))
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
    multipleStatements: true
  });

  for (const file of files) {
    const full = path.join(__dirname, '..', 'migrations', file);
    const sql = fs.readFileSync(full, 'utf8');
    console.log('Running migration:', file);
    try {
      await connection.query(sql);
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
