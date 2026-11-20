const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

// Use a fake query function: these API tests never access your real database.
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
const pool = require('../db');
let savedStudents = [];
let nextId = 1;
let failQuery = false;

pool.query = async (sql, values) => {
  if (failQuery) throw new Error('Simulated database failure');
  if (sql.startsWith('SELECT')) return { rows: savedStudents.slice() };
  if (sql.startsWith('INSERT')) {
    assert.match(sql, /\$1, \$2, \$3, \$4/);
    const [name, english, maths, science] = values;
    const student = { id: nextId++, name, english, maths, science };
    savedStudents.push(student);
    return { rows: [student] };
  }
  assert.match(sql, /WHERE id = \$1/);
  const previousCount = savedStudents.length;
  savedStudents = savedStudents.filter(student => student.id !== values[0]);
  return { rowCount: previousCount - savedStudents.length };
};

const app = require('../server');
let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
  await pool.end();
});

function post(body) {
  return fetch(baseUrl + '/api/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

test('serves the existing page and keeps private settings inaccessible', async () => {
  const page = await fetch(baseUrl);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Student Marks Calculator/);
  assert.equal((await fetch(baseUrl + '/.env')).status, 404);
});

test('rejects blank names and missing, fractional, out-of-range or nonnumeric marks', async () => {
  for (const mark of ['', null, undefined, '40', true, [], {}, -1, 101, 40.5]) {
    const response = await post({ name: '   ', english: mark, maths: 80, science: 90 });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.ok(body.errors.name);
    assert.ok(body.errors.english);
  }
});

test('saves trimmed names and boundary marks, lists records, and deletes by ID', async () => {
  const name = "<b>Asha</b>'); DROP TABLE students; --";
  const response = await post({ name: '  ' + name + '  ', english: 0, maths: 100, science: 40 });
  assert.equal(response.status, 201);
  const student = await response.json();
  assert.equal(student.name, name);
  assert.equal(student.english, 0);
  const list = await (await fetch(baseUrl + '/api/students')).json();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, student.id);
  const deleted = await fetch(baseUrl + '/api/students/' + student.id, { method: 'DELETE' });
  assert.equal(deleted.status, 204);
  assert.equal(await deleted.text(), '');
  assert.equal((await fetch(baseUrl + '/api/students/' + student.id, { method: 'DELETE' })).status, 404);
});

test('rejects invalid IDs and malformed JSON', async () => {
  for (const id of ['abc', '1.5', '-1', '0', '1e2', '2147483648']) {
    assert.equal((await fetch(baseUrl + '/api/students/' + id, { method: 'DELETE' })).status, 400);
  }
  const response = await fetch(baseUrl + '/api/students', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken'
  });
  assert.equal(response.status, 400);
});

test('database failures return a friendly error without internal details', async () => {
  failQuery = true;
  try {
    const response = await fetch(baseUrl + '/api/students');
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Something went wrong. Please try again.' });
  } finally {
    failQuery = false;
  }
});
