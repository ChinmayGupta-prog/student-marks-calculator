# Student Marks Calculator

The existing HTML, CSS, and vanilla JavaScript page now uses Node.js, Express, and PostgreSQL. Student records survive refreshing the page and restarting the app. The browser still calculates results and applies the passing-students filter.

## Files

```text
public/
  index.html       Page and form
  style.css        Existing design plus error/loading styles
  script.js        Browser validation, API calls, results and filtering
db/
  schema.sql       Table definition and database checks
  seed.sql         Four sample students
  setup.js         Reset the table and load samples
db.js              Shared PostgreSQL connection pool
server.js          Express server and three API routes
.env.example       Placeholder settings
.gitignore         Keeps private settings and dependencies out of Git
package.json       Dependencies and commands
package-lock.json  Exact installed dependency versions
```

All source files contain complete code. There is no build step and no front-end framework.

## Windows setup

1. Install the **LTS** version of Node.js from https://nodejs.org/en/download/. LTS means a version maintained for long-term use. Open a new PowerShell window afterward. Check installation with `node --version` and `npm --version`.
2. Install PostgreSQL using https://www.postgresql.org/download/windows/. Include PostgreSQL Server and pgAdmin. Remember the password you choose for the `postgres` database user. The usual database port is `5432`.
3. Open pgAdmin. Expand **Servers**, connect to your local PostgreSQL server, and enter that password. Right-click **Databases**, choose **Create > Database**, enter `student_marks`, and click **Save**.
4. Open PowerShell in this project folder:

   ```powershell
   cd student-marks-calculator
   Copy-Item .env.example .env
   notepad .env
   ```

5. Replace `yourpassword` in `.env` with your PostgreSQL password and save:

   ```text
   DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/student_marks
   PORT=3000
   ```

   This is the PostgreSQL user's password, not a separate pgAdmin master password. If your password contains URL characters, encode them in the URL: for example, `@` becomes `%40`, `#` becomes `%23`, and `%` becomes `%25`. Keep your actual password private.

6. Install the project dependencies:

   ```powershell
   npm install
   ```

7. Create the table and load the sample students:

   ```powershell
   npm run db:setup
   ```

   **Warning: this command deletes every existing student and restores the four samples.** Run it for initial setup or when you intentionally want to reset the data. Ordinary restarts do not require it. The command uses one transaction, meaning the complete reset succeeds together or is rolled back together.

8. Start development mode:

   ```powershell
   npm run dev
   ```

   `nodemon` restarts the server when you edit server files. Use `npm start` when you do not want automatic restarts. Press **Ctrl+C** to stop the server.

9. Open **http://localhost:3000**. Use this address instead of double-clicking the HTML file or using Live Server. Express serves both the page and its API from the same address.

If PowerShell blocks `npm.ps1`, use `npm.cmd install`, `npm.cmd run db:setup`, and `npm.cmd run dev` instead.

## What happens when you click Add Student

1. The browser trims the name and checks all four fields. Blank marks are invalid; zero is valid.
2. It sends a `POST /api/students` request containing JSON: a text name and three numeric marks. The Add button is disabled while the request and list refresh run.
3. Express reads the JSON and validates it again. Invalid fields receive individual messages.
4. The server sends a parameterised INSERT query through the pool. PostgreSQL checks its table rules, saves the row, and creates a unique ID using `SERIAL`.
5. The server returns the saved student with status `201`.
6. The browser clears the form, loads the full student list again, and recalculates results. The filter checkbox keeps its current setting.

If the save succeeds but refreshing the list fails, a success message records the save and a red error explains the refresh failure. Reload the page to retrieve the latest list.

## API routes

| Method and route | What it does | Success |
| --- | --- | --- |
| `GET /api/students` | Reads all students in ID order | `200` with an array |
| `POST /api/students` | Validates and saves one student | `201` with the saved object |
| `DELETE /api/students/:id` | Deletes the student identified by `id` | `204` with no body |

POST body example:

```json
{ "name": "Asha", "english": 85, "maths": 90, "science": 80 }
```

An invalid field returns `400`, for example:

```json
{ "errors": { "english": "Please enter a whole number from 0 to 100." } }
```

Invalid IDs return `400`; valid IDs with no matching student return `404`. Unexpected failures are logged in the terminal and return `500` with a simple message. The API never returns database credentials or internal error details.

## Important ideas

**Connection pool:** A small group of reusable database connections. Requests borrow available connections instead of repeatedly opening new ones. The `pg` pool handles returning connections after `pool.query()`. Setup borrows one connection explicitly so all its transaction commands use that same connection. See https://node-postgres.com/apis/pool.

**Parameterised queries:** SQL contains placeholders such as `$1`, while values are passed separately in an array. A name containing SQL-like text is treated as a value, not an instruction. This prevents SQL injection through user values. All queries containing user values use placeholders; schema, seed, and SELECT statements are fixed SQL with no user input. See https://node-postgres.com/features/queries.

**Validation twice:** Browser checks give quick, helpful feedback. Server checks protect the database because someone can send requests without using the form. Database constraints add a final check for required values and valid marks.

**The `.env` file:** A local settings file containing the database address, credentials, and server port. `dotenv` loads it into `process.env`. Never share or upload it to GitHub because it contains your password. `.gitignore` excludes it. Share `.env.example`, which contains placeholders only. If credentials are accidentally published, change the password; deleting the visible file alone does not remove it from Git history.

**Results and filtering:** The browser stores the fetched list in an array of student objects. `map()` builds rows, `filter()` selects passing students, and `reduce()` finds totals and the highest score. Every subject must be at least 40 to pass. Every highest-score tie gets a gold row, even if a tied student fails. Statistics and the highest score always use the full list. Only displayed percentages are rounded to two decimal places. No calculated results are stored in PostgreSQL.

## Three common errors

| Error | Meaning | Fix |
| --- | --- | --- |
| `password authentication failed` | PostgreSQL rejected the database username or password. | Check the `postgres` user's password and username in `.env`; encode special URL characters. Restart the server after editing settings. |
| `ECONNREFUSED` | No server accepted the connection at that address and port. | For database errors, open Windows **Services**, start the PostgreSQL service, and check port `5432` and the host in `.env`. If the browser cannot connect, run `npm run dev` and use its displayed address. |
| `EADDRINUSE` / port 3000 already in use | Another program is using the web server's port. | Stop the previous app with Ctrl+C, or change `PORT=3001` in `.env`, restart, and open `http://localhost:3001`. |

## Quick manual check

Run `npm test` for automated API and browser-logic checks. These tests use stand-ins and never modify your PostgreSQL database. The implementation was also checked against a separate temporary PostgreSQL instance for schema setup, seeding, saving, deleting, constraints, and reads through a separate connection.

Nodemon is pinned to version 3.1.11 to avoid an advisory in the newer release's dependency chain. The installed dependencies passed `npm audit` with no reported vulnerabilities at implementation time.

After initial setup, Asha and Ben should both have gold rows and the class average should be **76.92%**. Chris should fail because Science is 35. Add a student and refresh: the student should remain. Switch on the passing filter, then add or delete a student: the filter should remain on. Cancel a deletion to keep the row. Statistics should always include all students.
