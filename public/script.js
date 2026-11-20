// This array holds the latest list from PostgreSQL. The database creates IDs.
let students = [];
let isLoading = true;
let isBusy = false;
let loadFailed = false;

const form = document.getElementById('student-form');
const tableBody = document.getElementById('student-rows');
const passingFilter = document.getElementById('passing-filter');
const formMessage = document.getElementById('form-message');
const subjects = ['english', 'maths', 'science'];
const addButton = form.querySelector('button[type="submit"]');
const serverError = document.getElementById('server-error');

function showServerError(message = '') {
  serverError.textContent = message;
  serverError.hidden = !message;
}

// Handle network failures, field errors, and responses with no content.
async function apiRequest(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error('Could not connect to the server. Is it running?');
  }

  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Please check the highlighted fields.');
    error.fieldErrors = data.errors;
    throw error;
  }
  return data;
}

function setBusy(busy) {
  isBusy = busy;
  addButton.disabled = busy;
  tableBody.querySelectorAll('button').forEach(button => {
    button.disabled = busy;
  });
}

async function loadStudents() {
  isLoading = true;
  loadFailed = false;
  renderStudents();
  try {
    students = await apiRequest('/api/students');
  } catch (error) {
    loadFailed = true;
    throw error;
  } finally {
    isLoading = false;
    renderStudents();
  }
}

function getTotal(student) {
  return student.english + student.maths + student.science;
}

function hasPassed(student) {
  return student.english >= 40 && student.maths >= 40 && student.science >= 40;
}

function renderStudents() {
  // Calculate from the FULL list before applying the table filter.
  const highestTotal = students.reduce((highest, student) => Math.max(highest, getTotal(student)), -1);
  const percentageSum = students.reduce((sum, student) => sum + getTotal(student) / 3, 0);
  document.getElementById('student-count').textContent = students.length;
  document.getElementById('class-average').textContent = students.length
    ? (percentageSum / students.length).toFixed(2) + '%' : '—';

  const visibleStudents = passingFilter.checked ? students.filter(hasPassed) : students;
  tableBody.replaceChildren();

  if (isLoading || loadFailed) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 8;
    cell.className = 'empty';
    cell.textContent = isLoading ? 'Loading students...' : 'Could not load students. Please refresh to try again.';
    row.append(cell);
    tableBody.append(row);
    // Avoid presenting an unavailable list as an empty class.
    document.getElementById('student-count').textContent = '\u2014';
    document.getElementById('class-average').textContent = '\u2014';
    return;
  }

  if (visibleStudents.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 8;
    cell.className = 'empty';
    cell.textContent = students.length === 0 ? 'No students yet. Add one above!' : 'No passing students.';
    row.append(cell);
    tableBody.append(row);
    return;
  }

  // map() turns each visible student into a table row.
  const rows = visibleStudents.map(student => {
    const row = document.createElement('tr');
    const total = getTotal(student);
    if (total === highestTotal) row.classList.add('top-scorer');

    const values = [student.name, student.english, student.maths, student.science, total, (total / 3).toFixed(2)];
    values.forEach(value => {
      const cell = document.createElement('td');
      // textContent safely displays names as text, even if they contain HTML.
      cell.textContent = value;
      row.append(cell);
    });

    const statusCell = document.createElement('td');
    const passed = hasPassed(student);
    const statusBadge = document.createElement('span');
    statusBadge.textContent = passed ? 'Pass' : 'Fail';
    statusBadge.className = 'status-badge ' + (passed ? 'pass' : 'fail');
    statusCell.append(statusBadge);
    row.append(statusCell);

    const deleteCell = document.createElement('td');
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-button';
    deleteButton.disabled = isBusy;
    deleteButton.textContent = 'Delete';
    deleteButton.setAttribute('aria-label', 'Delete ' + student.name);
    deleteButton.addEventListener('click', () => deleteStudent(student));
    deleteCell.append(deleteButton);
    row.append(deleteCell);
    return row;
  });
  tableBody.append(...rows);
}

function showError(fieldName, message) {
  document.getElementById(fieldName + '-error').textContent = message;
  document.getElementById(fieldName).setAttribute('aria-invalid', message ? 'true' : 'false');
}

async function deleteStudent(student) {
  if (isBusy || !confirm('Are you sure?')) return;
  setBusy(true);
  showServerError();
  formMessage.textContent = '';
  try {
    await apiRequest('/api/students/' + student.id, { method: 'DELETE' });
    formMessage.textContent = student.name + ' was deleted.';
    await loadStudents();
  } catch (error) {
    showServerError(error.message);
  } finally {
    setBusy(false);
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (isBusy) return;
  formMessage.textContent = '';
  const name = document.getElementById('name').value.trim();
  let isValid = true;
  showError('name', name ? '' : 'Please enter a student name.');
  if (!name) isValid = false;

  const marks = {};
  subjects.forEach(subject => {
    const input = document.getElementById(subject);
    const rawValue = input.value.trim();
    const value = Number(rawValue);
    let error = '';
    // Check blank values first: Number('') would otherwise become zero.
    if (input.validity.badInput) error = 'Enter a whole number from 0 to 100.';
    else if (rawValue === '') error = 'Please enter a mark.';
    else if (!Number.isInteger(value) || value < 0 || value > 100) error = 'Enter a whole number from 0 to 100.';
    showError(subject, error);
    if (error) isValid = false;
    marks[subject] = value;
  });

  if (!isValid) {
    form.querySelector('[aria-invalid="true"]').focus();
    return;
  }

  setBusy(true);
  showServerError();
  try {
    await apiRequest('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ...marks })
    });
    form.reset();
    ['name', ...subjects].forEach(field => showError(field, ''));
    formMessage.textContent = name + ' was added successfully.';
    await loadStudents();
    document.getElementById('name').focus();
  } catch (error) {
    if (error.fieldErrors) {
      ['name', ...subjects].forEach(field => showError(field, error.fieldErrors[field] || ''));
      const invalidField = form.querySelector('[aria-invalid="true"]');
      if (invalidField) invalidField.focus();
    } else {
      showServerError(error.message);
    }
  } finally {
    setBusy(false);
  }
});

passingFilter.addEventListener('change', renderStudents);
async function startApp() {
  setBusy(true);
  try {
    await loadStudents();
  } catch (error) {
    showServerError(error.message);
  } finally {
    setBusy(false);
  }
}

startApp();
