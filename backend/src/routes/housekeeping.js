const express = require('express');
const db = require('../db/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

// Assign rooms to a housekeeper for a specific date (room_numbers is array of strings)
router.post(
  '/assign',
  authRequired,
  requireRole(['manager', 'headhousekeeper']),
  (req, res) => {
    const { housekeeperId, roomNumbers, date } = req.body;
    const day = date || new Date().toISOString().slice(0, 10);

    db.serialize(() => {
      const stmt = db.prepare(`
        INSERT INTO housekeeping_tasks (room_number, housekeeper_id, date, status, is_rush)
        VALUES (?, ?, ?, 'dirty', 0)
      `);
      roomNumbers.forEach((roomNumber) => {
        stmt.run(roomNumber, housekeeperId, day);
      });
      stmt.finalize((err) => {
        if (err) return res.status(500).json({ message: 'DB error' });
        res.json({ success: true });
      });
    });
  }
);

// List tasks for current user (housekeeper or headhousekeeper)
router.get(
  '/my-tasks',
  authRequired,
  requireRole(['housekeeper', 'headhousekeeper']),
  (req, res) => {
    const day = new Date().toISOString().slice(0, 10);
    db.all(
      `
      SELECT
        t.*,
        EXISTS(
          SELECT 1 FROM maintenance_tickets mt
          WHERE mt.housekeeping_task_id = t.id
        ) AS has_maintenance
      FROM housekeeping_tasks t
      WHERE t.housekeeper_id = ? AND t.date = ?
      ORDER BY t.is_rush DESC, t.room_number ASC
    `,
      [req.user.id, day],
      (err, rows) => {
        if (err) return res.status(500).json({ message: 'DB error' });
        res.json(rows);
      }
    );
  }
);

// Manager/head HK board: all tasks for today
router.get(
  '/board',
  authRequired,
  requireRole(['manager', 'headhousekeeper']),
  (req, res) => {
    const day = new Date().toISOString().slice(0, 10);

    db.all(
      `
      SELECT
        t.*,
        u.name AS housekeeper_name,
        EXISTS(SELECT 1 FROM housekeeping_notes n WHERE n.task_id = t.id) AS has_note,
        EXISTS(
          SELECT 1 FROM maintenance_tickets mt
          WHERE mt.housekeeping_task_id = t.id
        ) AS has_maintenance
      FROM housekeeping_tasks t
      JOIN users u ON u.id = t.housekeeper_id
      WHERE t.date = ?
      ORDER BY t.is_rush DESC, t.room_number ASC
    `,
      [day],
      (err, rows) => {
        if (err) return res.status(500).json({ message: 'DB error' });
        res.json(rows);
      }
    );
  }
);

// Housekeeper (or headhousekeeper) updates status on own task
// NOTE: housekeepers cannot set 'stayover' here.
router.post(
  '/update-status',
  authRequired,
  requireRole(['housekeeper', 'headhousekeeper']),
  (req, res) => {
    const { taskId, status } = req.body;
    const now = new Date().toISOString();

    // No 'stayover' here on purpose
    const allowed = ['dirty', 'cleaning', 'ready_for_inspection'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    db.get('SELECT * FROM housekeeping_tasks WHERE id = ?', [taskId], (err, task) => {
      if (err) return res.status(500).json({ message: 'DB error' });
      if (!task) return res.status(404).json({ message: 'Task not found' });
      if (task.housekeeper_id !== req.user.id) {
        return res.status(403).json({ message: 'Not your task' });
      }

      // Block changes if already inspected
      if (task.status === 'inspected') {
        return res.status(400).json({ message: 'Task already inspected; status cannot be changed' });
      }

      let started_at = task.started_at;
      let finished_at = task.finished_at;

      if (status === 'cleaning' && !started_at) started_at = now;
      if (status === 'ready_for_inspection') finished_at = now;

      db.run(
        'UPDATE housekeeping_tasks SET status = ?, started_at = ?, finished_at = ? WHERE id = ?',
        [status, started_at, finished_at, taskId],
        function (err2) {
          if (err2) return res.status(500).json({ message: 'DB error' });
          res.json({ success: true });
        }
      );
    });
  }
);

// Head housekeeper updates status for any task (but NOT to stayover)
router.post(
  '/update-status-any',
  authRequired,
  requireRole(['headhousekeeper']),
  (req, res) => {
    const { taskId, status } = req.body;
    const now = new Date().toISOString();

    // Head HK can only use normal cleaning statuses
    const allowed = ['dirty', 'cleaning', 'ready_for_inspection'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    db.get('SELECT * FROM housekeeping_tasks WHERE id = ?', [taskId], (err, task) => {
      if (err) return res.status(500).json({ message: 'DB error' });
      if (!task) return res.status(404).json({ message: 'Task not found' });

      if (task.status === 'inspected') {
        return res.status(400).json({ message: 'Task already inspected; status cannot be changed' });
      }

      let started_at = task.started_at;
      let finished_at = task.finished_at;

      if (status === 'cleaning' && !started_at) started_at = now;
      if (status === 'ready_for_inspection') finished_at = now;

      db.run(
        'UPDATE housekeeping_tasks SET status = ?, started_at = ?, finished_at = ? WHERE id = ?',
        [status, started_at, finished_at, taskId],
        function (err2) {
          if (err2) return res.status(500).json({ message: 'DB error' });
          res.json({ success: true });
        }
      );
    });
  }
);

// MANAGER-ONLY: set status to stayover
router.post(
  '/set-stayover',
  authRequired,
  requireRole(['manager']),
  (req, res) => {
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ message: 'taskId is required' });
    }

    db.get('SELECT * FROM housekeeping_tasks WHERE id = ?', [taskId], (err, task) => {
      if (err) return res.status(500).json({ message: 'DB error' });
      if (!task) return res.status(404).json({ message: 'Task not found' });

      if (task.status === 'inspected') {
        return res.status(400).json({ message: 'Task already inspected; status cannot be changed' });
      }

      db.run(
        'UPDATE housekeeping_tasks SET status = ? WHERE id = ?',
        ['stayover', taskId],
        function (err2) {
          if (err2) return res.status(500).json({ message: 'DB error' });
          res.json({ success: true });
        }
      );
    });
  }
);

// Head HK / manager marks inspected
router.post(
  '/inspect',
  authRequired,
  requireRole(['headhousekeeper', 'manager']),
  (req, res) => {
    const { taskId } = req.body;
    db.run(
      'UPDATE housekeeping_tasks SET status = ? WHERE id = ?',
      ['inspected', taskId],
      function (err) {
        if (err) return res.status(500).json({ message: 'DB error' });
        res.json({ success: true });
      }
    );
  }
);

// Mark task as rush / normal
router.post(
  '/rush',
  authRequired,
  requireRole(['manager', 'headhousekeeper']),
  (req, res) => {
    const { taskId, isRush } = req.body;
    db.run(
      'UPDATE housekeeping_tasks SET is_rush = ? WHERE id = ?',
      [isRush ? 1 : 0, taskId],
      function (err) {
        if (err) return res.status(500).json({ message: 'DB error' });
        res.json({ success: true });
      }
    );
  }
);

// Housekeeper / headhousekeeper adds note (text only)
router.post(
  '/note',
  authRequired,
  requireRole(['housekeeper', 'headhousekeeper']),
  (req, res) => {
    const { taskId, text } = req.body;
    const now = new Date().toISOString();
    db.run(
      'INSERT INTO housekeeping_notes (task_id, author_id, text, created_at, has_photo) VALUES (?, ?, ?, ?, 0)',
      [taskId, req.user.id, text, now],
      function (err) {
        if (err) return res.status(500).json({ message: 'DB error' });
        res.json({ id: this.lastID });
      }
    );
  }
);

// Anyone logged in can set checkout time on a task (store plain "HH:MM")
router.post(
  '/checkout-time',
  authRequired,
  (req, res) => {
    const { taskId, checkoutTime } = req.body;
    if (!taskId) {
      return res.status(400).json({ message: 'taskId is required' });
    }

    const trimmed = checkoutTime && String(checkoutTime).trim();
    const value = trimmed ? trimmed : null; // "HH:MM" or null

    db.run(
      'UPDATE housekeeping_tasks SET checkout_time = ? WHERE id = ?',
      [value, taskId],
      function (err) {
        if (err) return res.status(500).json({ message: 'DB error' });
        if (this.changes === 0) return res.status(404).json({ message: 'Task not found' });
        res.json({ success: true });
      }
    );
  }
);

// Manager/head HK: get notes for a task
router.get(
  '/notes/:taskId',
  authRequired,
  requireRole(['manager', 'headhousekeeper']),
  (req, res) => {
    const { taskId } = req.params;
    db.all(
      `
      SELECT n.*, u.name AS author_name
      FROM housekeeping_notes n
      JOIN users u ON u.id = n.author_id
      WHERE n.task_id = ?
      ORDER BY n.created_at ASC
    `,
      [taskId],
      (err, rows) => {
        if (err) return res.status(500).json({ message: 'DB error' });
        res.json(rows);
      }
    );
  }
);

// Reset today's housekeeping tasks
router.post(
  '/reset-today',
  authRequired,
  requireRole(['manager', 'headhousekeeper']),
  (req, res) => {
    const day = new Date().toISOString().slice(0, 10);
    db.run(
      'DELETE FROM housekeeping_tasks WHERE date = ?',
      [day],
      function (err) {
        if (err) return res.status(500).json({ message: 'DB error', error: err.message });
        res.json({ success: true, deleted: this.changes });
      }
    );
  }
);

// Delete a single housekeeping task (by id)
router.delete(
  '/:taskId',
  authRequired,
  requireRole(['manager', 'headhousekeeper']),
  (req, res) => {
    const { taskId } = req.params;

    db.run(
      'DELETE FROM housekeeping_tasks WHERE id = ?',
      [taskId],
      function (err) {
        if (err) {
          return res.status(500).json({ message: 'DB error', error: err.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: 'Task not found' });
        }
        res.json({ success: true, deleted: this.changes });
      }
    );
  }
);

module.exports = router;
