const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Users
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      default_language TEXT NOT NULL
    )
  `);

  // Housekeeping tasks store room_number as TEXT
  db.run(`
    CREATE TABLE IF NOT EXISTS housekeeping_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_number TEXT NOT NULL,
      housekeeper_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL, -- 'dirty', 'cleaning', 'ready_for_inspection', 'inspected'
      is_rush INTEGER NOT NULL DEFAULT 0,
      started_at TEXT,
      finished_at TEXT,
      FOREIGN KEY(housekeeper_id) REFERENCES users(id)
    )
  `);

  // Housekeeping notes
  db.run(`
    CREATE TABLE IF NOT EXISTS housekeeping_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      has_photo INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(task_id) REFERENCES housekeeping_tasks(id),
      FOREIGN KEY(author_id) REFERENCES users(id)
    )
  `);

  // Maintenance tickets store room_number as TEXT
  db.run(`
    CREATE TABLE IF NOT EXISTS maintenance_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_number TEXT NOT NULL,
      created_by_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL, -- 'normal' or 'rush'
      status TEXT NOT NULL,   -- 'open', 'in_progress', 'done'
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(created_by_id) REFERENCES users(id)
    )
  `);
});

module.exports = db;
