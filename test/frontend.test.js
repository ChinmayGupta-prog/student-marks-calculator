const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

// A small page stand-in tests browser logic without installing a framework.
class Element {
  constructor() {
    this.children = [];
    this.value = '';
    this.attributes = {};
    this.validity = {};
    this.classList = { add: name => { this.highlight = name; } };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren() { this.children = []; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, handler) { this[name] = handler; }
  focus() {}
  querySelectorAll() { return this.children.flatMap(row => row.children.flatMap(cell => cell.children)); }
}

test('browser keeps full-list calculations, filter, safe names and empty states after API changes', async () => {
  const elements = {};
  const get = id => elements[id] ||= new Element();
  const fields = ['name', 'english', 'maths', 'science'];
  const addButton = new Element();
  get('student-form').querySelector = selector => selector.startsWith('button')
    ? addButton : fields.map(get).find(field => field.attributes['aria-invalid'] === 'true');
  get('student-form').reset = () => fields.forEach(field => { get(field).value = ''; });
  let records = [
    { id: 1, name: 'Asha', english: 85, maths: 90, science: 80 },
    { id: 2, name: 'Ben', english: 90, maths: 80, science: 85 },
    { id: 3, name: 'Chris', english: 95, maths: 98, science: 35 },
    { id: 4, name: 'Dana', english: 60, maths: 55, science: 70 }
  ];
  let available = true;
  let allowDelete = false;
  const context = vm.createContext({
    document: { getElementById: get, createElement: () => new Element() },
    confirm: () => allowDelete,
    fetch: async (url, options = {}) => {
      if (!available) throw new Error('offline');
      if (options.method === 'POST') {
        const student = JSON.parse(options.body);
        assert.equal(typeof student.english, 'number');
        records.push({ id: 5, ...student });
      }
      if (options.method === 'DELETE') {
        records = records.filter(student => student.id !== Number(url.split('/').pop()));
      }
      return { ok: true, status: options.method === 'DELETE' ? 204 : 200, json: async () => records.slice() };
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/script.js'), 'utf8'), context);
  const settle = () => new Promise(resolve => setImmediate(resolve));
  await settle();
  assert.equal(get('class-average').textContent, '76.92%');
  assert.equal(get('student-rows').children.filter(row => row.highlight).length, 2);
  get('passing-filter').checked = true;
  get('passing-filter').change();
  assert.equal(get('student-rows').children.length, 3);

  fields.forEach((field, index) => { get(field).value = [' <b>Top</b> ', '100', '100', '39'][index]; });
  await get('student-form').submit({ preventDefault() {} });
  assert.equal(records.length, 5);
  assert.equal(get('student-rows').children.length, 3);
  assert.equal(get('student-rows').children.filter(row => row.highlight).length, 2);
  assert.equal(get('student-count').textContent, 5);
  assert.equal(get('name').value, '');
  get('passing-filter').checked = false;
  get('passing-filter').change();
  const row = get('student-rows').children.at(-1);
  assert.equal(row.children[0].textContent, '<b>Top</b>');
  await row.children.at(-1).children[0].click();
  assert.equal(records.length, 5);
  allowDelete = true;
  await row.children.at(-1).children[0].click();
  assert.equal(records.length, 4);

  records = [{ id: 6, name: 'Fail', english: 0, maths: 0, science: 0 }];
  get('passing-filter').checked = true;
  await vm.runInContext('loadStudents()', context);
  assert.equal(get('student-rows').children[0].children[0].textContent, 'No passing students.');
  records = [];
  await vm.runInContext('loadStudents()', context);
  assert.equal(get('class-average').textContent, '\u2014');
  assert.equal(get('student-rows').children[0].children[0].textContent, 'No students yet. Add one above!');
  available = false;
  await vm.runInContext('startApp()', context);
  assert.equal(get('server-error').hidden, false);
  assert.match(get('server-error').textContent, /Could not connect/);
  assert.equal(addButton.disabled, false);
});
