const fs = require('fs/promises');
const path = require('path');
const pool = require('../db');

async function setupDatabase() {
  // WARNING: Running this command deletes ALL existing student data.
  console.warn('WARNING: db:setup deletes all existing students and restores the four sample students.');
  let client;

  try {
    const schema = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
    const seed = await fs.readFile(path.join(__dirname, 'seed.sql'), 'utf8');
    client = await pool.connect();

    // Use one connection so either the whole reset succeeds or none of it does.
    await client.query('BEGIN');
    await client.query(schema);
    await client.query(seed);
    await client.query('COMMIT');
    console.log('Database ready. Four sample students added.');
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(rollbackError => console.error('Rollback failed:', rollbackError));
    }
    console.error('Database setup failed:', error);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

setupDatabase();
