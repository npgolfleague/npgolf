const express = require('express');
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '127.0.0.1',
  port: 3307,
  user: 'root',
  password: 'root',
  database: 'npgolf',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const app = express();

app.use(express.json());

app.get('/api/users', async (req, res) => {
  console.log('Handling /api/users request...');
  try {
    console.log('About to query...');
    const [rows] = await pool.query('SELECT 1 as test');
    console.log('Query successful, rows:', rows);
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => {
  console.log('Inline server listening on port 5000');
});
