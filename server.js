const express = require('express');
const path = require('path');
const pool = require('./db');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/students', async (request, response) => {
  try {
    const result = await pool.query('SELECT id, name, english, maths, science FROM students ORDER BY id');
    response.status(200).json(result.rows);
  } catch (error) {
    sendServerError(response, error);
  }
});

app.post('/api/students', async (request, response) => {
  const body = request.body || {};
  const errors = {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';

  if (!name) errors.name = 'Please enter a student name.';

  ['english', 'maths', 'science'].forEach(subject => {
    const mark = body[subject];
    if (mark === undefined || mark === null || mark === '') {
      errors[subject] = 'Please enter a mark.';
    } else if (typeof mark !== 'number' || !Number.isInteger(mark) || mark < 0 || mark > 100) {
      errors[subject] = 'Please enter a whole number from 0 to 100.';
    }
  });

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({ errors });
  }

  try {
    // Parameters keep user values separate from SQL, preventing SQL injection.
    const result = await pool.query(
      'INSERT INTO students (name, english, maths, science) VALUES ($1, $2, $3, $4) RETURNING id, name, english, maths, science',
      [name, body.english, body.maths, body.science]
    );
    response.status(201).json(result.rows[0]);
  } catch (error) {
    sendServerError(response, error);
  }
});

app.delete('/api/students/:id', async (request, response) => {
  const rawId = request.params.id;
  const id = Number(rawId);
  if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(id) || id < 1 || id > 2147483647) {
    return response.status(400).json({ error: 'Please enter a valid positive whole-number student ID.' });
  }

  try {
    const result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return response.status(404).json({ error: 'That student was not found. Reload the page to see the current list.' });
    }
    response.status(204).end();
  } catch (error) {
    sendServerError(response, error);
  }
});

function sendServerError(response, error) {
  console.error(error);
  response.status(500).json({ error: 'Something went wrong. Please try again.' });
}

// Even malformed JSON gets a readable response rather than an HTML error page.
app.use((error, request, response, next) => {
  if (error.type === 'entity.parse.failed') {
    return response.status(400).json({ error: 'Please send valid JSON data.' });
  }
  if (error.type === 'entity.too.large') {
    return response.status(413).json({ error: 'That request is too large.' });
  }
  sendServerError(response, error);
});

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a whole number from 1 to 65535.');
  }
  const server = app.listen(port, () => {
    console.log(`Student Marks Calculator: http://localhost:${port}`);
  });
  server.on('error', error => {
    console.error('Could not start the server:', error);
    process.exitCode = 1;
    pool.end();
  });
}

module.exports = app;
