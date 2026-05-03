const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

// GET /api/labs — list all labs
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM labs ORDER BY is_partner DESC, name ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch labs' });
  }
});

module.exports = router;
