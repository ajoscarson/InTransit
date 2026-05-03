const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

// GET /api/cameras — list user's cameras
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM cameras WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch cameras' });
  }
});

// POST /api/cameras — create camera
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Camera name is required'),
    body('format')
      .isIn(['35mm', '120', '4x5', 'large_format'])
      .withMessage('Invalid format'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, format, notes } = req.body;
    try {
      const { rows } = await pool.query(
        `INSERT INTO cameras (user_id, name, format, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [req.user.id, name, format, notes || null]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create camera' });
    }
  }
);

// PUT /api/cameras/:id — update camera
router.put(
  '/:id',
  [
    body('name').optional().trim().notEmpty(),
    body('format').optional().isIn(['35mm', '120', '4x5', 'large_format']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, format, notes } = req.body;

    try {
      const { rows } = await pool.query(
        `UPDATE cameras
         SET name   = COALESCE($1, name),
             format = COALESCE($2, format),
             notes  = COALESCE($3, notes)
         WHERE id = $4 AND user_id = $5
         RETURNING *`,
        [name || null, format || null, notes !== undefined ? notes : null, id, req.user.id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Camera not found' });
      }
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update camera' });
    }
  }
);

// DELETE /api/cameras/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM cameras WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete camera' });
  }
});

module.exports = router;
