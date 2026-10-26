const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function initializeDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: /^(1|true|yes)$/i.test(process.env.DB_SSL || 'false') ? { minVersion: 'TLSv1.2' } : undefined,
    multipleStatements: true
  });

  try {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
    await connection.query(schema);
    console.log(`Database initialized: ${process.env.DB_NAME}`);
  } finally {
    await connection.end();
  }
}

initializeDatabase().catch((error) => {
  console.error('Database initialization failed:', error.message);
  process.exitCode = 1;
});
