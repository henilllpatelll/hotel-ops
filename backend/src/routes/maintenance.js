const express = require('express');
const db = require('../db/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

// Create ticket (manager)
router.post('/', authRequired, requireRole(['manager']), (req, res) => {
  const { roomNumber, description, priority } = req.body;
  const now = new Date().toISOString();
  const prio = priority === 'rush' ? 'rush' : 'normal';

  db.run(
    `
    INSERT INTO maintenance_tickets
      (room_number, created_by_id, description, priority, status, created_at, updated_at, housekeeping_task_id)
    VALUES (?, ?, ?, ?, 'open', ?, ?, NULL)
  `,
    [roomNumber, req.user.id, description, prio, now, now],
    function (err) {
      if (err) return res.status(500).json({ message: 'DB error' });
      res.json({ id: this.lastID });
    }
  );
});

// Create ticket from housekeeping task (headHK, manager)
router.post(
  '/from-housekeeping',
  authRequired,
  requireRole(['headhousekeeper', 'manager']),
  (req, res) => {
    const { taskId, description, priority } = req.body;
    const now = new Date().toISOString();
    const prio = priority === 'rush' ? 'rush' : 'normal';

    if (!taskId || !description) {
      return res.status(400).json({ message: 'taskId and description are required' });
    }

    db.get(
      'SELECT * FROM housekeeping_tasks WHERE id = ?',
      [taskId],
      (err, task) => {
        if (err) return res.status(500).json({ message: 'DB error' });
        if (!task) return res.status(404).json({ message: 'Housekeeping task not found' });

        const roomNumber = task.room_number;

        db.run(
          `
          INSERT INTO maintenance_tickets
            (room_number, created_by_id, description, priority, status, created_at, updated_at, housekeeping_task_id)
          VALUES (?, ?, ?, ?, 'open', ?, ?, ?)
        `,
          [roomNumber, req.user.id, description, prio, now, now, taskId],
          function (err2) {
            if (err2) return res.status(500).json({ message: 'DB error' });
            res.json({ id: this.lastID });
          }
        );
      }
    );
  }
);

// Maintenance: my tickets (open/in_progress)
router.get('/my', authRequired, requireRole(['maintenance']), (req, res) => {
  db.all(
    `
    SELECT t.*
    FROM maintenance_tickets t
    WHERE t.status IN ('open', 'in_progress')
    ORDER BY t.priority DESC, t.created_at ASC
  `,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'DB error' });
      res.json(rows);
    }
  );
});

// Manager/headHK: board of all tickets
router.get('/board', authRequired, requireRole(['manager', 'headhousekeeper']), (req, res) => {
  db.all(
    `
    SELECT t.*
    FROM maintenance_tickets t
    ORDER BY t.priority DESC, t.created_at ASC
  `,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'DB error' });
      res.json(rows);
    }
  );
});

// Update status or priority
router.post(
  '/update',
  authRequired,
  requireRole(['manager', 'maintenance', 'headhousekeeper']),
  (req, res) => {
    const { ticketId, status, priority } = req.body;
    const allowedStatus = ['open', 'in_progress', 'done'];
    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const prio =
      priority && priority === 'rush'
        ? 'rush'
        : priority === 'normal'
        ? 'normal'
        : null;

    const now = new Date().toISOString();

    db.get('SELECT * FROM maintenance_tickets WHERE id = ?', [ticketId], (err, ticket) => {
      if (err) return res.status(500).json({ message: 'DB error' });
      if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

      const newStatus = status || ticket.status;
      const newPriority = prio || ticket.priority;

      db.run(
        'UPDATE maintenance_tickets SET status = ?, priority = ?, updated_at = ? WHERE id = ?',
        [newStatus, newPriority, now, ticketId],
        function (err2) {
          if (err2) return res.status(500).json({ message: 'DB error' });
          res.json({ success: true });
        }
      );
    });
  }
);

// Delete ticket (manager)
router.delete('/:id', authRequired, requireRole(['manager']), (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM maintenance_tickets WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ message: 'DB error', error: err.message });
    if (this.changes === 0) return res.status(404).json({ message: 'Ticket not found' });
    res.json({ success: true });
  });
});

module.exports = router;
