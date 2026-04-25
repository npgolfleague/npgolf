const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Try to read .env.local for app DB credentials, fall back to hardcoded defaults
function readLocalEnv() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return null;
  const data = fs.readFileSync(p, 'utf8');
  const out = {};
  data.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  });
  return out;
}

async function ensure() {
  const env = readLocalEnv() || {};
  const appUser = env.DB_USER || 'npgolf_app';
  const appPass = env.DB_PASS || 'n9ETekYoJqA5apQMCwLebQ';

  // Root connection to the local mysql container
  const rootConn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_ADMIN_USER || 'root',
    password: process.env.DB_ADMIN_PASS || 'rootpw',
    database: 'mysql'
  });

  try {
    const [rows] = await rootConn.query("SELECT COUNT(*) AS cnt FROM user WHERE User = ? AND Host = '%';", [appUser]);
    const exists = rows && rows[0] && rows[0].cnt > 0;

    if (!exists) {
      console.log(`Creating user ${appUser}@%`);
      await rootConn.query(`CREATE USER ?@'%' IDENTIFIED BY ?`, [appUser, appPass]);
    } else {
      console.log(`Altering password for ${appUser}@%`);
      await rootConn.query(`ALTER USER ?@'%' IDENTIFIED BY ?`, [appUser, appPass]);
    }

    console.log('Granting privileges on npgolf.*');
    await rootConn.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON npgolf.* TO ?@'%'`, [appUser]);
    await rootConn.query('FLUSH PRIVILEGES');

    console.log('Done');
  } catch (err) {
    console.error('Error ensuring app user:', err.message || err);
    process.exitCode = 1;
  } finally {
    await rootConn.end();
  }
}

ensure();
