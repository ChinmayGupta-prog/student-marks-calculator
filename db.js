const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing. Copy .env.example to .env and fill in your database settings.');
}

// A pool reuses database connections instead of opening one for every request.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000
});

pool.on('error', error => {
  console.error('Unexpected database connection error:', error);
});

module.exports = pool;
