const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/roll-locations/:rollId
router.get('/:rollId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT rl.* FROM roll_locations rl
       JOIN rolls r ON r.id = rl.roll_id
       WHERE rl.roll_id = $1 AND r.user_id = $2
       ORDER BY rl.frame_start ASC NULLS LAST, rl.created_at ASC`,
      [req.params.rollId, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// POST /api/roll-locations
router.post(
  '/',
  [
    body('roll_id').notEmpty(),
    body('location').notEmpty().withMessage('Location is required'),
    body('frame_start').optional({ nullable: true }).isInt({ min: 1 }),
    body('frame_end').optional({ nullable: true }).isInt({ min: 1 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { roll_id, location, frame_start, frame_end, notes } = req.body;

    try {
      // Verify roll belongs to this user
      const { rowCount } = await pool.query(
        'SELECT 1 FROM rolls WHERE id = $1 AND user_id = $2',
        [roll_id, req.user.id]
      );
      if (rowCount === 0) return res.status(404).json({ error: 'Roll not found' });

      const { rows } = await pool.query(
        `INSERT INTO roll_locations (roll_id, location, frame_start, frame_end, notes)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [roll_id, location, frame_start || null, frame_end || null, notes || null]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to add location' });
    }
  }
);

// DELETE /api/roll-locations/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM roll_locations rl
       USING rolls r
       WHERE rl.id = $1 AND rl.roll_id = r.id AND r.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Location not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

module.exports = router;
