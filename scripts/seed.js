require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run() {
  const dir = path.join(__dirname, '..', 'seeds');
  if (!fs.existsSync(dir)) {
    console.log('No seeds directory found.');
    return;
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    console.log('No seed files found in seeds/');
    return;
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || undefined
  });

  for (const file of files) {
    const full = path.join(dir, file);
    const sql = fs.readFileSync(full, 'utf8');
    console.log('Running seed:', file);
    try {
      await connection.query(sql);
    } catch (err) {
      console.error('Seed failed:', file, err);
      await connection.end();
      process.exit(1);
    }
  }

  console.log('Seeds applied.');
  await connection.end();
}

if (require.main === module) run().catch(err => { console.error(err); process.exit(1); });
