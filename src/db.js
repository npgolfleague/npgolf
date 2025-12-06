const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3307,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'root',
  database: process.env.DB_NAME || 'npgolf',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
