const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

// GET /api/scans/:rollId — list scans for a roll
router.get('/:rollId', async (req, res) => {
  const { rollId } = req.params;
  try {
    // Verify roll belongs to user
    const { rows: rollRows } = await pool.query(
      'SELECT id FROM rolls WHERE id = $1 AND user_id = $2',
      [rollId, req.user.id]
    );
    if (rollRows.length === 0) {
      return res.status(404).json({ error: 'Roll not found' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM scans WHERE roll_id = $1 ORDER BY created_at DESC',
      [rollId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch scans' });
  }
});

// POST /api/scans — add scan link (solo/pro plan only)
router.post(
  '/',
  [
    body('roll_id').isUUID().withMessage('roll_id must be a UUID'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check plan
    if (req.user.plan === 'free') {
      return res.status(403).json({
        error: 'Scan linking requires a Solo or Pro plan.',
        code: 'PLAN_REQUIRED',
      });
    }

    const { roll_id, file_url, dropbox_link, notes, returned_at } = req.body;

    try {
      // Verify roll belongs to user
      const { rows: rollRows } = await pool.query(
        'SELECT id FROM rolls WHERE id = $1 AND user_id = $2',
        [roll_id, req.user.id]
      );
      if (rollRows.length === 0) {
        return res.status(404).json({ error: 'Roll not found' });
      }

      const { rows } = await pool.query(
        `INSERT INTO scans (roll_id, file_url, dropbox_link, notes, returned_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [roll_id, file_url || null, dropbox_link || null, notes || null, returned_at || null]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create scan' });
    }
  }
);

// DELETE /api/scans/:id
router.delete('/:id', async (req, res) => {
  try {
    // Verify scan belongs to user via roll ownership
    const { rowCount } = await pool.query(
      `DELETE FROM scans
       WHERE id = $1
         AND roll_id IN (SELECT id FROM rolls WHERE user_id = $2)`,
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete scan' });
  }
});

module.exports = router;
