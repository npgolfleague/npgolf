const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

(async () => {
  const hash = await bcrypt.hash('player123', 10);
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });
  
  const players = [
    ['John Smith', 'john.smith@example.com', '555-0101', 'M'],
    ['Sarah Johnson', 'sarah.johnson@example.com', '555-0102', 'F'],
    ['Michael Brown', 'michael.brown@example.com', '555-0103', 'M'],
    ['Emily Davis', 'emily.davis@example.com', '555-0104', 'F'],
    ['David Wilson', 'david.wilson@example.com', '555-0105', 'M'],
    ['Jessica Martinez', 'jessica.martinez@example.com', '555-0106', 'F']
  ];
  
  for (const [name, email, phone, sex] of players) {
    await conn.execute(
      'INSERT INTO players (name, email, phone, sex, active, role, password) VALUES (?, ?, ?, ?, 1, ?, ?)',
      [name, email, phone, sex, 'player', hash]
    );
  }
  
  console.log('6 test players added successfully');
  await conn.end();
})();
