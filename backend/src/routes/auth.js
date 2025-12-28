const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/db');
const { jwtSecret, tokenExpiresIn } = require('../config');

const router = express.Router();

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        name: user.name,
        default_language: user.default_language
      },
      jwtSecret,
      { expiresIn: tokenExpiresIn }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        default_language: user.default_language
      }
    });
  });
});

// Init manager user (run once)
router.post('/init-manager', (req, res) => {
  const { name, username, password } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  db.run(
    'INSERT INTO users (name, username, password_hash, role, default_language) VALUES (?, ?, ?, ?, ?)',
    [name, username, hash, 'manager', 'en'],
    function (err) {
      if (err) return res.status(500).json({ message: 'Error creating manager', error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

module.exports = router;
