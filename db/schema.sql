-- WARNING: This resets the table and deletes ALL existing student data.
DROP TABLE IF EXISTS students;

CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL CHECK (name !~ '^[[:space:]]*$'),
  english INTEGER NOT NULL CHECK (english BETWEEN 0 AND 100),
  maths INTEGER NOT NULL CHECK (maths BETWEEN 0 AND 100),
  science INTEGER NOT NULL CHECK (science BETWEEN 0 AND 100)
);
