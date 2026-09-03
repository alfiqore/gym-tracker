const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './tracker.db';
const isNewDb = !fs.existsSync(DB_PATH);

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;'); // lebih aman kalau proses ke-kill mendadak (relevan buat Termux)

if (isNewDb) {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  console.log(`Database baru dibuat di ${DB_PATH} dengan schema lengkap.`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON chat_messages(chat_id, id);`);

db.exec(`
  CREATE TABLE IF NOT EXISTS workout_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    split_type TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS workout_template_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    set_number INTEGER NOT NULL,
    reps INTEGER,
    weight_kg REAL
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_workout_templates_name ON workout_templates(name);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_template_exercises_template ON workout_template_exercises(template_id);`);

module.exports = db;
